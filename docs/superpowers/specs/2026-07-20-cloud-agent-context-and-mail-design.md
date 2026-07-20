# Cloud-Agent-Kontext und Mailzugriff

**Stand:** 20.07.2026  
**Status:** Vom Nutzer als Richtung freigegeben; diese Spezifikation beschreibt
die verlässliche Umsetzung vor dem Implementierungsplan.

## Ausgangslage

Die App, ihre geteilten Reisedaten und der Mail-Assistent sind bereits
laptopunabhängig:

- GitHub Pages liefert die statische App aus.
- Firebase Realtime Database ist die maßgebliche Quelle für den geteilten,
  aktuellen Reise- und Unterkunftsstand.
- Ein zeitgesteuerter GitHub-Actions-Runner liest das weitergeleitete Gmail-
  Postfach, erkennt versandte Nachrichten, erstellt ausschließlich ungesendete
  Entwürfe und schreibt kurze Ergebnisse nach Firebase.
- Der Gmail-Connector in ChatGPT erlaubt bei Bedarf eine interaktive Sicht auf
  vollständige Nachrichten und Threads.

Diese Zugänge sind voneinander getrennt. Ein Codex-Cloud-Container erhält durch
den Repository-Checkout weder die OAuth-Autorisierung des ChatGPT-Gmail-
Connectors noch die GitHub-Actions-Secrets. Das Repository darf diese
Zugangsdaten nicht enthalten.

Der letzte Cloud-Versuch hat die Trennung sichtbar gemacht: Er las den
Firebase-Stand korrekt, wollte danach aber flüchtige Mailantworten als neue
Schema-V21-Migration und statische Seed-Daten in `app.js` übernehmen. Diese
Änderungen wurden nicht auf `main` oder in einen Pull Request übertragen. Das
Vorgehen wäre fachlich falsch, weil es einen momentanen Live-Stand dauerhaft in
die Migrationsgeschichte einbrennen und später ältere Informationen erneut auf
Geräte verteilen könnte.

## Ziele

1. Eine neue Codex-Cloud-Sitzung versteht das Produkt, die aktuellen
   Betriebswege und die Sicherheitsgrenzen ohne alten Chatverlauf.
2. Sie kann den aktuellen, mailbox-abgeleiteten Arbeitsstand über Firebase
   zuverlässig und rein lesend erfassen.
3. Der Gmail-Hintergrundprozess läuft weiterhin ohne Laptop über GitHub Actions.
4. Vollständige Mailtexte werden nur über den autorisierten Gmail-Connector in
   einer Oberfläche gelesen, die diesen Connector tatsächlich anbietet.
5. Flüchtige Reise-, Antwort- oder Buchungsstände werden nie mit Schema-
   Migrationen oder statischen Defaults verwechselt.
6. Dokumentation und Tests erkennen wichtige Kontext-Drifts frühzeitig.

## Nicht-Ziele

- Kein eigener Gmail-MCP-Server und kein zusätzlicher Hosting-Dienst.
- Keine Gmail-, Google-, Firebase- oder GitHub-Zugangsdaten im Repository oder
  in normalen Codex-Cloud-Umgebungsvariablen.
- Kein Mailversand durch den Hintergrund-Runner.
- Keine automatische Reservierung, Formularübermittlung oder Bestätigung einer
  Unterkunft.
- Keine vollständigen Mailkörper in Firebase, GitHub-Artefakten oder Logs.
- Keine Änderung der bestehenden App-Daten allein zur Einrichtung des
  Agentenkontexts.

## Architektur: zwei getrennte Mailwege

### 1. Hintergrundweg: GitHub Actions → Gmail → Firebase

Der bestehende Workflow `.github/workflows/camping-mail.yml` bleibt der
always-online Mailbox-Prozessor. Seine OAuth-Werte liegen ausschließlich in
GitHub Actions Secrets. Der Runner darf:

- campingbezogene Inbox- und Sent-Nachrichten lesen,
- bekannte Threads und Kontakte konservativ zuordnen,
- kurze Antwortzusammenfassungen und Zitate in den passenden Firebase-Eintrag
  schreiben,
