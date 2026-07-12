# Camping workflow reliability audit

Audited: `main` @ `ac6d20e` (12.07.2026) · Scope: Schlafplätze/Camping workflow (`app.js`), Apple-Mail assistant (`tools/camping-mail-*.mjs`, `cloud-mail/runner.mjs`), sync/persistence, service worker. Read-only audit — no application code, Firebase data, or mailbox was touched. Verification combined code reading, the repository's own test suite, and temporary (uncommitted) probes: direct invocation of the classifier/matcher functions and a headless-Chromium session driving the real app from `file://` at 375 px width.

## Executive summary

**Classification: Safe with limitations.**

The *manual* workflow — preview → "In Apple Mail öffnen" → "Als gesendet markieren" → manual review queue — is implemented safely and was verified end-to-end: previews are stateless, send intents never change a campsite's operational status, "Bestätigt" is unreachable without all four explicit confirmations, and the two campsites without a verified e-mail address (Camping La Chapelle, Camping Ribera del Ara) offer no e-mail action.

The *automatic* classification path is not yet trustworthy for this trip's correspondence: the classifier knows no French or Spanish (11 of 13 verified route contacts are French/Spanish), does not strip French/Outlook-style quoted history — which can flip a **full** campsite to "available" using the text of our own quoted inquiry (Finding 1, High) — and accepts sender-independent name-only matches. Until Findings 1–3 are fixed, keep `MAIL_RUNNER_MODE` unset (it is today) and treat every automatic status change with suspicion; the manual review queue and the app UI remain safe to use as-is.

## Confirmed strengths

