(() => {
  'use strict';

  // Intentionally lightweight client-side gate. This is a convenience/privacy
  // barrier, not hardened authentication. Keeping all gate logic in this file
  // makes the feature easy to remove or replace later.
  const ACCESS_PASSWORD = 'sizigia26';
  const LEGACY_UNLOCK_KEY = 'sizigia-roadtrip-2026-gate-unlocked';
  const ROUTE_SOLUTION = ['hamburg', 'lyon', 'barcelona'];

  function clearLegacyUnlock() {
    try {
      localStorage.removeItem(LEGACY_UNLOCK_KEY);
    } catch (_) {
      // Storage may be unavailable; the gate still works for this page load.
    }
  }

  function setAppLocked(locked) {
    const app = document.querySelector('.wrap');
    if (!app) return;

    if (locked) {
      app.setAttribute('inert', '');
      app.setAttribute('aria-hidden', 'true');
    } else {
      app.removeAttribute('inert');
      app.removeAttribute('aria-hidden');
    }
  }

  function buildGate() {
    const gate = document.createElement('div');
    gate.className = 'roadtrip-gate';
    gate.id = 'roadtripGate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-labelledby', 'roadtripGateTitle');
    gate.innerHTML = `
      <main class="roadtrip-gate-shell">
        <div class="roadtrip-gate-status" aria-hidden="true">
          <span class="roadtrip-gate-status-dot"></span>
          Private endpoint
        </div>

        <div class="roadtrip-gate-code">403</div>
        <h1 class="roadtrip-gate-title" id="roadtripGateTitle">Hier geht's nicht weiter.</h1>
        <p class="roadtrip-gate-subtitle">
          Diese Seite ist nicht öffentlich verfügbar. Vielleicht findet die richtige Crew trotzdem den Weg.
        </p>

        <section class="roadtrip-gate-game" aria-labelledby="roadtripGameTitle">
          <div class="roadtrip-gate-game-kicker">Route wiederherstellen</div>
          <h2 id="roadtripGameTitle">Ordne die drei Stopps von Nord nach Süd.</h2>
          <p>Tippe die Orte in der richtigen Reihenfolge an.</p>
          <div class="roadtrip-gate-route" id="roadtripGateRoute" aria-live="polite">
            <span>Start</span><i></i><span>?</span><i></i><span>?</span><i></i><span>?</span>
          </div>
          <div class="roadtrip-gate-choices" id="roadtripGateChoices">
            <button type="button" data-stop="barcelona">Barcelona</button>
            <button type="button" data-stop="hamburg">Hamburg</button>
            <button type="button" data-stop="lyon">Lyon</button>
          </div>
          <div class="roadtrip-gate-game-status" id="roadtripGateGameStatus" role="status" aria-live="polite"></div>
        </section>

        <details class="roadtrip-gate-feedback">
          <summary>Problem melden</summary>
          <form class="roadtrip-gate-form" id="roadtripGateForm" autocomplete="off">
            <label class="roadtrip-gate-label" for="roadtripGatePassword">Technische Rückmeldung</label>
            <div class="roadtrip-gate-access-row">
              <input
                class="roadtrip-gate-input"
                id="roadtripGatePassword"
                name="report"
                type="text"
                inputmode="text"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                placeholder="Fehlerbeschreibung oder Referenz"
                aria-label="Fehlerbeschreibung oder Referenz"
                required
              >
              <button class="roadtrip-gate-button" type="submit">Absenden</button>
            </div>
            <div class="roadtrip-gate-error" id="roadtripGateError" role="status" aria-live="polite"></div>
          </form>
        </details>

        <div class="roadtrip-gate-footer">
          <span>STATUS: RESTRICTED</span>
          <span>REF: RT-403</span>
        </div>
      </main>
    `;
    return gate;
  }

  function unlock(gate) {
    setAppLocked(false);
    gate.hidden = true;
  }

  function init() {
    // Earlier versions remembered successful access in localStorage forever.
    // Remove that legacy flag so every new page/app launch shows the gate.
    clearLegacyUnlock();

    setAppLocked(true);
    const gate = buildGate();
    document.body.appendChild(gate);

    const form = gate.querySelector('#roadtripGateForm');
    const input = gate.querySelector('#roadtripGatePassword');
    const error = gate.querySelector('#roadtripGateError');
    const choices = gate.querySelector('#roadtripGateChoices');
    const route = gate.querySelector('#roadtripGateRoute');
    const gameStatus = gate.querySelector('#roadtripGateGameStatus');
    const picked = [];

    function renderRoute() {
      const slots = route.querySelectorAll('span');
      for (let i = 1; i < slots.length; i++) {
        const stop = picked[i - 1];
        slots[i].textContent = stop ? stop[0].toUpperCase() + stop.slice(1) : '?';
      }
    }

    function resetGame(message) {
      picked.splice(0, picked.length);
      choices.querySelectorAll('button').forEach(button => {
        button.disabled = false;
        button.classList.remove('picked');
      });
      renderRoute();
      gameStatus.textContent = message;
    }

    choices.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-stop]');
      if (!button || button.disabled) return;

      const stop = button.dataset.stop;
      picked.push(stop);
      button.disabled = true;
      button.classList.add('picked');
      gameStatus.textContent = '';
      renderRoute();

      if (picked.length < ROUTE_SOLUTION.length) return;

      const solved = picked.every((value, index) => value === ROUTE_SOLUTION[index]);
      if (solved) {
        gameStatus.textContent = 'Route gefunden. Gute Fahrt!';
        window.setTimeout(() => unlock(gate), 240);
        return;
      }

      window.setTimeout(() => resetGame('Falsche Abzweigung — noch einmal.'), 350);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (input.value === ACCESS_PASSWORD) {
        error.textContent = '';
        unlock(gate);
        return;
      }

      input.value = '';
      error.textContent = 'Der Bericht konnte derzeit nicht übermittelt werden.';
      input.focus();
    });
  }

  // Optional hook for a future "App sperren" control. The current unlock is
  // intentionally page-lifetime only, so reloading always restores the gate.
  window.lockRoadtripApp = function lockRoadtripApp() {
    clearLegacyUnlock();
    window.location.reload();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
