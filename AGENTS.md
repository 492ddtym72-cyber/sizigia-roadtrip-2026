# Roadtrip-Planer „Sizigia 2026"

Interaktiver Reiseplaner (deutsche UI) für einen Roadtrip von 6 Personen:
München/Innsbruck → **Sizigia Eclipse Gathering 2026** (10.–14.08.2026, Provinz
Huesca, Spanien), Abfahrt 02.08.2026. Totale Sonnenfinsternis am 12.08.2026.

Diese Datei ist die Anlaufstelle für **alle KI-Agenten** (Claude, Codex, Gemini, …)
und Menschen, die am Projekt arbeiten.

## Projektstruktur

```
index.html                  # Die gesamte App: HTML + CSS + JS inline, keine Dependencies
docs/specs/                 # Design-Spezifikationen
AGENTS.md                   # Diese Datei (CLAUDE.md verweist hierauf)
```

## Harte Regeln

1. **Eine Datei, kein Build.** `index.html` muss weiterhin per Doppelklick
   (`file://`) auf jedem Gerät funktionieren. Keine externen Requests
   (keine CDNs, Fonts, Bilder-URLs) — die App muss offline laufen.
2. **UI-Sprache Deutsch.** Code/Kommentare deutsch oder englisch, UI-Texte deutsch.
3. **Kein Datenverlust.** Jede Zustandsänderung ruft `save()` auf. Das Schema
   nie umbenennen/entfernen ohne Migration in `migrate()` (siehe unten).
4. Mobile-first: primäre Nutzung auf Smartphones (~375 px Breite).

## Datenmodell & Persistenz

- Ein einziges State-Objekt (`state`) mit `schemaVersion` (aktuell `1`),
  definiert in `defaultState()` in `index.html`.
- **`StorageAdapter`** (`load()` / `save(state)`) kapselt die Persistenz.
  Aktuell: `localStorage` unter dem Key `sizigia-roadtrip-2026`.
  **Geplanter Ausbau:** Cloud-Sync (z. B. Firebase/Supabase) durch Austausch
  des Adapters — App-Code darf Persistenz nur über den Adapter berühren.
- Backup: Export/Import als JSON über die Header-Buttons. `importData()`
  validiert grob und ruft `migrate()` auf. `meta.lastExport` steuert den
  „Backup veraltet"-Hinweis in der Speicherleiste.
- **Automatische Snapshots:** rollierend max. 5 Stände unter
  `<STORAGE_KEY>-snapshots` (1× täglich vor der ersten Änderung, vor Import,
  vor Wiederherstellung). UI: Übersicht → Datensicherung → „Wiederherstellen".
- **Rückgängig:** Destruktive Aktionen laufen über `withUndo(msg, fn)` —
  zeigt einen Toast mit „Rückgängig"-Button (eine Stufe). Neue Lösch-Aktionen
  bitte ebenfalls über `withUndo` statt `confirm()`.
- **Tab-Sync:** Ein `storage`-Event-Listener übernimmt Änderungen aus anderen
  offenen Tabs desselben Browsers (last-write-wins, kein Merge).
- **Eingaben-Erhalt:** `renderAll()` rettet Werte von Inputs/Selects mit `id`
  (außerhalb des Modals) sowie den Zustand der `#exSharers`-Chips über den
  Re-Render. Neue Formularfelder brauchen deshalb eine `id`.
- **Migrationen:** Bei Schema-Änderungen `SCHEMA_VERSION` erhöhen und in
  `migrate()` alte Stände konvertieren (fehlende Keys werden bereits defensiv
  aus `defaultState()` ergänzt). Optionale Felder (z. B. `lat`/`lng` an
  Etappen/Spots) brauchen keine Migration.

## Architektur (in `index.html`)

- Vanilla JS, kein Framework. Jeder Tab hat eine `render<Tab>()`-Funktion,
  die ihren `<section id="page-…">`-Inhalt komplett aus `state` neu aufbaut.
  `renderAll()` rendert alles; nach jeder Mutation: `save(); renderAll();`.
- Event-Handling über Inline-`onclick` mit globalen Funktionen; IDs im State
  sind generierte, HTML-sichere Strings (`uid()`).
- **Nutzertexte immer mit `esc()` escapen**, wenn sie in HTML landen.
- Generische Listen (Packliste, Einkauf, Checklisten, Fahrzeug-Dokumente)
  laufen über `resolveList(ref)` mit Refs wie `pack:<catId>`, `shop:<catId>`,
  `vdoc:<vehicleId>`, `checklist`.
- Editieren über das generische Modal: `openModal(title, fields, onSave, onDelete?)`.
  Feldtypen: `text` (Default), `number`, `textarea`, `select`, `map`
  (Positionswahl per Fingertipp, liefert `"lat,lng"`-String → `applyPos()`).
- **Karte:** Inline-SVG, komplett offline — bewusst KEINE Tiles/Leaflet/CDN.
  Equirektangulare Projektion (`MAP`, `project()`/`unproject()`), vereinfachte
  Küste (`COAST`, `ISLANDS`, Format `[lon,lat]`). Positionen kommen aus
  gespeichertem `lat`/`lng` am Objekt oder automatisch via `GEO`-Ortslexikon
  (`geoLookup`: Substring-Abgleich, letzter Treffer im String gewinnt = Ziel).
  Neue vorbefüllte Orte ⇒ Eintrag in `GEO` ergänzen. Marker-Klicks laufen über
  das `mapInfoLabels`-Array (wird in `renderAll()` geleert).
- Design-Tokens als CSS-Variablen in `:root` (Theme „Eclipse Night": dunkler
  Nachthimmel, Sonnenkorona-Akzente `--sun`/`--coral`).

## Fachlicher Kontext

- Crew: Jakob, Christoph, Bernhard, Max, Lukas, Freddi.
- Fahrzeuge: Camper von Lukas (Übernahme in Innsbruck), Kleinwagen von
  Bernhard (ab München). Treffpunkt Innsbruck am 02.08.
- 3 vorbefüllte Routen-Optionen (Küste / Alpen / Mix) + Rückreise-Vorschlag;
  alles editierbar, `state.selectedRoute` markiert den Favoriten.
- Budget: geteilte Ausgaben mit wählbaren Teilenden, Salden und
  Greedy-Ausgleichsvorschlägen.

## Sonstige Konventionen

- Druck-Stylesheet (`@media print`): alle Tabs untereinander, hell, ohne
  Karte/Buttons — Papier-Fallback für Funklöcher. Bei neuen UI-Elementen
  prüfen, ob sie im Druck sinnvoll sind (sonst dort ausblenden).
- Budget-Berechnung zentral in `budgetCalc()` (Salden + Greedy-Ausgleich);
  `copySettlement()` teilt den Ausgleich als Text (Clipboard mit Fallback).
- Packlisten-Personenfilter: Modul-Variable `packFilter` (nicht persistiert).

## Verifikation

Kein Test-Framework. Vor dem Commit manuell im Browser prüfen:
Tabs durchklicken, etwas ändern → neu laden (Persistenz), Export/Import-
Roundtrip, Darstellung bei ~375 px Breite, Konsole fehlerfrei.
