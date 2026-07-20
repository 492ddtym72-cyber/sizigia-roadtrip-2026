# Schlafplatz-Erfassung, Weiterleitungen und Kartenhierarchie

**Stand:** 20.07.2026  
**Ziel:** Neue Schlafplätze bleiben sofort auffindbar, weitergeleitete Antworten
werden formatunabhängiger und trotzdem konservativ erkannt, und die Karten sind
wieder klar als zusammengehörige Einheiten lesbar.

## Beobachtete Ursachen

- Max' Eintrag „Camping Font de Ferrosins“ wurde korrekt in Firebase und im
  Abschnitt „Erste Nacht“ gespeichert. Ohne `lat`/`lng` kann ihn weder die
  Online- noch die Offlinekarte zeichnen. Die Kartenansicht zeigt nur einen
  unauffälligen Gesamtzähler; die Standard-Listenansicht filtert `awaiting`
  zusätzlich aus. Dadurch wirkt der gespeicherte Eintrag verschwunden.
- Der Mail-Runner erkennt Weiterleitungen nur, wenn der Text einen formalen
  Marker wie „Begin forwarded message“ enthält. Web.de/mobile, Outlook-ähnliche
  Headerblöcke und `On … wrote:` können trotz echter `From`-/`To`-/`Subject`-
  Felder durchfallen.
- Die jüngste Kartenvereinfachung entfernte den subtilen Kartenhintergrund und
  die Mail-/Telefonzeichen. Lange Rückmeldungen verschiedener Plätze fließen
  dadurch optisch ineinander.

## Reihenfolge

Die funktionalen Änderungen werden zuerst umgesetzt und separat getestet. Die
visuelle Kartenüberarbeitung folgt erst, wenn neue und bestehende Plätze in
beiden Kartenebenen zuverlässig auffindbar sind.

## 1. Neue Plätze und fehlende Positionen

- Speichern ohne Position bleibt erlaubt; unvollständige Recherche darf nicht
  verloren gehen.
- Unter Online- und Offlinekarte erscheint ein kompakter Bereich
  **„Position fehlt“**. Er zeigt jeden zur aktuellen Statusauswahl passenden,
  nicht positionierten Platz genau einmal – auch noch nicht kontaktierte neue
  Einträge.
- Jede Zeile nennt Platz, Region, Reiseabschnitt und Status und besitzt die
  primäre Aktion **„Position setzen“**. Diese öffnet den bestehenden
  Bearbeiten-Dialog mit Karten-Picker; es wird kein zweites Datenmodell gebaut.
- Nach dem Hinzufügen ohne Position zeigt die App eine konkrete Rückmeldung,
  dass der Platz gespeichert wurde und noch eine Kartenposition braucht.
- Sobald `lat`/`lng` am verknüpften `sleepPlace` gesetzt sind, verschwindet der
  Eintrag aus „Position fehlt“ und erscheint aus derselben Datenquelle auf
  Online- und Offlinekarte.
- Es werden keine Koordinaten geraten. Vorhandene Koordinaten aus vollständigen
  Kartenlinks und bewusst gesetzte Picker-Positionen bleiben maßgeblich.

## 2. Weitergeleitete Campingplatz-Mails

- Die vorhandenen expliziten Weiterleitungsmarker bleiben unterstützt.
- Zusätzlich darf ein weitergeleiteter Umschlag einen eigenständigen
  mehrsprachigen Headerblock erkennen: `From/Von/De/Da`, `To/An/À/Para/A` und
  `Subject/Betreff/Objet/Asunto/Oggetto`, mit optionalen Datumszeilen,
  Leerzeilen und vorangestellten `>`-Zeichen.
- Das wird nur für bereits als Weiterleitung erkannte Betreffzeilen
  (`Fwd`, `Fw`, `WG`, `TR`, `RV`, `I`) oder angehängte RFC822-Mails verwendet.
- Ein eingebetteter Absender bzw. Empfänger muss weiterhin exakt zu einem
  bekannten Platz passen. Ähnliche Namen, ein kopierter Betreff oder freie
  Textnennungen reichen nicht.
- Jede weitergeleitete Antwort landet immer in der manuellen Prüfliste. Sie
  ändert nie automatisch den fachlichen Status; die Klassifikation ist nur ein
  Vorschlag.
- Tests decken Apple-/klassische Marker, Outlook-/Web.de-Headerblöcke,
  `On … wrote:`-Quoting, verschiedene Sprachen, unvollständige Blöcke und
  absichtliche Fehlzuordnungen ab. Max' konkrete Form ist nur eine Fixture.

## 3. Ruhig strukturierte Kontaktkarten

- Jede Unterkunft erhält wieder eine subtile eigene Fläche: niedriger Kontrast,
  feine Kontur und etwa 10 px Radius. Der Status steht ausschließlich als
  kleiner Punkt mit Text im Kopf; ein zusätzlicher Farbstreifen an der
  Kartenkante entfällt. Keine großen runden Pills oder stark gefärbten
  Container.
- Kopf, Fakten, Rückmeldung und Aktionen bilden klar getrennte Ebenen. Die
  Rückmeldung liegt in einer leicht abgesetzten Innenfläche, damit langer Text
  eindeutig beim richtigen Platz bleibt.
- Mail, Telefon, Website, Karte und Details bekommen kleine monochrome Symbole
  mit Textlabel. Symbole sind unterstützend; die Bedeutung hängt nie nur vom
  Icon ab.
- Primäre Aktionen bleiben abhängig vom fachlichen Status. Die Gestaltung darf
  Entwürfe nicht als gesendet oder Plätze nicht als bestätigt erscheinen lassen.
- Abgelehnte Plätze bleiben gedämpft, aber weiterhin les- und korrigierbar.

## Daten- und Sicherheitsgrenzen

- Kein Schema-Bump und keine Migration: Die vorhandenen Daten sind korrekt,
  nur Darstellung und Parserverhalten ändern sich.
- Kein automatischer Firebase-Fix aus statischen Seeds.
- Keine Mail wird gesendet, gelöscht, verschoben oder als gelesen markiert.
- Der Produktionsrunner wird erst nach vollständigen lokalen Tests ausgelöst.
- Camping Font de Ferrosins wird nach Verarbeitung der echten Weiterleitung
  manuell geprüft; die Aussage „voll bis 10. August“ ist keine Bestätigung für
  spätere Nächte.

## Abnahme

1. Ein neuer Platz ohne Position ist nach dem Speichern unter der Karte
   sichtbar und über „Position setzen“ editierbar.
2. Nach Setzen der Position erscheint derselbe Eintrag auf beiden Karten und
   nicht mehr in der Fehlpositionsliste.
3. Max' Weiterleitung erzeugt genau einen manuellen Prüffall für Font de
   Ferrosins und nie einen Eintrag für Valira.
4. Andere unterstützte Weiterleitungsformate funktionieren; unklare Formate
   bleiben wirkungslos oder in manueller Prüfung.
5. Auf etwa 375 px Breite sind einzelne Unterkunftskarten eindeutig getrennt,
   Kontaktwege sichtbar und keine Inhalte abgeschnitten.
6. Bestehende Firebase-Daten, Status, Entwürfe und Kartenkoordinaten bleiben
   erhalten.
