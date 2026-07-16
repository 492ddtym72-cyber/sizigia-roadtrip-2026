# Frankreich-ZFE auf der Schlafplatzkarte

Stand: 16.07.2026

## Zweck

Die scharfe Schlafplatz-Detailkarte zeigt die dauerhaften französischen
Low-Emission-Zones am Reisekorridor. Sie soll zwei Fragen beantworten:

1. Liegt der gespeicherte Campingplatz-Punkt innerhalb einer dauerhaften ZFE?
2. Welche amtlich als Transit/Ausnahme veröffentlichten Straßen sind in
   Marseille und Montpellier nutzbar?

Die Ebene ist eine Orientierungshilfe, kein Routenfreigabe-System. Ein Zielpunkt
außerhalb einer ZFE beweist nicht, dass jede von einer Navigations-App
vorgeschlagene Zufahrt ebenfalls außerhalb liegt.

## Eingebettete Daten

- **Nice:** amtlicher ArcGIS-Kartendienst der Métropole Nice Côte d’Azur.
  Aktuelle Fahrzeugregel aus der Stadtinformation: leichte Fahrzeuge bis
  3,5 t sind seit 18.04.2025 nicht mehr vom Fahrverbot betroffen; dieselbe
  Stadtseite bezeichnet die Plakette im Gebiet dennoch als verpflichtend.
  Ohne Plakette gibt die App deshalb keine pauschale Einfahrtsfreigabe.
- **Marseille:** amtliche ZFE-Fläche der Métropole Aix-Marseille-Provence;
  Ausnahmestraßen aus der national konsolidierten ZFE-Datenbasis.
- **Nîmes:** amtliche Gemeindegrenze (die veröffentlichte ZFE entspricht dem
  Stadtgebiet). Die Stadt nennt A9, A54, N106, N113, D999, D40 und D613 als
  Ausnahmen, stellt dafür aber keine gleichwertige ZFE-Liniendatei bereit.
  Deshalb werden keine scheinpräzisen Straßenlinien erfunden.
- **Montpellier:** amtliche Metropol-ZFE-Fläche und amtliche
  Transitachsen-Datei mit Stand 01.07.2026.

Die komprimierte klassische Datei `zfe-data.js` wird durch
`tools/build-zfe-data.mjs` erzeugt und ist im Service Worker enthalten. Damit
bleiben Flächen, Regeln und Punktprüfung lokal verfügbar; die scharfe
Straßen-Basiskarte selbst benötigt weiterhin Internet und fällt ansonsten auf
die eingebettete Europakarte zurück.

## Darstellung

- Rot: amtliche dauerhafte ZFE-Fläche.
- Grün gestrichelt: amtlich veröffentlichte Transit-/Ausnahmeachse.
- Campingplatz-Karte:
  - `In ZFE`: Zielpunkt liegt innerhalb einer beschränkten Fläche.
  - `Nahe … · Route prüfen`: Zielpunkt liegt außerhalb, aber höchstens 25 km
    von einer ZFE-Grenze entfernt.
  - `Außerhalb Dauer-ZFE`: Zielpunkt liegt außerhalb aller eingebetteten
    Flächen. Das ist keine Aussage über die gesamte Zufahrt.

Nice hat einen eigenen Hinweis, weil die aktuelle lokale Regel leichte
Fahrzeuge vom Fahrverbot ausnimmt, zugleich aber eine Plakettenpflicht nennt.
Solange Gewicht, Fahrzeugklasse und die konkrete amtliche Auslegung nicht
geklärt sind, darf daraus weder für den Pkw noch für den Camper eine pauschale
Einfahrtsfreigabe abgeleitet werden.

## Aktualisierung

Vor der Abfahrt und nach Rechtsänderungen:

1. Die vier amtlichen Flächen und die Straßen-Dateien erneut herunterladen.
2. `node tools/build-zfe-data.mjs /tmp` ausführen.
3. `node --test tools/*.test.mjs` und `node tools/verify-static-app.mjs`
   ausführen.
4. Kartenansicht mobil prüfen und Datenstand in UI und Dokumentation
   aktualisieren.

Temporäre Fahrverbote bei Luftverschmutzung sind nicht Teil des statischen
Datensatzes. Dafür verlinkt die Karte den vom französischen Umweltministerium
genannten Dienst **Vigilance atmosphérique**.