- ungesendete, normal formatierte Plain-Text-Entwürfe mit leerer Namenszeile
  erstellen,
- einen tatsächlichen Versand über Sent Mail erkennen.

Er darf niemals senden, löschen, verschieben, als gelesen markieren,
Reservierungen auslösen oder eine Unterkunft ohne eindeutige Bestätigung als
gebucht markieren.

### 2. Interaktiver Weg: ChatGPT/Codex + Gmail-Connector

Wenn vollständige neue Nachrichten, Anhänge oder ganze Threads gelesen werden
müssen, wird der verbundene Gmail-Connector verwendet. Diese Autorisierung ist
kontogebunden und kein Repository-Bestandteil. Eine Sitzung ohne Gmail-Werkzeug
muss auf den synchronisierten Firebase-Stand zurückfallen und klar sagen, dass
sie den vollständigen Postfachinhalt nicht gesehen hat.

Ein Codex-Cloud-Coding-Container erhält keinen Gmail-Refresh-Token. Auch ein
Cloud-Environment-Secret löst das nicht sicher: solche Secrets sind laut
Codex-Betriebsmodell nur im Setup verfügbar und werden vor der Agentenphase
entfernt. Ein Token als normale Umgebungsvariable wäre unnötig exponiert und
ist ausgeschlossen.

## Quellen der Wahrheit

| Information | Maßgebliche Quelle | Nicht als Quelle verwenden |
| --- | --- | --- |
| App-Code, Schema, Tests, Betriebsregeln | GitHub-Repository auf `main` | alter Chatverlauf |
| Aktuelle Reise-, Unterkunfts- und Antwortstände | Firebase | statische Seeds in `app.js` |
| Vollständige Mailtexte und Threads | Gmail | Firebase-Auszüge oder Workflow-Logs |
| Hintergrundlauf, OAuth und Entwurfserstellung | GitHub Actions | Codex-Cloud-Environment |
| Gerätespezifische Offlinewerte und UI-Präferenzen | `localStorage` des Geräts | Firebase, sofern ausdrücklich lokal |

### Harte Regel für Schema und Migrationen

`SCHEMA_VERSION` wird nur erhöht, wenn sich die dauerhaft erwartete Struktur
oder eine echte, idempotente Daten-Normalisierung ändert. Neue Antworten,
Statuswechsel, Preise, Verfügbarkeiten, gesendete Anfragen oder
Buchungsentscheidungen sind normale Live-Datenmutationen in Firebase und **kein
Migrationsgrund**.

Seed-Daten dürfen neue, bewusst kuratierte Orte oder dauerhafte Grunddaten
bereitstellen. Sie dürfen keine aktuellen Mailantworten aus Firebase zurück in
den Code kopieren. Migrationen dürfen bestätigte oder bereits bearbeitete
Live-Felder nicht mit älteren Seed-Werten überschreiben.

## Dauerhafter Agentenkontext

### `AGENTS.md`

Die Datei wird auf einen kurzen, aktuellen Einstieg reduziert und enthält:

- Schema-Version 19 als aktuellen Stand zum Zeitpunkt der Umsetzung,
- aktive GitHub/Gmail-Cloud-Mailarchitektur,
- die obige Quellen-der-Wahrheit-Matrix,
- verbindliche Aktionsgrenzen,
- aktuelle automatisierte Prüfkommandos,
- Verweise auf Runbook, Handoff, Produktleitplanken und Mail-Setup.

Sie hält außerdem die Reiseparameter fest, die für Mailentwürfe dauerhaft
relevant sind: sechs Erwachsene, ein Camper, ein Kleinwagen, flexible
Ein-Nacht-Fenster, leere persönliche Signatur und ruhige Sprache. Begriffe wie
„Notfallnetz“ oder „Sicherheitsnetz“ werden nicht als Produktbezeichnung
verwendet.

### `docs/operations/CLOUD_AGENT_RUNBOOK.md`

Das neue Runbook beschreibt den Start jeder frischen Cloud-Sitzung:

