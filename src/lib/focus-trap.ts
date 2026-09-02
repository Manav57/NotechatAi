/**
 * Focus trap utility for modal dialogs.
 * Traps Tab/Shift+Tab, closes on Escape, manages focus.
 *
 * Usage:
 *   import { trapFocus, releaseFocus } from '../lib/focus-trap';
 *   trapFocus(dialogElement, triggerElement);
 *   releaseFocus(dialogElement);
 */

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)).filter(
    (el) => el.offsetParent !== null // visible
  ) as HTMLElement[];
}

export function trapFocus(dialog: HTMLElement, triggerElement?: HTMLElement | null): () => void {
  const previouslyFocused = document.activeElement as HTMLElement;

  // Focus the first focusable element inside the dialog
  const focusable = getFocusableElements(dialog);
  if (focusable.length > 0) {
    focusable[0].focus();
  } else {
    dialog.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      // Dispatch a custom event so the caller can close the dialog
      dialog.dispatchEvent(new CustomEvent('focus-trap-escape'));
      return;
    }

    if (e.key !== 'Tab') return;

    const currentFocusable = getFocusableElements(dialog);
    if (currentFocusable.length === 0) return;

    const firstEl = currentFocusable[0];
    const lastEl = currentFocusable[currentFocusable.length - 1];

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

  function onFocusIn(e: FocusEvent) {
    // If focus moves outside the dialog, bring it back
    if (!dialog.contains(e.target as Node)) {
      const currentFocusable = getFocusableElements(dialog);
      if (currentFocusable.length > 0) {
        currentFocusable[0].focus();
      }
    }
  }

  dialog.addEventListener('keydown', onKeyDown);
  document.addEventListener('focusin', onFocusIn);

  // Return cleanup function
  return () => {
    dialog.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('focusin', onFocusIn);
    // Restore focus to previously focused element
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
    }
  };
}
