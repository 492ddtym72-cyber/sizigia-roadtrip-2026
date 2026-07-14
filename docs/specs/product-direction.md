# Produkt-Richtung: Gruppenreisen ohne Planungsstress

## Versprechen

Die App ist das gemeinsame Reise-Werkzeug für Gruppen, die spontan bleiben
wollen, ohne wichtige Dinge dem Zufall zu überlassen. Sie beantwortet zuerst
drei Fragen:

1. Was ist heute oder als Nächstes geplant?
2. Was braucht gerade eine Entscheidung oder eine verantwortliche Person?
3. Welche verlässlichen Alternativen gibt es, wenn sich der Plan ändert?

Die Oberfläche soll ruhig, direkt und unterwegs mit einer Hand bedienbar sein.
Sie erzeugt keine Dringlichkeit, wenn keine besteht, und unterscheidet klar
zwischen Idee, Anfrage, Angebot und bestätigter Buchung.

## Produktprinzipien

- **Heute vor Datenbank:** Die Startseite zeigt Kontext und nächste sinnvolle
  Schritte; vollständige Listen bleiben in den Werkzeugen.
- **Spontanität mit Rückhalt:** Alternativen sind sichtbar, ohne als Notfall
  bezeichnet zu werden. Absagen bleiben gespeichert, aber aus operativen
  Karten und Kartenansichten heraus.
- **Menschen behalten Kontrolle:** Entwürfe, KI-Auswertungen und Vorschläge
  ändern nie selbstständig einen Buchungsstatus. Senden und Buchen bleiben
  bewusste Handlungen.
- **Eine Wahrheit für die Gruppe:** Jede Aufgabe kann eine verantwortliche
  Person, Fälligkeit und einen nachvollziehbaren Status haben.
- **Offline zuerst:** Kerninformationen, Navigation innerhalb der App,
  gespeicherte Karten und Bearbeitung funktionieren ohne Netz. Online-Dienste
  sind Verbesserungen mit Fallback, keine Voraussetzung.
- **Fehler müssen reparierbar sein:** Migrationen erhalten alte Daten,
  destruktive Aktionen sind rückgängig machbar und automatische Einordnungen
  dürfen bei Unsicherheit nicht raten.
- **Reiseunabhängiges Modell:** Neue Funktionen sollen mit beliebigen Reisen,
  Daten, Gruppen, Fahrzeugen und Unterkunftsarten funktionieren. Sizigia bleibt
  der erste echte Anwendungsfall, nicht eine fest codierte Sonderlösung.

## Informationsarchitektur

### Heute

Ein abgeleitetes Cockpit mit Reisephase, aktueller oder nächster Etappe,
passender Unterkunftslage, höchstens fünf priorisierten Punkten und wenigen
Schnellaktionen. Das Cockpit selbst schreibt keine Daten.

### Planen

Route, Etappen, Orte und Unterkünfte. Eine Unterkunft ist künftig eine
allgemeine Option (Camping, Hotel, Wohnung, Stellplatz), deren Verfügbarkeit
und Buchungsstatus an einen Reiseabschnitt oder ein Datumsfenster gebunden ist.

### Gruppe

Aufgaben, Entscheidungen, Zuständigkeiten, Packen und Einkauf. Die Person, die
etwas öffnet, soll sofort sehen, was ihr gehört und was noch niemand übernommen
hat.

### Unterwegs

Karte, aktuelle Etappe, erreichbare Alternativen, wichtige Dokumente und
Offline-Informationen. In einem späteren Reisemodus werden Planungselemente
reduziert und fahrtrelevante Aktionen hervorgehoben.

## Reihenfolge des Ausbaus

1. **Heute und Aufgaben:** zuverlässiger Tageskontext, Zuständigkeiten,
   Fälligkeit und Entscheidungen. (Schema V14)
2. **Navigation vereinfachen:** die vielen Werkzeuge in die vier mentalen
   Bereiche Heute, Planen, Gruppe und Mehr bündeln, ohne bestehende URLs oder
   Datenmodelle zu brechen.
3. **Unterkünfte verallgemeinern:** Camping-Funktionen auf andere
   Unterkunftsarten erweitern; bestehende Campingdaten migrieren, nicht
   ersetzen.
4. **Reisemodus:** unterwegs größere Primäraktionen, Standortbezug, Offline-
   Hinweise und eine explizite „Plan geändert“-Funktion.
5. **Mehrere Reisen:** Trip-Liste, Archiv, Vorlagen und Einladungscode. Erst
   danach Authentifizierung und ein kommerzielles Backend bewerten.

## Qualitätsgrenzen

Vor jedem Release müssen Migration, lokale Persistenz, Cloud-Konflikte,
Offline-Start, mobile Darstellung und das Rückgängig-Verhalten geprüft werden.
Ein neues kommerzielles Feature darf keine kostenpflichtige Abhängigkeit oder
Kontopflicht in den bestehenden Roadtrip einführen. Sensible Zugangsdaten
gehören nie in App-State, Repository oder Browser-UI.
