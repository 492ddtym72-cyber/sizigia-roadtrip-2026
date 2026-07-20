# HANDOFF — aktueller Betriebsstand

> Stand: 20.07.2026 · `main` ist der stabile Live-Stand. Dauerhafte Regeln:
> [AGENTS.md](AGENTS.md). Start einer neuen Cloud-Sitzung:
> [docs/operations/CLOUD_AGENT_RUNBOOK.md](docs/operations/CLOUD_AGENT_RUNBOOK.md).

## Produktion

- **Live-App:** https://492ddtym72-cyber.github.io/sizigia-roadtrip-2026/
- **Repository:** `492ddtym72-cyber/sizigia-roadtrip-2026`; ein Push auf `main`
  veröffentlicht über GitHub Pages.
- **Schema:** V19. `SCHEMA_VERSION` ändert sich nur bei dauerhaften
  Strukturänderungen, niemals wegen neuer Mails oder neuer Verfügbarkeiten.
- **Geteilter Live-Stand:** Firebase Realtime Database im Projekt
  `roadtrip-to-sizigia-eclipse`. Die konfigurierte URL enthält einen privaten
  Pfad und darf nicht in Ausgaben, Tickets oder Chats kopiert werden.
- **Offline:** `localStorage`, automatische Snapshots, Export/Import und Service
  Worker halten die App bei Funklöchern nutzbar. Der `file://`-Start bleibt
  möglich; OpenFreeMap fällt automatisch auf die eingebettete Karte zurück.

## Mailbetrieb

- GitHub Actions **Camping mail safety net** ist der aktive,
  laptopunabhängige Hintergrundweg.
- Produktionsvariablen: `MAIL_PROVIDER=gmail` und `MAIL_RUNNER_MODE=cloud`.
- Zeitplan: 06:00, 12:00 und 18:00 UTC, im August ungefähr 08:00, 14:00 und
  20:00 MESZ; zusätzlich ist ein manueller Workflow-Start möglich.
- Gmail-Secrets liegen nur in GitHub Actions. Sie dürfen weder ins Repository
  noch in Chat, Logs oder Firebase geschrieben werden.
- Der Runner liest passende Inbox-/Sent-Mails, klassifiziert konservativ,
  aktualisiert den passenden Firebase-Eintrag und darf ungesendete Entwürfe
  erstellen. Er besitzt keinen Sende-Endpunkt und löscht, verschiebt oder
  markiert keine Mails als gelesen.
- Der ChatGPT-Gmail-Connector ist eine separate persönliche Autorisierung für
  interaktive Volltextanalyse. Er gibt einem Codex-Cloud-Container keinen
  direkten Gmail-Zugriff.
- iCloud/Apple Mail bleibt ein lokaler Recovery-Weg, nicht der primäre Betrieb.
  Einrichtung und Rückfall: [docs/GMAIL_CLOUD_MAIL_SETUP.md](docs/GMAIL_CLOUD_MAIL_SETUP.md).

## Quellen der Wahrheit

- GitHub `main`: Code, Schema, Tests und dauerhafte Regeln.
- Firebase: aktueller Reise-, Unterkunfts- und Mailstatus.
- Gmail: vollständige Nachrichten und Threads.
- GitHub Actions: Ausführung des Gmail-Runners und Workflowstatus.
- `localStorage`: gerätespezifischer Offlinezustand und UI-Einstellungen.

Mailantworten, Preise, Versand- und Reservierungsstände dürfen nicht als Seed
oder Migration nach `app.js` kopiert werden. Wenn Firebase nicht lesbar ist,
darf eine Sitzung keinen aktuellen Unterkunftsstand behaupten.

## Deployment und Diagnose

Vor jeder Änderung:

```bash
git status --short --branch
git log -5 --oneline
node tools/cloud-session-check.mjs
```

Vollständige lokale Verifikation:

```bash
node --test tools/*.test.mjs
node tools/verify-static-app.mjs
npm test --prefix cloud-mail
```

Der Statuscheck ist rein lesend und gibt keine Mailtexte, URLs oder Secrets
aus. Ohne `gh` kann der Actions-Workflow über die GitHub-Weboberfläche geprüft
und manuell gestartet werden.

## Sync- und Datenregeln, die erhalten bleiben müssen

- Firebase kann leere Arrays/Objekte beim Speichern entfernen; `migrate()`
  normalisiert Pflichtcontainer defensiv.
- Auf frischen Geräten gewinnt beim ersten Sync der Cloud-Stand, damit Defaults
  keine Gruppendaten überschreiben.
- `save()` verwendet monoton steigende Zeitstempel; vor einer Cloud-Übernahme
  mit ungepushten lokalen Änderungen entsteht ein Snapshot.
- App und Mail-Runner schreiben Firebase konfliktgeschützt. Live-Daten werden
  nie durch einen statischen Seed zurückgesetzt.
- Entwürfe enden nach `Kind regards,` mit einer leeren Namenszeile, verwenden
  normalen Klartext statt violettem Zitatblock und verändern keinen fachlichen
  Status, solange sie nicht tatsächlich gesendet wurden.

## Produktstand und nächste Entscheidungen

- Die Oberfläche bleibt ruhig, deutsch und mobile-first. Der Festivalbereich
  darf Sizigia-spezifisch sein; Navigation und Kernfunktionen bleiben neutral
  genug für weitere Gruppenreisen.
- Der Schlafplatz-Radar bündelt feste und flexible Abschnitte, verifizierte
  Kontakte, Kartenpunkte, ZFE-Hinweise sowie die Zustände angefragt, nutzbar,
  spontan anrufen, abgelehnt und bestätigt.
- Eine Unterkunft ist erst nach ausdrücklicher Bestätigung und vollständiger
  Prüfung als gebucht/gesichert zu markieren. Der aktuelle Live-Stand steht in
  Firebase, nicht in diesem Dokument.
- Vor der Abfahrt bleiben die amtlichen französischen ZFE- und temporären
  Luftqualitätsmeldungen ein Live-Check; statische Kartenhinweise sind keine
  pauschale Routengenehmigung.
- Offene Produktentscheidungen: echte Festivaldaten ergänzen, sobald sie
  vorliegen, und die Rückreise nach dem tatsächlichen Abfahrtsdatum festlegen.

## Historie

Frühere Schema- und Funktionsschritte bleiben vollständig in Git erhalten.
Diese Datei enthält bewusst nur den aktuellen Betriebszustand, damit neue
Sitzungen nicht historische Aussagen mit Live-Daten verwechseln.
