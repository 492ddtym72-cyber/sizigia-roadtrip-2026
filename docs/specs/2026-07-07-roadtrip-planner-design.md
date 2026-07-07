# Roadtrip-Planer „Sizigia 2026" — Design-Spezifikation

**Datum:** 2026-07-07 · **Status:** vom Nutzer freigegeben (inkl. Budget & Spot-Voting)

## Ziel

Ein interaktiver Reiseplaner für einen Roadtrip von 6 Personen (Jakob, Christoph,
Bernhard, Max, Lukas, Freddi) ab 02.08.2026 von München/Innsbruck zum
**Sizigia Eclipse Gathering 2026** (10.–14.08.2026, Provinz Huesca, Spanien).
Camper wird in Innsbruck übernommen (gehört Lukas), Kleinwagen ab München (Bernhard).

## Architektur

- **Eine einzige, in sich geschlossene `index.html`** — Vanilla JS, CSS/JS inline,
  kein Build-Schritt, keine externen Abhängigkeiten. Öffnet auf jedem Gerät per
  Doppelklick oder Browser (auch `file://`).
- **Agent-neutral:** `AGENTS.md` dokumentiert Architektur, Datenmodell und
  Konventionen; `CLAUDE.md` verweist darauf. Jeder KI-Agent (Claude, Codex, …)
  kann das Projekt weiterentwickeln.
- **UI-Sprache: Deutsch.** Modernes, dunkles Design, mobile-first.

## Datenhaltung (zentraler Punkt)

- Ein versioniertes JSON-State-Objekt (`schemaVersion`), Autosave bei jeder
  Änderung, sichtbarer „Zuletzt gespeichert"-Indikator.
- **StorageAdapter-Interface** (`load()` / `save(state)`): aktuell localStorage;
  später austauschbar gegen Cloud-Sync-Adapter, ohne die App anzufassen.
- **Export/Import prominent im Header:** Export als
  `roadtrip-backup-<datum>.json` (Teilen via WhatsApp etc.), Import auf jedem
  Gerät. Sicherheitsnetz gegen Datenverlust bis Cloud-Sync existiert.
- Schema-Migration bei Import älterer Versionen.

## Bereiche (Tabs)

1. **Übersicht** — Countdown bis 02.08., Eckdaten (Crew, Fahrzeuge, Festival),
   Fortschritt (offene Punkte aus Pack-/Einkaufsliste/Checkliste).
2. **Route** — 3 vorbefüllte, wählbare Routen-Optionen (Mittelmeerküste /
   Alpen & Schluchten / Mix), Etappen editierbar (Datum, von→nach, km, Fahrzeit,
   Übernachtungsidee, Notizen, Google-Maps-Link), Etappen hinzufügen/löschen/
   verschieben. Plus vorbefüllte **Rückreise** (ab 14.08., anpassbar).
3. **Spots** — Ideen-Sammlung entlang der Route mit Maps-Link, Umweg-Schätzung
   und **Voting**: jede:r der 6 kann per Namens-Chip abstimmen.
4. **Logistik** — Fahrzeuge (Übernahme, Fahrer, Dokumente, Vignette/Maut),
   Sitz-/Fahrzeugaufteilung, Vorab-Checkliste.
5. **Packliste** — vorbefüllt nach Kategorien (Camping, Küche, Festival,
   Hygiene, Dokumente/Geld, Technik), Checkboxen, optional „wer bringt's mit".
6. **Einkauf** — gruppierte Einkaufsliste (Essen, Getränke, Sonstiges).
7. **Budget** — geteilte Ausgaben: wer hat was gezahlt, Aufteilung wählbar
   (Standard: alle 6), automatische Salden + Ausgleichsvorschläge („wer zahlt wem").
8. **Festival** — Sizigia-Infoblock (Termine, Region Huesca, totale
   Sonnenfinsternis am 12.08.2026, Ticket-/Anreise-Notizen), editierbar.

Alles ist editierbar/ergänzbar/löschbar; sämtliche Zustände persistieren.

## Nicht im Scope (bewusst)

- Cloud-Sync (vorbereitet über StorageAdapter, kommt später).
- Aufgaben mit Deadlines/Zuständigen als eigener Bereich (Checklisten decken das Nötigste ab).

## Verifikation

Manuell im Browser: Tab-Navigation, Editieren + Reload (Persistenz),
Export/Import-Roundtrip, mobile Darstellung (~375 px).
