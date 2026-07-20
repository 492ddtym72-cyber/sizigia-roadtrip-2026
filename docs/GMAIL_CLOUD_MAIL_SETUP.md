# Gmail-Cloud-Mail-Assistent

> **Aktiver Stand (20.07.2026):** `MAIL_PROVIDER=gmail` und
> `MAIL_RUNNER_MODE=cloud` sind aktiv. Der zeitgesteuerte GitHub-Runner ist der
> laptopunabhängige Hintergrundweg. Der separat verbundene ChatGPT-Gmail-
> Connector dient vollständigen, interaktiven Mailanalysen und teilt seine
> Autorisierung nicht mit Codex-Cloud-Containern.

Die App und Firebase-Daten funktionieren unabhängig vom Mailanbieter weiter.
Der frühere iCloud-IMAP-/Apple-Mail-Weg bleibt nur als Rückfall dokumentiert.
Ohne `MAIL_RUNNER_MODE=shadow|cloud` läuft kein Cloud-Mail-Check.

## Sicherheitsmodell

- OAuth statt gespeichertem Google-Passwort oder App-Passwort.
- GitHub Secrets enthalten Client-ID, Client-Secret und Refresh-Token; nichts
  davon gehört in Commits, Issues, Logs oder Chats.
- Der Runner liest nur Metadaten der letzten 45 Tage. Nachrichtentext wird erst
  geladen, wenn Absender/Betreff zu einem bekannten Campingplatz passen oder
  eine mögliche Weiterleitung vorliegt.
- Der einzige Mailbox-Schreibzugriff ist das Erstellen eines **ungesendeten**
  Gmail-Entwurfs. Es gibt keinen Aufruf des Gmail-Sende-Endpunkts.
- Weitergeleitete Korrespondenz ändert den Campingstatus nicht automatisch,
  wenn sie nicht sicher zugeordnet werden kann; sie landet in der manuellen
  Prüfung.

## Einmalige Google-Einrichtung

1. In der Google Cloud Console ein eigenes Projekt für den Mail-Assistenten
   anlegen. Billing ist für diesen persönlichen Umfang nicht nötig.
2. Die **Gmail API** aktivieren.
3. Den OAuth-Zustimmungsbildschirm als externe, persönliche App konfigurieren.
   Für dauerhaftes Offline-OAuth darf das Projekt nicht im Status „Testing“
   bleiben, weil Test-Refresh-Tokens nach sieben Tagen ablaufen. Für eine
   persönliche App mit weniger als 100 Nutzern ist keine Veröffentlichung an
   fremde Nutzer nötig; Google kann beim einmaligen Login einen Hinweis auf
   eine nicht verifizierte App zeigen.
4. Einen OAuth-Client vom Typ **Desktop-App** erstellen.
5. Einmal mit dem vorgesehenen Gmail-Konto zustimmen. Angefordert werden nur:
   - `gmail.readonly` für Inbox/Sent-Erkennung
   - `gmail.compose` zum Erstellen ungesendeter Entwürfe

## GitHub-Konfiguration

Unter **Settings → Secrets and variables → Actions**:

Secrets:

- `GMAIL_EMAIL`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`

Variables (aktueller Produktionsstand):

- `MAIL_PROVIDER=gmail`
- `MAIL_RUNNER_MODE=cloud`

Bei einer Neueinrichtung zuerst `MAIL_RUNNER_MODE=shadow` verwenden. `shadow`
liest und klassifiziert, erstellt aber keine Entwürfe und ändert keine
fachlichen Campingstatus. Erst nach erfolgreichem Shadow-Test auf `cloud`
wechseln.

## Rückfall

Bei Problemen `MAIL_RUNNER_MODE=disabled` setzen und in Firebase/über die
Bridge den Modus auf `local` zurückstellen. Die App nutzt dann wieder Apple
Mail auf dem Gerät. `MAIL_PROVIDER=icloud` reaktiviert den bisherigen
iCloud-Adapter, sofern dessen Secrets gültig sind.
