# Roadtrip-Planer „Sizigia 2026"

Interaktiver Reiseplaner (deutsche UI) für einen Roadtrip von 6 Personen:
München/Innsbruck → **Sizigia Eclipse Gathering 2026** (10.–14.08.2026, Provinz
Huesca, Spanien), Abfahrt 02.08.2026. Totale Sonnenfinsternis am 12.08.2026.

Diese Datei ist die Anlaufstelle für **alle KI-Agenten** (Claude, Codex, Gemini, …)
und Menschen, die am Projekt arbeiten.

> **Status & Betriebs-Infos:** [HANDOFF.md](HANDOFF.md) — Live-URL, Firebase-
> Projekt, Deploy-Befehle, Sync-Stolperfallen und Backlog. Bei laufenden
> Aufgaben wird dort der Zwischenstand gepflegt.
>
> **Produkt-Richtung:** [docs/specs/product-direction.md](docs/specs/product-direction.md)
> beschreibt die Leitplanken für eine wiederverwendbare, ruhige Gruppenreise-App.

## Projektstruktur

```
index.html                  # Statische HTML-Struktur und klassische Asset-Reihenfolge
styles.css                  # Gesamtes App-CSS
map-data.js                 # Eingebettete Offline-Karte (große Data-URI)
app.js                      # Gesamte Browser-Logik, ohne Build-Schritt
sw.js                       # Offline-Cache für die gehostete App
vendor/maplibre-*           # Lokal vendorte Detailkarten-Bibliothek + Lizenz
tools/camping-mail-*.mjs    # Lokale/Cloud-Maillogik, Tests und Firebase-Brücke
cloud-mail/                 # Deaktivierter GitHub/iCloud-Runner mit eigenem Lockfile
docs/specs/                 # Design-Spezifikationen
AGENTS.md                   # Diese Datei (CLAUDE.md verweist hierauf)
```

## Harte Regeln

1. **Statisch, kein Build.** `index.html` lädt ausschließlich klassische,
   lokale JS-/CSS-Assets und muss weiterhin per Doppelklick (`file://`)
   funktionieren. Keine CDNs, Module, Fonts oder verpflichtenden Bilder-URLs.
   Einzige optionale Online-Abhängigkeit ist die Schlafplatz-Detailkarte über
   OpenFreeMap; bei fehlendem Netz oder Anbieterfehler muss automatisch die
   eingebettete Offlinekarte erscheinen und die App vollständig nutzbar bleiben.
2. **UI-Sprache Deutsch.** Code/Kommentare deutsch oder englisch, UI-Texte deutsch.
3. **Kein Datenverlust.** Jede Zustandsänderung ruft `save()` auf. Das Schema
   nie umbenennen/entfernen ohne Migration in `migrate()` (siehe unten).
4. Mobile-first: primäre Nutzung auf Smartphones (~375 px Breite).

## Datenmodell & Persistenz

- Ein einziges State-Objekt (`state`) mit `schemaVersion` (aktuell `14`),
  definiert in `defaultState()` in `app.js`.
- **`StorageAdapter`** (`load()` / `save(state)`) kapselt die lokale Persistenz:
  `localStorage` unter dem Key `sizigia-roadtrip-2026`.
