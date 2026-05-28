import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider, useToast } from './components/ToastManager';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalSearch from './components/GlobalSearch';
import { validateBeforeExport } from './utils/exportValidator';
import Sidebar from './components/Sidebar';
import ConfigForm from './components/ConfigForm';
import TacticalMap from './components/TacticalMap';
import QuestGraph from './components/QuestGraph';
import Dashboard from './components/Dashboard';
import EconomyEditor from './components/EconomyEditor';
import AIBotsEditor from './components/AIBotsEditor';
import SettingsEditor from './components/SettingsEditor';
import { validateConfig } from './utils/diagnostics';
import * as fileService from './services/fileService';
import * as idb from './utils/indexedDB';
import { translations } from './utils/localization';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setNestedValue(obj, path, value) {
  const newObj = JSON.parse(JSON.stringify(obj));
  let current = newObj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current[key] === undefined) {
      current[key] = typeof path[i + 1] === 'number' ? [] : {};
    }
    current = current[key];
  }
  const lastKey = path[path.length - 1];
  if (value === null) {
    if (Array.isArray(current)) current.splice(lastKey, 1);
    else delete current[lastKey];
  } else {
    current[lastKey] = value;
  }
  return newObj;
}

function getNestedValue(obj, path) {
  let current = obj;
  for (const key of path) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}

// ─── Hotkey Modal ─────────────────────────────────────────────────────────────

