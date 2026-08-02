(() => {
  'use strict';

  // Intentionally lightweight client-side gate. This is a convenience/privacy
  // barrier, not hardened authentication. Keeping all gate logic in this file
  // makes the feature easy to remove or replace later.
  const ACCESS_PASSWORD = 'sizigia26';
  const LEGACY_UNLOCK_KEY = 'sizigia-roadtrip-2026-gate-unlocked';

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
          Diese Seite ist nicht öffentlich verfügbar oder der Link ist nicht für den allgemeinen Zugriff freigegeben.
        </p>

        <div class="roadtrip-gate-rule"></div>

        <form class="roadtrip-gate-form" id="roadtripGateForm" autocomplete="off">
          <label class="roadtrip-gate-label" for="roadtripGatePassword">Problem melden</label>
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
