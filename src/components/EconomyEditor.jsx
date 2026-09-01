import { detectCompatibleAttachments, addCustomAttachmentToWeapon, removeCustomAttachmentFromWeapon, resetCustomAttachmentsForWeapon } from '../utils/attachmentsMatrix';
import { parseClassnamesFromText } from '../utils/classnamesParser';
import { Icon } from './common/Icons';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AutocompleteInput from './shared/AutocompleteInput';
import CoordinatesInput from './shared/CoordinatesInput';
import { useToast } from './ToastManager';
import { translateStrKey } from '../utils/strKeys';
import { useTranslation } from '../utils/localization';
import HelpIcon from './HelpIcon';
import { AutocompleteWorkerWrapper } from '../utils/autocompleteWorker';
import { getExpansionModPrefix, getExpansionPrefix } from '../utils/pathUtils';


// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({ value, originalValue, type = 'text', onChange, style = {}, hasError = false }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value);
  const isDirty = value !== originalValue;

  const handleBlur = () => {
    setEditing(false);
    const parsed = type === 'number' ? Number(tempVal) : tempVal;
    if (parsed !== value) onChange(parsed);
  };

  if (editing) {
    return (
      <input
        type={type} value={tempVal}
        onChange={e => setTempVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Enter') handleBlur(); if (e.key === 'Escape') { setEditing(false); setTempVal(value); } }}
        autoFocus
        className={hasError ? 'cell-error' : ''}
        style={{ padding: '4px 8px', background: 'var(--bg-primary)', color: 'var(--text-glow)', border: `1px solid ${hasError ? 'var(--danger-color)' : 'var(--text-primary)'}`, fontSize: '13px', textAlign: type === 'number' ? 'center' : 'left', ...style }}
      />
    );
  }

  return (
    <div
      onClick={() => { setEditing(true); setTempVal(value); }}
      className={hasError ? 'cell-error' : ''}
      style={{
        padding: '6px 8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-mono)',
        borderBottom: isDirty ? '1px dashed var(--warning-color)' : '1px transparent solid',
        color: hasError ? 'var(--danger-color)' : (isDirty ? 'var(--warning-color)' : 'var(--text-primary)'),
        transition: 'all 0.15s', borderRadius: '2px',
        textAlign: type === 'number' ? 'center' : 'left', ...style,
      }}
    >
      {value}
    </div>
  );
}

// ─── SortableHeader ───────────────────────────────────────────────────────────

