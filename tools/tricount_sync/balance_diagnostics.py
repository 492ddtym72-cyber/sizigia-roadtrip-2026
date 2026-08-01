#!/usr/bin/env python3
"""Read-only live balance diagnostics for the Roadtrip expense ledger."""
from __future__ import annotations

import json
import urllib.request

from reconcile import DEFAULT_FIREBASE_URL, norm, roadtrip_expenses


def fetch_state():
    req = urllib.request.Request(DEFAULT_FIREBASE_URL, headers={"Accept":"application/json","Cache-Control":"no-cache"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)


def main():
    state = fetch_state()
    expenses, _ = roadtrip_expenses(state)
    people = [norm(m.get("name")) for m in state.get("crew", [])]
    balances = {p: 0 for p in people}
    rows = []
    for e in expenses:
        paid = e.amount_cents if e.payer == "max" else 0
        share = e.shares.get("max", 0)
        for p in balances:
            if e.payer == p:
                balances[p] += e.amount_cents
            balances[p] -= e.shares.get(p, 0)
        if paid or share:
            rows.append({
                "description": e.description,
                "amount": e.amount_cents / 100,
                "payer": e.payer,
                "maxPaid": paid / 100,
                "maxShare": share / 100,
                "maxNetEffect": (paid - share) / 100,
                "date": e.date,
            })

    debtors = [[p, -v] for p, v in balances.items() if v < 0]
    creditors = [[p, v] for p, v in balances.items() if v > 0]
    debtors.sort(key=lambda x: (-x[1], x[0]))
    creditors.sort(key=lambda x: (-x[1], x[0]))
    settlements = []
    di = ci = 0
    while di < len(debtors) and ci < len(creditors):
        debtor, owed = debtors[di]
        creditor, due = creditors[ci]
        amount = min(owed, due)
        if amount:
            settlements.append({"from": debtor, "to": creditor, "amount": amount / 100})
        debtors[di][1] -= amount
        creditors[ci][1] -= amount
        if debtors[di][1] == 0: di += 1
        if creditors[ci][1] == 0: ci += 1

    report = {
        "maxBalance": balances.get("max", 0) / 100,
        "maxTotalPaid": sum(r["maxPaid"] for r in rows),
        "maxTotalShare": sum(r["maxShare"] for r in rows),
        "maxExpenseBreakdown": rows,
        "allBalances": {p: v / 100 for p, v in balances.items()},
        "onePossibleSettlement": settlements,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