- **Preview is stateless.** `prepareSleepReply()` (`app.js:2953`) only renders into the modal; no `save()`, no `logChange()`, no state mutation. Verified empirically: full `sleepSearches` + `draftRequests` JSON identical before/after opening and closing a preview ("Schließen" → `closeModal()`, `app.js:1468`).
- **Send intent does not advance status.** `openSleepMail()` (`app.js:2954`) only appends a `draftRequest` (recording `previousStatus`) and opens `mailto:`; candidate status verified unchanged (`new` → `new`). Duplicate requests for the same candidate+template are deduplicated (verified: second call adds 0 requests).
- **Only two paths advance the business status:** manual "Als gesendet markieren" (`markSleepDraftSent`, `app.js:2955`) and Sent-mail detection (`runner.mjs:41`, guarded by `req.status==='ready'`, so a request advances exactly once). Verified: `markSleepDraftSent` on a `network_policy` request → status `awaiting`, request `sent_manual`.
- **"Bestätigt" is guarded.** `applyCandidateValues()` (`app.js:2929`) demotes `booked` to `reserving` unless all four confirmations (Datum, Gruppe, Camper, Auto) are checked — verified with 3 of 4 checked. A `booked` classification from mail never lands directly: the cloud runner routes it to the review queue (`runner.mjs:45`), and resolving a review as "booked" sets `reserving` with a check prompt (`resolveMailReview`, `app.js:2987`).
- **Contact safety for unverified addresses.** Seeds carry `email:''` for Camping La Chapelle and Camping Ribera del Ara (`app.js:277`, `app.js:286`); both are outside `CAMPING_NETWORK_VERIFIED` (`app.js:288`); the card renders the e-mail button only for `c.email && c.contactVerified!==false` (`app.js:2959`). Verified in the running app: neither card contains a `prepareSleepReply` button. `contactVerified:false` shows a disabled "Kontakt prüfen" placeholder instead.
- **Empty e-mail never merges records.** `seedCampingSafetyNetwork()` matches places by e-mail only when the seed e-mail is non-empty (`norm(seed.email)&&…`, `app.js:360`).
- **Context-sensitive, distinct, unsigned drafts.** All 8 template modes verified pairwise distinct; every one ends exactly with `Kind regards,\n\n`; no sender name/group name anywhere (`sleepEmailText`, `app.js:2937-2948`; mirrored in `tools/camping-mail-templates.mjs`, self-tested by `camping-mail-bridge.mjs self-test`). "6 adults travelling with one camper and one small car" and the exact trip dates are derived from `state.crew`/search dates (verified in rendered preview). The reserve template does not repeat the availability inquiry (self-test + probe). A `call`-status campsite gets the `call` template — `sleepActionMode()` (`app.js:2952`) never returns `reserve` for it. Missing camper length blocks the `dimensions` draft with a toast (verified; `app.js:2943`, `app.js:2953`; the tools variant throws, `camping-mail-templates.mjs:9`).
- **Migration idempotency and link survival.** Hub seeding is keyed (`networkKey`, `app.js:354`; `meta.campingNetworkSeeded`, `app.js:509`), the reply batch is versioned (`meta.campingReplyBatch`, `app.js:405`), V10 runs only for `fromVersion<10` (`app.js:510`) and preserves existing `placeId` links; a contacted "Camping Río Ara" record would be locked (`contactVerified=false`) instead of renamed (`app.js:385-389`). Covered by `tools/camping-network-v9.test.mjs` (re-seeding duplicates nothing; Mare Monti coordinates corrected; Río Ara no longer seeded).
- **Candidate/place separation.** Per-candidate data (status, reply, dates, prices, history) is not in `SLEEP_PLACE_KEYS` (`app.js:299`), so shared-place updates cannot erase candidate state; the card view overlays place contact data over candidates (`sleepCandidateView`, `app.js:2885`).
- **Mailbox is never modified.** The runner opens mailboxes with `readOnly:true` locks (`runner.mjs:30-31`), fetches only, and its single write operation is `client.append(draftsPath, …, ['\\Draft'])` (`runner.mjs:35`) — an unsent draft. No send, delete, move, or flag calls exist anywhere in the codebase. The runner is fully disabled without `MAIL_RUNNER_MODE` (verified: `{"ok":true,"disabled":true}`); no iCloud secrets are configured.
- **Ambiguity fails closed (within its language coverage).** `matchCandidate` returns `null` on ties or score < 30 (`camping-mail-core.mjs:74`); unclassifiable replies become `review` and enter the pending review queue (`runner.mjs:45`, UI `app.js:2988`), deduplicated by message fingerprint.
- **Firebase quirks are handled.** Empty containers are restored on load (`app.js:453-455`, `app.js:511-514`); `save()` produces monotonically increasing timestamps (`app.js:619-622`), as do bridge (`nextStamp`) and runner (`stamp`); bridge and runner both write conditionally with ETag `if-match` and retry on 412 (`camping-mail-bridge.mjs:17-25`, `runner.mjs:18`). A fresh device (`_virgin`) always adopts the cloud state on first sync (`app.js:744-749`). Backup import and snapshot restore are strictly local-only with sync paused (`openBackupLocal`, `app.js:571-581`; `syncNow` guard `app.js:736`).
- **Mobile & offline.** At 375 px the Schlafplätze tab renders with no horizontal overflow and no console errors (headless-Chromium probe over `file://`); map zoom buttons work via touch tap (zoom 2.3 → 4.6), pan/pinch use pointer events (`app.js:1157-1216`). The service worker is network-first with cache fallback and versioned cache cleanup (`sw.js`), never touches foreign origins (Firebase), registers only under `https:` (`app.js:3761-3763`), so `file://` stays untouched — `tools/sw.test.mjs` covers install/activate/navigation-fallback.

## Findings

### 1. High — Quoted history in foreign-language replies can flip a full campsite to "available"

- **File:** `tools/camping-mail-core.mjs:20` (`quoteStart` in `newestReply`), `:8` (`RX.available`), `:45-57` (`classifyReply`)
- **Reproduction:** `classifyReply('Non, désolé.\n\nLe 12 juil. 2026 à 10:00, Freddi a écrit :\nI would like to ask if you have availability from 2 to 3 August.')` → `{status:'available', confidence:'high'}` (verified by direct invocation). `quoteStart` only recognizes English (`On … wrote:`), German (`Am … schrieb …:`) and `>`-prefixed quoting. French (`Le … a écrit :`), Spanish (`El … escribió:`), Italian (`Il … ha scritto:`) and Outlook separators (`De :` / `-----Message d'origine-----`) pass through, and our own inquiry sentence ("…have availability…") matches `RX.available`.
- **Expected:** Only the newest reply above quoted history may affect classification; unmatchable content → `review`.
- **Actual:** The quoted copy of *our own draft* classifies the reply, with high confidence; `replyQuote` then quotes our own English sentence back as the campsite's answer.
- **Trip impact:** The crew could drive to a campsite marked "Verfügbar" that actually answered "complet".
- **Smallest safe remediation:** Extend `quoteStart` with the FR/ES/IT reply headers and Outlook separators, and additionally drop any sentence that literally matches one of our own template phrases before applying `RX`.
- **Existing data:** Possible if the local Mac automation already ran `classifyReply` over French replies. Check candidates whose `replyQuote` is in English wording identical to our templates.

