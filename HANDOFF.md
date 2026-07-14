# HANDOFF — Status

> Stand: 14.07.2026 · `main` ist der stabile Live-Stand.
> Projektüberblick & Konventionen: [AGENTS.md](AGENTS.md).

## Aktueller Zustand ✅

- **Live-App:** https://492ddtym72-cyber.github.io/sizigia-roadtrip-2026/
  (GitHub Pages, Repo `492ddtym72-cyber/sizigia-roadtrip-2026`, `git push`
  auf `main` deployt automatisch; `gh` CLI ist authentifiziert.)
- **Laptop-unabhängig:** Die öffentliche App wird von GitHub Pages gehostet
  und läuft weiter, auch wenn dieses MacBook aus ist. Künftige KI-Agenten
  können das Repo direkt auf GitHub ändern; nach einem Push auf `main` ist die
  Änderung für alle sichtbar. Für geteilte App-Daten nutzt die Live-App
  Firebase Realtime Database, nicht den lokalen Rechner.
- **Cloud-Sync aktiv:** `CLOUD_URL` in `app.js` zeigt auf die Firebase
  Realtime Database des Projekts `roadtrip-to-sizigia-eclipse`
  (Instanz `roadtrip-to-sizigia-eclipse-default-rtdb`, Region us-central1,
  geheimer Pfad unter `/planner/…`). Regeln: Root gesperrt, nur der geheime
  Pfad ist lesbar/schreibbar (`database.rules.json`, deployt).
- Firebase CLI: `export PATH="/Users/anonymous/.hermes/node/bin:$PATH"`,
  eingeloggt mit Freddis Google-Konto (`firebase login:list`).
  Regeln neu deployen: `firebase deploy --only database --project roadtrip-to-sizigia-eclipse`
- **Schlafplatz-Radar (Schema V13 live):** Dauerhaftes Campingplatz-Register
  (`sleepPlaces`) plus datumsbezogene Anfragen in den Nacht-Suchen. Positionen
  werden einmalig per Karten-Picker oder koordinatenhaltigem Maps-Link erfasst;
  die Offline-Karte zeigt Statusfarben wahlweise pro Nacht oder für die gesamte
  Route. Dazu Plan-B-Status, E-Mail-/Anruf-Aktionen und Verknüpfung zu
  Erinnerungen. Die frühere, unvollständige „Camping-Kontakte“-Liste ist nur
  noch ein unsichtbares Legacy-Archiv; ihre fehlenden Telefon-, Karten- und
  Notizangaben werden verlustfrei in den Schlafplatz-Radar übernommen. Die
  Migration übernimmt bestehende Camping-Erinnerungen in „Erste Nacht“ und
  ergänzt die zuletzt ausgewerteten Antworten (Belvedere, Al Sole, Al Lago,
  Punta Lago, Schlosshof).
  V9 archiviert die 46 redundanten Camping-Erinnerungen, ergänzt den Status
  „Reservierung möglich“ und sieben flexible Korridor-Suchen mit je vier
  recherchierten Optionen. Nicht abschließend verifizierte Kontaktadressen
  bleiben im UI gesperrt, bis sie über „Bearbeiten“ bestätigt wurden. V10
  übernimmt die offizielle Kontaktprüfung vom 12.07.2026: korrigierte Websites,
  E-Mails, Telefone und die Position von Mare Monti werden verlustfrei auf die
  bestehenden Einträge migriert. „Camping Río Ara“ wird, solange unkontaktiert,
  durch „Camping Ribera del Ara“ ersetzt. La Chapelle und Ribera del Ara haben
  keine verifizierte offizielle E-Mail und bleiben für E-Mail-Entwürfe gesperrt.
  V11 trennt die geplante Nacht von einem flexiblen Anreisefenster. Die
  mittleren Routenkorridore fragen nun nach genau einer Nacht an einem
  beliebigen verfügbaren Anreisetag innerhalb eines realistischen
  Zwei-Tage-Fensters. Ein platzspezifisches `offeredArrivalDate` verhindert,
  dass eine spätere Reservierungsantwort ohne konkretes Datum formuliert wird.
  V12 ergänzt den Crit’Air-freien Frankreich-Korridor um Camargue und zwölf
  neue Optionen. Sechs bevorzugte Kontakte wurden am 14.07.2026 auf ihren
  offiziellen Websites geprüft und sind für Entwürfe freigeschaltet. Les
  Restanques ist für 4./5.08. reservierbar; Youcamp hat am 5./6.08. Platz,
  verlangt für sechs Erwachsene aber zwei Stellplätze. Dafür gibt es eine
  eigene, bis zur eingetragenen Camperlänge gesperrte Antwortvorlage. Esterel
  ist abgesagt, Lago Levico bleibt als spontane Vor-Ort-Option erhalten. Die
  vier Cassis-Anfragen (Les Cigales, Aux Portes de Cassis, Youcamp, La Sauge)
  sind als tatsächlich gesendet markiert.
  V13 ergänzt ohne Überschreiben bestehender Daten fünf weitere geprüfte
  Routenoptionen: Camping Verona Village für die erste Nacht, Camping La
  Tamarissière für 6./7.08., Camping Maçanet de Cabrenys für 8./9.08. sowie
  wecamp Pirineos und Camping Laspaúles für 9.–10.08. Alle besitzen
  Kartenpositionen und verifizierte E-Mail-Adressen. Für jeden Platz liegt ein
  normal formatierter, ungesendeter iCloud-Entwurf mit leerer Signatur bereit;
  die fachlichen Status bleiben bis zum tatsächlichen Versand unverändert.
  Die mobile Ansicht ist bewusst entscheidungsorientiert: „Nutzbar“, „Kontakt“
  und „Absagen“ zeigen Zähler; Karten besitzen nur eine primäre Aktion und
  ruhige Links für Website, Karte und Details. Echte Antwortkästen erscheinen
  nur bei tatsächlichem Antwortinhalt. Bereits gesendete Anfragen bieten keine
  zweite Erstanfrage an, und gesunde Mail-Diagnostik bleibt ausgeblendet.
