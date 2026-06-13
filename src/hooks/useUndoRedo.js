import { useState, useCallback } from 'react';

/**
 * deepClone helper — structuredClone with JSON fallback for older Safari.
 * Duplicated here so the hook is self-contained (no circular imports).
 */
function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/**
 * useUndoRedo
 *
 * Manages the `configs` state together with a per-file diff undo/redo history.
 * Each undo/redo entry stores only the *changed* file(s), not a full snapshot,
 * keeping memory usage at O(changed_files × history_depth).
 *
 * @param {Function} toast  - toast context (needs .info())
 * @param {string}   lang   - current UI language ('ru' | 'en')
 * @returns {{
 *   configs: object,
 *   setConfigs: Function,
 *   updateConfigs: Function,
 *   handleUndo: Function,
 *   handleRedo: Function,
 *   undoStack: Array,
 *   redoStack: Array,
 * }}
 */
export function useUndoRedo({ toast, lang }) {
  const [configs, setConfigs] = useState({});
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  /**
   * Applies a configs update and records per-file diffs for undo.
   * Works like React's setState: accepts a value or an updater function.
   */
  const updateConfigs = (updater) => {
    setConfigs(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;

      // Collect only the files that actually changed
      const diffs = [];
      for (const filePath of new Set([...Object.keys(prev), ...Object.keys(next)])) {
        if (prev[filePath]?.content !== next[filePath]?.content) {
          diffs.push({ filePath, prevContent: prev[filePath]?.content });
        }
      }
      if (diffs.length > 0) {
        setUndoStack(prevUndo => [...prevUndo, diffs].slice(-40));
        setRedoStack([]);
      }
      return next;
    });
  };

  const handleUndo = useCallback(() => {
    setUndoStack(prevUndo => {
      if (prevUndo.length === 0) return prevUndo;
      const diffs = prevUndo[prevUndo.length - 1];
      setConfigs(currentConfigs => {
        // Capture current state of affected files for redo
        const redoDiffs = diffs.map(({ filePath }) => ({
          filePath,
          prevContent: currentConfigs[filePath]?.content,
        }));
        setRedoStack(prevRedo => [...prevRedo, redoDiffs]);
        // Restore previous content for each changed file
        const restored = { ...currentConfigs };
        diffs.forEach(({ filePath, prevContent }) => {
          if (restored[filePath]) {
            restored[filePath] = { ...restored[filePath], content: prevContent };
          } else if (prevContent === undefined) {
            delete restored[filePath]; // file didn't exist before
          }
        });
        return restored;
      });
      return prevUndo.slice(0, -1);
    });
    toast.info(lang === 'ru' ? 'Действие отменено (Undo)' : 'Action undone');
  }, [lang, toast]);

  const handleRedo = useCallback(() => {
    setRedoStack(prevRedo => {
      if (prevRedo.length === 0) return prevRedo;
      const diffs = prevRedo[prevRedo.length - 1];
      setConfigs(currentConfigs => {
        // Capture current state for undo
        const undoDiffs = diffs.map(({ filePath }) => ({
          filePath,
          prevContent: currentConfigs[filePath]?.content,
        }));
        setUndoStack(prevUndo => [...prevUndo, undoDiffs]);
        // Re-apply the forward change
        const restored = { ...currentConfigs };
        diffs.forEach(({ filePath, prevContent }) => {
          if (restored[filePath]) {
            restored[filePath] = { ...restored[filePath], content: prevContent };
          } else if (prevContent === undefined) {
            delete restored[filePath];
          }
        });
        return restored;
      });
      return prevRedo.slice(0, -1);
    });
    toast.info(lang === 'ru' ? 'Действие возвращено (Redo)' : 'Action redone');
  }, [lang, toast]);

  return {
    configs,
    setConfigs,
    updateConfigs,
    handleUndo,
    handleRedo,
    undoStack,
    redoStack,
  };
}
