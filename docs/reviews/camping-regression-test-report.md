# Camping regression test report

Basis: `main` @ `47c0423` („Harden camping mail automation and recovery") · Datum: 12.07.2026
Neue Tests: 7 Testdateien + 1 Test-Hilfsmodul, zusammen 87 Regressionsszenarien (121 `assert`-Aufrufe, durch Schleifen > 150 ausgeführte Prüfungen). Kein Produktionscode geändert; keine Netz-, Firebase-, Mailbox- oder Browser-Zugriffe — Firebase ist in allen Tests durch ein `fetch`-Mock ersetzt, `app.js` läuft in einem vm-Testbed mit DOM-Stubs (`tools/app-testbed.mjs`).

## Abgedeckte Verhalten

1. **Fremdsprachige Zitat-Header** (`tools/camping-mail-quoted-history.test.mjs`)
   - `newestReply` schneidet alle 9 Header-Varianten ab: `Le … a écrit :`, `El … escribió:`, `Il … ha scritto:`, `De :`, `-----Message d'origine-----`, `-----Mensaje original-----`, `-----Messaggio originale-----`, `On … wrote:`, `>`-Zitate.
   - Zitierte Kopien der eigenen Anfrage ergeben für keine Variante `available` (alle ⇒ `review`).
   - Bekannter Gefahrfall „Non, désolé." + französischer Header + englische Original-Anfrage ⇒ `review`, nie `available`.
   - Eigene Template-Sätze werden auch ohne erkannten Header gefiltert; echte Zu-/Absagen über dem Zitat klassifizieren weiterhin korrekt.
2. **Mehrsprachige Klassifikation** (`tools/camping-mail-multilingual.test.mjs`)
   - 21 französische/spanische Fixtures für available, unavailable/voll, Spontan-Anruf/Anreise ohne Reservierung, Nachfassen kurz vor Anreise, Anzahlung (acompte/arrhes/señal), bestätigte Reservierung, mehrdeutige Antworten.
   - Mehrdeutiges und Widersprüchliches fällt geschlossen auf `review` (confidence `low`).
3. **Absender-sicheres Matching** (`tools/camping-mail-matching.test.mjs`)
   - Exakte verifizierte Adresse matcht (inkl. Case-/`Re:`-Normalisierung); Nicht-Freemail-Domain-Match greift; Name-only-Betreff von fremdem Absender ⇒ `null`; exakter Thread-Betreff ohne Absender-Beleg ⇒ `null`; Punktgleichstand ⇒ `null`; gmail/icloud/outlook/hotmail-Domain-Ähnlichkeit allein ⇒ `null` (exakte Freemail-Adresse bleibt gültig).
4. **Message-ID-Idempotenz** (`tools/camping-mail-idempotency.test.mjs`)
   - Bridge (`applyEvents` aus dem echten Quelltext extrahiert, Firebase gemockt): verarbeitete Message-ID ändert Kandidat nicht erneut und erzeugt keinen Schreibversuch; nach simuliertem 412 mit konkurrierendem Schreiber wird weder der zwischenzeitliche (manuelle) Status überschrieben noch ein doppelter Log-Eintrag erzeugt; Review- und Entwurfs-Duplikate (gleiche ID) werden dedupliziert; unter aktivem fremdem Lease bricht `apply` sicher ab.
   - Cloud-Runner (`applyEvents` extrahiert): verarbeitete Message-ID wird im Mutator übersprungen (Retry-sicher); doppelte Review-Nachricht ⇒ genau ein Queue- und ein Log-Eintrag; Sent-Erkennung befördert eine Anfrage genau einmal (`ready → sent_detected`, zweite Zustellung ist No-op).
5. **Schutz verifizierter Kontakte** (`tools/camping-contact-protection.test.mjs`)
   - Bei `contactVerified === true` kann ein Mail-Event weder E-Mail, Telefon, Link, Koordinaten, Region noch den Verifikationsstatus ändern (der fachliche Event-Teil bleibt wirksam).
   - Bei unverifizierten Plätzen werden importierte Kontaktdaten übernommen, aber ausdrücklich auf `contactVerified === false` gesetzt (auch wenn der Status vorher `undefined` war); reine Positions-Updates lassen den Verifikationsstatus unangetastet.
6. **App-Cloud-Konfliktschutz** (`tools/app-cloud-sync.test.mjs`, echtes `app.js` im vm-Testbed, `fetch` gemockt)
   - GET sendet `X-Firebase-ETag: true`; PUT sendet `if-match` mit genau dem ETag des vorangegangenen GET; 412 ⇒ erneuter GET und Retry-PUT mit dem NEUEN ETag; nach drei Konflikten endet der Sync mit Status `offline` (nie `ok`); ein nach dem Konflikt neuerer Fremdstand wird übernommen statt überschrieben (nur 1 PUT-Versuch), inklusive Snapshot „Vor Cloud-Übernahme".
   - Frisches Gerät (`_virgin`) mit lokalen Vor-Sync-Änderungen: Snapshot vor der Cloud-Übernahme, Cloud-Stand gewinnt, kein PUT.
7. **Wiederherstellungs- und Anzeige-Schutz** (`tools/sleep-recovery-safeguards.test.mjs`)
   - Erster Offline-Start (leerer Speicher, `fetch` wirft): alle 7 Korridore und 28 Kandidaten sofort gesät, ohne Reload.
   - `booked` erscheint auf der Karte („Diese Nacht" und „Gesamte Route"); `unavailable` erscheint in keiner operativen Ansicht und nie auf der Karte, nur unter „Absagen" (und „Absagen" zeigt nur Absagen); der Filter existiert in der gerenderten Ansicht.
   - Neue Kandidaten: Kontaktprüfung standardmäßig aus; nur ausdrücklich bestätigte Bestände zeigen den Haken.
   - „Entwurf verwerfen" ist auf der Karte verdrahtet; Anfordern und Verwerfen eines Entwurfs lassen den fachlichen Status unverändert (`available` bleibt `available`, Anfrage ⇒ `cancelled`, `draftState` ⇒ `none`).
   - Legacy `draft_requested` ohne Anfrage-Historie fällt auf `awaiting` zurück (nie `available`); mit Historie wird der echte vorherige Status wiederhergestellt.

