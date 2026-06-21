import React, { useState, useMemo } from 'react';
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

// Helper components for SearchForLootEditor
function CategoryCard({
  title,
  onBulkClick,
  onDeleteClick,
  maxHeight = '420px',
  children,
  inputElement
}) {
  const { t } = useTranslation();
  const actions = (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button className="btn" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={onBulkClick}>{t('sfl_btn_bulk')}</button>
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

export default function SearchForLootEditor({
  configs,
  onChangeField,
  xmlItems = []
}) {
  const { t, lang } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('general');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Search / filter states for lists
  const [buildingSearch, setBuildingSearch] = useState('');
  const [lootSearch, setLootSearch] = useState('');
  const [proxySearch, setProxySearch] = useState('');

  // Bulk add states
  const [bulkText, setBulkText] = useState('');
  const [activeBulk, setActiveBulk] = useState(null); // { type: 'building'|'loot'|'proxy', index: number }
  const [showHelp, setShowHelp] = useState({ buildings: false, loot: false, proxies: false });

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
    const catName = prompt(lang === 'ru' ? 'Введите имя новой категории зданий:' : 'Enter new building category name:');
    if (catName && catName.trim()) {
      const updated = [...sflBuildings, { name: catName.trim(), buildings: [""] }];
      onChangeField(currentPath, ['SFLBuildings'], updated);
    }
  };

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
    if (currentList.includes(itemClassname.trim())) return;
    const newList = [...currentList, itemClassname.trim()];
    onChangeField(currentPath, ['SFLLootCategory', catIdx, 'loot'], newList);
  };

  const handleRemoveLootItem = (catIdx, itemIdx) => {
    const currentList = sflLootCats[catIdx]?.loot || [];
    const newList = currentList.filter((_, idx) => idx !== itemIdx);
    onChangeField(currentPath, ['SFLLootCategory', catIdx, 'loot'], newList);
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


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Native datalists for buildings and proxies autocomplete */}
      <datalist id="common-buildings">
        {COMMON_BUILDINGS.map(b => <option key={b} value={b} />)}
      </datalist>
      <datalist id="common-proxies">
        {COMMON_PROXIES.map(p => <option key={p} value={p} />)}
      </datalist>
      
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
          <button className={`btn ${activeSubTab === 'general' ? 'btn-accent' : ''}`} onClick={() => setActiveSubTab('general')}>{t('sfl_general')}</button>
          <button className={`btn ${activeSubTab === 'buildings' ? 'btn-accent' : ''}`} onClick={() => setActiveSubTab('buildings')}>{t('sfl_buildings')}</button>
          <button className={`btn ${activeSubTab === 'loot' ? 'btn-accent' : ''}`} onClick={() => setActiveSubTab('loot')}>{t('sfl_loot_cats')}</button>
          <button className={`btn ${activeSubTab === 'proxies' ? 'btn-accent' : ''}`} onClick={() => setActiveSubTab('proxies')}>{t('sfl_proxies')}</button>
        </div>
      </div>

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
                      {cat.loot.map((item, itemIdx) => {
                        const isValid = xmlSuggestionsSet.size === 0 || xmlSuggestionsSet.has(item.toLowerCase());
                        return (
                          <ListItemRow
                            key={itemIdx}
                            text={item}
                            isValid={isValid}
                            tooltip={t('econ_item_missing_tooltip')}
                            onRemove={() => handleRemoveLootItem(catIdx, itemIdx)}
                          />
                        );
                      })}
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

      </div>
    </div>
  );
}
