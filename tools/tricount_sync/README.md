# Tricount ↔ Roadtrip reconciliation

This directory contains the safety-gate implementation for the planned bidirectional expense sync.

## Current mode

**Read-only.** `reconcile.py` reads the Tricount share-token endpoint and the Roadtrip Firebase state, then generates a reconciliation report. It does not join the Tricount, modify members, create/edit/delete transactions, or write to Firebase.

## Matching policy

Expenses require an exact amount match and a high-confidence combination of payer, date, description, and per-person shares before they are treated as the same transaction. Lower-confidence candidates are surfaced for review rather than guessed.

## Configuration

- `TRICOUNT_TOKEN` — required GitHub Actions repository secret.
- `ROADTRIP_FIREBASE_URL` — optional override; defaults to the Firebase URL already used by the app.
- `RECONCILE_REPORT` — optional output path.

Automatic writes and recurring scheduling must only be enabled after a successful read-only run has verified the token, member mapping, and existing ledger reconciliation.