function HotkeyModal({ onClose }) {
  const sections = [
    {
      title: 'GLOBAL',
      keys: [
        { key: 'Ctrl + K', desc: 'Open Global Search' },
        { key: 'Ctrl + S', desc: 'Export / Save All modified files' },
        { key: '?',        desc: 'Show this Hotkey Cheat Sheet' },
      ],
    },
    {
      title: 'TACTICAL MAP',
      keys: [
        { key: 'Delete',  desc: 'Delete selected entity' },
        { key: 'Escape',  desc: 'Deselect current entity' },
        { key: 'M',       desc: 'Toggle Distance Ruler tool' },
      ],
    },
    {
      title: 'MODALS & DIALOGS',
      keys: [
        { key: 'Escape', desc: 'Close active modal / dialog' },
        { key: 'Enter',  desc: 'Confirm selected search result' },
        { key: '↑ / ↓',  desc: 'Navigate search results' },
      ],
    },
  ];

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.82)', zIndex: 99997,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '480px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glow)',
          borderRadius: '4px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          animation: 'toastIn 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px' }}>// KEYBOARD_SHORTCUTS</div>
            <h3 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '18px' }}>HOTKEY CHEAT SHEET</h3>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: '4px 10px', fontSize: '12px' }}>× CLOSE</button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {sections.map(sec => (
            <div key={sec.title}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '10px' }}>
                {sec.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sec.keys.map(({ key, desc }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{desc}</span>
                    <kbd style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--text-glow)',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '3px',
                      padding: '3px 10px',
                      whiteSpace: 'nowrap',
                    }}>
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmModal({ dialog, onConfirm, onCancel }) {
  if (!dialog) return null;
  const isWarning = dialog.severity === 'warning';
  const borderCol = isWarning ? 'var(--warning-color)' : 'var(--danger-color)';
  const btnClass  = isWarning ? 'btn btn-warning' : 'btn btn-danger';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', zIndex: 99996,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        width: '520px',
        background: 'var(--bg-secondary)',
        border: `1px solid ${borderCol}`,
        borderRadius: '3px',
        padding: '24px',
        boxShadow: `0 8px 40px rgba(0,0,0,0.8), 0 0 12px ${borderCol}33`,
        animation: 'toastIn 0.2s ease',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: borderCol, letterSpacing: '2px', fontWeight: 'bold' }}>
            // {isWarning ? 'VALIDATION_WARNING' : 'CONFIRM_ACTION'}
          </div>
          <h3 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: borderCol, fontSize: '18px' }}>
            {dialog.title}
          </h3>
        </div>

        <pre style={{
          margin: '0 0 20px 0',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.6',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          padding: '12px',
          borderRadius: '2px',
          maxHeight: '220px',
          overflowY: 'auto',
        }}>
          {dialog.body}
        </pre>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel} style={{ padding: '8px 16px' }}>
            {dialog.cancelLabel || 'CANCEL'}
          </button>
          <button className={btnClass} onClick={onConfirm} style={{ padding: '8px 16px' }}>
            {dialog.confirmLabel || 'CONFIRM'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root App (provides Toast context) ───────────────────────────────────────

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

// ─── AppContent (all logic lives here) ───────────────────────────────────────

function AppContent() {
  const toast = useToast();

  const [lang, setLang] = useState(() => {
    return localStorage.getItem('dayz_editor_lang') || 'ru';
  });

  useEffect(() => {
    localStorage.setItem('dayz_editor_lang', lang);
  }, [lang]);

  const t = useCallback((key, replacements = {}) => {
    let text = translations[lang]?.[key] || translations['en']?.[key] || key;
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
    return text;
  }, [lang]);

  // Version control & localStorage schema migration
  const APP_VERSION = '1.2.0';
  useEffect(() => {
    const savedVer = localStorage.getItem('dayz_editor_app_version');
    if (savedVer !== APP_VERSION) {
      localStorage.removeItem('dayz_editor_active_tab');
      localStorage.removeItem('dayz_editor_selected_file');
      localStorage.removeItem('dayz_editor_economy_sub_tab');
      localStorage.removeItem('dayz_editor_economy_selected_category');
      localStorage.removeItem('dayz_editor_economy_selected_trader');
      localStorage.setItem('dayz_editor_app_version', APP_VERSION);
      console.log(`[VERSION CONTROL] Migrated state schema to v${APP_VERSION}`);
    }
  }, []);

  const [configs, setConfigs]           = useState({});
  const [schemaReport, setSchemaReport] = useState(null);
  
  // File access state
  const [hasAccess, setHasAccess]       = useState(false);
  const [folderName, setFolderName]     = useState('');
  const [savedHandle, setSavedHandle]   = useState(null);
  const [loading, setLoading]           = useState(true);

  const [activeTab, setActiveTab]             = useState(() => {
    return localStorage.getItem('dayz_editor_active_tab') || 'dashboard';
  });
  const [selectedFilePath, setSelectedFilePath] = useState(() => {
    return localStorage.getItem('dayz_editor_selected_file') || null;
  });
  const [focusedCoordinate, setFocusedCoordinate] = useState(null);
  const [draftToRestore, setDraftToRestore]   = useState(null);
  const [selectedQuestId, setSelectedQuestId] = useState(() => {
    const saved = localStorage.getItem('dayz_editor_selected_quest_id');
    return saved ? Number(saved) : null;
  });

  const [xmlItems, setXmlItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dayz_editor_xml_items') || '[]'); }
    catch (e) { return []; }
  });

  // UI overlay states
  const [isSearchOpen, setIsSearchOpen]   = useState(false);
  const [isHotkeyOpen, setIsHotkeyOpen]   = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Restore saved folder on mount
  useEffect(() => {
    idb.getSavedHandle()
      .then(handle => {
        if (handle) {
          setSavedHandle(handle);
          setFolderName(handle.name);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load saved directory handle', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem('dayz_editor_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedFilePath) {
      localStorage.setItem('dayz_editor_selected_file', selectedFilePath);
    } else {
      localStorage.removeItem('dayz_editor_selected_file');
    }
  }, [selectedFilePath]);

  useEffect(() => {
    if (selectedQuestId !== null && selectedQuestId !== undefined) {
      localStorage.setItem('dayz_editor_selected_quest_id', selectedQuestId);
    } else {
      localStorage.removeItem('dayz_editor_selected_quest_id');
    }
  }, [selectedQuestId]);

  // ── Fetch configs from File System ─────────────────────────────────────────
  const fetchConfigs = useCallback(() => {
    if (!fileService.hasDirectoryAccess()) return;
    setLoading(true);
    fileService.getConfigs()
      .then(data => {
        const loadedConfigs = {};
        Object.entries(data.configs).forEach(([path, value]) => {
          loadedConfigs[path] = {
            ...value,
            originalContent: value.success ? JSON.parse(JSON.stringify(value.content)) : null,
          };
        });

        try {
          const rawDraft = localStorage.getItem('dayz_editor_draft');
          if (rawDraft) {
            const parsedDraft = JSON.parse(rawDraft);
            if (Object.keys(parsedDraft).length > 0) setDraftToRestore(parsedDraft);
          }
        } catch (e) {
          console.error('Failed to read draft from localStorage', e);
        }

        setConfigs(loadedConfigs);
        setSchemaReport(data.schemaReport);
        setLoading(false);
        toast.success('Configurations loaded from directory successfully!');
      })
      .catch(err => {
        console.error('Failed to load configs', err);
        toast.error(`Failed to load configs: ${err.message}`);
        setLoading(false);
      });
  }, [toast]);

  // ── Folder Selection and Connection Handlers ──────────────────────────────
  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      const granted = await fileService.verifyPermission(handle, 'readwrite');
      if (granted) {
        fileService.setDirectoryHandle(handle);
        await idb.saveHandle(handle);
        setSavedHandle(handle);
        setFolderName(handle.name);
        setHasAccess(true);
        fetchConfigs();
      } else {
        toast.error('Write permissions were not granted.');
        setLoading(false);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        toast.error(`Failed to select directory: ${e.message}`);
      }
      setLoading(false);
    }
  };

  const handleRestoreAccess = async () => {
    if (!savedHandle) return;
    try {
      setLoading(true);
      const granted = await fileService.verifyPermission(savedHandle, 'readwrite');
      if (granted) {
        fileService.setDirectoryHandle(savedHandle);
        setHasAccess(true);
        fetchConfigs();
      } else {
        toast.error('Permission to write was denied.');
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Failed to restore access: ${e.message}`);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await idb.clearSavedHandle();
    fileService.setDirectoryHandle(null);
    setSavedHandle(null);
    setFolderName('');
    setHasAccess(false);
    setConfigs({});
    setSelectedFilePath(null);
    toast.info('Disconnected configuration directory.');
  };

  // ── Auto-save draft to localStorage ──────────────────────────────────────
  useEffect(() => {
    if (loading || !hasAccess) return;

    const handler = setTimeout(() => {
      const dirtyData = {};
      Object.entries(configs).forEach(([path, file]) => {
        if (file.success && file.originalContent &&
            JSON.stringify(file.content) !== JSON.stringify(file.originalContent)) {
          dirtyData[path] = file.content;
        }
      });

      try {
        if (Object.keys(dirtyData).length > 0) {
          localStorage.setItem('dayz_editor_draft', JSON.stringify(dirtyData));
        } else {
          localStorage.removeItem('dayz_editor_draft');
        }
      } catch (e) {
        console.error('Failed to save draft', e);
      }
    }, 1000);

    return () => clearTimeout(handler);
  }, [configs, loading, hasAccess]);


  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (!hasAccess) return;
      // Ctrl+K — global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      // Ctrl+S — save all
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveAll();
      }
      // ? — hotkey sheet (not in input)
      if (e.key === '?' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
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
  }, [configs, hasAccess]); // include configs so handleSaveAll closure has latest state

  // ── Draft handlers ────────────────────────────────────────────────────────
  const handleRestoreDraft = () => {
    if (!draftToRestore) return;
    setConfigs(prev => {
      const updated = { ...prev };
      Object.entries(draftToRestore).forEach(([filePath, content]) => {
        if (updated[filePath]) {
          updated[filePath] = { ...updated[filePath], content: JSON.parse(JSON.stringify(content)) };
        }
      });
      return updated;
    });
    setDraftToRestore(null);
    toast.success(`Draft restored: ${Object.keys(draftToRestore).length} files recovered.`);
  };

  const handleDiscardDraft = () => {
    try { localStorage.removeItem('dayz_editor_draft'); } catch (e) {}
    setDraftToRestore(null);
    toast.info('Draft discarded.');
  };

  // ── Field / file mutations ────────────────────────────────────────────────
  const handleChangeField = (filePath, pathArray, newValue) => {
    setConfigs(prev => {
      const file = prev[filePath];
      if (!file || !file.success) return prev;
      return { ...prev, [filePath]: { ...file, content: setNestedValue(file.content, pathArray, newValue) } };
    });
  };

  const handleResetField = (filePath, pathArray) => {
    setConfigs(prev => {
      const file = prev[filePath];
      if (!file || !file.success || !file.originalContent) return prev;
      const origVal = getNestedValue(file.originalContent, pathArray);
      const valToSet = origVal === undefined ? null : JSON.parse(JSON.stringify(origVal));
      return { ...prev, [filePath]: { ...file, content: setNestedValue(file.content, pathArray, valToSet) } };
    });
  };

  const handleResetFile = (filePath) => {
    setConfigs(prev => {
      const file = prev[filePath];
      if (!file || !file.originalContent) return prev;
      return { ...prev, [filePath]: { ...file, content: JSON.parse(JSON.stringify(file.originalContent)) } };
    });
  };

  // ── Save single file ──────────────────────────────────────────────────────
  const handleSaveFile = (filePath) => {
    const file = configs[filePath];
    if (!file || !file.success) return;
    fileService.saveFile(filePath, file.content)
      .then(() => {
        setConfigs(prev => {
          const f = prev[filePath];
          return { ...prev, [filePath]: { ...f, originalContent: JSON.parse(JSON.stringify(f.content)) } };
        });
        toast.success(`Saved: ${filePath.split('/').pop()}`);
      })
      .catch(err => toast.error(`Save failed: ${err.message}`));
  };

  // ── Internal doSaveAll (called after optional validation) ─────────────────
  const doSaveAll = useCallback((dirtyFilesList) => {
    fileService.saveAll(dirtyFilesList)
      .then(() => {
        setConfigs(prev => {
          const updated = { ...prev };
          dirtyFilesList.forEach(df => {
            const f = updated[df.filePath];
            updated[df.filePath] = { ...f, originalContent: JSON.parse(JSON.stringify(f.content)) };
          });
          return updated;
        });
        toast.success(`Package exported! ${dirtyFilesList.length} file(s) saved.`);
      })
      .catch(err => toast.error(`Export failed: ${err.message}`));
  }, [toast]);

  // ── Save all with export validation ──────────────────────────────────────
  const handleSaveAll = useCallback(() => {
    const dirtyFilesList = [];
    Object.entries(configs).forEach(([path, file]) => {
      if (file.success && JSON.stringify(file.content) !== JSON.stringify(file.originalContent)) {
        dirtyFilesList.push({ filePath: path, content: file.content });
      }
    });

    if (dirtyFilesList.length === 0) {
      toast.info('No modified files to export.');
      return;
    }

    const issues = validateBeforeExport(configs);
    if (issues.length > 0) {
      const errorCount   = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;
      const preview = issues.slice(0, 8)
        .map(i => `[${i.severity.toUpperCase()}] ${i.message}`)
        .join('\n');
      const extra = issues.length > 8 ? `\n...and ${issues.length - 8} more issue(s).` : '';

      setConfirmDialog({
        title: `VALIDATION: ${errorCount} ERROR(S), ${warningCount} WARNING(S)`,
        body: `Found issues in modified files before export:\n\n${preview}${extra}\n\nExport anyway?`,
        severity: errorCount > 0 ? 'danger' : 'warning',
        confirmLabel: 'EXPORT ANYWAY',
        cancelLabel: 'CANCEL',
        onConfirm: () => doSaveAll(dirtyFilesList),
      });
    } else {
      doSaveAll(dirtyFilesList);
    }
  }, [configs, doSaveAll]);

  // ── Discard all changes ───────────────────────────────────────────────────
  const handleDiscardAll = () => {
    setConfirmDialog({
      title: 'DISCARD ALL CHANGES',
      body: 'This will revert ALL unsaved modifications in memory back to the last saved state on disk.\n\nThis action cannot be undone.',
      severity: 'danger',
      confirmLabel: 'DISCARD ALL',
      cancelLabel: 'CANCEL',
      onConfirm: () => {
        setConfigs(prev => {
          const reverted = { ...prev };
          Object.keys(reverted).forEach(path => {
            const file = reverted[path];
            if (file.originalContent) {
              reverted[path] = { ...file, content: JSON.parse(JSON.stringify(file.originalContent)) };
            }
          });
          return reverted;
        });
        toast.warning('All unsaved changes discarded.');
      },
    });
  };

  // ── Create / Delete files ─────────────────────────────────────────────────
  const handleCreateFile = (filePath, content) => {
    fileService.saveFile(filePath, content)
      .then(() => {
        setConfigs(prev => ({
          ...prev,
          [filePath]: {
            success: true,
            content: JSON.parse(JSON.stringify(content)),
            originalContent: JSON.parse(JSON.stringify(content)),
            sizeBytes: JSON.stringify(content).length,
          },
        }));
        toast.success(`Created: ${filePath.split('/').pop()}`);
      })
      .catch(err => toast.error(`Create failed: ${err.message}`));
  };

  const handleDeleteFile = (filePath) => {
    fileService.deleteFile(filePath)
      .then(() => {
        setConfigs(prev => { const copy = { ...prev }; delete copy[filePath]; return copy; });
        toast.success(`Deleted: ${filePath.split('/').pop()}`);
      })
      .catch(err => toast.error(`Delete failed: ${err.message}`));
  };

  // ── Fix handlers ──────────────────────────────────────────────────────────
  const handleFixSyntaxError = (filePath) => {
    fileService.fixSyntax(filePath)
      .then(data => {
        setConfigs(prev => ({
          ...prev,
          [filePath]: {
            success: true,
            content: data.content,
            originalContent: JSON.parse(JSON.stringify(data.content)),
            sizeBytes: JSON.stringify(data.content).length,
          },
        }));
        toast.success(`Syntax repaired: ${filePath.split('/').pop()}`);
      })
      .catch(err => toast.error(`Repair failed: ${err.message}`));
  };

  const handleFixStructuralError = (filePath, error) => {
    handleChangeField(filePath, error.path, error.defaultValue);
  };

  const handleFixAllErrors = async () => {
    const syntaxToFix = Object.keys(configs).filter(p => !configs[p].success);
    let syntaxFixCount = 0;

    for (const filePath of syntaxToFix) {
      try {
        const data = await fileService.fixSyntax(filePath);
        setConfigs(prev => ({
          ...prev,
          [filePath]: {
            success: true,
            content: data.content,
            originalContent: JSON.parse(JSON.stringify(data.content)),
            sizeBytes: JSON.stringify(data.content).length,
          },
        }));
        syntaxFixCount++;
      } catch (e) {
        console.error(`Repair failed for ${filePath}:`, e);
      }
    }

    let structuralFixCount = 0;
    const questIds = new Set();
    const marketCategories = new Set();
    const marketItems = new Set();

    Object.keys(configs).forEach(p => {
      const file = configs[p];
      if (file.success && file.content) {
        if (p.toLowerCase().startsWith('expansionmod/quests/quests/quest_') && file.content.ID !== undefined)
          questIds.add(file.content.ID);
        if (p.toLowerCase().startsWith('expansionmod/market/')) {
          marketCategories.add(p.split('/').pop().replace('.json', '').toLowerCase());
          if (Array.isArray(file.content.Items))
            file.content.Items.forEach(i => { if (i.ClassName) marketItems.add(i.ClassName.toLowerCase()); });
        }
      }
    });

    setConfigs(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(filePath => {
        const file = updated[filePath];
        if (!file.success) return;
        const fileSchema = schemaReport?.files?.[filePath]?.schema;
        if (fileSchema) {
          const fileErrors = validateConfig(file.content, fileSchema, filePath, questIds, marketCategories, marketItems);
          let content = JSON.parse(JSON.stringify(file.content));
          let changed = false;
          fileErrors.forEach(err => {
            if (err.fixable) {
              content = setNestedValue(content, err.path, err.defaultValue);
              structuralFixCount++;
              changed = true;
            }
          });
          if (changed) updated[filePath] = { ...file, content };
        }
      });
      return updated;
    });

    toast.success(
      `Auto-Fix complete! Repaired ${syntaxFixCount} syntax error(s) and ${structuralFixCount} structural warning(s).`
    );
  };

  // ── Navigation helpers ────────────────────────────────────────────────────
  const handleOpenFile = (filePath) => {
    setSelectedFilePath(filePath);
    setActiveTab('raw_editor');
  };

  const handleNavigateToMap = (coordinates) => {
    let x = 0, z = 0;
    if (Array.isArray(coordinates)) { x = coordinates[0]; z = coordinates[2]; }
    else if (coordinates && typeof coordinates === 'object') { x = coordinates.x; z = coordinates.z; }
    setFocusedCoordinate({ x, z });
    setActiveTab('map');
  };

  // ── Computed dirty set ────────────────────────────────────────────────────
  const dirtyFiles = new Set(
    Object.keys(configs).filter(path => {
      const file = configs[path];
      return file.success && JSON.stringify(file.content) !== JSON.stringify(file.originalContent);
    })
  );

  // ── Tab badge helper ──────────────────────────────────────────────────────
  const TabBtn = ({ id, label, badge }) => (
    <button
      className={`nav-tab ${activeTab === id ? 'active' : ''}`}
      onClick={() => setActiveTab(id)}
      style={{ position: 'relative' }}
    >
      {label}
      {badge > 0 && (
        <span style={{
          position: 'absolute',
          top: '4px', right: '4px',
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--warning-color)',
          background: 'rgba(235,214,103,0.15)',
          border: '1px solid rgba(235,214,103,0.3)',
          borderRadius: '8px',
          padding: '0 4px',
          lineHeight: '14px',
          fontWeight: 'bold',
        }}>
          {badge}
        </span>
      )}
    </button>
  );

  // ─── Count tab-specific dirty files ─────────────────────────────────────
  const dirtyEconomy  = [...dirtyFiles].filter(p => p.startsWith('expansionmod/market/') || p.startsWith('expansionmod/traders/')).length;
  const dirtyQuests   = [...dirtyFiles].filter(p => p.startsWith('expansionmod/quests/')).length;
  const dirtyAiBots   = [...dirtyFiles].filter(p => p.includes('aipatrol') || p.includes('roaming')).length;
  const dirtySettings = [...dirtyFiles].filter(p => p.includes('settings')).length;

  // ── Welcome Screen Component ──────────────────────────────────────────────
  if (!hasAccess && !loading) {
    const isSupported = typeof window.showDirectoryPicker === 'function';
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        backgroundImage: 'radial-gradient(ellipse at 50% 30%, #0c200c 0%, transparent 70%), radial-gradient(ellipse at 50% 90%, #060806 0%, transparent 80%)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Futuristic grid pattern background */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'linear-gradient(rgba(30, 48, 30, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 48, 30, 0.15) 1px, transparent 1px)',
          backgroundSize: '30px 30px', pointerEvents: 'none'
        }} />

        <div style={{
          width: '100%',
          maxWidth: '580px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-glow), 0 20px 50px rgba(0,0,0,0.8)',
          borderRadius: '4px',
          padding: '40px',
          zIndex: 1,
          animation: 'toastIn 0.3s ease-out',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '5px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            // EXPANSION_MOD_EDITOR
          </div>
          <h1 style={{
            margin: '0 0 10px 0',
            fontFamily: 'var(--font-heading)',
            fontSize: '32px',
            fontWeight: '700',
            color: 'var(--text-glow)',
            letterSpacing: '2px',
            textShadow: '0 0 15px rgba(178, 250, 158, 0.3)'
          }}>
            {t('welcome_title')}
          </h1>
          <p style={{
            color: 'var(--text-primary)',
            fontSize: '14px',
            lineHeight: '1.6',
            margin: '0 auto 20px auto',
            maxWidth: '460px',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.5px'
          }}>
            {t('welcome_subtitle')}
          </p>

          {/* Welcome Screen RU/EN toggle */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
            <button 
              className={`btn ${lang === 'ru' ? 'btn-active' : ''}`} 
              onClick={() => setLang('ru')}
              style={{ padding: '6px 12px', fontSize: '11px' }}
            >
              🇷🇺 РУССКИЙ
            </button>
            <button 
              className={`btn ${lang === 'en' ? 'btn-active' : ''}`} 
              onClick={() => setLang('en')}
              style={{ padding: '6px 12px', fontSize: '11px' }}
            >
              🇬🇧 ENGLISH
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', width: '100%' }}>
            {savedHandle ? (
              <>
                <button
                  className="btn btn-accent"
                  onClick={handleRestoreAccess}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '15px',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-glow-active)',
                    borderWidth: '2px'
                  }}
                >
                  {t('welcome_restore_btn', { folder: folderName.toUpperCase() })}
                </button>
                <button
                  className="btn"
                  onClick={handleSelectFolder}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '13px',
                    justifyContent: 'center'
                  }}
                  disabled={!isSupported}
                >
                  {t('welcome_open_diff_btn')}
                </button>
              </>
            ) : (
              <button
                className="btn btn-accent"
                onClick={handleSelectFolder}
                style={{
                  width: '100%',
                  padding: '18px',
                  fontSize: '15px',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-glow-active)',
                  borderWidth: '2px'
                }}
                disabled={!isSupported}
              >
                {t('welcome_open_btn')}
              </button>
            )}
          </div>

          {!isSupported && (
            <div style={{
              marginTop: '30px',
              padding: '16px',
              background: 'rgba(235,103,103,0.08)',
              border: '1px solid rgba(235,103,103,0.3)',
              borderRadius: '2px',
              textAlign: 'left',
              color: 'var(--danger-color)',
              fontSize: '12px',
              lineHeight: '1.5'
            }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                {t('welcome_browser_warn_title')}
              </strong>
              {t('welcome_browser_warn_body')}
            </div>
          )}

          {isSupported && (
            <div style={{
              marginTop: '35px',
              padding: '16px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '2px',
              textAlign: 'left',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '8px', fontSize: '12px', fontFamily: 'var(--font-heading)', letterSpacing: '1px' }}>
                {t('welcome_expected_struct')}
              </strong>
              {t('welcome_expected_desc')}
              <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <li><strong style={{ color: 'var(--text-glow)' }}>expansion/</strong> (settings, traders, missions...)</li>
                <li><strong style={{ color: 'var(--text-glow)' }}>ExpansionMod/</strong> (AI, Quests, Market, Loadouts...)</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────
  return (
    <div className="app-container">

      {/* ── Global overlays ──────────────────────────────────────────────── */}
      <GlobalSearch
        configs={configs}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        setActiveTab={setActiveTab}
      />
      {isHotkeyOpen && <HotkeyModal onClose={() => setIsHotkeyOpen(false)} />}
      <ConfirmModal
        dialog={confirmDialog}
        onConfirm={() => { confirmDialog?.onConfirm?.(); setConfirmDialog(null); }}
        onCancel={() => { confirmDialog?.onCancel?.(); setConfirmDialog(null); }}
      />

      {/* ── Draft Recovery Modal ──────────────────────────────────────────── */}
      {draftToRestore && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, userSelect: 'none',
        }}>
          <div style={{
            width: '420px', background: 'var(--bg-secondary)',
            border: '1px solid var(--warning-color)',
            padding: '24px', borderRadius: '2px', boxShadow: 'var(--shadow-glow)',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--warning-color)', fontFamily: 'var(--font-mono)', letterSpacing: '1px', fontWeight: 'bold' }}>
                // DRAFT_RECOVERY_SYSTEM
              </div>
              <h3 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '18px' }}>
                UNSAVED SESSION DRAFT FOUND
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
              The editor found unsaved changes from a previous session
              (<strong>{Object.keys(draftToRestore).length} modified files</strong>).
              Restore or discard?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-warning" onClick={handleRestoreDraft} style={{ padding: '8px 16px' }}>
                Restore Draft
              </button>
              <button className="btn btn-danger" onClick={handleDiscardDraft} style={{ padding: '8px 16px' }}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)', fontWeight: '700' }}>
              {t('header_station')}
            </div>
            <h1 style={{ margin: '2px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: '700', color: 'var(--text-glow)', letterSpacing: '1px', textShadow: '0 0 8px rgba(178,250,158,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {t('header_control_center')}
              <span style={{ fontSize: '10px', color: 'var(--text-glow)', border: '1px solid var(--border-glow)', borderRadius: '3px', padding: '1px 5px', opacity: 0.7, letterSpacing: '1px', fontWeight: 'normal', textShadow: 'none' }}>
                v1.2.0 (ONLINE)
              </span>
            </h1>
          </div>

          {/* Directory Connection status widget */}
          {hasAccess && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              padding: '4px 12px',
              borderRadius: '2px',
              fontSize: '12px',
              marginLeft: '12px',
              fontFamily: 'var(--font-mono)',
              lineHeight: '1.2'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('header_dir')}</span>
              <strong style={{ color: 'var(--text-glow)' }}>{folderName.toUpperCase()}</strong>
              <button 
                onClick={handleDisconnect} 
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--danger-color)',
                  cursor: 'pointer',
                  padding: '0 4px',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-heading)',
                  marginLeft: '6px',
                  fontSize: '11px',
                  letterSpacing: '1px'
                }}
                title={t('header_disconnect')}
              >
                {t('header_disconnect')}
              </button>
            </div>
          )}

          {/* Navigation tabs */}
          <nav style={{ display: 'flex', marginLeft: '32px' }}>
            <TabBtn id="dashboard"  label={t('tab_dashboard')} />
            <TabBtn id="economy"    label={t('tab_economy')}    badge={dirtyEconomy} />
            <TabBtn id="quests"     label={t('tab_quests')}     badge={dirtyQuests} />
            <TabBtn id="aibots"     label={t('tab_aibots')}     badge={dirtyAiBots} />
            <TabBtn id="settings"   label={t('tab_settings')}   badge={dirtySettings} />
            <TabBtn id="map"        label={t('tab_map')} />
            <TabBtn id="raw_editor" label={t('tab_raw_editor')} />
          </nav>
        </div>

        {/* Actions row */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Unsaved indicator */}
          {dirtyFiles.size > 0 ? (
            <>
              <span style={{ fontSize: '11px', color: 'var(--warning-color)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center' }}>
                <span className="pulse-dot" />
                {t('header_unsaved')} ({dirtyFiles.size})
              </span>
              <button onClick={handleSaveAll} className="btn btn-warning">
                {t('header_export_package')}
              </button>
              <button onClick={handleDiscardAll} className="btn btn-danger">
                {t('header_discard')}
              </button>
            </>
          ) : (
            !loading && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {t('all_saved')}
              </span>
            )
          )}

          {/* Search button */}
          <button
            className="btn"
            onClick={() => setIsSearchOpen(true)}
            title="Global Search (Ctrl+K)"
            style={{ padding: '8px 12px', fontSize: '14px' }}
          >
            🔍
          </button>

          {/* Language Selector */}
          <button
            className="btn btn-accent"
            onClick={() => setLang(prev => prev === 'ru' ? 'en' : 'ru')}
            style={{ padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
            title="Switch Language / Смена языка"
          >
            {lang === 'ru' ? '🇬🇧 EN' : '🇷🇺 RU'}
          </button>

          {/* Reload */}
          <button onClick={fetchConfigs} className="btn" title={t('header_reload')}>
            {t('header_reload')}
          </button>

          {/* Hotkey cheat sheet */}
          <button
            className="btn"
            onClick={() => setIsHotkeyOpen(true)}
            title={t('header_shortcuts')}
            style={{ padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
          >
            ?
          </button>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────────────── */}
      <main className="main-content">
        {loading ? (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid rgba(149,192,149,0.1)',
              borderTopColor: 'var(--text-glow)', borderRadius: '50%',
              animation: 'spin 1s linear infinite', marginBottom: '16px',
            }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: '700', letterSpacing: '2px' }}>
              READING SERVER DIRECTORY...
            </span>
          </div>
        ) : (
          <>
            {activeTab === 'raw_editor' && (
              <Sidebar
                configs={configs}
                selectedFilePath={selectedFilePath}
                onSelectFile={setSelectedFilePath}
                dirtyFiles={dirtyFiles}
              />
            )}

            <div className="panel">
              {/* Each tab is wrapped in an ErrorBoundary so one crash doesn't break the whole app */}

              {activeTab === 'dashboard' && (
                <ErrorBoundary key="dashboard">
                  <Dashboard
                    configs={configs}
                    schemaReport={schemaReport}
                    onOpenFile={handleOpenFile}
                    onSaveFile={handleSaveFile}
                    onResetFile={handleResetFile}
                    onResetField={handleResetField}
                    onSaveAll={handleSaveAll}
                    onDiscardAll={handleDiscardAll}
                    onFixSyntaxError={handleFixSyntaxError}
                    onFixStructuralError={handleFixStructuralError}
                    onFixAllErrors={handleFixAllErrors}
                    xmlItems={xmlItems}
                    onUpdateXmlItems={setXmlItems}
                    fetchConfigs={fetchConfigs}
                    onShowConfirm={setConfirmDialog}
                    lang={lang}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'economy' && (
                <ErrorBoundary key="economy">
                  <EconomyEditor
                    configs={configs}
                    onChangeField={handleChangeField}
                    onSaveFile={handleSaveFile}
                    xmlItems={xmlItems}
                    onShowConfirm={setConfirmDialog}
                    lang={lang}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'quests' && (
                <ErrorBoundary key="quests">
                  <QuestGraph
                    configs={configs}
                    onChangeField={handleChangeField}
                    onOpenFile={handleOpenFile}
                    onCreateFile={handleCreateFile}
                    onDeleteFile={handleDeleteFile}
                    selectedQuestId={selectedQuestId}
                    onSelectQuest={setSelectedQuestId}
                    onNavigateToMap={handleNavigateToMap}
                    xmlItems={xmlItems}
                    lang={lang}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'aibots' && (
                <ErrorBoundary key="aibots">
                  <AIBotsEditor
                    configs={configs}
                    onChangeField={handleChangeField}
                    onNavigateToMap={handleNavigateToMap}
                    onCreateFile={handleCreateFile}
                    onDeleteFile={handleDeleteFile}
                    onSaveFile={handleSaveFile}
                    xmlItems={xmlItems}
                    setActiveTab={setActiveTab}
                    lang={lang}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'settings' && (
                <ErrorBoundary key="settings">
                  <SettingsEditor
                    configs={configs}
                    onChangeField={handleChangeField}
                    onResetField={handleResetField}
                    onResetFile={handleResetFile}
                    onSaveFile={handleSaveFile}
                    inferredEnums={schemaReport ? schemaReport.inferredEnums : {}}
                    onNavigateToMap={handleNavigateToMap}
                    lang={lang}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'map' && (
                <ErrorBoundary key="map">
                  <TacticalMap
                    configs={configs}
                    onChangeField={handleChangeField}
                    focusedCoordinate={focusedCoordinate}
                    onClearFocus={() => setFocusedCoordinate(null)}
                    onCreateFile={handleCreateFile}
                    onDeleteFile={handleDeleteFile}
                    onSelectQuest={setSelectedQuestId}
                    setActiveTab={setActiveTab}
                    onOpenFile={handleOpenFile}
                    lang={lang}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'raw_editor' && (
                <ErrorBoundary key="raw_editor">
                  <ConfigForm
                    filePath={selectedFilePath}
                    config={configs[selectedFilePath]}
                    onChangeField={handleChangeField}
                    onResetField={handleResetField}
                    onResetFile={handleResetFile}
                    onSaveFile={handleSaveFile}
                    inferredEnums={schemaReport ? schemaReport.inferredEnums : {}}
                    onNavigateToMap={handleNavigateToMap}
                    lang={lang}
                  />
                </ErrorBoundary>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
