# HANDOFF — Status

> Stand: 16.07.2026 · `main` ist der stabile Live-Stand.
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
- **Neutrale Startseite & Aufgaben (Schema V15):** Die App heißt außerhalb des
  Festivalbereichs neutral „Roadtrip“. Die Startseite bleibt bewusst ruhig:
  eine bestehende Routenkarte zeigt nur die tatsächliche nächste Etappe und den
  Countdown; Mail-Diagnostik, Camper-Hinweise, leere Unterkunftsmeldungen und
  ein zweites Cockpit werden dort nicht dargestellt. Aufgaben kennen weiterhin
  nun Status (`offen`, `wartet`, `Entscheidung`, `erledigt`), verantwortliche
  Person, Fälligkeitsdatum und Notiz. Alte Erinnerungen werden verlustfrei
  migriert; Erledigen und Wiederöffnen erhält den vorherigen Status. V15 ersetzt
  nur den früheren Standardtitel „Sizigia 2026“; individuell benannte Reisen
  bleiben unverändert. Das Festival selbst bleibt Sizigia-spezifisch.
  Produktleitplanken und die nächsten wiederverwendbaren Ausbaustufen stehen
  in `docs/specs/product-direction.md`.
- **Schlafplatz-Radar (Camping-Grundlage bis V13):** Dauerhaftes Campingplatz-Register
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
  V16 ergänzt als erste allgemeine Unterkunft den privaten Stellplatz in Les
  Salces bei Jakobs Verwandten: nutzbar für ein bis zwei Nächte, auf der Karte,
  aber ausdrücklich weder gebucht noch mit einer E-Mail-Aktion versehen.
  V17 macht aus den starren „Nächten“ ruhige Reiseabschnitte und unterstützt
  erstmals ein explizites Abreisedatum pro Angebot. Dadurch bleibt Laspaúles'
  Zwei-Nächte-Angebot 09.–11.08. auch in späteren Reservierungsentwürfen exakt
  erhalten. Die Antworten vom 15.07. sind eingeordnet: Mas de Mourgues (76 €,
  Buchung über Website) und Val de Cesse (ca. 90 €, Auto außerhalb) sind
  nutzbar, La Tamarissière ist wegen drei Nächten Mindestaufenthalt ausgeschlossen,
  Laspaúles bleibt als Zwei-Nächte-Alternative verfügbar. Keine Unterkunft ist
  dadurch als gebucht markiert. Fünf bereits ausgewertete Mail-Prüffälle werden
  dabei aus der offenen Prüfliste entfernt: Restanques ist eine konkrete
  Website-Option für 66,16 € (Strom optional), Wecamp Cadaqués verweist ohne
  konkrete Zusage auf die Website; Alquézar, Mare Monti und Youcamp behalten
  ihre vorsichtigen bestehenden Einstufungen.
  V18 ergänzt drei offiziell geprüfte Küstenstopps als zusammenhängende Folge:
  Camping Roma (Albenga, 03.–04.08.), Camping Agay Soleil (04.–05.08.) und
  Camping Santa Gusta (La Ciotat, 05.–06.08.). Platzspezifische Wunschnächte
  ändern nur den Text der jeweiligen Anfrage, nicht das flexible Fenster des
  gesamten Reiseabschnitts. Santa Gusta veröffentlicht aktuell keine E-Mail;
  die App unterstützt deshalb ein zustandsloses Kontaktformular: Text kopieren
  und Formular öffnen ändern den Status nicht, erst die manuelle
  Versandbestätigung setzt „Angefragt“. Park4night dient nur zur Entdeckung;
  Kontakt- und Regelangaben stammen aus offiziellen Platzseiten.
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
  zweite Erstanfrage an, und gesunde Mail-Diagnostik bleibt ausgeblendet. Eine
  akzentunabhängige Routensuche findet Campingplätze über Name, Ort, Status und
  Antworttext. Der zuletzt gewählte Reiseabschnitt bleibt nur auf dem Gerät
  gespeichert und wird im horizontalen Nachtwähler automatisch sichtbar
  gehalten.
  Die Schlafplatz-Kartenansicht hat nun zwei Ebenen: „Detailkarte online“ nutzt
  lokal vendortes MapLibre GL JS mit OpenFreeMap-Vektorkarten und erlaubt
  scharfes Zoomen bis auf Straßenebene; „Offlinekarte“ bleibt die bisherige,
  vollständig eingebettete Europakarte. Nur operative Campingplätze mit
  gespeicherten Koordinaten werden als Statuspunkte gezeichnet. Der
  Kartenwechsel ist rein lokal und verändert keine Reise- oder Firebase-Daten.
  Ohne Netz, ohne Kartenbibliothek oder wenn der Stil nicht binnen 12 Sekunden
  lädt, schaltet die App automatisch auf die Offlinekarte. MapLibre-Dateien und
  Lizenz liegen unter `vendor/` und werden vom Service Worker mitgecached;
  OpenFreeMap selbst ist ein kostenfreier Dienst ohne SLA, deshalb darf der
  Fallback nicht entfernt werden.
  Die Detailkarte besitzt zusätzlich eine lokale Frankreich-ZFE-Ebene mit
  amtlichen, am 16.07.2026 geprüften Grenzen für Nice, Marseille, Nîmes und
  Montpellier. Marseille und Montpellier zeigen amtliche Transitachsen grün
  gestrichelt; bei Nîmes wird bewusst nur die exakte Stadt-/ZFE-Grenze plus
  amtliche Ausnahmeliste gezeigt, weil keine gleichwertige offizielle
  Liniengeometrie vorliegt. Französische Campingplatz-Karten kennzeichnen den
  gespeicherten Zielpunkt als innerhalb, nahe oder außerhalb einer Dauer-ZFE;
  die UI erklärt ausdrücklich, dass dies nicht jede Navigationsroute freigibt.
  Keiner der aktuell gespeicherten französischen Campingplatz-Punkte liegt in
  einer beschränkten Dauer-ZFE. Nice wird separat behandelt: leichte Fahrzeuge
  sind aktuell nicht vom Fahrverbot betroffen, die Stadtseite nennt die
  Plakette im Gebiet aber weiterhin verpflichtend; die App gibt daher keine
  pauschale Einfahrtsfreigabe. Temporäre Luftverschmutzungsmaßnahmen bleiben
  ein Live-Check. Herkunft, Grenzen und Aktualisierung stehen in
  `docs/specs/france-zfe-overlay.md`; `zfe-data.js` wird reproduzierbar mit
  `tools/build-zfe-data.mjs` erzeugt.
