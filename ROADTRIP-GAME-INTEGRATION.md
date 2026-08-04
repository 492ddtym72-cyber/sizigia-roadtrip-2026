# Roadtrip game integration

This branch intentionally contains only new game files. It does not modify the current Home redesign, gatekeeper, app shell, service worker, expense code, Firebase, or Tricount sync.

## Files

- `roadtrip-game.js` — self-contained fullscreen game module and public entry points.
- `roadtrip-game.css` — game-only UI styling.
- `roadtrip-game-assets.js` — embedded generated raster artwork for the psychedelic landscape, Goa bird, and ornate obstacles.

## Integration after the Home/UI branch is finished

Load only the JS module somewhere in the final app shell:

```html
<script src="./roadtrip-game.js"></script>
```

`roadtrip-game.js` automatically loads `roadtrip-game.css` and `roadtrip-game-assets.js` relative to itself.

The Game-section button can then call:

```js
window.openRoadtripGame();
```

Optional close hook:

```js
window.closeRoadtripGame();
```

No unlock/authentication callback is emitted. Winning is only an in-game victory state. The module is deliberately independent of the 6-digit code screen and any access-gate logic.
