(() => {
  'use strict';

  // Intentionally lightweight client-side gate. This is a convenience/privacy
  // barrier, not hardened authentication. Keeping all gate logic in this file
  // makes the feature easy to remove or replace later.
  const ACCESS_PASSWORD = 'sizigia26';
  const UNLOCK_KEY = 'sizigia-roadtrip-2026-gate-unlocked';

  function isUnlocked() {
    try {
      return localStorage.getItem(UNLOCK_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function rememberUnlocked() {
    try {
      localStorage.setItem(UNLOCK_KEY, '1');
    } catch (_) {
      // The app remains usable for the current page load if storage is blocked.
    }
  }

  function clearUnlock() {
    try {
      localStorage.removeItem(UNLOCK_KEY);
    } catch (_) {
      // Nothing else to do.
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
          Diese Seite ist nicht öffentlich verfügbar oder der Link ist nicht für den allgemeinen Zugriff freigegeben.
        </p>

        <div class="roadtrip-gate-rule"></div>

        <form class="roadtrip-gate-form" id="roadtripGateForm" autocomplete="off">
          <label class="roadtrip-gate-label" for="roadtripGatePassword">Zugangsschlüssel</label>
          <div class="roadtrip-gate-access-row">
            <input
              class="roadtrip-gate-input"
              id="roadtripGatePassword"
              name="password"
              type="password"
              inputmode="text"
              autocomplete="current-password"
              autocapitalize="none"
              spellcheck="false"
              placeholder="••••••••••"
              required
            >
            <button class="roadtrip-gate-button" type="submit" aria-label="Zugang prüfen">Öffnen</button>
          </div>
          <div class="roadtrip-gate-error" id="roadtripGateError" role="status" aria-live="polite"></div>
        </form>

        <div class="roadtrip-gate-footer">
          <span>STATUS: RESTRICTED</span>
          <span>REF: RT-403</span>
        </div>
      </main>
    `;
    return gate;
  }

  function unlock(gate) {
    rememberUnlocked();
    setAppLocked(false);
    gate.hidden = true;
  }

  function init() {
    if (isUnlocked()) return;

    setAppLocked(true);
    const gate = buildGate();
    document.body.appendChild(gate);

    const form = gate.querySelector('#roadtripGateForm');
    const input = gate.querySelector('#roadtripGatePassword');
    const error = gate.querySelector('#roadtripGateError');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (input.value === ACCESS_PASSWORD) {
        error.textContent = '';
        unlock(gate);
        return;
      }

      input.value = '';
      error.textContent = 'Zugang nicht freigegeben.';
      input.focus();
    });

    requestAnimationFrame(() => input.focus());
  }

  // Optional hook for a future "App sperren" control. It is deliberately
  // independent of the main app so removing this file removes the feature.
  window.lockRoadtripApp = function lockRoadtripApp() {
    clearUnlock();
    window.location.reload();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