### 2. Medium — Classifier has no French or Spanish vocabulary; most route campsites answer in those languages

- **File:** `tools/camping-mail-core.mjs:3-11` (`RX` covers EN/DE/IT only)
- **Reproduction:** `classifyReply('Nous sommes complets pour cette période.')` → `review`; same for `appeler`, `completo`, `llamar` variants (all verified).
- **Expected:** Replies from the 9 French and 2 Spanish verified contacts get classified, or the limitation is documented.
- **Actual:** They fail closed into the manual review queue — safe, but the assistant then automates almost nothing on this route, and the queue holds max 50 entries (`runner.mjs:49`).
- **Trip impact:** Manual review load during travel days; useful replies ("vous pouvez appeler le jour même") don't surface as "Spontan anrufen".
- **Smallest safe remediation:** Add FR/ES patterns to `RX` (complet/complets, disponible/disponibilité, acompte/arrhes, appeler/rappeler, sans réservation; completo, disponible, señal/paga y señal, llamar, sin reserva) together with matching tests.
- **Existing data:** No corruption — only under-classification.

### 3. Medium — A name-only subject match from any sender is accepted

- **File:** `tools/camping-mail-core.mjs:63-76` (`matchCandidate`; name substring scores 30, threshold rejects only `<30`)
- **Reproduction:** `matchCandidate({from:'noreply@newsletter-portal.example', subject:'Deals near Camping Mare Monti this summer'}, candidates)` → matches Camping Mare Monti (verified).
- **Expected:** Mails without any sender evidence (address or domain) fail closed.
- **Actual:** Any inbox mail whose subject mentions a campsite name is matched, classified, and (in cloud/local apply paths) writes status/reply onto that candidate.
- **Trip impact:** A booking-portal newsletter can overwrite a real reply's status hours before arrival.
- **Smallest safe remediation:** Require a sender component in the score (exact address or non-freemail domain match), or send name-only matches to the review queue.
- **Existing data:** Possible but unlikely (dedicated mailbox); inspect `state.log` for implausible "Mail-Assistent" entries.

### 4. Medium — The app's cloud writes are unconditional; assistant updates can be silently overwritten

- **File:** `app.js:707-711` (`cloudPut` has no `if-match`), `app.js:735-767` (`syncNow` GET→compare→PUT window)
- **Reproduction:** Device A edits offline (monotonic timestamp now newest). Bridge/runner applies a reply classification with a conditional write. A comes online: `lT > rT` → plain PUT replaces the whole state — the assistant's update is gone without trace (its ETag protection only defends against other conditional writers). The same whole-state last-write-wins applies between two devices; only the losing device keeps a local snapshot (`app.js:751`).
- **Expected:** Conditional writes and retries preserve unrelated changes (the bridge and runner already do this: `camping-mail-bridge.mjs:17-25`, `runner.mjs:18`).
- **Actual:** The app is the one writer that can clobber others.
- **Trip impact:** A processed campsite reply disappears again; nobody is notified.
- **Smallest safe remediation:** Fetch with `X-Firebase-ETag` and PUT with `if-match` in `cloudPut()`; on 412 re-run the existing compare logic. (Whole-state LWW between devices is documented design — the snapshot mitigates it.)
- **Existing data:** Cannot be detected retroactively; going forward the fix prevents it.

### 5. Medium — A fresh device's pre-sync edits are discarded without a snapshot

