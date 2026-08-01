#!/usr/bin/env python3
"""One-time, fail-closed import of the three currently Tricount-only expenses.

Safety properties:
- Re-reads both live ledgers before writing.
- Aborts unless the only Tricount-only expenses are exactly the expected three.
- Aborts on any ambiguity or Roadtrip-only expense.
- Uses Firebase ETag + If-Match to avoid overwriting concurrent edits.
- Adds only; never edits or deletes existing expenses.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from reconcile import (
    DEFAULT_FIREBASE_URL,
    fetch_firebase,
    norm,
    reconcile,
    roadtrip_expenses,
    tricount_expenses,
)

EXPECTED = {
    "asia nudeln": {
        "description": "Asia Nudeln",
        "amount_cents": 500,
        "payer": "jakob",
        "shares": {"bernhard": 250, "christoph": 250},
    },
    "tisch": {
        "description": "Tisch",
        "amount_cents": 4500,
        "payer": "bernhard",
        "shares": {
            "bernhard": 750,
            "christoph": 750,
            "freddi": 750,
            "jakob": 750,
            "lukas": 750,
            "max": 750,
        },
    },
    "riegel decatlon": {
        "description": "Riegel Decatlon",
        "amount_cents": 3100,
        "payer": "bernhard",
        "shares": {"bernhard": 1550, "christoph": 1550},
    },
}


def get_state_with_etag(url: str) -> tuple[dict, str]:
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "Cache-Control": "no-cache", "X-Firebase-ETag": "true"},
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        state = json.load(response)
        etag = response.headers.get("ETag")
    if not isinstance(state, dict) or not etag:
        raise RuntimeError("Firebase did not return a valid state + ETag")
    return state, etag


def put_state_if_match(url: str, state: dict, etag: str) -> None:
    payload = json.dumps(state, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="PUT",
        headers={"Content-Type": "application/json", "If-Match": etag},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"Firebase PUT returned HTTP {response.status}")
    except urllib.error.HTTPError as exc:
        if exc.code == 412:
            raise RuntimeError("Firebase changed concurrently; import aborted without overwriting it") from exc
        raise


def iso_after(existing: str | None) -> str:
    now = datetime.now(timezone.utc)
    if existing:
        try:
            prev = datetime.fromisoformat(existing.replace("Z", "+00:00"))
            if prev.tzinfo is None:
                prev = prev.replace(tzinfo=timezone.utc)
            if now <= prev:
                now = prev + timedelta(seconds=1)
        except ValueError:
            pass
    return now.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def make_expense(tc, crew_by_name: dict[str, str], crew_order: list[str]) -> dict:
    positive = {name: cents for name, cents in tc.shares.items() if cents > 0}
    expected = EXPECTED[norm(tc.description)]
    if positive != expected["shares"]:
        raise RuntimeError(f"Unexpected split for {tc.description}: {positive}")

    payer_id = crew_by_name.get(tc.payer)
    if not payer_id:
        raise RuntimeError(f"No Roadtrip crew mapping for payer {tc.payer}")

    sharers = [cid for cid in crew_order if norm(next_name_by_id[cid]) in positive]
    if not sharers:
        raise RuntimeError(f"No Roadtrip sharers mapped for {tc.description}")

    # All three expected imports are equal splits among their positive-share participants,
    # so Roadtrip's native equal-split representation reproduces Tricount exactly.
    values = set(positive.values())
    if len(values) != 1:
        raise RuntimeError(f"Expected equal split for {tc.description}, got {positive}")

    return {
        "id": "x-tc-" + tc.source_id.replace("-", "")[:16],
        "date": tc.date,
        "desc": tc.description,
        "amount": float(Decimal(tc.amount_cents) / Decimal(100)),
        "payer": payer_id,
        "sharers": sharers,
        "tricountId": tc.source_id,
        "syncSource": "tricount",
    }


if __name__ == "__main__":
    token = os.getenv("TRICOUNT_TOKEN", "").strip()
    if not token:
        print("TRICOUNT_TOKEN missing", file=sys.stderr)
        raise SystemExit(2)

    url = os.getenv("ROADTRIP_FIREBASE_URL", DEFAULT_FIREBASE_URL)
    state, etag = get_state_with_etag(url)
    roadtrip, _ = roadtrip_expenses(state)
    title, tricount, members = tricount_expenses(token)
    result = reconcile(tricount, roadtrip)

    if result["ambiguous"]:
        raise RuntimeError(f"Import aborted: {len(result['ambiguous'])} ambiguous expense(s)")
    if result["roadtrip_only"]:
        raise RuntimeError(f"Import aborted: {len(result['roadtrip_only'])} Roadtrip-only expense(s)")

    missing = result["tricount_only"]
    missing_names = {norm(row["description"]) for row in missing}
    expected_names = set(EXPECTED)
    if missing_names != expected_names or len(missing) != 3:
        raise RuntimeError(
            "Import aborted: live Tricount-only set changed. "
            f"Expected {sorted(expected_names)}, got {sorted(missing_names)}"
        )

    by_source_id = {expense.source_id: expense for expense in tricount}
    missing_expenses = [by_source_id[row["source_id"]] for row in missing]
    for expense in missing_expenses:
        exp = EXPECTED[norm(expense.description)]
        positive = {name: value for name, value in expense.shares.items() if value > 0}
        if expense.amount_cents != exp["amount_cents"] or expense.payer != exp["payer"] or positive != exp["shares"]:
            raise RuntimeError(f"Import aborted: {expense.description} no longer matches the approved Tricount data")

    crew = state.get("crew", [])
    next_name_by_id = {str(member.get("id")): str(member.get("name", "")) for member in crew}
    crew_by_name = {norm(name): cid for cid, name in next_name_by_id.items()}
    crew_order = list(next_name_by_id)

    budget = state.setdefault("budget", {})
    expenses = budget.setdefault("expenses", [])
    existing_tc_ids = {str(e.get("tricountId")) for e in expenses if e.get("tricountId")}
    if existing_tc_ids.intersection({e.source_id for e in missing_expenses}):
        raise RuntimeError("Import aborted: at least one Tricount transaction is already linked in Roadtrip")

    additions = [make_expense(e, crew_by_name, crew_order) for e in missing_expenses]
    expenses.extend(additions)
    state.setdefault("meta", {})["lastSaved"] = iso_after(state.get("meta", {}).get("lastSaved"))

    put_state_if_match(url, state, etag)

    # Verification read: prove the three IDs made it into the live Firebase state.
    verified = fetch_firebase()
    verified_by_tc = {str(e.get("tricountId")): e for e in verified.get("budget", {}).get("expenses", []) if e.get("tricountId")}
    missing_verify = [e.source_id for e in missing_expenses if e.source_id not in verified_by_tc]
    if missing_verify:
        raise RuntimeError(f"Firebase write returned success but verification is missing {missing_verify}")

    print(f"Imported {len(additions)} expenses from Tricount '{title}' into Roadtrip:")
    for item in additions:
        print(f"- {item['desc']} — €{item['amount']:.2f} — payer {next_name_by_id[item['payer']]}")
