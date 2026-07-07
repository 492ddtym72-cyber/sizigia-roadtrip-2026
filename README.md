# 🌒 Sizigia 2026 · Roadtrip-Planer

Interaktiver Planer für unseren Roadtrip zum **Sizigia Eclipse Gathering 2026**
(10.–14.08.2026, Provinz Huesca, Spanien) — Abfahrt am 02.08.2026 ab
München/Innsbruck. Crew: Jakob, Christoph, Bernhard, Max, Lukas, Freddi.

## Benutzung

**[`index.html`](index.html) im Browser öffnen — fertig.** Keine Installation,
kein Internet nötig. Am Handy: Datei öffnen und über „Zum Home-Bildschirm
hinzufügen" wie eine App nutzen.

### Wichtig: Datensicherung 💾

Alle Eingaben werden automatisch **lokal im Browser des jeweiligen Geräts**
gespeichert. Damit nichts verloren geht und alle den gleichen Stand haben:

1. Oben rechts **⬇︎ Backup exportieren** → JSON-Datei
2. Datei in die Gruppe schicken (WhatsApp, Signal, …)
3. Auf anderen Geräten oben rechts **⬆︎ importieren**

### Cloud-Sync (alle sehen denselben Stand)

Ist `CLOUD_URL` in `index.html` gesetzt (Firebase Realtime Database), synchron­isieren
sich alle Geräte automatisch: Änderungen werden ~1 s nach dem Tippen hochgeladen,
alle 25 s sowie beim Öffnen/Fokussieren abgeglichen. Offline funktioniert alles
weiter (lokal), synchronisiert wird sobald wieder Netz da ist — Status steht
oben in der Speicherleiste. Details: `AGENTS.md`.

## Für Entwickler & KI-Agenten

Alles Wichtige steht in [`AGENTS.md`](AGENTS.md).