## Ausgeführte Tests und Ergebnisse

`node --test tools/*.test.mjs` (Node v22):

| Test | Ergebnis |
| --- | --- |
| tools/app-cloud-sync.test.mjs (neu) | pass |
| tools/camping-contact-consolidation.test.mjs (Bestand) | pass |
| tools/camping-contact-protection.test.mjs (neu) | pass |
| tools/camping-mail-core.test.mjs (Bestand) | pass |
| tools/camping-mail-idempotency.test.mjs (neu) | pass |
| tools/camping-mail-matching.test.mjs (neu) | pass |
| tools/camping-mail-multilingual.test.mjs (neu) | pass |
| tools/camping-mail-quoted-history.test.mjs (neu) | pass |
| tools/camping-network-v9.test.mjs (Bestand) | pass |
| tools/sleep-recovery-safeguards.test.mjs (neu) | pass |
| tools/sw.test.mjs (Bestand) | pass |

**11/11 pass, 0 fail.** Zusätzlich: `node tools/verify-static-app.mjs` ⇒ ok (inkl. neuer Checks `etagSync`, `recoverableRejections`); `node tools/camping-mail-bridge.mjs self-test` ⇒ ok. Keine bestehende Assertion wurde abgeschwächt.

Hinweis: `node --test tools/` (Verzeichnis-Form) schlägt auch auf unverändertem `main` fehl, weil der Runner dabei Nicht-Test-Skripte wie `camping-mail-bridge.mjs` mitstartet (die ohne Netz mit Exit 1 enden). Kanonischer Aufruf ist die Glob-Form `node --test tools/*.test.mjs` bzw. einzelne Dateien.

## Nicht (ohne Produktionsänderung) testbare Verhalten

