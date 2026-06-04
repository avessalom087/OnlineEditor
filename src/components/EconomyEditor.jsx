import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AutocompleteInput from './shared/AutocompleteInput';
import { useToast } from './ToastManager';
import { translateStrKey } from '../utils/strKeys';
import { useTranslation } from '../utils/localization';
import { AutocompleteWorkerWrapper } from '../utils/autocompleteWorker';


// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({ value, originalValue, type = 'text', onChange, style = {}, hasError = false }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value);
  const isDirty = value !== originalValue;

  const handleBlur = () => {
    setEditing(false);
    let parsed = type === 'number' ? Number(tempVal) : tempVal;
    if (type === 'number' && Number.isNaN(parsed)) {
      parsed = originalValue !== undefined ? originalValue : 0;
    }
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

function SortableHeader({ field, label, sortField, sortDir, onSort, style = {} }) {
  const isActive = sortField === field;
  return (
    <th
      className="sortable-th"
      onClick={() => onSort(field)}
      style={{ ...style }}
    >
      {label}
      {' '}
      <span style={{ opacity: isActive ? 1 : 0.3, fontSize: '10px', color: isActive ? 'var(--text-glow)' : 'var(--text-secondary)' }}>
        {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

// ─── Main EconomyEditor ───────────────────────────────────────────────────────

export default function EconomyEditor({ configs, onChangeField, onSaveFile, xmlItems = [], onShowConfirm }) {
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
    return localStorage.getItem('dayz_editor_economy_sub_tab') || 'categories';
  });
  const [selectedCategoryPath, setSelectedCategoryPath] = useState(() => {
    return localStorage.getItem('dayz_editor_economy_selected_category') || null;
  });
  const [selectedTraderPath,   setSelectedTraderPath]   = useState(() => {
    return localStorage.getItem('dayz_editor_economy_selected_trader') || null;
  });

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

  const [hoveredChartItem, setHoveredChartItem] = useState(null);

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
        <button className={`btn ${subTab === 'categories' ? 'btn-accent' : ''}`} onClick={() => setSubTab('categories')} style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}>
          📁 MARKET CATEGORIES ({categoryPaths.length})
        </button>
        <button className={`btn ${subTab === 'traders' ? 'btn-accent' : ''}`} onClick={() => setSubTab('traders')} style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}>
          🤝 TRADER SETTINGS ({traderPaths.length})
        </button>
      </div>

      {/* Main split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── SIDEBAR ────────────────────────────────────────────────────── */}
        <div style={{ width: '240px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: 'bold' }}>
              {subTab === 'categories' ? '// MARKET_CATEGORIES' : '// SERVER_TRADERS'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '2px' }}>
              TOTAL: {subTab === 'categories' ? categoryPaths.length + ' FILES' : traderPaths.length + ' TRADERS'}
            </div>
          </div>

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

        {/* ── EDITOR AREA ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

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
                    <select id="bulk-op" style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}>
                      <option value="mult-buy">{t('econ_bulk_op_mult_buy')}</option>
                      <option value="mult-sell">{t('econ_bulk_op_mult_sell')}</option>
                      <option value="sync-sell-percent">{t('econ_bulk_op_sync_sell')}</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{t('econ_bulk_val')}</label>
                    <input type="number" id="bulk-val" defaultValue="1.1" step="any" style={{ padding: '4px 8px', fontSize: '11px', width: '60px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)', textAlign: 'center' }} />
                  </div>
                   <button
                    className="btn btn-accent"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={() => {
                      const op  = document.getElementById('bulk-op').value;
                      const val = parseFloat(document.getElementById('bulk-val').value);
                      if (isNaN(val)) { toast.error(t('econ_toast_bulk_invalid_val')); return; }
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
                    <div className="economy-chart-card" style={{ position: 'relative' }}>
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

                      {/* Tooltip Overlay */}
                      {hoveredChartItem && (
                        <div style={{
                          position: 'absolute',
                          left: `${hoveredChartItem.x}px`,
                          top: `${hoveredChartItem.y}px`,
                          transform: 'translate(-50%, -100%)',
                          background: 'rgba(7, 9, 7, 0.95)',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'var(--shadow-glow-active)',
                          padding: '6px 10px',
                          borderRadius: '2px',
                          zIndex: 100,
                          pointerEvents: 'none',
                          minWidth: '150px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          lineHeight: '1.4'
                        }}>
                          <div style={{ color: 'var(--text-glow)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '3px', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {hoveredChartItem.name}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-glow)' }}>
                            <span>BUY:</span>
                            <strong>{hoveredChartItem.buy}$</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning-color)' }}>
                            <span>SELL:</span>
                            <strong>{hoveredChartItem.sell}$</strong>
                          </div>
                        </div>
                      )}

                      <div style={{ overflowX: 'auto', width: '100%', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: '2px', padding: '12px 12px 6px 12px' }}>
                        {(() => {
                          const peak = priceData.peakMax || 1;
                          const chartWidth = Math.max(540, priceData.items.length * 40 + 60);

                          return (
                            <svg width={chartWidth} height="130" style={{ overflow: 'visible' }}>
                              {/* Grid lines */}
                              <line x1="40" y1="15" x2={chartWidth - 20} y2="15" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                              <line x1="40" y1="55" x2={chartWidth - 20} y2="55" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                              <line x1="40" y1="95" x2={chartWidth - 20} y2="95" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />

                              {/* Y-axis Labels */}
                              <text x="32" y="18" fill="var(--text-secondary)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">{priceData.peakMax}</text>
                              <text x="32" y="58" fill="var(--text-secondary)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">{Math.round(priceData.peakMax / 2)}</text>
                              <text x="32" y="98" fill="var(--text-secondary)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">0</text>

                              {/* Bars & Interactive triggers */}
                              {priceData.items.map((item, idx) => {
                                const x = 50 + idx * 40;
                                const buyHeight = (item.max / peak) * 80;
                                const buyY = 95 - buyHeight;
                                const sellHeight = (item.min / peak) * 80;
                                const sellY = 95 - sellHeight;
                                const isHovered = hoveredChartItem && hoveredChartItem.idx === idx;

                                return (
                                  <g key={idx}>
                                    {/* Column background hover highlight */}
                                    {isHovered && (
                                      <rect x={x - 4} y="5" width="30" height="98" fill="rgba(149, 192, 149, 0.05)" rx="2" style={{ pointerEvents: 'none' }} />
                                    )}

                                    {/* Buy Price Bar */}
                                    <rect
                                      x={x}
                                      y={buyY}
                                      width="10"
                                      height={Math.max(1, buyHeight)}
                                      fill="var(--accent-glow)"
                                      rx="1.5"
                                      style={{ transition: 'opacity 0.15s', opacity: hoveredChartItem && !isHovered ? 0.35 : 1 }}
                                    />

                                    {/* Sell Price Bar */}
                                    <rect
                                      x={x + 12}
                                      y={sellY}
                                      width="10"
                                      height={Math.max(1, sellHeight)}
                                      fill="var(--warning-color)"
                                      rx="1.5"
                                      style={{ transition: 'opacity 0.15s', opacity: hoveredChartItem && !isHovered ? 0.35 : 1 }}
                                    />

                                    {/* X-axis Label */}
                                    <text x={x + 11} y="112" fill={isHovered ? "var(--text-glow)" : "var(--text-secondary)"} fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">
                                      {item.name.length > 8 ? `${item.name.substring(0, 6)}..` : item.name}
                                    </text>

                                    {/* Column Interactive Hover Trigger Area */}
                                    <rect
                                      x={x - 4}
                                      y="10"
                                      width="30"
                                      height="115"
                                      fill="transparent"
                                      style={{ cursor: 'pointer' }}
                                      onMouseEnter={(e) => {
                                        const triggerRect = e.currentTarget.getBoundingClientRect();
                                        const cardRect = e.currentTarget.closest('.economy-chart-card').getBoundingClientRect();
                                        setHoveredChartItem({
                                          idx,
                                          name: item.name,
                                          buy: item.max,
                                          sell: item.min,
                                          x: triggerRect.left - cardRect.left + triggerRect.width / 2,
                                          y: triggerRect.top - cardRect.top - 8
                                        });
                                      }}
                                      onMouseLeave={() => setHoveredChartItem(null)}
                                    />
                                  </g>
                                );
                              })}

                              {/* Axes */}
                              <line x1="40" y1="10" x2="40" y2="95" stroke="var(--border-color)" strokeWidth="1" />
                              <line x1="40" y1="95" x2={chartWidth - 10} y2="95" stroke="var(--border-color)" strokeWidth="1" />
                            </svg>
                          );
                        })()}
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
                            <SortableHeader field="ClassName"          label={t('econ_th_classname')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '28%' }} />
                            <SortableHeader field="MinPriceThreshold"  label={t('econ_th_minprice')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '11%', textAlign: 'center' }} />
                            <SortableHeader field="MaxPriceThreshold"  label={t('econ_th_maxprice')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '11%', textAlign: 'center' }} />
                            <SortableHeader field="MinStockThreshold"  label={t('econ_th_minstock')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '10%', textAlign: 'center' }} />
                            <SortableHeader field="MaxStockThreshold"  label={t('econ_th_maxstock')}  sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '10%', textAlign: 'center' }} />
                            <SortableHeader field="SellPricePercent"   label={t('econ_th_sellpct')}     sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ width: '10%', textAlign: 'center' }} />
                            <th style={{ width: '10%', textAlign: 'center' }}>{t('econ_th_actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.length === 0 ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
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
                                <tr key={item.originalIndex} style={{ background: isSelected ? 'rgba(149,192,149,0.06)' : 'transparent' }}>
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
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                      {/* B8: Copy button */}
                                      <button className="btn" onClick={() => handleCopyItem(item)} style={{ padding: '3px 6px', fontSize: '11px' }} title={t('econ_copy_item_tooltip')}>📋</button>
                                      <button className="btn btn-danger" onClick={() => handleRemoveItem(item.originalIndex)} style={{ padding: '3px 7px', fontSize: '11px', fontFamily: 'monospace' }}>×</button>
                                    </div>
                                  </td>
                                </tr>
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
                            return (
                              <tr key={idx}>
                                <td style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', color: 'var(--text-glow)' }}>{name}</td>
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
                              <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {classname}
                                {isItemMissing(classname) && <span title={t('econ_item_missing_trader_tooltip')} style={{ color: 'var(--warning-color)', cursor: 'help' }}>⚠️</span>}
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
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('econ_th_minprice')}</label>
                    <input 
                      type="number" 
                      value={defaultMinPrice} 
                      onChange={e => setDefaultMinPrice(Number(e.target.value))} 
                      style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('econ_th_maxprice')}</label>
                    <input 
                      type="number" 
                      value={defaultMaxPrice} 
                      onChange={e => setDefaultMaxPrice(Number(e.target.value))} 
                      style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('econ_th_sellpct')}</label>
                    <input 
                      type="number" 
                      value={defaultSellPercent} 
                      onChange={e => setDefaultSellPercent(Number(e.target.value))} 
                      style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('econ_th_minstock')}</label>
                    <input 
                      type="number" 
                      value={defaultMinStock} 
                      onChange={e => setDefaultMinStock(Number(e.target.value))} 
                      style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('econ_th_maxstock')}</label>
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
                {t('confirm_cancel') || "Cancel"}
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
    </div>
  );
}