- **File:** `app.js:744-749` (`_virgin` branch has no `takeSnapshot`, unlike the normal remote-adoption branch at `app.js:751`)
- **Reproduction:** Install the app on a new phone in a dead zone → record call results in Schlafplätze → regain signal → first successful `syncNow()` adopts the group state wholesale; the local edits exist in no snapshot (the daily snapshot holds the pre-edit state).
- **Expected:** A fresh device must not overwrite the group (it doesn't — correct), but local work should survive as a local snapshot.
- **Actual:** Edits are irrecoverably lost.
- **Trip impact:** Exactly the "new phone during the trip" scenario; call outcomes vanish.
- **Smallest safe remediation:** In the `_virgin && remote` branch, call `takeSnapshot('Vor Cloud-Übernahme')` when `state.meta.lastSaved` is set.
- **Existing data:** Not affected retroactively.

### 6. Medium — Local and cloud runners can process the same message concurrently; 412-retries re-apply processed messages

- **File:** `cloud-mail/runner.mjs:26-27` (lease covers only cloud runners), `tools/camping-mail-bridge.mjs:34-52` (no lease, no `runnerMode` check), `runner.mjs:37-49` and bridge `:43-47` (mutators do not skip events whose `messageId` is already in `processedMessageIds` when re-run after a 412)
- **Reproduction:** With cloud mode enabled, the Mac automation (via the bridge) and the GitHub runner scan simultaneously; both see message M as unprocessed and both apply it. Serialization via ETag makes the second writer retry — and re-apply M on top, overwriting any manual status change a user made in between; the log gets duplicate "Mail-Assistent" entries.
- **Expected:** One owner per message; re-applies are no-ops.
- **Actual:** Ownership is convention only. Mitigated today: the cloud runner is fully disabled without `MAIL_RUNNER_MODE` (verified), so only one processor exists.
- **Trip impact:** Only if cloud mode is enabled while the Mac automation still runs.
- **Smallest safe remediation:** Inside both mutators, skip events whose `messageId` is already in `processedMessageIds`; have the bridge refuse `apply` while a foreign lease is active.
- **Existing data:** None (cloud mode never enabled).

### 7. Medium — Bridge events can silently overwrite verified (V10-corrected) contact data

- **File:** `tools/camping-mail-bridge.mjs:45` — `['region','email','phone','link','lat','lng'].forEach(k=>{if(e[k]!==undefined)(place||candidate)[k]=e[k];})`
- **Reproduction:** The local automation includes an `email` field in an apply-event (e.g. echoing a Reply-To header). The shared place's verified e-mail is replaced; `contactVerified` remains `true`, so the app keeps offering the e-mail action on the now-unverified address.
- **Expected:** V10-verified contacts must not revert without a person confirming via "Bearbeiten".
- **Actual:** Any apply-event can rewrite them.
- **Trip impact:** Reservation acceptance could go to a stale or wrong address.
- **Smallest safe remediation:** In the bridge, ignore contact-field events for places with `contactVerified===true` (or set `contactVerified=false` when overwriting so the UI locks the action).
- **Existing data:** Check `sleepPlaces` e-mails against `CAMPING_NETWORK_CANDIDATES` (`app.js:258-287`) if the automation has run since 12.07.

### 8. Medium — An "unavailable" verdict hides a campsite from every view, and mail-assistant verdicts are not revertible

- **File:** `app.js:2967` (`sleepVisible`: neither "Echte Optionen" nor "Offene Anfragen" includes `unavailable`), `app.js:2970` (map excludes it), `runner.mjs:25` / bridge `:48` (`logChange` entries from the assistant carry `undo:null`)
- **Reproduction:** Set any candidate to `unavailable` (manually or via classification): it disappears from both list filters and the map (verified: `sleepVisible({status:'unavailable'})` is false in both). There is no card, hence no "Bearbeiten" button; the corresponding log entry offers no ↩︎.
- **Expected:** Rejected venues stay stored and out of operational views (they do — correct), but a misclassification must be correctable.
- **Actual:** The only recovery is re-adding the campsite or editing raw data; the record itself is unreachable.
- **Trip impact:** One wrong "ausgebucht" classification silently shrinks the safety net.
- **Smallest safe remediation:** Add a third filter ("Absagen") listing `unavailable`/`booked`-adjacent statuses with the normal edit button.
- **Existing data:** Existing `unavailable` candidates (Belvedere batch etc.) are stored intact — only invisible.

### 9. Low — Brand-new device: camping network is not seeded until the second load

- **File:** `app.js:448` — `migrate(null)` returns `defaultState()` before the seeding pipeline (`app.js:502-510`) runs
- **Reproduction (verified in headless Chromium, `file://`, empty localStorage):** first load → `state.sleepSearches.length === 0`, `campingNetworkSeeded === false`; after reload → 7 searches / 28 candidates.
- **Expected:** First render shows the safety network.
- **Actual:** Empty Schlafplätze tab until reload. Masked whenever the cloud is reachable (group state is adopted seconds later).
- **Trip impact:** Only offline/file:// first-runs.
- **Smallest safe remediation:** In `migrate()`, replace the early return with `s = defaultState()` and fall through.
- **Existing data:** None.

### 10. Low — A booked campsite never appears on the map

- **File:** `app.js:2970` and `:2973` — the `operational` filter omits `booked`, although the rank table (`:2972`) and marker color (`SLEEP_MAP_COLORS.booked`, `:2968`) were written for it
- **Reproduction (verified):** candidate set to `booked` → `buildSleepMap` renders 0 markers; same candidate `available` → 1 marker.
- **Expected:** The secured night — the one place the crew must actually drive to — is visible on "Diese Nacht"/"Gesamte Route".
- **Actual:** Only unconfirmed options are plotted.
- **Smallest safe remediation:** Add `'booked'` to both `operational` arrays in `buildSleepMap`.
- **Existing data:** Display-only.

### 11. Low — "Offizielle E-Mail-Adresse geprüft" is pre-checked for new candidates

- **File:** `app.js:2915` — `value:c.contactVerified!==false` renders the checkbox checked when `contactVerified` is `undefined` (every new candidate)
- **Reproduction (verified):** `sleepCandidateFields({})` → contactVerified field `value: true`.
- **Expected:** Verification is an explicit act; V10-locked entries correctly require checking the box, but new entries default to unverified.
- **Actual:** A hand-typed (possibly guessed) address is immediately treated as verified and gets the e-mail action.
- **Smallest safe remediation:** `value: raw.contactVerified===true` for new candidates (keep `!==false` when editing existing ones if desired).
- **Existing data:** Candidates added by hand since V9 carry `contactVerified:true` without review.

### 12. Low — Legacy `draft_requested` repair defaults to "available"

- **File:** `app.js:520` — when no matching draft request exists, `c.status = req?.previousStatus || 'available'`
- **Reproduction:** A stored candidate with `status:'draft_requested'` and an empty `draftRequests` array (e.g. Firebase pruned it when empty and the request history was lost) migrates to `available` — the UI then claims "Der Campingplatz hat für diese Nacht eine reservierbare Option angeboten" (`sleepStatusSummary`, `app.js:2958`) although no reply exists.
- **Expected:** Unknown prior state falls back to a non-committal status.
- **Actual:** Fabricated availability.
- **Smallest safe remediation:** Fall back to `'awaiting'` (or `'new'`).
- **Existing data:** Current cloud state is V10; only old backups being re-imported can hit this path.

### 13. Low — A requested draft cannot be withdrawn (dead function)

- **File:** `app.js:2956` — `cancelSleepDraft()` exists but no UI element references it (grep over `app.js`/`index.html`: definition only)
- **Reproduction:** Click "iCloud-Entwurf erstellen" (cloud mode) or "In Apple Mail öffnen": the request stays `requested`/`opened` indefinitely; the card offers only "Als gesendet markieren".
- **Expected:** A misfired intent can be cancelled; in cloud mode this is the only way to stop the runner from creating the iCloud draft.
- **Actual:** No cancel affordance (harmless in effect: drafts are never sent, and dedup prevents pile-up).
- **Smallest safe remediation:** Render a "Entwurf verwerfen" ghost button next to "Als gesendet markieren" when `latestReq` exists.
- **Existing data:** None.

## Test results

Repository test suite (Node v22, `node --test` / direct):

| Test | Result |
| --- | --- |
| `tools/camping-contact-consolidation.test.mjs` | pass |
| `tools/camping-mail-core.test.mjs` (9 classifier cases, quoted-history, ambiguous fail-closed) | pass |
| `tools/camping-network-v9.test.mjs` (archive idempotency, seed dedup, V10 corrections, placeId survival) | pass — note: its production-backup section self-skips because `backups/` is intentionally not in Git |
| `tools/sw.test.mjs` (atomic install, cache cleanup, navigation fallback, no HTML for missing assets) | pass |
| `node tools/verify-static-app.mjs` | pass (`classicScripts`, `assetOrder`, `offlineAssets`, `mapEmbedded` all true) |
| `node tools/camping-mail-bridge.mjs self-test` | pass (9 templates, blank signature, reserve ≠ inquiry, network-policy content) |
| `cloud-mail: node runner.mjs --self-test` (after local `npm install`) | pass (blank signature, thread headers) |
| `cloud-mail: node runner.mjs` without `MAIL_RUNNER_MODE` | `{"ok":true,"disabled":true}` — runner confirmed off by default |

Temporary investigation probes (not committed, scratchpad only):

| Probe | Result |
| --- | --- |
| `classifyReply` on French/Spanish bodies (complet, appeler, completo, llamar) | all → `review` (fail-closed; Finding 2) |
| `classifyReply` on reply with unstripped `Le … a écrit :` + quoted own inquiry | → `available` (Finding 1) |
| `matchCandidate` from unrelated sender, campsite name in subject | matched (Finding 3) |
| Headless Chromium, `file://`, 375 px, touch: boot, tab switching, console | no app errors (only blocked Firebase fetches in the sandbox) |
| Preview open/close ("Antwort vorbereiten" → "Schließen") | state byte-identical (area 1 pass) |
| Rendered preview content | ends `Kind regards,`, contains "6 adults", correct dates, no names (area 2 pass) |
| `openSleepMail` | status unchanged, 1 request with `previousStatus`, dedup on repeat = 0 (area 1 pass) |
| `markSleepDraftSent` (policy template) | → `awaiting` / `sent_manual` (area 1 pass) |
| La Chapelle / Ribera del Ara cards | no e-mail button, empty e-mail, `contactVerified:false` (area 3 pass) |
| Booked/unavailable map+filter handling | booked: 0 markers (Finding 10); unavailable invisible in both filters (Finding 8) |
| Fresh-device first load vs reload | 0 searches → 7/28 after reload (Finding 9) |
| Map zoom via touch tap at 375 px | zoom 2.3 → 4.6 (area 7 pass) |
| Booked-guard via `applyCandidateValues` with 3/4 confirmations | demoted to `reserving` (area 4 pass) |

Areas with no defects found: **area 1 (draft preview safety)** — all four requirements hold, supported by `app.js:2953-2956` and the stateless-preview/intent probes above; **mailbox integrity (area 5, partial)** — read-only locks and draft-append-only confirmed by exhaustive reading of `runner.mjs` (no send/delete/move/flag calls exist).

## Recommended implementation order

1. **Finding 1** (quote stripping + own-template filtering) — before the Mac automation processes more French/Spanish mail.
2. **Findings 2 + 3** (FR/ES vocabulary; sender-evidence requirement) — same file, same test harness.
3. **Finding 4** (ETag on the app's `cloudPut`) and **Finding 6** (processed-ID skip in both mutators) — protects everything else.
4. **Finding 5** (snapshot in the `_virgin` branch) — one line, high value for the trip.
5. **Finding 7** (bridge must not overwrite verified contacts).
6. **Findings 8–13** (UI/migration polish: Absagen filter, booked on map, verified-checkbox default, seed on first load, `draft_requested` fallback, cancel button).

## Manual acceptance checklist (iPhone + Mac, before departure)

On the iPhone (installed home-screen app, normal network):

1. Open **Schlafplätze**. The seven corridors from Ligurien to Huesca-Anfahrt appear under "Campingoptionen bis zum Festival".
2. Tap a campsite's **"✉️ … anfragen/vorbereiten"** button, read the preview, tap **"Schließen"**. The campsite's status badge must be unchanged.
3. In the preview of any campsite: text ends with **"Kind regards,"** and contains **"6 adults"** and the correct dates. No name after "Kind regards,".
4. Check **Camping La Chapelle** and **Camping Ribera del Ara** (Bearbeiten → fields): no e-mail button on the card; phone and "Karte" still work.
5. Tap **"In Apple Mail öffnen"** for one test campsite: Mail opens with recipient/subject/body prefilled — send nothing. Back in the app, the status must still be unchanged; only after **"Als gesendet markieren"** may it change to "Angefragt"/"Reservierung angefragt".
6. Try to set a campsite to **"Bestätigt"** via Bearbeiten with fewer than all four confirmation checkboxes: the app must refuse (status becomes "Reservierung angefragt" with a hint).
7. Switch to **Karte**, both "Diese Nacht" and "Gesamte Route": pinch-zoom, drag, and the ◎ location button must work with one hand at phone width; no sideways page scrolling anywhere.
8. Airplane mode on → reopen the app from the home screen: it must load (service worker) and show "Offline · lokal"; make a small edit; airplane mode off → badge returns to "Synchron" and a second device shows the edit.
9. After any change, open **Verlauf**: your name appears with the change; the ↩︎ button undoes it.

On the Mac:

10. Open the live URL in Safari, change a campsite note, and confirm it appears on the iPhone within ~30 s (and vice versa).
11. If the Codex mail automation is used: after its next run, open Schlafplätze and confirm every "Mail-Assistent" change has a plausible German summary and the quoted sentence is genuinely from the campsite (not our own English inquiry — see Finding 1). Anything odd: judge the reply yourself in Apple Mail; the app never sends anything.
12. Confirm `MAIL_RUNNER_MODE` is **not** set in the GitHub repository variables (cloud runner stays off; the runner then reports `disabled`).
13. Export a backup (Übersicht → Datensicherung → Export) and keep it off-device.
