import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from '../utils/localization';
import AutocompleteInput from './shared/AutocompleteInput';
import HelpIcon from './HelpIcon';
import FormCard from './shared/FormCard';

const COMMON_BUILDINGS = [
  "Land_Barn_Brick1", "Land_Barn_Brick2", "Land_Barn_Wood1", "Land_Barn_Wood2",
  "Land_Mil_ATC_Big", "Land_Mil_ATC_Small", "Land_Mil_Barracks1", "Land_Mil_Barracks2",
  "Land_Mil_Barracks3", "Land_Mil_Barracks5", "Land_Mil_Guardhouse1", "Land_Mil_Guardhouse3",
  "Land_City_PoliceStation", "Land_Village_PoliceStation", "Land_City_Hospital",
  "Land_Village_HealthCare", "Land_Airfield_Hangar_Green", "Land_Workshop1", "Land_Workshop2",
  "Land_Garage_Big", "Land_Garage_Office", "Land_Garage_Row_Big", "Land_Garage_Small",
  "Land_Mil_AircraftShelter", "Land_Bunker1_Double", "Land_Mil_Tent_Big1_1", "Land_Mil_Tent_Big2_1"
];

const COMMON_PROXIES = [
  "static_fridge", "static_washing_machine", "static_matress_white_bent",
  "static_locker_closed_v1", "static_locker_closed_v2", "static_locker_closed_v3",
  "static_locker_open_v2", "static_locker_open_v3", "static_kitchen_unit_a_dz",
  "static_shelf", "static_shelf_1side", "static_skrin_bar", "static_kitchenstove_elec",
  "static_tent_gunrack", "static_lekarnicka", "static_medical_table", "static_wheel_cart_dz",
  "static_workbench_dz", "static_workbench", "static_tools_racking_dz", "static_table_umakart"
];

// ─── Preset building groups ─────────────────────────────────────────────────
const BUILDING_PRESETS = {
  Military: {
    label: { en: '🪖 Military', ru: '🪖 Военные' },
    buildings: [
      "Land_Mil_Barracks1", "Land_Mil_Barracks2", "Land_Mil_Barracks3", "Land_Mil_Barracks5",
      "Land_Mil_ATC_Big", "Land_Mil_ATC_Small", "Land_Mil_Guardhouse1", "Land_Mil_Guardhouse3",
      "Land_Mil_AircraftShelter", "Land_Bunker1_Double", "Land_Mil_Tent_Big1_1", "Land_Mil_Tent_Big2_1"
    ],
    proxies: ["static_tent_gunrack", "static_locker_closed_v1", "static_locker_closed_v2", "static_locker_closed_v3"],
  },
  Civilian: {
    label: { en: '🏘 Civilian', ru: '🏘 Гражданские' },
    buildings: [
      "Land_Barn_Brick1", "Land_Barn_Brick2", "Land_Barn_Wood1", "Land_Barn_Wood2"
    ],
    proxies: ["static_fridge", "static_washing_machine", "static_kitchen_unit_a_dz", "static_shelf"],
  },
  Medical: {
    label: { en: '🏥 Medical', ru: '🏥 Медицинские' },
    buildings: [
      "Land_City_Hospital", "Land_Village_HealthCare"
    ],
    proxies: ["static_lekarnicka", "static_medical_table"],
  },
  Industrial: {
    label: { en: '🏭 Industrial', ru: '🏭 Промышленные' },
    buildings: [
      "Land_Airfield_Hangar_Green", "Land_Workshop1", "Land_Workshop2",
      "Land_Garage_Big", "Land_Garage_Office", "Land_Garage_Row_Big", "Land_Garage_Small"
    ],
    proxies: ["static_workbench_dz", "static_workbench", "static_tools_racking_dz", "static_wheel_cart_dz"],
  },
  Police: {
    label: { en: '🚔 Police', ru: '🚔 Полиция' },
    buildings: [
      "Land_City_PoliceStation", "Land_Village_PoliceStation"
    ],
    proxies: ["static_locker_closed_v1", "static_skrin_bar"],
  },
};

// Helper components for SearchForLootEditor
function CategoryCard({
  title,
  onBulkClick,
  onCloneClick,
  onRenameClick,
  onDeleteClick,
  maxHeight = '420px',
  children,
  inputElement
}) {
  const { t, lang } = useTranslation();
  const actions = (
    <div style={{ display: 'flex', gap: '4px' }}>
      {onRenameClick && (
        <button className="btn" style={{ padding: '2px 8px', fontSize: '11px', background: 'rgba(255,255,255,0.05)' }} onClick={onRenameClick} title={lang === 'ru' ? 'Переименовать категорию' : 'Rename category'}>
          {lang === 'ru' ? 'Имя' : 'Rename'}
        </button>
      )}
      <button className="btn" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={onBulkClick}>{t('sfl_btn_bulk')}</button>
      {onCloneClick && (
        <button className="btn" style={{ padding: '2px 8px', fontSize: '11px', background: 'rgba(255,255,255,0.05)' }} onClick={onCloneClick}>
          {lang === 'ru' ? 'Клон' : 'Clone'}
        </button>
      )}
      <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={onDeleteClick}>{t('sfl_btn_delete')}</button>
    </div>
  );
  return (
    <FormCard
      title={title}
      headerActions={actions}
      bg="secondary"
      style={{ display: 'flex', flexDirection: 'column', maxHeight, padding: '16px' }}
      bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
    >
      {children}
      {inputElement}
    </FormCard>
  );
}

function ListItemRow({
  text,
  onRemove,
  isValid = true,
  tooltip = '',
  emptyPlaceholder = ''
}) {
  const displayValue = text || emptyPlaceholder;
  return (
    <div 
      style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', 
        background: 'var(--bg-primary)', 
        border: isValid ? '1px solid rgba(255,255,255,0.02)' : '1px solid var(--warning-color)', 
        borderRadius: '2px',
        boxShadow: isValid ? 'none' : '0 0 4px rgba(235, 214, 103, 0.1)'
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: text ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {!isValid && <span title={tooltip} style={{ cursor: 'help', color: 'var(--warning-color)' }}>⚠️</span>}
        {displayValue}
      </span>
      <button className="btn btn-danger" style={{ padding: '1px 6px', fontSize: '10px' }} onClick={onRemove}>×</button>
    </div>
  );
}

