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
      <div class="roadtrip-gate-card">
        <div class="roadtrip-gate-mark" aria-hidden="true"></div>
        <h1 class="roadtrip-gate-title" id="roadtripGateTitle">Roadtrip</h1>
        <p class="roadtrip-gate-subtitle">Privater Zugang für unsere Reisegruppe</p>
        <form id="roadtripGateForm" autocomplete="off">
          <label class="roadtrip-gate-label" for="roadtripGatePassword">Passwort</label>
          <input
            class="roadtrip-gate-input"
            id="roadtripGatePassword"
            name="password"
            type="password"
            inputmode="text"
            autocomplete="current-password"
            autocapitalize="none"
            spellcheck="false"
            required
          >
          <button class="roadtrip-gate-button" type="submit">Roadtrip öffnen</button>
          <div class="roadtrip-gate-error" id="roadtripGateError" role="status" aria-live="polite"></div>
        </form>
        <div class="roadtrip-gate-meta">
          <svg class="roadtrip-gate-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2"></rect>
            <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
          </svg>
          Zugang wird auf diesem Gerät gespeichert
        </div>
      </div>
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
      error.textContent = 'Passwort nicht erkannt.';
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
