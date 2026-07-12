# Camping Contact Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Schlafplatz-Radar the only visible camping contact workflow without losing historical contact data.

**Architecture:** Add an idempotent migration that fills only missing sleep-place fields from legacy contacts, then remove duplicate UI and duplicate writes while retaining the archive and undo compatibility. Verify against an actual Firebase backup before merging.

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, Node.js verification scripts, Firebase JSON state, GitHub Pages.

---

### Task 1: Regression test for legacy-contact migration

**Files:**
- Create: `tools/camping-contact-consolidation.test.mjs`
- Modify: `app.js`

- [x] Add a test fixture with three legacy contacts and matching sleep places.
- [x] Assert missing notes/phones/links are filled without overwriting existing fields.
- [x] Assert the legacy array and its entries remain unchanged.
- [x] Run the test before implementation and confirm that it fails.

### Task 2: Consolidate the app workflow

**Files:**
- Modify: `app.js`
- Modify: `HANDOFF.md`

- [x] Add the idempotent migration helper and invoke it during migration.
- [x] Stop `syncSleepCandidate()` from writing `campContacts`.
- [x] Remove the visible Camping-Kontakte Orga section and update its navigation label.
- [x] Retain archived data and old undo handlers for backward compatibility.
- [x] Run the regression and static-app tests.

### Task 3: Consolidate the cloud runner

**Files:**
- Modify: `cloud-mail/runner.mjs`

- [x] Remove contact-card creation from `syncDerived()`.
- [x] Keep reminder and campsite updates unchanged.
- [x] Run syntax, classifier, signature and disabled-runner checks.

### Task 4: Prove data safety and publish

**Files:**
- Verify: `backups/firebase-pre-v8-2026-07-12T16-22-01-559Z.json`

- [x] Migrate the saved production snapshot in an isolated test context.
- [x] Verify all pre-migration counts remain unchanged and legacy contact details appear in sleep places.
- [x] Verify the mobile UI and browser console.
- [ ] Commit the feature branch, merge into `main`, rerun verification, and push `main`.
