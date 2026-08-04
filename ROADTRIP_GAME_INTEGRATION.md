# Roadtrip game integration

This branch deliberately keeps the game independent from the Home/UI, passcode gate, expense data, Firebase and Tricount sync.

## Files

- `roadtrip-game.js` — self-contained endless Flappy-style game engine.
- `roadtrip-game.css` — fullscreen game UI and leaderboard styling.
- Existing generated raster artwork is reused from `assets/home-roadtrip-sunset.webp`, `assets/home-crew-campfire.webp`, and `assets/home-settings-van.webp` as animated background plates.

No shared application file is modified by this branch.

## Minimal integration

The Home/UI workstream should add:

```html
<script src="./roadtrip-game.js"></script>
```

`roadtrip-game.js` loads `roadtrip-game.css` itself.

Then start the game with the current player and the full crew:

```js
window.openRoadtripGame({
  player: { id: currentCrewId, name: currentCrewName },
  crew: state.crew.map(person => ({ id: person.id, name: person.name }))
});
```

Passing `crew` means the result screen always contains every group member, even before a member has recorded a score. Members without a best score appear with `0` until the shared adapter returns their actual best.

The game has no target-score cap. It runs until collision. Difficulty approaches a bounded maximum so long runs stay difficult but playable.

## Generated sprite artwork

The renderer has optional raster sprite hooks. Once the approved generated bird/pillar assets are placed anywhere in the final UI branch, pass them without changing the engine:

```js
window.openRoadtripGame({
  player: { id: currentCrewId, name: currentCrewName },
  crew: state.crew,
  birdSprite: './game-assets/psy-bird.png',
  pipeSprite: './game-assets/psy-pillar.png'
});
```

If those URLs are omitted or fail to load, the game falls back to its built-in psychedelic Canvas bird and patterned pillars, so gameplay never breaks because an art asset is missing.

Custom generated background plates can also be supplied:

```js
backgrounds: [
  './game-assets/landscape-1.webp',
  './game-assets/landscape-2.webp',
  './game-assets/landscape-3.webp'
]
```

Canvas continues to handle movement, rotation, collision, particles, flashes and cross-fades at frame rate; raster images are only composited as sprites/background layers.

## Leaderboard

By default the module stores personal bests locally under `roadtrip-game-leaderboard-v2`. This is only a safe fallback for development/offline use.

For the real shared crew leaderboard, the integration layer should supply one adapter:

```js
window.RoadtripGame.setLeaderboardAdapter({
  async load() {
    // Return [{ playerId, name, best }, ...] for all known group scores.
  },
  async submit({ playerId, name, score }) {
    // Persist only if score beats that player's existing personal best.
    // Return the updated [{ playerId, name, best }, ...] leaderboard.
  }
});
```

This is intentionally the only persistence seam. The game module never imports, reads or writes Firebase itself.

## End-of-run behavior

There is no `ACCESS GRANTED`, unlock state or victory cap anymore. On collision:

- a new high score gets a `NEW PERSONAL BEST` burst;
- the final run score is shown;
- the crew leaderboard is ranked by personal best;
- the current player is highlighted;
- the player can retry immediately or return to the app.

Every 10 points triggers a short `FLOW` milestone surge with particles and a color flash while gameplay continues.

## Events

The root dispatches:

- `roadtripgameopen`
- `roadtripgameclose`
- `roadtripgamescore` after a run ends, with `{ player, score, best, newBest, leaderboard }` in `event.detail`

The Home/UI layer can use these events for analytics or UI reactions without coupling itself to the engine.