- **Camping-Mail-Assistent:** Lokale Codex-Automation prüft tagsüber um ca.
  08:00, 14:00 und 20:00 ausschließlich campingbezogene Antworten in iCloud
  Inbox/Sent. `tools/camping-mail-bridge.mjs` liefert konfliktgeschützte
  Firebase-Updates (ETag), Message-ID-Deduplizierung und blanko signierte
  Entwurfstexte. Die Automation erstellt höchstens ungesendete Reply-Entwürfe,
  versendet nie und verändert keine Mailbox-Nachrichten. „Antwort vorbereiten“
  zeigt zunächst nur eine zustandslose Vorschau; erst „In Apple Mail öffnen“
  legt einen Send-Intent an. Der fachliche Status ändert sich ausschließlich
  nach Sent-Mail-Erkennung oder manueller Versandbestätigung.
  Der Runner bleibt standardmäßig deaktiviert. Die Auswertung entfernt jetzt
  auch französische, spanische und italienische Zitatverläufe, versteht
  zentrale französische/spanische Statusformulierungen und verlangt immer
  einen passenden Absender. Doppelte Message-IDs werden beim Retry ignoriert;
  verifizierte Kontaktdaten können nicht mehr aus Mail-Events überschrieben
  werden. IMAP-Entwürfe verwenden eine deterministische Message-ID pro
  Entwurfsanfrage, damit auch ein Abbruch zwischen iCloud-Append und
  Firebase-Update keinen zweiten Entwurf erzeugt. Der GitHub-Workflow läuft
  bei Aktivierung um 06:00, 12:00 und 18:00 UTC (im Sommer ungefähr 08:00,
  14:00 und 20:00 MESZ). App, Bridge und Cloud-Runner schreiben Firebase
  konfliktgeschützt mit ETags.
  `tools/create-apple-mail-draft.mjs` erstellt für eine registrierte Anfrage
  einen lokalen Apple-Mail-Entwurf und markiert ihn erst nach erfolgreichem
  Speichern als „bereit“. Exakte Ein-Nacht-Anfragen nennen kein
  irreführendes flexibles Fenster; flexible Korridore bleiben als Auswahl
  mehrerer möglicher Anreisetage formuliert.
- **App-Struktur:** Die Web-App ist ohne Build-Schritt in `index.html`,
  `styles.css`, `map-data.js` und `app.js` getrennt. V8 ergänzt lokale/cloud
  Runner-Gesundheit und eine begrenzte manuelle Prüfwarteschlange. Der
  GitHub-iCloud-Runner liegt unter `cloud-mail/` und ist ohne die Repository-
  Variable `MAIL_RUNNER_MODE=shadow|cloud` vollständig deaktiviert. Keine
  iCloud-Secrets sind eingerichtet; der lokale Mac-Runner bleibt maßgeblich.

## Beim Sync gelernt (nicht kaputt machen!)

- **Firebase löscht leere Arrays/Objekte** beim Speichern → `migrate()`
  normalisiert alle Pflicht-Container (`votes`, `items`, `log`, …). Bei neuen
  Array-Feldern im Schema: dort ergänzen.
- **Frische Geräte** (`_virgin`-Flag): Beim ersten Sync gewinnt immer der
  Cloud-Stand, sonst überschreiben Default-Daten die Gruppendaten.
- `save()` erzeugt **monoton steigende Zeitstempel** (Schutz vor
  Uhren-Schiefstand bei Last-write-wins) — nicht vereinfachen.

## Aufräum-Hinweis (optional)

- Verwaistes GCP-Projekt `sizigia-2026-fc573b` (ohne Firebase) kann in der
  Google-Cloud-Konsole gelöscht werden.

## Backlog (Wünsche des Nutzers)

- Echte Festival-Daten eintragen (genauer Ort, Ticketstatus, Einlasszeit),
  sobald der Nutzer sie liefert — Festival-Tab, Platzhalter „eintragen".
- Rückreise-Etappen anpassen, wenn das echte Enddatum feststeht
  (aktuell Vorschlag 14.–17.08.).