- **Camping-Mail-Assistent:** Lokale Codex-Automation prüft tagsüber um ca.
  08:00, 14:00 und 20:00 ausschließlich campingbezogene Antworten in iCloud
  Inbox/Sent. `tools/camping-mail-bridge.mjs` liefert konfliktgeschützte
  Firebase-Updates (ETag), Message-ID-Deduplizierung und blanko signierte
  Entwurfstexte. Die Automation erstellt höchstens ungesendete Reply-Entwürfe,
  versendet nie und verändert keine Mailbox-Nachrichten. „Antwort vorbereiten“
  zeigt zunächst nur eine zustandslose Vorschau; erst „In Apple Mail öffnen“
  legt einen Send-Intent an. Der fachliche Status ändert sich ausschließlich
  nach Sent-Mail-Erkennung oder manueller Versandbestätigung. Lokal erzeugte
  Apple-Mail-Entwürfe werden temporär im Plain-Text-Modus angelegt und stellen
  die persönliche Mail-Einstellung danach wieder her; dadurch erscheint der
  Nachrichtentext nicht als violette Zitat-Ebene.
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
  `styles.css`, `map-data.js` und `app.js` getrennt; die optionale
  Detailkarten-Bibliothek liegt statisch unter `vendor/`. V8 ergänzt lokale/cloud
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
