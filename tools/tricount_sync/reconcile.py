#!/usr/bin/env python3
"""Read-only reconciliation between Tricount and the roadtrip Firebase state.

This deliberately performs no writes. It is the safety gate for the later
bidirectional synchronizer: verify credentials, member mapping, split parsing,
and duplicate matching before either ledger can ever be mutated.
"""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
import urllib.request
from dataclasses import asdict, dataclass
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from tricount import load_client

DEFAULT_FIREBASE_URL = (
    "https://roadtrip-to-sizigia-eclipse-default-rtdb.firebaseio.com/"
    "planner/3f58a0fd9c8ef88dc5a5aa36.json"
)
REPORT_PATH = Path(os.getenv("RECONCILE_REPORT", "tricount-reconcile-report.json"))


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    return " ".join(re.findall(r"[a-z0-9]+", text))


def cents(value: Any) -> int:
    return int((Decimal(str(value or 0)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def date_key(value: Any) -> str:
    match = re.search(r"\d{4}-\d{2}-\d{2}", str(value or ""))
    return match.group(0) if match else ""


def amount_abs(value: Any) -> Any:
    if hasattr(value, "as_abs"):
        return value.as_abs
    if hasattr(value, "as_float"):
        return abs(value.as_float)
    if hasattr(value, "value"):
        return abs(Decimal(str(value.value)))
    return abs(Decimal(str(value or 0)))


def largest_remainder_shares(amount_cents: int, people: list[str], weights: dict[str, Any]) -> dict[str, int]:
    if not people:
        return {}
    ws = [max(Decimal("0.000001"), Decimal(str(weights.get(pid, 1)))) for pid in people]
    total = sum(ws, Decimal(0))
    rows: list[dict[str, Any]] = []
    for index, (pid, weight) in enumerate(zip(people, ws)):
        raw = Decimal(amount_cents) * weight / total
        floor = int(raw.to_integral_value(rounding=ROUND_FLOOR))
        rows.append({"id": pid, "index": index, "cents": floor, "remainder": raw - floor})
    left = amount_cents - sum(row["cents"] for row in rows)
    for row in sorted(rows, key=lambda r: (-r["remainder"], r["index"]))[:left]:
        row["cents"] += 1
    return {row["id"]: row["cents"] for row in rows}


@dataclass
class Expense:
    source: str
    source_id: str
    description: str
    amount_cents: int
    payer: str
    date: str
    shares: dict[str, int]

    def public(self) -> dict[str, Any]:
        return asdict(self)


def fetch_firebase() -> dict[str, Any]:
    url = os.getenv("ROADTRIP_FIREBASE_URL", DEFAULT_FIREBASE_URL)
    req = urllib.request.Request(url, headers={"Accept": "application/json", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=20) as response:
        data = json.load(response)
    if not isinstance(data, dict) or not isinstance(data.get("crew"), list):
        raise RuntimeError("Roadtrip Firebase returned an unexpected state shape")
    return data


def roadtrip_expenses(state: dict[str, Any]) -> tuple[list[Expense], dict[str, str]]:
    crew = {str(member.get("id")): str(member.get("name", "")) for member in state.get("crew", [])}
    normalized_crew = {norm(name): cid for cid, name in crew.items()}
    out: list[Expense] = []
    for raw in state.get("budget", {}).get("expenses", []) or []:
        amount_cents = cents(raw.get("amount", 0))
        sharers = [str(pid) for pid in (raw.get("sharers") or []) if str(pid) in crew]
        by_id = largest_remainder_shares(amount_cents, sharers, raw.get("weights") or {})
        out.append(
            Expense(
                source="roadtrip",
                source_id=str(raw.get("id", "")),
                description=str(raw.get("desc") or raw.get("description") or ""),
                amount_cents=amount_cents,
                payer=norm(crew.get(str(raw.get("payer")), raw.get("payer"))),
                date=date_key(raw.get("date")),
                shares={norm(crew[pid]): value for pid, value in by_id.items()},
            )
        )
    return out, normalized_crew


def tricount_expenses(token: str) -> tuple[str, list[Expense], list[str]]:
    # get_tricount() is explicitly read-only in tricount-api. We intentionally do
    # not call join_tricount() here, so this verification cannot change membership.
    client = load_client()
    tricount = client.get_tricount(token)
    member_names = {str(member.uuid): str(member.display_name) for member in tricount.members}
    out: list[Expense] = []
    for tx in tricount.transactions:
        tx_type = getattr(getattr(tx, "transaction_type", None), "value", str(getattr(tx, "transaction_type", "")))
        tx_status = getattr(getattr(tx, "status", None), "value", str(getattr(tx, "status", "")))
        if tx_type != "NORMAL" or tx_status not in {"ACTIVE", "SETTLED"}:
            continue
        shares: dict[str, int] = {}
        for allocation in tx.allocations:
            name = norm(member_names.get(str(allocation.membership_uuid), allocation.membership_uuid))
            shares[name] = cents(amount_abs(allocation.amount))
        out.append(
            Expense(
                source="tricount",
                source_id=str(tx.uuid or tx.id or ""),
                description=str(tx.description or ""),
                amount_cents=cents(amount_abs(tx.amount)),
                payer=norm(member_names.get(str(tx.membership_uuid_owner), tx.membership_uuid_owner)),
                date=date_key(tx.date),
                shares=shares,
            )
        )
    return str(tricount.title), out, [str(member.display_name) for member in tricount.members]


def score(a: Expense, b: Expense) -> int:
    if a.amount_cents != b.amount_cents:
        return -1
    result = 0
    if a.payer and a.payer == b.payer:
        result += 35
    if a.date and b.date and a.date == b.date:
        result += 15
    ad, bd = norm(a.description), norm(b.description)
    if ad and ad == bd:
        result += 25
    elif ad and bd:
        result += round(25 * SequenceMatcher(None, ad, bd).ratio())
    if a.shares and a.shares == b.shares:
        result += 30
    elif set(a.shares) == set(b.shares):
        result += 10
    return result


def reconcile(tricount: list[Expense], roadtrip: list[Expense]) -> dict[str, Any]:
    unused = set(range(len(roadtrip)))
    matched: list[dict[str, Any]] = []
    ambiguous: list[dict[str, Any]] = []
    tricount_only: list[dict[str, Any]] = []

    for tc in tricount:
        candidates = sorted(((score(tc, roadtrip[i]), i) for i in unused), reverse=True)
        candidates = [(s, i) for s, i in candidates if s >= 0]
        if not candidates:
            tricount_only.append(tc.public())
            continue
        best_score, best_idx = candidates[0]
        second_score = candidates[1][0] if len(candidates) > 1 else -1
        if best_score >= 90 and best_score - second_score >= 10:
            rt = roadtrip[best_idx]
            unused.remove(best_idx)
            matched.append({"score": best_score, "tricount": tc.public(), "roadtrip": rt.public()})
        elif best_score >= 55:
            ambiguous.append(
                {
                    "tricount": tc.public(),
                    "candidates": [
                        {"score": s, "roadtrip": roadtrip[i].public()} for s, i in candidates[:3]
                    ],
                }
            )
        else:
            tricount_only.append(tc.public())

    roadtrip_only = [roadtrip[i].public() for i in sorted(unused)]
    return {
        "matched": matched,
        "ambiguous": ambiguous,
        "tricount_only": tricount_only,
        "roadtrip_only": roadtrip_only,
    }


def euro(c: int) -> str:
    return f"€{c / 100:.2f}"


def write_summary(title: str, members: list[str], result: dict[str, Any], warnings: list[str]) -> None:
    lines = [
        "# Tricount ↔ Roadtrip read-only reconciliation",
        "",
        f"Tricount: **{title}**",
        f"Members: {', '.join(members)}",
        "",
        f"- Matched confidently: **{len(result['matched'])}**",
        f"- Needs review: **{len(result['ambiguous'])}**",
        f"- Only in Tricount: **{len(result['tricount_only'])}**",
        f"- Only in Roadtrip: **{len(result['roadtrip_only'])}**",
    ]
    if warnings:
        lines += ["", "## Mapping warnings"] + [f"- {w}" for w in warnings]
    if result["ambiguous"]:
        lines += ["", "## Needs review"]
        for row in result["ambiguous"]:
            tc = row["tricount"]
            candidate = row["candidates"][0]
            rt = candidate["roadtrip"]
            lines.append(
                f"- {tc['description']} {euro(tc['amount_cents'])}: Tricount payer `{tc['payer']}` vs "
                f"Roadtrip candidate `{rt['description']}` payer `{rt['payer']}` (score {candidate['score']})"
            )
    if result["tricount_only"]:
        lines += ["", "## Only in Tricount"]
        lines += [f"- {e['description']} — {euro(e['amount_cents'])} — payer `{e['payer']}`" for e in result["tricount_only"]]
    if result["roadtrip_only"]:
        lines += ["", "## Only in Roadtrip"]
        lines += [f"- {e['description']} — {euro(e['amount_cents'])} — payer `{e['payer']}`" for e in result["roadtrip_only"]]
    text = "\n".join(lines) + "\n"
    print(text)
    summary_path = os.getenv("GITHUB_STEP_SUMMARY")
    if summary_path:
        Path(summary_path).write_text(text, encoding="utf-8")


def main() -> int:
    token = os.getenv("TRICOUNT_TOKEN", "").strip()
    if not token:
        print("TRICOUNT_TOKEN is missing", file=sys.stderr)
        return 2

    state = fetch_firebase()
    roadtrip, roadtrip_names = roadtrip_expenses(state)
    title, tricount, members = tricount_expenses(token)

    warnings = []
    for name in members:
        if norm(name) not in roadtrip_names:
            warnings.append(f"Tricount member `{name}` has no exact Roadtrip crew-name match")

    result = reconcile(tricount, roadtrip)
    report = {
        "mode": "READ_ONLY",
        "tricount_title": title,
        "tricount_members": members,
        "counts": {
            "tricount": len(tricount),
            "roadtrip": len(roadtrip),
            "matched": len(result["matched"]),
            "ambiguous": len(result["ambiguous"]),
            "tricount_only": len(result["tricount_only"]),
            "roadtrip_only": len(result["roadtrip_only"]),
        },
        "mapping_warnings": warnings,
        **result,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    write_summary(title, members, result, warnings)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
