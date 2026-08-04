# Roadtrip game integration

This branch deliberately keeps the game independent from the Home/UI, passcode gate, expense data, Firebase and Tricount sync.

## Files

- `roadtrip-game.js` — self-contained endless Flappy-style game engine.
- `roadtrip-game.css` — fullscreen game UI and leaderboard styling.
- Existing generated raster artwork is reused from `assets/home-roadtrip-sunset.webp`, `assets/home-crew-campfire.webp`, and `assets/home-settings-van.webp`. The game cross-fades between these images as the score rises while Canvas animates the bird, gates, particles and camera effects at frame rate.

No shared application file is modified by this branch.

## Minimal integration

The Home/UI workstream should add the script after the app is unlocked and available:

```html
<script src="./roadtrip-game.js"></script>
```

`roadtrip-game.js` loads `roadtrip-game.css` itself. A Game-section button can then call:

```js
window.openRoadtripGame({
  player: { id: currentCrewId, name: currentCrewName }
});
```

The game has no target-score cap. It runs until collision. Difficulty approaches a bounded maximum so long runs stay playable rather than becoming mathematically impossible.

## Leaderboard

By default the module stores personal bests in `localStorage` under `roadtrip-game-leaderboard-v1`. This gives immediate per-player personal-best behavior without changing the app data schema.

For a shared group leaderboard, the integration layer can supply an adapter without changing the game engine:

```js
window.RoadtripGame.setLeaderboardAdapter({
  async load() {
    // Return [{ playerId, name, best }, ...]
  },
  async submit({ playerId, name, score }) {
    // Persist only when score beats that player's current best.
    // Return the updated [{ playerId, name, best }, ...] leaderboard.
  }
});
```

This is intentionally the only persistence seam. The game module never imports or writes Firebase itself.

## End-of-run behavior

There is no longer any `ACCESS GRANTED` or unlock animation. On collision:

- a new high score gets a `NEW PERSONAL BEST` burst;
- the run result appears;
- the leaderboard is ranked by personal best;
- the player can retry immediately or return to the app.

Every 10 points during play triggers a lightweight `FLOW` milestone surge with particles and a color flash, but gameplay continues indefinitely.

## Events

The root dispatches:

- `roadtripgameopen`
- `roadtripgameclose`

These can be used by the Home/UI layer if it needs to pause other interface behavior while the fullscreen game is active.
