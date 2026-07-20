# Roadtrip · gemeinsamer Reiseplaner

Mobile-first Reiseplaner für eine sechsköpfige Gruppe auf dem Weg zum Sizigia
Eclipse Gathering 2026. Die App bleibt grundsätzlich für andere Gruppenreisen
weiterentwickelbar.

**Live-App:** https://492ddtym72-cyber.github.io/sizigia-roadtrip-2026/

Die gehostete App synchronisiert den geteilten Stand über Firebase und bleibt
dank Service Worker und lokaler Speicherung auch bei Funklöchern nutzbar. Der
statische `file://`-Start bleibt ein technischer Offline-Rückfall.

## Nutzung

- Die Live-App auf dem Telefon öffnen und bei Bedarf zum Home-Bildschirm
  hinzufügen.
- Änderungen werden lokal gespeichert und mit dem Gruppenstand in Firebase
  abgeglichen. Der Status oben in der App zeigt den Sync-Zustand.
- Lokale Snapshots und JSON-Export schützen zusätzlich vor Bedienfehlern und
  ermöglichen eine bewusste Wiederherstellung ohne versehentliches
  Überschreiben des Gruppenstands.
- Der Bereich **Schlafplätze** bündelt Route, Kartenpunkte, Kontaktstatus,
  Antworten und mögliche Reservierungsschritte.

## Mail-Assistent

Der aktive Gmail-Runner in GitHub Actions prüft tagsüber campingbezogene Mails,
ordnet eindeutige Antworten dem Firebase-Stand zu und darf ungesendete Entwürfe
erstellen. Er sendet keine Mails, reserviert nichts und benötigt keinen
eingeschalteten Laptop. Für eine sofortige vollständige Mailanalyse kann der
separat autorisierte Gmail-Connector in ChatGPT verwendet werden.

## Entwicklung

Die App bleibt ohne Build-Schritt: `index.html` lädt ausschließlich lokale,
klassische Assets. Verbindliche Architektur- und Datenregeln stehen in
[`AGENTS.md`](AGENTS.md), der aktuelle Betriebsstand in
[`HANDOFF.md`](HANDOFF.md), und eine neue Cloud-Sitzung beginnt mit dem
[`Codex-Cloud-Runbook`](docs/operations/CLOUD_AGENT_RUNBOOK.md).

Verifikation:

```bash
node --test tools/*.test.mjs
node tools/verify-static-app.mjs
npm test --prefix cloud-mail
```
