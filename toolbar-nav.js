/**
 * toolbar-nav.js — dropdown toolbar (hamburger navigazione, sync, ecc.)
 */
(function () {
  'use strict';

  function getPanel(dropdown) {
    return dropdown.querySelector('.toolbar-dropdown__panel');
  }

  function getTrigger(dropdown) {
    return dropdown.querySelector('.toolbar-dropdown__trigger');
  }

  function setDropdownOpen(dropdown, isOpen) {
    const trigger = getTrigger(dropdown);
    const panel = getPanel(dropdown);
    if (!trigger || !panel) return;

    dropdown.classList.toggle('is-open', isOpen);
    trigger.setAttribute('aria-expanded', String(isOpen));
    panel.hidden = !isOpen;
  }

  function closeAllToolbarDropdowns(except) {
    document.querySelectorAll('[data-toolbar-dropdown].is-open').forEach((dropdown) => {
      if (dropdown !== except) setDropdownOpen(dropdown, false);
    });
  }

  function bindDropdown(dropdown) {
    const trigger = getTrigger(dropdown);
    if (!trigger || trigger.dataset.toolbarDropdownBound === 'true') return;
    trigger.dataset.toolbarDropdownBound = 'true';

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      closeAllToolbarDropdowns(dropdown);
      setDropdownOpen(dropdown, !isOpen);
    });

    const panel = getPanel(dropdown);
    panel?.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        setDropdownOpen(dropdown, false);
      }
    });
  }

  function initToolbarDropdowns() {
    document.querySelectorAll('[data-toolbar-dropdown]').forEach(bindDropdown);

    if (!document.body.dataset.toolbarNavGlobalBound) {
      document.body.dataset.toolbarNavGlobalBound = 'true';
      document.addEventListener('click', () => closeAllToolbarDropdowns());
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeAllToolbarDropdowns();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToolbarDropdowns);
  } else {
    initToolbarDropdowns();
  }

  window.toolbarNav = {
    closeAll: closeAllToolbarDropdowns,
    setOpen: setDropdownOpen,
    bindDropdown,
    refresh: initToolbarDropdowns,
  };
})();
