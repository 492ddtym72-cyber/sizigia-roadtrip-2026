# Kostenloser iCloud-Mail-Runner

> Der empfohlene cloud-native Weg ist inzwischen Gmail mit OAuth. Siehe
> [GMAIL_CLOUD_MAIL_SETUP.md](GMAIL_CLOUD_MAIL_SETUP.md). Diese Datei bleibt als
> Dokumentation und Rückfallweg für den iCloud-Adapter erhalten.

Der Cloud-Runner ist nach dem Deployment vollständig deaktiviert. Ohne die
Repository-Variable `MAIL_RUNNER_MODE=shadow|cloud` wird weder auf iCloud noch
auf Firebase zugegriffen.

## Voraussetzungen

- GitHub-Repository bleibt öffentlich (Standard-Actions sind dadurch kostenlos).
- Firebase bleibt im kostenlosen Spark-Tarif.
- Niemals Apple-, ChatGPT- oder iCloud-Passwörter in Issues, Commits oder Chats
  einfügen.

## 1. iCloud-App-Passwort

1. `account.apple.com` öffnen.
2. **Anmeldung und Sicherheit → App-spezifische Passwörter** wählen.
3. Ein Passwort mit dem Namen `Sizigia Mail Runner` erzeugen.
4. Das Passwort ausschließlich im nächsten Schritt einfügen.

## 2. Verschlüsselte GitHub-Secrets

Repository → **Settings → Secrets and variables → Actions → Secrets**:

- `ICLOUD_EMAIL`: vollständige iCloud-Mailadresse
- `ICLOUD_APP_PASSWORD`: das neue App-spezifische Passwort

Die Werte werden nicht als Repository-Dateien oder Workflow-Artefakte gespeichert.

## 3. Shadow-Test

Unter **Variables** die Repository-Variable `MAIL_RUNNER_MODE` auf `shadow`
setzen. Danach unter **Actions → Camping mail safety net → Run workflow** einen
manuellen Lauf starten.

Shadow-Modus liest nur passende Camping-Mails, erzeugt keine Entwürfe, ändert
keine Campingplatz-Status und lässt die lokale Mac-Automation maßgeblich.
Gespeichert werden nur Message-ID-Hash, Kandidaten-ID und vorhergesagter Status.

Mindestens 48 Stunden und mehrere echte Antworten vergleichen. Bei Fehlern die
Variable löschen; die lokale Automation läuft unverändert weiter.

## 4. Cloud-Aktivierung

Erst nach erfolgreichem Shadow-Test:

1. `MAIL_RUNNER_MODE` auf `cloud` setzen.
2. Workflow manuell starten.
3. In der App prüfen, dass **Mail-Assistent · Cloud** und ein frischer Check
   erscheinen.
4. Einen ungefährlichen Test-Entwurf anfordern und auf dem iPhone kontrollieren.
5. Den Test manuell senden und genau eine Statusänderung prüfen.
6. Danach die lokale Codex-Automation deaktivieren; sie bleibt als Fallback
   konfiguriert.

## Sofortiger Rückweg zum Mac

1. GitHub-Variable `MAIL_RUNNER_MODE` löschen.
2. Auf dem Mac ausführen:
   `node tools/camping-mail-bridge.mjs set-mode local`
3. Lokale Codex-Automation **Camping-Mail-Assistent** aktivieren.
4. In der App **Mail-Assistent · Mac** kontrollieren.

## Sicherheitsregeln

- Der Runner sendet niemals E-Mails.
- Inbox und Sent werden read-only geöffnet.
- Nur beim Erstellen eines neuen Entwurfs wird per IMAP `APPEND` in Drafts
  geschrieben.
- Kein vollständiger Mailtext und kein Anhang wird in Firebase gespeichert.
- Unklare und vermeintlich bestätigte Buchungen müssen manuell geprüft werden.
- Das App-Passwort kann jederzeit bei Apple widerrufen werden.
