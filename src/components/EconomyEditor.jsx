import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AutocompleteInput from './shared/AutocompleteInput';
import { useToast } from './ToastManager';
import { translateStrKey } from '../utils/strKeys';
import { useTranslation } from '../utils/localization';
import HelpIcon from './HelpIcon';
import { AutocompleteWorkerWrapper } from '../utils/autocompleteWorker';


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

// ─── Main EconomyEditor ───────────────────────────────────────────────────────

export default function EconomyEditor({ configs, onChangeField, onSaveFile, onCreateFile, xmlItems = [], onShowConfirm }) {
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
  const [wizardFaction, setWizardFaction] = useState('');
  const [wizardMinRep, setWizardMinRep] = useState(0);
  const [wizardMaxRep, setWizardMaxRep] = useState(2147483647);
  const [wizardQuestId, setWizardQuestId] = useState(-1);
  const [wizardSelectedCats, setWizardSelectedCats] = useState(new Set());
  const [wizardDefaultMode, setWizardDefaultMode] = useState(3); // 3 = Both
  const [wizardCurrency, setWizardCurrency] = useState('expansionbanknotehryvnia');
  const [wizardCatSearch, setWizardCatSearch] = useState('');
  const [wizardCustomIcon, setWizardCustomIcon] = useState('');

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
  const activeCategoryConfig = selectedCategoryPath ? configs[selectedCategoryPath] : null;
  const activeTraderConfig   = selectedTraderPath   ? configs[selectedTraderPath]   : null;

  // ─ Search / filter ─────────────────────────────────────────────────────────
  const [itemQuery,       setItemQuery]       = useState('');
  const [traderItemQuery, setTraderItemQuery] = useState('');
  const [searchAllMode,   setSearchAllMode]   = useState(false);  // B4 cross-cat search

  // ─ Sorting (B2) ───────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState(null);
  const [sortDir,   setSortDir]   = useState('asc');

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
    const paths = Object.keys(configs).filter(p => p.toLowerCase().startsWith('expansionmod/market/') && configs[p].success);
    paths.sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()));
    return paths;
  }, [configs]);

  const traderPaths = useMemo(() => {
    const paths = Object.keys(configs).filter(p => p.toLowerCase().startsWith('expansionmod/traders/') && configs[p].success);
    paths.sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()));
    return paths;
  }, [configs]);

  const questsList = useMemo(() => {
    const list = [];
    Object.entries(configs).forEach(([p, file]) => {
      if (file.success && file.content && p.toLowerCase().startsWith('expansionmod/quests/quests/quest_') && file.content.ID !== undefined) {
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
    Object.values(configs).forEach(file => {
      if (!file.success || !file.content) return;
      if (Array.isArray(file.content.Items)) file.content.Items.forEach(i => { if (i.ClassName) names.add(i.ClassName.toLowerCase()); });
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

  // ─ Cross-category search results (B4) ────────────────────────────────────
  const crossCatResults = useMemo(() => {
    if (!searchAllMode || !itemQuery.trim()) return [];
    const lower = itemQuery.toLowerCase();
    const results = [];
    categoryPaths.forEach(p => {
      const file = configs[p];
      if (!file?.success || !Array.isArray(file.content?.Items)) return;
      const catName = p.split('/').pop().replace('.json', '');
      file.content.Items.forEach((item, idx) => {
        if (item.ClassName?.toLowerCase().includes(lower)) {
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
  const isCategoryDirty = activeCategoryConfig && activeCategoryConfig.success
    ? JSON.stringify(activeCategoryConfig.content) !== JSON.stringify(activeCategoryConfig.originalContent) : false;
  const isTraderDirty = activeTraderConfig && activeTraderConfig.success
    ? JSON.stringify(activeTraderConfig.content) !== JSON.stringify(activeTraderConfig.originalContent) : false;

  // ─ Trader computed ────────────────────────────────────────────────────────
  const traderItemsList     = activeTraderConfig?.content?.Items ? Object.entries(activeTraderConfig.content.Items) : [];
  const filteredTraderItems = traderItemsList.filter(([name]) => name.toLowerCase().includes(traderItemQuery.toLowerCase()));

  const parseTraderCategory = (catStr) => {
    if (catStr.includes(':')) { const [name, mode] = catStr.split(':'); return { name, mode: parseInt(mode) }; }
    return { name: catStr, mode: 3 };
  };

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

  // ─ JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', padding: '8px 16px', alignItems: 'center', gap: '12px' }}>
        <button className={`btn ${subTab === 'overview' ? 'btn-accent' : ''}`} onClick={() => setSubTab('overview')} style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}>
          📊 {lang === 'ru' ? 'ОБЗОР И АНОМАЛИИ' : 'OVERVIEW & ANOMALIES'}
        </button>
        <button className={`btn ${subTab === 'categories' ? 'btn-accent' : ''}`} onClick={() => setSubTab('categories')} style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}>
          {t('econ_tab_categories', { count: categoryPaths.length })}
        </button>
        <button className={`btn ${subTab === 'traders' ? 'btn-accent' : ''}`} onClick={() => setSubTab('traders')} style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}>
          {t('econ_tab_traders', { count: traderPaths.length })}
        </button>
        <button 
          className="btn" 
          onClick={() => setShowHelpModal(true)} 
          style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold', background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', color: '#ffd54f' }}
        >
          ❓ {lang === 'ru' ? 'СПРАВКА / ЛЕГЕНДА' : 'HELP / LEGEND'}
        </button>
      </div>

      {/* Main split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── SIDEBAR ────────────────────────────────────────────────────── */}
        {subTab !== 'overview' && (
          <div style={{ width: '240px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
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

            {subTab === 'traders' && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                <button
                  className="btn btn-accent"
                  onClick={() => {
                    setWizardStep(1);
                    setWizardFilename('');
                    setWizardDisplayName('');
                    setWizardIcon('Shotgun');
                    setWizardFaction('');
                    setWizardMinRep(0);
                    setWizardMaxRep(2147483647);
                    setWizardQuestId(-1);
                    setWizardSelectedCats(new Set());
                    setWizardDefaultMode(3);
                    setWizardCurrency('expansionbanknotehryvnia');
                    setWizardCatSearch('');
                    setShowTraderWizard(true);
                  }}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.8px', textAlign: 'center', justifyContent: 'center' }}
                >
                  {lang === 'ru' ? 'СОЗДАТЬ ТОРГОВЦА' : 'CREATE TRADER'}
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(subTab === 'categories' ? categoryPaths : traderPaths).map(path => {
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

          {subTab === 'categories' ? (
            activeCategoryConfig ? (
              <>
                {/* B5+B6: Category header with editable fields and stats */}
                <div style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('econ_editing_label')}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontWeight: 'bold', fontSize: '13px' }}>
                        {selectedCategoryPath.split('/').pop()}
                      </span>
                      {isCategoryDirty && <span className="badge-dirty" />}
                    </div>
                     {/* B5: Editable DisplayName + InitStockPercent */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('econ_display_name_label')}</span>
                        <input
                          type="text"
                          value={activeCategoryConfig.content.DisplayName || ''}
                          onChange={e => onChangeField(selectedCategoryPath, ['DisplayName'], e.target.value)}
                          style={{ fontSize: '12px', padding: '3px 8px', width: '160px' }}
                        />
                        {activeCategoryConfig.content.DisplayName && activeCategoryConfig.content.DisplayName.startsWith('#STR_') && (
                          <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontStyle: 'italic' }} title={t('econ_translated_name_tooltip')}>
                            ({translateStrKey(activeCategoryConfig.content.DisplayName)})
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('econ_init_stock_label')}</span>
                        <input
                          type="number"
                          value={activeCategoryConfig.content.InitStockPercent ?? 100}
                          onChange={e => onChangeField(selectedCategoryPath, ['InitStockPercent'], Number(e.target.value))}
                          style={{ fontSize: '12px', padding: '3px 8px', width: '70px', textAlign: 'center' }}
                        />
                      </div>
                    </div>
                    {/* B6: Stats chips */}
                    {catStats && (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {[
                          { label: t('econ_stats_items'),    val: catStats.count   },
                          { label: t('econ_stats_avg_min'),  val: `${catStats.avgMin}$` },
                          { label: t('econ_stats_avg_max'),  val: `${catStats.avgMax}$` },
                          { label: t('econ_stats_avg_sell'), val: `${catStats.avgSell}%` },
                        ].map(({ label, val }) => (
                          <span key={label} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '2px', padding: '2px 8px' }}>
                            <span style={{ color: 'var(--text-dark)' }}>{label}: </span>
                            <span style={{ color: 'var(--text-glow)' }}>{val}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className={`btn ${isCategoryDirty ? 'btn-accent' : ''}`}
                    onClick={() => onSaveFile(selectedCategoryPath)}
                    disabled={!isCategoryDirty}
                    style={{ opacity: isCategoryDirty ? 1 : 0.5, cursor: isCategoryDirty ? 'pointer' : 'not-allowed' }}
                  >
                    {t('econ_save_cat_btn_text')}
                  </button>
                </div>

                {/* Toolbar row */}
                <div style={{ padding: '10px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  {/* Filter + Search-all toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', width: '220px' }}>
                      <input type="text" placeholder={t('econ_filter_items_ph')} value={itemQuery} onChange={e => setItemQuery(e.target.value)} style={{ fontSize: '12px', padding: '6px 12px 6px 24px' }} />
                      <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '10px' }}>▶</span>
                    </div>
                    {/* B4: Search all toggle */}
                    <button
                      className={`btn ${searchAllMode ? 'btn-accent' : ''}`}
                      onClick={() => setSearchAllMode(prev => !prev)}
                      style={{ padding: '6px 10px', fontSize: '10px', letterSpacing: '0.5px' }}
                      title={t('econ_search_all_categories_tooltip')}
                    >
                      🔍 {searchAllMode ? t('econ_search_all') : t('econ_search_this')}
                    </button>
                  </div>

                  {/* Add item + paste */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '280px', maxWidth: '420px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('econ_add_item')}</span>
                    <AutocompleteInput suggestions={suggestions} placeholder={t('econ_type_classname')} onSelect={handleAddItem} style={{ flex: 1 }} />
                  </div>

                  {/* B8: Paste button */}
                  {copiedItem && (
                    <button className="btn btn-warning" onClick={handlePasteCopiedItem} style={{ padding: '6px 12px', fontSize: '11px' }} title={`Paste: ${copiedItem.ClassName}`}>
                      {t('econ_paste_btn', { classname: copiedItem.ClassName })}
                    </button>
                  )}

                  {/* B7: Import from category */}
                  <button className="btn" onClick={() => setShowImportPanel(prev => !prev)} style={{ padding: '6px 12px', fontSize: '11px' }}>
                    {t('econ_import_from_btn')}
                  </button>

                  {/* Mass Import from types.xml */}
                  {Array.isArray(xmlItems) && xmlItems.length > 0 && (
                    <button 
                      className="btn btn-accent" 
                      onClick={() => setShowXmlImportModal(true)} 
                      style={{ padding: '6px 12px', fontSize: '11px' }}
                    >
                      {t('econ_import_from_types')}
                    </button>
                  )}

                  {/* B9: Bulk Pricing */}
                  <button 
                    className="btn btn-warning" 
                    onClick={() => setShowBulkPricingModal(true)} 
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                  >
                    {t('econ_bulk_price_btn')}
                  </button>
                </div>

                {/* B7: Import panel */}
                {showImportPanel && (
                  <div style={{ padding: '10px 20px', background: 'rgba(149,192,149,0.04)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('econ_source_cat_label')}</span>
                    <select
                      value={importFromCatPath}
                      onChange={e => setImportFromCatPath(e.target.value)}
                      style={{ fontSize: '12px', flex: 1, maxWidth: '300px' }}
                    >
                      <option value="">-- SELECT --</option>
                      {categoryPaths.filter(p => p !== selectedCategoryPath).map(p => (
                        <option key={p} value={p}>{p.split('/').pop().replace('.json', '')}</option>
                      ))}
                    </select>
                    <button className="btn btn-accent" onClick={handleImportFromCategory} disabled={!importFromCatPath} style={{ padding: '6px 14px', fontSize: '11px', opacity: importFromCatPath ? 1 : 0.5 }}>
                      IMPORT ITEMS
                    </button>
                    <button className="btn" onClick={() => { setShowImportPanel(false); setImportFromCatPath(''); }} style={{ padding: '6px 10px', fontSize: '11px' }}>
                      CANCEL
                    </button>
                  </div>
                )}

                {/* Bulk Actions (B3) */}
                <div style={{ padding: '10px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '10px', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{t('econ_bulk_actions')}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-dark)', fontFamily: 'var(--font-mono)' }}>
                    {selectedItems.size > 0 ? t('econ_bulk_selected', { count: selectedItems.size }) : t('econ_all_items')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{t('econ_bulk_op')}</label>
                    <select
                      id="bulk-op"
                      value={bulkOp}
                      onChange={e => setBulkOp(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    >
                      <option value="mult-buy">{t('econ_bulk_op_mult_buy')}</option>
                      <option value="mult-sell">{t('econ_bulk_op_mult_sell')}</option>
                      <option value="sync-sell-percent">{t('econ_bulk_op_sync_sell')}</option>
                      <option value="add-attachment">{lang === 'ru' ? 'Добавить обвес' : 'Add Spawn Attachment'}</option>
                      <option value="remove-attachment">{lang === 'ru' ? 'Удалить обвес' : 'Remove Spawn Attachment'}</option>
                      <option value="clear-attachments">{lang === 'ru' ? 'Очистить все обвесы' : 'Clear Spawn Attachments'}</option>
                    </select>
                  </div>
                  {bulkOp !== 'clear-attachments' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{t('econ_bulk_val')}</label>
                      {['add-attachment', 'remove-attachment'].includes(bulkOp) ? (
                        <input
                          type="text"
                          id="bulk-val"
                          placeholder={lang === 'ru' ? 'Имя обвеса...' : 'Attachment name...'}
                          style={{ padding: '4px 8px', fontSize: '11px', width: '150px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                        />
                      ) : (
                        <input
                          type="number"
                          id="bulk-val"
                          defaultValue="1.1"
                          step="any"
                          style={{ padding: '4px 8px', fontSize: '11px', width: '60px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)', textAlign: 'center' }}
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

                      if (['mult-buy', 'mult-sell', 'sync-sell-percent'].includes(op) && isNaN(val)) {
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


                {/* Items table */}
                <div style={{ padding: '20px' }}>
                  {/* Economy Pricing Chart */}
                  {priceData && (
                    <div className="economy-chart-card">
                      <div className="economy-chart-header">
                        <div className="economy-chart-title">
                          📊 {lang === 'ru' ? "Распределение цен категории" : "Category Price Distribution"}
                        </div>
                        <div className="economy-chart-summary">
                          <div>{lang === 'ru' ? "Ср. покупка: " : "Avg Buy: "}<strong style={{ color: 'var(--accent-glow)' }}>{priceData.avgMax}</strong></div>
                          <div>{lang === 'ru' ? "Ср. продажа: " : "Avg Sell: "}<strong style={{ color: 'var(--warning-color)' }}>{priceData.avgMin}</strong></div>
                          <div>{lang === 'ru' ? "Пик: " : "Peak: "}<strong style={{ color: 'var(--danger-color)' }}>{priceData.peakMax}</strong></div>
                          <div>{lang === 'ru' ? "Товаров: " : "Items: "}<strong style={{ color: 'var(--text-glow)' }}>{priceData.items.length}</strong></div>
                        </div>
                      </div>
                      <div className="economy-chart-svg-container">
                        <svg width="100%" height="100%" viewBox="0 0 600 120" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                          {/* Grid lines */}
                          <line x1="40" y1="20" x2="580" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                          <line x1="40" y1="60" x2="580" y2="60" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                          <line x1="40" y1="100" x2="580" y2="100" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                          
                          {/* Price Area curves */}
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
                                {/* Area fill under max prices */}
                                <polygon points={areaPoints} fill="rgba(149, 192, 149, 0.06)" />
                                
                                {/* Max Buy Price Line (accent-glow) */}
                                <polyline points={maxPoints} fill="none" stroke="var(--accent-glow)" strokeWidth="2.5" />
                                
                                {/* Min Sell Price Line (warning) */}
                                <polyline points={minPoints} fill="none" stroke="var(--warning-color)" strokeWidth="1.5" strokeDasharray="4 2" />
                              </>
                            );
                          })()}

                          {/* Axes */}
                          <line x1="40" y1="10" x2="40" y2="110" stroke="var(--border-color)" strokeWidth="1" />
                          <line x1="40" y1="110" x2="580" y2="110" stroke="var(--border-color)" strokeWidth="1" />

                          {/* Labels */}
                          <text x="32" y="23" fill="var(--text-secondary)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">{priceData.peakMax}</text>
                          <text x="32" y="63" fill="var(--text-secondary)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">{Math.round(priceData.peakMax / 2)}</text>
                          <text x="32" y="103" fill="var(--text-secondary)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">0</text>
                          
                          <text x="40" y="120" fill="var(--text-secondary)" fontSize="8" textAnchor="start" fontFamily="var(--font-mono)">{priceData.items[0]?.name || ''}</text>
                          <text x="580" y="120" fill="var(--text-secondary)" fontSize="8" textAnchor="end" fontFamily="var(--font-mono)">{priceData.items[priceData.items.length - 1]?.name || ''}</text>
                        </svg>
                      </div>
                    </div>
                  )}

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
                            filteredItems.map((item) => {
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
                                  <tr style={{ background: isSelected ? 'rgba(149,192,149,0.06)' : 'transparent' }}>
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
                                          <span title={t('econ_item_missing_tooltip')} style={{ color: 'var(--warning-color)', fontSize: '12px', marginLeft: '6px', cursor: 'help' }}>⚠️</span>
                                        )}
                                      </div>
                                    </td>
                                    {/* B10: error highlights on min>max cells */}
                                    <td><EditableCell type="number" value={item.MinPriceThreshold} originalValue={origItem.MinPriceThreshold} hasError={minPriceErr} onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'MinPriceThreshold'], v)} style={{ textAlign: 'center' }} /></td>
                                    <td><EditableCell type="number" value={item.MaxPriceThreshold} originalValue={origItem.MaxPriceThreshold} hasError={minPriceErr} onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'MaxPriceThreshold'], v)} style={{ textAlign: 'center' }} /></td>
                                    <td><EditableCell type="number" value={item.MinStockThreshold} originalValue={origItem.MinStockThreshold} hasError={minStockErr} onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'MinStockThreshold'], v)} style={{ textAlign: 'center' }} /></td>
                                    <td><EditableCell type="number" value={item.MaxStockThreshold} originalValue={origItem.MaxStockThreshold} hasError={minStockErr} onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'MaxStockThreshold'], v)} style={{ textAlign: 'center' }} /></td>
                                    <td><EditableCell type="number" value={item.SellPricePercent}  originalValue={origItem.SellPricePercent}  onChange={v => onChangeField(selectedCategoryPath, ['Items', item.originalIndex, 'SellPricePercent'], v)} style={{ textAlign: 'center' }} /></td>
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
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                {t('econ_select_cat_label')}
              </div>
            )
          ) : (
            /* ── TRADERS VIEW (unchanged structure, kept clean) ──────────── */
            activeTraderConfig ? (
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Соотношение мин. цены:' : 'Min Price ratio:'}</span>
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
            width: '600px',
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
                  {lang === 'ru' ? `Шаг ${wizardStep} из 3` : `Step ${wizardStep} of 3`}
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
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{ 
                    flex: 1, 
                    height: '4px', 
                    background: wizardStep >= s ? 'var(--accent-glow)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '2px',
                    transition: 'background 0.3s'
                  }} />
                ))}
              </div>

              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Filename */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'ИМЯ ФАЙЛА (В СИСТЕМЕ)' : 'SYSTEM FILENAME'} *
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

                  {/* Trader Icon presets */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'ИКОНКА ТОРГОВЦА' : 'TRADER ICON'}
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
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        appearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2395c095\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '10px'
                      }}
                    >
                      {['Shotgun', 'Car', 'Clothing', 'Melee', 'Medical', 'Food', 'Boats', 'Exchange', 'Custom'].map(icon => (
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
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        appearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2395c095\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '10px'
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

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' 
                      ? 'Выберите категории товаров, которые будут продаваться у этого торговца:' 
                      : 'Choose market categories that will be attached to this trader:'}
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
                    maxHeight: '320px',
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

              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Default Direction Override */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'РЕЖИМ ТОРГОВЛИ ПО УМОЛЧАНИЮ' : 'DEFAULT TRADE DIRECTION'}
                    </label>
                    <select 
                      value={wizardDefaultMode} 
                      onChange={e => setWizardDefaultMode(Number(e.target.value))}
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
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        appearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2395c095\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '10px'
                      }}
                    >
                      <option value={3}>{t('trader_direction_both')}</option>
                      <option value={1}>{t('trader_direction_buy')}</option>
                      <option value={2}>{t('trader_direction_sell')}</option>
                      <option value={0}>{t('trader_direction_disabled')}</option>
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      {lang === 'ru' 
                        ? 'Выбранное направление применится ко всем привязанным категориям.' 
                        : 'The chosen mode will apply to all associated categories.'}
                    </span>
                  </div>

                  {/* Accepted Currency */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'ПРИНИМАЕМАЯ ВАЛЮТА' : 'ACCEPTED CURRENCY'}
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
                </div>
              )}

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
                
                {wizardStep < 3 ? (
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

                      const finalFilename = `expansionmod/traders/${wizardFilename.toLowerCase().trim()}.json`;
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
                      setSelectedTraderPath(finalFilename);
                      setSubTab('traders');
                      setShowTraderWizard(false);
                    }}
                    style={{ padding: '8px 20px', fontWeight: 'bold' }}
                  >
                    {lang === 'ru' ? '✓ СОЗДАТЬ' : '✓ CREATE'}
                  </button>
                )}
              </div>
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
              width: '600px',
              maxHeight: '85vh',
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
              padding: '16px 20px',
              background: 'rgba(255,193,7,0.08)',
              borderBottom: '1px solid rgba(255,193,7,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 'bold', color: '#ffd54f', letterSpacing: '1px' }}>
                ❓ {lang === 'ru' ? 'СПРАВКА / ЛЕГЕНДА' : 'HELP / LEGEND'}
              </span>
              <button onClick={() => setShowHelpModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Color Legend */}
              <div>
                <div style={{ fontSize: '11px', color: '#ffd54f', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '10px' }}>
                  {lang === 'ru' ? '// ЦВЕТОВАЯ ЛЕГЕНДА' : '// COLOR LEGEND'}
                </div>
                {[
                  { color: 'var(--text-glow)', label: lang === 'ru' ? 'Обычный предмет — данные в норме' : 'Normal item — data is valid' },
                  { color: '#ffd54f', label: lang === 'ru' ? 'Изменённые данные (отличаются от исходника)' : 'Modified data (differs from disk)' },
                  { color: 'var(--danger-color)', label: lang === 'ru' ? 'Ошибка: Мин. > Макс. (цена или запас)' : 'Error: Min > Max (price or stock)' },
                  { color: 'var(--warning-color)', label: lang === 'ru' ? '⚠️ Предмет не найден в базе types.xml' : '⚠️ Item not found in types.xml database' },
                  { color: '#82b4f5', label: lang === 'ru' ? 'Предмет имеет назначенные обвесы (attachments)' : 'Item has configured spawn attachments' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Categories section */}
              <div>
                <div style={{ fontSize: '11px', color: '#ffd54f', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '10px' }}>
                  {lang === 'ru' ? '// КАТЕГОРИИ РЫНКА' : '// MARKET CATEGORIES'}
                </div>
                {[
                  { icon: '📋', text: lang === 'ru' ? 'Нажмите на предмет для редактирования значений прямо в таблице' : 'Click any cell to edit its value inline in the table' },
                  { icon: '📁', text: lang === 'ru' ? 'Кнопка 📂 в строке торговца открывает связанную категорию рынка' : '📂 button on a trader row navigates to the linked market category' },
                  { icon: '⚠️', text: lang === 'ru' ? 'Значок ⚠ DUP означает, что предмет продублирован в других категориях' : '⚠ DUP badge means the item exists in other categories too' },
                  { icon: '📎', text: lang === 'ru' ? 'Столбец «Обвесы» позволяет настроить предметы для спавна с аттачментами (SpawnAttachments)' : 'Attachments column lets you configure items to spawn with SpawnAttachments' },
                  { icon: '🛠', text: lang === 'ru' ? 'Массовые операции применяются к выделенным предметам или ко всему списку' : 'Bulk actions apply to selected items or all items in the list' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* Traders section */}
              <div>
                <div style={{ fontSize: '11px', color: '#ffd54f', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '10px' }}>
                  {lang === 'ru' ? '// ТОРГОВЦЫ' : '// TRADERS'}
                </div>
                {[
                  { icon: '🤝', text: lang === 'ru' ? 'Выберите торговца из левой панели для редактирования его параметров' : 'Select a trader from the left sidebar to edit its configuration' },
                  { icon: '💱', text: lang === 'ru' ? 'Раздел «Валюты» определяет, какие предметы принимаются как оплата' : 'The Currencies section defines what items are accepted as payment' },
                  { icon: '🗂', text: lang === 'ru' ? 'Категории торговца ссылаются на файлы из вкладки «Категории рынка»' : 'Trader categories link to files from the Market Categories tab' },
                  { icon: '⚙️', text: lang === 'ru' ? 'Индивидуальные наценки позволяют переопределить режим торговли для конкретных предметов' : 'Item overrides let you set per-item trade direction independently of the category' },
                  { icon: '✨', text: lang === 'ru' ? 'Кнопка «+ СОЗДАТЬ ТОРГОВЦА» запускает мастер создания нового файла торговца' : '+ CREATE TRADER button launches the wizard to generate a new trader config file' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
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
