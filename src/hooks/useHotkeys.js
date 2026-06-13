import { useEffect } from 'react';

/**
 * useHotkeys
 *
 * Registers two global keydown listeners for the application:
 *
 * 1. **Static listener** (mounted once, no deps):
 *    - Alt + 1..8  — switch active tab
 *    - Ctrl/Cmd+Z  — undo
 *    - Ctrl/Cmd+Shift+Z / Ctrl+Y — redo
 *    - /           — open search (when not in an input)
 *
 * 2. **Access-gated listener** (re-registers when hasAccess or handlers change):
 *    - Ctrl/Cmd+K  — toggle global search
 *    - Ctrl/Cmd+S  — save all
 *    - ?           — toggle hotkey cheat sheet
 *    - Escape      — close overlays
 *
 * Using refs for undo/redo ensures the listener always calls the latest
 * version without re-registering on every render.
 *
 * @param {{
 *   hasAccess:        boolean,
 *   setActiveTab:     Function,
 *   setIsSearchOpen:  Function,
 *   setIsHotkeyOpen:  Function,
 *   setConfirmDialog: Function,
 *   handleSaveAll:    Function,
 *   undoRef:          React.MutableRefObject<Function>,
 *   redoRef:          React.MutableRefObject<Function>,
 * }} params
 */
export function useHotkeys({
  hasAccess,
  setActiveTab,
  setIsSearchOpen,
  setIsHotkeyOpen,
  setConfirmDialog,
  handleSaveAll,
  undoRef,
  redoRef,
}) {
  // ── Listener 1: stable, registered once on mount ─────────────────────────
  // Uses refs for undo/redo so it never goes stale.
  useEffect(() => {
    const onKey = (e) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.contentEditable === 'true');

      // Alt + 1..8 — switch tab
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const tabs = [
          'dashboard', 'economy', 'quests', 'aibots',
          'settings', 'map', 'spawner', 'raw_editor',
        ];
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index < tabs.length) {
          e.preventDefault();
          setActiveTab(tabs[index]);
        }
      }

      // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y — undo / redo
      if (e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redoRef.current();
          else undoRef.current();
        } else if (key === 'y') {
          e.preventDefault();
          redoRef.current();
        }
      }

      // / — open search (not in an input)
      if (e.key === '/' && !isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — uses refs for mutable callbacks

  // ── Listener 2: access-gated, re-registers when deps change ───────────────
  useEffect(() => {
    const onKey = (e) => {
      if (!hasAccess) return;

      // Ctrl+K — toggle global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }

      // Ctrl+S — save all
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveAll();
      }

      // ? — hotkey cheat sheet (not in input)
      if (
        e.key === '?' &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        setIsHotkeyOpen(prev => !prev);
      }

      // Escape — close any open overlay
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsHotkeyOpen(false);
        setConfirmDialog(null);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasAccess, handleSaveAll, setActiveTab, setIsSearchOpen, setIsHotkeyOpen, setConfirmDialog]);
}
