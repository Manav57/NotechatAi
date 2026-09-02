/**
 * Global focus-trap utility for modal dialogs.
 * Exposed as window.trapFocus(dialog, trigger?) and window.releaseFocus(dialog).
 */
(function () {
  var FOCUSABLE = 'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

  function getFocusable(container) {
    return Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE)).filter(function (el) {
      return el.offsetParent !== null;
    });
  }

  // Store cleanup handlers per dialog
  var cleanups = new Map();

  window.trapFocus = function (dialog, trigger) {
    // If already trapped, don't double-trap
    if (cleanups.has(dialog)) return;

    var previouslyFocused = document.activeElement;

    // Focus first focusable element
    var focusable = getFocusable(dialog);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      dialog.focus();
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dialog.dispatchEvent(new CustomEvent('focus-trap-escape'));
        return;
      }

      if (e.key !== 'Tab') return;

      var currentFocusable = getFocusable(dialog);
      if (currentFocusable.length === 0) return;

      var firstEl = currentFocusable[0];
      var lastEl = currentFocusable[currentFocusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    function onFocusIn(e) {
      if (!dialog.contains(e.target)) {
        var currentFocusable = getFocusable(dialog);
        if (currentFocusable.length > 0) {
          currentFocusable[0].focus();
        }
      }
    }

    dialog.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    cleanups.set(dialog, function () {
      dialog.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    });
  };

  window.releaseFocus = function (dialog) {
    var cleanup = cleanups.get(dialog);
    if (cleanup) {
      cleanup();
      cleanups.delete(dialog);
    }
  };
})();
