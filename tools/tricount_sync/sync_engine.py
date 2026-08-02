#!/usr/bin/env python3
"""Conservative bidirectional Tricount <-> Roadtrip expense synchronization.

Automatic behavior is additions-only. Once two entries are linked, the sync
stores a fingerprint for each side independently. Future edits/deletions are
therefore detected relative to the accepted baseline even when legacy entries
have harmless wording/date differences between Tricount and Roadtrip.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from tricount import load_client

from reconcile import (
    DEFAULT_FIREBASE_URL,
    Expense,
    norm,
    reconcile,
    roadtrip_expenses,
    tricount_expenses,
)

REPORT_PATH = Path(os.getenv("SYNC_REPORT", "tricount-sync-report.json"))
CREDENTIALS_PATH = os.getenv("TRICOUNT_CREDENTIALS_PATH", "tricount_credentials.json")


class ReviewRequired(Exception):
    def __init__(self, result: dict[str, Any], conflicts: list[dict[str, Any]] | None = None):
        super().__init__("Expense sync requires human review")
        self.result = result
        self.conflicts = conflicts or []


def get_state_with_etag(url: str) -> tuple[dict[str, Any], str]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "X-Firebase-ETag": "true",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        state = json.load(response)
        etag = response.headers.get("ETag")
    if not isinstance(state, dict) or not etag:
        raise RuntimeError("Firebase did not return a valid state and ETag")
    return state, etag


def put_state_if_match(url: str, state: dict[str, Any], etag: str) -> None:
    payload = json.dumps(state, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        method="PUT",
        headers={"Content-Type": "application/json", "If-Match": etag},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if not 200 <= response.status < 300:
                raise RuntimeError(f"Firebase PUT returned HTTP {response.status}")
    except urllib.error.HTTPError as exc:
        if exc.code == 412:
            raise RuntimeError("Firebase changed concurrently; sync stopped without overwriting it") from exc
        raise


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def nonzero_shares(expense: Expense) -> dict[str, int]:
    return {name: value for name, value in expense.shares.items() if value != 0}


def fingerprint(expense: Expense) -> dict[str, Any]:
    return {
        "description": norm(expense.description),
        "amountCents": expense.amount_cents,
        "payer": expense.payer,
        "date": expense.date,
        "sharesCents": dict(sorted(nonzero_shares(expense).items())),
    }


def expense_summary(expense: Expense) -> dict[str, Any]:
    return {
        "id": expense.source_id,
        "description": expense.description,
        "amount": expense.amount_cents / 100,
        "payer": expense.payer,
        "date": expense.date,
        "shares": {name: value / 100 for name, value in nonzero_shares(expense).items()},
    }


def sync_links(state: dict[str, Any]) -> dict[str, dict[str, Any]]:
    budget = state.setdefault("budget", {})
    links = budget.setdefault("syncLinks", {})
    if not isinstance(links, dict):
        links = {}
        budget["syncLinks"] = links
    return links


def linked_conflicts(
    state: dict[str, Any], tricount: list[Expense], roadtrip: list[Expense]
) -> list[dict[str, Any]]:
    """Detect edits/deletions of entries that were previously accepted as linked."""
    links = sync_links(state)
    tc_by_id = {item.source_id: item for item in tricount}
    rt_by_id = {item.source_id: item for item in roadtrip}
    conflicts: list[dict[str, Any]] = []

    for roadtrip_id, link in links.items():
        tc_ids = [str(value) for value in (link.get("tricountIds") or []) if value]
        if not tc_ids:
            continue
        rt = rt_by_id.get(roadtrip_id)
        tcs = [tc_by_id[value] for value in tc_ids if value in tc_by_id]

        if rt is None and tcs:
            conflicts.append({
                "type": "possible-roadtrip-deletion",
                "roadtripId": roadtrip_id,
                "tricountIds": tc_ids,
                "message": "A previously linked expense disappeared from Roadtrip but still exists in Tricount.",
            })
            continue
        if rt is not None and not tcs:
            conflicts.append({
                "type": "possible-tricount-deletion",
                "roadtrip": expense_summary(rt),
                "tricountIds": tc_ids,
                "message": "A previously linked expense disappeared from Tricount but still exists in Roadtrip.",
            })
            continue
        if rt is None and not tcs:
            continue
        if len(tcs) != len(tc_ids):
            conflicts.append({
                "type": "partial-linked-transaction-loss",
                "roadtrip": expense_summary(rt) if rt else None,
                "tricountIds": tc_ids,
                "message": "Only part of a previously linked Tricount representation still exists.",
            })
            continue

        # Older links created while bootstrapping may not yet have fingerprints.
        # Accept their current state once, then seed the baseline on the clean run.
        rt_baseline = link.get("roadtripFingerprint")
        tc_baselines = link.get("tricountFingerprints")
        if not rt_baseline or not isinstance(tc_baselines, dict):
            continue

        if fingerprint(rt) != rt_baseline:
            conflicts.append({
                "type": "possible-roadtrip-edit",
                "roadtrip": expense_summary(rt),
                "message": "A linked Roadtrip expense changed since its accepted sync baseline.",
            })
        for tc in tcs:
            baseline = tc_baselines.get(tc.source_id)
            if baseline is None or fingerprint(tc) != baseline:
                conflicts.append({
                    "type": "possible-tricount-edit",
                    "tricount": expense_summary(tc),
                    "roadtripId": roadtrip_id,
                    "message": "A linked Tricount expense changed since its accepted sync baseline.",
                })
    return conflicts


def near_new_conflicts(result: dict[str, Any]) -> list[dict[str, Any]]:
    """Catch likely same new expense entered differently in both apps."""
    conflicts: list[dict[str, Any]] = []
    for tc_raw in result.get("tricount_only", []):
        tc = Expense(**tc_raw)
        for rt_raw in result.get("roadtrip_only", []):
            rt = Expense(**rt_raw)
            similarity = SequenceMatcher(None, norm(tc.description), norm(rt.description)).ratio()
            same_context = (
                tc.payer == rt.payer
                and (not tc.date or not rt.date or tc.date == rt.date)
                and similarity >= 0.70
            )
            if same_context:
                conflicts.append({
                    "type": "possible-double-entry-or-edit",
                    "tricount": expense_summary(tc),
                    "roadtrip": expense_summary(rt),
                    "message": "Similar one-sided entries exist in both ledgers; copying both could create a duplicate.",
                })
    return conflicts


def seed_links(state: dict[str, Any], result: dict[str, Any]) -> bool:
    links = sync_links(state)
    changed = False
    now = iso_now()

    for row in result.get("matched", []):
        rt = Expense(**row["roadtrip"])
        tc = Expense(**row["tricount"])
        existing = links.get(rt.source_id, {})
        desired = {
            "tricountIds": [tc.source_id],
            "linkedAt": existing.get("linkedAt", now),
            "roadtripFingerprint": fingerprint(rt),
            "tricountFingerprints": {tc.source_id: fingerprint(tc)},
        }
        if existing != desired:
            links[rt.source_id] = desired
            changed = True

    for row in result.get("compound_matched", []):
        rt = Expense(**row["roadtrip"])
        tcs = [Expense(**item) for item in row["tricount"]]
        tcs.sort(key=lambda item: item.source_id)
        existing = links.get(rt.source_id, {})
        desired = {
            "tricountIds": [item.source_id for item in tcs],
            "linkedAt": existing.get("linkedAt", now),
            "roadtripFingerprint": fingerprint(rt),
            "tricountFingerprints": {item.source_id: fingerprint(item) for item in tcs},
        }
        if existing != desired:
            links[rt.source_id] = desired
            changed = True
    return changed


def crew_maps(state: dict[str, Any]) -> tuple[dict[str, str], dict[str, str], list[str]]:
    by_id = {str(member.get("id")): str(member.get("name", "")) for member in state.get("crew", [])}
    by_name = {norm(name): cid for cid, name in by_id.items()}
    return by_id, by_name, list(by_id)


def tricount_to_roadtrip(tc: Expense, state: dict[str, Any]) -> dict[str, Any]:
    by_id, by_name, crew_order = crew_maps(state)
    payer_id = by_name.get(tc.payer)
    if not payer_id:
        raise RuntimeError(f"No Roadtrip member mapping for Tricount payer {tc.payer!r}")

    positive = nonzero_shares(tc)
    if not positive or sum(positive.values()) != tc.amount_cents:
        raise RuntimeError(
            f"Tricount allocations for {tc.description!r} do not sum exactly to the total; review required"
        )
    missing = sorted(name for name in positive if name not in by_name)
    if missing:
        raise RuntimeError(f"No Roadtrip member mapping for {', '.join(missing)}")

    sharers = [cid for cid in crew_order if norm(by_id[cid]) in positive]
    values = [positive[norm(by_id[cid])] for cid in sharers]
    item: dict[str, Any] = {
        "id": "x-tc-" + tc.source_id.replace("-", "")[:18],
        "date": tc.date,
        "desc": tc.description,
        "amount": tc.amount_cents / 100,
        "payer": payer_id,
        "sharers": sharers,
        "tricountId": tc.source_id,
        "syncSource": "tricount",
    }
    # Equal splits naturally differ by at most one cent when the total cannot be
    # divided evenly. That remainder is not a custom weight and must not become
    # a misleading 2394x/2393x factor in Roadtrip. Genuine unequal allocations
    # keep their cent ratios so the browser can reproduce the exact shares.
    if values and max(values) - min(values) > 1:
        item["weights"] = {cid: positive[norm(by_id[cid])] for cid in sharers}
    return item


def validate_snapshot(state: dict[str, Any], tricount: list[Expense], roadtrip: list[Expense],
                      result: dict[str, Any]) -> None:
    conflicts = linked_conflicts(state, tricount, roadtrip) + near_new_conflicts(result)
    if result.get("ambiguous") or conflicts:
        raise ReviewRequired(result, conflicts)


def import_tricount_only(url: str, token: str, actions: list[dict[str, Any]]) -> None:
    state, etag = get_state_with_etag(url)
    roadtrip, _ = roadtrip_expenses(state)
    _, tricount, _ = tricount_expenses(token)
    result = reconcile(tricount, roadtrip)
    validate_snapshot(state, tricount, roadtrip, result)
    if not result["tricount_only"]:
        return

    tc_by_id = {item.source_id: item for item in tricount}
    additions = [tricount_to_roadtrip(tc_by_id[row["source_id"]], state) for row in result["tricount_only"]]
    state.setdefault("budget", {}).setdefault("expenses", []).extend(additions)
    state.setdefault("meta", {})["lastSaved"] = iso_now()
    put_state_if_match(url, state, etag)
    for item in additions:
        actions.append({"direction": "tricount-to-roadtrip", "description": item["desc"], "amount": item["amount"]})


def parse_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None


def export_roadtrip_only(url: str, token: str, actions: list[dict[str, Any]]) -> None:
    state, _ = get_state_with_etag(url)
    roadtrip, _ = roadtrip_expenses(state)
    _, tricount_read, _ = tricount_expenses(token)
    result = reconcile(tricount_read, roadtrip)
    validate_snapshot(state, tricount_read, roadtrip, result)
    if not result["roadtrip_only"]:
        return

    client = load_client(CREDENTIALS_PATH)
    tricount_write = client.join_tricount(token)
    tc_members = {norm(member.display_name): member for member in tricount_write.members}
    roadtrip_by_id = {item.source_id: item for item in roadtrip}

    for row in list(result["roadtrip_only"]):
        rt = roadtrip_by_id[row["source_id"]]

        # Re-read before each create to avoid racing a human who just added the
        # same entry in Tricount after our initial snapshot.
        _, fresh_tc, _ = tricount_expenses(token)
        fresh_result = reconcile(fresh_tc, roadtrip)
        validate_snapshot(state, fresh_tc, roadtrip, fresh_result)
        still_missing = {item["source_id"] for item in fresh_result["roadtrip_only"]}
        if rt.source_id not in still_missing:
            continue

        payer = tc_members.get(rt.payer)
        if payer is None:
            raise RuntimeError(f"No Tricount member mapping for Roadtrip payer {rt.payer!r}")
        positive = nonzero_shares(rt)
        if not positive or sum(positive.values()) != rt.amount_cents:
            raise RuntimeError(f"Roadtrip shares for {rt.description!r} do not sum exactly to the total")

        allocations = []
        for name, share_cents in positive.items():
            member = tc_members.get(name)
            if member is None:
                raise RuntimeError(f"No Tricount member mapping for Roadtrip sharer {name!r}")
            allocations.append((member, share_cents / 100))

        client.create_transaction_custom_split(
            tricount=tricount_write,
            description=rt.description,
            amount=rt.amount_cents / 100,
            payer=payer,
            allocations=allocations,
            date=parse_date(rt.date),
        )
        actions.append({"direction": "roadtrip-to-tricount", "description": rt.description, "amount": rt.amount_cents / 100})


def persist_links(url: str, token: str) -> dict[str, Any]:
    state, etag = get_state_with_etag(url)
    roadtrip, _ = roadtrip_expenses(state)
    _, tricount, _ = tricount_expenses(token)
    result = reconcile(tricount, roadtrip)
    validate_snapshot(state, tricount, roadtrip, result)
    if result["tricount_only"] or result["roadtrip_only"]:
        raise ReviewRequired(result, near_new_conflicts(result))
    if seed_links(state, result):
        state.setdefault("meta", {})["lastSaved"] = iso_now()
        put_state_if_match(url, state, etag)
    return result


def make_report(status: str, actions: list[dict[str, Any]], result: dict[str, Any] | None = None,
                conflicts: list[dict[str, Any]] | None = None, error: str | None = None) -> dict[str, Any]:
    report: dict[str, Any] = {
        "status": status,
        "mode": "BIDIRECTIONAL_ADDITIONS_ONLY",
        "timestamp": iso_now(),
        "actions": actions,
    }
    if result is not None:
        report["counts"] = {
            "matched": len(result.get("matched", [])),
            "compoundMatched": len(result.get("compound_matched", [])),
            "ambiguous": len(result.get("ambiguous", [])),
            "tricountOnly": len(result.get("tricount_only", [])),
            "roadtripOnly": len(result.get("roadtrip_only", [])),
        }
        report["ambiguous"] = result.get("ambiguous", [])
        report["tricountOnly"] = result.get("tricount_only", [])
        report["roadtripOnly"] = result.get("roadtrip_only", [])
    if conflicts:
        report["conflicts"] = conflicts
    if error:
        report["error"] = error
    return report


def save_report(report: dict[str, Any]) -> None:
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


def main() -> int:
    token = os.getenv("TRICOUNT_TOKEN", "").strip()
    if not token:
        save_report(make_report("error", [], error="TRICOUNT_TOKEN is missing"))
        return 2
    url = os.getenv("ROADTRIP_FIREBASE_URL", DEFAULT_FIREBASE_URL)
    actions: list[dict[str, Any]] = []

    try:
        state, _ = get_state_with_etag(url)
        roadtrip, _ = roadtrip_expenses(state)
        _, tricount, _ = tricount_expenses(token)
        initial = reconcile(tricount, roadtrip)
        validate_snapshot(state, tricount, roadtrip, initial)

        import_tricount_only(url, token, actions)
        export_roadtrip_only(url, token, actions)
        final = persist_links(url, token)
        save_report(make_report("changed" if actions else "clean", actions, final))
        return 0
    except ReviewRequired as exc:
        save_report(make_report("review", actions, exc.result, exc.conflicts))
        return 0
    except Exception as exc:
        save_report(make_report("error", actions, error=f"{type(exc).__name__}: {exc}"))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
