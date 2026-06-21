import React, { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { ToastProvider, useToast } from './components/ToastManager';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalSearch from './components/GlobalSearch';
import { validateBeforeExport } from './utils/exportValidator';
import Sidebar from './components/Sidebar';
import { validateConfig } from './utils/diagnostics';
import * as fileService from './services/fileService';
import * as idb from './utils/indexedDB';
import { useTranslation } from './utils/localization';
import { getExpansionModPrefix, getExpansionPrefix, getMpgSpawnerPrefix } from './utils/pathUtils';

// ─── Custom hooks ─────────────────────────────────────────────────────────────
import { useUndoRedo } from './hooks/useUndoRedo';
import { useHotkeys } from './hooks/useHotkeys';

// ─── Extracted UI components ──────────────────────────────────────────────────
import WelcomeScreen from './components/WelcomeScreen';
import DraftModal    from './components/DraftModal';
import FloatingSaveBar from './components/FloatingSaveBar';

// ─── Lazy-loaded tab components ───────────────────────────────────────────────
// Each component is only downloaded when the user first opens that tab,
// cutting the initial JS bundle from ~665 KB → ~220 KB (gzip: ~70 KB).
const Dashboard        = lazy(() => import('./components/Dashboard'));
const EconomyEditor    = lazy(() => import('./components/EconomyEditor'));
const QuestGraph       = lazy(() => import('./components/QuestGraph'));
const AIBotsEditor     = lazy(() => import('./components/AIBotsEditor'));
const SettingsEditor   = lazy(() => import('./components/SettingsEditor'));
const TacticalMap      = lazy(() => import('./components/TacticalMap'));
const MPGSpawnerEditor = lazy(() => import('./components/MPGSpawnerEditor'));
const SearchForLootEditor = lazy(() => import('./components/SearchForLootEditor'));
const RawJsonEditor    = lazy(() => import('./components/RawJsonEditor'));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * deepClone — structuredClone with JSON fallback for older Safari.
 */
function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function setNestedValue(obj, path, value) {
  const newObj = deepClone(obj);
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
  const { t } = useTranslation();
  const sections = [
    {
      title: t('hotkey_section_global'),
      keys: [
        { key: 'Ctrl + K', desc: t('hotkey_key_search') },
        { key: 'Ctrl + S', desc: t('hotkey_key_save') },
        { key: '?',        desc: t('hotkey_key_show_hotkeys') },
      ],
    },
    {
      title: t('hotkey_section_map'),
      keys: [
        { key: 'Delete',  desc: t('hotkey_key_delete') },
        { key: 'Escape',  desc: t('hotkey_key_escape_entity') },
        { key: 'M',       desc: t('hotkey_key_ruler') },
      ],
    },
    {
      title: t('hotkey_section_modals'),
      keys: [
        { key: 'Escape', desc: t('hotkey_key_close_modal') },
        { key: 'Enter',  desc: t('hotkey_key_confirm') },
        { key: '↑ / ↓',  desc: t('hotkey_key_navigate') },
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
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px' }}>{t('hotkey_header_label')}</div>
            <h3 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '18px' }}>{t('hotkey_title')}</h3>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: '4px 10px', fontSize: '12px' }}>{t('hotkey_close')}</button>
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
                      fontFamily: 'var(--font-mono)', fontSize: '12px',
                      color: 'var(--text-glow)', background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)', borderRadius: '3px',
                      padding: '3px 10px', whiteSpace: 'nowrap',
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
  const { t } = useTranslation();
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
          margin: '0 0 20px 0', fontFamily: 'var(--font-mono)', fontSize: '12px',
          color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.6',
          background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
          padding: '12px', borderRadius: '2px', maxHeight: '220px', overflowY: 'auto',
        }}>
          {dialog.body}
        </pre>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel} style={{ padding: '8px 16px' }}>
            {dialog.cancelLabel || t('modal_cancel_default')}
          </button>
          <button className={btnClass} onClick={onConfirm} style={{ padding: '8px 16px' }}>
            {dialog.confirmLabel || t('modal_confirm_default')}
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

// ─── Lazy tab Suspense fallback ───────────────────────────────────────────────

function TabLoadingSpinner() {
  return (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
      <div style={{
        width: '32px', height: '32px',
        border: '3px solid rgba(149,192,149,0.1)',
        borderTopColor: 'var(--text-glow)', borderRadius: '50%',
        animation: 'spin 1s linear infinite', marginBottom: '12px',
      }} />
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', letterSpacing: '2px', opacity: 0.6 }}>
        LOADING...
      </span>
    </div>
  );
}

// ─── TabBtn — defined outside AppContent so React doesn't recreate it each render
const TabBtn = ({ id, label, badge, errorCount, activeTab, setActiveTab }) => {
  const hasBadge = badge > 0;
  const hasErrors = errorCount > 0;
  
  // Calculate right offsets depending on which badges are displayed
  let badgeRight = '4px';
  if (hasErrors) {
    badgeRight = '32px';
  }

  return (
    <button
      className={`nav-tab ${activeTab === id ? 'active' : ''}`}
      onClick={() => setActiveTab(id)}
      style={{ position: 'relative', paddingRight: (hasBadge && hasErrors) ? '54px' : (hasBadge || hasErrors) ? '32px' : '16px' }}
    >
      {label}
      {hasBadge && (
        <span style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: badgeRight,
          fontSize: '9px', fontFamily: 'var(--font-mono)',
          color: 'var(--warning-color)', background: 'rgba(235,214,103,0.15)',
          border: '1px solid rgba(235,214,103,0.3)', borderRadius: '8px',
          padding: '0 5px', lineHeight: '14px', fontWeight: 'bold',
          transition: 'all 0.2s',
        }}>
          {badge}
        </span>
      )}
      {hasErrors && (
        <span style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: '4px',
          fontSize: '9px', fontFamily: 'var(--font-mono)',
          color: '#ff4d4d', background: 'rgba(255,77,77,0.15)',
          border: '1px solid rgba(255,77,77,0.3)', borderRadius: '8px',
          padding: '0 5px', lineHeight: '14px', fontWeight: 'bold',
          boxShadow: '0 0 6px rgba(255,77,77,0.2)',
          transition: 'all 0.2s',
        }}>
          ⚠ {errorCount}
        </span>
      )}
    </button>
  );
};

