# HANDOFF — Aktueller Stand & nächste Schritte

> Für jeden Agenten (Claude, Codex, …), der hier weitermacht.
> Projektüberblick, Architektur und Konventionen: siehe [AGENTS.md](AGENTS.md).
> Stand: 08.07.2026.

## Was fertig ist ✅

- Die App (`index.html`) ist komplett und live gehostet:
  **https://492ddtym72-cyber.github.io/sizigia-roadtrip-2026/**
  (GitHub Pages, Repo `492ddtym72-cyber/sizigia-roadtrip-2026`, Branch `main`,
  `gh` CLI ist auf dieser Maschine authentifiziert. `git push` deployt
  automatisch in ~1 Min.)
- Cloud-Sync-Engine ist **fertig implementiert und getestet** (siehe
  AGENTS.md → Cloud-Sync). Es fehlt NUR der Wert der Konstante `CLOUD_URL`
  oben im `<script>` von `index.html` (aktuell `null` = Lokal-Modus).

## Offene Aufgabe: Firebase-Datenbank anlegen & verdrahten 🔧

**Ziel:** Alle 6 Nutzer sehen denselben Live-Stand über eine Firebase
Realtime Database (kostenloser Spark-Plan, REST ohne SDK).

### Bereits passiert

- Firebase CLI ist installiert: `export PATH="/Users/anonymous/.hermes/node/bin:$PATH"`
  (nötig in jeder Shell, sonst `firebase: command not found`).
- `firebase login` ist erledigt (Google-Konto von Freddi — prüfen mit
  `firebase login:list`).
- `firebase projects:create sizigia-2026-fc573b` hat das GCP-Projekt angelegt,
  aber **`addFirebase` schlug mit 403 PERMISSION_DENIED fehl**, weil das Konto
  die Firebase-Nutzungsbedingungen noch nicht akzeptiert hatte.
- Der Nutzer wurde gebeten, unter https://console.firebase.google.com selbst
  ein Projekt zu erstellen (dieser Flow akzeptiert die ToS). Eventuell ist das
  inzwischen geschehen → einfach prüfen.

### Nächste Schritte (in dieser Reihenfolge)

```bash
export PATH="/Users/anonymous/.hermes/node/bin:$PATH"
cd /Users/anonymous/Desktop/Roadtrip

# 1. Gibt es inzwischen ein Firebase-Projekt? (Nutzer sollte eines anlegen)
firebase projects:list
# Falls "No projects found": Nutzer bitten, in der Firebase-Konsole
# "Projekt erstellen" durchzuklicken (ToS-Häkchen!), dann erneut prüfen.
# Alternativ klappt danach evtl. auch:
#   firebase projects:addfirebase sizigia-2026-fc573b

# 2. Realtime Database anlegen (PROJECT_ID aus Schritt 1 einsetzen)
firebase database:instances:create PROJECT_ID-default-rtdb \
  --location europe-west1 --project PROJECT_ID
# Falls der Befehl zickt: Nutzer kann die DB auch in der Konsole anlegen
# (Erstellen → Realtime Database → Standort Belgien). Instanz-URL danach:
firebase database:instances:list --project PROJECT_ID

# 3. Sicherheitsregeln deployen (Dateien liegen schon im Repo: firebase.json
#    + database.rules.json — nur Root darf NICHT gelesen werden, geheimer
#    Pfad unter /planner/* ist frei lesbar/schreibbar)
firebase deploy --only database --project PROJECT_ID

# 4. Geheimen Pfad erzeugen und URL bauen
SECRET=$(openssl rand -hex 12)
CLOUD_URL="https://INSTANZNAME.europe-west1.firebasedatabase.app/planner/${SECRET}.json"

# 5. Funktionstest per REST
curl -s -X PUT -d '{"test":1}' "$CLOUD_URL"   # → {"test":1}
curl -s "$CLOUD_URL"                          # → {"test":1}
curl -s -X PUT -d 'null' "$CLOUD_URL"         # wieder leeren!
# Wichtig: Root darf 401/Permission denied liefern:
curl -s "https://INSTANZNAME.europe-west1.firebasedatabase.app/.json"

# 6. In index.html eintragen: `let CLOUD_URL = null;` ersetzen durch
#    `let CLOUD_URL = 'https://…/planner/<SECRET>.json';`
#    (Kommentar darüber stehen lassen.)

# 7. Committen & pushen (deployt automatisch), dann live verifizieren:
git add -A && git commit -m "Enable cloud sync" && git push
# ~60 s warten, dann:
curl -s https://492ddtym72-cyber.github.io/sizigia-roadtrip-2026/ | grep -o "planner/[a-f0-9]*\.json"

# 8. End-to-End-Check: Live-Seite im Browser öffnen (oder Nutzer bitten),
#    etwas abhaken → danach muss `curl -s "$CLOUD_URL" | head -c 200`
#    den State enthalten (meta.lastSaved etc.).
```

### Danach dem Nutzer mitteilen

- Link an alle 6 schicken; jede:r wählt beim ersten Öffnen „Wer bist du?".
- Änderungen syncen automatisch (Badge „☁️ synchron mit der Gruppe" oben).
- Aufräumen (optional): verwaistes GCP-Projekt `sizigia-2026-fc573b` kann in
  der Google-Cloud-Konsole gelöscht werden, falls ein anderes Projekt genutzt
  wird.

## Bekannte Stolperfallen

- `firebase login` verweigert sich ohne TTY → über `expect` starten
  (Muster siehe Git-Historie / einfach interaktives Terminal nutzen).
- Der Sync ist Last-write-wins pro Gesamt-State; `save()` erzeugt monotone
  Zeitstempel — NICHT durch `new Date()` pur ersetzen (Uhren-Schiefstand!).
- `CLOUD_URL` steht bewusst im öffentlichen HTML (geheimer Pfad = Schutz durch
  Nicht-Auffindbarkeit; Root-Zugriff ist per Regeln gesperrt). Snapshots +
  Export-Backups sind die Absicherung gegen Vandalismus/Versehen.

## Offene Wünsche des Nutzers (Backlog)

- Echte Festival-Daten (genauer Ort, Ticketstatus, Einlasszeit) eintragen,
  sobald der Nutzer sie liefert (Festival-Tab, Platzhalter „eintragen").
- Rückreise-Etappen anpassen, wenn das echte Enddatum feststeht
  (aktuell Vorschlag 14.–17.08.).