function SortableHeader({ field, label, sortField, sortDir, onSort, style = {}, tipKey }) {
  const isActive = sortField === field;
  return (
    <th
      className="sortable-th"
      onClick={() => onSort(field)}
      style={{ ...style }}
    >
      <span className="label-with-help">
        {label}
        {tipKey && <HelpIcon tipKey={tipKey} />}
      </span>
      {' '}
      <span style={{ opacity: isActive ? 1 : 0.3, fontSize: '10px', color: isActive ? 'var(--text-glow)' : 'var(--text-secondary)' }}>
        {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTraderCategory(catStr) {
  if (!catStr || typeof catStr !== 'string') return { name: '', mode: 3 };
  if (catStr.includes(':')) {
    const [name, mode] = catStr.split(':');
    return { name, mode: parseInt(mode, 10) || 0 };
  }
  return { name: catStr, mode: 3 };
}

// ─── Main EconomyEditor ───────────────────────────────────────────────────────

export default function EconomyEditor({ 
  configs, 
  onChangeField, 
  onSaveFile, 
  onCreateFile, 
  onDeleteFile,
  onNavigateToMap,
  setCoordinatePicker,
  setActiveTab,
  xmlItems = [], 
  onShowConfirm 
}) {
  const toast = useToast();
  const { t, lang } = useTranslation();
  // ─ Database helpers ────────────────────────────────────────────────────────
  const xmlItemsSet   = useMemo(() => {
    const items = Array.isArray(xmlItems) ? xmlItems : [];
    return new Set(items.filter(i => typeof i === 'string').map(i => i.toLowerCase()));
  }, [xmlItems]);
  const isItemMissing = useCallback((cn) => {
    if (!cn || !Array.isArray(xmlItems) || !xmlItems.length) return false;
    return !xmlItemsSet.has(cn.toLowerCase());
  }, [xmlItemsSet, xmlItems]);


  // ─ Sub-tab / selection ────────────────────────────────────────────────────
  const [subTab,               setSubTab]               = useState(() => {
    return localStorage.getItem('dayz_editor_economy_sub_tab') || 'overview';
  });
  const [selectedCategoryPath, setSelectedCategoryPath] = useState(() => {
    return localStorage.getItem('dayz_editor_economy_selected_category') || null;
  });
  const [selectedTraderPath,   setSelectedTraderPath]   = useState(() => {
    return localStorage.getItem('dayz_editor_economy_selected_trader') || null;
  });

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [copiedAttachments, setCopiedAttachments] = useState(null);
  const [bulkOp, setBulkOp] = useState('mult-buy');
  const [bulkVal, setBulkVal] = useState('1.1');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // ─ Trader Creation Wizard states ──────────────────────────────────────────
  const [showTraderWizard, setShowTraderWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardFilename, setWizardFilename] = useState('');
  const [wizardDisplayName, setWizardDisplayName] = useState('');
  const [wizardIcon, setWizardIcon] = useState('Shotgun');
  const [wizardCustomIcon, setWizardCustomIcon] = useState('');
  const [wizardNpcModel, setWizardNpcModel] = useState('ExpansionTraderSurvivorM');
  const [wizardCustomNpcModel, setWizardCustomNpcModel] = useState('');
  const [wizardFaction, setWizardFaction] = useState('');
  const [wizardMinRep, setWizardMinRep] = useState(0);
  const [wizardMaxRep, setWizardMaxRep] = useState(2147483647);
  const [wizardQuestId, setWizardQuestId] = useState(-1);
  const [wizardSelectedCats, setWizardSelectedCats] = useState(new Set());
  const [wizardDefaultMode, setWizardDefaultMode] = useState(3); // 3 = Both
  const [wizardCurrency, setWizardCurrency] = useState('expansionbanknotehryvnia');
  const [wizardCatSearch, setWizardCatSearch] = useState('');
  const [wizardNpcCoords, setWizardNpcCoords] = useState([7500.0, 0.0, 7500.0]);
  const [wizardCreateSafezone, setWizardCreateSafezone] = useState(true);
  const [wizardSafezoneRadius, setWizardSafezoneRadius] = useState(50.0);
  const [wizardZoneMode, setWizardZoneMode] = useState('existing'); // 'existing' | 'new' | 'none'
  const [wizardSelectedZonePath, setWizardSelectedZonePath] = useState('');
  const [wizardNewZoneName, setWizardNewZoneName] = useState('');
  const [wizardNewZoneDisplayName, setWizardNewZoneDisplayName] = useState('');
  const [wizardNewZoneBuyPricePct, setWizardNewZoneBuyPricePct] = useState(100.0);
  const [wizardNewZoneSellPricePct, setWizardNewZoneSellPricePct] = useState(-1.0);
  const [wizardExportNpcObject, setWizardExportNpcObject] = useState(true);

  useEffect(() => {
    localStorage.setItem('dayz_editor_economy_sub_tab', subTab);
  }, [subTab]);

  useEffect(() => {
    if (selectedCategoryPath) {
      localStorage.setItem('dayz_editor_economy_selected_category', selectedCategoryPath);
    } else {
      localStorage.removeItem('dayz_editor_economy_selected_category');
    }
  }, [selectedCategoryPath]);

  useEffect(() => {
    if (selectedTraderPath) {
      localStorage.setItem('dayz_editor_economy_selected_trader', selectedTraderPath);
    } else {
      localStorage.removeItem('dayz_editor_economy_selected_trader');
    }
  }, [selectedTraderPath]);

  // ─ Active config refs ─────────────────────────────────────────────────────
  const activeCategoryConfig = (selectedCategoryPath && configs) ? configs[selectedCategoryPath] : null;
  const activeTraderConfig   = (selectedTraderPath && configs)   ? configs[selectedTraderPath]   : null;

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    return Number(localStorage.getItem('dayz_editor_economy_items_per_page')) || 100;
  });

  // ─ Search / filter ─────────────────────────────────────────────────────────
  const [itemQuery,       setItemQuery]       = useState('');
  const [traderItemQuery, setTraderItemQuery] = useState('');
  const [searchAllMode,   setSearchAllMode]   = useState(false);  // B4 cross-cat search

  // ─ Sorting (B2) ───────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState(null);
  const [sortDir,   setSortDir]   = useState('asc');

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryPath, itemQuery, sortField]);

  // ─ Selection for bulk ops (B3) ────────────────────────────────────────────
  const [selectedItems, setSelectedItems] = useState(new Set()); // Set of originalIndex

  // ─ Clipboard for copy-between-categories (B8) ────────────────────────────
  const [copiedItem, setCopiedItem] = useState(null);

  // ─ Import panel (B7) ─────────────────────────────────────────────────────
  const [showImportPanel,  setShowImportPanel]  = useState(false);
  const [importFromCatPath, setImportFromCatPath] = useState('');

  const [showXmlImportModal, setShowXmlImportModal] = useState(false);
  const [xmlSearchQuery, setXmlSearchQuery] = useState('');
  const [selectedXmlClassnames, setSelectedXmlClassnames] = useState(new Set());

  // Default values for mass import
  const [defaultMinPrice, setDefaultMinPrice] = useState(50);
  const [defaultMaxPrice, setDefaultMaxPrice] = useState(100);
  const [defaultSellPercent, setDefaultSellPercent] = useState(-1.0);
  const [defaultMinStock, setDefaultMinStock] = useState(1);
  const [defaultMaxStock, setDefaultMaxStock] = useState(100);

  const [showBulkPricingModal, setShowBulkPricingModal] = useState(false);
  const [bulkPriceMultiplier, setBulkPriceMultiplier] = useState(1.0);
  const [bulkMinRatio, setBulkMinRatio] = useState(0.5); // 50%
  const [enableMinRatioLock, setEnableMinRatioLock] = useState(false);

  const availableXmlItems = useMemo(() => {
    if (
      !activeCategoryConfig || 
      !activeCategoryConfig.success || 
      !activeCategoryConfig.content || 
      !Array.isArray(activeCategoryConfig.content.Items) || 
      !Array.isArray(xmlItems)
    ) {
      return [];
    }
    const existingSet = new Set(
      activeCategoryConfig.content.Items
        .filter(i => i && typeof i.ClassName === 'string')
        .map(i => i.ClassName.toLowerCase())
    );
    return xmlItems.filter(item => item && typeof item === 'string' && !existingSet.has(item.toLowerCase()));
  }, [activeCategoryConfig, xmlItems]);

  const priceData = useMemo(() => {
    if (!activeCategoryConfig || !activeCategoryConfig.success || !activeCategoryConfig.content || !Array.isArray(activeCategoryConfig.content.Items)) {
      return null;
    }
    const items = activeCategoryConfig.content.Items
      .filter(i => i && typeof i.ClassName === 'string' && typeof i.MaxPriceThreshold === 'number')
      .map(i => ({
        name: i.ClassName,
        max: i.MaxPriceThreshold,
        min: i.MinPriceThreshold || 0
      }))
      .sort((a, b) => b.max - a.max);
    
    if (items.length === 0) return null;

    const avgMax = Math.round(items.reduce((sum, i) => sum + i.max, 0) / items.length);
    const avgMin = Math.round(items.reduce((sum, i) => sum + i.min, 0) / items.length);
    const peakMax = Math.max(...items.map(i => i.max));
    
    return { items, avgMax, avgMin, peakMax };
  }, [activeCategoryConfig]);

  const [xmlFilteredItems, setXmlFilteredItems] = useState([]);
  const [xmlWorker, setXmlWorker] = useState(null);

  useEffect(() => {
    if (availableXmlItems && availableXmlItems.length > 100) {
      const w = new AutocompleteWorkerWrapper();
      w.init(availableXmlItems);
      setXmlWorker(w);
      return () => {
        w.terminate();
      };
    } else {
      setXmlWorker(null);
    }
  }, [availableXmlItems]);

  useEffect(() => {
    const query = typeof xmlSearchQuery === 'string' ? xmlSearchQuery.toLowerCase().trim() : '';
    if (!query) {
      setXmlFilteredItems(availableXmlItems.slice(0, 200));
    } else {
      if (xmlWorker) {
        xmlWorker.search(query, 200, (results) => {
          setXmlFilteredItems(results);
        });
      } else {
        const results = availableXmlItems.filter(item => 
          item && typeof item === 'string' && item.toLowerCase().includes(query)
        ).slice(0, 200);
        setXmlFilteredItems(results);
      }
    }
  }, [xmlSearchQuery, availableXmlItems, xmlWorker]);

  // ─ Autocomplete suggestions ───────────────────────────────────────────────
  const [suggestions,         setSuggestions]         = useState([]);
  const [marketCategoryNames, setMarketCategoryNames] = useState([]);

  // ─ File lists ─────────────────────────────────────────────────────────────
  const categoryPaths = useMemo(() => {
    if (!configs) return [];
    const paths = Object.keys(configs).filter(p => p.toLowerCase().includes('market/') && configs[p]?.success);
    paths.sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()));
    return paths;
  }, [configs]);

  const traderPaths = useMemo(() => {
    if (!configs) return [];
    const paths = Object.keys(configs).filter(p => p.toLowerCase().includes('traders/') && configs[p]?.success);
    paths.sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()));
    return paths;
  }, [configs]);

  const safezonePaths = useMemo(() => {
    if (!configs) return [];
    const paths = Object.keys(configs).filter(p => p.toLowerCase().includes('traderzones/') && configs[p]?.success);
    paths.sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()));
    return paths;
  }, [configs]);

  // ─ Matrix & Overrides & World states ────────────────────────────────────
  const [matrixCatSearch, setMatrixCatSearch] = useState('');
  const [matrixTraderSearch, setMatrixTraderSearch] = useState('');
  const [matrixFilterMode, setMatrixFilterMode] = useState('all');
  const [hoveredRowCat, setHoveredRowCat] = useState(null);
  const [hoveredColTrader, setHoveredColTrader] = useState(null);
  const [overrideSearchQuery, setOverrideSearchQuery] = useState('');
  const [expandedOverrideCats, setExpandedOverrideCats] = useState(new Set());
  const [npcCoords, setNpcCoords] = useState([7500.0, 0.0, 7500.0]);
  const [npcModel, setNpcModel] = useState('ExpansionTraderSurvivorM');
  const [selectedSafezonePath, setSelectedSafezonePath] = useState('');

  // ─ Context Menu & Safe Operations states ──────────────────────────────────
  const [contextMenu, setContextMenu] = useState(null); // { x, y, type: 'trader'|'category'|'item', data: any }
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(null);
  const [cloneDialog, setCloneDialog] = useState(null);

  // Close context menu on global click or Escape key
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    if (contextMenu) {
      document.addEventListener('click', handleGlobalClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // ─ Category UI states ───────────────────────────────────────────────────
  const [showPriceChart, setShowPriceChart] = useState(false);
  const [showTraderLinksDrawer, setShowTraderLinksDrawer] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [smartAttachmentsModal, setSmartAttachmentsModal] = useState(null);
  const [activeAddSlotKey, setActiveAddSlotKey] = useState(null);
  const [customAttachmentInput, setCustomAttachmentInput] = useState(''); // { weaponName, detected, selected: Set, maxPrice, minPrice, maxStock, minStock, sellPct }
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [bulkMinPrice, setBulkMinPrice] = useState(100);
  const [bulkMaxPrice, setBulkMaxPrice] = useState(200);
  const [bulkMinStock, setBulkMinStock] = useState(1);
  const [bulkMaxStock, setBulkMaxStock] = useState(50);
  const [bulkSellPct, setBulkSellPct] = useState(-1.0);
  const [bulkInfiniteStock, setBulkInfiniteStock] = useState(false);
  const [bulkStaticPrice, setBulkStaticPrice] = useState(false);
  const [showBulkDrawer, setShowBulkDrawer] = useState(false);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDisplayName, setNewCategoryDisplayName] = useState('');
  const [newCategoryInitStock, setNewCategoryInitStock] = useState(75);
  const [newCategoryIsExchange, setNewCategoryIsExchange] = useState(false);

  // ─ Context Menu Action Handlers ──────────────────────────────────────────
  const handleOpenContextMenu = (e, type, data) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 240;
    const menuHeight = 280;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setContextMenu({ x, y, type, data });
  };

  // Open Clone Trader Dialog
  const handleStartCloneTrader = (traderPath) => {
    const baseName = traderPath.split('/').pop().replace('.json', '');
    const file = configs[traderPath];
    const dName = file?.content?.DisplayName || baseName;
    
    // find unique clone filename
    let cloneIndex = 1;
    let candidateName = `${baseName}_copy`;
    const expModPrefix = getExpansionModPrefix(configs);
    while (configs[`${expModPrefix}Traders/${candidateName}.json`] || configs[`expansion/traders/${candidateName}.json`]) {
      cloneIndex++;
      candidateName = `${baseName}_copy${cloneIndex}`;
    }

    setCloneDialog({
      type: 'trader',
      sourcePath: traderPath,
      newFileName: candidateName,
      newDisplayName: `${dName} (Copy)`,
      shiftCoords: true
    });
    setContextMenu(null);
  };

  // Open Clone Category Dialog
  const handleStartCloneCategory = (catPath) => {
    const baseName = catPath.split('/').pop().replace('.json', '');
    const file = configs[catPath];
    const dName = file?.content?.DisplayName || baseName;

    let cloneIndex = 1;
    let candidateName = `${baseName}_copy`;
    const expPrefix = getExpansionPrefix(configs);
    while (configs[`${expPrefix}market/${candidateName}.json`]) {
      cloneIndex++;
      candidateName = `${baseName}_copy${cloneIndex}`;
    }

    setCloneDialog({
      type: 'category',
      sourcePath: catPath,
      newFileName: candidateName,
      newDisplayName: `${dName} (Copy)`
    });
    setContextMenu(null);
  };

  // Execute Clone Operation
  const handleExecuteClone = () => {
    if (!cloneDialog || !cloneDialog.newFileName.trim()) return;
    const { type, sourcePath, newFileName, newDisplayName, shiftCoords } = cloneDialog;
    const cleanFileName = newFileName.trim().toLowerCase().replace(/\.json$/i, '');
    const sourceFile = configs[sourcePath];
    if (!sourceFile || !sourceFile.success) return;

    if (type === 'trader') {
      const expModPrefix = getExpansionModPrefix(configs);
      const newPath = `${expModPrefix}Traders/${cleanFileName}.json`;
      if (configs[newPath]) {
        toast.error(lang === 'ru' ? 'Торговец с таким именем файла уже существует!' : 'Trader file already exists!');
        return;
      }

      const clonedContent = JSON.parse(JSON.stringify(sourceFile.content));
      clonedContent.DisplayName = newDisplayName.trim() || cleanFileName;
      
      onCreateFile(newPath, clonedContent);

      // Safe clone 3D object with +2m offset if requested
      if (shiftCoords) {
        const expPrefix = getExpansionPrefix(configs);
        const newObjPath = `${expPrefix}objects/${cleanFileName}_npc.json`;
        const newPos = [npcCoords[0] + 2.0, npcCoords[1], npcCoords[2]];
        const objContent = {
          Objects: [
            {
              name: npcModel || 'ExpansionTraderSurvivorM',
              pos: newPos,
              ypr: [0.0, 0.0, 0.0]
            }
          ]
        };
        onCreateFile(newObjPath, objContent);
      }

      setSelectedTraderPath(newPath);
      setSubTab('traders');
      toast.success(lang === 'ru' ? `Торговец успешно клонирован: ${cleanFileName}.json` : `Trader cloned: ${cleanFileName}.json`);
    } else if (type === 'category') {
      const expPrefix = getExpansionPrefix(configs);
      const newPath = `${expPrefix}market/${cleanFileName}.json`;
      if (configs[newPath]) {
        toast.error(lang === 'ru' ? 'Категория с таким именем файла уже существует!' : 'Category file already exists!');
        return;
      }

      const clonedContent = JSON.parse(JSON.stringify(sourceFile.content));
      clonedContent.DisplayName = newDisplayName.trim() || cleanFileName;
      
      onCreateFile(newPath, clonedContent);
      setSelectedCategoryPath(newPath);
      setSubTab('categories');
      toast.success(lang === 'ru' ? `Категория успешно клонирована: ${cleanFileName}.json` : `Category cloned: ${cleanFileName}.json`);
    }

    setCloneDialog(null);
  };

  // Open Safe Delete Trader Dialog
  const handleStartDeleteTrader = (traderPath) => {
    const tName = traderPath.split('/').pop().replace('.json', '');
    const expPrefix = getExpansionPrefix(configs);
    const objPath = `${expPrefix}objects/${tName}_npc.json`;
    const zonePath = `${expPrefix}traderzones/${tName}_zone.json`;

    setDeleteConfirmDialog({
      type: 'trader',
      path: traderPath,
      displayName: configs[traderPath]?.content?.DisplayName || tName,
      hasObject: Boolean(configs[objPath]),
      hasZone: Boolean(configs[zonePath]),
      deleteObject: Boolean(configs[objPath]),
      deleteZone: false,
      objPath,
      zonePath
    });
    setContextMenu(null);
  };

  // Open Safe Delete Category Dialog
  const handleStartDeleteCategory = (catPath) => {
    const catName = catPath.split('/').pop().replace('.json', '');
    // Check which traders use this category
    const usedBy = [];
    traderPaths.forEach(tp => {
      const tContent = configs[tp]?.content;
      if (tContent && Array.isArray(tContent.Categories)) {
        const hasCat = tContent.Categories.some(c => {
          const { name } = parseTraderCategory(c);
          return name.toLowerCase() === catName.toLowerCase();
        });
        if (hasCat) {
          usedBy.push({ path: tp, name: tContent.DisplayName || tp.split('/').pop().replace('.json', '') });
        }
      }
    });

    setDeleteConfirmDialog({
      type: 'category',
      path: catPath,
      displayName: configs[catPath]?.content?.DisplayName || catName,
      usedByTraders: usedBy,
      unbindFromTraders: true
    });
    setContextMenu(null);
  };

  // Execute Delete Operation
  const handleExecuteDelete = () => {
    if (!deleteConfirmDialog) return;
    const { type, path, deleteObject, deleteZone, objPath, zonePath, usedByTraders, unbindFromTraders } = deleteConfirmDialog;

    if (type === 'trader') {
      onDeleteFile(path);
      if (deleteObject && objPath && configs[objPath]) {
        onDeleteFile(objPath);
      }
      if (deleteZone && zonePath && configs[zonePath]) {
        onDeleteFile(zonePath);
      }
      if (selectedTraderPath === path) {
        setSelectedTraderPath(null);
      }
      toast.warning(lang === 'ru' ? `Торговец ${path.split('/').pop()} удален` : `Trader ${path.split('/').pop()} deleted`);
    } else if (type === 'category') {
      const catName = path.split('/').pop().replace('.json', '');
      
      // Unbind category from traders if requested
      if (unbindFromTraders && usedByTraders && usedByTraders.length > 0) {
        usedByTraders.forEach(t => {
          const tContent = configs[t.path]?.content;
          if (tContent && Array.isArray(tContent.Categories)) {
            const updatedCategories = tContent.Categories.filter(c => {
              const { name } = parseTraderCategory(c);
              return name.toLowerCase() !== catName.toLowerCase();
            });
            onChangeField(t.path, ['Categories'], updatedCategories);
          }
        });
      }

      onDeleteFile(path);
      if (selectedCategoryPath === path) {
        setSelectedCategoryPath(null);
      }
      toast.warning(lang === 'ru' ? `Категория ${path.split('/').pop()} удалена` : `Category ${path.split('/').pop()} deleted`);
    }

    setDeleteConfirmDialog(null);
  };

  // Handle execution of Bulk Paste into current category
  const handleOpenSmartAttachments = (itemObj) => {
    const clsName = typeof itemObj === 'string' ? itemObj : itemObj?.ClassName;
    if (!clsName) return;
    const detected = detectCompatibleAttachments(clsName, xmlItemsSet);
    if (!detected) {
      toast.warning(lang === 'ru' ? `Для предмета ${clsName} не найдено правил совместимости обвесов` : `No attachment rules found for ${clsName}`);
      return;
    }
    
    // Auto-select valid items that are not yet in current category
    const currentItems = activeCategoryConfig?.content?.Items || [];
    const currentSet = new Set(currentItems.map(i => i.ClassName?.toLowerCase()));
    const initialSelected = new Set();

    Object.entries(detected).forEach(([k, arr]) => {
      if (Array.isArray(arr)) {
        arr.forEach(att => {
          if (!currentSet.has(att.toLowerCase())) {
            initialSelected.add(att);
          }
        });
      }
    });

    const itemPrice = typeof itemObj === 'object' ? itemObj?.MaxPriceThreshold || 1000 : 1000;
    const targetItemIndex = typeof itemObj === 'object' ? itemObj?.originalIndex : -1;
    setSmartAttachmentsModal({
      weaponName: clsName,
      targetItemIndex,
      targetMode: 'category', // 'category' | 'spawn_attachments'
      detected,
      selected: initialSelected,
      maxPrice: Math.max(Math.round(itemPrice * 0.3), 50),
      minPrice: Math.max(Math.round(itemPrice * 0.1), 20),
      maxStock: 50,
      minStock: 5,
      sellPct: -1,
      infiniteStock: false,
      staticPrice: false
    });
  };

  const handleExecuteAddSmartAttachments = () => {
    if (!smartAttachmentsModal || !selectedCategoryPath || !activeCategoryConfig?.content) return;
    const { weaponName, targetItemIndex, targetMode, selected, maxPrice, minPrice, maxStock, minStock, sellPct, infiniteStock, staticPrice } = smartAttachmentsModal;
    const itemsToAdd = Array.from(selected);
    if (itemsToAdd.length === 0) {
      toast.warning(lang === 'ru' ? 'Не выбрано ни одного обвеса' : 'No attachments selected');
      return;
    }

    const currentItems = Array.isArray(activeCategoryConfig.content.Items) ? [...activeCategoryConfig.content.Items] : [];

    if (targetMode === 'spawn_attachments') {
      // Find weapon item
      let wIdx = targetItemIndex;
      if (wIdx === -1 || !currentItems[wIdx] || currentItems[wIdx].ClassName?.toLowerCase() !== weaponName.toLowerCase()) {
        wIdx = currentItems.findIndex(i => i.ClassName?.toLowerCase() === weaponName.toLowerCase());
      }
      if (wIdx === -1) {
        toast.error(lang === 'ru' ? `Оружие ${weaponName} не найдено в текущей категории` : `Weapon ${weaponName} not found in category`);
        return;
      }

      const existingAtts = Array.isArray(currentItems[wIdx].SpawnAttachments) ? [...currentItems[wIdx].SpawnAttachments] : [];
      const attSet = new Set(existingAtts.map(a => a.toLowerCase()));
      let attachedCount = 0;
      itemsToAdd.forEach(cls => {
        if (!attSet.has(cls.toLowerCase())) {
          existingAtts.push(cls);
          attSet.add(cls.toLowerCase());
          attachedCount++;
        }
      });

      currentItems[wIdx] = {
        ...currentItems[wIdx],
        SpawnAttachments: existingAtts
      };

      onChangeField(selectedCategoryPath, ['Items'], currentItems);
      setSmartAttachmentsModal(null);
      toast.success(lang === 'ru' ? `Прикреплено ${attachedCount} обвесов на оружие ${weaponName}` : `Attached ${attachedCount} attachments onto ${weaponName}`);
    } else {
      // Add as separate trade items in category
      const currentSet = new Set(currentItems.map(i => i.ClassName?.toLowerCase()));
      let addedCount = 0;
      itemsToAdd.forEach(cls => {
        if (!currentSet.has(cls.toLowerCase())) {
          currentItems.push({
            ClassName: cls,
            MaxPriceThreshold: Number(maxPrice) || 100,
            MinPriceThreshold: staticPrice ? (Number(maxPrice) || 100) : (Number(minPrice) || 50),
            SellPricePercent: Number(sellPct) || -1,
            MaxStockThreshold: infiniteStock ? 1 : (Number(maxStock) || 50),
            MinStockThreshold: infiniteStock ? 1 : (Number(minStock) || 5),
            QuantityPercent: -1,
            SpawnAttachments: [],
            Variants: []
          });
          currentSet.add(cls.toLowerCase());
          addedCount++;
        }
      });

      onChangeField(selectedCategoryPath, ['Items'], currentItems);
      setSmartAttachmentsModal(null);
      toast.success(lang === 'ru' ? `Добавлено ${addedCount} совместимых обвесов в категорию` : `Added ${addedCount} compatible attachments to category`);
    }
  };

  const handleExecuteBulkPaste = () => {
    if (!selectedCategoryPath || !activeCategoryConfig || !activeCategoryConfig.content) return;
    const classnames = parseClassnamesFromText(bulkPasteText);
    if (classnames.length === 0) {
      toast.error(lang === 'ru' ? 'Не найдено корректных класснеймов для вставки' : 'No valid classnames found');
      return;
    }

    const currentItems = Array.isArray(activeCategoryConfig.content.Items) ? [...activeCategoryConfig.content.Items] : [];
    const currentClassSet = new Set(currentItems.map(i => i.ClassName?.toLowerCase()));

    const minP = Number(bulkStaticPrice ? bulkMaxPrice : bulkMinPrice) || 100;
    const maxP = Number(bulkMaxPrice) || 200;
    const minS = Number(bulkInfiniteStock ? 1 : bulkMinStock) || 1;
    const maxS = Number(bulkInfiniteStock ? 1 : bulkMaxStock) || 50;
    const sellP = Number(bulkSellPct) || -1.0;

    let addedCount = 0;
    let skippedCount = 0;

    classnames.forEach(cls => {
      if (currentClassSet.has(cls.toLowerCase())) {
        skippedCount++;
      } else {
        currentItems.push({
          ClassName: cls,
          MinPriceThreshold: minP,
          MaxPriceThreshold: maxP,
          SellPricePercent: sellP,
          MaxStockThreshold: maxS,
          MinStockThreshold: minS,
          QuantityPercent: -1,
          SpawnAttachments: [],
          Variants: []
        });
        currentClassSet.add(cls.toLowerCase());
        addedCount++;
      }
    });

    if (addedCount > 0) {
      onChangeField(selectedCategoryPath, ['Items'], currentItems);
      toast.success(lang === 'ru' 
        ? `Добавлено ${addedCount} предметов (пропущено существующих: ${skippedCount})` 
        : `Added ${addedCount} items (skipped existing: ${skippedCount})`
      );
      setBulkPasteText('');
      setShowBulkPasteModal(false);
    } else {
      toast.warning(lang === 'ru' ? 'Все указанные предметы уже есть в этой категории' : 'All specified items already exist in this category');
    }
  };

  // Toggle Category Link in Trader Config
  const handleToggleTraderCategoryLink = (traderPath, catName, currentMode = 3) => {
    const tFile = configs[traderPath];
    if (!tFile || !tFile.success) return;
    const currentCats = Array.isArray(tFile.content?.Categories) ? [...tFile.content.Categories] : [];
    
    // Check if category is currently linked
    const existingIdx = currentCats.findIndex(c => {
      const { name } = parseTraderCategory(c);
      return name.toLowerCase() === catName.toLowerCase();
    });

    if (existingIdx !== -1) {
      // Unlink
      currentCats.splice(existingIdx, 1);
      onChangeField(traderPath, ['Categories'], currentCats);
      toast.info(lang === 'ru' ? `Категория отвязана от ${tFile.content?.DisplayName || traderPath.split('/').pop()}` : `Unlinked from trader`);
    } else {
      // Link with mode
      const entryToAdd = currentMode === 3 ? catName : `${catName}:${currentMode}`;
      currentCats.push(entryToAdd);
      onChangeField(traderPath, ['Categories'], currentCats);
      toast.success(lang === 'ru' ? `Категория привязана к ${tFile.content?.DisplayName || traderPath.split('/').pop()}` : `Linked to trader`);
    }
  };

  // Change trade mode for linked category in Trader
  const handleChangeTraderCategoryMode = (traderPath, catName, newMode) => {
    const tFile = configs[traderPath];
    if (!tFile || !tFile.success) return;
    const currentCats = Array.isArray(tFile.content?.Categories) ? [...tFile.content.Categories] : [];
    
    const existingIdx = currentCats.findIndex(c => {
      const { name } = parseTraderCategory(c);
      return name.toLowerCase() === catName.toLowerCase();
    });

    if (existingIdx !== -1) {
      currentCats[existingIdx] = newMode === 3 ? catName : `${catName}:${newMode}`;
      onChangeField(traderPath, ['Categories'], currentCats);
    }
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error(lang === 'ru' ? 'Введите имя файла категории' : 'Enter category filename');
      return;
    }
    const cleanFilename = newCategoryName.trim().replace(/\.json$/i, '');
    const prefix = getExpansionPrefix(configs);
    const path = `${prefix}market/${cleanFilename}.json`;
    if (configs[path]) {
      toast.error(lang === 'ru' ? 'Категория с таким именем уже существует' : 'Category already exists');
      return;
    }
    const content = {
      m_Version: 12,
      DisplayName: newCategoryDisplayName.trim() || cleanFilename,
      Icon: 'Deliver',
      Color: 'FBFCFEFF',
      IsDefines: 0,
      IsExchange: newCategoryIsExchange ? 1 : 0,
      InitStockPercent: Number(newCategoryInitStock) || 75,
      Items: []
    };
    onCreateFile(path, content);
    setSelectedCategoryPath(path);
    setShowCreateCategoryModal(false);
    setNewCategoryName('');
    setNewCategoryDisplayName('');
    setNewCategoryInitStock(75);
    setNewCategoryIsExchange(false);
    toast.success(lang === 'ru' ? `Категория ${cleanFilename} создана!` : `Category ${cleanFilename} created!`);
  };

  const filteredCategoryPaths = useMemo(() => {
    if (!sidebarSearch.trim()) return categoryPaths;
    const lower = sidebarSearch.toLowerCase();
    return categoryPaths.filter(p => p.split('/').pop().toLowerCase().includes(lower));
  }, [categoryPaths, sidebarSearch]);

  const filteredTraderPaths = useMemo(() => {
    if (!sidebarSearch.trim()) return traderPaths;
    const lower = sidebarSearch.toLowerCase();
    return traderPaths.filter(p => p.split('/').pop().toLowerCase().includes(lower));
  }, [traderPaths, sidebarSearch]);

  // ─ Matrix View Memoized Data ─────────────────────────────────────────────
  const matrixCategories = useMemo(() => {
    return categoryPaths.map(p => {
      const file = configs[p];
      const catName = p.split('/').pop().replace('.json', '');
      const itemCount = file?.success && Array.isArray(file.content?.Items) ? file.content.Items.length : 0;
      return { path: p, name: catName, itemCount };
    });
  }, [categoryPaths, configs]);

  const matrixTraders = useMemo(() => {
    return traderPaths.map(p => {
      const file = configs[p];
      const traderName = p.split('/').pop().replace('.json', '');
      const content = file?.success ? file.content : {};
      const displayName = content.DisplayName ? translateStrKey(content.DisplayName, lang) : traderName;
      const categories = Array.isArray(content.Categories) ? content.Categories : [];
      const icon = content.TraderIcon || 'Default';
      return { path: p, filename: traderName, name: displayName, icon, categories };
    });
  }, [traderPaths, configs, lang]);

  const matrixStats = useMemo(() => {
    let totalLinks = 0;
    const catAssignedMap = new Map();
    matrixCategories.forEach(c => catAssignedMap.set(c.name.toLowerCase(), 0));

    matrixTraders.forEach(t => {
      t.categories.forEach(c => {
        const { name } = parseTraderCategory(c);
        const k = name.toLowerCase();
        totalLinks++;
        if (catAssignedMap.has(k)) {
          catAssignedMap.set(k, (catAssignedMap.get(k) || 0) + 1);
        }
      });
    });

    let assignedCount = 0;
    catAssignedMap.forEach(count => {
      if (count > 0) assignedCount++;
    });

    const totalCats = matrixCategories.length || 1;
    const coveragePercent = Math.round((assignedCount / totalCats) * 100);

    return {
      totalLinks,
      assignedCount,
      unassignedCount: matrixCategories.length - assignedCount,
      coveragePercent,
      catAssignedMap
    };
  }, [matrixCategories, matrixTraders]);

  const filteredMatrixCategories = useMemo(() => {
    let list = matrixCategories;
    if (matrixCatSearch.trim()) {
      const lower = matrixCatSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(lower));
    }
    if (matrixFilterMode === 'assigned') {
      list = list.filter(c => (matrixStats.catAssignedMap.get(c.name.toLowerCase()) || 0) > 0);
    } else if (matrixFilterMode === 'unassigned') {
      list = list.filter(c => (matrixStats.catAssignedMap.get(c.name.toLowerCase()) || 0) === 0);
    }
    return list;
  }, [matrixCategories, matrixCatSearch, matrixFilterMode, matrixStats.catAssignedMap]);

  const filteredMatrixTraders = useMemo(() => {
    if (!matrixTraderSearch.trim()) return matrixTraders;
    const lower = matrixTraderSearch.toLowerCase();
    return matrixTraders.filter(t => t.name.toLowerCase().includes(lower) || t.filename.toLowerCase().includes(lower));
  }, [matrixTraders, matrixTraderSearch]);

  const handleToggleMatrixCell = (traderPath, catName, currentMode) => {
    const file = configs[traderPath];
    if (!file?.success || !file.content) return;
    const currentCats = Array.isArray(file.content.Categories) ? [...file.content.Categories] : [];
    
    // Cycle order: -1 (off) -> 3 (both) -> 1 (sell) -> 0 (buy) -> -1 (off)
    let nextMode = -1;
    if (currentMode === -1) nextMode = 3;
    else if (currentMode === 3) nextMode = 1;
    else if (currentMode === 1) nextMode = 0;
    else nextMode = -1;

    let updated = currentCats.filter(c => parseTraderCategory(c).name.toLowerCase() !== catName.toLowerCase());
    if (nextMode !== -1) {
      updated.push(nextMode === 3 ? catName : `${catName}:${nextMode}`);
    }
    onChangeField(traderPath, ['Categories'], updated);
  };

  const handleMatrixBatchTrader = (traderPath, assignAll) => {
    const file = configs[traderPath];
    if (!file?.success || !file.content) return;
    if (assignAll) {
      const allCatNames = categoryPaths.map(p => p.split('/').pop().replace('.json', ''));
      onChangeField(traderPath, ['Categories'], allCatNames);
      toast.success(lang === 'ru' ? 'Все категории назначены трейдеру' : 'All categories assigned to trader');
    } else {
      onChangeField(traderPath, ['Categories'], []);
      toast.warning(lang === 'ru' ? 'Все категории удалены у трейдера' : 'Cleared all categories for trader');
    }
  };

  const handleMatrixBatchCategory = (catName, assignAll) => {
    traderPaths.forEach(traderPath => {
      const file = configs[traderPath];
      if (!file?.success || !file.content) return;
      const currentCats = Array.isArray(file.content.Categories) ? [...file.content.Categories] : [];
      let updated = currentCats.filter(c => parseTraderCategory(c).name.toLowerCase() !== catName.toLowerCase());
      if (assignAll) {
        updated.push(catName);
      }
      onChangeField(traderPath, ['Categories'], updated);
    });
    if (assignAll) {
      toast.success(lang === 'ru' ? `Категория "${catName}" назначена всем торговцам` : `Category "${catName}" assigned to all traders`);
    } else {
      toast.warning(lang === 'ru' ? `Категория "${catName}" снята со всех торговцев` : `Category "${catName}" removed from all traders`);
    }
  };

  const handleMatrixPresetAll = (mode) => {
    const allCatNames = categoryPaths.map(p => p.split('/').pop().replace('.json', ''));
    traderPaths.forEach(traderPath => {
      if (mode === 3) {
        onChangeField(traderPath, ['Categories'], allCatNames);
      } else {
        onChangeField(traderPath, ['Categories'], []);
      }
    });
    if (mode === 3) {
      toast.success(lang === 'ru' ? 'Все категории назначены всем торговцам (Both)' : 'All categories assigned to all traders (Both)');
    } else {
      toast.warning(lang === 'ru' ? 'Все связи категорий с торговцами очищены' : 'Cleared all category links');
    }
  };


  const questsList = useMemo(() => {
    const list = [];
    if (!configs) return list;
    Object.entries(configs).forEach(([p, file]) => {
      if (file?.success && file?.content && p.toLowerCase().includes('quests/quests/quest_') && file.content.ID !== undefined) {
        list.push({ id: file.content.ID, title: file.content.Title || `Quest #${file.content.ID}` });
      }
    });
    return list.sort((a, b) => a.id - b.id);
  }, [configs]);

  // ─ Cross-category duplicate map (B9) ─────────────────────────────────────
  const crossCatMap = useMemo(() => {
    const map = new Map();
    categoryPaths.forEach(p => {
      const file = configs[p];
      if (file?.success && Array.isArray(file.content?.Items)) {
        const catName = p.split('/').pop().replace('.json', '');
        file.content.Items.forEach(item => {
          if (item.ClassName) {
            const lower = item.ClassName.toLowerCase();
            if (!map.has(lower)) map.set(lower, []);
            map.get(lower).push(catName);
          }
        });
      }
    });
    return map;
  }, [configs, categoryPaths]);

  const isDuplicate = (cn) => { if (!cn) return false; const cats = crossCatMap.get(cn.toLowerCase()); return cats && cats.length > 1; };
  const getDupCats  = (cn) => { if (!cn) return []; return crossCatMap.get(cn.toLowerCase()) || []; };

  // ─ Economy Overview analysis ───────────────────────────────────────────────
  const economyOverview = useMemo(() => {
    let totalCategories = 0;
    let totalItems = 0;
    let totalPriceSumMin = 0;
    let totalPriceSumMax = 0;
    let priceCount = 0;
    const allItems = [];
    const anomalies = [];

    categoryPaths.forEach(p => {
      const file = configs[p];
      if (!file?.success || !file.content) return;
      totalCategories++;
      const catName = p.split('/').pop().replace('.json', '');
      const items = Array.isArray(file.content.Items) ? file.content.Items : [];

      items.forEach((item) => {
        if (!item || !item.ClassName) return;
        totalItems++;
        const cnLower = item.ClassName.toLowerCase();

        if (typeof item.MinPriceThreshold === 'number') {
          totalPriceSumMin += item.MinPriceThreshold;
          priceCount++;
        }
        if (typeof item.MaxPriceThreshold === 'number') {
          totalPriceSumMax += item.MaxPriceThreshold;
        }

        allItems.push({
          ClassName: item.ClassName,
          MinPriceThreshold: item.MinPriceThreshold,
          MaxPriceThreshold: item.MaxPriceThreshold,
          MinStockThreshold: item.MinStockThreshold,
          MaxStockThreshold: item.MaxStockThreshold,
          SellPricePercent: item.SellPricePercent,
          catName,
          catPath: p
        });

        // 1. Min Price > Max Price
        if (item.MinPriceThreshold > item.MaxPriceThreshold) {
          anomalies.push({
            type: 'error',
            classname: item.ClassName,
            desc: lang === 'ru' ? `Мин. цена (${item.MinPriceThreshold}$) больше Макс. цены (${item.MaxPriceThreshold}$)` : `Min price (${item.MinPriceThreshold}$) exceeds Max price (${item.MaxPriceThreshold}$)`,
            catName,
            catPath: p
          });
        }
        // 2. Min Stock > Max Stock
        if (item.MinStockThreshold > item.MaxStockThreshold) {
          anomalies.push({
            type: 'error',
            classname: item.ClassName,
            desc: lang === 'ru' ? `Мин. запас (${item.MinStockThreshold}) больше Макс. запаса (${item.MaxStockThreshold})` : `Min stock (${item.MinStockThreshold}) exceeds Max stock (${item.MaxStockThreshold})`,
            catName,
            catPath: p
          });
        }
        // 3. Duplicate items
        const dupCats = crossCatMap.get(cnLower);
        if (dupCats && dupCats.length > 1) {
          anomalies.push({
            type: 'warning',
            classname: item.ClassName,
            desc: lang === 'ru' ? `Дубликат в категориях: ${dupCats.filter(c => c !== catName).join(', ')}` : `Duplicate in categories: ${dupCats.filter(c => c !== catName).join(', ')}`,
            catName,
            catPath: p
          });
        }
        // 4. Missing in types.xml
        if (xmlItems.length > 0 && !xmlItemsSet.has(cnLower)) {
          anomalies.push({
            type: 'info',
            classname: item.ClassName,
            desc: lang === 'ru' ? `Отсутствует в types.xml` : `Missing in types.xml`,
            catName,
            catPath: p
          });
        }
      });
    });

    const avgMinPrice = priceCount > 0 ? Math.round(totalPriceSumMin / priceCount) : 0;
    const avgMaxPrice = priceCount > 0 ? Math.round(totalPriceSumMax / priceCount) : 0;

    // Сортировка топ-10 самых дорогих предметов по MaxPriceThreshold
    const topExpensive = [...allItems]
      .filter(i => typeof i.MaxPriceThreshold === 'number')
      .sort((a, b) => b.MaxPriceThreshold - a.MaxPriceThreshold)
      .slice(0, 10);

    return {
      totalCategories,
      totalItems,
      avgMinPrice,
      avgMaxPrice,
      anomalies,
      topExpensive
    };
  }, [configs, categoryPaths, crossCatMap, xmlItemsSet, xmlItems, lang]);

  // ─ Auto-select first or fallback on load ───────────────────────────────────
  useEffect(() => {
    if (categoryPaths.length > 0) {
      if (!selectedCategoryPath || !categoryPaths.includes(selectedCategoryPath)) {
        setSelectedCategoryPath(categoryPaths[0]);
      }
    }
  }, [categoryPaths, selectedCategoryPath]);

  useEffect(() => {
    if (traderPaths.length > 0) {
      if (!selectedTraderPath || !traderPaths.includes(selectedTraderPath)) {
        setSelectedTraderPath(traderPaths[0]);
      }
    }
  }, [traderPaths, selectedTraderPath]);

  // ─ Build suggestions ──────────────────────────────────────────────────────
  useEffect(() => {
    const names = new Set();
    const cats  = [];
    categoryPaths.forEach(p => { cats.push(p.split('/').pop().replace('.json', '')); });
    setMarketCategoryNames(cats.sort());
    Object.values(configs || {}).forEach(file => {
      if (!file?.success || !file?.content) return;
      if (Array.isArray(file.content.Items)) file.content.Items.forEach(i => { if (i?.ClassName) names.add(i.ClassName.toLowerCase()); });
      if (file.content.StartingClothing) {
        ['Tops','Pants','Shoes','Backpacks'].forEach(k => {
          if (Array.isArray(file.content.StartingClothing[k])) file.content.StartingClothing[k].forEach(x => names.add(x.toLowerCase()));
        });
      }
    });
    (Array.isArray(xmlItems) ? xmlItems : []).forEach(x => {
      if (x && typeof x === 'string') names.add(x.toLowerCase());
    });
    setSuggestions(Array.from(names).sort());
  }, [configs, xmlItems, categoryPaths]);

  // ─ Sorting helper ─────────────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setSelectedItems(new Set());
  };

  // ─ Category items (filtered + sorted) ────────────────────────────────────
  const rawItems = activeCategoryConfig && activeCategoryConfig.success && activeCategoryConfig.content && Array.isArray(activeCategoryConfig.content.Items)
    ? activeCategoryConfig.content.Items : [];

  const filteredItems = useMemo(() => {
    let items = rawItems.map((item, idx) => ({ ...item, originalIndex: idx }));
    if (itemQuery && !searchAllMode) {
      items = items.filter(item => item && typeof item.ClassName === 'string' && item.ClassName.toLowerCase().includes(itemQuery.toLowerCase()));
    }
    if (sortField) {
      items.sort((a, b) => {
        let av = a[sortField] ?? 0, bv = b[sortField] ?? 0;
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ?  1 : -1;
        return 0;
      });
    }
    return items;
  }, [rawItems, itemQuery, sortField, sortDir, searchAllMode]);

  const paginatedItems = useMemo(() => {
    if (itemsPerPage === -1) return filteredItems;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);


  // ─ Cross-category search results (B4) ────────────────────────────────────
  const crossCatResults = useMemo(() => {
    if (!searchAllMode || !itemQuery.trim() || !configs) return [];
    const lower = itemQuery.toLowerCase();
    const results = [];
    categoryPaths.forEach(p => {
      const file = configs[p];
      if (!file?.success || !Array.isArray(file.content?.Items)) return;
      const catName = p.split('/').pop().replace('.json', '');
      file.content.Items.forEach((item, idx) => {
        if (item?.ClassName?.toLowerCase().includes(lower)) {
          results.push({ ...item, originalIndex: idx, catPath: p, catName });
        }
      });
    });
    return results.slice(0, 100);
  }, [searchAllMode, itemQuery, categoryPaths, configs]);

  // ─ Category statistics (B6) ───────────────────────────────────────────────
  const catStats = useMemo(() => {
    if (!rawItems.length) return null;
    const validItems = rawItems.filter(i => i);
    const minPrices  = validItems.map(i => i.MinPriceThreshold).filter(v => typeof v === 'number');
    const maxPrices  = validItems.map(i => i.MaxPriceThreshold).filter(v => typeof v === 'number');
    const sellPcts   = validItems.map(i => i.SellPricePercent).filter(v => typeof v === 'number' && v >= 0);
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : '-';
    return {
      count:   rawItems.length,
      avgMin:  avg(minPrices),
      avgMax:  avg(maxPrices),
      avgSell: avg(sellPcts),
    };
  }, [rawItems]);

  // ─ Dirty flags ────────────────────────────────────────────────────────────
  const isCategoryDirty = activeCategoryConfig && activeCategoryConfig.success && activeCategoryConfig.content
    ? JSON.stringify(activeCategoryConfig.content) !== JSON.stringify(activeCategoryConfig.originalContent) : false;
  const isTraderDirty = activeTraderConfig && activeTraderConfig.success && activeTraderConfig.content
    ? JSON.stringify(activeTraderConfig.content) !== JSON.stringify(activeTraderConfig.originalContent) : false;

  // ─ Trader computed ────────────────────────────────────────────────────────
  const traderItemsList     = activeTraderConfig?.content?.Items ? Object.entries(activeTraderConfig.content.Items) : [];
  const filteredTraderItems = traderItemsList.filter(([name]) => name.toLowerCase().includes(traderItemQuery.toLowerCase()));

  // ─ Category handlers ──────────────────────────────────────────────────────
  const handleAddItem = (classname) => {
    if (!activeCategoryConfig || !selectedCategoryPath) return;
    const lowerName = classname.toLowerCase();
    if (activeCategoryConfig.content.Items.some(i => i.ClassName.toLowerCase() === lowerName)) {
      toast.error(t('econ_toast_classname_exists')); return;
    }
    const newItem = { ClassName: classname, MaxPriceThreshold: 100, MinPriceThreshold: 50, SellPricePercent: -1.0, MaxStockThreshold: 100, MinStockThreshold: 1, QuantityPercent: -1, SpawnAttachments: [], Variants: [] };
    onChangeField(selectedCategoryPath, ['Items'], [...activeCategoryConfig.content.Items, newItem]);
    toast.success(t('econ_toast_added', { classname }));
  };

  const handleRemoveItem = (index) => {
    if (!selectedCategoryPath || !activeCategoryConfig) return;
    const item = activeCategoryConfig.content.Items[index];
    onShowConfirm({
      title: t('econ_remove_item_title'),
      body: t('econ_remove_item_body', { classname: item?.ClassName || 'this item' }),
      severity: 'danger',
      confirmLabel: t('econ_bulk_apply'),
      onConfirm: () => {
        const newList = [...activeCategoryConfig.content.Items];
        newList.splice(index, 1);
        onChangeField(selectedCategoryPath, ['Items'], newList);
        setSelectedItems(prev => { const next = new Set(prev); next.delete(index); return next; });
        toast.warning(t('econ_toast_removed'));
      }
    });
  };

  // B3: Checkbox toggle
  const toggleItemSelect = (idx) => {
    setSelectedItems(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(filteredItems.map(i => i.originalIndex)));
  };

  // B8: Copy item
  const handleCopyItem = (item) => {
    const { originalIndex, ...rest } = item;
    setCopiedItem(rest);
    toast.info(t('econ_toast_copied', { classname: item.ClassName }));
  };

  const handlePasteCopiedItem = () => {
    if (!copiedItem || !activeCategoryConfig || !selectedCategoryPath) return;
    const existing = activeCategoryConfig.content.Items;
    if (existing.some(i => i.ClassName.toLowerCase() === copiedItem.ClassName.toLowerCase())) {
      toast.error(t('econ_toast_already_exists', { classname: copiedItem.ClassName })); return;
    }
    onChangeField(selectedCategoryPath, ['Items'], [...existing, { ...copiedItem }]);
    toast.success(t('econ_toast_pasted', { classname: copiedItem.ClassName }));
    setCopiedItem(null);
  };

  // B7: Import from another category
  const handleImportFromCategory = () => {
    if (!importFromCatPath || !activeCategoryConfig || !selectedCategoryPath) return;
    if (importFromCatPath === selectedCategoryPath) { toast.error(t('econ_toast_import_same')); return; }
    const srcFile = configs[importFromCatPath];
    if (!srcFile?.success || !Array.isArray(srcFile.content.Items)) { toast.error(t('econ_toast_import_empty')); return; }
    const existing = new Set(activeCategoryConfig.content.Items.map(i => i.ClassName.toLowerCase()));
    const toAdd = srcFile.content.Items.filter(i => !existing.has(i.ClassName.toLowerCase()));
    if (toAdd.length === 0) { toast.warning(t('econ_toast_import_exists')); return; }
    onShowConfirm({
      title: t('econ_import_confirm_title'),
      body: t('econ_import_confirm_body', { count: toAdd.length, category: importFromCatPath.split('/').pop() }),
      severity: 'warning',
      confirmLabel: t('econ_bulk_apply'),
      onConfirm: () => {
        onChangeField(selectedCategoryPath, ['Items'], [...activeCategoryConfig.content.Items, ...toAdd.map(i => ({ ...i }))]);
        setShowImportPanel(false);
        setImportFromCatPath('');
        toast.success(t('econ_toast_imported', { count: toAdd.length }));
      }
    });
  };

  const handleApplyBulkPricing = () => {
    if (!activeCategoryConfig || !activeCategoryConfig.content || !Array.isArray(activeCategoryConfig.content.Items)) return;

    const items = activeCategoryConfig.content.Items.map(item => {
      const updated = { ...item };
      
      if (bulkPriceMultiplier !== 1.0) {
        if (updated.MinPriceThreshold !== undefined) {
          const val = Number(updated.MinPriceThreshold);
          if (!isNaN(val)) {
            updated.MinPriceThreshold = Math.max(0, Math.round(val * bulkPriceMultiplier));
          }
        }
        if (updated.MaxPriceThreshold !== undefined) {
          const val = Number(updated.MaxPriceThreshold);
          if (!isNaN(val)) {
            updated.MaxPriceThreshold = Math.max(0, Math.round(val * bulkPriceMultiplier));
          }
        }
      }

      if (enableMinRatioLock && updated.MaxPriceThreshold !== undefined) {
        const valMax = Number(updated.MaxPriceThreshold);
        if (!isNaN(valMax)) {
          updated.MinPriceThreshold = Math.max(0, Math.round(valMax * bulkMinRatio));
        }
      }

      return updated;
    });

    onChangeField(selectedCategoryPath, ['Items'], items);
    toast.success(t('econ_bulk_apply_success', { count: items.length }));
    setShowBulkPricingModal(false);
  };

  // ─ Trader handlers ─────────────────────────────────────────────────────────
  const handleTraderAddCurrency = (cn) => {
    if (!activeTraderConfig || !selectedTraderPath) return;
    const cur = activeTraderConfig.content.Currencies || [];
    if (cur.some(c => c.toLowerCase() === cn.toLowerCase())) return;
    onChangeField(selectedTraderPath, ['Currencies'], [...cur, cn.toLowerCase()]);
    toast.success(t('trader_currency_added', { classname: cn }));
  };
  const handleTraderRemoveCurrency = (idx) => {
    if (!activeTraderConfig || !selectedTraderPath) return;
    const cur = [...(activeTraderConfig.content.Currencies || [])];
    const cn = cur[idx];
    cur.splice(idx, 1);
    onChangeField(selectedTraderPath, ['Currencies'], cur);
    toast.warning(t('trader_currency_removed', { classname: cn }));
  };
  const handleTraderAddCategory = (catName, overrideVal) => {
    if (!activeTraderConfig || !selectedTraderPath) return;
    const cats = activeTraderConfig.content.Categories || [];
    if (cats.some(c => parseTraderCategory(c).name.toLowerCase() === catName.toLowerCase())) { toast.error(t('trader_cat_exists')); return; }
    const str = overrideVal === 3 ? catName : `${catName}:${overrideVal}`;
    onChangeField(selectedTraderPath, ['Categories'], [...cats, str]);
    toast.success(t('trader_cat_added', { classname: catName }));
  };
  const handleTraderRemoveCategory = (idx) => {
    if (!activeTraderConfig || !selectedTraderPath) return;
    const cats = [...(activeTraderConfig.content.Categories || [])];
    cats.splice(idx, 1);
    onChangeField(selectedTraderPath, ['Categories'], cats);
  };
  const handleTraderCategoryOverrideChange = (idx, newMode) => {
    if (!activeTraderConfig || !selectedTraderPath) return;
    const cats = [...(activeTraderConfig.content.Categories || [])];
    const { name } = parseTraderCategory(cats[idx]);
    cats[idx] = newMode === 3 ? name : `${name}:${newMode}`;
    onChangeField(selectedTraderPath, ['Categories'], cats);
  };
  const handleTraderAddItemOverride = (cn, val) => {
    if (!activeTraderConfig || !selectedTraderPath) return;
    onChangeField(selectedTraderPath, ['Items', cn.toLowerCase()], val);
  };
  const handleTraderRemoveItemOverride = (cn) => {
    if (!activeTraderConfig || !selectedTraderPath) return;
    const items = { ...(activeTraderConfig.content.Items || {}) };
    delete items[cn];
    onChangeField(selectedTraderPath, ['Items'], items);
  };

  const handleCreateSafezoneForTrader = () => {
    if (!activeTraderConfig || !selectedTraderPath) return;
    const traderFileName = selectedTraderPath.split('/').pop().replace('.json', '');
    const prefix = getExpansionPrefix(configs);
    const safezoneFileName = `${prefix}traderzones/${traderFileName}_zone.json`;
    const newZoneContent = {
      m_Version: 6,
      m_DisplayName: `${activeTraderConfig.content?.DisplayName || traderFileName} SafeZone`,
      Position: [...npcCoords],
      Radius: 50.0,
      BuyPricePercent: 100.0,
      SellPricePercent: -1.0,
      Stock: {}
    };
    onCreateFile(safezoneFileName, newZoneContent);
    setSelectedSafezonePath(safezoneFileName);
    toast.success(lang === 'ru' ? `Безопасная зона ${traderFileName}_zone создана!` : `SafeZone ${traderFileName}_zone created!`);
  };

  // ─ JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', padding: '8px 16px', alignItems: 'center', gap: '12px' }}>
        <button className={`btn ${subTab === 'overview' ? 'btn-accent' : ''}`} onClick={() => setSubTab('overview')} style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Icon.Overview size={14} />
          <span>{lang === 'ru' ? 'ОБЗОР И АНОМАЛИИ' : 'OVERVIEW & ANOMALIES'}</span>
        </button>
        <button className={`btn ${subTab === 'categories' ? 'btn-accent' : ''}`} onClick={() => setSubTab('categories')} style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Icon.Categories size={14} />
          <span>{t('econ_tab_categories', { count: categoryPaths.length })}</span>
        </button>
        <button className={`btn ${subTab === 'traders' ? 'btn-accent' : ''}`} onClick={() => setSubTab('traders')} style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Icon.Traders size={14} />
          <span>{t('econ_tab_traders', { count: traderPaths.length })}</span>
        </button>
        <button className={`btn ${subTab === 'matrix' ? 'btn-accent' : ''}`} onClick={() => setSubTab('matrix')} style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Icon.Matrix size={14} />
          <span>{t('econ_tab_matrix', { count: traderPaths.length })}</span>
        </button>
        {subTab !== 'overview' && subTab !== 'matrix' && (
          <button 
            className="btn"
            onClick={() => setIsSidebarCollapsed(p => !p)}
            style={{ padding: '6px 12px', fontSize: '11px', letterSpacing: '0.5px' }}
            title={lang === 'ru' ? 'Скрыть/Показать боковую панель' : 'Toggle Sidebar'}
          >
            {isSidebarCollapsed ? '▶' : '◀'} {lang === 'ru' ? 'Панель' : 'Sidebar'}
          </button>
        )}
        <button 
          className="btn" 
          onClick={() => setShowHelpModal(true)} 
          style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold', background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', color: '#ffd54f', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon.Help size={13} color="#ffd54f" />
          <span>{lang === 'ru' ? 'СПРАВКА / ЛЕГЕНДА' : 'HELP / LEGEND'}</span>
        </button>
      </div>

      {/* Main split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── SIDEBAR ────────────────────────────────────────────────────── */}
        {(subTab === 'categories' || subTab === 'traders') && (
          <div style={{ 
            width: isSidebarCollapsed ? '0px' : '240px', 
            minWidth: isSidebarCollapsed ? '0px' : '240px', 
            background: 'var(--bg-secondary)', 
            borderRight: isSidebarCollapsed ? 'none' : '1px solid var(--border-color)', 
            display: 'flex', 
            flexDirection: 'column', 
            userSelect: 'none',
            overflow: 'hidden',
            transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: 'bold' }}>
                  {subTab === 'categories' 
                    ? (lang === 'ru' ? '// КАТЕГОРИИ РЫНКА' : '// MARKET CATEGORIES') 
                    : (lang === 'ru' ? '// ТОРГОВЦЫ' : '// TRADERS')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '2px' }}>
                  {subTab === 'categories' 
                    ? (lang === 'ru' ? `ВСЕГО: ${categoryPaths.length} ФАЙЛОВ` : `TOTAL: ${categoryPaths.length} FILES`)
                    : (lang === 'ru' ? `ВСЕГО: ${traderPaths.length} ТОРГОВЦЕВ` : `TOTAL: ${traderPaths.length} TRADERS`)}
                </div>
              </div>
            </div>

            {/* Sidebar Search Filter */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                placeholder={lang === 'ru' ? 'Поиск файлов...' : 'Search files...'}
                style={{ fontSize: '11px', padding: '5px 24px 5px 8px', width: '100%', height: '28px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
              />
              {sidebarSearch && (
                <button
                  onClick={() => setSidebarSearch('')}
                  style={{
                    position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                    fontSize: '12px', padding: '4px'
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {subTab === 'categories' && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                <button
                  className="btn btn-accent"
                  onClick={() => setShowCreateCategoryModal(true)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.8px', textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon.Plus size={11} />
                  <span>{t('econ_btn_create_category')}</span>
                </button>
              </div>
            )}

            {subTab === 'traders' && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                <button
                  className="btn btn-accent"
                  onClick={() => {
                    setWizardStep(1);
                    setWizardFilename('');
                    setWizardDisplayName('');
                    setWizardIcon('Shotgun');
                    setWizardCustomIcon('');
                    setWizardNpcModel('ExpansionTraderSurvivorM');
                    setWizardCustomNpcModel('');
                    setWizardFaction('');
                    setWizardMinRep(0);
                    setWizardMaxRep(2147483647);
                    setWizardQuestId(-1);
                    setWizardSelectedCats(new Set());
                    setWizardDefaultMode(3);
                    setWizardCurrency('expansionbanknotehryvnia');
                    setWizardCatSearch('');
                    setWizardNpcCoords(npcCoords ? [...npcCoords] : [7500.0, 0.0, 7500.0]);
                    setWizardCreateSafezone(true);
                    setWizardSafezoneRadius(50.0);
                    setShowTraderWizard(true);
                  }}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.8px', textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon.Plus size={11} />
                  <span>{lang === 'ru' ? 'СОЗДАТЬ ТОРГОВЦА' : 'CREATE TRADER'}</span>
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(subTab === 'categories' ? filteredCategoryPaths : filteredTraderPaths).map(path => {
                const isSelected = path === (subTab === 'categories' ? selectedCategoryPath : selectedTraderPath);
                const file = configs[path];
                const hasUnsaved = file && JSON.stringify(file.content) !== JSON.stringify(file.originalContent);
                const name = path.split('/').pop().replace('.json', '').replace(/_/g, ' ').toUpperCase();
                // B1: Item count badge
                const itemCount = subTab === 'categories' && file?.success && Array.isArray(file.content?.Items) ? file.content.Items.length : null;

                return (
                  <div
                    key={path}
                    onClick={() => subTab === 'categories' ? setSelectedCategoryPath(path) : setSelectedTraderPath(path)}
                    onContextMenu={(e) => handleOpenContextMenu(e, subTab === 'categories' ? 'category' : 'trader', path)}
                    style={{
                      padding: '10px 16px', cursor: 'pointer', fontSize: '12px',
                      background: isSelected ? 'rgba(149,192,149,0.1)' : 'transparent',
                      borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                      color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)',
                      borderBottom: '1px solid rgba(30,48,30,0.1)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'all 0.1s',
                    }}
                    onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(149,192,149,0.03)'; }}
                    onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', letterSpacing: '0.5px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {/* B1: item count */}
                      {itemCount !== null && (
                        <span style={{ fontSize: '10px', color: 'var(--text-dark)', background: 'rgba(149,192,149,0.08)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 5px', lineHeight: '16px', fontFamily: 'var(--font-mono)' }}>
                          {itemCount}
                        </span>
                      )}
                      {hasUnsaved && <span className="badge-dirty" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── EDITOR AREA ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

          {subTab === 'overview' && (
            <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px', background: 'var(--bg-primary)' }}>
              {/* Заголовок */}
              <div>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '24px', letterSpacing: '1px' }}>
                  📊 {lang === 'ru' ? 'ОБЗОР ЭКОНОМИКИ И АНОМАЛИИ' : 'ECONOMY OVERVIEW & ANOMALIES'}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {lang === 'ru' ? 'Общий анализ файлов конфигурации рынка и поиск ошибок баланса.' : 'General analysis of market configuration files and balance diagnostics.'}
                </p>
              </div>

              {/* Карточки статистики */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                {[
                  { label: lang === 'ru' ? 'ВСЕГО КАТЕГОРИЙ' : 'TOTAL CATEGORIES', val: economyOverview.totalCategories, color: 'var(--accent-glow)' },
                  { label: lang === 'ru' ? 'ВСЕГО ПРЕДМЕТОВ' : 'TOTAL ITEMS', val: economyOverview.totalItems, color: 'var(--text-glow)' },
                  { label: lang === 'ru' ? 'СРЕДНЯЯ ПОКУПКА' : 'AVG MIN (BUY) PRICE', val: `${economyOverview.avgMinPrice}$`, color: '#ffd54f' },
                  { label: lang === 'ru' ? 'СРЕДНЯЯ ПРОДАЖА' : 'AVG MAX (SELL) PRICE', val: `${economyOverview.avgMaxPrice}$`, color: '#ffd54f' },
                  { label: lang === 'ru' ? 'ОБНАРУЖЕНО ПРОБЛЕМ' : 'ANOMALIES DETECTED', val: economyOverview.anomalies.length, color: economyOverview.anomalies.length > 0 ? '#ff6b6b' : 'var(--text-secondary)' }
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>{label}</span>
                    <strong style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', color }}>{val}</strong>
                  </div>
                ))}
              </div>

              {/* Сплит: Аномалии и Топ-10 дорогих */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'start' }}>
                
                {/* Левая колонка: Список аномалий */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                    ⚠️ {lang === 'ru' ? 'ВЫЯВЛЕННЫЕ АНОМАЛИИ' : 'DETECTED ANOMALIES'} ({economyOverview.anomalies.length})
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '10px 20px' }}>
                    {economyOverview.anomalies.length === 0 ? (
                      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        🎉 {lang === 'ru' ? 'Аномалий не обнаружено. Экономика стабильна!' : 'No anomalies detected. Economy is healthy!'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {economyOverview.anomalies.map((an, idx) => (
                          <div key={idx} style={{ 
                            padding: '10px 14px', 
                            background: an.type === 'error' ? 'rgba(255,107,107,0.06)' : (an.type === 'warning' ? 'rgba(255,193,7,0.04)' : 'rgba(130,180,245,0.04)'), 
                            border: `1px solid ${an.type === 'error' ? 'rgba(255,107,107,0.2)' : (an.type === 'warning' ? 'rgba(255,193,7,0.15)' : 'rgba(130,180,245,0.15)')}`, 
                            borderRadius: '3px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12px'
                          }}>
                            <div>
                              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)' }}>{an.classname}</strong>
                              <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{an.desc}</div>
                            </div>
                            <button 
                              className="btn" 
                              onClick={() => {
                                setSubTab('categories');
                                setSelectedCategoryPath(an.catPath);
                                setItemQuery(an.classname);
                              }}
                              style={{ padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                            >
                              {lang === 'ru' ? 'Перейти →' : 'Fix →'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Правая колонка: Топ-10 дорогих */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                    💎 {lang === 'ru' ? 'ТОП-10 САМЫХ ДОРОГИХ' : 'TOP 10 MOST EXPENSIVE'}
                  </div>
                  <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {economyOverview.topExpensive.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginRight: '6px' }}>#{idx+1}</span>
                          <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)' }} title={item.ClassName}>{item.ClassName}</strong>
                        </div>
                        <span style={{ color: '#ffd54f', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{item.MaxPriceThreshold}$</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {subTab === 'matrix' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, overflow: 'hidden', background: 'var(--bg-primary)', padding: '16px 20px', gap: '12px' }}>
              {/* Header & KPI Statistics */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1.5px', fontWeight: 'bold' }}>
                    // MARKET_MATRIX_SYSTEM
                  </div>
                  <h2 style={{ margin: '2px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '20px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📑 {t('econ_matrix_title')}
                  </h2>
                </div>

                {/* KPI Summary Badges */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🏪</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{lang === 'ru' ? 'ТОРГОВЦЫ' : 'TRADERS'}</span>
                      <strong style={{ fontSize: '13px', color: 'var(--text-glow)', fontFamily: 'var(--font-mono)' }}>{filteredMatrixTraders.length}</strong>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>📦</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{lang === 'ru' ? 'КАТЕГОРИИ' : 'CATEGORIES'}</span>
                      <strong style={{ fontSize: '13px', color: 'var(--text-glow)', fontFamily: 'var(--font-mono)' }}>{filteredMatrixCategories.length}</strong>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🔗</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{lang === 'ru' ? 'СВЯЗЕЙ' : 'ACTIVE LINKS'}</span>
                      <strong style={{ fontSize: '13px', color: '#4ade80', fontFamily: 'var(--font-mono)' }}>{matrixStats.totalLinks}</strong>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>📊</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{lang === 'ru' ? 'ПОКРЫТИЕ' : 'COVERAGE'}</span>
                      <strong style={{ fontSize: '13px', color: matrixStats.coveragePercent >= 80 ? '#4ade80' : matrixStats.coveragePercent >= 40 ? '#fbbf24' : '#ff6b6b', fontFamily: 'var(--font-mono)' }}>
                        {matrixStats.coveragePercent}%
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters and Batch Actions Toolbar */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                {/* Search inputs */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: '220px' }}>
                    <input
                      type="text"
                      value={matrixCatSearch}
                      onChange={e => setMatrixCatSearch(e.target.value)}
                      placeholder={lang === 'ru' ? '🔍 Поиск категорий...' : '🔍 Filter categories...'}
                      style={{ padding: '6px 24px 6px 10px', fontSize: '11px', width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-glow)' }}
                    />
                    {matrixCatSearch && (
                      <button onClick={() => setMatrixCatSearch('')} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>×</button>
                    )}
                  </div>

                  <div style={{ position: 'relative', width: '220px' }}>
                    <input
                      type="text"
                      value={matrixTraderSearch}
                      onChange={e => setMatrixTraderSearch(e.target.value)}
                      placeholder={lang === 'ru' ? '🔍 Поиск торговцев...' : '🔍 Filter traders...'}
                      style={{ padding: '6px 24px 6px 10px', fontSize: '11px', width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-glow)' }}
                    />
                    {matrixTraderSearch && (
                      <button onClick={() => setMatrixTraderSearch('')} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>×</button>
                    )}
                  </div>

                  {/* Filter chips */}
                  <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-primary)', padding: '2px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                    <button
                      onClick={() => setMatrixFilterMode('all')}
                      style={{
                        padding: '3px 8px', fontSize: '10px', border: 'none', borderRadius: '2px', cursor: 'pointer',
                        background: matrixFilterMode === 'all' ? 'var(--bg-tertiary)' : 'transparent',
                        color: matrixFilterMode === 'all' ? 'var(--text-glow)' : 'var(--text-secondary)',
                        fontWeight: matrixFilterMode === 'all' ? 'bold' : 'normal'
                      }}
                    >
                      {t('econ_matrix_filter_all')} ({matrixCategories.length})
                    </button>
                    <button
                      onClick={() => setMatrixFilterMode('assigned')}
                      style={{
                        padding: '3px 8px', fontSize: '10px', border: 'none', borderRadius: '2px', cursor: 'pointer',
                        background: matrixFilterMode === 'assigned' ? 'rgba(74,222,128,0.15)' : 'transparent',
                        color: matrixFilterMode === 'assigned' ? '#4ade80' : 'var(--text-secondary)',
                        fontWeight: matrixFilterMode === 'assigned' ? 'bold' : 'normal'
                      }}
                    >
                      {t('econ_matrix_filter_assigned')} ({matrixStats.assignedCount})
                    </button>
                    <button
                      onClick={() => setMatrixFilterMode('unassigned')}
                      style={{
                        padding: '3px 8px', fontSize: '10px', border: 'none', borderRadius: '2px', cursor: 'pointer',
                        background: matrixFilterMode === 'unassigned' ? 'rgba(255,107,107,0.15)' : 'transparent',
                        color: matrixFilterMode === 'unassigned' ? '#ff6b6b' : 'var(--text-secondary)',
                        fontWeight: matrixFilterMode === 'unassigned' ? 'bold' : 'normal'
                      }}
                    >
                      {t('econ_matrix_filter_unassigned')} ({matrixStats.unassignedCount})
                    </button>
                  </div>
                </div>

                {/* Global Presets */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-accent"
                    onClick={() => {
                      onShowConfirm({
                        title: t('econ_bulk_confirm_title'),
                        body: lang === 'ru' ? 'Назначить все категории всем торговцам в режиме Both (3)?' : 'Assign all categories to all traders in mode Both (3)?',
                        severity: 'warning',
                        confirmLabel: t('modal_confirm_yes'),
                        onConfirm: () => handleMatrixPresetAll(3)
                      });
                    }}
                    style={{ padding: '5px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    ⚡ {t('econ_matrix_preset_all_both')}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      onShowConfirm({
                        title: t('econ_bulk_confirm_title'),
                        body: lang === 'ru' ? 'Очистить все связи категорий у ВСЕХ торговцев?' : 'Clear all category links for ALL traders?',
                        severity: 'danger',
                        confirmLabel: t('modal_confirm_yes'),
                        onConfirm: () => handleMatrixPresetAll(-1)
                      });
                    }}
                    style={{ padding: '5px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    ✕ {t('econ_matrix_preset_clear_all')}
                  </button>
                </div>
              </div>

              {/* Legend Bar */}
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '6px 14px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '11px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '10px', letterSpacing: '0.5px' }}>{lang === 'ru' ? 'РЕЖИМЫ (КЛИК ПО ЯЧЕЙКЕ ДЛЯ ПЕРЕКЛЮЧЕНИЯ):' : 'MODES (CLICK CELL TO CYCLE):'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '10px' }}>
                  <Icon.Check size={11} />
                  <span>{t('econ_matrix_mode_both')}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '10px' }}>
                  <Icon.Import size={11} />
                  <span>{t('econ_matrix_mode_sell')}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '10px' }}>
                  <Icon.Export size={11} />
                  <span>{t('econ_matrix_mode_buy')}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '3px 8px', borderRadius: '3px', fontSize: '10px' }}>
                  <Icon.Trash size={11} />
                  <span>{t('econ_matrix_mode_off')}</span>
                </span>
              </div>

              {/* Scrollable Matrix Table Area */}
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-secondary)' }}>
                <table className="table-tactical" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-tertiary)' }}>
                    <tr>
                      {/* Top-Left Fixed Corner Header */}
                      <th style={{ minWidth: '240px', width: '240px', position: 'sticky', left: 0, top: 0, zIndex: 40, background: 'var(--bg-tertiary)', borderRight: '2px solid var(--border-glow)', borderBottom: '2px solid var(--border-color)', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                            {lang === 'ru' ? 'КАТЕГОРИИ РЫНКА' : 'MARKET CATEGORIES'}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            ({filteredMatrixCategories.length})
                          </span>
                        </div>
                      </th>

                      {/* Trader Column Headers */}
                      {filteredMatrixTraders.map(({ path, filename, name, categories }) => {
                        const isColHovered = hoveredColTrader === path;
                        return (
                          <th
                            key={path}
                            onMouseEnter={() => setHoveredColTrader(path)}
                            onMouseLeave={() => setHoveredColTrader(null)}
                            style={{
                              minWidth: '160px', width: '160px', textAlign: 'center', padding: '10px 8px',
                              background: isColHovered ? 'rgba(149,192,149,0.08)' : 'var(--bg-tertiary)',
                              borderRight: '1px solid var(--border-color)',
                              borderBottom: '2px solid var(--border-color)',
                              transition: 'background 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold', maxWidth: '145px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                                {name}
                              </span>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                                  {categories.length} {lang === 'ru' ? 'кат.' : 'cats'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                <button
                                  className="btn"
                                  style={{ padding: '2px 5px', fontSize: '9px' }}
                                  title={lang === 'ru' ? 'Назначить все категории этому торговцу' : 'Assign all categories to this trader'}
                                  onClick={() => handleMatrixBatchTrader(path, true)}
                                >
                                  + Все
                                </button>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '2px 5px', fontSize: '9px' }}
                                  title={lang === 'ru' ? 'Очистить все категории у этого торговца' : 'Clear all categories for this trader'}
                                  onClick={() => handleMatrixBatchTrader(path, false)}
                                >
                                  ✕ Снять
                                </button>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatrixCategories.length === 0 ? (
                      <tr>
                        <td colSpan={filteredMatrixTraders.length + 1} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {lang === 'ru' ? 'Категории по заданным фильтрам не найдены' : 'No categories match the filter'}
                        </td>
                      </tr>
                    ) : (
                      filteredMatrixCategories.map(({ path: catPath, name: catName, itemCount }) => {
                        const isRowHovered = hoveredRowCat === catName;
                        const assignedTradersCount = matrixStats.catAssignedMap.get(catName.toLowerCase()) || 0;

                        return (
                          <tr
                            key={catPath}
                            onMouseEnter={() => setHoveredRowCat(catName)}
                            onMouseLeave={() => setHoveredRowCat(null)}
                            style={{ background: isRowHovered ? 'rgba(149,192,149,0.04)' : 'transparent' }}
                          >
                            {/* Sticky Category Row Header */}
                            <td style={{
                              position: 'sticky', left: 0, zIndex: 20,
                              background: isRowHovered ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                              borderRight: '2px solid var(--border-glow)',
                              borderBottom: '1px solid var(--border-color)',
                              padding: '8px 12px',
                              transition: 'background 0.15s'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                  <span style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={catName}>
                                    {catName}
                                  </span>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                      {itemCount} {lang === 'ru' ? 'предм.' : 'items'}
                                    </span>
                                    <span style={{ fontSize: '9px', color: assignedTradersCount > 0 ? '#4ade80' : 'var(--text-dark)', fontFamily: 'var(--font-mono)' }}>
                                      • {assignedTradersCount} {lang === 'ru' ? 'торг.' : 'traders'}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                  <button
                                    className="btn"
                                    onClick={() => handleMatrixBatchCategory(catName, true)}
                                    style={{ padding: '2px 5px', fontSize: '9px' }}
                                    title={t('econ_matrix_btn_assign_all_traders')}
                                  >
                                    + Всем
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    onClick={() => handleMatrixBatchCategory(catName, false)}
                                    style={{ padding: '2px 5px', fontSize: '9px' }}
                                    title={t('econ_matrix_btn_clear_all_traders')}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Trader Cells */}
                            {filteredMatrixTraders.map(({ path: traderPath, categories: traderCats, name: traderName }) => {
                              const existingEntry = traderCats.find(c => parseTraderCategory(c).name.toLowerCase() === catName.toLowerCase());
                              const mode = existingEntry ? parseTraderCategory(existingEntry).mode : -1;
                              const isCellCrosshair = isRowHovered || hoveredColTrader === traderPath;

                              return (
                                <td
                                  key={traderPath}
                                  style={{
                                    textAlign: 'center', padding: '6px 8px',
                                    borderRight: '1px solid var(--border-color)',
                                    borderBottom: '1px solid var(--border-color)',
                                    background: isCellCrosshair ? 'rgba(149,192,149,0.03)' : 'transparent'
                                  }}
                                >
                                  <button
                                    onClick={() => handleToggleMatrixCell(traderPath, catName, mode)}
                                    style={{
                                      padding: '5px 8px',
                                      fontSize: '11px',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      borderRadius: '4px',
                                      width: '100%',
                                      transition: 'all 0.15s',
                                      border: mode === 3 ? '1px solid rgba(74,222,128,0.5)'
                                            : mode === 1 ? '1px solid rgba(96,165,250,0.5)'
                                            : mode === 0 ? '1px solid rgba(251,191,36,0.5)'
                                            : '1px solid rgba(255,255,255,0.08)',
                                      background: mode === 3 ? 'rgba(74,222,128,0.18)'
                                                : mode === 1 ? 'rgba(96,165,250,0.18)'
                                                : mode === 0 ? 'rgba(251,191,36,0.18)'
                                                : 'rgba(255,255,255,0.02)',
                                      color: mode === 3 ? '#4ade80'
                                           : mode === 1 ? '#60a5fa'
                                           : mode === 0 ? '#fbbf24'
                                           : 'var(--text-secondary)',
                                      boxShadow: mode !== -1 ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'
                                    }}
                                    title={`${catName} ➔ ${traderName}: ${mode === 3 ? 'Both' : mode === 1 ? 'Sell' : mode === 0 ? 'Buy' : 'Off'} (${lang === 'ru' ? 'Клик для изменения' : 'Click to cycle'})`}
                                  >
                                    {mode === 3 ? '🛒 Both' : mode === 1 ? '⬇️ Sell' : mode === 0 ? '⬆️ Buy' : '—'}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {subTab === 'categories' && (
            activeCategoryConfig && activeCategoryConfig.success && activeCategoryConfig.content && selectedCategoryPath ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* ── Category Command Center Header ──────────────────────── */}
              <div style={{ padding: '12px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                {/* Left: Category Title & Meta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '1.5px', fontWeight: 'bold' }}>
                      // MARKET_CATEGORY_EDITOR
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.5px' }}>
                        {selectedCategoryPath.split('/').pop()}
                      </span>
                      {isCategoryDirty && <span className="badge-dirty" />}
                    </div>
                  </div>

                  {/* Inline DisplayName + InitStockPercent */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--bg-primary)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('econ_display_name_label')}</span>
                      <input
                        type="text"
                        value={activeCategoryConfig.content.DisplayName || ''}
                        onChange={e => onChangeField(selectedCategoryPath, ['DisplayName'], e.target.value)}
                        style={{ fontSize: '11px', padding: '3px 8px', width: '150px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', color: 'var(--text-glow)' }}
                      />
                      {activeCategoryConfig.content.DisplayName && activeCategoryConfig.content.DisplayName.startsWith('#STR_') && (
                        <span style={{ fontSize: '10px', color: '#4ade80', fontStyle: 'italic', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t('econ_translated_name_tooltip')}>
                          ({translateStrKey(activeCategoryConfig.content.DisplayName)})
                        </span>
                      )}
                    </div>

                    <div style={{ width: '1px', height: '18px', background: 'var(--border-color)' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('econ_init_stock_label')}</span>
                      <input
                        type="number"
                        value={activeCategoryConfig.content.InitStockPercent ?? 100}
                        onChange={e => onChangeField(selectedCategoryPath, ['InitStockPercent'], Number(e.target.value))}
                        style={{ fontSize: '11px', padding: '3px 6px', width: '55px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', color: 'var(--text-glow)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Stats Pills + Save Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {catStats && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', padding: '3px 8px', color: 'var(--text-secondary)' }}>
                        {lang === 'ru' ? 'Товаров:' : 'Items:'} <strong style={{ color: 'var(--text-glow)' }}>{catStats.count}</strong>
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', padding: '3px 8px', color: 'var(--text-secondary)' }}>
                        {lang === 'ru' ? 'Ср. покупка:' : 'Avg Buy:'} <strong style={{ color: '#4ade80' }}>{catStats.avgMax}$</strong>
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', padding: '3px 8px', color: 'var(--text-secondary)' }}>
                        {lang === 'ru' ? 'Ср. продажа:' : 'Avg Sell:'} <strong style={{ color: '#fbbf24' }}>{catStats.avgMin}$</strong>
                      </span>
                    </div>
                  )}

                  <button
                    className={`btn ${isCategoryDirty ? 'btn-accent' : ''}`}
                    onClick={() => onSaveFile(selectedCategoryPath)}
                    disabled={!isCategoryDirty}
                    style={{ opacity: isCategoryDirty ? 1 : 0.5, cursor: isCategoryDirty ? 'pointer' : 'not-allowed', padding: '6px 14px', fontSize: '11px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Icon.Save size={13} />
                    <span>{t('econ_save_cat_btn_text')}</span>
                  </button>
                </div>
              </div>

              {/* ── Unified Action Toolbar ───────────────────────────────── */}
              <div style={{ padding: '8px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                {/* Left: Filter + Search-all toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ position: 'relative', width: '200px' }}>
                    <input
                      type="text"
                      placeholder={t('econ_filter_items_ph')}
                      value={itemQuery}
                      onChange={e => setItemQuery(e.target.value)}
                      style={{ fontSize: '11px', padding: '5px 22px 5px 10px', width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-glow)' }}
                    />
                    {itemQuery && (
                      <button onClick={() => setItemQuery('')} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>×</button>
                    )}
                  </div>
                  <button
                    className={`btn ${searchAllMode ? 'btn-accent' : ''}`}
                    onClick={() => setSearchAllMode(prev => !prev)}
                    style={{ padding: '5px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    title={t('econ_search_all_categories_tooltip')}
                  >
                    <Icon.Search size={11} />
                    <span>{searchAllMode ? t('econ_filter_scope_all') : t('econ_filter_scope_cat')}</span>
                  </button>
                </div>

                {/* Center: Add item autocomplete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '260px', maxWidth: '400px' }}>
                  <AutocompleteInput suggestions={suggestions} placeholder={t('econ_type_classname')} onSelect={handleAddItem} style={{ flex: 1 }} />
                  {copiedItem && (
                    <button className="btn btn-warning" onClick={handlePasteCopiedItem} style={{ padding: '5px 10px', fontSize: '11px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }} title={`Paste: ${copiedItem.ClassName}`}>
                      <Icon.Clipboard size={12} />
                      <span>{t('econ_paste_btn', { classname: copiedItem.ClassName })}</span>
                    </button>
                  )}
                </div>

                {/* Right: Tools & Drawers buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    className={`btn ${showImportPanel ? 'btn-accent' : ''}`}
                    onClick={() => setShowImportPanel(prev => !prev)}
                    style={{ padding: '5px 9px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    title={t('econ_import_from_btn')}
                  >
                    <Icon.Import size={12} />
                    <span>{t('econ_import_from_btn')}</span>
                  </button>

                  {Array.isArray(xmlItems) && xmlItems.length > 0 && (
                    <button 
                      className="btn" 
                      onClick={() => setShowXmlImportModal(true)} 
                      style={{ padding: '5px 9px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Icon.FileCode size={12} />
                      <span>{t('econ_import_from_types')}</span>
                    </button>
                  )}

                  <button 
                    className="btn" 
                    onClick={() => setShowBulkPricingModal(true)} 
                    style={{ padding: '5px 9px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Icon.Pricing size={12} />
                    <span>{t('econ_bulk_price_btn')}</span>
                  </button>

                  <button
                    className="btn"
                    onClick={() => setShowBulkPasteModal(true)}
                    style={{ padding: '5px 9px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(130,180,245,0.12)', border: '1px solid rgba(130,180,245,0.3)', color: '#82b4f5' }}
                    title={lang === 'ru' ? 'Вставить список класснеймов из буфера' : 'Paste list of classnames from clipboard'}
                  >
                    <Icon.Clipboard size={12} />
                    <span>{lang === 'ru' ? 'Вставить списком' : 'Bulk Paste'}</span>
                  </button>

                  <button
                    className={`btn ${showTraderLinksDrawer ? 'btn-accent' : ''}`}
                    onClick={() => setShowTraderLinksDrawer(prev => !prev)}
                    style={{ padding: '5px 9px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    title={lang === 'ru' ? 'Двухоконный менеджер связок с торговцами' : 'Trader Links Split-View Manager'}
                  >
                    <Icon.Traders size={12} />
                    <span>{lang === 'ru' ? 'Связи с торговцами' : 'Trader Links'}</span>
                  </button>

                  <button
                    className={`btn ${showPriceChart ? 'btn-accent' : ''}`}
                    onClick={() => setShowPriceChart(prev => !prev)}
                    style={{ padding: '5px 9px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    title={t('econ_btn_price_chart')}
                  >
                    <Icon.Chart size={12} />
                    <span>{t('econ_btn_price_chart')}</span>
                  </button>

                  <button
                    className={`btn ${selectedItems.size > 0 || showBulkDrawer ? 'btn-warning' : ''}`}
                    onClick={() => setShowBulkDrawer(prev => !prev)}
                    style={{ padding: '5px 9px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Icon.Sliders size={12} />
                    <span>{t('econ_bulk_drawer_title')} {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}</span>
                  </button>
                </div>
              </div>

              {/* ── Collapsible Import Panel ────────────────────────────── */}
              {showImportPanel && (
                <div style={{ padding: '8px 20px', background: 'rgba(149,192,149,0.06)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('econ_source_cat_label')}</span>
                  <select
                    value={importFromCatPath}
                    onChange={e => setImportFromCatPath(e.target.value)}
                    style={{ fontSize: '11px', padding: '4px 8px', flex: 1, maxWidth: '280px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                  >
                    <option value="">-- SELECT CATEGORY --</option>
                    {categoryPaths.filter(p => p !== selectedCategoryPath).map(p => (
                      <option key={p} value={p}>{p.split('/').pop().replace('.json', '')}</option>
                    ))}
                  </select>
                  <button className="btn btn-accent" onClick={handleImportFromCategory} disabled={!importFromCatPath} style={{ padding: '4px 12px', fontSize: '11px', opacity: importFromCatPath ? 1 : 0.5 }}>
                    IMPORT
                  </button>
                  <button className="btn" onClick={() => { setShowImportPanel(false); setImportFromCatPath(''); }} style={{ padding: '4px 8px', fontSize: '11px' }}>
                    ✕
                  </button>
                </div>
              )}

              {/* ── Collapsible Price Distribution Chart ─────────────────── */}
              {showPriceChart && priceData && (
                <div style={{ padding: '12px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <div className="economy-chart-card" style={{ margin: 0 }}>
                    <div className="economy-chart-header" style={{ marginBottom: '8px' }}>
                      <div className="economy-chart-title" style={{ fontSize: '12px' }}>
                        📊 {lang === 'ru' ? "Распределение цен категории" : "Category Price Distribution"}
                      </div>
                      <div className="economy-chart-summary" style={{ fontSize: '11px' }}>
                        <div>{lang === 'ru' ? "Ср. покупка: " : "Avg Buy: "}<strong style={{ color: 'var(--accent-glow)' }}>{priceData.avgMax}$</strong></div>
                        <div>{lang === 'ru' ? "Ср. продажа: " : "Avg Sell: "}<strong style={{ color: 'var(--warning-color)' }}>{priceData.avgMin}$</strong></div>
                        <div>{lang === 'ru' ? "Пик: " : "Peak: "}<strong style={{ color: 'var(--danger-color)' }}>{priceData.peakMax}$</strong></div>
                        <div>{lang === 'ru' ? "Товаров: " : "Items: "}<strong style={{ color: 'var(--text-glow)' }}>{priceData.items.length}</strong></div>
                      </div>
                    </div>
                    <div className="economy-chart-svg-container" style={{ height: '110px' }}>
                      <svg width="100%" height="100%" viewBox="0 0 600 120" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                        <line x1="40" y1="20" x2="580" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                        <line x1="40" y1="60" x2="580" y2="60" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                        <line x1="40" y1="100" x2="580" y2="100" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                        
                        {(() => {
                          const total = priceData.items.length;
                          const peak = priceData.peakMax || 1;
                          
                          const maxPoints = priceData.items.map((item, idx) => {
                            const x = (idx / Math.max(1, total - 1)) * 540 + 40;
                            const y = 100 - (item.max / peak) * 80 + 10;
                            return `${x},${y}`;
                          }).join(' ');

                          const minPoints = priceData.items.map((item, idx) => {
                            const x = (idx / Math.max(1, total - 1)) * 540 + 40;
                            const y = 100 - (item.min / peak) * 80 + 10;
                            return `${x},${y}`;
                          }).join(' ');

                          const areaPoints = `40,110 ${maxPoints} 580,110`;

                          return (
                            <>
                              <polygon points={areaPoints} fill="rgba(149, 192, 149, 0.06)" />
                              <polyline points={maxPoints} fill="none" stroke="var(--accent-glow)" strokeWidth="2.5" />
                              <polyline points={minPoints} fill="none" stroke="var(--warning-color)" strokeWidth="1.5" strokeDasharray="4 2" />
                            </>
                          );
                        })()}

                        <line x1="40" y1="10" x2="40" y2="110" stroke="var(--border-color)" strokeWidth="1" />
                        <line x1="40" y1="110" x2="580" y2="110" stroke="var(--border-color)" strokeWidth="1" />

                        <text x="32" y="23" fill="var(--text-secondary)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">{priceData.peakMax}</text>
                        <text x="32" y="63" fill="var(--text-secondary)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">{Math.round(priceData.peakMax / 2)}</text>
                        <text x="32" y="103" fill="var(--text-secondary)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">0</text>
                        
                        <text x="40" y="120" fill="var(--text-secondary)" fontSize="8" textAnchor="start" fontFamily="var(--font-mono)">{priceData.items[0]?.name || ''}</text>
                        <text x="580" y="120" fill="var(--text-secondary)" fontSize="8" textAnchor="end" fontFamily="var(--font-mono)">{priceData.items[priceData.items.length - 1]?.name || ''}</text>
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Collapsible Bulk Actions Drawer ──────────────────────── */}
              {(showBulkDrawer || selectedItems.size > 0) && (
                <div style={{ padding: '8px 20px', background: 'rgba(251,191,36,0.06)', borderBottom: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '11px' }}>
                  <span style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '10px', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                    ⚡ {t('econ_bulk_actions')}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                    {selectedItems.size > 0 ? t('econ_bulk_selected', { count: selectedItems.size }) : t('econ_all_items')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <select
                      id="bulk-op"
                      value={bulkOp}
                      onChange={e => setBulkOp(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-glow)' }}
                    >
                      <option value="mult-buy">{t('econ_bulk_op_mult_buy')}</option>
                      <option value="mult-sell">{t('econ_bulk_op_mult_sell')}</option>
                      <option value="sync-sell-percent">{t('econ_bulk_op_sync_sell')}</option>
                      <option value="reset-sell-percent">{t('econ_bulk_op_reset_sell_pct')}</option>
                      <option value="set-min-stock">{t('econ_bulk_op_set_min_stock')}</option>
                      <option value="set-max-stock">{t('econ_bulk_op_set_max_stock')}</option>
                      <option value="add-attachment">{lang === 'ru' ? 'Добавить обвес' : 'Add Spawn Attachment'}</option>
                      <option value="remove-attachment">{lang === 'ru' ? 'Удалить обвес' : 'Remove Spawn Attachment'}</option>
                      <option value="clear-attachments">{lang === 'ru' ? 'Очистить все обвесы' : 'Clear Spawn Attachments'}</option>
                    </select>
                  </div>
                  {bulkOp !== 'clear-attachments' && bulkOp !== 'reset-sell-percent' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {['add-attachment', 'remove-attachment'].includes(bulkOp) ? (
                        <input
                          type="text"
                          id="bulk-val"
                          placeholder={lang === 'ru' ? 'Имя обвеса...' : 'Attachment name...'}
                          style={{ padding: '4px 8px', fontSize: '11px', width: '140px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-glow)' }}
                        />
                      ) : (
                        <input
                          type="number"
                          id="bulk-val"
                          defaultValue={bulkOp.includes('stock') ? '10' : '1.1'}
                          step="any"
                          style={{ padding: '4px 8px', fontSize: '11px', width: '65px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-glow)', textAlign: 'center' }}
                        />
                      )}
                    </div>
                  )}
                  <button
                    className="btn btn-accent"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={() => {
                      const op  = document.getElementById('bulk-op').value;
                      const valEl = document.getElementById('bulk-val');
                      const valStr = valEl ? valEl.value : '';
                      const val = parseFloat(valStr);

                      if (['mult-buy', 'mult-sell', 'sync-sell-percent', 'set-min-stock', 'set-max-stock'].includes(op) && isNaN(val)) {
                        toast.error(t('econ_toast_bulk_invalid_val'));
                        return;
                      }
                      if (['add-attachment', 'remove-attachment'].includes(op) && !valStr.trim()) {
                        toast.error(lang === 'ru' ? 'Введите имя обвеса' : 'Enter attachment name');
                        return;
                      }

                      onShowConfirm({
                        title: t('econ_bulk_confirm_title'),
                        body: t('econ_bulk_confirm_body', { count: selectedItems.size > 0 ? selectedItems.size : filteredItems.length }),
                        severity: 'warning',
                        confirmLabel: t('econ_bulk_apply'),
                        onConfirm: () => {
                          const targetIndices = selectedItems.size > 0
                            ? new Set(selectedItems)
                            : new Set(filteredItems.map(i => i.originalIndex));

                          const updatedItems = activeCategoryConfig.content.Items.map((item, idx) => {
                            if (!targetIndices.has(idx)) return item;
                            const u = { ...item };
                            if (op === 'mult-buy') {
                              u.MinPriceThreshold = Math.max(1, Math.round(u.MinPriceThreshold * val));
                              u.MaxPriceThreshold = Math.max(1, Math.round(u.MaxPriceThreshold * val));
                            } else if (op === 'mult-sell') {
                              const cur = u.SellPricePercent === -1.0 ? 50.0 : u.SellPricePercent;
                              u.SellPricePercent = Math.max(0, Math.round(cur * val * 10) / 10);
                            } else if (op === 'sync-sell-percent') {
                              u.SellPricePercent = Math.max(0, Math.round(val * 10) / 10);
                            } else if (op === 'reset-sell-percent') {
                              u.SellPricePercent = -1.0;
                            } else if (op === 'set-min-stock') {
                              u.MinStockThreshold = Math.max(0, Math.round(val));
                            } else if (op === 'set-max-stock') {
                              u.MaxStockThreshold = Math.max(0, Math.round(val));
                            } else if (op === 'add-attachment') {
                              const atts = u.SpawnAttachments ? [...u.SpawnAttachments] : [];
                              const nameToAdd = valStr.trim();
                              if (!atts.includes(nameToAdd)) {
                                atts.push(nameToAdd);
                              }
                              u.SpawnAttachments = atts;
                            } else if (op === 'remove-attachment') {
                              const atts = u.SpawnAttachments ? [...u.SpawnAttachments] : [];
                              const nameToRemove = valStr.trim().toLowerCase();
                              u.SpawnAttachments = atts.filter(a => a.toLowerCase() !== nameToRemove);
                            } else if (op === 'clear-attachments') {
                              u.SpawnAttachments = [];
                            }
                            return u;
                          });
                          onChangeField(selectedCategoryPath, ['Items'], updatedItems);
                          setSelectedItems(new Set());
                          toast.success(t('econ_toast_bulk_applied'));
                        }
                      });
                    }}
                  >
                    {t('econ_bulk_apply_btn')}
                  </button>
                </div>
              )}

                {/* ── Split-View: Trader Links Manager Drawer ──────────────────── */}
              {showTraderLinksDrawer && selectedCategoryPath && (
                <div style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-glow)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold', fontFamily: 'var(--font-heading)', letterSpacing: '0.6px' }}>
                        🤝 {lang === 'ru' ? 'ПРИВЯЗКА ТЕКУЩЕЙ КАТЕГОРИИ К ТОРГОВЦАМ' : 'TRADERS SELLING THIS CATEGORY'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        ({selectedCategoryPath.split('/').pop()})
                      </span>
                    </div>
                    <button
                      onClick={() => setShowTraderLinksDrawer(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}
                    >
                      ×
                    </button>
                  </div>

                  {traderPaths.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      {lang === 'ru' ? 'В проекте нет файлов торговцев' : 'No traders configured in project'}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                      {traderPaths.map(tp => {
                        const tFile = configs[tp];
                        const tContent = tFile?.content || {};
                        const tDisplayName = tContent.DisplayName || tp.split('/').pop().replace('.json', '');
                        const currentCatName = selectedCategoryPath.split('/').pop().replace('.json', '');
                        const categories = Array.isArray(tContent.Categories) ? tContent.Categories : [];
                        
                        const linkEntry = categories.find(c => {
                          const { name } = parseTraderCategory(c);
                          return name.toLowerCase() === currentCatName.toLowerCase();
                        });

                        const isLinked = Boolean(linkEntry);
                        const currentMode = linkEntry ? parseTraderCategory(linkEntry).mode : 3;

                        return (
                          <div
                            key={tp}
                            style={{
                              padding: '10px 12px',
                              background: isLinked ? 'rgba(149,192,149,0.08)' : 'var(--bg-primary)',
                              border: isLinked ? '1px solid var(--accent-glow)' : '1px solid var(--border-color)',
                              borderRadius: '3px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: isLinked ? 'bold' : 'normal', color: isLinked ? 'var(--text-glow)' : 'var(--text-primary)' }}>
                                <input
                                  type="checkbox"
                                  checked={isLinked}
                                  onChange={() => handleToggleTraderCategoryLink(tp, currentCatName, currentMode)}
                                  style={{ cursor: 'pointer', accentColor: 'var(--accent-glow)' }}
                                />
                                <span style={{ fontFamily: 'var(--font-heading)' }}>{tDisplayName}</span>
                              </label>

                              <button
                                className="btn"
                                onClick={() => {
                                  setSelectedTraderPath(tp);
                                  setSubTab('traders');
                                }}
                                style={{ padding: '2px 6px', fontSize: '9px' }}
                                title={lang === 'ru' ? 'Перейти к торговцу' : 'Navigate to trader'}
                              >
                                →
                              </button>
                            </div>

                            {isLinked && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingLeft: '22px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                  {lang === 'ru' ? 'Режим торговли:' : 'Trade Mode:'}
                                </span>
                                <select
                                  value={currentMode}
                                  onChange={e => handleChangeTraderCategoryMode(tp, currentCatName, Number(e.target.value))}
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-glow)'
                                  }}
                                >
                                  <option value={3}>{lang === 'ru' ? 'Купля и продажа (3)' : 'Both (3)'}</option>
                                  <option value={1}>{lang === 'ru' ? 'Только покупка (1)' : 'Buy only (1)'}</option>
                                  <option value={2}>{lang === 'ru' ? 'Только продажа (2)' : 'Sell only (2)'}</option>
                                  <option value={0}>{lang === 'ru' ? 'Отключено (0)' : 'Disabled (0)'}</option>
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Items table */}
                <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
                        {/* B4: Cross-category search results */}
                  {searchAllMode && itemQuery.trim() ? (
                    <>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>
                        {t('econ_cross_found', { count: crossCatResults.length, query: itemQuery })}
                      </div>
                      <div className="table-container">
                        <table className="table-tactical">
                          <thead>
                            <tr>
                              <th style={{ width: '30%' }}>{t('econ_th_classname')}</th>
                              <th style={{ width: '25%' }}>{t('econ_th_category')}</th>
                              <th style={{ width: '12%', textAlign: 'center' }}>{t('econ_th_minprice')}</th>
                              <th style={{ width: '12%', textAlign: 'center' }}>{t('econ_th_maxprice')}</th>
                              <th style={{ width: '12%', textAlign: 'center' }}>{t('econ_th_sellpct')}</th>
                              <th style={{ width: '9%', textAlign: 'center' }}>{t('econ_th_goto')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {crossCatResults.length === 0 ? (
                              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>{t('econ_cross_no_matches')}</td></tr>
                            ) : crossCatResults.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontSize: '13px' }}>{item.ClassName}</td>
                                <td style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)' }}>{item.catName}</td>
                                <td style={{ textAlign: 'center' }}>{item.MinPriceThreshold}</td>
                                <td style={{ textAlign: 'center' }}>{item.MaxPriceThreshold}</td>
                                <td style={{ textAlign: 'center' }}>{item.SellPricePercent}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <button className="btn" onClick={() => { setSelectedCategoryPath(item.catPath); setSearchAllMode(false); setItemQuery(''); }} style={{ padding: '3px 8px', fontSize: '10px' }}>→</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="table-container">
                      <table className="table-tactical">
                        <thead>
                          <tr>
                            {/* B3: Select-all checkbox */}
                            <th style={{ width: '32px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={filteredItems.length > 0 && selectedItems.size === filteredItems.length}
                                onChange={toggleSelectAll}
                                style={{ cursor: 'pointer', accentColor: 'var(--text-glow)' }}
                                title={t('select_all')}
                              />
                            </th>
                            {/* B2: Sortable headers */}
                            <SortableHeader field="ClassName"          label={t('econ_th_classname')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '24%' }} />
                            <SortableHeader field="MinPriceThreshold"  label={t('econ_th_minprice')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '10%', textAlign: 'center' }} tipKey="tip_econ_min_price" />
                            <SortableHeader field="MaxPriceThreshold"  label={t('econ_th_maxprice')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '10%', textAlign: 'center' }} tipKey="tip_econ_max_price" />
                            <SortableHeader field="MinStockThreshold"  label={t('econ_th_minstock')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '9%', textAlign: 'center' }} tipKey="tip_econ_min_stock" />
                            <SortableHeader field="MaxStockThreshold"  label={t('econ_th_maxstock')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '9%', textAlign: 'center' }} tipKey="tip_econ_max_stock" />
                            <SortableHeader field="SellPricePercent"   label={t('econ_th_sellpct')}     sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '9%', textAlign: 'center' }} tipKey="tip_econ_sell_pct" />
                            <th style={{ width: '15%', textAlign: 'center' }}>{lang === 'ru' ? 'Обвесы' : 'Attachments'}</th>
                            <th style={{ width: '10%', textAlign: 'center' }}>{t('econ_th_actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.length === 0 ? (
                            <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                              {itemQuery ? t('econ_no_items_match') : t('econ_no_items_add')}
                            </td></tr>
                          ) : (
                            paginatedItems.map((item) => {
                              const origItems   = activeCategoryConfig.originalContent?.Items || [];
                              const origItem    = origItems[item.originalIndex] || {};
                              const isDup       = isDuplicate(item.ClassName);
                              const dupCats     = getDupCats(item.ClassName);
                              const isSelected  = selectedItems.has(item.originalIndex);
                              // B10: validation highlights
                              const minPriceErr = item.MinPriceThreshold > item.MaxPriceThreshold;
                              const minStockErr = item.MinStockThreshold  > item.MaxStockThreshold;

                              return (
                                <React.Fragment key={item.originalIndex}>
                                  <tr 
                                      style={{ background: isSelected ? 'rgba(149,192,149,0.06)' : 'transparent' }}
                                      onContextMenu={(e) => handleOpenContextMenu(e, 'item', { item, index: item.originalIndex, catPath: selectedCategoryPath })}
                                    >
                                    {/* B3: Row checkbox */}
                                    <td style={{ textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleItemSelect(item.originalIndex)}
                                        style={{ cursor: 'pointer', accentColor: 'var(--text-glow)' }}
                                      />
                                    </td>
                                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: '14px', color: 'var(--text-glow)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <EditableCell
                                          value={item.ClassName} originalValue={origItem.ClassName}
                                          onChange={val => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'ClassName'], val)}
                                        />
                                        {/* B9: Duplicate badge */}
                                        {isDup && (
                                          <span className="dup-badge" title={`Also in: ${dupCats.filter(c => c !== selectedCategoryPath.split('/').pop().replace('.json','')).join(', ')}`}>
                                            ⚠ DUP
                                          </span>
                                        )}
                                        {isItemMissing(item.ClassName) && (
                                          <span 
                                            title={t('econ_item_missing_tooltip')} 
                                            style={{ 
                                              color: '#ff6b6b', 
                                              fontSize: '9px', 
                                              marginLeft: '6px', 
                                              cursor: 'help',
                                              background: 'rgba(255,107,107,0.12)',
                                              border: '1px solid rgba(255,107,107,0.3)',
                                              padding: '1px 5px',
                                              borderRadius: '2px',
                                              fontFamily: 'var(--font-mono)'
                                            }}
                                          >
                                            ⚠️ {t('econ_badge_missing_xml')}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    {/* B10: error highlights on min>max cells */}
                                    <td><EditableCell type="number" value={item.MinPriceThreshold} originalValue={origItem.MinPriceThreshold} hasError={minPriceErr} onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'MinPriceThreshold'], v)} style={{ textAlign: 'center' }} /></td>
                                    <td><EditableCell type="number" value={item.MaxPriceThreshold} originalValue={origItem.MaxPriceThreshold} hasError={minPriceErr} onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'MaxPriceThreshold'], v)} style={{ textAlign: 'center' }} /></td>
                                    <td><EditableCell type="number" value={item.MinStockThreshold} originalValue={origItem.MinStockThreshold} hasError={minStockErr} onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'MinStockThreshold'], v)} style={{ textAlign: 'center' }} /></td>
                                    <td><EditableCell type="number" value={item.MaxStockThreshold} originalValue={origItem.MaxStockThreshold} hasError={minStockErr} onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'MaxStockThreshold'], v)} style={{ textAlign: 'center' }} /></td>
                                    <td style={{ textAlign: 'center' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        <EditableCell type="number" value={item.SellPricePercent} originalValue={origItem.SellPricePercent} onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'SellPricePercent'], v)} style={{ textAlign: 'center' }} />
                                        {item.SellPricePercent === -1 || item.SellPricePercent === -1.0 || item.SellPricePercent === undefined ? (
                                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '2px', fontFamily: 'var(--font-mono)' }}>
                                            {t('econ_badge_default_sell')}
                                          </span>
                                        ) : (item.SellPricePercent >= 100 || item.SellPricePercent <= 0) ? (
                                          <span style={{ fontSize: '9px', color: '#ff4d4d', background: 'rgba(255,77,77,0.15)', border: '1px solid rgba(255,77,77,0.3)', padding: '1px 4px', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }} title={t('econ_badge_exploit_sell')}>
                                            ⚠️ {item.SellPricePercent}%
                                          </span>
                                        ) : (
                                          <span style={{ fontSize: '9px', color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '1px 4px', borderRadius: '2px', fontFamily: 'var(--font-mono)' }}>
                                            {item.SellPricePercent}%
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    {/* Attachments Column */}
                                    <td style={{ textAlign: 'center' }}>
                                      <button
                                        className="btn"
                                        onClick={() => {
                                          setExpandedRows(prev => {
                                            const next = new Set(prev);
                                            if (next.has(item.originalIndex)) {
                                              next.delete(item.originalIndex);
                                            } else {
                                              next.add(item.originalIndex);
                                            }
                                            return next;
                                          });
                                        }}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          background: (item.SpawnAttachments && item.SpawnAttachments.length > 0) ? 'rgba(130,180,245,0.15)' : 'transparent',
                                          border: (item.SpawnAttachments && item.SpawnAttachments.length > 0) ? '1px solid rgba(130,180,245,0.3)' : '1px solid var(--border-color)',
                                          color: (item.SpawnAttachments && item.SpawnAttachments.length > 0) ? '#82b4f5' : 'var(--text-secondary)',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px'
                                        }}
                                      >
                                        📎 {item.SpawnAttachments ? item.SpawnAttachments.length : 0}
                                        <span style={{ fontSize: '9px', opacity: 0.7 }}>
                                          {expandedRows.has(item.originalIndex) ? '▲' : '▼'}
                                        </span>
                                      </button>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                        {/* B8: Copy button */}
                                        <button className="btn" onClick={() => handleCopyItem(item)} style={{ padding: '3px 6px', fontSize: '11px' }} title={t('econ_copy_item_tooltip')}>📋</button>
                                        <button className="btn btn-danger" onClick={() => handleRemoveItem(item.originalIndex)} style={{ padding: '3px 7px', fontSize: '11px', fontFamily: 'monospace' }}>×</button>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Expandable attachments editor drawer */}
                                  {expandedRows.has(item.originalIndex) && (
                                    <tr style={{ background: 'rgba(130,180,245,0.02)' }}>
                                      <td colSpan="9" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                                              📎 {lang === 'ru' ? 'НАСТРОЙКА ОБВЕСОВ (СПАВН)' : 'SPAWN ATTACHMENTS'} FOR <span style={{ color: 'var(--accent-glow)' }}>{item.ClassName}</span>
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                              <button
                                                className="btn"
                                                onClick={() => {
                                                  if (item.SpawnAttachments && item.SpawnAttachments.length > 0) {
                                                    setCopiedAttachments([...item.SpawnAttachments]);
                                                    toast.info(lang === 'ru' ? 'Обвесы скопированы' : 'Attachments copied');
                                                  } else {
                                                    toast.error(lang === 'ru' ? 'Нет обвесов для копирования' : 'No attachments to copy');
                                                  }
                                                }}
                                                style={{ padding: '3px 8px', fontSize: '10px' }}
                                              >
                                                {lang === 'ru' ? 'Копировать' : 'Copy'}
                                              </button>
                                              {copiedAttachments && (
                                                <button
                                                  className="btn btn-accent"
                                                  onClick={() => {
                                                    onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'SpawnAttachments'], [...copiedAttachments]);
                                                    toast.success(lang === 'ru' ? 'Обвесы вставлены' : 'Attachments pasted');
                                                  }}
                                                  style={{ padding: '3px 8px', fontSize: '10px' }}
                                                >
                                                  {lang === 'ru' ? 'Вставить' : 'Paste'} ({copiedAttachments.length})
                                                </button>
                                              )}
                                              <button
                                                className="btn btn-danger"
                                                onClick={() => {
                                                  onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'SpawnAttachments'], []);
                                                  toast.warning(lang === 'ru' ? 'Обвесы очищены' : 'Attachments cleared');
                                                }}
                                                style={{ padding: '3px 8px', fontSize: '10px' }}
                                              >
                                                {lang === 'ru' ? 'Очистить' : 'Clear'}
                                              </button>
                                            </div>
                                          </div>

                                          {/* Current Attachments list */}
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '24px', alignItems: 'center' }}>
                                            {(!item.SpawnAttachments || item.SpawnAttachments.length === 0) ? (
                                              <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic' }}>
                                                {lang === 'ru' ? 'Нет установленных обвесов. Добавьте ниже.' : 'No attachments configured. Add below.'}
                                              </span>
                                            ) : (
                                              item.SpawnAttachments.map((att, attIdx) => (
                                                <span
                                                  key={attIdx}
                                                  style={{
                                                    background: 'rgba(255,255,255,0.04)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '3px',
                                                    padding: '2px 8px',
                                                    fontSize: '11px',
                                                    fontFamily: 'var(--font-mono)',
                                                    color: 'var(--text-primary)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                  }}
                                                >
                                                  {att}
                                                  {isItemMissing(att) && <span title={t('econ_item_missing_tooltip')} style={{ color: 'var(--warning-color)', cursor: 'help' }}>⚠️</span>}
                                                  <button
                                                    onClick={() => {
                                                      const updatedAtts = [...item.SpawnAttachments];
                                                      updatedAtts.splice(attIdx, 1);
                                                      onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'SpawnAttachments'], updatedAtts);
                                                    }}
                                                    style={{
                                                      background: 'none',
                                                      border: 'none',
                                                      color: '#ff6b6b',
                                                      cursor: 'pointer',
                                                      fontSize: '12px',
                                                      padding: '0 2px',
                                                      display: 'inline-flex',
                                                      alignItems: 'center'
                                                    }}
                                                  >
                                                    ×
                                                  </button>
                                                </span>
                                              ))
                                            )}
                                          </div>

                                          {/* Add Attachment autocomplete */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '350px', marginTop: '4px' }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                              {lang === 'ru' ? 'Добавить обвес:' : 'Add attachment:'}
                                            </span>
                                            <AutocompleteInput
                                              suggestions={suggestions}
                                              placeholder={t('econ_type_classname')}
                                              onSelect={(attName) => {
                                                const currentAtts = item.SpawnAttachments || [];
                                                if (currentAtts.includes(attName)) {
                                                  toast.error(lang === 'ru' ? 'Этот обвес уже добавлен' : 'Attachment already added');
                                                  return;
                                                }
                                                onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'SpawnAttachments'], [...currentAtts, attName]);
                                                toast.success(lang === 'ru' ? `Добавлен обвес: ${attName}` : `Added attachment: ${attName}`);
                                              }}
                                              style={{ flex: 1 }}
                                            />
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {filteredItems.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {lang === 'ru' ? 'Показано ' : 'Showing '}
                        <strong style={{ color: 'var(--text-glow)' }}>
                          {itemsPerPage === -1 ? 1 : (currentPage - 1) * itemsPerPage + 1}
                        </strong>
                        {lang === 'ru' ? ' - ' : ' to '}
                        <strong style={{ color: 'var(--text-glow)' }}>
                          {itemsPerPage === -1 ? filteredItems.length : Math.min(filteredItems.length, currentPage * itemsPerPage)}
                        </strong>
                        {lang === 'ru' ? ' из ' : ' of '}
                        <strong style={{ color: 'var(--text-glow)' }}>{filteredItems.length}</strong>
                        {lang === 'ru' ? ' предметов' : ' items'}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Page navigation */}
                        {itemsPerPage !== -1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              className="btn"
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage(1)}
                              style={{ padding: '4px 8px', fontSize: '11px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                            >
                              «
                            </button>
                            <button
                              className="btn"
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              style={{ padding: '4px 8px', fontSize: '11px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                            >
                              ‹
                            </button>
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', margin: '0 8px', fontFamily: 'var(--font-mono)' }}>
                              {lang === 'ru' ? 'Стр. ' : 'Page '}
                              <strong style={{ color: 'var(--text-glow)' }}>{currentPage}</strong>
                              {lang === 'ru' ? ' из ' : ' of '}
                              <strong style={{ color: 'var(--text-glow)' }}>{Math.ceil(filteredItems.length / itemsPerPage)}</strong>
                            </span>
                            <button
                              className="btn"
                              disabled={currentPage >= Math.ceil(filteredItems.length / itemsPerPage)}
                              onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredItems.length / itemsPerPage), p + 1))}
                              style={{ padding: '4px 8px', fontSize: '11px', opacity: currentPage >= Math.ceil(filteredItems.length / itemsPerPage) ? 0.5 : 1, cursor: currentPage >= Math.ceil(filteredItems.length / itemsPerPage) ? 'not-allowed' : 'pointer' }}
                            >
                              ›
                            </button>
                            <button
                              className="btn"
                              disabled={currentPage >= Math.ceil(filteredItems.length / itemsPerPage)}
                              onClick={() => setCurrentPage(Math.ceil(filteredItems.length / itemsPerPage))}
                              style={{ padding: '4px 8px', fontSize: '11px', opacity: currentPage >= Math.ceil(filteredItems.length / itemsPerPage) ? 0.5 : 1, cursor: currentPage >= Math.ceil(filteredItems.length / itemsPerPage) ? 'not-allowed' : 'pointer' }}
                            >
                              »
                            </button>
                          </div>
                        )}

                        {/* Page size selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {lang === 'ru' ? 'Размер страницы:' : 'Page size:'}
                          </span>
                          <select
                            value={itemsPerPage}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setItemsPerPage(val);
                              localStorage.setItem('dayz_editor_economy_items_per_page', String(val));
                              setCurrentPage(1);
                            }}
                            style={{ padding: '3px 8px', fontSize: '11px', width: '90px', height: '24px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                          >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={-1}>{lang === 'ru' ? 'Все' : 'Show All'}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                {t('econ_select_cat_label')}
              </div>
            )
          )}

          {subTab === 'traders' && (
            /* ── TRADERS VIEW (unchanged structure, kept clean) ──────────── */
            activeTraderConfig && activeTraderConfig.success && activeTraderConfig.content && selectedTraderPath ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Header */}
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '2px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px' }}>{t('econ_trader_editing_label')}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--text-glow)', fontWeight: 'bold', marginTop: '2px' }}>{selectedTraderPath.split('/').pop()}</div>
                  </div>
                  <button className={`btn ${isTraderDirty ? 'btn-accent' : ''}`} onClick={() => onSaveFile(selectedTraderPath)} disabled={!isTraderDirty} style={{ opacity: isTraderDirty ? 1 : 0.5, cursor: isTraderDirty ? 'pointer' : 'not-allowed' }}>
                    {t('econ_trader_save_btn')}
                  </button>
                </div>

                {/* Grid */}
                <div className="trader-grid-responsive">

                  {/* General settings */}
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', letterSpacing: '1px' }}>{t('trader_general_params')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {[
                        { label: t('trader_label_name'),          key: 'DisplayName',        type: 'text',   ph: '' },
                        { label: t('trader_label_icon'),          key: 'TraderIcon',         type: 'text',   ph: '' },
                        { label: t('trader_label_min_rep'),       key: 'MinRequiredReputation', type: 'number', ph: '0' },
                        { label: t('trader_label_max_rep'),       key: 'MaxRequiredReputation', type: 'number', ph: '2147483647' },
                        { label: t('trader_label_faction'),       key: 'RequiredFaction',    type: 'text',   ph: 'e.g. InvincibleObservers' },
                        { label: t('trader_label_currency_name'), key: 'DisplayCurrencyName', type: 'text', ph: 'Default' },
                      ].map(({ label, key, type, ph }) => (
                        <div key={key}>
                          <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                            {label}
                            {key === 'DisplayName' && activeTraderConfig.content[key] && activeTraderConfig.content[key].startsWith('#STR_') && (
                              <span style={{ color: 'var(--text-glow)', marginLeft: '6px', fontStyle: 'italic' }}>
                                ({translateStrKey(activeTraderConfig.content[key])})
                              </span>
                            )}
                          </label>
                          <input type={type} value={activeTraderConfig.content[key] ?? (type === 'number' ? 0 : '')} onChange={e => onChangeField(selectedTraderPath, [key], type === 'number' ? Number(e.target.value) : e.target.value)} placeholder={ph} />
                        </div>
                      ))}

                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('trader_label_quest_req')}</label>
                        <select value={activeTraderConfig.content.RequiredCompletedQuestID ?? -1} onChange={e => onChangeField(selectedTraderPath, ['RequiredCompletedQuestID'], Number(e.target.value))} style={{ fontSize: '12px', padding: '6px' }}>
                          <option value={-1}>{t('trader_quest_none')}</option>
                          {questsList.map(q => <option key={q.id} value={q.id}>ID {q.id}: {q.title}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('trader_label_currency_val')}</label>
                        <select value={activeTraderConfig.content.DisplayCurrencyValue ?? 1} onChange={e => onChangeField(selectedTraderPath, ['DisplayCurrencyValue'], Number(e.target.value))} style={{ fontSize: '12px', padding: '6px' }}>
                          <option value={1}>{t('trader_show_val')}</option>
                          <option value={0}>{t('trader_hide_val')}</option>
                        </select>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('trader_label_sort_order')}</label>
                        <select value={activeTraderConfig.content.UseCategoryOrder ?? 0} onChange={e => onChangeField(selectedTraderPath, ['UseCategoryOrder'], Number(e.target.value))} style={{ fontSize: '12px', padding: '6px' }}>
                          <option value={0}>{t('trader_sort_standard')}</option>
                          <option value={1}>{t('trader_sort_ascending')}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Currencies */}
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', letterSpacing: '1px' }}>{t('trader_currency_accepted')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '8px', border: '1px solid var(--border-color)' }}>
                      {(activeTraderConfig.content.Currencies || []).length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '8px', textAlign: 'center' }}>{t('trader_no_currencies')}</div>
                      ) : (
                        (activeTraderConfig.content.Currencies || []).map((cur, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {cur}
                              {isItemMissing(cur) && <span title={t('econ_item_missing_trader_tooltip')} style={{ color: 'var(--warning-color)', cursor: 'help' }}>⚠️</span>}
                            </span>
                            <button className="btn btn-danger" onClick={() => handleTraderRemoveCurrency(idx)} style={{ padding: '2px 6px', fontSize: '10px' }}>×</button>
                          </div>
                        ))
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('trader_add_currency')}</span>
                      <AutocompleteInput suggestions={suggestions} placeholder={t('trader_search_class')} onSelect={handleTraderAddCurrency} style={{ flex: 1 }} />
                    </div>
                  </div>
                </div>

                {/* Trader Categories */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', letterSpacing: '1px' }}>{t('trader_market_categories')}</div>
                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="table-tactical">
                      <thead><tr><th>{t('trader_th_category')}</th><th style={{ width: '30%', textAlign: 'center' }}>{t('trader_select_cat_override')}</th><th style={{ width: '10%', textAlign: 'center' }}>{t('trader_th_action')}</th></tr></thead>
                      <tbody>
                        {(activeTraderConfig.content.Categories || []).length === 0 ? (
                          <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>{t('trader_no_categories')}</td></tr>
                        ) : (
                          (activeTraderConfig.content.Categories || []).map((catStr, idx) => {
                            const { name, mode } = parseTraderCategory(catStr);
                            const matchingPath = categoryPaths.find(p => p.split('/').pop().toLowerCase() === `${name.toLowerCase()}.json`);
                            return (
                              <tr key={idx}>
                                <td style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', color: 'var(--text-glow)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {matchingPath && (
                                    <button
                                      className="btn"
                                      onClick={() => {
                                        setSubTab('categories');
                                        setSelectedCategoryPath(matchingPath);
                                      }}
                                      style={{ padding: '2px 6px', fontSize: '10px' }}
                                      title={t('econ_th_goto') || 'Перейти'}
                                    >
                                      📂
                                    </button>
                                  )}
                                  <span>{name}</span>
                                </div></td>
                                <td style={{ textAlign: 'center' }}>
                                  <select value={mode} onChange={e => handleTraderCategoryOverrideChange(idx, Number(e.target.value))} style={{ fontSize: '11px', padding: '4px', width: '180px', margin: '0 auto' }}>
                                    <option value={3}>{t('trader_direction_both')}</option>
                                    <option value={1}>{t('trader_direction_buy')}</option>
                                    <option value={2}>{t('trader_direction_sell')}</option>
                                    <option value={0}>{t('trader_direction_disabled')}</option>
                                  </select>
                                </td>
                                <td style={{ textAlign: 'center' }}><button className="btn btn-danger" onClick={() => handleTraderRemoveCategory(idx)} style={{ padding: '3px 8px', fontSize: '10px' }}>×</button></td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('trader_label_add_category')}</span>
                    <select id="new-cat-select" style={{ fontSize: '12px', width: '200px' }}>
                      <option value="">{t('trader_select_cat_ph')}</option>
                      {marketCategoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select id="new-cat-mode" style={{ fontSize: '12px', width: '150px' }}>
                      <option value={3}>{t('trader_direction_both')}</option>
                      <option value={1}>{t('trader_direction_buy')}</option>
                      <option value={2}>{t('trader_direction_sell')}</option>
                      <option value={0}>{t('trader_direction_disabled')}</option>
                    </select>
                    <button className="btn btn-accent" onClick={() => { const sel = document.getElementById('new-cat-select'); const mode = document.getElementById('new-cat-mode'); if (sel?.value) { handleTraderAddCategory(sel.value, Number(mode.value)); sel.value = ''; } }}>
                      {t('trader_add_category_btn')}
                    </button>
                  </div>
                </div>

                {/* Item Overrides */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', letterSpacing: '1px' }}>{t('trader_item_overrides')}</div>
                  <div style={{ width: '250px', position: 'relative' }}>
                    <input type="text" placeholder={t('econ_filter_overrides')} value={traderItemQuery} onChange={e => setTraderItemQuery(e.target.value)} style={{ fontSize: '11px', padding: '6px 12px 6px 24px' }} />
                    <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '10px' }}>▶</span>
                  </div>
                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="table-tactical">
                      <thead><tr><th>{t('trader_th_item')}</th><th style={{ width: '30%', textAlign: 'center' }}>{t('trader_th_override')}</th><th style={{ width: '10%', textAlign: 'center' }}>{t('trader_th_action')}</th></tr></thead>
                      <tbody>
                        {filteredTraderItems.length === 0 ? (
                          <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>{t('trader_no_overrides')}</td></tr>
                        ) : (
                          filteredTraderItems.map(([classname, val]) => (
                            <tr key={classname}>
                              <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontSize: '13px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {classname}
                                  {isItemMissing(classname) && <span title={t('econ_item_missing_trader_tooltip')} style={{ color: 'var(--warning-color)', cursor: 'help' }}>⚠️</span>}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <select value={val} onChange={e => handleTraderAddItemOverride(classname, Number(e.target.value))} style={{ fontSize: '11px', padding: '4px', width: '180px', margin: '0 auto' }}>
                                  <option value={3}>{t('trader_direction_both')}</option>
                                  <option value={1}>{t('trader_direction_buy')}</option>
                                  <option value={2}>{t('trader_direction_sell')}</option>
                                  <option value={0}>{t('trader_direction_disabled')}</option>
                                </select>
                              </td>
                              <td style={{ textAlign: 'center' }}><button className="btn btn-danger" onClick={() => handleTraderRemoveItemOverride(classname)} style={{ padding: '3px 8px', fontSize: '10px' }}>×</button></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('trader_add_override_btn')}</span>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                      <AutocompleteInput suggestions={suggestions} placeholder={t('econ_type_classname')} onSelect={(name) => { const modeEl = document.getElementById('new-item-override-mode'); handleTraderAddItemOverride(name, Number(modeEl.value)); }} />
                    </div>
                    <select id="new-item-override-mode" style={{ fontSize: '12px', width: '150px' }}>
                      <option value={3}>{t('trader_direction_both')}</option>
                      <option value={1}>{t('trader_direction_buy')}</option>
                      <option value={2}>{t('trader_direction_sell')}</option>
                      <option value={0}>{t('trader_direction_disabled')}</option>
                    </select>
                  </div>
                </div>

                {/* Visual Category Overrides Selector */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold', letterSpacing: '1px' }}>
                      🌳 {t('econ_trader_overrides_tree')}
                    </div>
                    <div style={{ width: '220px', position: 'relative' }}>
                      <input
                        type="text"
                        placeholder={lang === 'ru' ? 'Поиск товара...' : 'Filter item...'}
                        value={overrideSearchQuery}
                        onChange={e => setOverrideSearchQuery(e.target.value)}
                        style={{ fontSize: '11px', padding: '4px 8px 4px 22px', width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                      />
                      <span style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '10px' }}>🔍</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                    {(activeTraderConfig.content.Categories || []).length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '16px', textAlign: 'center' }}>
                        {lang === 'ru' ? 'Сначала добавьте категории товаров торговцу выше' : 'Assign categories to trader above first'}
                      </div>
                    ) : (
                      (activeTraderConfig.content.Categories || []).map(catStr => {
                        const { name: catName } = parseTraderCategory(catStr);
                        const matchingPath = categoryPaths.find(p => p.split('/').pop().toLowerCase() === `${catName.toLowerCase()}.json`);
                        const catFile = matchingPath ? configs[matchingPath] : null;
                        const catItems = catFile?.success && Array.isArray(catFile.content?.Items) ? catFile.content.Items : [];
                        
                        const filteredCatItems = catItems.filter(item => {
                          if (!overrideSearchQuery.trim()) return true;
                          return item.ClassName.toLowerCase().includes(overrideSearchQuery.toLowerCase());
                        });

                        const isExpanded = expandedOverrideCats.has(catName.toLowerCase()) || Boolean(overrideSearchQuery.trim());
                        const activeOverridesCount = catItems.filter(i => activeTraderConfig.content.Items && activeTraderConfig.content.Items[i.ClassName.toLowerCase()] !== undefined).length;

                        return (
                          <div key={catName} style={{ border: '1px solid var(--border-color)', borderRadius: '3px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                            {/* Accordion header */}
                            <div
                              onClick={() => {
                                setExpandedOverrideCats(prev => {
                                  const next = new Set(prev);
                                  const k = catName.toLowerCase();
                                  if (next.has(k)) next.delete(k); else next.add(k);
                                  return next;
                                });
                              }}
                              style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{isExpanded ? '▼' : '▶'}</span>
                                <span style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--text-glow)', fontFamily: 'var(--font-heading)' }}>{catName}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '1px 6px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                                  {catItems.length} {lang === 'ru' ? 'предм.' : 'items'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {activeOverridesCount > 0 && (
                                  <span style={{ fontSize: '10px', color: 'var(--accent-glow)', background: 'rgba(149,192,149,0.1)', border: '1px solid rgba(149,192,149,0.3)', padding: '1px 6px', borderRadius: '3px' }}>
                                    ⚡ {activeOverridesCount} {lang === 'ru' ? 'оверрайдов' : 'overrides'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Accordion body */}
                            {isExpanded && (
                              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {filteredCatItems.length === 0 ? (
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '8px' }}>
                                    {lang === 'ru' ? 'В этой категории нет подходящих предметов' : 'No items match in this category'}
                                  </div>
                                ) : (
                                  filteredCatItems.map(item => {
                                    const cnLower = item.ClassName.toLowerCase();
                                    const overrideMode = activeTraderConfig.content.Items ? activeTraderConfig.content.Items[cnLower] : undefined;
                                    const isOverridden = overrideMode !== undefined;

                                    return (
                                      <div key={item.ClassName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '11px', flexWrap: 'wrap', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontFamily: 'var(--font-mono)', color: isOverridden ? 'var(--text-glow)' : 'var(--text-primary)', fontWeight: isOverridden ? 'bold' : 'normal' }}>
                                            {item.ClassName}
                                          </span>
                                          {isItemMissing(item.ClassName) && (
                                            <span title={t('econ_item_missing_tooltip')} style={{ color: '#ff6b6b', fontSize: '9px', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', padding: '0 4px', borderRadius: '2px' }}>⚠️ XML</span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                          <button
                                            className="btn"
                                            onClick={() => handleTraderRemoveItemOverride(cnLower)}
                                            style={{
                                              padding: '2px 6px', fontSize: '9px',
                                              background: !isOverridden ? 'rgba(255,255,255,0.1)' : 'transparent',
                                              border: !isOverridden ? '1px solid var(--border-glow)' : '1px solid var(--border-color)',
                                              color: !isOverridden ? 'var(--text-glow)' : 'var(--text-secondary)'
                                            }}
                                            title={lang === 'ru' ? 'Наследовать режим категории' : 'Inherit category mode'}
                                          >
                                            {lang === 'ru' ? 'Наследовать' : 'Inherit'}
                                          </button>
                                          <button
                                            className="btn"
                                            onClick={() => handleTraderAddItemOverride(cnLower, 3)}
                                            style={{
                                              padding: '2px 6px', fontSize: '9px',
                                              background: overrideMode === 3 ? 'rgba(74,222,128,0.2)' : 'transparent',
                                              border: overrideMode === 3 ? '1px solid #4ade80' : '1px solid var(--border-color)',
                                              color: overrideMode === 3 ? '#4ade80' : 'var(--text-secondary)'
                                            }}
                                          >
                                            🛒 Both (3)
                                          </button>
                                          <button
                                            className="btn"
                                            onClick={() => handleTraderAddItemOverride(cnLower, 2)}
                                            style={{
                                              padding: '2px 6px', fontSize: '9px',
                                              background: overrideMode === 2 ? 'rgba(96,165,250,0.2)' : 'transparent',
                                              border: overrideMode === 2 ? '1px solid #60a5fa' : '1px solid var(--border-color)',
                                              color: overrideMode === 2 ? '#60a5fa' : 'var(--text-secondary)'
                                            }}
                                          >
                                            ⬇️ Sell (2)
                                          </button>
                                          <button
                                            className="btn"
                                            onClick={() => handleTraderAddItemOverride(cnLower, 1)}
                                            style={{
                                              padding: '2px 6px', fontSize: '9px',
                                              background: overrideMode === 1 ? 'rgba(251,191,36,0.2)' : 'transparent',
                                              border: overrideMode === 1 ? '1px solid #fbbf24' : '1px solid var(--border-color)',
                                              color: overrideMode === 1 ? '#fbbf24' : 'var(--text-secondary)'
                                            }}
                                          >
                                            ⬆️ Buy (1)
                                          </button>
                                          <button
                                            className="btn btn-danger"
                                            onClick={() => handleTraderAddItemOverride(cnLower, 0)}
                                            style={{
                                              padding: '2px 6px', fontSize: '9px',
                                              background: overrideMode === 0 ? 'rgba(255,75,75,0.2)' : 'transparent',
                                              border: overrideMode === 0 ? '1px solid #ff4b4b' : '1px solid var(--border-color)',
                                              color: overrideMode === 0 ? '#ff4b4b' : 'var(--text-secondary)'
                                            }}
                                          >
                                            🚫 Off (0)
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Stage 3: World, NPC & SafeZone Binding */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', letterSpacing: '1px' }}>
                    🌐 {t('econ_trader_world_title')}
                  </div>

                  {/* SafeZone Row */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-primary)', padding: '14px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        🛡️ {t('econ_trader_safezone_label')}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                          value={selectedSafezonePath}
                          onChange={e => setSelectedSafezonePath(e.target.value)}
                          style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)', width: '220px' }}
                        >
                          <option value="">-- {t('econ_trader_safezone_none')} --</option>
                          {safezonePaths.map(p => (
                            <option key={p} value={p}>{p.split('/').pop().replace('.json', '')}</option>
                          ))}
                        </select>
                        {selectedSafezonePath && configs[selectedSafezonePath]?.content?.Position && onNavigateToMap && (
                          <button
                            className="btn btn-accent"
                            onClick={() => onNavigateToMap(configs[selectedSafezonePath].content.Position)}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            title={t('econ_trader_show_map')}
                          >
                            📍 {t('econ_trader_show_map')}
                          </button>
                        )}
                        <button
                          className="btn"
                          onClick={handleCreateSafezoneForTrader}
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          + {lang === 'ru' ? 'Создать SafeZone' : 'Create SafeZone'}
                        </button>
                      </div>
                    </div>
                    {selectedSafezonePath && configs[selectedSafezonePath]?.content && (
                      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                        <span>Radius: <strong style={{ color: 'var(--text-glow)' }}>{configs[selectedSafezonePath].content.Radius}m</strong></span>
                        <span>Pos: <strong style={{ color: 'var(--text-glow)' }}>{JSON.stringify(configs[selectedSafezonePath].content.Position)}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* NPC Spawn Entity Row */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-primary)', padding: '14px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        🧍 {t('econ_trader_npc_model')}
                      </span>
                      <select
                        value={npcModel}
                        onChange={e => setNpcModel(e.target.value)}
                        style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)', width: '250px' }}
                      >
                        <option value="ExpansionTraderSurvivorM">ExpansionTraderSurvivorM (Male Survivor)</option>
                        <option value="ExpansionTraderSurvivorF">ExpansionTraderSurvivorF (Female Survivor)</option>
                        <option value="ExpansionTraderCivilianM">ExpansionTraderCivilianM (Civilian)</option>
                        <option value="ExpansionTraderPriest">ExpansionTraderPriest (Priest)</option>
                        <option value="ExpansionTraderPolice">ExpansionTraderPolice (Police Officer)</option>
                        <option value="ExpansionTraderMirek">ExpansionTraderMirek (Mirek)</option>
                        <option value="ExpansionTraderBoris">ExpansionTraderBoris (Boris)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                          📍 {t('econ_trader_npc_coords')}
                        </span>
                        {onNavigateToMap && (
                          <button
                            className="btn btn-accent"
                            onClick={() => onNavigateToMap(npcCoords)}
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                          >
                            📍 {t('econ_trader_show_map')}
                          </button>
                        )}
                      </div>
                      <CoordinatesInput
                        layout="row"
                        position={npcCoords}
                        onChange={pos => setNpcCoords(pos)}
                        onPickFromMap={() => {
                          if (setCoordinatePicker && setActiveTab) {
                            setCoordinatePicker({
                              active: true,
                              returnTab: 'economy',
                              callback: ({ x, z }) => {
                                setNpcCoords([Number(x.toFixed(2)), 0.0, Number(z.toFixed(2))]);
                              }
                            });
                            setActiveTab('map');
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                {t('econ_select_trader_label')}
              </div>
            )
          )}
        </div>
      </div>

      {/* 📥 types.xml Mass Import Modal */}
      {showXmlImportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 99995,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            width: '680px',
            maxHeight: '90vh',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glow)',
            borderRadius: '4px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8), 0 0 15px rgba(149,192,149,0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'toastIn 0.2s ease',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px' }}>// MASS_IMPORT_DATABASE</div>
                <h3 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '18px' }}>
                  IMPORT FROM TYPES.XML
                </h3>
              </div>
              <button 
                className="btn" 
                onClick={() => { setShowXmlImportModal(false); setSelectedXmlClassnames(new Set()); setXmlSearchQuery(''); }} 
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                {t('xml_close_btn')}
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category Info */}
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: '2px', border: '1px solid var(--border-color)' }}>
                {t('xml_target_cat', { category: selectedCategoryPath?.split('/').pop() })}<br />
                {t('xml_missing_items', { count: availableXmlItems.length, total: Array.isArray(xmlItems) ? xmlItems.length : 0 })}
              </div>

              {/* Default values configuration */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '2px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>
                  {t('xml_set_defaults')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      <span className="label-with-help">{t('econ_th_minprice')}<HelpIcon tipKey="tip_econ_min_price" /></span>
                    </label>
                    <input 
                      type="number" 
                      value={defaultMinPrice} 
                      onChange={e => setDefaultMinPrice(Number(e.target.value))} 
                      style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      <span className="label-with-help">{t('econ_th_maxprice')}<HelpIcon tipKey="tip_econ_max_price" /></span>
                    </label>
                    <input 
                      type="number" 
                      value={defaultMaxPrice} 
                      onChange={e => setDefaultMaxPrice(Number(e.target.value))} 
                      style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      <span className="label-with-help">{t('econ_th_sellpct')}<HelpIcon tipKey="tip_econ_sell_pct" /></span>
                    </label>
                    <input 
                      type="number" 
                      value={defaultSellPercent} 
                      onChange={e => setDefaultSellPercent(Number(e.target.value))} 
                      style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      <span className="label-with-help">{t('econ_th_minstock')}<HelpIcon tipKey="tip_econ_min_stock" /></span>
                    </label>
                    <input 
                      type="number" 
                      value={defaultMinStock} 
                      onChange={e => setDefaultMinStock(Number(e.target.value))} 
                      style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      <span className="label-with-help">{t('econ_th_maxstock')}<HelpIcon tipKey="tip_econ_max_stock" /></span>
                    </label>
                    <input 
                      type="number" 
                      value={defaultMaxStock} 
                      onChange={e => setDefaultMaxStock(Number(e.target.value))} 
                      style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Search filter input */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    placeholder={t('xml_search_missing')}
                    value={xmlSearchQuery}
                    onChange={e => setXmlSearchQuery(e.target.value)}
                    style={{ fontSize: '12px', padding: '8px 12px 8px 30px' }}
                  />
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '12px' }}>🔍</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {t('xml_matches', { count: xmlFilteredItems.length })}
                </div>
              </div>

              {/* Items checklist */}
              <div style={{
                flex: 1,
                border: '1px solid var(--border-color)',
                borderRadius: '2px',
                background: 'var(--bg-primary)',
                maxHeight: '300px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Select All Row */}
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}>
                  <input
                    type="checkbox"
                    id="select-all-xml"
                    checked={xmlFilteredItems.length > 0 && xmlFilteredItems.every(item => selectedXmlClassnames.has(item))}
                    onChange={() => {
                      const allSelected = xmlFilteredItems.every(item => selectedXmlClassnames.has(item));
                      setSelectedXmlClassnames(prev => {
                        const next = new Set(prev);
                        if (allSelected) {
                          xmlFilteredItems.forEach(item => next.delete(item));
                        } else {
                          xmlFilteredItems.forEach(item => next.add(item));
                        }
                        return next;
                      });
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="select-all-xml" style={{ fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>
                    {t('xml_select_all', { count: xmlFilteredItems.length })}
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {t('xml_total_selected', { count: selectedXmlClassnames.size })}
                  </span>
                </div>

                {xmlFilteredItems.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {t('xml_no_missing_matches')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {xmlFilteredItems.map(classname => {
                      const isSelected = selectedXmlClassnames.has(classname);
                      return (
                        <div
                          key={classname}
                          onClick={() => {
                            setSelectedXmlClassnames(prev => {
                              const next = new Set(prev);
                              if (next.has(classname)) next.delete(classname);
                              else next.add(classname);
                              return next;
                            });
                          }}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(149,192,149,0.04)' : 'transparent',
                            transition: 'background 0.1s'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)' }}>
                            {classname}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              background: 'var(--bg-tertiary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}>
              <button 
                className="btn" 
                onClick={() => { setShowXmlImportModal(false); setSelectedXmlClassnames(new Set()); setXmlSearchQuery(''); }}
                style={{ padding: '8px 16px' }}
              >
                {t('modal_confirm_cancel')}
              </button>
              <button 
                className="btn btn-accent" 
                onClick={() => {
                  if (selectedXmlClassnames.size === 0) {
                    toast.warning(t('econ_toast_xml_no_select'));
                    return;
                  }
                  if (defaultMinPrice > defaultMaxPrice) {
                    toast.error(t('econ_toast_xml_price_error'));
                    return;
                  }
                  const itemsToAdd = Array.from(selectedXmlClassnames).map(cn => ({
                    ClassName: cn,
                    MaxPriceThreshold: defaultMaxPrice,
                    MinPriceThreshold: defaultMinPrice,
                    SellPricePercent: defaultSellPercent,
                    MaxStockThreshold: defaultMaxStock,
                    MinStockThreshold: defaultMinStock,
                    QuantityPercent: -1,
                    SpawnAttachments: [],
                    Variants: []
                  }));
                  onChangeField(selectedCategoryPath, ['Items'], [...activeCategoryConfig.content.Items, ...itemsToAdd]);
                  toast.success(t('econ_toast_xml_imported', { count: itemsToAdd.length }));
                  setShowXmlImportModal(false);
                  setSelectedXmlClassnames(new Set());
                  setXmlSearchQuery('');
                }}
                style={{ padding: '8px 20px', fontWeight: 'bold' }}
                disabled={selectedXmlClassnames.size === 0}
              >
                📥 {t('xml_import_selected_btn', { count: selectedXmlClassnames.size })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💸 Bulk Price Modifier Modal */}
      {showBulkPricingModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 99995,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            width: '480px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glow)',
            borderRadius: '4px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8), 0 0 15px rgba(149,192,149,0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'toastIn 0.2s ease',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 'bold', color: 'var(--text-glow)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💸 {t('econ_bulk_price_title')}
              </span>
              <button 
                onClick={() => setShowBulkPricingModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {t('econ_bulk_price_desc')}
              </div>

              {/* Price scaling multiplier */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                  {t('econ_bulk_scale_label')}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    step="0.05"
                    value={bulkPriceMultiplier}
                    onChange={(e) => setBulkPriceMultiplier(parseFloat(e.target.value) || 1.0)}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      color: 'var(--text-glow)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      width: '120px',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>
                    (1.0 = no change, 1.1 = +10%, 0.9 = -10%)
                  </span>
                </div>
              </div>

              {/* Ratio lock enable/disable checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <input
                  id="ratio-lock-chk"
                  type="checkbox"
                  checked={enableMinRatioLock}
                  onChange={(e) => setEnableMinRatioLock(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="ratio-lock-chk" style={{ fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>
                  {t('econ_bulk_min_ratio_label')}
                </label>
              </div>

              {/* Min to Max price percentage slider */}
              {enableMinRatioLock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '26px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-mono)', alignItems: 'center' }}>
                    <span className="label-with-help" style={{ color: 'var(--text-secondary)' }}>
                      {lang === 'ru' ? 'Соотношение мин. цены:' : 'Min Price ratio:'}
                      <HelpIcon tipKey="tip_econ_bulk_min_ratio" />
                    </span>
                    <span style={{ color: 'var(--text-glow)', fontWeight: 'bold' }}>{Math.round(bulkMinRatio * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bulkMinRatio}
                    onChange={(e) => setBulkMinRatio(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              background: 'var(--bg-tertiary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'flex-end', gap: '12px',
            }}>
              <button 
                className="btn" 
                onClick={() => setShowBulkPricingModal(false)}
                style={{ padding: '8px 16px' }}
              >
                {t('modal_confirm_cancel')}
              </button>
              <button 
                className="btn btn-warning" 
                onClick={handleApplyBulkPricing}
                style={{ padding: '8px 20px', fontWeight: 'bold' }}
              >
                {lang === 'ru' ? 'Применить' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🧙 Trader Creation Wizard Modal */}
      {showTraderWizard && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 99995,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            width: '640px',
            maxHeight: '90vh',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glow)',
            borderRadius: '4px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8), 0 0 15px rgba(130,180,245,0.15)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'toastIn 0.2s ease',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px' }}>
                  // {lang === 'ru' ? 'МАСТЕР СОЗДАНИЯ ТОРГОВЦА' : 'TRADER CREATION WIZARD'}
                </div>
                <h3 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '18px' }}>
                  {lang === 'ru' ? `Шаг ${wizardStep} из 4` : `Step ${wizardStep} of 4`}
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '12px', fontWeight: 'normal', fontFamily: 'var(--font-mono)' }}>
                    {wizardStep === 1 && (lang === 'ru' ? '— Базовая информация и NPC' : '— Basic Info & NPC Model')}
                    {wizardStep === 2 && (lang === 'ru' ? '— Категории и Режим торговли' : '— Categories & Trade Mode')}
                    {wizardStep === 3 && (lang === 'ru' ? '— Валюта, Фракция и Квесты' : '— Currency, Faction & Quests')}
                    {wizardStep === 4 && (lang === 'ru' ? '— Спавн в мире и SafeZone' : '— World Spawn & SafeZone')}
                  </span>
                </h3>
              </div>
              <button 
                className="btn" 
                onClick={() => setShowTraderWizard(false)} 
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                {t('xml_close_btn')}
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Step indicator bar */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                {[1, 2, 3, 4].map(s => (
                  <div key={s} style={{ 
                    flex: 1, 
                    height: '4px', 
                    background: wizardStep >= s ? 'var(--accent-glow)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '2px',
                    transition: 'background 0.3s'
                  }} />
                ))}
              </div>

              {/* ── STEP 1: Basic Info & NPC Model ──────────────────────────── */}
              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Filename */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'ИМЯ ФАЙЛА ТОРГОВЦА (В СИСТЕМЕ)' : 'SYSTEM FILENAME'} *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input 
                        type="text" 
                        value={wizardFilename} 
                        onChange={e => setWizardFilename(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        placeholder="e.g. weapons_merchant" 
                        autoFocus
                      />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>.json</span>
                    </div>
                    {traderPaths.some(p => p.split('/').pop().toLowerCase() === `${wizardFilename.toLowerCase()}.json`) && (
                      <span style={{ fontSize: '11px', color: '#ff6b6b', marginTop: '4px', display: 'block' }}>
                        ⚠️ {lang === 'ru' ? 'Файл с таким именем уже существует!' : 'A trader with this filename already exists!'}
                      </span>
                    )}
                  </div>

                  {/* Display Name */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'ОТОБРАЖАЕМОЕ ИМЯ (В ИГРЕ)' : 'IN-GAME DISPLAY NAME'} *
                    </label>
                    <input 
                      type="text" 
                      value={wizardDisplayName} 
                      onChange={e => setWizardDisplayName(e.target.value)}
                      placeholder="e.g. Weapons & Ammo Dealer" 
                    />
                  </div>

                  {/* NPC Model / Character Preset */}
                  <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                        🧍 {lang === 'ru' ? '3D-МОДЕЛЬ / ПРЕСЕТ ВНЕШНОСТИ NPC' : 'NPC 3D MODEL / CHARACTER PRESET'}
                      </label>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {lang === 'ru' ? 'Expansion NPC Class' : 'Expansion NPC Class'}
                      </span>
                    </div>
                    
                    <select
                      value={wizardNpcModel}
                      onChange={e => setWizardNpcModel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-glow)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="ExpansionTraderSurvivorM">ExpansionTraderSurvivorM (Мужчина выживший / Survivor Male)</option>
                      <option value="ExpansionTraderSurvivorF">ExpansionTraderSurvivorF (Женщина выжившая / Survivor Female)</option>
                      <option value="ExpansionTraderCivilianM">ExpansionTraderCivilianM (Гражданский мужчина / Civilian Male)</option>
                      <option value="ExpansionTraderCivilianF">ExpansionTraderCivilianF (Гражданская женщина / Civilian Female)</option>
                      <option value="ExpansionTraderPriest">ExpansionTraderPriest (Священник / Priest)</option>
                      <option value="ExpansionTraderPolice">ExpansionTraderPolice (Полицейский / Police Officer)</option>
                      <option value="ExpansionTraderMirek">ExpansionTraderMirek (Мирек / Mirek)</option>
                      <option value="ExpansionTraderBoris">ExpansionTraderBoris (Борис / Boris)</option>
                      <option value="ExpansionTraderZombie">ExpansionTraderZombie (Зомби-торговец / Zombie Trader)</option>
                      <option value="ExpansionMarketATM">ExpansionMarketATM (Банкомат / ATM Terminal)</option>
                      <option value="ExpansionMarketBoard">ExpansionMarketBoard (Инфо-стенд / Market Board)</option>
                      <option value="Custom">{lang === 'ru' ? 'Кастомный класс DayZ / eAI...' : 'Custom DayZ / eAI Class...'}</option>
                    </select>

                    {wizardNpcModel === 'Custom' && (
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="text"
                          value={wizardCustomNpcModel}
                          onChange={e => setWizardCustomNpcModel(e.target.value)}
                          placeholder="e.g. SurvivorM_Mirek, eAIBase, etc."
                          style={{ width: '100%', background: 'var(--bg-secondary)' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Trader Icon presets */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'ИКОНКА ТОРГОВЦА (МАРКЕР/МЕНЮ)' : 'TRADER ICON (MARKER/MENU)'}
                    </label>
                    <select 
                      value={wizardIcon} 
                      onChange={e => setWizardIcon(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-glow)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {['Shotgun', 'Car', 'Clothing', 'Melee', 'Medical', 'Food', 'Boats', 'Exchange', 'Deliver', 'Custom'].map(icon => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                    {wizardIcon === 'Custom' && (
                      <input 
                        type="text" 
                        value={wizardCustomIcon} 
                        onChange={e => setWizardCustomIcon(e.target.value)}
                        placeholder="Enter custom icon name..." 
                        style={{ marginTop: '6px' }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 2: Categories & Trade Mode ─────────────────────────── */}
              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' 
                      ? 'Выберите категории товаров, которые будут привязаны к этому торговцу:' 
                      : 'Choose market categories that will be attached to this trader:'}
                  </div>

                  {/* Default Direction Override */}
                  <div style={{ background: 'var(--bg-primary)', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '3px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-glow)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                      {lang === 'ru' ? 'РЕЖИМ ТОРГОВЛИ ПО УМОЛЧАНИЮ' : 'DEFAULT TRADE DIRECTION'}
                    </label>
                    <select 
                      value={wizardDefaultMode} 
                      onChange={e => setWizardDefaultMode(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        color: 'var(--text-glow)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px'
                      }}
                    >
                      <option value={3}>{t('trader_direction_both')} (3)</option>
                      <option value={1}>{t('trader_direction_buy')} (1)</option>
                      <option value={2}>{t('trader_direction_sell')} (2)</option>
                      <option value={0}>{t('trader_direction_disabled')} (0)</option>
                    </select>
                  </div>
                  
                  {/* Filter & Selection Controls */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        type="text" 
                        placeholder={lang === 'ru' ? 'Поиск категории...' : 'Search category...'} 
                        value={wizardCatSearch}
                        onChange={e => setWizardCatSearch(e.target.value)}
                        style={{ paddingLeft: '28px' }}
                      />
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '11px' }}>🔍</span>
                    </div>
                    <button 
                      className="btn" 
                      onClick={() => {
                        const filtered = marketCategoryNames.filter(name => name.toLowerCase().includes(wizardCatSearch.toLowerCase()));
                        setWizardSelectedCats(prev => {
                          const next = new Set(prev);
                          filtered.forEach(c => next.add(c));
                          return next;
                        });
                      }}
                      style={{ padding: '6px 10px', fontSize: '11px' }}
                    >
                      {lang === 'ru' ? 'Выбрать все' : 'Select All'}
                    </button>
                    <button 
                      className="btn" 
                      onClick={() => {
                        const filtered = marketCategoryNames.filter(name => name.toLowerCase().includes(wizardCatSearch.toLowerCase()));
                        setWizardSelectedCats(prev => {
                          const next = new Set(prev);
                          filtered.forEach(c => next.delete(c));
                          return next;
                        });
                      }}
                      style={{ padding: '6px 10px', fontSize: '11px' }}
                    >
                      {lang === 'ru' ? 'Снять все' : 'Clear All'}
                    </button>
                  </div>

                  {/* Checklist of Categories */}
                  <div style={{ 
                    flex: 1, 
                    border: '1px solid var(--border-color)', 
                    background: 'var(--bg-primary)',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    borderRadius: '2px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {marketCategoryNames
                      .filter(name => name.toLowerCase().includes(wizardCatSearch.toLowerCase()))
                      .map(name => {
                        const isSelected = wizardSelectedCats.has(name);
                        return (
                          <div 
                            key={name}
                            onClick={() => {
                              setWizardSelectedCats(prev => {
                                const next = new Set(prev);
                                if (next.has(name)) next.delete(name);
                                else next.add(name);
                                return next;
                              });
                            }}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid rgba(255,255,255,0.02)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(130,180,245,0.04)' : 'transparent',
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              readOnly
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: '13px', color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)' }}>
                              {name.toUpperCase()}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {lang === 'ru' ? `Выбрано категорий: ${wizardSelectedCats.size}` : `Selected categories: ${wizardSelectedCats.size}`}
                  </div>
                </div>
              )}

              {/* ── STEP 3: Currency, Faction & Quests ───────────────────────── */}
              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Accepted Currency */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'ПРИНИМАЕМАЯ ВАЛЮТА (CURRENCY)' : 'ACCEPTED CURRENCY'}
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input 
                        type="text" 
                        value={wizardCurrency} 
                        onChange={e => setWizardCurrency(e.target.value)}
                        placeholder="e.g. expansionbanknotehryvnia"
                      />
                      
                      {/* Quick Currency Presets */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {[
                          { id: 'expansionbanknotehryvnia', label: lang === 'ru' ? '₴ Гривна' : '₴ Hryvnia' },
                          { id: 'expansionbanknoteeuro', label: lang === 'ru' ? '€ Евро' : '€ Euro' },
                          { id: 'expansionbanknotedollar', label: lang === 'ru' ? '$ Доллар' : '$ Dollar' },
                          { id: 'expansionbanknoteruble', label: lang === 'ru' ? '₽ Рубль' : '₽ Ruble' },
                          { id: 'expansiongoldbar', label: lang === 'ru' ? '🪙 Золото' : '🪙 Gold Bar' }
                        ].map(curr => {
                          const isSelected = wizardCurrency.toLowerCase() === curr.id;
                          return (
                            <div
                              key={curr.id}
                              onClick={() => setWizardCurrency(curr.id)}
                              style={{
                                fontSize: '10px',
                                padding: '4px 8px',
                                background: isSelected ? 'rgba(149,192,149,0.15)' : 'var(--bg-primary)',
                                border: isSelected ? '1px solid var(--accent-glow)' : '1px solid var(--border-color)',
                                borderRadius: '3px',
                                color: isSelected ? 'var(--text-glow)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.1s',
                                userSelect: 'none'
                              }}
                            >
                              {curr.label}
                            </div>
                          );
                        })}
                      </div>

                      <span style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px' }}>
                        {lang === 'ru' ? 'Поиск в базе типов для автодополнения:' : 'Search database to autocomplete:'}
                      </span>
                      <AutocompleteInput 
                        suggestions={suggestions} 
                        placeholder={t('trader_search_class')} 
                        onSelect={setWizardCurrency} 
                        showButton={false}
                      />
                    </div>
                  </div>

                  {/* Required Faction */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'НЕОБХОДИМАЯ ФРАКЦИЯ' : 'REQUIRED FACTION'}
                    </label>
                    <input 
                      type="text" 
                      value={wizardFaction} 
                      onChange={e => setWizardFaction(e.target.value)}
                      placeholder="e.g. InvincibleObservers" 
                    />
                  </div>

                  {/* Reputation */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {lang === 'ru' ? 'МИН. РЕПУТАЦИЯ' : 'MIN REQUIRED REP'}
                      </label>
                      <input 
                        type="number" 
                        value={wizardMinRep} 
                        onChange={e => setWizardMinRep(Number(e.target.value))} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {lang === 'ru' ? 'МАКС. РЕПУТАЦИЯ' : 'MAX REQUIRED REP'}
                      </label>
                      <input 
                        type="number" 
                        value={wizardMaxRep} 
                        onChange={e => setWizardMaxRep(Number(e.target.value))} 
                      />
                    </div>
                  </div>

                  {/* Quest Req */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'НЕОБХОДИМЫЙ ПРОЙДЕННЫЙ КВЕСТ' : 'COMPLETED QUEST REQUIREMENT'}
                    </label>
                    <select 
                      value={wizardQuestId} 
                      onChange={e => setWizardQuestId(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-glow)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value={-1}>{t('trader_quest_none')}</option>
                      {questsList.map(q => (
                        <option key={q.id} value={q.id}>ID {q.id}: {q.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* ── STEP 4: World Placement & SafeZone ───────────────────────── */}
              {wizardStep === 4 && (() => {
                // Calculate 3D sphere distance to active zone if any
                let activeZonePos = null;
                let activeZoneRadius = 50.0;
                let activeZoneTitle = '';

                if (wizardZoneMode === 'existing' && wizardSelectedZonePath && configs[wizardSelectedZonePath]?.content) {
                  const zc = configs[wizardSelectedZonePath].content;
                  if (Array.isArray(zc.Position)) activeZonePos = zc.Position;
                  activeZoneRadius = Number(zc.Radius) || 50.0;
                  activeZoneTitle = zc.m_DisplayName || wizardSelectedZonePath.split('/').pop();
                } else if (wizardZoneMode === 'new') {
                  activeZonePos = wizardNpcCoords;
                  activeZoneRadius = Number(wizardSafezoneRadius) || 50.0;
                  activeZoneTitle = wizardNewZoneDisplayName || wizardNewZoneName || wizardDisplayName || 'New Zone';
                }

                let distToZone = null;
                let isInsideSphere = true;
                if (activeZonePos && activeZonePos.length === 3 && wizardNpcCoords && wizardNpcCoords.length === 3) {
                  const dx = wizardNpcCoords[0] - activeZonePos[0];
                  const dy = wizardNpcCoords[1] - activeZonePos[1];
                  const dz = wizardNpcCoords[2] - activeZonePos[2];
                  distToZone = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  isInsideSphere = distToZone <= activeZoneRadius;
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Spawn Coordinates */}
                    <div style={{ background: 'var(--bg-primary)', padding: '14px', border: '1px solid var(--border-color)', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                          📍 {lang === 'ru' ? 'КООРДИНАТЫ СПАВНА NPC В МИРЕ' : 'NPC WORLD SPAWN COORDINATES'}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {activeZonePos && (
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setWizardNpcCoords([...activeZonePos])}
                              style={{ padding: '3px 8px', fontSize: '10px' }}
                              title={lang === 'ru' ? 'Установить координаты центра выбранной зоны' : 'Copy center coordinates from selected zone'}
                            >
                              🎯 {lang === 'ru' ? 'В центр зоны' : 'Snap to Zone'}
                            </button>
                          )}
                          {onNavigateToMap && (
                            <button
                              type="button"
                              className="btn btn-accent"
                              onClick={() => onNavigateToMap(wizardNpcCoords)}
                              style={{ padding: '3px 8px', fontSize: '10px' }}
                            >
                              🗺️ {lang === 'ru' ? 'Показать на карте' : 'Show on Map'}
                            </button>
                          )}
                        </div>
                      </div>
                      <CoordinatesInput
                        value={wizardNpcCoords}
                        onChange={setWizardNpcCoords}
                      />
                    </div>

                    {/* TraderZone Connection Mode */}
                    <div style={{ background: 'var(--bg-primary)', padding: '14px', border: '1px solid var(--border-color)', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                          🛡️ {lang === 'ru' ? 'ПРИВЯЗКА К ТОРГОВОЙ ЗОНЕ (TRADERZONE)' : 'TRADERZONE ATTACHMENT'}
                        </span>
                        <HelpIcon tipKey="tip_econ_sell_zone_pct" />
                      </div>

                      {/* Mode selection radio group */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setWizardZoneMode('existing')}
                          style={{
                            padding: '8px 10px',
                            background: wizardZoneMode === 'existing' ? 'rgba(149,192,149,0.15)' : 'var(--bg-secondary)',
                            border: wizardZoneMode === 'existing' ? '1px solid var(--accent-glow)' : '1px solid var(--border-color)',
                            borderRadius: '3px',
                            color: wizardZoneMode === 'existing' ? 'var(--text-glow)' : 'var(--text-secondary)',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          🔗 {lang === 'ru' ? 'Существующая зона' : 'Existing Zone'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWizardZoneMode('new');
                            if (!wizardNewZoneName) setWizardNewZoneName(`${wizardFilename}_zone`);
                            if (!wizardNewZoneDisplayName) setWizardNewZoneDisplayName(`${wizardDisplayName} SafeZone`);
                          }}
                          style={{
                            padding: '8px 10px',
                            background: wizardZoneMode === 'new' ? 'rgba(149,192,149,0.15)' : 'var(--bg-secondary)',
                            border: wizardZoneMode === 'new' ? '1px solid var(--accent-glow)' : '1px solid var(--border-color)',
                            borderRadius: '3px',
                            color: wizardZoneMode === 'new' ? 'var(--text-glow)' : 'var(--text-secondary)',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          ➕ {lang === 'ru' ? 'Создать новую зону' : 'Create New Zone'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWizardZoneMode('none')}
                          style={{
                            padding: '8px 10px',
                            background: wizardZoneMode === 'none' ? 'rgba(149,192,149,0.15)' : 'var(--bg-secondary)',
                            border: wizardZoneMode === 'none' ? '1px solid var(--accent-glow)' : '1px solid var(--border-color)',
                            borderRadius: '3px',
                            color: wizardZoneMode === 'none' ? 'var(--text-glow)' : 'var(--text-secondary)',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          🚫 {lang === 'ru' ? 'Без зоны (Ручная)' : 'No Zone (Manual)'}
                        </button>
                      </div>

                      {/* Mode: Existing Zone */}
                      {wizardZoneMode === 'existing' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {lang === 'ru' ? 'Выберите торговую зону для привязки:' : 'Select trader zone:'}
                          </label>
                          {safezonePaths.length === 0 ? (
                            <div style={{ fontSize: '11px', color: '#ff6b6b' }}>
                              ⚠️ {lang === 'ru' ? 'В проекте нет файлов traderzones/*.json. Выберите "Создать новую зону".' : 'No traderzones/*.json files found. Please choose "Create New Zone".'}
                            </div>
                          ) : (
                            <select
                              value={wizardSelectedZonePath}
                              onChange={e => setWizardSelectedZonePath(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: 'var(--text-glow)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '12px'
                              }}
                            >
                              {safezonePaths.map(p => {
                                const cfg = configs[p]?.content || {};
                                const dName = cfg.m_DisplayName || p.split('/').pop();
                                const r = cfg.Radius || '?';
                                return (
                                  <option key={p} value={p}>
                                    {dName} ({p.split('/').pop()}) — R: {r}m
                                  </option>
                                );
                              })}
                            </select>
                          )}
                        </div>
                      )}

                      {/* Mode: New Zone */}
                      {wizardZoneMode === 'new' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                {lang === 'ru' ? 'ИМЯ ФАЙЛА ЗОНЫ' : 'ZONE FILENAME'} *
                              </label>
                              <input
                                type="text"
                                value={wizardNewZoneName}
                                onChange={e => setWizardNewZoneName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                placeholder="e.g. green_mountain_zone"
                                style={{ background: 'var(--bg-secondary)' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                {lang === 'ru' ? 'ОТОБРАЖАЕМОЕ ИМЯ ЗОНЫ' : 'DISPLAY NAME'}
                              </label>
                              <input
                                type="text"
                                value={wizardNewZoneDisplayName}
                                onChange={e => setWizardNewZoneDisplayName(e.target.value)}
                                placeholder="e.g. Green Mountain SafeZone"
                                style={{ background: 'var(--bg-secondary)' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                {lang === 'ru' ? 'РАДИУС ЗОНЫ (M)' : 'RADIUS (M)'}
                              </label>
                              <input
                                type="number"
                                value={wizardSafezoneRadius}
                                onChange={e => setWizardSafezoneRadius(Number(e.target.value))}
                                style={{ background: 'var(--bg-secondary)' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                {lang === 'ru' ? 'BUY PRICE %' : 'BUY PRICE %'}
                              </label>
                              <input
                                type="number"
                                value={wizardNewZoneBuyPricePct}
                                onChange={e => setWizardNewZoneBuyPricePct(Number(e.target.value))}
                                style={{ background: 'var(--bg-secondary)' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                {lang === 'ru' ? 'SELL PRICE %' : 'SELL PRICE %'}
                              </label>
                              <input
                                type="number"
                                value={wizardNewZoneSellPricePct}
                                onChange={e => setWizardNewZoneSellPricePct(Number(e.target.value))}
                                style={{ background: 'var(--bg-secondary)' }}
                              />
                            </div>
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-dark)', fontFamily: 'var(--font-mono)' }}>
                            // traderzones/{wizardNewZoneName || wizardFilename}_zone.json
                          </span>
                        </div>
                      )}

                      {/* 3D Sphere Distance Validation Badge */}
                      {activeZonePos && distToZone !== null && (
                        <div style={{
                          padding: '8px 12px',
                          borderRadius: '3px',
                          border: isInsideSphere ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(239,68,68,0.4)',
                          background: isInsideSphere ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          <span style={{ fontSize: '16px' }}>{isInsideSphere ? '🟢' : '🔴'}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: isInsideSphere ? '#4ade80' : '#ef4444', fontWeight: 'bold' }}>
                              {isInsideSphere 
                                ? (lang === 'ru' ? `NPC внутри зоны «${activeZoneTitle}»` : `NPC is inside zone "${activeZoneTitle}"`)
                                : (lang === 'ru' ? `ВНИМАНИЕ: NPC вне радиуса зоны «${activeZoneTitle}»!` : `WARNING: NPC is outside zone "${activeZoneTitle}" radius!`)}
                            </span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                              {lang === 'ru' 
                                ? `3D-Дистанция до центра: ${distToZone.toFixed(1)}м (Радиус зоны: ${activeZoneRadius}м)` 
                                : `3D Distance to center: ${distToZone.toFixed(1)}m (Zone radius: ${activeZoneRadius}m)`}
                              {!isInsideSphere && (lang === 'ru' ? ' — Торговец НЕ будет открываться по клавише F!' : ' — Trader will NOT open on F press!')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* NPC 3D Object Spawner Generator */}
                    <div style={{ background: 'var(--bg-primary)', padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: '3px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                        <input
                          type="checkbox"
                          checked={wizardExportNpcObject}
                          onChange={e => setWizardExportNpcObject(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>📦 {lang === 'ru' ? 'Создать файл спавна 3D-модели (expansion/objects/<name>_npc.json)' : 'Create 3D NPC spawn file (expansion/objects/<name>_npc.json)'}</span>
                      </label>
                    </div>

                    {/* Summary Card */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '14px', border: '1px solid var(--border-glow)', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ color: 'var(--text-glow)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px' }}>
                        📋 {lang === 'ru' ? 'СВОДКА СОЗДАВАЕМОЙ КОНФИГУРАЦИИ:' : 'CREATION SUMMARY:'}
                      </div>
                      <div>• <strong>{lang === 'ru' ? 'Торговец:' : 'Trader:'}</strong> {wizardDisplayName} ({wizardFilename}.json)</div>
                      <div>• <strong>{lang === 'ru' ? '3D-Модель NPC:' : 'NPC Model:'}</strong> {wizardNpcModel === 'Custom' ? (wizardCustomNpcModel || 'Custom') : wizardNpcModel}</div>
                      <div>• <strong>{lang === 'ru' ? 'Категорий:' : 'Categories:'}</strong> {wizardSelectedCats.size} {lang === 'ru' ? 'шт.' : 'items'}</div>
                      <div>• <strong>{lang === 'ru' ? 'Валюта:' : 'Currency:'}</strong> {wizardCurrency}</div>
                      <div>• <strong>{lang === 'ru' ? 'Торговая Зона:' : 'TraderZone:'}</strong> {
                        wizardZoneMode === 'existing' 
                          ? (configs[wizardSelectedZonePath]?.content?.m_DisplayName || wizardSelectedZonePath.split('/').pop() || 'Existing')
                          : wizardZoneMode === 'new'
                          ? `New (${wizardNewZoneDisplayName || wizardNewZoneName || wizardFilename}, R: ${wizardSafezoneRadius}m)`
                          : (lang === 'ru' ? 'Без зоны' : 'Disabled')
                      }</div>
                      <div>• <strong>{lang === 'ru' ? 'Спавн 3D объекта:' : 'Object Spawner:'}</strong> {wizardExportNpcObject ? 'Да (expansion/objects/)' : 'Нет'}</div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              background: 'var(--bg-tertiary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px',
            }}>
              <div>
                {wizardStep > 1 && (
                  <button 
                    className="btn" 
                    onClick={() => setWizardStep(prev => prev - 1)} 
                    style={{ padding: '8px 16px' }}
                  >
                    ← {lang === 'ru' ? 'Назад' : 'Back'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="btn" 
                  onClick={() => setShowTraderWizard(false)} 
                  style={{ padding: '8px 16px' }}
                >
                  {t('modal_confirm_cancel')}
                </button>
                {wizardStep < 4 ? (
                  <button 
                    className="btn btn-accent" 
                    onClick={() => setWizardStep(prev => prev + 1)}
                    style={{ padding: '8px 20px', fontWeight: 'bold' }}
                    disabled={
                      wizardStep === 1 && (
                        !wizardFilename.trim() || 
                        !wizardDisplayName.trim() || 
                        traderPaths.some(p => p.split('/').pop().toLowerCase() === `${wizardFilename.toLowerCase()}.json`)
                      )
                    }
                  >
                    {lang === 'ru' ? 'Далее →' : 'Next →'}
                  </button>
                ) : (
                  <button 
                    className="btn btn-accent" 
                    onClick={() => {
                      if (!wizardFilename.trim() || !wizardDisplayName.trim()) {
                        toast.error(lang === 'ru' ? 'Имя файла и отображаемое имя обязательны!' : 'Filename and Display Name are required!');
                        return;
                      }

                      const prefix = getExpansionModPrefix(configs);
                      const cleanTraderName = wizardFilename.toLowerCase().trim();
                      const finalFilename = `${prefix}Traders/${cleanTraderName}.json`;
                      const newTraderConfig = {
                        m_Version: 13,
                        DisplayName: wizardDisplayName,
                        MinRequiredReputation: Number(wizardMinRep),
                        MaxRequiredReputation: Number(wizardMaxRep),
                        RequiredFaction: wizardFaction,
                        RequiredCompletedQuestID: Number(wizardQuestId),
                        TraderIcon: wizardIcon === 'Custom' ? wizardCustomIcon : wizardIcon,
                        Currencies: wizardCurrency.trim() ? [wizardCurrency.trim().toLowerCase()] : [],
                        DisplayCurrencyValue: 1,
                        DisplayCurrencyName: "",
                        UseCategoryOrder: 0,
                        Categories: Array.from(wizardSelectedCats).map(cat => 
                          wizardDefaultMode === 3 ? cat : `${cat}:${wizardDefaultMode}`
                        ),
                        Items: {}
                      };

                      onCreateFile(finalFilename, newTraderConfig);

                      const expPrefix = getExpansionPrefix(configs);
                      
                      // 1. Zone handling
                      if (wizardZoneMode === 'new') {
                        const zName = (wizardNewZoneName.trim() || `${cleanTraderName}_zone`).toLowerCase();
                        const safezoneFileName = `${expPrefix}traderzones/${zName}.json`;
                        const newZoneContent = {
                          m_Version: 6,
                          m_DisplayName: wizardNewZoneDisplayName.trim() || `${wizardDisplayName} SafeZone`,
                          Position: [...wizardNpcCoords],
                          Radius: Number(wizardSafezoneRadius) || 100.0,
                          BuyPricePercent: Number(wizardNewZoneBuyPricePct) || 100.0,
                          SellPricePercent: Number(wizardNewZoneSellPricePct) || -1.0,
                          Stock: {}
                        };
                        onCreateFile(safezoneFileName, newZoneContent);
                        setSelectedSafezonePath(safezoneFileName);
                      } else if (wizardZoneMode === 'existing' && wizardSelectedZonePath) {
                        setSelectedSafezonePath(wizardSelectedZonePath);
                      }

                      // 2. NPC 3D Model Object Spawner creation
                      const chosenModel = wizardNpcModel === 'Custom' ? (wizardCustomNpcModel || 'ExpansionTraderSurvivorM') : wizardNpcModel;
                      if (wizardExportNpcObject) {
                        const objectFileName = `${expPrefix}objects/${cleanTraderName}_npc.json`;
                        const objectContent = {
                          Objects: [
                            {
                              name: chosenModel,
                              pos: [...wizardNpcCoords],
                              ypr: [0.0, 0.0, 0.0]
                            }
                          ]
                        };
                        onCreateFile(objectFileName, objectContent);
                      }

                      setNpcModel(chosenModel);
                      setNpcCoords([...wizardNpcCoords]);
                      setSelectedTraderPath(finalFilename);
                      setSubTab('traders');
                      setShowTraderWizard(false);
                      toast.success(lang === 'ru' ? `Торговец ${wizardDisplayName} успешно создан!` : `Trader ${wizardDisplayName} successfully created!`);
                    }}
                    style={{ padding: '8px 20px', fontWeight: 'bold' }}
                  >
                    {lang === 'ru' ? '✓ СОЗДАТЬ ТОРГОВЦА' : '✓ CREATE TRADER'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ Smart Attachments Assistant Modal */}
      {smartAttachmentsModal && (() => {
        const { weaponName, detected, selected, maxPrice, minPrice, maxStock, minStock, sellPct, infiniteStock, staticPrice } = smartAttachmentsModal;
        const currentItems = activeCategoryConfig?.content?.Items || [];
        const currentSet = new Set(currentItems.map(i => i.ClassName?.toLowerCase()));

        const isSpawnMode = smartAttachmentsModal.targetMode === 'spawn_attachments';
        const allCategories = [
          { key: 'magazines', label: lang === 'ru' ? 'Магазины' : 'Magazines', icon: Icon.Boxes },
          { key: 'ammo', label: lang === 'ru' ? 'Боеприпасы (Патроны)' : 'Ammunition', icon: Icon.Boxes, isAmmo: true },
          { key: 'optics', label: lang === 'ru' ? 'Оптика и прицелы' : 'Optics & Sights', icon: Icon.Crosshair },
          { key: 'muzzle', label: lang === 'ru' ? 'Глушители и дульные насадки' : 'Muzzle & Suppressors', icon: Icon.Shield },
          { key: 'buttstock', label: lang === 'ru' ? 'Приклады' : 'Buttstocks', icon: Icon.Wrench },
          { key: 'handguard', label: lang === 'ru' ? 'Цевья' : 'Handguards', icon: Icon.Wrench },
          { key: 'tactical', label: lang === 'ru' ? 'Тактические модули' : 'Tactical Modules', icon: Icon.Zap },
        ];

        // In spawn mode, exclude ammo (only physical attachments fit on weapon)
        const slotCategories = allCategories
          .filter(sc => (!isSpawnMode || !sc.isAmmo))
          .filter(sc => Array.isArray(detected[sc.key]) && detected[sc.key].length > 0);

        const toggleItem = (cls, slotKey) => {
          const next = new Set(selected);
          if (isSpawnMode) {
            // Radio behavior: if already selected -> unselect; if not -> select and unselect others in this slot
            if (next.has(cls)) {
              next.delete(cls);
            } else {
              const slotItems = detected[slotKey] || [];
              slotItems.forEach(si => next.delete(si));
              next.add(cls);
            }
          } else {
            // Checkbox behavior for category mode
            if (next.has(cls)) next.delete(cls);
            else next.add(cls);
          }
          setSmartAttachmentsModal(prev => ({ ...prev, selected: next }));
        };

        const toggleSlotAll = (slotKey) => {
          const items = detected[slotKey] || [];
          const next = new Set(selected);
          if (isSpawnMode) {
            // In spawn mode, "Select default" picks the first one, or clears if one is already selected
            const hasAny = items.some(i => next.has(i));
            items.forEach(i => next.delete(i));
            if (!hasAny && items.length > 0) {
              next.add(items[0]);
            }
          } else {
            const allSelected = items.every(i => next.has(i));
            if (allSelected) {
              items.forEach(i => next.delete(i));
            } else {
              items.forEach(i => next.add(i));
            }
          }
          setSmartAttachmentsModal(prev => ({ ...prev, selected: next }));
        };

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 99997,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(3px)',
          }}>
            <div style={{
              width: '740px',
              maxWidth: '94vw',
              maxHeight: '90vh',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glow)',
              borderRadius: '4px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.85)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    // SMART COMPATIBILITY ENGINE
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-glow)', fontWeight: 'bold', fontFamily: 'var(--font-heading)', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon.Zap size={16} color="#a6f5a6" />
                    <span>{lang === 'ru' ? `СОВМЕСТИМЫЕ ОБВЕСЫ ДЛЯ: ${weaponName}` : `COMPATIBLE ATTACHMENTS: ${weaponName}`}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (window.confirm(lang === 'ru' ? `Сбросить все кастомные изменения обвесов для ${weaponName} к стандарту?` : `Reset all custom attachments for ${weaponName} to defaults?`)) {
                        resetCustomAttachmentsForWeapon(weaponName);
                        const fresh = detectCompatibleAttachments(weaponName, xmlItemsSet);
                        if (fresh) {
                          setSmartAttachmentsModal(prev => ({ ...prev, detected: fresh }));
                          toast.success(lang === 'ru' ? 'Настройки обвесов сброшены к стандарту' : 'Attachments reset to defaults');
                        }
                      }
                    }}
                    style={{ padding: '3px 8px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title={lang === 'ru' ? 'Сбросить добавленные и удаленные обвесы к стандарту' : 'Reset custom overrides to defaults'}
                  >
                    <Icon.Refresh size={10} />
                    <span>{lang === 'ru' ? 'Сброс' : 'Reset'}</span>
                  </button>
                  <button onClick={() => setSmartAttachmentsModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>×</button>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                {/* 🎯 Mode Selector */}
                <div style={{ background: 'var(--bg-primary)', padding: '4px', borderRadius: '3px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSmartAttachmentsModal(prev => ({ ...prev, targetMode: 'category' }))}
                    style={{
                      padding: '7px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 'bold',
                      justifyContent: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      background: smartAttachmentsModal.targetMode === 'category' ? 'rgba(166,245,166,0.12)' : 'transparent',
                      borderColor: smartAttachmentsModal.targetMode === 'category' ? '#a6f5a6' : 'transparent',
                      color: smartAttachmentsModal.targetMode === 'category' ? '#a6f5a6' : 'var(--text-secondary)'
                    }}
                  >
                    <Icon.Boxes size={13} />
                    <span>{lang === 'ru' ? 'В категорию (товары)' : 'To Category (Trade items)'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSmartAttachmentsModal(prev => {
                      // Sanitize selection: keep at most 1 item per slot and strip ammo
                      const newSelected = new Set();
                      const slots = ['magazines', 'optics', 'muzzle', 'buttstock', 'handguard', 'tactical'];
                      slots.forEach(k => {
                        const items = prev.detected[k] || [];
                        const picked = items.find(i => prev.selected.has(i));
                        if (picked) newSelected.add(picked);
                      });
                      return { ...prev, targetMode: 'spawn_attachments', selected: newSelected };
                    })}
                    style={{
                      padding: '7px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 'bold',
                      justifyContent: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      background: smartAttachmentsModal.targetMode === 'spawn_attachments' ? 'rgba(130,180,245,0.12)' : 'transparent',
                      borderColor: smartAttachmentsModal.targetMode === 'spawn_attachments' ? '#82b4f5' : 'transparent',
                      color: smartAttachmentsModal.targetMode === 'spawn_attachments' ? '#82b4f5' : 'var(--text-secondary)'
                    }}
                  >
                    <Icon.Wrench size={13} />
                    <span>{lang === 'ru' ? 'На оружие (в сборе)' : 'On Weapon (SpawnAttachments)'}</span>
                  </button>
                </div>
                
                {/* Slots Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {slotCategories.map(sc => {
                    const items = detected[sc.key] || [];
                    const selectedCount = items.filter(i => selected.has(i)).length;
                    const IconComp = sc.icon;

                    const isAddingThisSlot = activeAddSlotKey === sc.key;

                    const handleAddCustom = (slotKey) => {
                      if (!customAttachmentInput.trim()) return;
                      const cleanCls = customAttachmentInput.trim();
                      addCustomAttachmentToWeapon(weaponName, slotKey, cleanCls);
                      
                      // Refresh detected & auto-select
                      const nextDet = { ...detected };
                      if (!nextDet[slotKey]) nextDet[slotKey] = [];
                      if (!nextDet[slotKey].some(x => x.toLowerCase() === cleanCls.toLowerCase())) {
                        nextDet[slotKey] = [...nextDet[slotKey], cleanCls];
                      }
                      
                      const nextSel = new Set(selected);
                      if (isSpawnMode) {
                        (detected[slotKey] || []).forEach(si => nextSel.delete(si));
                      }
                      nextSel.add(cleanCls);

                      setSmartAttachmentsModal(prev => ({ ...prev, detected: nextDet, selected: nextSel }));
                      setCustomAttachmentInput('');
                      setActiveAddSlotKey(null);
                      toast.success(lang === 'ru' ? `Добавлен кастомный обвес: ${cleanCls}` : `Added custom attachment: ${cleanCls}`);
                    };

                    const handleRemoveAttachmentRule = (slotKey, clsToRemove) => {
                      removeCustomAttachmentFromWeapon(weaponName, slotKey, clsToRemove);
                      
                      // Update detected & selected in state
                      const nextDet = { ...detected };
                      if (nextDet[slotKey]) {
                        nextDet[slotKey] = nextDet[slotKey].filter(x => x.toLowerCase() !== clsToRemove.toLowerCase());
                      }
                      const nextSel = new Set(selected);
                      nextSel.delete(clsToRemove);

                      setSmartAttachmentsModal(prev => ({ ...prev, detected: nextDet, selected: nextSel }));
                      toast.info(lang === 'ru' ? `Обвес ${clsToRemove} удален из списка совместимых` : `Removed ${clsToRemove} from compatibility list`);
                    };

                    return (
                      <div key={sc.key} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <IconComp size={12} />
                            <span>{sc.label} ({items.length})</span>
                            {isSpawnMode && (
                              <span style={{ fontSize: '9px', color: '#82b4f5', fontWeight: 'normal', fontFamily: 'var(--font-mono)' }}>
                                [{lang === 'ru' ? '1 на слот' : '1 per slot'}]
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => {
                                if (isAddingThisSlot) {
                                  setActiveAddSlotKey(null);
                                } else {
                                  setActiveAddSlotKey(sc.key);
                                  setCustomAttachmentInput('');
                                }
                              }}
                              style={{ padding: '2px 8px', fontSize: '9px', display: 'inline-flex', alignItems: 'center', gap: '3px', background: isAddingThisSlot ? 'rgba(255,255,255,0.15)' : 'transparent' }}
                              title={lang === 'ru' ? 'Добавить кастомный обвес в этот слот' : 'Add custom attachment to this slot'}
                            >
                              <Icon.Plus size={9} />
                              <span>{isAddingThisSlot ? (lang === 'ru' ? 'Закрыть' : 'Close') : (lang === 'ru' ? '+ Свой' : '+ Custom')}</span>
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => toggleSlotAll(sc.key)}
                              style={{ padding: '2px 8px', fontSize: '9px' }}
                            >
                              {isSpawnMode
                                ? (selectedCount > 0 ? (lang === 'ru' ? 'Снять' : 'Clear') : (lang === 'ru' ? 'Выбрать' : 'Pick'))
                                : (selectedCount === items.length ? (lang === 'ru' ? 'Снять все' : 'Deselect all') : (lang === 'ru' ? 'Выбрать все' : 'Select all'))}
                            </button>
                          </div>
                        </div>

                        {isAddingThisSlot && (
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', background: 'var(--bg-secondary)', padding: '6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <input
                              type="text"
                              value={customAttachmentInput}
                              onChange={e => setCustomAttachmentInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustom(sc.key);
                                }
                              }}
                              placeholder={lang === 'ru' ? 'Класснейм обвеса (например, Mod_Optic_Red)...' : 'Attachment classname...'}
                              style={{ flex: 1, padding: '4px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '2px', color: 'var(--text-glow)' }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="btn btn-accent"
                              onClick={() => handleAddCustom(sc.key)}
                              style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 'bold' }}
                            >
                              {lang === 'ru' ? 'ДОБАВИТЬ' : 'ADD'}
                            </button>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {items.map(cls => {
                            const isSelected = selected.has(cls);
                            const isAlreadyInCategory = currentSet.has(cls.toLowerCase());
                            const isInXml = xmlItemsSet.size === 0 || xmlItemsSet.has(cls.toLowerCase());

                            return (
                              <label
                                key={cls}
                                title={isAlreadyInCategory ? (lang === 'ru' ? 'Уже есть в категории' : 'Already in category') : ''}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 8px',
                                  background: isSelected ? 'rgba(166,245,166,0.12)' : 'rgba(255,255,255,0.03)',
                                  border: isSelected ? '1px solid #a6f5a6' : '1px solid var(--border-color)',
                                  borderRadius: '2px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontFamily: 'var(--font-mono)',
                                  color: isSelected ? 'var(--text-glow)' : 'var(--text-secondary)',
                                  userSelect: 'none',
                                  transition: 'all 0.1s'
                                }}
                              >
                                <input
                                  type={isSpawnMode ? "radio" : "checkbox"}
                                  name={isSpawnMode ? `slot_${sc.key}` : undefined}
                                  checked={isSelected}
                                  onClick={() => isSpawnMode && isSelected && toggleItem(cls, sc.key)}
                                  onChange={() => toggleItem(cls, sc.key)}
                                  style={{ accentColor: isSpawnMode ? '#82b4f5' : 'var(--accent-glow)', cursor: 'pointer' }}
                                />
                                <span>{cls}</span>
                                {isAlreadyInCategory && (
                                  <span style={{ fontSize: '9px', color: '#fbbf24' }}>({lang === 'ru' ? 'в категории' : 'in cat'})</span>
                                )}
                                {!isInXml && (
                                  <span style={{ fontSize: '9px', color: '#f87171' }} title={lang === 'ru' ? 'Нет в базе types.xml' : 'Not in types.xml'}>⚠️</span>
                                )}
                                <span
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveAttachmentRule(sc.key, cls);
                                  }}
                                  title={lang === 'ru' ? 'Удалить этот обвес из списка совместимости' : 'Remove from compatibility list'}
                                  style={{
                                    marginLeft: '2px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    opacity: 0.6,
                                    padding: '0 2px',
                                    lineHeight: 1,
                                    color: 'var(--text-secondary)'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ff6b6b'; }}
                                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                >
                                  ×
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pricing & Stock Settings (Only for category items mode) */}
                {smartAttachmentsModal.targetMode === 'category' && (
                  
                <div style={{ background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: '3px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-glow)', fontWeight: 'bold', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon.Settings size={12} />
                    <span>{lang === 'ru' ? 'НАСТРОЙКИ ЦЕН И СТОКА ДЛЯ ДОБАВЛЯЕМЫХ ОБВЕСОВ:' : 'PRICING & STOCK DEFAULTS:'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>MAX BUY PRICE</label>
                      <input
                        type="number"
                        value={maxPrice}
                        onChange={e => setSmartAttachmentsModal(prev => ({ ...prev, maxPrice: Number(e.target.value) }))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>MIN BUY PRICE</label>
                      <input
                        type="number"
                        disabled={staticPrice}
                        value={staticPrice ? maxPrice : minPrice}
                        onChange={e => setSmartAttachmentsModal(prev => ({ ...prev, minPrice: Number(e.target.value) }))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px', opacity: staticPrice ? 0.6 : 1 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>SELL % (-1 = Zone)</label>
                      <input
                        type="number"
                        value={sellPct}
                        onChange={e => setSmartAttachmentsModal(prev => ({ ...prev, sellPct: Number(e.target.value) }))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>MAX STOCK</label>
                      <input
                        type="number"
                        disabled={infiniteStock}
                        value={infiniteStock ? 1 : maxStock}
                        onChange={e => setSmartAttachmentsModal(prev => ({ ...prev, maxStock: Number(e.target.value) }))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px', opacity: infiniteStock ? 0.6 : 1 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>MIN STOCK</label>
                      <input
                        type="number"
                        disabled={infiniteStock}
                        value={infiniteStock ? 1 : minStock}
                        onChange={e => setSmartAttachmentsModal(prev => ({ ...prev, minStock: Number(e.target.value) }))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px', opacity: infiniteStock ? 0.6 : 1 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '2px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={infiniteStock}
                        onChange={e => setSmartAttachmentsModal(prev => ({ ...prev, infiniteStock: e.target.checked }))}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-glow)' }}
                      />
                      <span>{lang === 'ru' ? 'Бесконечный запас (Stock = 1)' : 'Infinite stock (Stock = 1)'}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={staticPrice}
                        onChange={e => setSmartAttachmentsModal(prev => ({ ...prev, staticPrice: e.target.checked }))}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-glow)' }}
                      />
                      <span>{lang === 'ru' ? 'Статичная цена (Min = Max)' : 'Static price (Min = Max)'}</span>
                    </label>
                  </div>
                </div>
                )}

              </div>

              {/* Footer */}
              <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn" onClick={() => setSmartAttachmentsModal(null)} style={{ padding: '8px 16px' }}>
                  {lang === 'ru' ? 'ОТМЕНА' : 'CANCEL'}
                </button>
                <button
                  className="btn btn-accent"
                  disabled={selected.size === 0}
                  onClick={handleExecuteAddSmartAttachments}
                  style={{ padding: '8px 20px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon.Plus size={12} />
                  <span>{smartAttachmentsModal.targetMode === 'spawn_attachments' 
                    ? (lang === 'ru' ? `УСТАНОВИТЬ НА ОРУЖИЕ (${selected.size} шт.)` : `ATTACH ONTO WEAPON (${selected.size} items)`)
                    : (lang === 'ru' ? `ДОБАВИТЬ В КАТЕГОРИЮ (${selected.size} шт.)` : `ADD TO CATEGORY (${selected.size} items)`)}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 📋 Bulk Paste by Classnames Modal */}
      {showBulkPasteModal && (() => {
        const parsedItems = parseClassnamesFromText(bulkPasteText);
        const currentItems = activeCategoryConfig?.content?.Items || [];
        const currentSet = new Set(currentItems.map(i => i.ClassName?.toLowerCase()));
        const duplicates = parsedItems.filter(cls => currentSet.has(cls.toLowerCase()));
        const newItems = parsedItems.filter(cls => !currentSet.has(cls.toLowerCase()));
        const newItemsCount = newItems.length;

        // Verify against loaded types.xml database
        const xmlValidItems = newItems.filter(cls => xmlItemsSet.size === 0 || xmlItemsSet.has(cls.toLowerCase()));
        const xmlMissingItems = newItems.filter(cls => xmlItemsSet.size > 0 && !xmlItemsSet.has(cls.toLowerCase()));

        const handleRemoveClassnameFromPreview = (clsToRemove) => {
          const regex = new RegExp(`\\b${clsToRemove}\\b`, 'gi');
          setBulkPasteText(prev => prev.replace(regex, '').replace(/^[\r\n,;\s]+|[\r\n,;\s]+$/g, ''));
        };

        const handleFileUpload = (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target.result;
            if (content) {
              setBulkPasteText(prev => prev ? prev + '\n' + content : content);
            }
          };
          reader.readAsText(file);
        };

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 99996,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(3px)',
          }}>
            <div style={{
              width: '680px',
              maxWidth: '92vw',
              maxHeight: '90vh',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glow)',
              borderRadius: '4px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    // {selectedCategoryPath ? selectedCategoryPath.split('/').pop() : 'Category'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-glow)', fontWeight: 'bold', fontFamily: 'var(--font-heading)', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon.Clipboard size={14} />
                    <span>{lang === 'ru' ? 'ПРЕДПРОСМОТР И ПАКЕТНАЯ ВСТАВКА ТОВАРОВ' : 'BULK PASTE & PREVIEW CLASSNAMES'}</span>
                  </div>
                </div>
                <button onClick={() => setShowBulkPasteModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>×</button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {lang === 'ru' ? 'Вставьте текст, класснеймы или выберите файл (.xml / .txt):' : 'Paste text, classnames or select file (.xml / .txt):'}
                    </label>
                    <label className="btn" style={{ padding: '3px 8px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <Icon.Import size={10} />
                      <span>{lang === 'ru' ? 'Выбрать файл' : 'Choose file'}</span>
                      <input type="file" accept=".xml,.txt,.json" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>
                  </div>
                  <textarea
                    rows={4}
                    value={bulkPasteText}
                    onChange={e => setBulkPasteText(e.target.value)}
                    placeholder={`M4A1\nAKM\nFAL\nor <type name="Mag_STANAG_30Rnd">\nor classname = SVD`}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '3px',
                      color: 'var(--text-glow)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                    autoFocus
                  />
                </div>

                {/* 👁️ Interactive Preview Area */}
                {parsedItems.length > 0 && (
                  <div style={{ background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: '3px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-glow)', fontWeight: 'bold', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon.Eye size={12} />
                        <span>{lang === 'ru' ? 'ПРЕДПРОСМОТР РАСПОЗНАННЫХ ТОВАРОВ:' : 'PARSED ITEMS PREVIEW:'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#4ade80' }}>
                          ✓ {lang === 'ru' ? `К добавлению: ${newItemsCount}` : `To add: ${newItemsCount}`}
                        </span>
                        {duplicates.length > 0 && (
                          <span style={{ color: '#fbbf24' }}>
                            ⚠ {lang === 'ru' ? `Дубликаты: ${duplicates.length}` : `Duplicates: ${duplicates.length}`}
                          </span>
                        )}
                        {xmlItemsSet.size > 0 && xmlMissingItems.length > 0 && (
                          <span style={{ color: '#f87171' }}>
                            ? {lang === 'ru' ? `Нет в types.xml: ${xmlMissingItems.length}` : `Not in types: ${xmlMissingItems.length}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chips container */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '130px', overflowY: 'auto', padding: '4px 0' }}>
                      {parsedItems.map(cls => {
                        const isDupe = currentSet.has(cls.toLowerCase());
                        const isInXml = xmlItemsSet.size === 0 || xmlItemsSet.has(cls.toLowerCase());
                        
                        let badgeBg = 'rgba(74, 222, 128, 0.12)';
                        let badgeBorder = '#4ade80';
                        let textColor = '#4ade80';

                        if (isDupe) {
                          badgeBg = 'rgba(251, 191, 36, 0.10)';
                          badgeBorder = '#fbbf24';
                          textColor = 'var(--text-secondary)';
                        } else if (!isInXml) {
                          badgeBg = 'rgba(248, 113, 113, 0.12)';
                          badgeBorder = '#f87171';
                          textColor = '#f87171';
                        }

                        return (
                          <span
                            key={cls}
                            title={isDupe ? (lang === 'ru' ? 'Уже есть в категории (будет пропущен)' : 'Already in category (will skip)') : (!isInXml ? (lang === 'ru' ? 'Внимание: предмет не найден в базе types.xml' : 'Warning: Not found in types.xml') : (lang === 'ru' ? 'Валидный предмет из types.xml' : 'Valid types.xml item'))}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              background: badgeBg,
                              border: `1px solid ${badgeBorder}`,
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                              color: textColor,
                              textDecoration: isDupe ? 'line-through' : 'none'
                            }}
                          >
                            <span>{cls}</span>
                            {isDupe && <span style={{ fontSize: '9px', opacity: 0.8 }}>({lang === 'ru' ? 'дубль' : 'dupe'})</span>}
                            {!isDupe && !isInXml && <span style={{ fontSize: '9px' }}>⚠️</span>}
                            <button
                              onClick={() => handleRemoveClassnameFromPreview(cls)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'currentColor',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '12px',
                                opacity: 0.7,
                                lineHeight: 1
                              }}
                              title={lang === 'ru' ? 'Удалить из списка' : 'Remove from list'}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pricing and stock defaults */}
                <div style={{ background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: '3px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-glow)', fontWeight: 'bold', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon.Settings size={12} />
                    <span>{lang === 'ru' ? 'ПАРАМЕТРЫ ДЛЯ ДОБАВЛЯЕМЫХ ПРЕДМЕТОВ:' : 'DEFAULTS FOR ADDED ITEMS:'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>MAX BUY PRICE</label>
                      <input
                        type="number"
                        value={bulkMaxPrice}
                        onChange={e => setBulkMaxPrice(Number(e.target.value))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>MIN BUY PRICE</label>
                      <input
                        type="number"
                        disabled={bulkStaticPrice}
                        value={bulkStaticPrice ? bulkMaxPrice : bulkMinPrice}
                        onChange={e => setBulkMinPrice(Number(e.target.value))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px', opacity: bulkStaticPrice ? 0.6 : 1 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>SELL % (-1 = Zone)</label>
                      <input
                        type="number"
                        value={bulkSellPct}
                        onChange={e => setBulkSellPct(Number(e.target.value))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>MAX STOCK</label>
                      <input
                        type="number"
                        disabled={bulkInfiniteStock}
                        value={bulkInfiniteStock ? 1 : bulkMaxStock}
                        onChange={e => setBulkMaxStock(Number(e.target.value))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px', opacity: bulkInfiniteStock ? 0.6 : 1 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>MIN STOCK</label>
                      <input
                        type="number"
                        disabled={bulkInfiniteStock}
                        value={bulkInfiniteStock ? 1 : bulkMinStock}
                        onChange={e => setBulkMinStock(Number(e.target.value))}
                        style={{ width: '100%', background: 'var(--bg-secondary)', padding: '6px 8px', fontSize: '11px', opacity: bulkInfiniteStock ? 0.6 : 1 }}
                      />
                    </div>
                  </div>

                  {/* Quick Toggles */}
                  <div style={{ display: 'flex', gap: '16px', marginTop: '2px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={bulkInfiniteStock}
                        onChange={e => setBulkInfiniteStock(e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-glow)' }}
                      />
                      <span>{lang === 'ru' ? 'Бесконечный запас (Stock = 1)' : 'Infinite stock (Stock = 1)'}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={bulkStaticPrice}
                        onChange={e => setBulkStaticPrice(e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-glow)' }}
                      />
                      <span>{lang === 'ru' ? 'Статичная цена (Min = Max)' : 'Static price (Min = Max)'}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  className="btn"
                  onClick={() => setShowBulkPasteModal(false)}
                  style={{ padding: '8px 16px' }}
                >
                  {lang === 'ru' ? 'ОТМЕНА' : 'CANCEL'}
                </button>
                <button
                  className="btn btn-accent"
                  disabled={newItemsCount === 0}
                  onClick={handleExecuteBulkPaste}
                  style={{ padding: '8px 20px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon.Check size={12} />
                  <span>{lang === 'ru' ? `ДОБАВИТЬ ${newItemsCount} ПРЕДМЕТОВ` : `ADD ${newItemsCount} ITEMS`}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 📦 Create Market Category Modal */}
      {showCreateCategoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 99996,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            width: '480px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glow)',
            borderRadius: '4px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-glow)', fontWeight: 'bold', letterSpacing: '1px' }}>
                📦 {t('econ_create_cat_title')}
              </div>
              <button onClick={() => setShowCreateCategoryModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  {t('econ_create_cat_filename')}
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="e.g. Ammo_HighCaliber"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-glow)', fontFamily: 'var(--font-mono)' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  {t('econ_create_cat_display')}
                </label>
                <input
                  type="text"
                  value={newCategoryDisplayName}
                  onChange={e => setNewCategoryDisplayName(e.target.value)}
                  placeholder="e.g. High Caliber Ammo or #STR_..."
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-glow)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  {t('econ_create_cat_init_stock')}
                </label>
                <input
                  type="number"
                  value={newCategoryInitStock}
                  onChange={e => setNewCategoryInitStock(Number(e.target.value))}
                  min={0}
                  max={100}
                  style={{ width: '100px', padding: '8px 10px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-glow)', textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn"
                onClick={() => setShowCreateCategoryModal(false)}
                style={{ padding: '6px 14px', fontSize: '11px' }}
              >
                {t('modal_cancel')}
              </button>
              <button
                className="btn btn-accent"
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                style={{ padding: '6px 18px', fontSize: '11px', fontWeight: 'bold' }}
              >
                ✓ {t('econ_create_cat_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖱️ Universal Tactical Context Menu */}
      {contextMenu && (
        <div
          className="rt-context-menu"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 99999,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glow)',
            borderRadius: '4px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.85)',
            padding: '4px 0',
            minWidth: '240px',
            fontFamily: 'var(--font-heading)',
            fontSize: '12px',
            letterSpacing: '0.4px',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'auto'
          }}
        >
          {/* Header info */}
          <div style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--text-glow)', letterSpacing: '0.8px', fontWeight: 'bold', fontFamily: 'var(--font-heading)', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
            {contextMenu.type === 'trader' ? '// TRADER ACTIONS' : contextMenu.type === 'category' ? '// CATEGORY ACTIONS' : '// ITEM ACTIONS'}
          </div>

          {/* Subheader detail */}
          {contextMenu.type === 'trader' && (
            <div style={{ padding: '6px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {contextMenu.data?.split('/').pop()}
            </div>
          )}
          {contextMenu.type === 'category' && (
            <div style={{ padding: '6px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {contextMenu.data?.split('/').pop()}
            </div>
          )}
          {contextMenu.type === 'item' && (
            <div style={{ padding: '6px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {contextMenu.data?.item?.ClassName}
            </div>
          )}

          {/* TRADER CONTEXT MENU */}
          {contextMenu.type === 'trader' && (() => {
            const tPath = contextMenu.data;
            const tCfg = configs[tPath]?.content || {};
            const tName = tCfg.DisplayName || tPath.split('/').pop().replace('.json', '');
            return (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button
                  onClick={() => handleStartCloneTrader(tPath)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Clipboard size={12} />
                  <span>{lang === 'ru' ? 'Дублировать торговца' : 'Duplicate Trader'}</span>
                </button>
                {onNavigateToMap && (
                  <button
                    onClick={() => {
                      if (npcCoords) onNavigateToMap(npcCoords);
                      setContextMenu(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Icon.Map size={12} />
                    <span>{lang === 'ru' ? 'Показать на карте' : 'Locate on Map'}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const cleanName = tPath.split('/').pop().replace('.json', '');
                    const expPrefix = getExpansionPrefix(configs);
                    const objPath = `${expPrefix}objects/${cleanName}_npc.json`;
                    const objContent = {
                      Objects: [
                        {
                          name: npcModel || 'ExpansionTraderSurvivorM',
                          pos: [...npcCoords],
                          ypr: [0.0, 0.0, 0.0]
                        }
                      ]
                    };
                    onCreateFile(objPath, objContent);
                    toast.success(lang === 'ru' ? `Создан файл спавна ${objPath}` : `Created spawn file ${objPath}`);
                    setContextMenu(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Boxes size={12} />
                  <span>{lang === 'ru' ? 'Экспорт спавна (Objects)' : 'Export NPC Spawn (Objects)'}</span>
                </button>
                <button
                  onClick={() => {
                    const initCode = `GetGame().CreateObjectEx("${npcModel || 'ExpansionTraderSurvivorM'}", "${npcCoords[0]} ${npcCoords[1]} ${npcCoords[2]}", ECE_CREATEPHYSICS);`;
                    navigator.clipboard.writeText(initCode);
                    toast.info(lang === 'ru' ? 'Код init.c скопирован!' : 'init.c code copied!');
                    setContextMenu(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.FileText size={12} />
                  <span>{lang === 'ru' ? 'Копировать код init.c' : 'Copy init.c code'}</span>
                </button>
                <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.4, margin: '2px 0' }} />
                <button
                  onClick={() => handleStartDeleteTrader(tPath)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,80,80,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Trash size={12} />
                  <span>{lang === 'ru' ? 'Удалить торговца...' : 'Delete Trader...'}</span>
                </button>
              </div>
            );
          })()}

          {/* CATEGORY CONTEXT MENU */}
          {contextMenu.type === 'category' && (() => {
            const catPath = contextMenu.data;
            const cCfg = configs[catPath]?.content || {};
            return (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button
                  onClick={() => handleStartCloneCategory(catPath)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Clipboard size={12} />
                  <span>{lang === 'ru' ? 'Дублировать категорию' : 'Duplicate Category'}</span>
                </button>
                <button
                  onClick={() => {
                    const currentIsEx = cCfg.IsExchange ? 1 : 0;
                    onChangeField(catPath, ['IsExchange'], currentIsEx ? 0 : 1);
                    toast.info(lang === 'ru' ? `Режим IsExchange: ${currentIsEx ? 'Выключен' : 'Включен'}` : `IsExchange toggled: ${currentIsEx ? 'Off' : 'On'}`);
                    setContextMenu(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Help size={12} />
                  <span>{lang === 'ru' ? (cCfg.IsExchange ? 'Снять флаг валюты' : 'Сделать валютой (IsExchange)') : 'Toggle IsExchange'}</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedCategoryPath(catPath);
                    setShowXmlImportModal(true);
                    setContextMenu(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Import size={12} />
                  <span>{lang === 'ru' ? 'Импорт из types.xml' : 'Import from types.xml'}</span>
                </button>
                <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.4, margin: '2px 0' }} />
                <button
                  onClick={() => handleStartDeleteCategory(catPath)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,80,80,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Trash size={12} />
                  <span>{lang === 'ru' ? 'Удалить категорию...' : 'Delete Category...'}</span>
                </button>
              </div>
            );
          })()}

          {/* ITEM CONTEXT MENU */}
          {contextMenu.type === 'item' && (() => {
            const { item, index, catPath } = contextMenu.data;
            const isWeapon = detectCompatibleAttachments(item?.ClassName, xmlItemsSet);

            return (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {isWeapon && (
                  <>
                    <button
                      onClick={() => {
                        setContextMenu(null);
                        handleOpenSmartAttachments(item);
                      }}
                      style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'rgba(166,245,166,0.06)', border: 'none', color: '#a6f5a6', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(166,245,166,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(166,245,166,0.06)'}
                    >
                      <Icon.Zap size={13} color="#a6f5a6" />
                      <strong>{lang === 'ru' ? 'Подобрать обвесы и магазины...' : 'Smart Attachments & Mag Kit...'}</strong>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    handleCopyItem(item);
                    setContextMenu(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Clipboard size={12} />
                  <span>{lang === 'ru' ? 'Копировать параметры товара' : 'Copy Item'}</span>
                </button>
                <button
                  onClick={() => {
                    onChangeField(catPath, ['Items', index, 'MinStockThreshold'], 1);
                    onChangeField(catPath, ['Items', index, 'MaxStockThreshold'], 1);
                    toast.success(lang === 'ru' ? 'Установлен бесконечный сток (1/1)' : 'Infinite stock set (1/1)');
                    setContextMenu(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Boxes size={12} />
                  <span>{lang === 'ru' ? 'Бесконечный сток (1/1)' : 'Infinite Stock (1/1)'}</span>
                </button>
                <button
                  onClick={() => {
                    onChangeField(catPath, ['Items', index, 'MinPriceThreshold'], item.MaxPriceThreshold);
                    toast.success(lang === 'ru' ? 'Установлена фиксированная цена' : 'Static price set');
                    setContextMenu(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Check size={12} />
                  <span>{lang === 'ru' ? 'Фиксированная цена (Min=Max)' : 'Static Price (Min=Max)'}</span>
                </button>
                <button
                  onClick={() => {
                    onChangeField(catPath, ['Items', index, 'SellPricePercent'], -1.0);
                    toast.info(lang === 'ru' ? 'Сброшен на наследование от зоны (-1.0)' : 'Reset to zone sell% (-1.0)');
                    setContextMenu(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Crosshair size={12} />
                  <span>{lang === 'ru' ? 'Наследовать Sell % (-1.0)' : 'Inherit Zone Sell % (-1.0)'}</span>
                </button>
                <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.4, margin: '2px 0' }} />
                <button
                  onClick={() => {
                    handleRemoveItem(index);
                    setContextMenu(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', gap: '8px', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,80,80,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon.Trash size={12} />
                  <span>{lang === 'ru' ? 'Удалить из категории' : 'Delete Item'}</span>
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* 📋 Clone Trader / Category Modal */}
      {cloneDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 99998,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            width: '460px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glow)',
            borderRadius: '4px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold', letterSpacing: '1px' }}>
                📋 {cloneDialog.type === 'trader' ? (lang === 'ru' ? 'КЛОНИРОВАНИЕ ТОРГОВЦА' : 'CLONE TRADER') : (lang === 'ru' ? 'КЛОНИРОВАНИЕ КАТЕГОРИИ' : 'CLONE CATEGORY')}
              </div>
              <button onClick={() => setCloneDialog(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  {lang === 'ru' ? 'ИМЯ НОВОГО ФАЙЛА (БЕЗ .JSON)' : 'NEW FILENAME (WITHOUT .JSON)'} *
                </label>
                <input
                  type="text"
                  value={cloneDialog.newFileName}
                  onChange={e => setCloneDialog(prev => ({ ...prev, newFileName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') }))}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)', fontFamily: 'var(--font-mono)' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  {lang === 'ru' ? 'ОТОБРАЖАЕМОЕ ИМЯ (DISPLAYNAME)' : 'DISPLAY NAME'}
                </label>
                <input
                  type="text"
                  value={cloneDialog.newDisplayName}
                  onChange={e => setCloneDialog(prev => ({ ...prev, newDisplayName: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                />
              </div>

              {cloneDialog.type === 'trader' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-primary)', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={cloneDialog.shiftCoords}
                    onChange={e => setCloneDialog(prev => ({ ...prev, shiftCoords: e.target.checked }))}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent-glow)' }}
                  />
                  <span>📍 {lang === 'ru' ? 'Сдвинуть координаты NPC на +2м (чтобы не сливались)' : 'Offset NPC coordinates by +2m'}</span>
                </label>
              )}
            </div>

            <div style={{ padding: '12px 20px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn" onClick={() => setCloneDialog(null)} style={{ padding: '6px 14px', fontSize: '11px' }}>
                {t('modal_confirm_cancel')}
              </button>
              <button
                className="btn btn-accent"
                onClick={handleExecuteClone}
                disabled={!cloneDialog.newFileName.trim()}
                style={{ padding: '6px 18px', fontSize: '11px', fontWeight: 'bold' }}
              >
                ✓ {lang === 'ru' ? 'СОЗДАТЬ ДУБЛИКАТ' : 'CLONE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ Safe Delete Confirmation Modal */}
      {deleteConfirmDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 99998,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            width: '480px',
            background: 'var(--bg-secondary)',
            border: '1px solid #ff4d4d',
            borderRadius: '4px',
            boxShadow: '0 8px 40px rgba(255,77,77,0.2)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '14px 20px', background: 'rgba(255,77,77,0.1)', borderBottom: '1px solid rgba(255,77,77,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#ff6b6b', fontWeight: 'bold', letterSpacing: '1px' }}>
                ⚠️ {deleteConfirmDialog.type === 'trader' ? (lang === 'ru' ? 'УДАЛЕНИЕ ТОРГОВЦА' : 'DELETE TRADER') : (lang === 'ru' ? 'УДАЛЕНИЕ КАТЕГОРИИ' : 'DELETE CATEGORY')}
              </div>
              <button onClick={() => setDeleteConfirmDialog(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
              <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {lang === 'ru' ? 'Вы действительно хотите удалить:' : 'Are you sure you want to delete:'}{' '}
                <strong style={{ color: 'var(--text-glow)', fontFamily: 'var(--font-mono)' }}>{deleteConfirmDialog.displayName}</strong> ({deleteConfirmDialog.path.split('/').pop()})?
              </p>

              {/* Trader related files checkboxes */}
              {deleteConfirmDialog.type === 'trader' && (
                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '3px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                    {lang === 'ru' ? 'СВЯЗАННЫЕ ФАЙЛЫ:' : 'ASSOCIATED FILES:'}
                  </div>
                  {deleteConfirmDialog.hasObject && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-glow)' }}>
                      <input
                        type="checkbox"
                        checked={deleteConfirmDialog.deleteObject}
                        onChange={e => setDeleteConfirmDialog(prev => ({ ...prev, deleteObject: e.target.checked }))}
                        style={{ cursor: 'pointer', accentColor: '#ff6b6b' }}
                      />
                      <span>📦 {lang === 'ru' ? 'Удалить файл спавна 3D-модели (expansion/objects/)' : 'Delete 3D spawn file (expansion/objects/)'}</span>
                    </label>
                  )}
                  {deleteConfirmDialog.hasZone && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-glow)' }}>
                      <input
                        type="checkbox"
                        checked={deleteConfirmDialog.deleteZone}
                        onChange={e => setDeleteConfirmDialog(prev => ({ ...prev, deleteZone: e.target.checked }))}
                        style={{ cursor: 'pointer', accentColor: '#ff6b6b' }}
                      />
                      <span>🛡️ {lang === 'ru' ? 'Удалить персональную безопасную зону (_zone.json)' : 'Delete associated SafeZone file (_zone.json)'}</span>
                    </label>
                  )}
                </div>
              )}

              {/* Category dependencies warnings */}
              {deleteConfirmDialog.type === 'category' && deleteConfirmDialog.usedByTraders && deleteConfirmDialog.usedByTraders.length > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.08)', padding: '12px', borderRadius: '3px', border: '1px solid rgba(251,191,36,0.3)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 'bold' }}>
                    ⚠️ {lang === 'ru' ? `Категория используется торговцами (${deleteConfirmDialog.usedByTraders.length} шт.):` : `Category is used by ${deleteConfirmDialog.usedByTraders.length} trader(s):`}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {deleteConfirmDialog.usedByTraders.map(t => t.name).join(', ')}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-glow)', marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={deleteConfirmDialog.unbindFromTraders}
                      onChange={e => setDeleteConfirmDialog(prev => ({ ...prev, unbindFromTraders: e.target.checked }))}
                      style={{ cursor: 'pointer', accentColor: '#fbbf24' }}
                    />
                    <span>🔗 {lang === 'ru' ? 'Автоматически отвязать категорию от этих торговцев' : 'Automatically unbind category from these traders'}</span>
                  </label>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn" onClick={() => setDeleteConfirmDialog(null)} style={{ padding: '6px 14px', fontSize: '11px' }}>
                {t('modal_confirm_cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleExecuteDelete}
                style={{ padding: '6px 18px', fontSize: '11px', fontWeight: 'bold' }}
              >
                🗑️ {lang === 'ru' ? 'УДАЛИТЬ НАВСЕГДА' : 'DELETE PERMANENTLY'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ❓ Help / Legend Modal */}
      {showHelpModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 99998,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }} onClick={() => setShowHelpModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '680px',
              maxWidth: '92vw',
              maxHeight: '88vh',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glow)',
              borderRadius: '4px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.9), 0 0 20px rgba(255,193,7,0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'toastIn 0.2s ease',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 20px',
              background: 'rgba(255,193,7,0.08)',
              borderBottom: '1px solid rgba(255,193,7,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 'bold', color: '#ffd54f', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon.Help size={16} color="#ffd54f" />
                <span>{lang === 'ru' ? 'РУКОВОДСТВО ПО МОДУЛЮ ЭКОНОМИКИ И ЛЕГЕНДА' : 'ECONOMY MODULE GUIDE & LEGEND'}</span>
              </span>
              <button onClick={() => setShowHelpModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* 🎨 Color Legend */}
              <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: '#ffd54f', letterSpacing: '1.5px', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon.Eye size={12} />
                  <span>{lang === 'ru' ? '// ЦВЕТОВАЯ ИНДИКАЦИЯ ТОВАРОВ' : '// COLOR CODING & STATUSES'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { color: 'var(--text-glow)', label: lang === 'ru' ? 'Обычный товар — данные в норме' : 'Valid item — verified' },
                    { color: '#ffd54f', label: lang === 'ru' ? 'Изменённые данные (не сохранены на диск)' : 'Modified (unsaved changes)' },
                    { color: 'var(--danger-color)', label: lang === 'ru' ? 'Ошибка валидации (Мин. > Макс. цена/сток)' : 'Validation error (Min > Max)' },
                    { color: '#f87171', label: lang === 'ru' ? '⚠️ Отсутствует в базе types.xml сервера' : '⚠️ Missing in server types.xml' },
                    { color: '#82b4f5', label: lang === 'ru' ? '📎 Назначены обвесы (SpawnAttachments)' : '📎 Configured SpawnAttachments' },
                    { color: '#fbbf24', label: lang === 'ru' ? '⚠ DUP — дубликат в других категориях' : '⚠ DUP — item exists in other cats' },
                  ].map(({ color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ⚡ Smart Attachments Assistant */}
              <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: '#a6f5a6', letterSpacing: '1.5px', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon.Zap size={12} color="#a6f5a6" />
                  <span>{lang === 'ru' ? '// ИНТЕЛЛЕКТУАЛЬНЫЙ ПОДБОР ОБВЕСОВ (SMART ATTACHMENTS)' : '// SMART ATTACHMENTS ASSISTANT'}</span>
                </div>
                {[
                  { icon: Icon.Zap, text: lang === 'ru' ? 'Правый клик (ПКМ) по оружию открывает ассистент подбора совместимых магазинов, оптики, глушителей, цевий и прикладов.' : 'Right-click (RMB) on any weapon to open the compatibility assistant for magazines, optics, suppressors, and stocks.' },
                  { icon: Icon.Boxes, text: lang === 'ru' ? 'Режим «В категорию»: добавляет все выбранные модули на витрину маркета как отдельные товары с настройкой цен.' : 'To Category mode: adds selected modules to the market shelf as separate trade items with pricing.' },
                  { icon: Icon.Wrench, text: lang === 'ru' ? 'Режим «На оружие»: экипирует выбранные модули (строго по 1 на слот) прямо на оружие в массив SpawnAttachments.' : 'On Weapon mode: equips selected modules (strictly 1 per slot) directly into SpawnAttachments.' },
                  { icon: Icon.Plus, text: lang === 'ru' ? 'Кнопка «+ Свой» позволяет добавить любой кастомный модовый класснейм в нужный слот с сохранением в памяти.' : '+ Custom button lets you add any modded classname to a slot with persistent storage.' },
                ].map(({ icon: IconComp, text }, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#a6f5a6', marginTop: '2px', flexShrink: 0 }}><IconComp size={13} /></span>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* 📋 Market Categories & Bulk Tools */}
              <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: '#ffd54f', letterSpacing: '1.5px', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon.Categories size={12} />
                  <span>{lang === 'ru' ? '// КАТЕГОРИИ РЫНКА И ПАКЕТНЫЕ ОПЕРАЦИИ' : '// MARKET CATEGORIES & BULK TOOLS'}</span>
                </div>
                {[
                  { icon: Icon.Clipboard, text: lang === 'ru' ? '«Вставить списком»: умный парсер текстов, логов и XML с фильтрацией мусора, CE-метаданных (Tier, Farm) и интерактивным предпросмотром.' : 'Bulk Paste: smart parser for text, logs, and XML with noise/tier filtering and live chips preview.' },
                  { icon: Icon.Sliders, text: lang === 'ru' ? '«Групповое масштабирование»: процентное изменение цен (Min/Max Price) и стока для выбранных товаров или всей категории.' : 'Batch Multiplier: percentage scaling of prices and stocks for selected items or entire category.' },
                  { icon: Icon.Eye, text: lang === 'ru' ? 'Двухоконный режим (Split-View): одновременное редактирование категории и переключение режимов торговли (1=Buy, 2=Sell, 3=Both) в привязанных торговцах.' : 'Split-View: simultaneously edit category items while managing trade modes across linked traders.' },
                ].map(({ icon: IconComp, text }, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#ffd54f', marginTop: '2px', flexShrink: 0 }}><IconComp size={13} /></span>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* 🤝 Traders & Matrix */}
              <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: '#ffd54f', letterSpacing: '1.5px', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon.Overview size={12} />
                  <span>{lang === 'ru' ? '// ТОРГОВЦЫ И МАТРИЦА СВЯЗЕЙ' : '// TRADERS & MATRIX OVERVIEW'}</span>
                </div>
                {[
                  { icon: Icon.Matrix, text: lang === 'ru' ? 'Вкладка «Матрица торговли»: наглядная сетка всех торговцев и категорий с переключением режимов в один клик.' : 'Trade Matrix tab: comprehensive grid of all traders and categories with 1-click mode cycling.' },
                  { icon: Icon.Wrench, text: lang === 'ru' ? 'Мастер торговца («+ СОЗДАТЬ ТОРГОВЦА»): пошаговая генерация файла торговца, привязка категорий, валют и координат спавна NPC.' : 'Trader Wizard (+ CREATE TRADER): step-by-step trader generation, category linking, currency setup, and NPC spawn coords.' },
                ].map(({ icon: IconComp, text }, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#ffd54f', marginTop: '2px', flexShrink: 0 }}><IconComp size={13} /></span>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{text}</span>
                  </div>
                ))}
              </div>

            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px',
              background: 'var(--bg-tertiary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'flex-end',
            }}>
              <button className="btn" onClick={() => setShowHelpModal(false)} style={{ padding: '6px 20px', fontSize: '12px' }}>
                {lang === 'ru' ? '× ЗАКРЫТЬ' : '× CLOSE'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