1. Repository-Stand und `AGENTS.md` prüfen.
2. Den rein lesenden Cloud-Statuscheck ausführen.
3. Firebase als aktuellen Datenstand verwenden.
4. Vor Änderungen den tatsächlichen Diff und die bestehenden Tests prüfen.
5. Keine Live-Daten in Seeds oder Migrationen kopieren.
6. Mailaktionen nach der Berechtigungsmatrix behandeln.
7. Änderungen auf einem Branch prüfen; `main` nur nach erfolgreicher
   Verifikation aktualisieren.

Das Runbook erklärt ausdrücklich die Unterschiede zwischen Gmail-Connector,
GitHub-Mail-Runner, Firebase und Codex Cloud. Es enthält außerdem eine kurze
Fehlerdiagnose für fehlendes `gh`, fehlende Git-Remotes, nicht verfügbare
Connectoren, verzögerte Mailchecks und Firebase-Netzfehler.

### `README.md` und `HANDOFF.md`

`README.md` wird zum neutralen Einstieg in die gehostete Roadtrip-App. Der
aktuelle Betrieb über GitHub Pages, Firebase und den Gmail-Runner steht vor dem
historischen lokalen Dateiweg.

`HANDOFF.md` behält den konkreten Betriebsstand und Backlog, trennt aber den
aktuellen Zustand klar von historischer Migrationserzählung. Widersprüche wie
„Runner deaktiviert“, „lokaler Mac maßgeblich“ oder „iCloud ist primär“ werden
entfernt.

## Rein lesender Cloud-Statuscheck

Ein neues Skript `tools/cloud-session-check.mjs` bietet frischen Agenten einen
einheitlichen Einstieg. Es benötigt keine privaten Mail- oder GitHub-Secrets
und führt ausschließlich GET-Anfragen aus.

Der Statuscheck:

- ermittelt die Firebase-URL aus der bestehenden App-Konfiguration, ohne sie
  auszugeben,
- liest den aktuellen Firebase-State,
- zeigt Schema-Version, letzten Speicherzeitpunkt und Mail-Provider,
- zeigt letzten erfolgreichen Mailcheck, nächsten geplanten Check und Fehler,
- zählt offene manuelle Mailprüfungen und Entwurfsanfragen,
- fasst Unterkunftsstatus nach Reiseabschnitt zusammen,
- prüft optional über die öffentliche GitHub-API den letzten Workflow-Lauf,
  ohne `gh` oder einen konfigurierten Git-Remote vorauszusetzen.

Das Skript zeigt keine vollständigen Mailkörper, OAuth-Werte, Firebase-URL oder
sonstigen Secrets. Ein fehlender GitHub-Status ist eine Warnung; ein nicht
lesbarer Firebase-Stand ist ein harter Fehler, weil dann keine verlässliche
Aussage über aktuelle Reisedaten möglich ist.

Maschinenlesbares JSON wird über `--json` angeboten, die Standardausgabe bleibt
für Menschen knapp und deutsch. Netzwerkzugriffe werden in Tests vollständig
gemockt.

## Berechtigungsmatrix für Agenten

| Aktion | Ohne Rückfrage | Nur nach ausdrücklichem Auftrag in derselben Unterhaltung |
| --- | --- | --- |
| Repository und Firebase lesen | ja | — |
| Plätze recherchieren und vergleichen | ja | — |
| Antworten klassifizieren und App-Daten vorsichtig aktualisieren | ja | — |
| ungesendeten Entwurf vorbereiten | ja | — |
| E-Mail senden | nein | ja |
| Kontaktformular absenden | nein | ja |
| Reservierung oder Zahlung auslösen | nein | ja |
| Unterkunft als bestätigt markieren | nein | ja, plus eindeutiger Beleg |
| Mail löschen, verschieben oder als gelesen markieren | nein | ja |

Ein Entwurf verändert keinen fachlichen Status. Erst tatsächliche Sent-Mail-
Erkennung oder die bestehende manuelle Versandbestätigung setzt „angefragt“.
Eine Unterkunft wird nur bei einer eindeutigen Bestätigung für die passenden
Daten, sechs Erwachsene, Camper und Kleinwagen als gesichert behandelt.

## Modellwahl in Codex Cloud

