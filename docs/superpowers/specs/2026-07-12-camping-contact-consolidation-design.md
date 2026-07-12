# Camping-Kontakte konsolidieren

## Ziel

Der Schlafplatz-Radar ist die einzige sichtbare und operative Quelle für
Campingplatz-Kontaktdaten. Die unvollständige Camping-Kontakte-Liste in „Orga“
wird nicht mehr angezeigt und von Automationen nicht weiter befüllt.

## Daten-Sicherheit

`campContacts` bleibt als Legacy-Archiv im State erhalten. Beim Migrieren werden
Name, Region, Telefon, Karten-Link und Notizen nur dann in den passenden
`sleepPlaces`-Datensatz übernommen, wenn das Zielfeld noch leer ist. Bestehende,
reichhaltigere Schlafplatz-Daten werden niemals überschrieben.

## Bedienung

Anrufbare und reservierbare Plätze bleiben im Schlafplatz-Radar samt Karte,
Telefon, E-Mail, Antwort-Zusammenfassung und Bedingungen sichtbar. Abgelehnte
Plätze bleiben gespeichert, erscheinen aber weiterhin nicht in operativen
Karten und Kartenlisten. „Orga“ enthält nur noch Erinnerungen und Umfragen.

## Automationen

Lokaler App-Code und Cloud-Mail-Runner aktualisieren weiterhin Erinnerungen und
Schlafplatz-Status, erzeugen aber keine Camping-Kontakt-Duplikate mehr.
Historische Undo-Einträge für Camping-Kontakte bleiben kompatibel.
