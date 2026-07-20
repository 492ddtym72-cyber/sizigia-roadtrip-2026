# Schlafplatzkarten: ruhige Status-Tönung

## Ziel

Die Schlafplatzkarten sollen beim schnellen Scrollen sofort unterscheidbar sein,
ohne die zuletzt kritisierten farbigen Seitenstreifen. Gleichzeitig müssen
Symbole in Aktionen und Links einen sichtbaren Abstand zur Beschriftung haben.

## Bestätigte Gestaltung

- Die gesamte Karte erhält abhängig vom Status eine subtile, aber gut sichtbare
  Hintergrundtönung.
- Der vorhandene farbige Statuspunkt und die Statusbeschriftung bleiben die
  präziseste Statusanzeige.
- Es gibt keinen Statusstreifen, keinen farbigen Seitenrand und keinen starken
  Halo.
- Rahmen, Rundung, Innenabstände und Aufbau der Karten bleiben kompakt.
- Die Tönung darf Antwortbereich, Textkontrast und Aktionshierarchie nicht
  überlagern.
- Nicht verfügbare Plätze bleiben gedämpft, müssen aber noch gut lesbar sein.

## Statusfarben

Die vorhandenen Karten- und Markerfarben werden wiederverwendet:

- bestätigt: Blau
- verfügbar oder reservierbar: Mint
- spontan anrufen: Orange
- erneut fragen oder Anzahlung: Gelb
- Anfrage offen oder Reservierung läuft: Hellblau
- neu: neutral
- nicht verfügbar: Grau

Die Tönung ist klar sichtbar, aber nicht flächig-satt: am farbintensivsten
Punkt ungefähr 11–13 %, weich auf ungefähr 4 % auslaufend. Farbe dient der
Orientierung und nicht als alleiniger Informationsträger.

## Symbolabstände

`sleepIcon()` bleibt ein eigenes Inline-Element. Buttons und Links erhalten
einen echten Flex-Abstand zwischen Symbol und Text; die Darstellung darf nicht
von zufälligem Whitespace im erzeugten HTML abhängen. Das gilt für Mail,
Telefon, Website, Karte und Details.

## Technische Grenzen

- Nur Darstellung in `styles.css` und bei Bedarf minimale semantische Struktur
  in `app.js` ändern.
- Kein App-State, keine Migration und keine Firebase-Daten ändern.
- Keine neuen Assets, Bibliotheken oder Online-Abhängigkeiten.
- `file://`-, Offline- und Druckverhalten müssen erhalten bleiben.

## Verifikation

- Ein Regressionstest weist nach, dass kein Statusstreifen existiert, alle
  relevanten Statusklassen eine Hintergrundtönung besitzen und Symbol/Text über
  `gap` getrennt werden.
- Bestehende Tests und die statische App-Prüfung bleiben grün.
- Visuelle Prüfung bei ungefähr 375 px sowie in einer breiteren Ansicht:
  Status ist erkennbar, Text bleibt lesbar, Links umbrechen ohne Überlappung.
