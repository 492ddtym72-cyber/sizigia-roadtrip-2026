# Codex-Cloud-Runbook

Dieses Runbook ist der kurze, aktuelle Einstieg für eine neue Codex-Sitzung.
Es enthält keine Zugangsdaten und ersetzt weder `AGENTS.md` noch den Live-Stand
in Firebase.

## Start jeder neuen Sitzung

1. `AGENTS.md` und den aktuellen Teil von `HANDOFF.md` lesen.
2. `git status --short --branch` und `git log -5 --oneline` prüfen.
3. `node tools/cloud-session-check.mjs` ausführen.
4. Ohne lesbaren Firebase-Stand keine aktuellen Unterkunfts- oder Mailstatus
   behaupten und keine Live-Daten in Seeds oder Migrationen kopieren.
5. Vor Änderungen betroffene Tests lesen; danach die vollständige Verifikation
   aus `AGENTS.md` ausführen.

Der Statuscheck ist absichtlich rein lesend. Er zeigt nur technische Zeiten,
Zähler und Statuswerte – keine Firebase-URL, Zugangsdaten oder Mailtexte.

## Zwei getrennte Mailwege

### Automatisch: GitHub Actions

Der Workflow **Camping mail safety net** läuft tagsüber planmäßig und kann
manuell gestartet werden. Er nutzt Gmail, erkennt gesendete Anfragen,
klassifiziert passende Antworten konservativ, aktualisiert den zugehörigen
Firebase-Eintrag und darf ungesendete Gmail-Entwürfe erstellen. Er braucht
keinen eingeschalteten Laptop.

### Interaktiv: ChatGPT mit Gmail-Connector

Der Gmail-Connector in ChatGPT kann auf dem Telefon vollständige Threads
suchen, lesen und zusammenfassen. Diese Verbindung ist eine eigene
Autorisierung. Ein Codex-Cloud-Container erhält dadurch nicht automatisch
direkten Gmail-Zugriff. Ergebnisse werden nur dann in die App übernommen,
wenn die Sitzung den passenden Eintrag sicher zuordnen und Firebase lesen kann.

## Wenn sofort neue Mail geprüft werden muss

1. Auf dem Telefon ChatGPT mit dem Gmail-Plugin verwenden; oder
2. auf GitHub `Actions → Camping mail safety net → Run workflow` auslösen;
3. nach erfolgreichem Lauf den Cloud-Statuscheck erneut ausführen.

Ein manueller Workflow-Lauf ist die zuverlässigste laptopunabhängige Variante,
wenn der nächste Zeitplan zu spät wäre. Ein Mailentwurf allein gilt niemals als
gesendet.

## Aktionsgrenzen

| Aktion | Ohne neue Bestätigung erlaubt? | Hinweis |
| --- | --- | --- |
| Status und Mails lesen | Ja | Nur im angefragten Projektumfang |
| Antwort klassifizieren und Firebase aktualisieren | Ja | Nur bei sicherer Zuordnung; sonst Prüfung |
| Ungesendeten Entwurf erstellen | Ja | Name bleibt nach `Kind regards,` leer |
| Mail senden oder Formular absenden | Nein | Ausdrücklicher Auftrag in derselben Unterhaltung nötig |
| Reservierung oder Zahlung auslösen | Nein | Immer ausdrückliche Bestätigung nötig |
| Mail löschen, verschieben oder als gelesen markieren | Nein | Von der Automation nicht vorgesehen |
| Schema wegen einer neuen Antwort erhöhen | Nein | Live-Antworten gehören ausschließlich in Firebase |

Entwürfe verwenden normalen Klartext mit Absätzen. Sie werden nicht als
zitierter Block erzeugt. Ausgangslage sind sechs Erwachsene, ein Camper, ein
Kleinwagen und flexible Zeitfenster für genau eine Übernachtung. Fehlende
Fahrzeugdaten werden nicht erfunden.

## Fehlerdiagnose

### `gh` oder Git-Remote fehlt

Das verhindert nur GitHub-Befehle im aktuellen Container. Nicht aus Firebase
oder aus alten Seeds raten. Den öffentlichen Workflowstatus aus dem
Statuscheck verwenden oder den Workflow über die GitHub-Weboberfläche starten.

### Gmail-Connector fehlt

Die Repository-Konfiguration kann den persönlichen ChatGPT-Connector nicht
installieren oder freigeben. In ChatGPT die Gmail-Verbindung wählen oder den
GitHub-Actions-Weg verwenden. Niemals Passwörter oder OAuth-Tokens in den Chat
kopieren.

### Workflow ist verspätet oder läuft noch

In GitHub Actions Abschluss und Ergebnis prüfen. Nicht mehrfach schnell
hintereinander starten; der Workflow ist gegen Parallelbetrieb gesperrt. Erst
nach Abschluss den Statuscheck wiederholen.

### Firebase ist nicht lesbar

Keine aktuellen Mail-, Reservierungs- oder Unterkunftsstände behaupten und
nichts in `app.js` spiegeln. Netzwerk/URL/Berechtigung prüfen und den rein
lesenden Statuscheck erneut ausführen.

### Antwort ist mehrdeutig

Keine positive oder negative Verfügbarkeit ableiten. Der Eintrag bleibt zur
manuellen Prüfung sichtbar. Vollständigen Thread über den Gmail-Connector lesen
und nur den neuesten unzitierten Antwortteil bewerten.

### Eine Sitzung schlägt einen Schema-Bump für neue Mails vor

Abbrechen und die Änderung verwerfen. Eine neue Mail verändert Daten, nicht die
Datenstruktur. `SCHEMA_VERSION`, Defaults und Migrationen bleiben unverändert.

## Modellwahl in Codex Cloud

Das Repository kann das Modell einer Codex-Cloud-Sitzung nicht erzwingen.
Projektregeln, Tests und dieses Runbook sind deshalb die verlässlichen
Leitplanken. In Oberflächen mit einer Modellwahl kann bewusst das stärkere
verfügbare Modell gewählt werden; fehlende Modellwahl rechtfertigt keine
Abweichung von den Sicherheitsregeln.