Die Repository-Konfiguration kann das Modell eines Codex-Cloud-Chats nicht
erzwingen. Nach aktueller offizieller Codex-Dokumentation lässt sich das
Standardmodell für Cloud-Chats derzeit nicht ändern. Ein `model`-Eintrag in
`.codex/config.toml` gilt für Desktop-App, CLI und IDE, nicht als zuverlässiger
Cloud-Override.

Für schwierige, interaktive Arbeit wird deshalb nach Möglichkeit Work mode im
Web oder die Desktop-App mit **Sol** und angemessener Reasoning-Stufe verwendet.
Cloud-Aufgaben werden durch kleine Arbeitsaufträge, den verpflichtenden
Statuscheck, klare Quellen der Wahrheit, Tests und Review-Gates abgesichert.
Eine Promptzeile wie „arbeite sorgfältig“ ersetzt keine tatsächliche
Modellwahl und wird nicht als Schutzmechanismus betrachtet.

## Fehlerbehandlung

- **Gmail-Connector fehlt:** nur Firebase-Zusammenfassung verwenden; keine
  Behauptung über ungelesene vollständige Threads.
- **GitHub-Mailworkflow fehlgeschlagen:** Fehler und Zeitpunkt sichtbar machen,
  keine statuses aus Vermutungen ändern; Nutzer auf den Workflow-Link hinweisen.
- **Mailcheck noch nicht gelaufen:** Zeitpunkt nennen; für sofortige Sicht den
  Gmail-Connector verwenden oder den GitHub-Workflow manuell starten.
- **Firebase nicht erreichbar:** keine Live-Statusänderung und keine Seeds aus
  lokalem Stand erzeugen.
- **Uneindeutige Antwort:** manuelle Prüfwarteschlange; niemals automatisch
  „verfügbar“, „abgesagt“ oder „bestätigt“ setzen.
- **Konflikt beim Schreiben:** bestehende ETag-/Retry-Logik verwenden; nach drei
  Konflikten abbrechen und sichtbar melden.
- **Cloud-Diff enthält Schema-Bump aus Maildaten:** Änderung verwerfen und Live-
  Mutation über den vorgesehenen Firebase-Weg neu bewerten.

## Tests und Abnahme

1. Bestehende Node-Regressionssuite und statische Verifikation bleiben grün.
2. Neuer `cloud-session-check` wird mit gemocktem Firebase- und GitHub-HTTP
   getestet: Erfolg, GitHub-Warnung, Firebase-Fehler, fehlende optionale Felder
   und Datenschutz der Ausgabe.
3. Ein Dokumentations-Drifttest prüft mindestens:
   - dokumentierte und tatsächliche Schema-Version stimmen überein,
   - Gmail ist als aktiver Cloud-Provider dokumentiert,
   - aktuelle Testkommandos stehen in `AGENTS.md`,
   - die Quellen-der-Wahrheit-Regel und der Verweis auf das Runbook existieren.
4. Der Statuscheck wird einmal gegen den echten Firebase-Stand ausgeführt und
   muss den letzten erfolgreichen Gmail-Lauf ohne Credentials oder Mailkörper
   anzeigen.
5. Ein frischer Cloud-Task erhält nur das Repository und muss anhand des
   Runbooks erklären können, warum eine neue Campingantwort keinen Schema-Bump
   auslöst.
6. Keine App-, Firebase- oder Mailboxdaten werden durch die Kontextumstellung
   verändert.

## Rollout und Rückfall

Die Umsetzung verändert zunächst ausschließlich Dokumentation, Tests und das
rein lesende Statusskript. Sie braucht weder eine Schema-Migration noch einen
Firebase-Write. Nach lokaler Prüfung und CI wird sie auf `main` übernommen.

Falls der Statuscheck Probleme verursacht, kann er unabhängig entfernt werden;
App, GitHub-Mailrunner und Firebase bleiben unverändert. Die bestehenden Gmail-
Secrets verbleiben ausschließlich in GitHub Actions. Der iCloud-Adapter bleibt
als dokumentierter technischer Rückfall erhalten, wird aber nicht als aktueller
Primärweg dargestellt.