- **Cloud-Sync (optional, local-first):** Konstante `CLOUD_URL` oben im Script —
  REST-URL einer Firebase Realtime Database inkl. geheimem Pfad + `.json`;
  `null` = reiner Lokal-Modus. Engine: `syncNow()` (GET/PUT via `fetch`, kein
  SDK/CDN), debounced über `scheduleSync()` nach jedem `save()`, plus Polling
  (25 s), `online`- und `visibilitychange`-Trigger. Konflikte: Last-write-wins
  über `meta.lastSaved`; `save()` erzeugt dafür **monoton steigende** Zeitstempel
  (Schutz gegen Uhren-Schiefstand zwischen Geräten). Vor Übernahme eines
  fremden Standes mit ungepushten lokalen Änderungen: Snapshot
  („Vor Cloud-Übernahme"). Status-Badge: `setSyncStatus()` / `#syncBadge`.
- Backup: Export/Import als JSON im Bereich „Übersicht → Datensicherung".
  `importData()`
  validiert grob und ruft `migrate()` auf. Bei aktivem `CLOUD_URL` darf Import
  **nicht** automatisch in die Gruppe synchronisieren: alte Backups werden nur
  lokal geöffnet (`LOCAL_ONLY_KEY`, Sync pausiert), bis der Gruppenstand wieder
  geladen wird. `meta.lastExport` steuert den „Backup veraltet"-Hinweis in der
  Speicherleiste.
- **Automatische Snapshots:** rollierend max. 5 Stände unter
  `<STORAGE_KEY>-snapshots` (1× täglich vor der ersten Änderung, vor Import,
  vor Wiederherstellung). UI: Übersicht → Datensicherung → „Lokal öffnen".
  Wiederherstellung ist bei aktivem Cloud-Sync absichtlich local-only und darf
  keinen alten Stand per `save()`/`scheduleSync()` nach Firebase pushen.
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

## Architektur (in `app.js`)

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
- **Karte:** echtes Europakarten-Bild (Natural Earth I, public domain; Terrain +
  Grenzen ins Bild gebacken), als WebP-Data-URI in `MAP_IMG` eingebettet —
  komplett offline, bewusst KEINE Tiles/Leaflet/CDN. Feste equirektangulare
  Projektion über die Bildgrenzen (`MAP` = 12°W–45°O / 33°–63°N,
  `project()`/`unproject()`). Länder-/Städte-/Meer-Beschriftungen
  (`COUNTRY_LABELS`, `CITY_LABELS`, `SEA_LABELS`) sowie Routen/Marker sind
  SVG-Overlays im `<g class="map-pan">`. Pan/Zoom pro Karten-Instanz
  (`MAP_VIEWS`, `data-mapid`: `route`, `spots`, `big`, `pick<i>`): Ziehen,
  Pinch, Mausrad, +/−-Buttons. ◎-Button (`locateMe`, nicht auf `pick`-Karten)
  zeigt den GPS-Standort (`userPos`, nicht persistiert) und zentriert die
  Ansicht. Gesten ändern nur das `transform`; am
  Gesten-Ende baut `mapSettle()` → `rebuild()` das Overlay mit Gegenskalierung
  (Modul-Variable `MZ`) neu, damit Marker/Labels konstant groß bleiben.
  Positionen kommen aus gespeichertem `lat`/`lng` am Objekt oder automatisch
  via `GEO`-Ortslexikon (`geoLookup`: Substring-Abgleich, letzter Treffer im
  String gewinnt = Ziel). Neue vorbefüllte Orte ⇒ Eintrag in `GEO` ergänzen.
  Marker-Klicks laufen über das `mapInfoLabels`-Array (in `renderAll()`
  geleert). Bild neu erzeugen: Natural-Earth-Raster (GitHub
  `nvkelso/natural-earth-raster`, `NE1_HR_LC_SR_W.tif`) auf die `MAP`-Grenzen
  zuschneiden, Grenzen aus `ne_50m_admin_0_boundary_lines_land` einzeichnen,
  als WebP (Qualität ≈78) kodieren.
  Im Schlafplatz-Tab ist zusätzlich eine scharfe Online-Detailkarte mit lokal
  vendortem MapLibre GL JS und dem OpenFreeMap-Stil verfügbar. Sie liest nur
  vorhandene `lat`/`lng`-Werte und verändert weder `state` noch Firebase. Der
  Umschalter „Offlinekarte“ sowie der automatische 12-Sekunden-/Offline-
  Fallback müssen erhalten bleiben. Der gewählte Layer liegt nur lokal unter
  `<STORAGE_KEY>-sleep-map-layer`; die eingebettete Karte bleibt maßgeblich für
  Offlinebetrieb, Positions-Picker, Routen-, Spot- und Großkarten.
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
- **Identität:** `whoami()` liest das Crew-Mitglied dieses Geräts aus
  localStorage (`<STORAGE_KEY>-whoami`, nicht synchronisiert); Erstbesuch
  fragt per Modal (`askWho`). Wählbar im Verlauf-Tab.
- **Verlauf/Changelog:** `state.log` (max. 150 Einträge, synchronisiert) —
  jede Mutation ruft `logChange(desc, undo, who?)` VOR `save()` auf. `undo`
  ist eine typisierte Umkehr-Operation für `applyRevert()` (Dispatcher);
  `revertEntry(id)` wendet sie an, markiert den Eintrag `undone` und
  protokolliert den Revert selbst. Ziel weg ⇒ sauberer Abbruch + Toast.
  **Neue Mutations-Funktionen müssen einen `logChange`-Aufruf bekommen**
  (Beschreibung deutsch, Muster: „hat … [Ziel] …") und, wenn machbar,
  einen `undo`-Typ in `applyRevert`.
- **Service Worker (`sw.js`):** cached die App fürs Offline-Öffnen der
  gehosteten URL (Netz zuerst, Cache-Fallback; fremde Origins unangetastet).
  Registrierung nur unter `https:` — `file://`-Nutzung bleibt unberührt.

## Verifikation

Kein Test-Framework. Vor dem Commit manuell im Browser prüfen:
Tabs durchklicken, etwas ändern → neu laden (Persistenz), Export/Import-
Roundtrip, Darstellung bei ~375 px Breite, Konsole fehlerfrei.