function LootItemRow({
  text,
  count,
  percentage,
  onIncrease,
  onDecrease,
  onRemoveAll,
  isValid = true,
  tooltip = ''
}) {
  const { lang } = useTranslation();
  return (
    <div 
      style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', 
        background: 'var(--bg-primary)', 
        border: isValid ? '1px solid rgba(255,255,255,0.02)' : '1px solid var(--warning-color)', 
        borderRadius: '2px',
        boxShadow: isValid ? 'none' : '0 0 4px rgba(235, 214, 103, 0.1)',
        gap: '8px'
      }}
    >
      <span style={{ 
        fontFamily: 'var(--font-mono)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', 
        color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 
      }} title={text}>
        {!isValid && <span title={tooltip} style={{ cursor: 'help', color: 'var(--warning-color)' }}>⚠️</span>}
        {text}
      </span>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Probability percentage */}
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', minWidth: '32px', textAlign: 'right' }}>
          {percentage}%
        </span>
        
        {/* Count Adjusters */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
          <button 
            className="btn" 
            style={{ padding: '0 6px', fontSize: '10px', border: 'none', background: 'none', borderRadius: 0, height: '18px', display: 'flex', alignItems: 'center', minWidth: '16px', justifyContent: 'center' }} 
            onClick={e => { e.stopPropagation(); onDecrease(); }}
            title={count === 1 ? (lang === 'ru' ? 'Удалить предмет' : 'Remove item') : (lang === 'ru' ? 'Уменьшить вес' : 'Decrease weight')}
          >
            -
          </button>
          <span style={{ padding: '0 4px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-glow)', minWidth: '16px', textAlign: 'center' }}>
            {count}
          </span>
          <button 
            className="btn" 
            style={{ padding: '0 6px', fontSize: '10px', border: 'none', background: 'none', borderRadius: 0, height: '18px', display: 'flex', alignItems: 'center', minWidth: '16px', justifyContent: 'center' }} 
            onClick={e => { e.stopPropagation(); onIncrease(); }}
            title={lang === 'ru' ? 'Увеличить вес' : 'Increase weight'}
          >
            +
          </button>
        </div>

        {/* Delete All copies */}
        <button 
          className="btn btn-danger" 
          style={{ padding: '1px 6px', fontSize: '10px', height: '18px', display: 'flex', alignItems: 'center' }} 
          onClick={e => { e.stopPropagation(); onRemoveAll(); }}
          title={lang === 'ru' ? 'Удалить все копии' : 'Remove all copies'}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function SearchForLootEditor({
  configs,
  onChangeField,
  xmlItems = []
}) {
  const { t, lang } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('map');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Search / filter states for lists
  const [buildingSearch, setBuildingSearch] = useState('');
  const [lootSearch, setLootSearch] = useState('');
  const [proxySearch, setProxySearch] = useState('');
  const [mapSearch, setMapSearch] = useState('');

  // Bulk add states
  const [bulkText, setBulkText] = useState('');
  const [activeBulk, setActiveBulk] = useState(null); // { type: 'building'|'loot'|'proxy', index: number }
  const [showHelp, setShowHelp] = useState({ buildings: false, loot: false, proxies: false });

  // Map view states
  const [mapExpanded, setMapExpanded] = useState(new Set());
  const [renameModal, setRenameModal] = useState(null);
  const [showDupes, setShowDupes] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [balanceSearch, setBalanceSearch] = useState('');
  const [balanceSort, setBalanceSort] = useState('score_desc');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wBldName, setWBldName] = useState('');
  const [wBldList, setWBldList] = useState(['']);
  const [wPrxName, setWPrxName] = useState('');
  const [wPrxList, setWPrxList] = useState([]);
  const [wLootList, setWLootList] = useState([]);
  const [wLootRarity, setWLootRarity] = useState(50);
  const [wPresetKey, setWPresetKey] = useState('Military');
  const [presetModal, setPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetKey, setPresetKey] = useState('Military');
  const presetNameRef = useRef(null);
  const [relationCreatorModal, setRelationCreatorModal] = useState(false);
  const [newRelationBld, setNewRelationBld] = useState('');
  const [newRelationProxy, setNewRelationProxy] = useState('');
  // Info popover
  const [popover, setPopover] = useState(null); // { x, y, content: ReactNode }
  const openPopover = (e, content) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ x: rect.left, y: rect.bottom + 8, content });
  };
  const closePopover = () => setPopover(null);
  const toggleMapRow = (name) => setMapExpanded(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  // Find all SearchForLoot configs
  const sflPaths = useMemo(() => {
    return Object.keys(configs).filter(p => p.toLowerCase().includes('searchforloot/'));
  }, [configs]);

  // Auto-select first config path if not selected
  React.useEffect(() => {
    if (sflPaths.length > 0 && !selectedFile) {
      setSelectedFile(sflPaths[0]);
    }
  }, [sflPaths, selectedFile]);

  // Map xmlItems to flat array of names for autocomplete
  const xmlSuggestions = useMemo(() => {
    return xmlItems.map(x => x.name || x.Name);
  }, [xmlItems]);

  const xmlSuggestionsSet = useMemo(() => {
    return new Set(xmlSuggestions.map(s => s.toLowerCase()));
  }, [xmlSuggestions]);

  // ── SFL stats & duplicates (computed live from content) ──────────────────
  const sflStats = useMemo(() => {
    const currentPath2 = selectedFile || (sflPaths.length > 0 ? sflPaths[0] : null);
    const fileData2 = currentPath2 ? configs[currentPath2] : null;
    const c = fileData2?.success ? (fileData2.content || {}) : null;
    if (!c) return null;
    const buildings  = c.SFLBuildings     || [];
    const lootCats   = c.SFLLootCategory  || [];
    const proxyCats  = c.SFLProxyCategory || [];
    const totalBldgs = buildings.reduce((s, cat) => s + cat.buildings.filter(b => b).length, 0);
    const totalItems = lootCats.reduce((s, cat) => s + cat.loot.length, 0);
    const totalProxy = proxyCats.reduce((s, cat) => s + cat.proxies.length, 0);
    const validatedItems = xmlSuggestionsSet.size === 0 ? totalItems :
      lootCats.reduce((s, cat) => s + cat.loot.filter(i => xmlSuggestionsSet.has(i.toLowerCase())).length, 0);

    let orphanCount = 0;
    buildings.forEach(b => {
      proxyCats.forEach(p => {
        const expectedLootName = `${b.name}_${p.name}`;
        const hasLoot = lootCats.some(l => l.name.toLowerCase() === expectedLootName.toLowerCase());
        if (!hasLoot) orphanCount++;
      });
    });

    const avgRarity = lootCats.length > 0
      ? Math.round(lootCats.reduce((s, cat) => s + (cat.rarity ?? 50), 0) / lootCats.length)
      : 0;
    const itemMap = {};
    lootCats.forEach(cat => {
      cat.loot.forEach(item => {
        const key = item.toLowerCase();
        if (!itemMap[key]) itemMap[key] = [];
        itemMap[key].push(cat.name);
      });
    });
    const dupes = Object.entries(itemMap)
      .filter(([, cats]) => cats.length > 1)
      .map(([item, cats]) => ({ item, cats }));

    const relationIds = new Set();
    buildings.forEach(b => {
      proxyCats.forEach(p => {
        relationIds.add(`${b.name}::${p.name}`);
      });
    });
    lootCats.forEach(l => {
      const underscoreIdx = l.name.indexOf('_');
      if (underscoreIdx > 0) {
        const bName = l.name.substring(0, underscoreIdx);
        const pName = l.name.substring(underscoreIdx + 1);
        relationIds.add(`${bName}::${pName}`);
      } else {
        relationIds.add(`loot::${l.name}`);
      }
    });
    if (proxyCats.length === 0) {
      buildings.forEach(b => relationIds.add(`bld::${b.name}`));
    }
    if (buildings.length === 0) {
      proxyCats.forEach(p => relationIds.add(`prxy::${p.name}`));
    }

    return { totalBldgs, totalItems, totalProxy, validatedItems, orphanCount, avgRarity, dupes, groupCount: relationIds.size };
  }, [configs, selectedFile, sflPaths, xmlSuggestionsSet]);

  const lootBalance = useMemo(() => {
    const currentPath2 = selectedFile || (sflPaths.length > 0 ? sflPaths[0] : null);
    const fileData2 = currentPath2 ? configs[currentPath2] : null;
    const c = fileData2?.success ? (fileData2.content || {}) : null;
    if (!c) return [];
    
    const lootCats = c.SFLLootCategory || [];
    const itemsMap = {};
    
    lootCats.forEach(cat => {
      const rarity = cat.rarity ?? 50.0;
      const totalItems = cat.loot.length;
      if (totalItems === 0) return;
      
      const counts = {};
      cat.loot.forEach(i => counts[i] = (counts[i] || 0) + 1);
      
      Object.entries(counts).forEach(([item, count]) => {
        const itemWeightPct = (count / totalItems) * 100;
        const scoreContribution = rarity * (count / totalItems);
        
        const key = item.toLowerCase();
        if (!itemsMap[key]) {
          itemsMap[key] = {
            item,
            totalScore: 0,
            occurrences: []
          };
        }
        
        itemsMap[key].occurrences.push({
          categoryName: cat.name,
          count,
          rarity,
          itemWeight: itemWeightPct
        });
        itemsMap[key].totalScore += scoreContribution;
      });
    });
    
    return Object.values(itemsMap);
  }, [configs, selectedFile, sflPaths]);

  if (sflPaths.length === 0) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        <span>{t('sfl_no_configs')}</span>
      </div>
    );
  }

  const currentPath = selectedFile || sflPaths[0];
  const fileData = configs[currentPath];

  if (!fileData || !fileData.success) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--danger-color)', flexDirection: 'column' }}>
        <h3>Error loading config</h3>
        <p>{fileData?.error || 'Unknown syntax error'}</p>
      </div>
    );
  }

  const content = fileData.content || {};

  // Helpers for change triggers
  const handleGeneralChange = (field, val) => {
    onChangeField(currentPath, [field], val);
  };

  // Bulk Import Submit
  const handleBulkSubmit = () => {
    if (!activeBulk || !bulkText.trim()) {
      setActiveBulk(null);
      setBulkText('');
      return;
    }

    const newItems = bulkText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (newItems.length === 0) {
      setActiveBulk(null);
      setBulkText('');
      return;
    }

    const { type, index } = activeBulk;

    if (type === 'building') {
      const currentList = content.SFLBuildings[index]?.buildings || [];
      const filteredList = currentList.filter(s => s !== "");
      const combined = [...new Set([...filteredList, ...newItems])];
      onChangeField(currentPath, ['SFLBuildings', index, 'buildings'], combined);
    } else if (type === 'loot') {
      const currentList = content.SFLLootCategory[index]?.loot || [];
      const combined = [...new Set([...currentList, ...newItems])];
      onChangeField(currentPath, ['SFLLootCategory', index, 'loot'], combined);
    } else if (type === 'proxy') {
      const currentList = content.SFLProxyCategory[index]?.proxies || [];
      const combined = [...new Set([...currentList, ...newItems])];
      onChangeField(currentPath, ['SFLProxyCategory', index, 'proxies'], combined);
    }

    setActiveBulk(null);
    setBulkText('');
  };

  // ────────────────── SFLBuildings Operations ──────────────────
  const sflBuildings = content.SFLBuildings || [];

  const handleAddBuildingCategory = () => {
    // Open preset wizard instead of plain prompt
    setPresetName('');
    setPresetKey('Military');
    setPresetModal(true);
    setTimeout(() => presetNameRef.current?.focus(), 80);
  };

  const handlePresetSubmit = (usePreset) => {
    const catName = presetName.trim();
    if (!catName) { setPresetModal(false); return; }
    let buildings = [''];
    let proxies = [];
    if (usePreset && BUILDING_PRESETS[presetKey]) {
      buildings = BUILDING_PRESETS[presetKey].buildings;
      proxies = BUILDING_PRESETS[presetKey].proxies;
    }
    const updated = [...sflBuildings, { name: catName, buildings }];
    onChangeField(currentPath, ['SFLBuildings'], updated);
    // Auto-create matching proxy category if preset selected
    if (usePreset && proxies.length > 0) {
      const sflProxyCurrent = content.SFLProxyCategory || [];
      if (!sflProxyCurrent.some(p => p.name === catName)) {
        onChangeField(currentPath, ['SFLProxyCategory'], [...sflProxyCurrent, { name: catName, proxies }]);
      }
    }
    setPresetModal(false);
  };

  const _handleAddBuildingCategory_unused = () => {
    const catName = prompt(lang === 'ru' ? 'Введите имя новой категории зданий:' : 'Enter new building category name:');
    if (catName && catName.trim()) {
      const updated = [...sflBuildings, { name: catName.trim(), buildings: [""] }];
      onChangeField(currentPath, ['SFLBuildings'], updated);
    }
  }; // end unused

  const handleRemoveBuildingCategory = (index) => {
    if (confirm(lang === 'ru' ? 'Вы уверены, что хотите удалить эту категорию?' : 'Are you sure you want to delete this category?')) {
      onChangeField(currentPath, ['SFLBuildings', index], null);
    }
  };

  const handleAddBuildingToCategory = (catIdx, buildingClassname) => {
    if (!buildingClassname.trim()) return;
    const currentList = sflBuildings[catIdx]?.buildings || [];
    let newList;
    if (currentList.length === 1 && currentList[0] === "") {
      newList = [buildingClassname.trim()];
    } else {
      if (currentList.includes(buildingClassname.trim())) return;
      newList = [...currentList, buildingClassname.trim()];
    }
    onChangeField(currentPath, ['SFLBuildings', catIdx, 'buildings'], newList);
  };

  const handleRemoveBuildingFromCategory = (catIdx, bldIdx) => {
    const currentList = sflBuildings[catIdx]?.buildings || [];
    let newList = currentList.filter((_, idx) => idx !== bldIdx);
    if (newList.length === 0) {
      newList.push("");
    }
    onChangeField(currentPath, ['SFLBuildings', catIdx, 'buildings'], newList);
  };

  // ────────────────── SFLLootCategory Operations ──────────────────
  const sflLootCats = content.SFLLootCategory || [];

  const handleAddLootCategory = () => {
    const catName = prompt(lang === 'ru' ? 'Введите имя новой категории лута:' : 'Enter new loot category name:');
    if (catName && catName.trim()) {
      const updated = [...sflLootCats, { name: catName.trim(), rarity: 50.0, loot: [] }];
      onChangeField(currentPath, ['SFLLootCategory'], updated);
    }
  };

  const handleRemoveLootCategory = (index) => {
    if (confirm(lang === 'ru' ? 'Вы уверены, что хотите удалить эту категорию лута?' : 'Are you sure you want to delete this loot category?')) {
      onChangeField(currentPath, ['SFLLootCategory', index], null);
    }
  };

  const handleAddLootItem = (catIdx, itemClassname) => {
    if (!itemClassname.trim()) return;
    const currentList = sflLootCats[catIdx]?.loot || [];
    const newList = [...currentList, itemClassname.trim()];
    onChangeField(currentPath, ['SFLLootCategory', catIdx, 'loot'], newList);
  };

  const handleRemoveLootItem = (catIdx, itemIdx) => {
    const currentList = sflLootCats[catIdx]?.loot || [];
    const newList = currentList.filter((_, idx) => idx !== itemIdx);
    onChangeField(currentPath, ['SFLLootCategory', catIdx, 'loot'], newList);
  };

  const handleCloneBuildingCategory = (index) => {
    const original = sflBuildings[index];
    if (!original) return;
    const newName = prompt(
      lang === 'ru' ? 'Введите имя для скопированной категории зданий:' : 'Enter name for the cloned building category:',
      `${original.name}_Copy`
    );
    if (newName && newName.trim()) {
      const trimmed = newName.trim();
      if (sflBuildings.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
        alert(lang === 'ru' ? 'Категория с таким именем уже существует!' : 'A category with this name already exists!');
        return;
      }
      const cloned = { name: trimmed, buildings: [...original.buildings] };
      onChangeField(currentPath, ['SFLBuildings'], [...sflBuildings, cloned]);
    }
  };

  const handleCloneProxyCategory = (index) => {
    const original = sflProxies[index];
    if (!original) return;
    const newName = prompt(
      lang === 'ru' ? 'Введите имя для скопированной категории прокси:' : 'Enter name for the cloned proxy category:',
      `${original.name}_Copy`
    );
    if (newName && newName.trim()) {
      const trimmed = newName.trim();
      if (sflProxies.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
        alert(lang === 'ru' ? 'Категория с таким именем уже существует!' : 'A category with this name already exists!');
        return;
      }
      const cloned = { name: trimmed, proxies: [...original.proxies] };
      onChangeField(currentPath, ['SFLProxyCategory'], [...sflProxies, cloned]);
    }
  };

  const handleCloneLootCategory = (index) => {
    const original = sflLootCats[index];
    if (!original) return;
    const newName = prompt(
      lang === 'ru' ? 'Введите имя для скопированной категории лута:' : 'Enter name for the cloned loot category:',
      `${original.name}_Copy`
    );
    if (newName && newName.trim()) {
      const trimmed = newName.trim();
      if (sflLootCats.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
        alert(lang === 'ru' ? 'Категория с таким именем уже существует!' : 'A category with this name already exists!');
        return;
      }
      const cloned = {
        name: trimmed,
        rarity: original.rarity ?? 50.0,
        loot: [...original.loot]
      };
      onChangeField(currentPath, ['SFLLootCategory'], [...sflLootCats, cloned]);
    }
  };

  const handleIncreaseLootWeight = (catIdx, itemName) => {
    const currentList = sflLootCats[catIdx]?.loot || [];
    const newList = [...currentList, itemName];
    onChangeField(currentPath, ['SFLLootCategory', catIdx, 'loot'], newList);
  };

  const handleDecreaseLootWeight = (catIdx, itemName) => {
    const currentList = sflLootCats[catIdx]?.loot || [];
    const indexToRemove = currentList.indexOf(itemName);
    if (indexToRemove !== -1) {
      const newList = currentList.filter((_, idx) => idx !== indexToRemove);
      onChangeField(currentPath, ['SFLLootCategory', catIdx, 'loot'], newList);
    }
  };

  const handleRemoveAllLootCopies = (catIdx, itemName) => {
    const currentList = sflLootCats[catIdx]?.loot || [];
    const newList = currentList.filter(item => item !== itemName);
    onChangeField(currentPath, ['SFLLootCategory', catIdx, 'loot'], newList);
  };

  const handleRemoveDeadLoot = () => {
    if (xmlSuggestionsSet.size === 0) return;
    if (!confirm(lang === 'ru' ? 'Вы уверены, что хотите удалить все предметы лута, которых нет в types.xml?' : 'Are you sure you want to remove all loot items that are missing from types.xml?')) {
      return;
    }
    const updatedLootCats = sflLootCats.map(cat => ({
      ...cat,
      loot: cat.loot.filter(item => xmlSuggestionsSet.has(item.toLowerCase()))
    }));
    onChangeField(currentPath, ['SFLLootCategory'], updatedLootCats);
  };

  const handleRenameCategory = (type, index) => {
    let oldName = "";
    let list = [];
    if (type === 'building') {
      oldName = sflBuildings[index]?.name;
      list = sflBuildings;
    } else if (type === 'proxy') {
      oldName = sflProxies[index]?.name;
      list = sflProxies;
    } else if (type === 'loot') {
      oldName = sflLootCats[index]?.name;
      list = sflLootCats;
    }
    if (!oldName) return;

    const newName = prompt(
      lang === 'ru' 
        ? `Введите новое имя для категории "${oldName}":` 
        : `Enter new name for category "${oldName}":`, 
      oldName
    );
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();

    // Check if name already exists
    if (list.some((c, idx) => idx !== index && c.name.toLowerCase() === trimmed.toLowerCase())) {
      alert(lang === 'ru' ? 'Категория с таким именем уже существует!' : 'A category with this name already exists!');
      return;
    }

    if (type === 'building') {
      const updatedBld = sflBuildings.map((c, idx) => idx === index ? { ...c, name: trimmed } : c);
      let updatedPrx = [...sflProxies];
      const prxIdx = sflProxies.findIndex(c => c.name.toLowerCase() === oldName.toLowerCase());
      if (prxIdx !== -1) {
        updatedPrx = sflProxies.map((c, idx) => idx === prxIdx ? { ...c, name: trimmed } : c);
      }
      const updatedLoot = sflLootCats.map(c => {
        if (c.name.toLowerCase().startsWith(oldName.toLowerCase() + "_")) {
          const rest = c.name.substring(oldName.length);
          return { ...c, name: trimmed + rest };
        }
        if (c.name.toLowerCase() === oldName.toLowerCase()) {
          return { ...c, name: trimmed };
        }
        return c;
      });
      onChangeField(currentPath, ['SFLBuildings'], updatedBld);
      if (prxIdx !== -1) {
        onChangeField(currentPath, ['SFLProxyCategory'], updatedPrx);
      }
      onChangeField(currentPath, ['SFLLootCategory'], updatedLoot);
    } else if (type === 'proxy') {
      const updatedPrx = sflProxies.map((c, idx) => idx === index ? { ...c, name: trimmed } : c);
      let updatedBld = [...sflBuildings];
      const bldIdx = sflBuildings.findIndex(c => c.name.toLowerCase() === oldName.toLowerCase());
      if (bldIdx !== -1) {
        updatedBld = sflBuildings.map((c, idx) => idx === bldIdx ? { ...c, name: trimmed } : c);
      }
      const updatedLoot = sflLootCats.map(c => {
        if (c.name.toLowerCase().endsWith("_" + oldName.toLowerCase())) {
          const start = c.name.substring(0, c.name.length - oldName.length);
          return { ...c, name: start + trimmed };
        }
        if (c.name.toLowerCase() === oldName.toLowerCase()) {
          return { ...c, name: trimmed };
        }
        return c;
      });
      onChangeField(currentPath, ['SFLProxyCategory'], updatedPrx);
      if (bldIdx !== -1) {
        onChangeField(currentPath, ['SFLBuildings'], updatedBld);
      }
      onChangeField(currentPath, ['SFLLootCategory'], updatedLoot);
    } else if (type === 'loot') {
      const updatedLoot = sflLootCats.map((c, idx) => idx === index ? { ...c, name: trimmed } : c);
      onChangeField(currentPath, ['SFLLootCategory'], updatedLoot);
    }
  };

  const handleAutoCleanup = () => {
    const activeBldNames = new Set();
    const activePrxNames = new Set();
    const activeLootNames = new Set();

    sflBuildings.forEach(b => {
      sflProxies.forEach(p => {
        const expectedLootName = `${b.name}_${p.name}`;
        const loot = sflLootCats.find(l => l.name.toLowerCase() === expectedLootName.toLowerCase());
        if (loot) {
          activeBldNames.add(b.name.toLowerCase());
          activePrxNames.add(p.name.toLowerCase());
          activeLootNames.add(loot.name.toLowerCase());
        }
      });
    });

    const emptyBld = sflBuildings.filter(b => b.buildings.filter(x => x.trim()).length === 0);
    const emptyPrx = sflProxies.filter(p => p.proxies.filter(x => x.trim()).length === 0);
    const emptyLoot = sflLootCats.filter(l => l.loot.length === 0);

    const unconnectedBld = sflBuildings.filter(b => !activeBldNames.has(b.name.toLowerCase()));
    const unconnectedPrx = sflProxies.filter(p => !activePrxNames.has(p.name.toLowerCase()));
    const unconnectedLoot = sflLootCats.filter(l => !activeLootNames.has(l.name.toLowerCase()));

    const totalEmpty = emptyBld.length + emptyPrx.length + emptyLoot.length;
    const totalUnconnected = unconnectedBld.length + unconnectedPrx.length + unconnectedLoot.length;

    if (totalEmpty === 0 && totalUnconnected === 0) {
      alert(lang === 'ru' ? 'Конфигурация уже чиста! Пустых или лишних категорий не обнаружено.' : 'Configuration is already clean! No empty or unconnected categories found.');
      return;
    }

    const msg = lang === 'ru'
      ? `Найдено:\n- Пустых категорий: ${totalEmpty}\n- Несвязанных категорий (без активных связей в схеме): ${totalUnconnected}\n\nОчистить конфигурацию от этих элементов?`
      : `Found:\n- Empty categories: ${totalEmpty}\n- Unconnected categories (no active mapping in schema): ${totalUnconnected}\n\nClean up configuration from these elements?`;

    if (confirm(msg)) {
      const nextBld = sflBuildings.filter(b => b.buildings.filter(x => x.trim()).length > 0 && activeBldNames.has(b.name.toLowerCase()));
      const nextPrx = sflProxies.filter(p => p.proxies.filter(x => x.trim()).length > 0 && activePrxNames.has(p.name.toLowerCase()));
      const nextLoot = sflLootCats.filter(l => l.loot.length > 0 && activeLootNames.has(l.name.toLowerCase()));

      onChangeField(currentPath, ['SFLBuildings'], nextBld);
      onChangeField(currentPath, ['SFLProxyCategory'], nextPrx);
      onChangeField(currentPath, ['SFLLootCategory'], nextLoot);
    }
  };

  const handleWizardPresetSelect = (key) => {
    setWPresetKey(key);
    if (key === 'empty') {
      setWBldName('');
      setWBldList(['']);
      setWPrxName('');
      setWPrxList([]);
      return;
    }
    const preset = BUILDING_PRESETS[key];
    if (preset) {
      setWBldName(key);
      setWBldList(preset.buildings);
      setWPrxName(key);
      setWPrxList(preset.proxies);
    }
  };

  const handleWizardGenerate = () => {
    if (!wBldName.trim() || !wPrxName.trim()) return;
    
    const bldNameTrim = wBldName.trim();
    const prxNameTrim = wPrxName.trim();
    const lootNameTrim = `${bldNameTrim}_${prxNameTrim}`;
    
    const cleanedBldList = wBldList.map(s => s.trim()).filter(s => s);
    const cleanedPrxList = wPrxList.map(s => s.trim()).filter(s => s);
    const cleanedLootList = wLootList.map(s => s.trim()).filter(s => s);
    
    // 1. Update SFLBuildings
    let nextBuildings = [...sflBuildings];
    const bIdx = nextBuildings.findIndex(b => b.name.toLowerCase() === bldNameTrim.toLowerCase());
    if (bIdx !== -1) {
      const existing = nextBuildings[bIdx].buildings || [];
      nextBuildings[bIdx] = {
        ...nextBuildings[bIdx],
        name: bldNameTrim,
        buildings: [...new Set([...existing, ...cleanedBldList])].filter(s => s)
      };
    } else {
      nextBuildings.push({ name: bldNameTrim, buildings: cleanedBldList.length > 0 ? cleanedBldList : [""] });
    }
    
    // 2. Update SFLProxyCategory
    let nextProxies = [...sflProxies];
    const pIdx = nextProxies.findIndex(p => p.name.toLowerCase() === prxNameTrim.toLowerCase());
    if (pIdx !== -1) {
      const existing = nextProxies[pIdx].proxies || [];
      nextProxies[pIdx] = {
        ...nextProxies[pIdx],
        name: prxNameTrim,
        proxies: [...new Set([...existing, ...cleanedPrxList])]
      };
    } else {
      nextProxies.push({ name: prxNameTrim, proxies: cleanedPrxList });
    }
    
    // 3. Update SFLLootCategory
    let nextLootCats = [...sflLootCats];
    const lIdx = nextLootCats.findIndex(l => l.name.toLowerCase() === lootNameTrim.toLowerCase());
    if (lIdx !== -1) {
      const existing = nextLootCats[lIdx].loot || [];
      nextLootCats[lIdx] = {
        ...nextLootCats[lIdx],
        name: lootNameTrim,
        rarity: wLootRarity,
        loot: [...existing, ...cleanedLootList]
      };
    } else {
      nextLootCats.push({
        name: lootNameTrim,
        rarity: wLootRarity,
        loot: cleanedLootList
      });
    }
    
    onChangeField(currentPath, ['SFLBuildings'], nextBuildings);
    onChangeField(currentPath, ['SFLProxyCategory'], nextProxies);
    onChangeField(currentPath, ['SFLLootCategory'], nextLootCats);
    
    setShowWizard(false);
    setWizardStep(1);
    setWBldName('');
    setWBldList(['']);
    setWPrxName('');
    setWPrxList([]);
    setWLootList([]);
    setWLootRarity(50);
  };

  // ────────────────── SFLProxyCategory Operations ──────────────────
  const sflProxies = content.SFLProxyCategory || [];

  const handleAddProxyCategory = () => {
    const catName = prompt(lang === 'ru' ? 'Введите имя новой категории прокси:' : 'Enter new proxy category name:');
    if (catName && catName.trim()) {
      const updated = [...sflProxies, { name: catName.trim(), proxies: [] }];
      onChangeField(currentPath, ['SFLProxyCategory'], updated);
    }
  };

  const handleRemoveProxyCategory = (index) => {
    if (confirm(lang === 'ru' ? 'Вы уверены, что хотите удалить эту категорию прокси?' : 'Are you sure you want to delete this proxy category?')) {
      onChangeField(currentPath, ['SFLProxyCategory', index], null);
    }
  };

  const handleAddProxyToCategory = (catIdx, proxyClassname) => {
    if (!proxyClassname.trim()) return;
    const currentList = sflProxies[catIdx]?.proxies || [];
    if (currentList.includes(proxyClassname.trim())) return;
    const newList = [...currentList, proxyClassname.trim()];
    onChangeField(currentPath, ['SFLProxyCategory', catIdx, 'proxies'], newList);
  };

  const handleRemoveProxyFromCategory = (catIdx, prxIdx) => {
    const currentList = sflProxies[catIdx]?.proxies || [];
    const newList = currentList.filter((_, idx) => idx !== prxIdx);
    onChangeField(currentPath, ['SFLProxyCategory', catIdx, 'proxies'], newList);
  };

  const dynamicBuildings = useMemo(() => {
    const currentBldgs = sflBuildings.flatMap(c => c.buildings || []).filter(b => b && b.trim());
    return [...new Set([...COMMON_BUILDINGS, ...currentBldgs])];
  }, [sflBuildings]);

  const dynamicProxies = useMemo(() => {
    const currentProxies = sflProxies.flatMap(c => c.proxies || []).filter(p => p && p.trim());
    return [...new Set([...COMMON_PROXIES, ...currentProxies])];
  }, [sflProxies]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Native datalists for buildings and proxies autocomplete */}
      <datalist id="common-buildings">
        {dynamicBuildings.map(b => <option key={b} value={b} />)}
      </datalist>
      <datalist id="common-proxies">
        {dynamicProxies.map(p => <option key={p} value={p} />)}
      </datalist>

      {/* ── Info Popover ─────────────────────────────────────── */}
      {popover && (
        <div
          onClick={closePopover}
          style={{ position: 'fixed', inset: 0, zIndex: 99997 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: Math.min(popover.x, window.innerWidth - 320),
              top: popover.y,
              width: '300px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glow)',
              borderRadius: '4px',
              padding: '14px 16px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
              zIndex: 99998,
              animation: 'toastIn 0.15s ease',
            }}
          >
            {popover.content}
            <button
              onClick={closePopover}
              style={{ position: 'absolute', top: '8px', right: '10px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
            >×</button>
          </div>
        </div>
      )}

      {/* ── Preset Wizard Modal ──────────────────────────────── */}
      {presetModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div style={{ width: '500px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glow)', borderRadius: '4px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', marginBottom: '6px' }}>// NEW_BUILDING_CATEGORY</div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>
              {lang === 'ru' ? 'Новая категория зданий' : 'New Building Category'}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
              {lang === 'ru' ? 'Начните с шаблона или создайте пустую категорию.' : 'Start from a preset template or create an empty category.'}
            </p>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              {lang === 'ru' ? 'Имя категории *' : 'Category name *'}
            </label>
            <input
              ref={presetNameRef}
              type="text"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePresetSubmit(true); if (e.key === 'Escape') setPresetModal(false); }}
              placeholder={lang === 'ru' ? 'Например: Military, Civilian...' : 'e.g. Military, Civilian...'}
              style={{ width: '100%', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}
            />
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>
              {lang === 'ru' ? 'Шаблон (опционально)' : 'Template (optional)'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
              {Object.entries(BUILDING_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setPresetKey(key)}
                  style={{
                    padding: '10px 12px', textAlign: 'left', borderRadius: '3px', cursor: 'pointer',
                    border: presetKey === key ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    background: presetKey === key ? 'rgba(149,192,149,0.12)' : 'var(--bg-primary)',
                    color: presetKey === key ? 'var(--text-glow)' : 'var(--text-secondary)',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{preset.label[lang] || preset.label.en}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                    🏠 {preset.buildings.length} · 🔧 {preset.proxies.length}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setPresetModal(false)}>{lang === 'ru' ? 'Отмена' : 'Cancel'}</button>
              <button className="btn" onClick={() => handlePresetSubmit(false)} style={{ opacity: 0.7 }}>
                {lang === 'ru' ? 'Пустая' : 'Empty'}
              </button>
              <button className="btn btn-accent" disabled={!presetName.trim()} onClick={() => handlePresetSubmit(true)}>
                {lang === 'ru' ? `+ Создать из шаблона` : `+ Create from preset`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Duplicates Modal ─────────────────────────────────── */}
      {showDupes && sflStats && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div style={{ width: '560px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--border-glow)', borderRadius: '4px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', marginBottom: '6px' }}>// DUPLICATE_CHECKER</div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>
              {lang === 'ru' ? 'Дубликаты предметов' : 'Duplicate Items'}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              {lang === 'ru'
                ? 'Предметы, встречающиеся в нескольких лут-категориях одновременно.'
                : 'Items that appear in more than one loot category simultaneously.'}
            </p>
            {sflStats.dupes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--accent-color)', fontSize: '14px' }}>
                ✅ {lang === 'ru' ? 'Дубликатов не найдено!' : 'No duplicates found!'}
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {sflStats.dupes.map(({ item, cats }) => (
                  <div key={item} style={{ padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '3px', borderLeft: '3px solid var(--warning-color)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--warning-color)', marginBottom: '4px' }}>⚠️ {item}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {lang === 'ru' ? 'В категориях: ' : 'In categories: '}
                      {cats.map((c, i) => <span key={i} style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{i > 0 ? ', ' : ''}{c}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-accent" onClick={() => setShowDupes(false)}>{lang === 'ru' ? 'Закрыть' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loot Balance Inspector Modal ──────────────────────── */}
      {showBalance && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div style={{ width: '720px', height: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--border-glow)', borderRadius: '4px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', marginBottom: '6px' }}>// LOOT_BALANCE_INSPECTOR</div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>
              {lang === 'ru' ? 'Анализатор Баланса Лута' : 'Loot Balance Inspector'}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              {lang === 'ru'
                ? 'Абсолютный шанс выбора предмета при успешном поиске (редкость категории × вес предмета в категории).'
                : 'Absolute spawn probability of items on successful search (category rarity × item weight contribution).'}
            </p>
            
            {/* Search and Sort controls */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder={lang === 'ru' ? 'Поиск предмета...' : 'Search item...'}
                value={balanceSearch}
                onChange={e => setBalanceSearch(e.target.value)}
                style={{ flex: 1, minWidth: '180px' }}
              />
              <select
                value={balanceSort}
                onChange={e => setBalanceSort(e.target.value)}
                style={{ width: '220px' }}
              >
                <option value="score_desc">{lang === 'ru' ? 'По убыванию шанса' : 'Chance: High to Low'}</option>
                <option value="score_asc">{lang === 'ru' ? 'По возрастанию шанса' : 'Chance: Low to High'}</option>
                <option value="name_asc">{lang === 'ru' ? 'По алфавиту А-Я' : 'Name: A-Z'}</option>
                <option value="name_desc">{lang === 'ru' ? 'По алфавиту Я-А' : 'Name: Z-A'}</option>
              </select>
            </div>

            {/* List Table */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '3px', background: 'var(--bg-primary)' }}>
              {(() => {
                let filtered = lootBalance;
                if (balanceSearch.trim()) {
                  const q = balanceSearch.toLowerCase();
                  filtered = filtered.filter(row => row.item.toLowerCase().includes(q));
                }
                
                // Sort
                filtered = [...filtered].sort((a, b) => {
                  if (balanceSort === 'score_desc') return b.totalScore - a.totalScore;
                  if (balanceSort === 'score_asc') return a.totalScore - b.totalScore;
                  if (balanceSort === 'name_asc') return a.item.localeCompare(b.item);
                  if (balanceSort === 'name_desc') return b.item.localeCompare(a.item);
                  return 0;
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      {lang === 'ru' ? 'Предметы не найдены' : 'No items found'}
                    </div>
                  );
                }

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Предмет' : 'Item'}</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Категории и вклад в шанс' : 'Categories & Weight Contribution'}</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>{lang === 'ru' ? 'Абс. шанс' : 'Abs. Chance'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(row => (
                        <tr key={row.item} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                            {row.item}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {row.occurrences.map((occ, oIdx) => (
                                <div key={oIdx} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  <span style={{ color: 'var(--text-primary)' }}>{occ.categoryName}</span>
                                  <span> (кол-во: {occ.count}, редкость: {occ.rarity}%, доля: {occ.itemWeight.toFixed(0)}%)</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent-glow)', fontWeight: 'bold' }}>
                            {row.totalScore.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-accent" onClick={() => setShowBalance(false)}>{lang === 'ru' ? 'Закрыть' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loot Wizard Modal ───────────────────────────────── */}
      {showWizard && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div style={{ width: '600px', height: '620px', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--border-glow)', borderRadius: '4px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px' }}>// LOOT_WIZARD_STEP_{wizardStep}_OF_4</div>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>
                  {lang === 'ru' ? 'Конструктор настройки лута' : 'Loot Builder'}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3, 4].map(s => (
                  <div key={s} style={{
                    width: '24px', height: '6px', borderRadius: '1px',
                    background: s === wizardStep ? 'var(--text-glow)' : s < wizardStep ? 'var(--accent-color)' : 'var(--border-color)'
                  }} />
                ))}
              </div>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
              
              {/* STEP 1: Buildings & Presets */}
              {wizardStep === 1 && (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' ? 'Шаг 1: Выберите шаблон или задайте имя и добавьте здания, в которых будет находиться контейнер для поиска лута.' : 'Step 1: Choose a preset or set a name and add buildings where the search container will be located.'}
                  </div>
                  
                  {/* Preset key selector */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      {lang === 'ru' ? 'Использовать шаблон' : 'Use Preset Template'}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
                      {Object.entries(BUILDING_PRESETS).map(([key, p]) => (
                        <button
                          key={key}
                          className="btn"
                          onClick={() => handleWizardPresetSelect(key)}
                          style={{
                            padding: '6px 8px', fontSize: '11px', textTransform: 'none', letterSpacing: 'normal',
                            background: wPresetKey === key ? 'rgba(149,192,149,0.12)' : 'var(--bg-primary)',
                            border: wPresetKey === key ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                            color: wPresetKey === key ? 'var(--text-glow)' : 'var(--text-secondary)'
                          }}
                        >
                          {p.label[lang] || p.label.en}
                        </button>
                      ))}
                      <button
                        className="btn"
                        onClick={() => handleWizardPresetSelect('empty')}
                        style={{
                          padding: '6px 8px', fontSize: '11px', textTransform: 'none', letterSpacing: 'normal',
                          background: wPresetKey === 'empty' ? 'rgba(149,192,149,0.12)' : 'var(--bg-primary)',
                          border: wPresetKey === 'empty' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                          color: wPresetKey === 'empty' ? 'var(--text-glow)' : 'var(--text-secondary)'
                        }}
                      >
                        {lang === 'ru' ? 'Свой / Пустой' : 'Custom / Empty'}
                      </button>
                    </div>
                  </div>

                  {/* Building Category Name */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Имя категории зданий *' : 'Building Category Name *'}
                    </label>
                    <input
                      type="text"
                      value={wBldName}
                      onChange={e => setWBldName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="e.g. Police_Stations, Military_Barracks"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  {/* Classnames editor */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Класснеймы зданий' : 'Building Classnames'}
                    </label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder="Land_..."
                        className="input-small"
                        id="wizard-add-bld"
                        list="common-buildings"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            const val = e.target.value.trim();
                            if (!wBldList.includes(val)) {
                              setWBldList(prev => prev.filter(x => x).concat(val));
                            }
                            e.target.value = '';
                          }
                        }}
                      />
                      <button className="btn btn-accent" onClick={() => {
                        const input = document.getElementById('wizard-add-bld');
                        if (input && input.value.trim()) {
                          const val = input.value.trim();
                          if (!wBldList.includes(val)) {
                            setWBldList(prev => prev.filter(x => x).concat(val));
                          }
                          input.value = '';
                        }
                      }} style={{ padding: '0 12px', fontSize: '12px' }}>+</button>
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-primary)', padding: '6px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                      {wBldList.filter(x => x).length === 0 ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px' }}>{lang === 'ru' ? 'Здания не добавлены.' : 'No buildings added.'}</span>
                      ) : (
                        wBldList.filter(x => x).map((b, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{b}</span>
                            <span onClick={() => setWBldList(prev => prev.filter(x => x !== b))} style={{ color: 'var(--text-dark)', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 2: Containers / Proxies */}
              {wizardStep === 2 && (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' ? 'Шаг 2: Укажите имя категории прокси (мебели/контейнеров) и добавьте модели, в которых будет искаться лут.' : 'Step 2: Enter proxy category name (lockers/containers) and add models where loot will spawn.'}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Имя категории прокси *' : 'Proxy Category Name *'}
                    </label>
                    <input
                      type="text"
                      value={wPrxName}
                      onChange={e => setWPrxName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="e.g. Police_Lockers, Medical_Chests"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Модели прокси' : 'Proxy Models'}
                    </label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder="static_..."
                        className="input-small"
                        id="wizard-add-prx"
                        list="common-proxies"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            const val = e.target.value.trim();
                            if (!wPrxList.includes(val)) {
                              setWPrxList(prev => [...prev, val]);
                            }
                            e.target.value = '';
                          }
                        }}
                      />
                      <button className="btn btn-accent" onClick={() => {
                        const input = document.getElementById('wizard-add-prx');
                        if (input && input.value.trim()) {
                          const val = input.value.trim();
                          if (!wPrxList.includes(val)) {
                            setWPrxList(prev => [...prev, val]);
                          }
                          input.value = '';
                        }
                      }} style={{ padding: '0 12px', fontSize: '12px' }}>+</button>
                    </div>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-primary)', padding: '6px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                      {wPrxList.length === 0 ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px' }}>{lang === 'ru' ? 'Прокси не добавлены.' : 'No proxies added.'}</span>
                      ) : (
                        wPrxList.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{p}</span>
                            <span onClick={() => setWPrxList(prev => prev.filter(x => x !== p))} style={{ color: 'var(--text-dark)', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 3: Loot pool & Weight adjusters */}
              {wizardStep === 3 && (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' ? 'Шаг 3: Настройте редкость категории лута и наполните пул предметами. Повторяющиеся предметы повышают шанс выпадения.' : 'Step 3: Adjust loot category rarity and fill the item pool. Multiple entries increase drop probability.'}
                  </div>

                  {/* Rarity */}
                  <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      {lang === 'ru' ? 'Редкость категории лута (Rarity)' : 'Loot Category Rarity'}
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="range" min="0" max="100" step="1"
                        value={wLootRarity}
                        onChange={e => setWLootRarity(parseInt(e.target.value) || 0)}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', width: '36px', textAlign: 'right', fontWeight: 'bold', color: 'var(--text-glow)' }}>{wLootRarity}%</span>
                    </div>
                  </div>

                  {/* Add Loot item */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Предметы лута' : 'Loot Items'}
                    </label>
                    <AutocompleteInput
                      suggestions={xmlSuggestions}
                      placeholder={lang === 'ru' ? 'Введите класснейм предмета...' : 'Enter item classname...'}
                      onSelect={(val) => {
                        if (val.trim()) {
                          setWLootList(prev => [...prev, val.trim()]);
                        }
                      }}
                      showButton={true}
                      buttonLabel="+"
                    />
                  </div>

                  {/* Loot List with adjusters */}
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-primary)', padding: '6px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                    {(() => {
                      const total = wLootList.length;
                      if (total === 0) {
                        return <span style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px' }}>{lang === 'ru' ? 'Список лута пуст.' : 'Loot list is empty.'}</span>;
                      }
                      const counts = {};
                      wLootList.forEach(i => counts[i] = (counts[i] || 0) + 1);
                      const unique = [];
                      wLootList.forEach(i => { if (!unique.includes(i)) unique.push(i); });

                      return unique.map((item, idx) => {
                        const count = counts[item];
                        const pct = ((count / total) * 100).toFixed(0);
                        const isValid = xmlSuggestionsSet.size === 0 || xmlSuggestionsSet.has(item.toLowerCase());
                        
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px', gap: '8px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: isValid ? 'var(--text-primary)' : 'var(--warning-color)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={item}>
                              {!isValid && '⚠️ '}{item}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '28px', textAlign: 'right' }}>{pct}%</span>
                              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                                <button className="btn" style={{ padding: '0 4px', fontSize: '9px', border: 'none', background: 'none', height: '16px', display: 'flex', alignItems: 'center' }} onClick={() => {
                                  const idxToRemove = wLootList.indexOf(item);
                                  if (idxToRemove !== -1) {
                                    setWLootList(prev => prev.filter((_, i) => i !== idxToRemove));
                                  }
                                }}>-</button>
                                <span style={{ padding: '0 4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-glow)', minWidth: '12px', textAlign: 'center' }}>{count}</span>
                                <button className="btn" style={{ padding: '0 4px', fontSize: '9px', border: 'none', background: 'none', height: '16px', display: 'flex', alignItems: 'center' }} onClick={() => setWLootList(prev => [...prev, item])}>+</button>
                              </div>
                              <button className="btn btn-danger" style={{ padding: '0 4px', fontSize: '9px', height: '16px', display: 'flex', alignItems: 'center' }} onClick={() => setWLootList(prev => prev.filter(x => x !== item))}>×</button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              )}

              {/* STEP 4: Summary & Confirmation */}
              {wizardStep === 4 && (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' ? 'Шаг 4: Подтвердите создание связей. Будут сгенерированы следующие категории:' : 'Step 4: Confirm relations generation. The following configurations will be created:'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>🏠 {lang === 'ru' ? 'Категория зданий' : 'Building Category'}</span>
                      <span style={{ fontSize: '13px', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>{wBldName.trim()}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        — {wBldList.filter(x => x).length} {lang === 'ru' ? 'зданий добавлено' : 'buildings added'}
                      </span>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>🔧 {lang === 'ru' ? 'Категория прокси' : 'Proxy Category'}</span>
                      <span style={{ fontSize: '13px', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>{wPrxName.trim()}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        — {wPrxList.length} {lang === 'ru' ? 'контейнеров добавлено' : 'proxies added'}
                      </span>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>📦 {lang === 'ru' ? 'Категория лута (связь)' : 'Loot Category (relation)'}</span>
                      <span style={{ fontSize: '13px', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>{wBldName.trim()}_{wPrxName.trim()}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        — {wLootList.length} {lang === 'ru' ? 'предметов' : 'items'} (редкость: {wLootRarity}%)
                      </span>
                    </div>

                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--warning-color)', marginTop: '8px' }}>
                    * {lang === 'ru' ? 'Если категории с такими именами уже существуют, новые данные будут добавлены/объединены с ними.' : 'If categories with these names already exist, new data will be merged/appended to them.'}
                  </div>
                </>
              )}

            </div>

            {/* Footer Navigation */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
              <button className="btn" onClick={() => { setShowWizard(false); setWizardStep(1); }}>
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              
              {wizardStep > 1 && (
                <button className="btn" onClick={() => setWizardStep(prev => prev - 1)}>
                  {lang === 'ru' ? '< Назад' : '< Back'}
                </button>
              )}

              {wizardStep < 4 ? (
                <button
                  className="btn btn-accent"
                  disabled={
                    (wizardStep === 1 && !wBldName.trim()) ||
                    (wizardStep === 2 && !wPrxName.trim())
                  }
                  onClick={() => setWizardStep(prev => prev + 1)}
                >
                  {lang === 'ru' ? 'Далее >' : 'Next >'}
                </button>
              ) : (
                <button className="btn btn-accent" onClick={handleWizardGenerate}>
                  {lang === 'ru' ? 'Создать связь! 🧙‍♂️' : 'Generate Relation! 🧙‍♂️'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}


      {/* File selector top bar (if multiple files exist) */}
      {sflPaths.length > 1 && (
        <div style={{ padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>CONFIG FILE:</span>
          <select 
            value={currentPath}
            onChange={(e) => setSelectedFile(e.target.value)}
            style={{ padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
          >
            {sflPaths.map(p => (
              <option key={p} value={p}>{p.split('/').pop()}</option>
            ))}
          </select>
        </div>
      )}

      {/* Editor Title & Subtabs bar */}
      <div style={{ padding: '16px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>// SEARCH_FOR_LOOT_EDITOR</div>
          <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '20px' }}>{t('sfl_title')}</h2>
        </div>
        <div className="btn-group" style={{ display: 'flex', gap: '4px' }}>
          <button
            className={`btn ${activeSubTab === 'map' ? 'btn-accent' : ''}`}
            onClick={() => setActiveSubTab('map')}
            style={{ background: activeSubTab !== 'map' ? 'rgba(149,192,149,0.08)' : '' }}
          >
            🗺 {lang === 'ru' ? 'СХЕМА' : 'MAP'}
          </button>
          <button className={`btn ${activeSubTab === 'general' ? 'btn-accent' : ''}`} onClick={() => setActiveSubTab('general')}>{t('sfl_general')}</button>
          <button className={`btn ${activeSubTab === 'buildings' ? 'btn-accent' : ''}`} onClick={() => setActiveSubTab('buildings')}>{t('sfl_buildings')}</button>
          <button className={`btn ${activeSubTab === 'loot' ? 'btn-accent' : ''}`} onClick={() => setActiveSubTab('loot')}>{t('sfl_loot_cats')}</button>
          <button className={`btn ${activeSubTab === 'proxies' ? 'btn-accent' : ''}`} onClick={() => setActiveSubTab('proxies')}>{t('sfl_proxies')}</button>
        </div>
      </div>

      {/* Live Statistics Bar */}
      {sflStats && (
        <div style={{
          display: 'flex',
          gap: '16px',
          padding: '10px 20px',
          background: 'rgba(13, 18, 13, 0.4)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border-color)',
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>🏠 {lang === 'ru' ? 'Здания:' : 'Buildings:'}</span>
            <strong style={{ color: 'var(--text-glow)' }}>{sflStats.totalBldgs}</strong>
          </div>
          <span style={{ color: 'var(--border-color)', opacity: 0.5 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>🔧 {lang === 'ru' ? 'Прокси:' : 'Proxies:'}</span>
            <strong style={{ color: 'var(--text-glow)' }}>{sflStats.totalProxy}</strong>
          </div>
          <span style={{ color: 'var(--border-color)', opacity: 0.5 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>📦 {lang === 'ru' ? 'Предметы:' : 'Items:'}</span>
            <strong style={{ color: 'var(--text-glow)' }}>{sflStats.totalItems}</strong>
            {xmlSuggestionsSet.size > 0 && (
              <span style={{ color: sflStats.validatedItems === sflStats.totalItems ? 'var(--accent-color)' : 'var(--warning-color)' }}>
                ({sflStats.validatedItems} / {sflStats.totalItems} {lang === 'ru' ? 'валидно' : 'valid'})
              </span>
            )}
          </div>
          {sflStats.totalItems > sflStats.validatedItems && xmlSuggestionsSet.size > 0 && (
            <button 
              className="btn btn-danger" 
              style={{ padding: '2px 8px', fontSize: '9px', height: '18px', textTransform: 'none', letterSpacing: 'normal' }}
              onClick={handleRemoveDeadLoot}
            >
              🗑️ {lang === 'ru' ? 'Удалить несуществующий лут' : 'Remove dead loot'}
            </button>
          )}
          <span style={{ color: 'var(--border-color)', opacity: 0.5 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>⚠️ {lang === 'ru' ? 'Сиротские связи:' : 'Orphan relations:'}</span>
            <strong style={{ color: sflStats.orphanCount > 0 ? 'var(--warning-color)' : 'var(--accent-color)' }}>{sflStats.orphanCount}</strong>
          </div>
          <span style={{ color: 'var(--border-color)', opacity: 0.5 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>👥 {lang === 'ru' ? 'Дубликаты:' : 'Duplicates:'}</span>
            <button 
              className="btn" 
              style={{ 
                padding: '2px 6px', 
                fontSize: '9px', 
                height: '18px', 
                background: sflStats.dupes.length > 0 ? 'rgba(235, 214, 103, 0.12)' : 'rgba(255,255,255,0.03)',
                color: sflStats.dupes.length > 0 ? 'var(--warning-color)' : 'var(--text-secondary)',
                border: sflStats.dupes.length > 0 ? '1px solid rgba(235, 214, 103, 0.25)' : '1px solid var(--border-color)',
                textTransform: 'none',
                letterSpacing: 'normal'
              }}
              onClick={() => setShowDupes(true)}
            >
              {sflStats.dupes.length} {lang === 'ru' ? 'предм.' : 'items'}
            </button>
          </div>
          <span style={{ color: 'var(--border-color)', opacity: 0.5 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>📊 {lang === 'ru' ? 'Баланс:' : 'Balance:'}</span>
            <button 
              className="btn btn-accent" 
              style={{ padding: '2px 8px', fontSize: '9px', height: '18px', textTransform: 'none', letterSpacing: 'normal' }}
              onClick={() => setShowBalance(true)}
            >
              {lang === 'ru' ? 'Инспектор' : 'Inspector'}
            </button>
          </div>
          <span style={{ color: 'var(--border-color)', opacity: 0.5 }}>|</span>
          <button 
            className="btn" 
            style={{ padding: '2px 8px', fontSize: '9px', height: '18px', textTransform: 'none', letterSpacing: 'normal', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}
            onClick={handleAutoCleanup}
            title={lang === 'ru' ? 'Удалить пустые и неиспользуемые категории' : 'Prune empty and unused categories'}
          >
            🧹 {lang === 'ru' ? 'Очистить' : 'Cleanup'}
          </button>
        </div>
      )}

      {/* Bulk Import Modal popup */}
      {activeBulk && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div style={{ width: '480px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glow)', borderRadius: '4px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>
              {lang === 'ru' ? 'Импортировать списком' : 'Bulk Import Items'}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
              {lang === 'ru' ? 'Вставьте класснеймы, разделенные запятой, точкой с запятой или переносом строки:' : 'Paste classnames separated by commas, semicolons, or newlines:'}
            </p>
            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="ItemClassName1&#10;ItemClassName2, ItemClassName3"
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '3px', marginBottom: '16px', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { setActiveBulk(null); setBulkText(''); }}>{t('modal_cancel_default') || 'Cancel'}</button>
              <button className="btn btn-accent" onClick={handleBulkSubmit}>{t('sfl_btn_import')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        
        {/* ─── GENERAL TAB ─── */}
        {activeSubTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
            <div className="form-card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-glow)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                {t('sfl_general')}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                
                {/* Debug toggle */}
                <div 
                  className="toggle-container"
                  onClick={() => handleGeneralChange('EnableDebug', content.EnableDebug === 1 ? 0 : 1)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: '13px' }}>{t('sfl_enable_debug')}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('sfl_desc_debug')}</span>
                  </div>
                  <div className={`toggle-switch ${content.EnableDebug === 1 ? 'checked' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                </div>

                {/* Sound toggle */}
                <div 
                  className="toggle-container"
                  onClick={() => handleGeneralChange('EnableSound', (content.EnableSound ?? 1) === 1 ? 0 : 1)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: '13px' }}>
                      {t('sfl_enable_sound')}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('sfl_desc_sound')}</span>
                  </div>
                  <div className={`toggle-switch ${(content.EnableSound ?? 1) === 1 ? 'checked' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                </div>

                {/* Notifications toggle */}
                <div 
                  className="toggle-container"
                  onClick={() => handleGeneralChange('DisableNotifications', content.DisableNotifications === 1 ? 0 : 1)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: '13px' }}>{t('sfl_disable_notif')}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('sfl_desc_notif')}</span>
                  </div>
                  <div className={`toggle-switch ${content.DisableNotifications === 1 ? 'checked' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                </div>

                {/* Cooldown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {t('sfl_cooldown')}
                    <HelpIcon tipKey="tip_sfl_initial_cooldown" />
                  </label>
                  <input 
                    type="number"
                    value={content.InitialCooldown ?? 400}
                    onChange={(e) => handleGeneralChange('InitialCooldown', parseInt(e.target.value) || 0)}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Rarity */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {t('sfl_rarity')}
                    <HelpIcon tipKey="tip_sfl_rarity" />
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input 
                      type="range" min="0" max="100" step="0.5"
                      value={content.Rarity ?? 50}
                      onChange={(e) => handleGeneralChange('Rarity', parseFloat(e.target.value) || 0)}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', width: '48px', textAlign: 'right' }}>{content.Rarity}%</span>
                  </div>
                </div>

                {/* XP Gain */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {t('sfl_xp_gain')}
                    <HelpIcon tipKey="tip_sfl_xp_gain" />
                  </label>
                  <input 
                    type="number"
                    value={content.XPGain ?? 0}
                    onChange={(e) => handleGeneralChange('XPGain', parseInt(e.target.value) || 0)}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Max Health Coef */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {t('sfl_max_health_coef')}
                    <HelpIcon tipKey="tip_sfl_max_health_coef" />
                  </label>
                  <input 
                    type="number" step="0.05"
                    value={content.MaxHealthCoef ?? 1.0}
                    onChange={(e) => handleGeneralChange('MaxHealthCoef', parseFloat(e.target.value) || 0)}
                    style={{ width: '100%' }}
                  />
                </div>

              </div>
            </div>

            {/* Notification texts */}
            {content.DisableNotifications !== 1 && (
              <div className="form-card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-glow)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  {t('sfl_notifications')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {t('sfl_notif_heading')}
                      <HelpIcon tipKey="tip_sfl_notif_heading" />
                    </label>
                    <input 
                      type="text"
                      value={content.NotificationHeading ?? ''}
                      onChange={(e) => handleGeneralChange('NotificationHeading', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {t('sfl_notif_text')}
                        <HelpIcon tipKey="tip_sfl_notif_text" />
                      </label>
                      <input 
                        type="text"
                        value={content.NotificationText ?? ''}
                        onChange={(e) => handleGeneralChange('NotificationText', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {t('sfl_notif_text2')}
                        <HelpIcon tipKey="tip_sfl_notif_text2" />
                      </label>
                      <input 
                        type="text"
                        value={content.NotificationText2 ?? ''}
                        onChange={(e) => handleGeneralChange('NotificationText2', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── BUILDINGS TAB ─── */}
        {activeSubTab === 'buildings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={`sfl-help-box ${showHelp.buildings ? 'open' : ''}`} style={{ background: 'rgba(255, 255, 255, 0.02)', borderLeft: '3px solid var(--accent-color)', borderRadius: '0 4px 4px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <div style={{ padding: '12px 16px' }}>
                {t('sfl_buildings_desc')}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder={t('sfl_placeholder_search')}
                  value={buildingSearch}
                  onChange={(e) => setBuildingSearch(e.target.value)}
                  style={{ width: '260px' }}
                />
                <button 
                  className={`btn ${showHelp.buildings ? 'btn-accent' : ''}`}
                  style={{ padding: '6px 12px', background: showHelp.buildings ? '' : 'rgba(255,255,255,0.05)', fontWeight: 'bold' }}
                  onClick={() => setShowHelp(prev => ({ ...prev, buildings: !prev.buildings }))}
                  title={lang === 'ru' ? 'Показать справку' : 'Show Help'}
                >
                  ?
                </button>
              </div>
              <button className="btn btn-accent" onClick={handleAddBuildingCategory}>
                + {t('sfl_btn_add_cat')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {sflBuildings.map((cat, catIdx) => {
                if (buildingSearch && !cat.name.toLowerCase().includes(buildingSearch.toLowerCase()) && !cat.buildings.some(b => b.toLowerCase().includes(buildingSearch.toLowerCase()))) {
                  return null;
                }
                return (
                  <CategoryCard
                    key={catIdx}
                    title={cat.name}
                    onBulkClick={() => setActiveBulk({ type: 'building', index: catIdx })}
                    onCloneClick={() => handleCloneBuildingCategory(catIdx)}
                    onRenameClick={() => handleRenameCategory('building', catIdx)}
                    onDeleteClick={() => handleRemoveBuildingCategory(catIdx)}
                    maxHeight="420px"
                    inputElement={
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input 
                          type="text"
                          placeholder="Land_House_..."
                          className="input-small"
                          style={{ flex: 1, fontSize: '12px' }}
                          id={`add-building-${catIdx}`}
                          list="common-buildings"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddBuildingToCategory(catIdx, e.target.value);
                              e.target.value = '';
                            }
                          }}
                        />
                        <button 
                          className="btn btn-accent" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => {
                            const input = document.getElementById(`add-building-${catIdx}`);
                            if (input) {
                              handleAddBuildingToCategory(catIdx, input.value);
                              input.value = '';
                            }
                          }}
                        >
                          {t('sfl_btn_add')}
                        </button>
                      </div>
                    }
                  >
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', paddingRight: '4px' }}>
                      {cat.buildings.map((bld, bldIdx) => (
                        <ListItemRow
                          key={bldIdx}
                          text={bld}
                          emptyPlaceholder={t('sfl_empty_placeholder')}
                          onRemove={() => handleRemoveBuildingFromCategory(catIdx, bldIdx)}
                        />
                      ))}
                    </div>
                  </CategoryCard>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── LOOT CATEGORIES TAB ─── */}
        {activeSubTab === 'loot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={`sfl-help-box ${showHelp.loot ? 'open' : ''}`} style={{ background: 'rgba(255, 255, 255, 0.02)', borderLeft: '3px solid var(--accent-color)', borderRadius: '0 4px 4px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <div style={{ padding: '12px 16px' }}>
                {t('sfl_loot_cats_desc')}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder={t('sfl_placeholder_search')}
                  value={lootSearch}
                  onChange={(e) => setLootSearch(e.target.value)}
                  style={{ width: '260px' }}
                />
                <button 
                  className={`btn ${showHelp.loot ? 'btn-accent' : ''}`}
                  style={{ padding: '6px 12px', background: showHelp.loot ? '' : 'rgba(255,255,255,0.05)', fontWeight: 'bold' }}
                  onClick={() => setShowHelp(prev => ({ ...prev, loot: !prev.loot }))}
                  title={lang === 'ru' ? 'Показать справку' : 'Show Help'}
                >
                  ?
                </button>
              </div>
              <button className="btn btn-accent" onClick={handleAddLootCategory}>
                + {t('sfl_btn_add_cat')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
              {sflLootCats.map((cat, catIdx) => {
                if (lootSearch && !cat.name.toLowerCase().includes(lootSearch.toLowerCase()) && !cat.loot.some(l => l.toLowerCase().includes(lootSearch.toLowerCase()))) {
                  return null;
                }
                return (
                  <CategoryCard
                    key={catIdx}
                    title={cat.name}
                    onBulkClick={() => setActiveBulk({ type: 'loot', index: catIdx })}
                    onCloneClick={() => handleCloneLootCategory(catIdx)}
                    onRenameClick={() => handleRenameCategory('loot', catIdx)}
                    onDeleteClick={() => handleRemoveLootCategory(catIdx)}
                    maxHeight="480px"
                    inputElement={
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <AutocompleteInput 
                          suggestions={xmlSuggestions}
                          placeholder={lang === 'ru' ? 'Ввод класснейма...' : 'Item classname...'}
                          onSelect={(val) => handleAddLootItem(catIdx, val)}
                          showButton={true}
                          buttonLabel={t('sfl_btn_add')}
                        />
                      </div>
                    }
                  >
                    {/* Rarity slider for loot category */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px', background: 'var(--bg-primary)', padding: '10px', borderRadius: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{t('sfl_rarity')}</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input 
                          type="range" min="0" max="100" step="1"
                          value={cat.rarity ?? 50}
                          onChange={(e) => onChangeField(currentPath, ['SFLLootCategory', catIdx, 'rarity'], parseInt(e.target.value) || 0)}
                          style={{ flex: 1 }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', width: '36px', textAlign: 'right' }}>{cat.rarity}%</span>
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', paddingRight: '4px' }}>
                      {(() => {
                        const total = cat.loot.length;
                        const counts = {};
                        cat.loot.forEach(i => counts[i] = (counts[i] || 0) + 1);
                        const unique = [];
                        cat.loot.forEach(i => { if (!unique.includes(i)) unique.push(i); });
                        
                        return unique.map((item, idx) => {
                          const count = counts[item];
                          const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
                          const isValid = xmlSuggestionsSet.size === 0 || xmlSuggestionsSet.has(item.toLowerCase());
                          return (
                            <LootItemRow
                              key={idx}
                              text={item}
                              count={count}
                              percentage={pct}
                              onIncrease={() => handleIncreaseLootWeight(catIdx, item)}
                              onDecrease={() => handleDecreaseLootWeight(catIdx, item)}
                              onRemoveAll={() => handleRemoveAllLootCopies(catIdx, item)}
                              isValid={isValid}
                              tooltip={t('econ_item_missing_tooltip')}
                            />
                          );
                        });
                      })()}
                    </div>
                  </CategoryCard>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── PROXIES TAB ─── */}
        {activeSubTab === 'proxies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={`sfl-help-box ${showHelp.proxies ? 'open' : ''}`} style={{ background: 'rgba(255, 255, 255, 0.02)', borderLeft: '3px solid var(--accent-color)', borderRadius: '0 4px 4px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <div style={{ padding: '12px 16px' }}>
                {t('sfl_proxies_desc')}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder={t('sfl_placeholder_search')}
                  value={proxySearch}
                  onChange={(e) => setProxySearch(e.target.value)}
                  style={{ width: '260px' }}
                />
                <button 
                  className={`btn ${showHelp.proxies ? 'btn-accent' : ''}`}
                  style={{ padding: '6px 12px', background: showHelp.proxies ? '' : 'rgba(255,255,255,0.05)', fontWeight: 'bold' }}
                  onClick={() => setShowHelp(prev => ({ ...prev, proxies: !prev.proxies }))}
                  title={lang === 'ru' ? 'Показать справку' : 'Show Help'}
                >
                  ?
                </button>
              </div>
              <button className="btn btn-accent" onClick={handleAddProxyCategory}>
                + {t('sfl_btn_add_cat')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {sflProxies.map((cat, catIdx) => {
                if (proxySearch && !cat.name.toLowerCase().includes(proxySearch.toLowerCase()) && !cat.proxies.some(p => p.toLowerCase().includes(proxySearch.toLowerCase()))) {
                  return null;
                }
                return (
                  <CategoryCard
                    key={catIdx}
                    title={cat.name}
                    onBulkClick={() => setActiveBulk({ type: 'proxy', index: catIdx })}
                    onCloneClick={() => handleCloneProxyCategory(catIdx)}
                    onRenameClick={() => handleRenameCategory('proxy', catIdx)}
                    onDeleteClick={() => handleRemoveProxyCategory(catIdx)}
                    maxHeight="420px"
                    inputElement={
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input 
                          type="text"
                          placeholder="static_..."
                          className="input-small"
                          style={{ flex: 1, fontSize: '12px' }}
                          id={`add-proxy-${catIdx}`}
                          list="common-proxies"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddProxyToCategory(catIdx, e.target.value);
                              e.target.value = '';
                            }
                          }}
                        />
                        <button 
                          className="btn btn-accent" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => {
                            const input = document.getElementById(`add-proxy-${catIdx}`);
                            if (input) {
                              handleAddProxyToCategory(catIdx, input.value);
                              input.value = '';
                            }
                          }}
                        >
                          {t('sfl_btn_add')}
                        </button>
                      </div>
                    }
                  >
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', paddingRight: '4px' }}>
                      {cat.proxies.map((prx, prxIdx) => (
                        <ListItemRow
                          key={prxIdx}
                          text={prx}
                          onRemove={() => handleRemoveProxyFromCategory(catIdx, prxIdx)}
                        />
                      ))}
                    </div>
                  </CategoryCard>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── MAP / RELATION SCHEMA TAB ─── */}
        {activeSubTab === 'map' && (() => {
          const buildings   = content.SFLBuildings      || [];
          const lootCats    = content.SFLLootCategory   || [];
          const proxyCats   = content.SFLProxyCategory  || [];

          const relations = [];
          const seenLoot = new Set();
          const seenBld = new Set();
          const seenPrxy = new Set();

          buildings.forEach(b => {
            proxyCats.forEach(p => {
              const expectedLootName = `${b.name}_${p.name}`;
              const loot = lootCats.find(l => l.name.toLowerCase() === expectedLootName.toLowerCase());
              
              relations.push({
                id: `${b.name}::${p.name}`,
                buildingName: b.name,
                proxyName: p.name,
                lootName: loot ? loot.name : expectedLootName,
                isExpectedLootMissing: !loot
              });
              
              if (loot) seenLoot.add(loot.name.toLowerCase());
              seenBld.add(b.name.toLowerCase());
              seenPrxy.add(p.name.toLowerCase());
            });
          });

          lootCats.forEach(l => {
            if (!seenLoot.has(l.name.toLowerCase())) {
              const underscoreIdx = l.name.indexOf('_');
              let bName = null;
              let pName = null;
              if (underscoreIdx > 0) {
                bName = l.name.substring(0, underscoreIdx);
                pName = l.name.substring(underscoreIdx + 1);
              }
              relations.push({
                id: `loot::${l.name}`,
                buildingName: bName,
                proxyName: pName,
                lootName: l.name,
                isExpectedLootMissing: false
              });
              seenLoot.add(l.name.toLowerCase());
            }
          });

          buildings.forEach(b => {
            if (!seenBld.has(b.name.toLowerCase())) {
              relations.push({
                id: `bld::${b.name}`,
                buildingName: b.name,
                proxyName: null,
                lootName: null,
                isExpectedLootMissing: false
              });
            }
          });

          proxyCats.forEach(p => {
            if (!seenPrxy.has(p.name.toLowerCase())) {
              relations.push({
                id: `prxy::${p.name}`,
                buildingName: null,
                proxyName: p.name,
                lootName: null,
                isExpectedLootMissing: false
              });
            }
          });

          const filtered = mapSearch.trim()
            ? relations.filter(r => 
                (r.buildingName && r.buildingName.toLowerCase().includes(mapSearch.toLowerCase())) ||
                (r.lootName && r.lootName.toLowerCase().includes(mapSearch.toLowerCase())) ||
                (r.proxyName && r.proxyName.toLowerCase().includes(mapSearch.toLowerCase()))
              )
            : relations;

          const orphanCount = relations.filter(r => r.isExpectedLootMissing).length;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={lang === 'ru' ? 'Поиск по группам...' : 'Search groups...'}
                  value={mapSearch}
                  onChange={e => setMapSearch(e.target.value)}
                  style={{ width: '260px' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginLeft: '10px' }}>
                  {lang === 'ru' ? 'Связей' : 'Relations'}: <strong style={{ color: 'var(--text-glow)' }}>{filtered.length}</strong>
                </div>
                <button
                  className="btn btn-accent"
                  style={{ marginLeft: 'auto', fontSize: '11px', padding: '5px 12px' }}
                  onClick={() => { setShowWizard(true); setWizardStep(1); }}
                >
                  🧙‍♂️ {lang === 'ru' ? 'Конструктор лута' : 'Loot Builder'}
                </button>
                {(() => {
                  const allExpanded = filtered.length > 0 && filtered.every(r => mapExpanded.has(r.id));
                  return (
                    <button
                      className="btn"
                      style={{ fontSize: '11px', padding: '5px 12px' }}
                      onClick={() => allExpanded ? setMapExpanded(new Set()) : setMapExpanded(new Set(filtered.map(r => r.id)))}
                    >
                      {allExpanded
                        ? (lang === 'ru' ? '▲ Свернуть всё' : '▲ Collapse All')
                        : (lang === 'ru' ? '▼ Развернуть всё' : '▼ Expand All')}
                    </button>
                  );
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: 'bold', padding: '0 4px' }}>
                <span>🏠 {lang === 'ru' ? 'ЗДАНИЯ' : 'BUILDINGS'}</span>
                <span>📦 {lang === 'ru' ? 'ЛУТ-КАТЕГОРИИ' : 'LOOT CATEGORIES'}</span>
                <span>🔧 {lang === 'ru' ? 'ПРОКСИ' : 'ПРОКСИ'}</span>
              </div>

              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  {lang === 'ru' ? 'Нет групп для отображения' : 'No groups to display'}
                </div>
              )}
              {filtered.map(rel => {
                const { id, buildingName, lootName, proxyName, isExpectedLootMissing } = rel;

                const bld = buildingName ? buildings.find(b => b.name.toLowerCase() === buildingName.toLowerCase()) : null;
                const loot = lootName ? lootCats.find(l => l.name.toLowerCase() === lootName.toLowerCase()) : null;
                const prxy = proxyName ? proxyCats.find(p => p.name.toLowerCase() === proxyName.toLowerCase()) : null;

                const bldIdx = buildingName ? buildings.findIndex(b => b.name.toLowerCase() === buildingName.toLowerCase()) : -1;
                const lootIdx = lootName ? lootCats.findIndex(l => l.name.toLowerCase() === lootName.toLowerCase()) : -1;
                const prxyIdx = proxyName ? proxyCats.findIndex(p => p.name.toLowerCase() === proxyName.toLowerCase()) : -1;

                const isExpanded = mapExpanded.has(id);

                return (
                  <div key={id} style={{ border: `1px solid ${isExpectedLootMissing ? 'var(--warning-color)' : 'var(--border-color)'}`, borderRadius: '3px', overflow: 'hidden', background: 'var(--bg-secondary)' }}>

                    <div
                      onClick={() => toggleMapRow(id)}
                      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', cursor: 'pointer', background: 'var(--bg-tertiary)', borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none', transition: 'background 0.1s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(149,192,149,0.06)'}
                      onMouseOut={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    >
                      <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border-color)' }}>
                        {bld ? <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-glow)' }}>🏠 {bld.name}</span> : <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic' }}>—</span>}
                      </div>
                      <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border-color)' }}>
                        {loot ? <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-glow)' }}>📦 {loot.name}</span> : <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic' }}>—</span>}
                      </div>
                      <div style={{ padding: '10px 14px' }}>
                        {prxy ? <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-glow)' }}>🔧 {prxy.name}</span> : <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic' }}>—</span>}
                        <span style={{ float: 'right', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '18px' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--border-color)' }}>
                        <div style={{ background: 'var(--bg-primary)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto' }}>
                          {bld ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{lang === 'ru' ? 'СПИСОК ЗДАНИЙ' : 'BUILDINGS LIST'}</span>
                                <button className="btn" style={{ padding: '2px 6px', fontSize: '9px' }} onClick={e => { e.stopPropagation(); setActiveBulk({ type: 'building', index: bldIdx }); }}>{lang === 'ru' ? 'Импорт' : 'Import'}</button>
                              </div>
                              {bld.buildings.filter(b => b).map((b, i) => {
                                const origIdx = bld.buildings.indexOf(b);
                                return (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', background: 'rgba(149,192,149,0.04)', padding: '2px 6px', borderRadius: '2px' }}>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} title={b}>{b}</div>
                                    <span onClick={e => { e.stopPropagation(); handleRemoveBuildingFromCategory(bldIdx, origIdx); }} style={{ color: 'var(--text-dark)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 4px' }} title={lang === 'ru' ? 'Удалить' : 'Remove'}>×</span>
                                  </div>
                                );
                              })}
                              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }} onClick={e => e.stopPropagation()}>
                                <input type="text" placeholder="Land_..." className="input-small" style={{ flex: 1, fontSize: '11px', padding: '2px 6px' }} id={`add-bld-rel-${id}`} list="common-buildings" onKeyDown={e => { if (e.key === 'Enter') { handleAddBuildingToCategory(bldIdx, e.target.value); e.target.value = ''; } }} />
                                <button className="btn btn-accent" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => { const input = document.getElementById(`add-bld-rel-${id}`); if (input && input.value.trim()) { handleAddBuildingToCategory(bldIdx, input.value); input.value = ''; } }}>+</button>
                              </div>
                            </>
                          ) : <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>{lang === 'ru' ? 'Категория зданий отсутствует.' : 'No building category.'}</span>}
                        </div>

                        <div style={{ background: 'var(--bg-primary)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto' }}>
                          {loot ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{lang === 'ru' ? 'СПИСОК ЛУТА' : 'LOOT LIST'}</span>
                                <button className="btn" style={{ padding: '2px 6px', fontSize: '9px' }} onClick={e => { e.stopPropagation(); setActiveBulk({ type: 'loot', index: lootIdx }); }}>{lang === 'ru' ? 'Импорт' : 'Import'}</button>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
                                {(() => {
                                  const total = loot.loot.length;
                                  const counts = {};
                                  loot.loot.forEach(i => counts[i] = (counts[i] || 0) + 1);
                                  const unique = [];
                                  loot.loot.forEach(i => { if (!unique.includes(i)) unique.push(i); });
                                  
                                  return unique.map((item, idx) => {
                                    const count = counts[item];
                                    const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
                                    const isValid = xmlSuggestionsSet.size === 0 || xmlSuggestionsSet.has(item.toLowerCase());
                                    return (
                                      <LootItemRow
                                        key={idx}
                                        text={item}
                                        count={count}
                                        percentage={pct}
                                        onIncrease={() => handleIncreaseLootWeight(lootIdx, item)}
                                        onDecrease={() => handleDecreaseLootWeight(lootIdx, item)}
                                        onRemoveAll={() => handleRemoveAllLootCopies(lootIdx, item)}
                                        isValid={isValid}
                                        tooltip={t('econ_item_missing_tooltip')}
                                      />
                                    );
                                  });
                                })()}
                              </div>
                              <div style={{ marginTop: '6px' }} onClick={e => e.stopPropagation()}>
                                <AutocompleteInput suggestions={xmlSuggestions} placeholder={lang === 'ru' ? 'Ввод...' : 'Item...'} onSelect={(val) => handleAddLootItem(lootIdx, val)} showButton={true} buttonLabel="+" inputStyle={{ fontSize: '11px', padding: '4px 6px', height: '24px' }} buttonStyle={{ padding: '2px 8px', fontSize: '11px', height: '24px' }} />
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--danger-color)' }}>❌ {lang === 'ru' ? 'Нет лут-категории!' : 'No loot category!'}</span>
                              {lootName && (
                                <button className="btn btn-accent" style={{ fontSize: '10px', padding: '4px 8px' }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    const updated = [...lootCats, { name: lootName, rarity: 50, loot: [] }];
                                    onChangeField(currentPath, ['SFLLootCategory'], updated);
                                  }}
                                >+ {lang === 'ru' ? 'Создать лут-кат.' : 'Create loot cat.'}</button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Proxies list */}
                        <div style={{ background: 'var(--bg-primary)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto' }}>
                          {prxy ? (
                            prxy.proxies.length === 0
                              ? <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic' }}>{lang === 'ru' ? 'Список пуст' : 'Empty list'}</span>
                              : prxy.proxies.map((p, i) => (
                                <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', padding: '3px 6px', background: 'rgba(149,192,149,0.04)', borderRadius: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p}>{p}</div>
                              ))
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>{lang === 'ru' ? 'Нет прокси-категории.' : 'No proxy category.'}</span>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
