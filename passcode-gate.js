(() => {
  'use strict';

  const ACCESS_CODE = '42067';
  const CODE_LENGTH = ACCESS_CODE.length;
  const KEYS = [
    ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
    ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
    ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']
  ];

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

  function keyMarkup(digit, letters = '') {
    return `<button type="button" data-digit="${digit}" aria-label="${digit}"><strong>${digit}</strong>${letters ? `<small>${letters}</small>` : ''}</button>`;
  }

  function buildPasscodeShell() {
    const shell = document.createElement('main');
    shell.className = 'roadtrip-passcode-shell';
    shell.setAttribute('role', 'document');
    shell.innerHTML = `
      <div class="roadtrip-passcode-lock" aria-hidden="true">
        <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
      </div>
      <div class="roadtrip-passcode-brand">ROADTRIP</div>
      <h1>Code eingeben</h1>
      <p>Zum Öffnen der Roadtrip App</p>
      <div class="roadtrip-passcode-dots" id="roadtripPasscodeDots" aria-label="Noch kein Code eingegeben">
        ${Array.from({length: CODE_LENGTH}, (_, i) => `<i data-index="${i}"></i>`).join('')}
      </div>
      <div class="roadtrip-passcode-error" id="roadtripPasscodeError" role="status" aria-live="polite"></div>
      <div class="roadtrip-passcode-keypad" aria-label="Ziffernblock">
        ${KEYS.map(([digit, letters]) => keyMarkup(digit, letters)).join('')}
        <span class="roadtrip-passcode-spacer" aria-hidden="true"></span>
        ${keyMarkup('0')}
        <button type="button" class="roadtrip-passcode-delete" data-delete aria-label="Letzte Ziffer löschen">
          <svg viewBox="0 0 28 22"><path d="M10 2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H10L2 11 10 2Z"/><path d="m14 7 6 8M20 7l-6 8"/></svg>
        </button>
      </div>
      <div class="roadtrip-passcode-hint">Nur für die Roadtrip-Crew</div>
    `;
    return shell;
  }

  function installPasscodeGate() {
    const gate = document.getElementById('roadtripGate');
    if (!gate || gate.dataset.passcodeInstalled === '1') return;
    gate.dataset.passcodeInstalled = '1';
    gate.classList.add('roadtrip-passcode-mode');

    const legacyShell = gate.querySelector('.roadtrip-gate-shell');
    if (legacyShell) {
      legacyShell.hidden = true;
      legacyShell.setAttribute('aria-hidden', 'true');
    }

    const shell = buildPasscodeShell();
    gate.insertBefore(shell, gate.firstChild);

    const dots = Array.from(shell.querySelectorAll('.roadtrip-passcode-dots i'));
    const dotsWrap = shell.querySelector('#roadtripPasscodeDots');
    const error = shell.querySelector('#roadtripPasscodeError');
    let entered = '';
    let lockedInput = false;

    function render() {
      dots.forEach((dot, index) => dot.classList.toggle('filled', index < entered.length));
      dotsWrap.setAttribute('aria-label', `${entered.length} von ${CODE_LENGTH} Ziffern eingegeben`);
      shell.classList.toggle('has-input', entered.length > 0);
    }

    function unlock() {
      setAppLocked(false);
      gate.hidden = true;
      document.documentElement.classList.remove('psy-game-open');
      entered = '';
      render();
    }

    function reject() {
      lockedInput = true;
      error.textContent = 'Falscher Code';
      shell.classList.remove('code-error');
      void shell.offsetWidth;
      shell.classList.add('code-error');
      if (navigator.vibrate) navigator.vibrate([35, 35, 35]);
      window.setTimeout(() => {
        entered = '';
        render();
        shell.classList.remove('code-error');
        lockedInput = false;
      }, 520);
      window.setTimeout(() => { error.textContent = ''; }, 1500);
    }

    function submitIfReady() {
      if (entered.length !== CODE_LENGTH) return;
      lockedInput = true;
      window.setTimeout(() => {
        if (entered === ACCESS_CODE) unlock();
        else reject();
      }, 110);
    }

    shell.addEventListener('click', event => {
      if (lockedInput) return;
      const digitButton = event.target.closest('[data-digit]');
      if (digitButton) {
        if (entered.length >= CODE_LENGTH) return;
        entered += digitButton.dataset.digit;
        error.textContent = '';
        render();
        submitIfReady();
        return;
      }
      if (event.target.closest('[data-delete]')) {
        entered = entered.slice(0, -1);
        error.textContent = '';
        render();
      }
    });

    document.addEventListener('keydown', event => {
      if (gate.hidden || lockedInput) return;
      if (/^[0-9]$/.test(event.key)) {
        if (entered.length < CODE_LENGTH) entered += event.key;
        render();
        submitIfReady();
      } else if (event.key === 'Backspace') {
        entered = entered.slice(0, -1);
        render();
      }
    });

    render();
  }

  function init() {
    installPasscodeGate();
    if (!document.getElementById('roadtripGate')) requestAnimationFrame(installPasscodeGate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