// Helper to parse button text and wrap label part in responsive class
const renderResponsiveButtonText = (text) => {
  if (!text) return null;
  const parts = text.split(' ');
  if (parts.length > 1 && parts[0].length <= 3) {
    return (
      <>
        <span>{parts[0]}</span>
        <span className="btn-text-responsive" style={{ marginLeft: '4px' }}>{parts.slice(1).join(' ')}</span>
      </>
    );
  }
  return <span>{text}</span>;
};

// ─── Password Lock Screen Component ──────────────────────────────────────────
function PasswordLockScreen({ onAuthenticate }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(false);

    try {
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Default password "PZ2033" SHA-256 hash:
      // 7286226dc6dcd6e936650cc1d7c2059f9f91d224485ab288079a297e41302509
      // To change this password, replace the hash string below with your new SHA-256 hash
      const targetHash = '7286226dc6dcd6e936650cc1d7c2059f9f91d224485ab288079a297e41302509';

      if (hashHex === targetHash) {
        onAuthenticate();
      } else {
        setError(true);
        setPassword('');
      }
    } catch (err) {
      console.error('Crypto error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lock-screen-wrapper">
      <div className="lock-screen-card">
        <div className="lock-screen-icon">🔒</div>
        <h2>{t('auth_title')}</h2>
        <p>{t('auth_subtitle')}</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className={`lock-screen-input ${error ? 'error' : ''}`}
            placeholder={t('auth_placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
          />
          {error && <div className="lock-screen-error-msg">{t('auth_error')}</div>}
          <button type="submit" className="btn btn-accent lock-screen-btn" disabled={loading}>
            {loading ? '...' : t('auth_btn')}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── AppContent (all logic lives here) ───────────────────────────────────────

function AppContent() {
  const toast = useToast();
  const { t, lang, setLang } = useTranslation();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('dayz_editor_authenticated') === 'true';
  });

  const handleLogout = useCallback(() => {
    localStorage.removeItem('dayz_editor_authenticated');
    setIsAuthenticated(false);
  }, []);


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

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const {
    configs, setConfigs, updateConfigs,
    handleUndo, handleRedo,
    undoStack, redoStack,
  } = useUndoRedo({ toast, lang });

  const [schemaReport, setSchemaReport] = useState(null);
  const [backups, setBackups]           = useState([]);

  // Store latest handlers in refs so hotkey listeners never go stale
  const undoRef = useRef(handleUndo);
  const redoRef = useRef(handleRedo);
  useEffect(() => {
    undoRef.current = handleUndo;
    redoRef.current = handleRedo;
  });

  // ── File access state ─────────────────────────────────────────────────────
  const [hasAccess, setHasAccess]     = useState(false);
  const [folderName, setFolderName]   = useState('');
  const [savedHandle, setSavedHandle] = useState(null);
  const [loading, setLoading]         = useState(true);

  // ── Navigation state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('dayz_editor_active_tab') || 'dashboard'
  );
  const [selectedFilePath, setSelectedFilePath] = useState(
    () => localStorage.getItem('dayz_editor_selected_file') || null
  );
  const [focusedCoordinate, setFocusedCoordinate]   = useState(null);
  const [coordinatePicker, setCoordinatePicker]     = useState(null);
  const [draftToRestore, setDraftToRestore]         = useState(null);
  const [selectedQuestId, setSelectedQuestId]       = useState(() => {
    const saved = localStorage.getItem('dayz_editor_selected_quest_id');
    return saved ? Number(saved) : null;
  });
  const [selectedSpawnerFilePath, setSelectedSpawnerFilePath]   = useState(null);
  const [selectedSpawnerTriggerIdx, setSelectedSpawnerTriggerIdx] = useState(null);
  const [xmlItems, setXmlItems]                     = useState([]);
  const [highlightedQuestIds, setHighlightedQuestIds] = useState([]);

  // ── Map settings ──────────────────────────────────────────────────────────
  const [mapSize, setMapSize]             = useState(10000);
  const [isCustomPreset, setIsCustomPreset] = useState(false);
  const [customSizeStr, setCustomSizeStr]   = useState('10000');
  const [layers, setLayers] = useState({
    airdrops: true, safezones: true, npcs: true, patrols: true,
    traders: true, questObjectives: true, nogoareas: true,
    roamingLocations: true, spawner: true,
  });

  // ── UI overlay state ──────────────────────────────────────────────────────
  const [isSearchOpen, setIsSearchOpen]         = useState(false);
  const [isHotkeyOpen, setIsHotkeyOpen]         = useState(false);
  const [isSaveBarMinimized, setIsSaveBarMinimized] = useState(false);
  const [confirmDialog, setConfirmDialog]       = useState(null);
  const [dashboardSubTab, setDashboardSubTab]   = useState('status');
  const [isMoreOpen, setIsMoreOpen]             = useState(false);

  // ── Hotkeys — registered after handleSaveAll is defined ──────────────────
  // handleSaveAll is passed via ref so the listener never captures a stale closure.

  // ── localStorage persistence ──────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('dayz_editor_active_tab', activeTab); }, [activeTab]);
  useEffect(() => {
    if (selectedFilePath) localStorage.setItem('dayz_editor_selected_file', selectedFilePath);
    else localStorage.removeItem('dayz_editor_selected_file');
  }, [selectedFilePath]);
  useEffect(() => {
    if (selectedQuestId !== null && selectedQuestId !== undefined)
      localStorage.setItem('dayz_editor_selected_quest_id', selectedQuestId);
    else
      localStorage.removeItem('dayz_editor_selected_quest_id');
  }, [selectedQuestId]);

  // ── Initialisation on mount ───────────────────────────────────────────────
  useEffect(() => {
    // Restore saved directory handle
    idb.getSavedHandle()
      .then(handle => {
        if (handle) { setSavedHandle(handle); setFolderName(handle.name); }
      })
      .catch(err => console.error('Failed to load saved directory handle', err));

    // Load XML items (with legacy localStorage migration)
    idb.getXmlItems()
      .then(items => {
        if (items && items.length > 0) {
          setXmlItems(items);
        } else {
          try {
            const legacy = localStorage.getItem('dayz_editor_xml_items');
            if (legacy) {
              const parsed = JSON.parse(legacy);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setXmlItems(parsed);
                idb.saveXmlItems(parsed).catch(e => console.error(e));
                localStorage.removeItem('dayz_editor_xml_items');
              }
            }
          } catch (e) {
            console.error('Failed to migrate xml items', e);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load XML items from IndexedDB', err);
        setLoading(false);
      });
  }, []);

  // ── xmlItems helpers ──────────────────────────────────────────────────────
  const handleUpdateXmlItems = useCallback((items) => {
    setXmlItems(items);
    if (items && items.length > 0) {
      idb.saveXmlItems(items).catch(err => console.error(err));
      localStorage.removeItem('dayz_editor_xml_items');
    } else {
      idb.clearXmlItems().catch(err => console.error(err));
      localStorage.removeItem('dayz_editor_xml_items');
    }
  }, []);

  const handleClearXmlDatabase = () => {
    setConfirmDialog({
      title: t('cmd_palette_clear_db') || 'Clear Server Items Database',
      body: t('modal_confirm_clear_db_body') || 'Are you sure you want to clear the loaded types.xml database from IndexedDB?',
      severity: 'danger',
      confirmLabel: t('xml_clear_db_btn') || 'Clear Database',
      cancelLabel: t('confirm_cancel') || 'Cancel',
      onConfirm: () => {
        handleUpdateXmlItems([]);
        toast.success(t('toast_db_cleared') || 'Database cleared successfully!');
      },
    });
  };

  // ── Backups ───────────────────────────────────────────────────────────────
  const loadBackups = useCallback(() => {
    if (!fileService.hasDirectoryAccess()) return;
    fileService.listBackups()
      .then(list => setBackups(list || []))
      .catch(err => console.error('Failed to load backups', err));
  }, []);

  // ── Fetch configs from File System ────────────────────────────────────────
  const fetchConfigs = useCallback(() => {
    if (!fileService.hasDirectoryAccess()) return;
    setLoading(true);
    fileService.getConfigs()
      .then(async data => {
        const loadedConfigs = {};
        Object.entries(data.configs).forEach(([path, value]) => {
          loadedConfigs[path] = {
            ...value,
            originalContent: value.success ? deepClone(value.content) : null,
            isDirty: false,
          };
        });

        // Draft recovery (legacy localStorage → IndexedDB migration)
        try {
          let draftData = null;
          const rawDraft = localStorage.getItem('dayz_editor_draft');
          if (rawDraft) {
            draftData = JSON.parse(rawDraft);
            localStorage.removeItem('dayz_editor_draft');
            if (draftData) await idb.saveDraft(draftData);
          } else {
            draftData = await idb.getDraft();
          }
          if (draftData && Object.keys(draftData).length > 0) {
            setDraftToRestore(draftData);
          }
        } catch (e) {
          console.error('Failed to read draft', e);
        }

        // Restore persisted settings
        try {
          const settings = await fileService.getSettings();
          if (settings) {
            if (settings.mapSize !== undefined)       setMapSize(settings.mapSize);
            if (settings.isCustomPreset !== undefined) setIsCustomPreset(settings.isCustomPreset);
            if (settings.customSizeStr !== undefined) setCustomSizeStr(settings.customSizeStr);
            if (settings.layers !== undefined)        setLayers(settings.layers);
            if (settings.lang !== undefined)          setLang(settings.lang);
            if (settings.activeTab !== undefined)     setActiveTab(settings.activeTab);
          }
        } catch (e) {
          console.error('Failed to load settings', e);
        }

        setConfigs(loadedConfigs);
        setSchemaReport(data.schemaReport);
        loadBackups();
        setLoading(false);
        toast.success(t('toast_configs_loaded'));
      })
      .catch(err => {
        console.error('Failed to load configs', err);
        toast.error(t('toast_load_failed', { error: err.message }));
        setLoading(false);
      });
  }, [toast, loadBackups, t, setLang]);

  // ── Auto-save draft to IndexedDB (debounced 1 s) ──────────────────────────
  useEffect(() => {
    if (loading || !hasAccess) return;
    const handler = setTimeout(() => {
      const dirtyData = {};
      Object.entries(configs).forEach(([path, file]) => {
        if (file.success && file.isDirty) dirtyData[path] = file.content;
      });
      if (Object.keys(dirtyData).length > 0) {
        idb.saveDraft(dirtyData).catch(e => console.error('Failed to save draft', e));
      } else {
        idb.clearDraft().catch(e => console.error('Failed to clear draft', e));
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [configs, loading, hasAccess]);

  // ── Backup restore ────────────────────────────────────────────────────────
  const handleRestoreBackup = useCallback((backupName) => {
    setConfirmDialog({
      title: t('modal_confirm_restore_title') || 'RESTORE BACKUP',
      body: t('modal_confirm_restore_body', { backup: backupName }) || `Are you sure you want to restore backup "${backupName}"? All unsaved changes will be overwritten!`,
      severity: 'warning',
      confirmLabel: t('modal_confirm_restore_btn') || 'RESTORE',
      cancelLabel: t('modal_confirm_cancel') || 'CANCEL',
      onConfirm: async () => {
        try {
          setLoading(true);
          await fileService.restoreBackup(backupName);
          toast.success(t('toast_restore_success', { backup: backupName }) || `Backup "${backupName}" restored!`);
          fetchConfigs();
        } catch (err) {
          toast.error(`Restoration failed: ${err.message}`);
          setLoading(false);
        }
      },
    });
  }, [fetchConfigs, t]);

  // ── Folder selection / connection ─────────────────────────────────────────
  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const granted = await fileService.verifyPermission(handle, 'readwrite');
      if (granted) {
        fileService.setDirectoryHandle(handle);
        await idb.saveHandle(handle);
        setSavedHandle(handle);
        setFolderName(handle.name);
        setHasAccess(true);
        fetchConfigs();
      } else {
        toast.error(t('toast_write_denied'));
        setLoading(false);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        toast.error(t('toast_select_failed', { error: e.message }));
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
        toast.error(t('toast_restore_denied'));
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      toast.error(t('toast_restore_access_failed', { error: e.message }));
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
    toast.info(t('toast_disconnected'));
  };

  // ── Draft recovery ────────────────────────────────────────────────────────
  const handleRestoreDraft = () => {
    if (!draftToRestore) return;
    setConfigs(prev => {
      const updated = { ...prev };
      Object.entries(draftToRestore).forEach(([filePath, content]) => {
        if (updated[filePath]) {
          const restoredContent = deepClone(content);
          const origContent = updated[filePath].originalContent;
          const isDirty = origContent
            ? JSON.stringify(restoredContent) !== JSON.stringify(origContent)
            : true;
          updated[filePath] = { ...updated[filePath], content: restoredContent, isDirty };
        }
      });
      return updated;
    });
    setDraftToRestore(null);
    idb.clearDraft().catch(e => console.error(e));
    toast.success(t('toast_draft_restored', { count: Object.keys(draftToRestore).length }));
  };

  const handleDiscardDraft = () => {
    try { localStorage.removeItem('dayz_editor_draft'); } catch (e) {}
    idb.clearDraft().catch(e => console.error(e));
    setDraftToRestore(null);
    toast.info(t('toast_draft_discarded'));
  };

  // ── Field / file mutations ────────────────────────────────────────────────
  const handleChangeField = (filePath, pathArray, newValue) => {
    updateConfigs(prev => {
      const file = prev[filePath];
      if (!file || !file.success) return prev;
      let newContent;
      if (pathArray.length === 0) {
        newContent = typeof newValue === 'function' ? newValue(file.content) : newValue;
      } else {
        const currentValue = getNestedValue(file.content, pathArray);
        const valToSet = typeof newValue === 'function' ? newValue(currentValue) : newValue;
        newContent = setNestedValue(file.content, pathArray, valToSet);
      }
      const isDirty = file.originalContent
        ? JSON.stringify(newContent) !== JSON.stringify(file.originalContent)
        : true;
      return { ...prev, [filePath]: { ...file, content: newContent, isDirty } };
    });
  };

  const handleResetField = (filePath, pathArray) => {
    updateConfigs(prev => {
      const file = prev[filePath];
      if (!file || !file.success || !file.originalContent) return prev;
      const origVal = getNestedValue(file.originalContent, pathArray);
      const valToSet = origVal === undefined ? null : deepClone(origVal);
      const newContent = setNestedValue(file.content, pathArray, valToSet);
      const isDirty = JSON.stringify(newContent) !== JSON.stringify(file.originalContent);
      return { ...prev, [filePath]: { ...file, content: newContent, isDirty } };
    });
  };

  const handleResetFile = (filePath) => {
    updateConfigs(prev => {
      const file = prev[filePath];
      if (!file || !file.originalContent) return prev;
      return { ...prev, [filePath]: { ...file, content: deepClone(file.originalContent), isDirty: false } };
    });
  };

  // ── Save single file ──────────────────────────────────────────────────────
  const persistSettings = useCallback(() => {
    fileService.saveSettings({ mapSize, isCustomPreset, customSizeStr, layers, lang, activeTab })
      .catch(err => console.error(err));
  }, [mapSize, isCustomPreset, customSizeStr, layers, lang, activeTab]);

  const handleSaveFile = (filePath) => {
    const file = configs[filePath];
    if (!file || !file.success) return;
    fileService.saveFile(filePath, file.content)
      .then(() => {
        setConfigs(prev => {
          const f = prev[filePath];
          return { ...prev, [filePath]: { ...f, originalContent: deepClone(f.content), isDirty: false } };
        });
        toast.success(t('toast_file_saved', { file: filePath.split('/').pop() }));
        persistSettings();
      })
      .catch(err => toast.error(t('toast_save_failed', { error: err.message })));
  };

  // ── Save all ──────────────────────────────────────────────────────────────
  const doSaveAll = useCallback((dirtyFilesList) => {
    fileService.saveAll(dirtyFilesList)
      .then(() => {
        setConfigs(prev => {
          const updated = { ...prev };
          dirtyFilesList.forEach(df => {
            const f = updated[df.filePath];
            updated[df.filePath] = { ...f, originalContent: deepClone(f.content), isDirty: false };
          });
          return updated;
        });
        toast.success(t('toast_package_exported', { count: dirtyFilesList.length }));
        persistSettings();
      })
      .catch(err => toast.error(t('toast_export_failed', { error: err.message })));
  }, [toast, persistSettings]);

  const handleSaveAll = useCallback(() => {
    const dirtyFilesList = [];
    Object.entries(configs).forEach(([path, file]) => {
      if (file.success && file.isDirty) {
        dirtyFilesList.push({ filePath: path, content: file.content });
      }
    });
    if (dirtyFilesList.length === 0) { toast.info(t('toast_no_modified')); return; }

    const issues = validateBeforeExport(configs);
    if (issues.length > 0) {
      const errorCount   = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;
      const preview = issues.slice(0, 8).map(i => `[${i.severity.toUpperCase()}] ${i.message}`).join('\n');
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
  }, [configs, doSaveAll, t, toast]);

  // Wire handleSaveAll into the hotkeys hook via ref — avoids re-registering listener
  const handleSaveAllRef = useRef(handleSaveAll);
  useEffect(() => { handleSaveAllRef.current = handleSaveAll; }, [handleSaveAll]);

  // ── Hotkeys ───────────────────────────────────────────────────────────────
  // Placed after handleSaveAll so the ref is already populated on first render.
  useHotkeys({
    hasAccess,
    setActiveTab,
    setIsSearchOpen,
    setIsHotkeyOpen,
    setConfirmDialog,
    handleSaveAll,
    undoRef,
    redoRef,
  });

  // ── Discard all ───────────────────────────────────────────────────────────
  const handleDiscardAll = () => {
    setConfirmDialog({
      title: t('modal_confirm_discard_title') || 'DISCARD ALL CHANGES',
      body: t('modal_confirm_discard_body') || 'This will revert ALL unsaved modifications in memory back to the last saved state on disk.\n\nThis action cannot be undone.',
      severity: 'danger',
      confirmLabel: t('modal_confirm_discard_btn') || 'DISCARD ALL',
      cancelLabel: t('modal_confirm_cancel') || 'CANCEL',
      onConfirm: () => {
        updateConfigs(prev => {
          const reverted = { ...prev };
          Object.keys(reverted).forEach(path => {
            const file = reverted[path];
            if (file.originalContent) {
              reverted[path] = { ...file, content: deepClone(file.originalContent), isDirty: false };
            }
          });
          return reverted;
        });
        toast.warning(t('toast_changes_discarded'));
      },
    });
  };

  // ── Create / Delete files ─────────────────────────────────────────────────
  const handleCreateFile = (filePath, content) => {
    fileService.saveFile(filePath, content)
      .then(() => {
        const clonedContent = deepClone(content);
        setConfigs(prev => ({
          ...prev,
          [filePath]: {
            success: true, content: clonedContent,
            originalContent: deepClone(content), isDirty: false,
            sizeBytes: JSON.stringify(content).length,
          },
        }));
        toast.success(t('toast_file_created', { file: filePath.split('/').pop() }));
        persistSettings();
      })
      .catch(err => toast.error(t('toast_create_failed', { error: err.message })));
  };

  const handleImportFile = (fileName, contentText) => {
    try {
      const parsed = JSON.parse(contentText);
      let folder = 'imported';
      const nameLower = fileName.toLowerCase();
      const expansionModPrefix = getExpansionModPrefix(configs);
      const expansionPrefix = getExpansionPrefix(configs);
      const mpgSpawnerPrefix = getMpgSpawnerPrefix(configs);

      if (nameLower.includes('quest_') || nameLower.includes('npc_') || nameLower.includes('objective_')) {
        folder = `${expansionModPrefix}Quests/Imported`;
      } else if (nameLower.includes('settings')) {
        folder = `${expansionPrefix || expansionModPrefix}Settings`;
      } else if (nameLower.includes('spawner') || nameLower.includes('point_')) {
        folder = `${mpgSpawnerPrefix}Points`;
      } else if (nameLower.includes('market') || nameLower.includes('traders')) {
        folder = `${expansionModPrefix}Market`;
      }

      const filePath = `${folder}/${fileName}`;

      setConfigs(prev => ({
        ...prev,
        [filePath]: {
          success: true,
          content: parsed,
          originalContent: parsed,
          isDirty: true,
          sizeBytes: contentText.length,
          isImported: true
        }
      }));
      setSelectedFilePath(filePath);
      setActiveTab('raw_editor');
      toast.success(t('toast_file_imported', { file: fileName }) || `Imported ${fileName} to memory!`);
    } catch (err) {
      const filePath = `imported/${fileName}`;
      setConfigs(prev => ({
        ...prev,
        [filePath]: {
          success: false,
          error: err.message,
          originalContent: null,
          isDirty: true,
          sizeBytes: contentText.length,
          isImported: true
        }
      }));
      setSelectedFilePath(filePath);
      setActiveTab('raw_editor');
      toast.error((lang === 'ru' ? 'Ошибка синтаксиса в импортируемом файле: ' : 'Syntax error in imported file: ') + err.message);
    }
  };

  const handleDeleteFile = (filePath) => {
    fileService.deleteFile(filePath)
      .then(() => {
        setConfigs(prev => { const copy = { ...prev }; delete copy[filePath]; return copy; });
        toast.success(t('toast_file_deleted', { file: filePath.split('/').pop() }));
        persistSettings();
      })
      .catch(err => toast.error(t('toast_delete_failed', { error: err.message })));
  };

  // ── Fix handlers ──────────────────────────────────────────────────────────
  const handleFixSyntaxError = (filePath) => {
    fileService.fixSyntax(filePath)
      .then(data => {
        setConfigs(prev => ({
          ...prev,
          [filePath]: {
            success: true, content: data.content,
            originalContent: deepClone(data.content), isDirty: false,
            sizeBytes: JSON.stringify(data.content).length,
          },
        }));
        toast.success(t('toast_syntax_repaired', { file: filePath.split('/').pop() }));
      })
      .catch(err => toast.error(t('toast_repair_failed', { error: err.message })));
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
            success: true, content: data.content,
            originalContent: deepClone(data.content), isDirty: false,
            sizeBytes: JSON.stringify(data.content).length,
          },
        }));
        syntaxFixCount++;
      } catch (e) { console.error(`Repair failed for ${filePath}:`, e); }
    }

    let structuralFixCount = 0;
    const questIds = new Set();
    const marketCategories = new Set();
    const marketItems = new Set();
    Object.keys(configs).forEach(p => {
      const file = configs[p];
      if (file.success && file.content) {
        if (p.toLowerCase().includes('quests/quests/quest_') && file.content.ID !== undefined)
          questIds.add(file.content.ID);
        if (p.toLowerCase().includes('market/')) {
          marketCategories.add(p.split('/').pop().replace('.json', '').toLowerCase());
          if (Array.isArray(file.content.Items))
            file.content.Items.forEach(i => { if (i.ClassName) marketItems.add(i.ClassName.toLowerCase()); });
        }
      }
    });

    updateConfigs(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(filePath => {
        const file = updated[filePath];
        if (!file.success) return;
        const fileSchema = schemaReport?.files?.[filePath]?.schema;
        if (fileSchema) {
          const fileErrors = validateConfig(file.content, fileSchema, filePath, questIds, marketCategories, marketItems, updated);
          let content = deepClone(file.content);
          let changed = false;
          fileErrors.forEach(err => {
            if (err.fixable) { content = setNestedValue(content, err.path, err.defaultValue); structuralFixCount++; changed = true; }
          });
          if (changed) {
            const isDirty = file.originalContent ? JSON.stringify(content) !== JSON.stringify(file.originalContent) : true;
            updated[filePath] = { ...file, content, isDirty };
          }
        }
      });
      return updated;
    });
    toast.success(t('toast_autofix_done', { syntax: syntaxFixCount, struct: structuralFixCount }));
  };

  // ── Navigation helpers ────────────────────────────────────────────────────
  const handleOpenFile = (filePath) => { setSelectedFilePath(filePath); setActiveTab('raw_editor'); };

  const handleNavigateToMap = (coordinates) => {
    let x = 0, z = 0;
    let coords = coordinates;
    if (coords && typeof coords === 'object' && !Array.isArray(coords)) {
      if (Array.isArray(coords.Position))     coords = coords.Position;
      else if (Array.isArray(coords.Center))   coords = coords.Center;
      else if (Array.isArray(coords.Location)) coords = coords.Location;
      else if (Array.isArray(coords.Waypoint)) coords = coords.Waypoint;
      else if (typeof coords.x === 'number' && typeof coords.z === 'number') {
        x = coords.x; z = coords.z;
        setFocusedCoordinate({ x, z }); setActiveTab('map'); return;
      }
    }
    if (Array.isArray(coords)) { x = coords[0]; z = coords.length === 3 ? coords[2] : coords[1]; }
    setFocusedCoordinate({ x, z }); setActiveTab('map');
  };

  const handleNavigateToQuestGraph = (questId, cycleIds = []) => {
    setSelectedQuestId(questId); setHighlightedQuestIds(cycleIds); setActiveTab('quests');
  };

  // ── Computed dirty set ────────────────────────────────────────────────────
  const dirtyFiles = new Set(
    Object.keys(configs).filter(path => configs[path].success && configs[path].isDirty)
  );

  // Warn on accidental tab close when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirtyFiles.size > 0) { e.preventDefault(); e.returnValue = ''; return ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyFiles.size]);

  // ─── Count tab-specific dirty files ──────────────────────────────────────
  const dirtyFilesArr = [...dirtyFiles];
  const dirtyEconomy  = dirtyFilesArr.filter(p => p.toLowerCase().includes('market/') || p.toLowerCase().includes('traders/')).length;
  const dirtyQuests   = dirtyFilesArr.filter(p => p.toLowerCase().includes('quests/')).length;
  const dirtyAiBots   = dirtyFilesArr.filter(p => p.includes('aipatrol') || p.includes('roaming')).length;
  const dirtySettings = dirtyFilesArr.filter(p => p.includes('settings')).length;
  const dirtySpawner  = dirtyFilesArr.filter(p => p.toLowerCase().includes('mpg_spawner/') || p.toLowerCase().includes('points/')).length;
  const dirtySearchForLoot = dirtyFilesArr.filter(p => p.toLowerCase().includes('searchforloot/')).length;

  // ─── Count tab-specific syntax errors (files failing to parse) ───────────
  const errorFilesArr = Object.keys(configs).filter(p => !configs[p].success);
  const errorEconomy  = errorFilesArr.filter(p => p.toLowerCase().includes('market/') || p.toLowerCase().includes('traders/')).length;
  const errorQuests   = errorFilesArr.filter(p => p.toLowerCase().includes('quests/')).length;
  const errorAiBots   = errorFilesArr.filter(p => p.includes('aipatrol') || p.includes('roaming')).length;
  const errorSettings = errorFilesArr.filter(p => p.includes('settings')).length;
  const errorSpawner  = errorFilesArr.filter(p => p.toLowerCase().includes('mpg_spawner/') || p.toLowerCase().includes('points/')).length;
  const errorSearchForLoot = errorFilesArr.filter(p => p.toLowerCase().includes('searchforloot/')).length;

  // ── Password Auth Gate ────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <PasswordLockScreen
        onAuthenticate={() => {
          localStorage.setItem('dayz_editor_authenticated', 'true');
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // ── Welcome Screen ────────────────────────────────────────────────────────
  if (!hasAccess && !loading) {
    return (
      <WelcomeScreen
        savedHandle={savedHandle}
        folderName={folderName}
        onRestoreAccess={handleRestoreAccess}
        onSelectFolder={handleSelectFolder}
        onLogout={handleLogout}
      />
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <div className="app-container">

      {/* ── Global overlays ────────────────────────────────────────────────── */}
      <GlobalSearch
        configs={configs}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        setActiveTab={setActiveTab}
        onFixAllErrors={handleFixAllErrors}
        onClearXmlDatabase={handleClearXmlDatabase}
        onNavigateToSubTab={setDashboardSubTab}
      />
      {isHotkeyOpen && <HotkeyModal onClose={() => setIsHotkeyOpen(false)} />}
      <ConfirmModal
        dialog={confirmDialog}
        onConfirm={() => { confirmDialog?.onConfirm?.(); setConfirmDialog(null); }}
        onCancel={() => { confirmDialog?.onCancel?.(); setConfirmDialog(null); }}
      />

      {/* ── Draft Recovery Modal ────────────────────────────────────────────── */}
      <DraftModal
        draftToRestore={draftToRestore}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="header" style={{ flexShrink: 0 }}>
        <div className="header-left">
          <div className="header-title">
            <h1 className="header-title-main">
              {t('header_control_center')}
              <span className="header-title-version">v1.2.0 (ONLINE)</span>
            </h1>
          </div>

          {hasAccess && (
            <div className="header-status">
              <span className="header-status-label">{t('header_dir')}</span>
              <strong className="header-status-value" title={folderName.toUpperCase()}>{folderName.toUpperCase()}</strong>
              <button onClick={handleDisconnect} className="header-status-btn" title={t('header_disconnect')}>
                <span className="btn-text-responsive">{t('header_disconnect')}</span>
                <span className="btn-icon-responsive">✖</span>
              </button>
              <button onClick={handleLogout} className="header-status-btn" title={t('auth_logout')} style={{ marginLeft: '6px' }}>
                <span className="btn-text-responsive">{t('auth_logout')}</span>
                <span className="btn-icon-responsive">🔑</span>
              </button>
            </div>
          )}
        </div>


        {/* Navigation tabs */}
        <nav className="header-nav-tabs">
          <TabBtn id="dashboard"  label={t('tab_dashboard')}                               activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabBtn id="map"        label={t('tab_map')}                                     activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabBtn id="economy"    label={t('tab_economy')}    badge={dirtyEconomy}   errorCount={errorEconomy}  activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabBtn id="quests"     label={t('tab_quests')}     badge={dirtyQuests}    errorCount={errorQuests}   activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabBtn id="aibots"     label={t('tab_aibots')}     badge={dirtyAiBots}    errorCount={errorAiBots}   activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Consolidated "More" Dropdown Menu */}
          {(() => {
            const moreBadge = dirtySettings + dirtySpawner + dirtySearchForLoot;
            const moreErrors = errorSettings + errorSpawner + errorSearchForLoot;
            const isMoreActive = ['settings', 'spawner', 'searchforloot', 'raw_editor'].includes(activeTab);

            return (
              <div 
                className="dropdown-tabs-wrapper"
                onMouseEnter={() => setIsMoreOpen(true)}
                onMouseLeave={() => setIsMoreOpen(false)}
              >
                <button 
                  className={`nav-tab ${isMoreActive ? 'active' : ''}`}
                  onClick={() => setIsMoreOpen(prev => !prev)}
                  style={{ 
                    position: 'relative', 
                    paddingRight: (moreBadge > 0 && moreErrors > 0) ? '54px' : (moreBadge > 0 || moreErrors > 0) ? '32px' : '16px' 
                  }}
                >
                  {t('tab_more')} ▾
                  {moreBadge > 0 && (
                    <span style={{
                      position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: moreErrors > 0 ? '32px' : '4px',
                      fontSize: '9px', fontFamily: 'var(--font-mono)',
                      color: 'var(--warning-color)', background: 'rgba(235,214,103,0.15)',
                      border: '1px solid rgba(235,214,103,0.3)', borderRadius: '8px',
                      padding: '0 5px', lineHeight: '14px', fontWeight: 'bold'
                    }}>
                      {moreBadge}
                    </span>
                  )}
                  {moreErrors > 0 && (
                    <span style={{
                      position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: '4px',
                      fontSize: '9px', fontFamily: 'var(--font-mono)',
                      color: '#ff4d4d', background: 'rgba(255,77,77,0.15)',
                      border: '1px solid rgba(255,77,77,0.3)', borderRadius: '8px',
                      padding: '0 5px', lineHeight: '14px', fontWeight: 'bold',
                      boxShadow: '0 0 6px rgba(255,77,77,0.2)'
                    }}>
                      ⚠ {moreErrors}
                    </span>
                  )}
                </button>
                
                {isMoreOpen && (
                  <div className="dropdown-tabs-menu" onClick={() => setIsMoreOpen(false)}>
                    <TabBtn id="settings"   label={t('tab_settings')}   badge={dirtySettings}  errorCount={errorSettings} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabBtn id="spawner"    label={t('tab_spawner')}    badge={dirtySpawner}   errorCount={errorSpawner}  activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabBtn id="searchforloot" label={t('tab_searchforloot')} badge={dirtySearchForLoot} errorCount={errorSearchForLoot} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabBtn id="raw_editor" label={t('tab_raw_editor')}                               activeTab={activeTab} setActiveTab={setActiveTab} />
                  </div>
                )}
              </div>
            );
          })()}
        </nav>

        {/* Actions row */}
        <div className="header-actions">
          <button
            className="btn" onClick={handleUndo} disabled={undoStack.length === 0}
            title={lang === 'ru' ? 'Отменить (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
            style={{ opacity: undoStack.length === 0 ? 0.4 : 1, cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer', padding: '8px 12px', fontSize: '14px' }}
          >↩️</button>

          <button
            className="btn" onClick={handleRedo} disabled={redoStack.length === 0}
            title={lang === 'ru' ? 'Вернуть (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
            style={{ opacity: redoStack.length === 0 ? 0.4 : 1, cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer', padding: '8px 12px', fontSize: '14px' }}
          >↪️</button>

          <button className="btn" onClick={() => setIsSearchOpen(true)} title="Global Search (Ctrl+K)" style={{ padding: '8px 12px', fontSize: '14px' }}>🔍</button>

          <button
            className="btn btn-accent"
            onClick={() => setLang(prev => prev === 'ru' ? 'en' : 'ru')}
            style={{ fontFamily: 'var(--font-mono)' }}
            title="Switch Language / Смена языка"
          >
            {renderResponsiveButtonText(lang === 'ru' ? 'EN' : 'RU')}
          </button>

          <button onClick={fetchConfigs} className="btn" title={t('header_reload')}>
            {renderResponsiveButtonText(t('header_reload'))}
          </button>

          <button className="btn" onClick={() => setIsHotkeyOpen(true)} title={t('header_shortcuts')} style={{ fontFamily: 'var(--font-mono)' }}>?</button>
        </div>
      </header>

      {/* ── Main Workspace ──────────────────────────────────────────────────── */}
      <main className="main-content">
        {loading ? (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(149,192,149,0.1)', borderTopColor: 'var(--text-glow)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: '700', letterSpacing: '2px' }}>{t('app_loading')}</span>
          </div>
        ) : (
          <>
            {activeTab === 'raw_editor' && (
              <Sidebar
                configs={configs}
                selectedFilePath={selectedFilePath}
                onSelectFile={setSelectedFilePath}
                dirtyFiles={dirtyFiles}
                backups={backups}
                onRestoreBackup={handleRestoreBackup}
                onImportFile={handleImportFile}
              />
            )}

            <div className="panel">
              {/* Each tab wrapped in ErrorBoundary + Suspense for lazy loading */}
              <Suspense fallback={<TabLoadingSpinner />}>

                {activeTab === 'dashboard' && (
                  <ErrorBoundary key="dashboard">
                    <Dashboard
                      configs={configs} schemaReport={schemaReport}
                      onOpenFile={handleOpenFile} onSaveFile={handleSaveFile}
                      onResetFile={handleResetFile} onResetField={handleResetField}
                      onSaveAll={handleSaveAll} onDiscardAll={handleDiscardAll}
                      onFixSyntaxError={handleFixSyntaxError} onFixStructuralError={handleFixStructuralError}
                      onFixAllErrors={handleFixAllErrors} xmlItems={xmlItems}
                      onUpdateXmlItems={handleUpdateXmlItems} fetchConfigs={fetchConfigs}
                      onShowConfirm={setConfirmDialog} initialSubTab={dashboardSubTab}
                      onSubTabChange={setDashboardSubTab} onNavigateToQuestGraph={handleNavigateToQuestGraph}
                    />
                  </ErrorBoundary>
                )}

                {activeTab === 'economy' && (
                  <ErrorBoundary key="economy">
                    <EconomyEditor
                      configs={configs} onChangeField={handleChangeField}
                      onSaveFile={handleSaveFile} onCreateFile={handleCreateFile}
                      xmlItems={xmlItems} onShowConfirm={setConfirmDialog}
                    />
                  </ErrorBoundary>
                )}

                {activeTab === 'quests' && (
                  <ErrorBoundary key="quests">
                    <QuestGraph
                      configs={configs} onChangeField={handleChangeField}
                      onOpenFile={handleOpenFile} onCreateFile={handleCreateFile}
                      onDeleteFile={handleDeleteFile} selectedQuestId={selectedQuestId}
                      onSelectQuest={setSelectedQuestId} onNavigateToMap={handleNavigateToMap}
                      xmlItems={xmlItems} highlightedQuestIds={highlightedQuestIds}
                      setCoordinatePicker={setCoordinatePicker} setActiveTab={setActiveTab}
                    />
                  </ErrorBoundary>
                )}

                {activeTab === 'aibots' && (
                  <ErrorBoundary key="aibots">
                    <AIBotsEditor
                      configs={configs} onChangeField={handleChangeField}
                      onNavigateToMap={handleNavigateToMap} onCreateFile={handleCreateFile}
                      onDeleteFile={handleDeleteFile} onSaveFile={handleSaveFile}
                      xmlItems={xmlItems} setActiveTab={setActiveTab}
                    />
                  </ErrorBoundary>
                )}

                {activeTab === 'settings' && (
                  <ErrorBoundary key="settings">
                    <SettingsEditor
                      configs={configs} onChangeField={handleChangeField}
                      onResetField={handleResetField} onResetFile={handleResetFile}
                      onSaveFile={handleSaveFile}
                      inferredEnums={schemaReport ? schemaReport.inferredEnums : {}}
                      onNavigateToMap={handleNavigateToMap}
                    />
                  </ErrorBoundary>
                )}

                {activeTab === 'map' && (
                  <ErrorBoundary key="map">
                    <TacticalMap
                      configs={configs} onChangeField={handleChangeField}
                      focusedCoordinate={focusedCoordinate} onClearFocus={() => setFocusedCoordinate(null)}
                      onCreateFile={handleCreateFile} onDeleteFile={handleDeleteFile}
                      onSelectQuest={setSelectedQuestId} setActiveTab={setActiveTab}
                      onOpenFile={handleOpenFile} coordinatePicker={coordinatePicker}
                      setCoordinatePicker={setCoordinatePicker}
                      onNavigateToSpawner={(filePath, triggerIdx) => {
                        setSelectedSpawnerFilePath(filePath);
                        setSelectedSpawnerTriggerIdx(triggerIdx);
                        setActiveTab('spawner');
                      }}
                      mapSize={mapSize} setMapSize={setMapSize}
                      isCustomPreset={isCustomPreset} setIsCustomPreset={setIsCustomPreset}
                      customSizeStr={customSizeStr} setCustomSizeStr={setCustomSizeStr}
                      layers={layers} setLayers={setLayers}
                    />
                  </ErrorBoundary>
                )}

                {activeTab === 'spawner' && (
                  <ErrorBoundary key="spawner">
                    <MPGSpawnerEditor
                      configs={configs} onChangeField={handleChangeField}
                      onCreateFile={handleCreateFile} onDeleteFile={handleDeleteFile}
                      onOpenFile={handleOpenFile} xmlItems={xmlItems}
                      onStartCoordinatePick={(returnTab, callback, options = { mode: 'single' }) => {
                        setCoordinatePicker({ callback, returnTab, mode: options.mode || 'single' });
                        setActiveTab('map');
                      }}
                      selectedSpawnerFilePath={selectedSpawnerFilePath}
                      selectedSpawnerTriggerIdx={selectedSpawnerTriggerIdx}
                      onClearSpawnerNavigation={() => {
                        setSelectedSpawnerFilePath(null);
                        setSelectedSpawnerTriggerIdx(null);
                      }}
                    />
                  </ErrorBoundary>
                )}

                {activeTab === 'searchforloot' && (
                  <ErrorBoundary key="searchforloot">
                    <SearchForLootEditor
                      configs={configs} onChangeField={handleChangeField}
                      xmlItems={xmlItems}
                    />
                  </ErrorBoundary>
                )}

                {activeTab === 'raw_editor' && (
                  <ErrorBoundary key="raw_editor">
                    <RawJsonEditor
                      filePath={selectedFilePath} config={configs[selectedFilePath]}
                      onChangeField={handleChangeField} onResetFile={handleResetFile}
                      onSaveFile={handleSaveFile}
                    />
                  </ErrorBoundary>
                )}

              </Suspense>
            </div>
          </>
        )}
      </main>

      {/* ── Floating Save Bar ───────────────────────────────────────────────── */}
      <FloatingSaveBar
        dirtyCount={dirtyFiles.size}
        dirtyFiles={dirtyFiles}
        isMinimized={isSaveBarMinimized}
        onMinimize={() => setIsSaveBarMinimized(true)}
        onExpand={() => setIsSaveBarMinimized(false)}
        onSaveAll={handleSaveAll}
        onDiscardAll={handleDiscardAll}
        onListChanges={() => {
          toast.info(
            (lang === 'ru' ? 'Измененные файлы: ' : 'Modified files: ') +
            Array.from(dirtyFiles).map(f => f.split('/').pop()).join(', ')
          );
        }}
      />
    </div>
  );
}
