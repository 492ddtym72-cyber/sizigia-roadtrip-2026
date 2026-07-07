# Home Dashboard Navigation Design

## Goal

Replace the compact top navigation as the primary entry point with a high-quality
home dashboard on `Übersicht`: a large route-focused hero plus recognizable
section tiles. Users should land on this screen after choosing “Wer bist du?”,
then enter sections from large touch targets. Subpages should provide a small,
convenient `Zur Übersicht` control.

## Approved Direction

Use refined **Direction B · Dashboard Start** from the visual companion:

- A premium route hero is the first and largest home action.
- Secondary sections appear as compact professional icon tiles.
- The design uses fewer emoji in the home navigation and more deliberate inline
  icon artwork.
- Goa/Psytrance influence appears only as elegant accents, such as a low-opacity
  mandala/corona detail in the route hero.
- The page should feel polished, calm, and practical, not like a loud festival
  poster.

## Navigation Behavior

The implementation must keep the existing navigation contract:

- `TABS` IDs remain unchanged.
- `switchTab(id)` remains the only section switching path.
- The home dashboard lives in the existing `uebersicht` page.
- Each home tile calls `switchTab('<existing-id>')`.
- Every non-home section gets a small `Zur Übersicht` / back control that calls
  `switchTab('uebersicht')`.
- `sessionStorage` tab persistence may continue to work as today.

No data model, persistence, Cloud Sync, backup/import, budget, route, or undo
logic should change for this feature.

## Visual System

Home dashboard:

- Header and save/sync status remain as currently implemented.
- The old nav row should stop being the main visual entry point. It can be
  hidden, reduced, or replaced by the home dashboard plus subpage back control,
  as long as all sections remain reachable.
- Route hero should show an image-like route scene related to the actual trip:
  Munich/Innsbruck toward Huesca, road line, land/sea/sky mood, eclipse hint.
- Secondary tiles:
  - `Stopps`
  - `Fahrzeuge`
  - `Packen`
  - `Einkaufen`
  - `Ausgaben`
  - `Festival`
  - `Aktivität`
- Use compact titles and short supporting labels where helpful.
- Keep touch targets large enough for phone use.

## Artwork Constraint

The project must remain a single offline `index.html` with no external requests.
Artwork options are allowed only if they preserve that constraint:

- Preferred implementation: compact inline SVG/CSS artwork for the route hero
  and icons.
- Optional implementation: generated bitmap artwork may be used only if it is
  embedded directly in `index.html` as a data URI and kept reasonably small.
- Do not add external image files, CDNs, font requests, or runtime network
  dependencies.

## Back Control

Each subpage should include a small, consistent back control near the top:

- Label: `Zur Übersicht`
- Icon: simple left arrow or chevron
- Action: `switchTab('uebersicht')`
- It should not duplicate heavy navigation chrome or crowd the content.

## Verification

Manual/browser checks required before publishing:

- First visit flow still asks `Wer bist du?`; after selection, `Übersicht`
  shows the new home dashboard.
- Every dashboard tile opens the correct existing section.
- Each section back control returns to `Übersicht`.
- Existing section functionality still works for at least:
  - route tab render,
  - checklist/item toggle,
  - expense tab render,
  - Datensicherung card render.
- Cloud sync and local-only backup safety behavior are unchanged.
- Check mobile (~390 px) and desktop (~1540 px) layouts.
- Browser console has no relevant warnings or errors.
- Public GitHub Pages deployment must be verified after push.
