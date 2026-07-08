# HANDOFF — Status

> Stand: 08.07.2026 · **Keine offene Aufgabe.** Cloud-Sync ist eingerichtet,
> getestet und live. Projektüberblick & Konventionen: [AGENTS.md](AGENTS.md).

## Aktueller Zustand ✅

- **Live-App:** https://492ddtym72-cyber.github.io/sizigia-roadtrip-2026/
  (GitHub Pages, Repo `492ddtym72-cyber/sizigia-roadtrip-2026`, `git push`
  auf `main` deployt automatisch; `gh` CLI ist authentifiziert.)
- **Laptop-unabhängig:** Die öffentliche App wird von GitHub Pages gehostet
  und läuft weiter, auch wenn dieses MacBook aus ist. Künftige KI-Agenten
  können das Repo direkt auf GitHub ändern; nach einem Push auf `main` ist die
  Änderung für alle sichtbar. Für geteilte App-Daten nutzt die Live-App
  Firebase Realtime Database, nicht den lokalen Rechner.
- **Cloud-Sync aktiv:** `CLOUD_URL` in `index.html` zeigt auf die Firebase
  Realtime Database des Projekts `roadtrip-to-sizigia-eclipse`
  (Instanz `roadtrip-to-sizigia-eclipse-default-rtdb`, Region us-central1,
  geheimer Pfad unter `/planner/…`). Regeln: Root gesperrt, nur der geheime
  Pfad ist lesbar/schreibbar (`database.rules.json`, deployt).
- Firebase CLI: `export PATH="/Users/anonymous/.hermes/node/bin:$PATH"`,
  eingeloggt mit Freddis Google-Konto (`firebase login:list`).
  Regeln neu deployen: `firebase deploy --only database --project roadtrip-to-sizigia-eclipse`

## Beim Sync gelernt (nicht kaputt machen!)

- **Firebase löscht leere Arrays/Objekte** beim Speichern → `migrate()`
  normalisiert alle Pflicht-Container (`votes`, `items`, `log`, …). Bei neuen
  Array-Feldern im Schema: dort ergänzen.
- **Frische Geräte** (`_virgin`-Flag): Beim ersten Sync gewinnt immer der
  Cloud-Stand, sonst überschreiben Default-Daten die Gruppendaten.
- `save()` erzeugt **monoton steigende Zeitstempel** (Schutz vor
  Uhren-Schiefstand bei Last-write-wins) — nicht vereinfachen.

## Aufräum-Hinweis (optional)

- Verwaistes GCP-Projekt `sizigia-2026-fc573b` (ohne Firebase) kann in der
  Google-Cloud-Konsole gelöscht werden.

## Backlog (Wünsche des Nutzers)

- Echte Festival-Daten eintragen (genauer Ort, Ticketstatus, Einlasszeit),
  sobald der Nutzer sie liefert — Festival-Tab, Platzhalter „eintragen".
- Rückreise-Etappen anpassen, wenn das echte Enddatum feststeht
  (aktuell Vorschlag 14.–17.08.).