- **IMAP-nahe Runner-Pfade** (`collectInbox`, `createDrafts`, `detectSent` in `cloud-mail/runner.mjs`): benötigen einen IMAP-Server bzw. `imapflow`-Emulation. Getestet ist die nachgelagerte, entscheidende Schicht (`applyEvents`, Sent-Beförderung genau einmal); die Envelope-Beschaffung selbst bleibt ungedeckt.
- **412-Retry des Cloud-Runners auf Transportebene** (`updateState` in `runner.mjs`): identische Logik wie die getestete Bridge-`conditionalUpdate`; getestet wurde beim Runner die Mutator-Idempotenz, die der Retry erneut ausführt. Ein eigener Transport-Test würde nur duplizieren.
- **Echte Service-Worker-Aktivierung nach Deploy** und mailto-Übergabe an Apple Mail: Browser-/OS-Verhalten, nicht deterministisch in Node abbildbar (SW-Logik selbst ist durch `tools/sw.test.mjs` gedeckt).
- **Feld-Merge bei gleichzeitigen App-Edits**: existiert konstruktionsbedingt nicht (dokumentiertes Last-write-wins auf Ganzzustand); getestet ist stattdessen, dass der neuere Fremdstand übernommen und der lokale Stand als Snapshot gesichert wird.

## Gefundene Produktionsdefekte (nicht behoben, nur dokumentiert)

1. **Tote französische Absage-Muster durch `\b` nach Akzentbuchstaben** — `tools/camping-mail-core.mjs`, `RX.unavailable`: Die Alternativen `\baucune disponibilité\b` und `\bpas de disponibilité\b` können nie matchen, weil `é` in JavaScript-Regexen ohne `u`-Flag/`\p{L}` kein Wortzeichen ist und daher nach „é" vor Leerzeichen/Satzende keine `\b`-Grenze existiert.
   - Repro: `classifyReply('Aucune disponibilité pour ces dates.')` ⇒ `review` (erwartet: `unavailable`). Fällt geschlossen aus (sicher, aber unpräzise — die Absage landet unnötig in der manuellen Prüfung).
   - Kleinster Fix: in den beiden Alternativen das schließende `\b` durch `(?![\p{L}\p{N}])` ersetzen und dem Regex das `u`-Flag geben — oder schlicht `disponibilit[ée]s?` ohne schließendes `\b` verwenden.
   - Testabdeckung: `tools/camping-mail-multilingual.test.mjs` dokumentiert das aktuelle Verhalten (`review`, nie `available`) mit Kommentar; nach dem Fix kann die Assertion auf `unavailable` verschärft werden.
2. **Backup mit leerem `routes`-Array macht die App unbrauchbar** — `app.js`, `migrate()` (normalisiert `routes:[]` nicht auf Defaults) in Kombination mit `renderOverview()` (`const tot = routeTotals(route.stages)` bei `route === undefined`).
   - Repro: `migrate({meta:{lastSaved:'…'}, crew:[…], routes:[]})` liefert einen Zustand mit `routes:[]` und nicht existentem `selectedRoute`; das folgende `renderAll()` wirft `TypeError: Cannot read properties of undefined (reading 'stages')`. Über „Import" erreichbar: `importData` validiert nur `!data.routes` — ein Backup mit `"routes": []` besteht die Prüfung, wird vor dem Rendern in localStorage gespeichert und lässt die App auch nach Neustart crashen, bis der Speicher geleert wird. (Im Cloud-Sync fällt derselbe Crash auf `setSyncStatus('offline')` zurück.)
   - Kleinster Fix: in `migrate()` nach der Default-Ergänzung `if(!Array.isArray(s.routes) || !s.routes.length) s.routes = defaultState-Routen;` (analog zur bestehenden `selectedRoute`-Reparatur).
   - Gefunden beim Aufbau der Sync-Fixtures; die Test-Fixtures umgehen ihn mit einer Minimal-Route, ein Regressionstest gehört zum Fix.

## Dateien

Neu: `tools/camping-mail-quoted-history.test.mjs`, `tools/camping-mail-multilingual.test.mjs`, `tools/camping-mail-matching.test.mjs`, `tools/camping-mail-idempotency.test.mjs`, `tools/camping-contact-protection.test.mjs`, `tools/app-cloud-sync.test.mjs`, `tools/sleep-recovery-safeguards.test.mjs`, `tools/app-testbed.mjs` (Hilfsmodul, kein Test), dieser Bericht. Keine bestehenden Dateien geändert; keine temporären Abhängigkeiten committet.
