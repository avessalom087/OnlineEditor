import React, { useState, useEffect, useMemo, useRef } from 'react';
import AutocompleteInput from './shared/AutocompleteInput';
import FormCard from './shared/FormCard';
import HelpIcon from './HelpIcon';
import { useTranslation } from '../utils/localization';
import { getMpgSpawnerPrefix } from '../utils/pathUtils';


// Helper to parse pipe-delimited spawn list entry
function parseSpawnListEntry(str) {
  if (!str) return { className: '', chance: '', lifetime: '', count: '', health: '', foodStage: '' };
  const parts = str.split('|').map(p => p.trim());
  return {
    className: parts[0] || '',
    chance: parts[1] !== undefined ? parts[1] : '',
    lifetime: parts[2] !== undefined ? parts[2] : '',
    count: parts[3] !== undefined ? parts[3] : '',
    health: parts[4] !== undefined ? parts[4] : '',
    foodStage: parts[5] !== undefined ? parts[5] : ''
  };
}

// Helper to format spawn list entry back to pipe-delimited format
function formatSpawnListEntry(obj) {
  const parts = [obj.className];
  const chance = obj.chance !== '' ? obj.chance : '-3';
  const lifetime = obj.lifetime !== '' ? obj.lifetime : '-3';
  const count = obj.count !== '' ? obj.count : '-3';
  const health = obj.health !== '' ? obj.health : '-3';
  const foodStage = obj.foodStage !== '' ? obj.foodStage : '-3';

  parts.push(chance);
  parts.push(lifetime);
  parts.push(count);
  parts.push(health);
  parts.push(foodStage);

  // Trim trailing default "-3" parameters
  while (parts.length > 1 && parts[parts.length - 1] === '-3') {
    parts.pop();
  }

  return parts.join('|');
}

function updateCoordsInString(oldStr, newX, newZ) {
  const parts = oldStr.split('|');
  const coordParts = parts[0].trim().split(/\s+/);
  const y = coordParts[1] || "0.0";
  
  const formattedX = parseFloat(newX.toFixed(3));
  const formattedZ = parseFloat(newZ.toFixed(3));
  
  coordParts[0] = formattedX;
  coordParts[1] = y;
  coordParts[2] = formattedZ;
  
  parts[0] = coordParts.join(' ');
  return parts.join(' | ');
}

// SmartDefaultInput handles values where "-3" represents "default/use standard"
function SmartDefaultInput({ value, onChange, placeholder = "Default", title = "" }) {
  const isDefault = value === "" || value === "-3" || value === -3;

  const handleToggleLock = () => {
    if (isDefault) {
      onChange("");
    } else {
      onChange("-3");
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <input
        type="text"
        value={isDefault ? "" : value}
        onChange={e => onChange(e.target.value)}
        disabled={isDefault}
        placeholder={isDefault ? placeholder : ""}
        style={{
          fontSize: '11px',
          padding: '4px 6px',
          background: isDefault ? 'var(--bg-secondary)' : 'var(--bg-primary)',
          color: isDefault ? 'var(--text-secondary)' : 'var(--text-glow)',
          borderColor: isDefault ? 'rgba(30, 48, 30, 0.4)' : 'var(--border-color)',
          cursor: isDefault ? 'not-allowed' : 'text',
          flex: 1,
          minWidth: '0'
        }}
        title={title}
      />
      <button
        type="button"
        onClick={handleToggleLock}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          fontSize: '11px',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.8
        }}
        title={isDefault ? "Unlock custom value" : "Lock to default (-3)"}
      >
        {isDefault ? '🔒' : '🔓'}
      </button>
    </div>
  );
}

function getEntityTypeBadge(className, lang) {
  const lower = className.toLowerCase();
  if (lower.startsWith('animal_')) {
    return {
      text: lang === 'ru' ? 'Животное' : 'Animal',
      color: '#ff4c4c',
      bg: 'rgba(255, 76, 76, 0.1)',
      border: 'rgba(255, 76, 76, 0.3)'
    };
  } else if (lower.startsWith('zmb') || lower.includes('zombie')) {
    return {
      text: lang === 'ru' ? 'Зараженный' : 'Infected',
      color: '#ebd667',
      bg: 'rgba(235, 214, 103, 0.1)',
      border: 'rgba(235, 214, 103, 0.3)'
    };
  } else {
    return {
      text: lang === 'ru' ? 'Предмет' : 'Loot',
      color: '#559655',
      bg: 'rgba(85, 150, 85, 0.1)',
      border: 'rgba(85, 150, 85, 0.3)'
    };
  }
}

function TriggerLinkField({ label, value, onChange, allTriggers, lang }) {
  const currentIds = Array.isArray(value) ? value : [];
  
  const handleRemoveId = (idToRemove) => {
    onChange(currentIds.filter(id => id !== idToRemove));
  };

  const handleAddId = (idToAdd) => {
    if (!currentIds.includes(idToAdd)) {
      onChange([...currentIds, idToAdd]);
    }
  };

  const availableTriggers = allTriggers.filter(t => t.pointId && !currentIds.includes(Number(t.pointId)));

  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
        {label}
      </label>
      
      {/* Selected Tags Flex */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
        {currentIds.map(id => {
          const targetTrig = allTriggers.find(t => Number(t.pointId) === id);
          const titleText = targetTrig ? targetTrig.notificationTitle : '';
          return (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                padding: '2px 6px',
                background: 'rgba(149, 192, 149, 0.1)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-glow)',
                borderRadius: '2px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              #{id} {titleText ? `(${titleText})` : ''}
              <button
                type="button"
                onClick={() => handleRemoveId(id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger-color)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  outline: 'none'
                }}
              >
                ✖
              </button>
            </span>
          );
        })}
        {currentIds.length === 0 && (
          <span style={{ fontSize: '10px', color: 'var(--text-dark)', fontStyle: 'italic' }}>
            {lang === 'ru' ? 'Нет связей' : 'No links'}
          </span>
        )}
      </div>

      {/* Selector Dropdown */}
      {availableTriggers.length > 0 ? (
        <select
          value=""
          onChange={e => {
            const val = Number(e.target.value);
            if (val) {
              handleAddId(val);
            }
            e.target.value = ""; // Reset
          }}
          style={{ fontSize: '11px', padding: '4px 8px', width: 'auto', display: 'inline-block' }}
        >
          <option value="">+ {lang === 'ru' ? 'Добавить связь...' : 'Add Link...'}</option>
          {availableTriggers.map(t => (
            <option key={t.pointId} value={t.pointId}>
              #{t.pointId} {t.notificationTitle ? `— ${t.notificationTitle}` : ''}
            </option>
          ))}
        </select>
      ) : (
        currentIds.length > 0 && (
          <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>
            {lang === 'ru' ? 'Все триггеры связаны' : 'All triggers linked'}
          </span>
        )
      )}
    </div>
  );
}

function validateTrigger(trigger, allTriggers, lang) {
  const warnings = [];
  if (!trigger) return warnings;
  
  // 1. Check empty spawnList
  const spawnList = Array.isArray(trigger.spawnList) ? trigger.spawnList : [];
  if (spawnList.length === 0) {
    warnings.push({
      code: 'EMPTY_SPAWN',
      message: lang === 'ru' ? 'Список спавна пуст' : 'Spawn list is empty'
    });
  }

  // 2. Check zero dimensions
  const r = parseFloat(trigger.triggerRadius) || 0;
  const h = parseFloat(trigger.triggerHeight) || 0;
  const wX = parseFloat(trigger.triggerWidthX) || 0;
  const wY = parseFloat(trigger.triggerWidthY) || 0;
  if (r === 0 && h === 0 && wX === 0 && wY === 0) {
    warnings.push({
      code: 'ZERO_DIMENSIONS',
      message: lang === 'ru' ? 'Все размеры триггера равны 0 (зона неактивна)' : 'All trigger dimensions are 0 (will not activate)'
    });
  }

  // 3. Check invalid dependencies target ID
  const checkInvalidLinkIds = (ids, fieldName) => {
    const list = Array.isArray(ids) ? ids : [];
    list.forEach(id => {
      const exists = allTriggers.some(t => Number(t.pointId) === id);
      if (!exists) {
        warnings.push({
          code: 'INVALID_LINK',
          message: lang === 'ru' 
            ? `Связанный триггер #${id} (${fieldName}) не существует` 
            : `Linked trigger #${id} (${fieldName}) does not exist`
        });
      }
    });
  };

  checkInvalidLinkIds(trigger.triggerDependencies, 'Dependencies');
  checkInvalidLinkIds(trigger.triggersToEnableOnEnter, 'OnEnter');
  checkInvalidLinkIds(trigger.triggersToEnableOnFirstSpawn, 'OnFirstSpawn');
  checkInvalidLinkIds(trigger.triggersToEnableOnWin, 'OnWin');
  checkInvalidLinkIds(trigger.triggersToEnableOnLeave, 'OnLeave');

  // 4. Duplicate pointId check
  const sameIdCount = allTriggers.filter(t => t.pointId && Number(t.pointId) === Number(trigger.pointId)).length;
  if (sameIdCount > 1) {
    warnings.push({
      code: 'DUPLICATE_ID',
      message: lang === 'ru' ? `Дублирующийся ID триггера #${trigger.pointId}` : `Duplicate trigger ID #${trigger.pointId}`
    });
  }

  return warnings;
}

export default function MPGSpawnerEditor({
  configs,
  onChangeField,
  onCreateFile,
  onDeleteFile,
  onOpenFile,
  xmlItems = [],
  onStartCoordinatePick,
  selectedSpawnerFilePath,
  selectedSpawnerTriggerIdx,
  onClearSpawnerNavigation
}) {
  const { t, lang } = useTranslation();

  // Search/Filter and Selection states
  const [selectedPointPath, setSelectedPointPath] = useState(null);
  const [selectedTriggerIdx, setSelectedTriggerIdx] = useState(null);
  const [triggerQuery, setTriggerQuery] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('all'); // 'all', 'active', 'disabled', 'issues'
  const [triggerColorFilter, setTriggerColorFilter] = useState('all'); // 'all', 'blue', 'green', 'red', 'yellow'
  const [activeSubTab, setActiveSubTab] = useState('core'); // 'core', 'notifications', 'behavior', 'spawn', 'links', 'mapping'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedEntities, setExpandedEntities] = useState({});
  const [activePresetTab, setActivePresetTab] = useState('infected');
  const [presetMode, setPresetMode] = useState('append');
  const [mappingQueries, setMappingQueries] = useState({});
  const [mappingPages, setMappingPages] = useState({});

  // Input states for creating files, adding admins, etc.
  const [newFileName, setNewFileName] = useState('');
  const [newAdminSteamId, setNewAdminSteamId] = useState('');

  // XML Autocomplete items
  const itemSuggestions = useMemo(() => {
    return Array.isArray(xmlItems) ? xmlItems.sort() : [];
  }, [xmlItems]);

  // Extract Global Config path and Point Config paths
  const globalConfigPath = Object.keys(configs).find(p => p.toLowerCase().endsWith('mpg_spawner/config.json') || p.toLowerCase() === 'config.json') || 'MPG_Spawner/Config.json';
  const globalConfig = configs[globalConfigPath];

  const pointPaths = useMemo(() => {
    return Object.keys(configs).filter(p => {
      const lower = p.toLowerCase();
      return (lower.includes('mpg_spawner/points/') || lower.includes('points/')) && lower.endsWith('.json');
    }).sort((a, b) => {
      const fileA = a.split('/').pop();
      const fileB = b.split('/').pop();
      return fileA.localeCompare(fileB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [configs]);

  const lastNavigatedRef = useRef(null);

  // Reset selected trigger index when switching point config files
  useEffect(() => {
    if (lastNavigatedRef.current && lastNavigatedRef.current.filePath === selectedPointPath) {
      setSelectedTriggerIdx(lastNavigatedRef.current.triggerIdx);
      lastNavigatedRef.current = null;
      return;
    }
    setSelectedTriggerIdx(null);
  }, [selectedPointPath]);

  // Set default selected file on mount
  useEffect(() => {
    if (pointPaths.length > 0 && !selectedPointPath) {
      setSelectedPointPath(pointPaths[0]);
    }
  }, [pointPaths, selectedPointPath]);

  // Sync state when navigated from Tactical Map
  useEffect(() => {
    if (selectedSpawnerFilePath) {
      lastNavigatedRef.current = {
        filePath: selectedSpawnerFilePath,
        triggerIdx: selectedSpawnerTriggerIdx
      };
      setSelectedPointPath(selectedSpawnerFilePath);
      if (selectedSpawnerTriggerIdx !== null && selectedSpawnerTriggerIdx !== undefined) {
        setSelectedTriggerIdx(selectedSpawnerTriggerIdx);
      }
      if (onClearSpawnerNavigation) {
        onClearSpawnerNavigation();
      }
    }
  }, [selectedSpawnerFilePath, selectedSpawnerTriggerIdx, onClearSpawnerNavigation]);

  // Helpers for checking if file is dirty
  const isFileDirty = (path) => {
    const file = configs[path];
    return file && file.success && file.isDirty;
  };

  // -------------------------------------------------------------
  // GLOBAL CONFIG ACTIONS
  // -------------------------------------------------------------
  const handleUpdateGlobal = (field, value) => {
    if (!globalConfig) return;
    onChangeField(globalConfigPath, [field], value);
  };

  const handleAddAdmin = () => {
    if (!newAdminSteamId.trim() || !globalConfig) return;
    const currentAdmins = globalConfig.content.admins || [];
    if (!currentAdmins.includes(newAdminSteamId.trim())) {
      onChangeField(globalConfigPath, ['admins'], [...currentAdmins, newAdminSteamId.trim()]);
    }
    setNewAdminSteamId('');
  };

  const handleRemoveAdmin = (steamId) => {
    if (!globalConfig) return;
    const currentAdmins = globalConfig.content.admins || [];
    onChangeField(globalConfigPath, ['admins'], currentAdmins.filter(id => id !== steamId));
  };

  // -------------------------------------------------------------
  // POINT FILE MANAGEMENT (Create / Delete)
  // -------------------------------------------------------------
  const handleCreatePointFile = () => {
    if (!newFileName.trim()) return;
    let finalName = newFileName.trim();
    if (!finalName.endsWith('.json')) {
      finalName += '.json';
    }
    const prefix = getMpgSpawnerPrefix(configs);
    const relativePath = `${prefix}Points/${finalName}`;

    if (configs[relativePath]) {
      alert(lang === 'ru' ? 'Файл с таким именем уже существует!' : 'A file with this name already exists!');
      return;
    }

    const defaultContent = [];
    onCreateFile(relativePath, defaultContent);

    if (globalConfig && globalConfig.success) {
      const configName = finalName.replace('.json', '');
      const currentPoints = globalConfig.content.pointsConfigs || [];
      if (!currentPoints.includes(configName)) {
        onChangeField(globalConfigPath, ['pointsConfigs'], [...currentPoints, configName]);
      }
    }

    setSelectedPointPath(relativePath);
    setNewFileName('');
  };

  const handleDeletePointFile = (path) => {
    const fileBase = path.split('/').pop().replace('.json', '');
    const msg = lang === 'ru' 
      ? `Вы действительно хотите удалить файл конфигурации точек ${fileBase}.json?` 
      : `Are you sure you want to delete the point configuration file ${fileBase}.json?`;
    
    if (window.confirm(msg)) {
      onDeleteFile(path);
      if (globalConfig && globalConfig.success) {
        const currentPoints = globalConfig.content.pointsConfigs || [];
        onChangeField(globalConfigPath, ['pointsConfigs'], currentPoints.filter(name => name !== fileBase));
      }
      setSelectedPointPath(null);
    }
  };

  const handleToggleFileActive = (fileName, e) => {
    e.stopPropagation();
    if (!globalConfig || !globalConfig.success) return;
    const current = globalConfig.content.pointsConfigs || [];
    let updated;
    if (current.includes(fileName)) {
      updated = current.filter(n => n !== fileName);
    } else {
      updated = [...current, fileName];
    }
    onChangeField(globalConfigPath, ['pointsConfigs'], updated);
  };


  // -------------------------------------------------------------
  // TRIGGER MANAGEMENT (CRUD & Cloning)
  // -------------------------------------------------------------
  const pointFile = selectedPointPath ? configs[selectedPointPath] : null;
  const triggers = (pointFile && pointFile.success && Array.isArray(pointFile.content)) ? pointFile.content : [];
  const selectedTrigger = selectedTriggerIdx !== null ? triggers[selectedTriggerIdx] : null;

  const handleUpdateTriggerField = (field, value) => {
    if (selectedTriggerIdx === null) return;
    onChangeField(selectedPointPath, [selectedTriggerIdx, field], value);
  };

  const getBackupFromStorage = () => {
    if (!selectedTrigger || !selectedPointPath) return null;
    const key = `mute_backup_${selectedPointPath}_${selectedTrigger.pointId}`;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  };

  const handleToggleMuteNotifications = () => {
    if (!selectedTrigger || !selectedPointPath) return;
    const key = `mute_backup_${selectedPointPath}_${selectedTrigger.pointId}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      try {
        const backup = JSON.parse(stored);
        onChangeField(selectedPointPath, [selectedTriggerIdx, 'notificationTextEnter'], backup.notificationTextEnter || '');
        onChangeField(selectedPointPath, [selectedTriggerIdx, 'notificationTextExit'], backup.notificationTextExit || '');
        onChangeField(selectedPointPath, [selectedTriggerIdx, 'notificationTextSpawn'], backup.notificationTextSpawn || '');
        onChangeField(selectedPointPath, [selectedTriggerIdx, 'notificationTextWin'], backup.notificationTextWin || '');
      } catch (e) {
        console.error("Failed to restore notification backup", e);
      }
      localStorage.removeItem(key);
    } else {
      const backup = {
        notificationTextEnter: selectedTrigger.notificationTextEnter || '',
        notificationTextExit: selectedTrigger.notificationTextExit || '',
        notificationTextSpawn: selectedTrigger.notificationTextSpawn || '',
        notificationTextWin: selectedTrigger.notificationTextWin || ''
      };
      localStorage.setItem(key, JSON.stringify(backup));
      onChangeField(selectedPointPath, [selectedTriggerIdx, 'notificationTextEnter'], '');
      onChangeField(selectedPointPath, [selectedTriggerIdx, 'notificationTextExit'], '');
      onChangeField(selectedPointPath, [selectedTriggerIdx, 'notificationTextSpawn'], '');
      onChangeField(selectedPointPath, [selectedTriggerIdx, 'notificationTextWin'], '');
    }
  };


  const handleAddTrigger = () => {
    if (!selectedPointPath || !pointFile) return;

    let nextId = 1;
    if (triggers.length > 0) {
      const ids = triggers.map(t => Number(t.pointId) || 0).filter(id => !isNaN(id));
      if (ids.length > 0) {
        nextId = Math.max(...ids) + 1;
      }
    }

    const newTrigger = {
      pointId: nextId,
      isDebugEnabled: 0,
      isDisabled: 0,
      showVisualisation: 1,
      notificationTitle: `Точка ${nextId}`,
      notificationTextEnter: `Вы вошли в точку ${nextId}.`,
      notificationTextExit: `Вы покинули точку ${nextId}.`,
      notificationTextSpawn: "",
      notificationTextWin: "",
      notificationTime: 5,
      notificationIcon: "set:dayz_gui image:iconSkull",
      triggerDependencies: [],
      triggerDependenciesAnyOf: 0,
      triggersToEnableOnEnter: [],
      triggersToEnableOnFirstSpawn: [],
      triggersToEnableOnWin: [],
      triggersToEnableOnLeave: [],
      triggerPosition: "0.0 0.0 0.0",
      triggerDebugColor: "blue",
      triggerRadius: "20.0",
      triggerHeight: "0.0",
      triggerWidthX: "0.0",
      triggerWidthY: "0.0",
      triggerFirstDelay: "180-300",
      triggerCooldown: "1800",
      triggerSafeDistance: 15.0,
      triggerEnterDelay: 0,
      triggerCleanupOnLeave: 1,
      triggerCleanupOnLunchTime: 0,
      triggerCleanupImmersive: 1,
      triggerCleanupDelay: 30,
      triggerInactiveResetDelay: 0,
      triggerWorkingTime: "0-24",
      triggerDisableOnWin: 0,
      triggerDisableOnLeave: 0,
      spawnPositions: ["0.0 0.0 0.0"],
      spawnRadius: 10.0,
      spawnMin: 1,
      spawnMax: 3,
      spawnCountLimit: 10,
      spawnLoopInside: 1,
      spawnQueueDelay: 1000,
      spawnList: [],
      clearDeathAnimals: 5,
      clearDeathZombies: 5,
      mappingData: []
    };

    onChangeField(selectedPointPath, [triggers.length], newTrigger);
    setSelectedTriggerIdx(triggers.length);
  };

  const handleCloneTrigger = (idx, e) => {
    e.stopPropagation();
    if (!selectedPointPath || !pointFile) return;

    const source = triggers[idx];
    let nextId = 1;
    const ids = triggers.map(t => Number(t.pointId) || 0).filter(id => !isNaN(id));
    if (ids.length > 0) {
      nextId = Math.max(...ids) + 1;
    }

    const cloned = JSON.parse(JSON.stringify(source));
    cloned.pointId = nextId;
    cloned.notificationTitle = `${cloned.notificationTitle} (Copy)`;

    onChangeField(selectedPointPath, [triggers.length], cloned);
    setSelectedTriggerIdx(triggers.length);
  };

  const handleDeleteTrigger = (idx, e) => {
    e.stopPropagation();
    if (!selectedPointPath || !pointFile) return;

    const trigger = triggers[idx];
    const msg = lang === 'ru' 
      ? `Удалить триггер #${trigger.pointId} "${trigger.notificationTitle}"?` 
      : `Delete trigger #${trigger.pointId} "${trigger.notificationTitle}"?`;

    if (window.confirm(msg)) {
      onChangeField(selectedPointPath, [idx], null);
      if (selectedTriggerIdx === idx) {
        setSelectedTriggerIdx(null);
      } else if (selectedTriggerIdx > idx) {
        setSelectedTriggerIdx(selectedTriggerIdx - 1);
      }
    }
  };

  // -------------------------------------------------------------
  // VISUAL SPAWNLIST SUB-EDITOR
  // -------------------------------------------------------------
  const handleUpdateSpawnListItem = (listIdx, key, val) => {
    if (!selectedTrigger) return;
    const rawList = [...(selectedTrigger.spawnList || [])];
    const parsedObj = parseSpawnListEntry(rawList[listIdx]);
    parsedObj[key] = val;
    rawList[listIdx] = formatSpawnListEntry(parsedObj);
    handleUpdateTriggerField('spawnList', rawList);
  };

  const handleAddSpawnListItem = () => {
    if (!selectedTrigger) return;
    const rawList = [...(selectedTrigger.spawnList || [])];
    rawList.push("Animal_CanisLupus_Grey|1|-3|-3|-3|-3");
    handleUpdateTriggerField('spawnList', rawList);
  };

  const handleRemoveSpawnListItem = (listIdx) => {
    if (!selectedTrigger) return;
    const rawList = [...(selectedTrigger.spawnList || [])];
    rawList.splice(listIdx, 1);
    handleUpdateTriggerField('spawnList', rawList);
  };

  // -------------------------------------------------------------
  // MAPPING JSON IMPORTER
  // -------------------------------------------------------------
  const handleImportMappingObjects = (mappingIdx, jsonText) => {
    try {
      if (!jsonText.trim()) return;
      const parsed = JSON.parse(jsonText);
      let objectsToSet = [];

      if (Array.isArray(parsed)) {
        objectsToSet = parsed;
      } else if (parsed && Array.isArray(parsed.Objects)) {
        objectsToSet = parsed.Objects;
      } else if (parsed && Array.isArray(parsed.mappingObjects)) {
        objectsToSet = parsed.mappingObjects;
      } else {
        alert(lang === 'ru' 
          ? 'Неверный формат JSON. Ожидается массив объектов или формат DayZ Editor.' 
          : 'Invalid JSON format. Expected array of objects or DayZ Editor export.');
        return;
      }

      const formattedObjects = objectsToSet.map(obj => ({
        name: obj.name || obj.ClassName || '',
        pos: Array.isArray(obj.pos) ? obj.pos : (obj.Position || [0,0,0]),
        ypr: Array.isArray(obj.ypr) ? obj.ypr : (obj.Orientation || [0,0,0]),
        scale: obj.scale !== undefined ? Number(obj.scale) : 1.0,
        enableCEPersistency: obj.enableCEPersistency !== undefined ? Number(obj.enableCEPersistency) : 0
      }));

      onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mappingIdx, 'mappingObjects'], formattedObjects);
      alert(lang === 'ru' 
        ? `Успешно импортировано объектов маппинга: ${formattedObjects.length}` 
        : `Successfully imported ${formattedObjects.length} mapping objects!`);
    } catch (e) {
      alert((lang === 'ru' ? 'Ошибка разбора JSON: ' : 'JSON Parse Error: ') + e.message);
    }
  };

  // Filter triggers based on search query, enabled status, validation warnings, and debug color
  const filteredTriggers = triggers.map((t, idx) => ({ ...t, originalIndex: idx })).filter(trigger => {
    // 1. Search Query Filter
    if (triggerQuery.trim()) {
      const query = triggerQuery.toLowerCase().trim();
      const idMatch = String(trigger.pointId).includes(query);
      const titleMatch = trigger.notificationTitle && trigger.notificationTitle.toLowerCase().includes(query);
      if (!idMatch && !titleMatch) return false;
    }

    // 2. Status/Issue Filter
    if (triggerFilter === 'active' && trigger.isDisabled === 1) return false;
    if (triggerFilter === 'disabled' && trigger.isDisabled !== 1) return false;
    if (triggerFilter === 'issues') {
      const warnings = validateTrigger(trigger, triggers, lang);
      if (warnings.length === 0) return false;
    }

    // 3. Color Filter
    if (triggerColorFilter !== 'all') {
      const color = trigger.triggerDebugColor || 'blue';
      if (color !== triggerColorFilter) return false;
    }

    return true;
  });

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* ────────────────── PANEL 1: FILES & GLOBAL CONFIG (Width: 260px) ────────────────── */}
      <div style={{
        width: isSidebarCollapsed ? '0px' : '260px',
        background: 'var(--bg-secondary)',
        borderRight: isSidebarCollapsed ? 'none' : '1px solid var(--border-color)',
        display: isSidebarCollapsed ? 'none' : 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0,
        height: '100%'
      }}>
        {/* Global Configuration card */}
        {globalConfig && globalConfig.success && (
          <div style={{
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>
                // {t('spawner_global_config').toUpperCase()}
              </div>
              {isFileDirty(globalConfigPath) && <span className="badge-dirty" />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label className="checkbox-container">
                  <div className={`checkbox-custom ${globalConfig.content.isModDisabled === 0 ? 'checked' : ''}`}
                    onClick={() => handleUpdateGlobal('isModDisabled', globalConfig.content.isModDisabled === 0 ? 1 : 0)} />
                  <span style={{ fontSize: '11px' }}>{lang === 'ru' ? 'Вкл' : 'On'}</span>
                </label>

                <label className="checkbox-container">
                  <div className={`checkbox-custom ${globalConfig.content.isDebugEnabled === 1 ? 'checked' : ''}`}
                    onClick={() => handleUpdateGlobal('isDebugEnabled', globalConfig.content.isDebugEnabled === 1 ? 0 : 1)} />
                  <span style={{ fontSize: '11px' }}>{lang === 'ru' ? 'Дебаг' : 'Debug'}</span>
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    placeholder="SteamID..."
                    value={newAdminSteamId}
                    onChange={e => setNewAdminSteamId(e.target.value)}
                    style={{ fontSize: '11px', padding: '4px 6px' }}
                  />
                  <button className="btn btn-accent" onClick={handleAddAdmin} style={{ padding: '4px 8px', fontSize: '10px' }}>
                    +
                  </button>
                </div>

                <div style={{
                  maxHeight: '65px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  borderRadius: '2px',
                  padding: '2px'
                }}>
                  {Array.isArray(globalConfig.content.admins) && globalConfig.content.admins.length > 0 ? (
                    globalConfig.content.admins.map(id => (
                      <div key={id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '9px',
                        padding: '2px 4px',
                        borderBottom: '1px solid rgba(30, 48, 30, 0.2)'
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{id}</span>
                        <button
                          onClick={() => handleRemoveAdmin(id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: 0 }}
                        >
                          ✖
                        </button>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '2px', fontSize: '9px', color: 'var(--text-dark)', textAlign: 'center' }}>
                      No admins
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Files switcher title */}
        <div style={{ padding: '10px 12px 6px 12px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>
            // {t('spawner_points_configs').toUpperCase()}
          </div>
        </div>

        {/* List of points files */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {pointPaths.map(path => {
            const isSelected = path === selectedPointPath;
            const hasUnsaved = isFileDirty(path);
            const name = path.split('/').pop().replace('.json', '');
            const count = (configs[path] && configs[path].success && Array.isArray(configs[path].content))
              ? configs[path].content.length
              : 0;

            const isActive = globalConfig?.success && Array.isArray(globalConfig.content.pointsConfigs) && globalConfig.content.pointsConfigs.includes(name);

            return (
              <div
                key={path}
                onClick={() => setSelectedPointPath(path)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  background: isSelected ? 'rgba(149, 192, 149, 0.08)' : 'transparent',
                  borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                  color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)',
                  borderBottom: '1px solid rgba(30, 48, 30, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                  <div 
                    className={`checkbox-custom ${isActive ? 'checked' : ''}`}
                    onClick={(e) => handleToggleFileActive(name, e)}
                    style={{ flexShrink: 0, width: '12px', height: '12px' }}
                    title={lang === 'ru' ? 'Активен в глобальном конфиге спавнера' : 'Active in global spawner config'}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      {name}.json
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                      {lang === 'ru' ? `Зон: ${count}` : `Zones: ${count}`}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {hasUnsaved && <span className="badge-dirty" />}
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenFile(path); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    title="RAW JSON"
                  >
                    📝
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePointFile(path); }}
                    style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: 0 }}
                  >
                    ✖
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create new file form */}
        <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="text"
              placeholder="e.g. 1_triggers"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              style={{ fontSize: '11px', padding: '6px' }}
            />
            <button className="btn btn-accent" onClick={handleCreatePointFile} style={{ padding: '6px 10px', fontSize: '10px' }}>
              +
            </button>
          </div>
        </div>
      </div>

      {/* Split-pane Sidebar Toggle Bar */}
      <div 
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        style={{
          width: '12px',
          background: 'var(--bg-tertiary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '9px',
          userSelect: 'none',
          transition: 'all 0.2s',
          height: '100%',
          flexShrink: 0
        }}
        title={isSidebarCollapsed ? (lang === 'ru' ? "Развернуть меню файлов" : "Expand Sidebar") : (lang === 'ru' ? "Свернуть меню файлов" : "Collapse Sidebar")}
      >
        {isSidebarCollapsed ? '▶' : '◀'}
      </div>

      {/* ────────────────── PANEL 2: TRIGGERS LIST (Width: 280px) ────────────────── */}
      <div style={{
        width: '280px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0
      }}>
        {pointFile ? (
          <>
            <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>
                  // {lang === 'ru' ? 'ТРИГГЕРЫ ФАЙЛА' : 'FILE TRIGGERS'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>
                  Total: {triggers.length}
                </span>
              </div>

              <input
                type="text"
                placeholder={t('spawner_search_placeholder')}
                value={triggerQuery}
                onChange={e => setTriggerQuery(e.target.value)}
                style={{ fontSize: '12px', padding: '6px' }}
              />

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-primary)', padding: '2px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                {[
                  { id: 'all', label: lang === 'ru' ? 'Все' : 'All' },
                  { id: 'active', label: lang === 'ru' ? 'Актив' : 'Active' },
                  { id: 'disabled', label: lang === 'ru' ? 'Выкл' : 'Off' },
                  { id: 'issues', label: lang === 'ru' ? 'Ошибки' : 'Issues' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTriggerFilter(f.id)}
                    style={{
                      flex: 1,
                      padding: '3px 2px',
                      fontSize: '9px',
                      background: triggerFilter === f.id ? 'var(--border-color)' : 'transparent',
                      color: triggerFilter === f.id ? 'var(--text-glow)' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      outline: 'none'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Color Filter Dots Selector */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', padding: '2px 0' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-heading)', fontWeight: 'bold' }}>
                  {lang === 'ru' ? 'Цвет:' : 'Color:'}
                </span>
                {[
                  { id: 'all', color: 'var(--text-secondary)' },
                  { id: 'blue', color: '#387cff' },
                  { id: 'green', color: '#559655' },
                  { id: 'red', color: '#ff4c4c' },
                  { id: 'yellow', color: '#ebd667' }
                ].map(c => {
                  const isSelected = triggerColorFilter === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTriggerColorFilter(c.id)}
                      style={{
                        width: c.id === 'all' ? 'auto' : '10px',
                        height: c.id === 'all' ? 'auto' : '10px',
                        borderRadius: c.id === 'all' ? '2px' : '50%',
                        backgroundColor: c.id === 'all' ? 'transparent' : c.color,
                        border: isSelected 
                          ? (c.id === 'all' ? '1px solid var(--text-glow)' : '2px solid var(--text-glow)') 
                          : (c.id === 'all' ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)'),
                        fontSize: '8px',
                        fontWeight: 'bold',
                        color: isSelected ? 'var(--text-glow)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: c.id === 'all' ? '1px 3px' : 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        outline: 'none',
                        lineHeight: 1
                      }}
                      title={c.id.toUpperCase()}
                    >
                      {c.id === 'all' ? 'ALL' : ''}
                    </button>
                  );
                })}
              </div>

              <button className="btn btn-accent" onClick={handleAddTrigger} style={{ width: '100%', justifyContent: 'center', padding: '6px 12px', fontSize: '11px' }}>
                {t('spawner_add_trigger')}
              </button>
            </div>

            {/* Scrollable list of triggers */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredTriggers.length > 0 ? (
                filteredTriggers.map(({ originalIndex, ...trigger }) => {
                  const isSelected = selectedTriggerIdx === originalIndex;
                  const warnings = validateTrigger(trigger, triggers, lang);
                  const hasWarnings = warnings.length > 0;
                  return (
                    <div
                      key={`${trigger.pointId}-${originalIndex}`}
                      onClick={() => setSelectedTriggerIdx(originalIndex)}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(149, 192, 149, 0.08)' : 'transparent',
                        borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                        borderBottom: '1px solid rgba(30, 48, 30, 0.1)',
                        transition: 'all 0.1s',
                        opacity: trigger.isDisabled ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflow: 'hidden', flex: 1 }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden'
                          }}>
                            #{trigger.pointId} — {trigger.notificationTitle || 'Unnamed'}
                          </span>
                          {hasWarnings && (
                            <span 
                              style={{ 
                                color: 'var(--warning-color)', 
                                cursor: 'help', 
                                fontSize: '11px',
                                flexShrink: 0
                              }}
                              title={warnings.map(w => w.message).join('\n')}
                            >
                              ⚠️
                            </span>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn btn-warning"
                            onClick={(e) => handleCloneTrigger(originalIndex, e)}
                            style={{ padding: '2px 4px', fontSize: '8px', letterSpacing: 0 }}
                            title="Clone"
                          >
                            📋
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={(e) => handleDeleteTrigger(originalIndex, e)}
                            style={{ padding: '2px 4px', fontSize: '8px', letterSpacing: 0 }}
                            title="Delete"
                          >
                            ✖
                          </button>
                        </div>
                      </div>

                      {/* Info labels row */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {trigger.isDisabled === 1 && (
                          <span style={{ fontSize: '8px', padding: '0 3px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '2px' }}>
                            OFF
                          </span>
                        )}
                        {trigger.showVisualisation === 1 && (
                          <span style={{ fontSize: '8px', padding: '0 3px', border: '1px solid var(--accent-color)', color: 'var(--accent-glow)', borderRadius: '2px' }}>
                            VISUAL
                          </span>
                        )}
                        {trigger.triggerDebugColor && (
                          <span style={{
                            fontSize: '8px',
                            padding: '0 3px',
                            border: `1px solid ${trigger.triggerDebugColor}`,
                            color: trigger.triggerDebugColor,
                            borderRadius: '2px',
                            textTransform: 'uppercase'
                          }}>
                            {trigger.triggerDebugColor}
                          </span>
                        )}
                        <span style={{ fontSize: '8px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          R: {trigger.triggerRadius}m
                        </span>
                        {trigger.spawnList && trigger.spawnList.length > 0 && (
                          <span style={{ fontSize: '8px', color: 'var(--warning-color)' }}>
                            Spawns: {trigger.spawnList.length}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                  {lang === 'ru' ? 'Нет триггеров' : 'No triggers match'}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: '20px', textAlign: 'center', fontSize: '12px' }}>
            <span>{lang === 'ru' ? 'Выберите файл точек слева' : 'Select a points file in the sidebar'}</span>
          </div>
        )}
      </div>

      {/* ────────────────── PANEL 3: ACTIVE TRIGGER EDITOR (Flex: 1) ────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {selectedTrigger ? (
          <>
            {/* Editor header containing ID & Title */}
            <div style={{
              padding: '12px 24px',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {lang === 'ru' ? 'Редактирование триггера' : 'Editing Trigger'} #{selectedTrigger.pointId}
              </div>
              <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '20px' }}>
                {selectedTrigger.notificationTitle || 'Unnamed Trigger'}
              </h2>
            </div>

            {/* Diagnostics Warnings Banner */}
            {(() => {
              const activeWarnings = validateTrigger(selectedTrigger, triggers, lang);
              if (activeWarnings.length === 0) return null;
              return (
                <div style={{
                  background: 'rgba(235, 214, 103, 0.06)',
                  borderBottom: '1px solid rgba(235, 214, 103, 0.2)',
                  padding: '10px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--warning-color)', fontWeight: 'bold' }}>
                    <span>⚠️ {lang === 'ru' ? 'ЗАМЕЧАНИЯ ПО ДИАГНОСТИКЕ ТОЧКИ:' : 'TRIGGER DIAGNOSTICS WARNINGS:'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '16px' }}>
                    {activeWarnings.map((w, idx) => (
                      <span key={idx} style={{ fontSize: '10px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        - {w.message}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Editor horizontal Sub-Tabs navigation row */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              overflowX: 'auto',
              flexShrink: 0,
              userSelect: 'none'
            }}>
              {[
                { id: 'core', label: lang === 'ru' ? 'Геометрия' : 'Geometry' },
                { id: 'notifications', label: lang === 'ru' ? 'Нотификации' : 'Notifications' },
                { id: 'behavior', label: lang === 'ru' ? 'Поведение' : 'Behavior' },
                { id: 'spawn', label: lang === 'ru' ? 'Спавн' : 'Spawning' },
                { id: 'links', label: lang === 'ru' ? 'Связи и Очистка' : 'Links & Events' },
                { id: 'mapping', label: lang === 'ru' ? 'Маппинг' : 'Mapping' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  style={{
                    padding: '10px 16px',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    background: activeSubTab === tab.id ? 'var(--bg-primary)' : 'transparent',
                    border: 'none',
                    color: activeSubTab === tab.id ? 'var(--text-glow)' : 'var(--text-secondary)',
                    borderBottom: activeSubTab === tab.id ? '2px solid var(--text-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    outline: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable Editor Panels Content */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
              
              {/* SUBTAB 1: CORE / GEOMETRY */}
              {activeSubTab === 'core' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        <span className="label-with-help">{t('spawner_point_id')}<HelpIcon tipKey="tip_mpg_point_id" /></span>
                      </label>
                      <input
                        type="number"
                        value={selectedTrigger.pointId || ''}
                        onChange={e => handleUpdateTriggerField('pointId', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        <span className="label-with-help">{t('spawner_trigger_debug_color')}<HelpIcon tipKey="tip_mpg_debug_color" /></span>
                      </label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', height: '34px' }}>
                        {[
                          { value: 'blue', color: '#387cff', glow: 'rgba(56, 124, 255, 0.4)' },
                          { value: 'green', color: '#559655', glow: 'rgba(85, 150, 85, 0.4)' },
                          { value: 'red', color: '#ff4c4c', glow: 'rgba(255, 76, 76, 0.4)' },
                          { value: 'yellow', color: '#ebd667', glow: 'rgba(235, 214, 103, 0.4)' }
                        ].map(c => {
                          const isColorSelected = (selectedTrigger.triggerDebugColor || 'blue') === c.value;
                          return (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => handleUpdateTriggerField('triggerDebugColor', c.value)}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: c.color,
                                border: isColorSelected ? '2px solid var(--text-glow)' : '2px solid transparent',
                                boxShadow: isColorSelected ? `0 0 10px ${c.glow}` : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                padding: 0,
                                outline: 'none'
                              }}
                              title={c.value.toUpperCase()}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                   <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      <span className="label-with-help">{t('spawner_trigger_position')} (X Z Y | rotY rotX rotZ)<HelpIcon tipKey="tip_mpg_position" /></span>
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={selectedTrigger.triggerPosition || ''}
                        onChange={e => handleUpdateTriggerField('triggerPosition', e.target.value)}
                        placeholder="e.g. 4246.0 333.7 5586.7 | 0 0 0"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-accent"
                        onClick={() => {
                          if (onStartCoordinatePick) {
                            onStartCoordinatePick('spawner', ({ x, z }) => {
                              const oldPos = selectedTrigger.triggerPosition || "0.0 0.0 0.0";
                              const newPos = updateCoordsInString(oldPos, x, z);
                              handleUpdateTriggerField('triggerPosition', newPos);
                            });
                          }
                        }}
                        style={{ padding: '0 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                      >
                        🗺️ {lang === 'ru' ? 'Карта' : 'Pick'}
                      </button>
                    </div>
                  </div>

                  {/* Dimensions Box */}
                  <FormCard
                    bg="secondary"
                    title={lang === 'ru' ? '📐 Размеры триггера (Поддерживают диапазоны, например 10.0-15.0)' : '📐 Trigger Dimensions (Supports ranges, e.g. 10.0-15.0)'}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          <span className="label-with-help">{t('spawner_trigger_radius')}<HelpIcon tipKey="tip_mpg_radius" /></span>
                        </label>
                        <input
                          type="text"
                          value={selectedTrigger.triggerRadius || ''}
                          onChange={e => handleUpdateTriggerField('triggerRadius', e.target.value)}
                          placeholder="20.0"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          <span className="label-with-help">{t('spawner_trigger_height')}<HelpIcon tipKey="tip_mpg_height" /></span>
                        </label>
                        <input
                          type="text"
                          value={selectedTrigger.triggerHeight || ''}
                          onChange={e => handleUpdateTriggerField('triggerHeight', e.target.value)}
                          placeholder="0.0"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          <span className="label-with-help">{t('spawner_trigger_width_x')}<HelpIcon tipKey="tip_mpg_width_x" /></span>
                        </label>
                        <input
                          type="text"
                          value={selectedTrigger.triggerWidthX || ''}
                          onChange={e => handleUpdateTriggerField('triggerWidthX', e.target.value)}
                          placeholder="0.0"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          <span className="label-with-help">{t('spawner_trigger_width_y')}<HelpIcon tipKey="tip_mpg_width_y" /></span>
                        </label>
                        <input
                          type="text"
                          value={selectedTrigger.triggerWidthY || ''}
                          onChange={e => handleUpdateTriggerField('triggerWidthY', e.target.value)}
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                      ℹ️ {lang === 'ru' 
                        ? 'Если высота задана, триггер станет цилиндрическим. Если заданы длина Х и Y, он станет кубическим.' 
                        : 'If height is set, it becomes a cylinder. If Width X and Y are set, it becomes cubic (ignoring radius).'}
                    </div>
                  </FormCard>

                  {/* Core switches */}
                  <FormCard bg="secondary" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label className="checkbox-container">
                      <div className={`checkbox-custom ${selectedTrigger.isDisabled === 1 ? 'checked' : ''}`}
                        onClick={() => handleUpdateTriggerField('isDisabled', selectedTrigger.isDisabled === 1 ? 0 : 1)} />
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                        <span className="label-with-help">{t('spawner_is_disabled')}<HelpIcon tipKey="tip_mpg_is_disabled" /></span>
                      </span>
                    </label>

                    <label className="checkbox-container">
                      <div className={`checkbox-custom ${selectedTrigger.isDebugEnabled === 1 ? 'checked' : ''}`}
                        onClick={() => handleUpdateTriggerField('isDebugEnabled', selectedTrigger.isDebugEnabled === 1 ? 0 : 1)} />
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                        <span className="label-with-help">{t('spawner_is_debug_enabled')}<HelpIcon tipKey="tip_mpg_is_debug" /></span>
                      </span>
                    </label>

                    <label className="checkbox-container">
                      <div className={`checkbox-custom ${selectedTrigger.showVisualisation === 1 ? 'checked' : ''}`}
                        onClick={() => handleUpdateTriggerField('showVisualisation', selectedTrigger.showVisualisation === 1 ? 0 : 1)} />
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                        <span className="label-with-help">{t('spawner_show_visualisation')} (Требуется мод @MPG_spawn_zone)<HelpIcon tipKey="tip_mpg_show_vis" /></span>
                      </span>
                    </label>
                  </FormCard>

                </div>
              )}

              {/* SUBTAB 2: NOTIFICATIONS */}
              {activeSubTab === 'notifications' && (() => {
                const backupInStorage = getBackupFromStorage();
                const isMuted = selectedTrigger && 
                  (backupInStorage !== null || 
                   (!selectedTrigger.notificationTextEnter && 
                    !selectedTrigger.notificationTextExit && 
                    !selectedTrigger.notificationTextSpawn && 
                    !selectedTrigger.notificationTextWin));

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
                    
                    {/* Notification Mute / Unmute Banner & Button */}
                    <div style={{
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      padding: '12px 16px',
                      borderRadius: '2px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: isMuted ? 'var(--warning-color)' : 'var(--text-glow)' }}>
                          {isMuted 
                            ? (lang === 'ru' ? '⚠️ Нотификации отключены (заглушены)' : '⚠️ Notifications Muted') 
                            : (lang === 'ru' ? '✓ Нотификации активны' : '✓ Notifications Active')}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {isMuted 
                            ? (lang === 'ru' ? 'Текстовые поля очищены, чтобы мод не отправлял сообщения в игре.' : 'Notification text fields are set to empty to disable them in-game.')
                            : (lang === 'ru' ? 'Сообщения будут отображаться игрокам при входе, спавне, выходе и победе.' : 'Messages will show to players on enter, spawn, leave, and win events.')}
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        className={isMuted ? "btn btn-accent" : "btn btn-warning"}
                        onClick={handleToggleMuteNotifications}
                        style={{ padding: '6px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                      >
                        {isMuted 
                          ? (lang === 'ru' ? '🔊 Включить нотификации' : '🔊 Unmute Notifications')
                          : (lang === 'ru' ? '🔇 Заглушить (Отключить)' : '🔇 Mute (Disable) Notifications')}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          <span className="label-with-help">{t('spawner_notification_title')}<HelpIcon tipKey="tip_mpg_notif_enter" /></span>
                        </label>
                        <input
                          type="text"
                          value={selectedTrigger.notificationTitle || ''}
                          onChange={e => handleUpdateTriggerField('notificationTitle', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          <span className="label-with-help">{t('spawner_notification_time')}<HelpIcon tipKey="tip_mpg_notif_time" /></span>
                        </label>
                        <input
                          type="number"
                          value={selectedTrigger.notificationTime !== undefined ? selectedTrigger.notificationTime : 5}
                          onChange={e => handleUpdateTriggerField('notificationTime', Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        <span className="label-with-help">{t('spawner_notification_icon')}<HelpIcon tipKey="tip_mpg_notif_icon" /></span>
                      </label>
                      <input
                        type="text"
                        value={selectedTrigger.notificationIcon || ''}
                        onChange={e => handleUpdateTriggerField('notificationIcon', e.target.value)}
                        placeholder="set:dayz_gui image:iconSkull"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        <span className="label-with-help">{t('spawner_notification_text_enter')}<HelpIcon tipKey="tip_mpg_notif_enter" /></span>
                      </label>
                      <input
                        type="text"
                        value={selectedTrigger.notificationTextEnter || ''}
                        onChange={e => handleUpdateTriggerField('notificationTextEnter', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        <span className="label-with-help">{t('spawner_notification_text_exit')}<HelpIcon tipKey="tip_mpg_notif_exit" /></span>
                      </label>
                      <input
                        type="text"
                        value={selectedTrigger.notificationTextExit || ''}
                        onChange={e => handleUpdateTriggerField('notificationTextExit', e.target.value)}
                      />
                    </div>

                    <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: '2px', background: 'var(--bg-secondary)' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                        <span className="label-with-help">{t('spawner_notification_text_spawn')}<HelpIcon tipKey="tip_mpg_notif_spawn" /></span>
                      </label>
                      <input
                        type="text"
                        value={selectedTrigger.notificationTextSpawn || ''}
                        onChange={e => handleUpdateTriggerField('notificationTextSpawn', e.target.value)}
                        placeholder="Где-то рядом %2 %1 %3.;появил|ся|ось|ось;медвед|ь|я|ей"
                      />

                      {selectedTrigger.notificationTextSpawn && selectedTrigger.notificationTextSpawn.includes(';') ? (
                        <div style={{
                          marginTop: '10px',
                          fontSize: '11px',
                          color: 'var(--warning-color)',
                          padding: '8px',
                          border: '1px solid rgba(235,214,103,0.2)',
                          background: 'rgba(235,214,103,0.03)',
                          borderRadius: '2px',
                          lineHeight: '1.4'
                        }}>
                          <strong>💡 {lang === 'ru' ? 'Правила склонения слов:' : 'Pluralization override preview:'}</strong>
                          <div style={{ marginTop: '4px' }}>
                            {lang === 'ru' ? (
                              <>
                                - Разделитель частей: точка с запятой `;`<br />
                                - Часть 1: Текст с плейсхолдерами `%1` (число), `%2` (глагол), `%3` (сущ.)<br />
                                - Часть 2: глагол для (1, 2, 5) спавнов, разделенный `|`<br />
                                - Часть 3: существительное (1, 2, 5), разделенное `|`<br />
                                Пример: 1 медведь, 3 медведя, 20 медведей.
                              </>
                            ) : (
                              <>
                                - Sections separator: `;`<br />
                                - Section 1: Text with placeholders `%1` (count), `%2` (verb), `%3` (noun)<br />
                                - Section 2: verb variations for (1, 2, 5) spawns separated by `|`<br />
                                - Section 3: noun variations for (1, 2, 5) spawns separated by `|`
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {lang === 'ru' ? 'Введите обычную нотификацию или оставьте пустой для отключения.' : 'Enter normal text or leave empty to disable.'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {t('spawner_notification_text_win')}
                      </label>
                      <input
                        type="text"
                        value={selectedTrigger.notificationTextWin || ''}
                        onChange={e => handleUpdateTriggerField('notificationTextWin', e.target.value)}
                      />
                    </div>

                  </div>
                );
              })()}

              {/* SUBTAB 3: TIMINGS & BEHAVIOR */}
              {activeSubTab === 'behavior' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {t('spawner_trigger_first_delay')} (s)
                      </label>
                      <input
                        type="text"
                        value={selectedTrigger.triggerFirstDelay || ''}
                        onChange={e => handleUpdateTriggerField('triggerFirstDelay', e.target.value)}
                        placeholder="180-300"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }} className="label-with-help">
                        {t('spawner_trigger_cooldown')} (s)
                        <HelpIcon tipKey="tip_mpg_cooldown" />
                      </label>
                      <input
                        type="text"
                        value={selectedTrigger.triggerCooldown || ''}
                        onChange={e => handleUpdateTriggerField('triggerCooldown', e.target.value)}
                        placeholder="1800"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {t('spawner_trigger_safe_distance')} (m)
                      </label>
                      <input
                        type="number"
                        value={selectedTrigger.triggerSafeDistance !== undefined ? selectedTrigger.triggerSafeDistance : 15}
                        onChange={e => handleUpdateTriggerField('triggerSafeDistance', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {t('spawner_trigger_enter_delay')} (s)
                      </label>
                      <input
                        type="number"
                        value={selectedTrigger.triggerEnterDelay !== undefined ? selectedTrigger.triggerEnterDelay : 0}
                        onChange={e => handleUpdateTriggerField('triggerEnterDelay', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {t('spawner_trigger_working_time')}
                      </label>
                      <input
                        type="text"
                        value={selectedTrigger.triggerWorkingTime || '0-24'}
                        onChange={e => handleUpdateTriggerField('triggerWorkingTime', e.target.value)}
                        placeholder="0-24"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {lang === 'ru' ? 'Задержка неактивности (s)' : 'Inactive Reset Delay (s)'}
                      </label>
                      <input
                        type="number"
                        value={selectedTrigger.triggerInactiveResetDelay !== undefined ? selectedTrigger.triggerInactiveResetDelay : 0}
                        onChange={e => handleUpdateTriggerField('triggerInactiveResetDelay', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: '2px', background: 'var(--bg-secondary)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-glow)', marginBottom: '8px' }}>
                      📋 {lang === 'ru' ? 'Описание таймингов' : 'Timings Descriptions'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>- <strong>First Activation Delay</strong>: {lang === 'ru' ? 'Задержка запуска триггера после старта сервера.' : 'Delay before trigger registers first events.'}</span>
                      <span>- <strong>Trigger Cooldown</strong>: {lang === 'ru' ? 'Задержка между повторными спавнами (в секундах).' : 'Cooldown before next spawn trigger executes.'}</span>
                      <span>- <strong>Working Time</strong>: {lang === 'ru' ? 'Расписание работы по игровому времени (например, "8-18" сработает только днем).' : 'Schedule limits based on DayZ server time.'}</span>
                      <span>- <strong>Inactive Reset</strong>: {lang === 'ru' ? 'Сброс триггера, если заспавненные существа не получили урона за это время.' : 'Reset trigger if no damage is dealt to spawned bots.'}</span>
                    </div>
                  </div>

                </div>
              )}

              {/* SUBTAB 4: SPAWNS */}
              {activeSubTab === 'spawn' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Spawn parameters row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', maxWidth: '1200px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('spawner_spawn_min')}</label>
                      <input
                        type="number"
                        value={selectedTrigger.spawnMin !== undefined ? selectedTrigger.spawnMin : 1}
                        onChange={e => handleUpdateTriggerField('spawnMin', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('spawner_spawn_max')}</label>
                      <input
                        type="number"
                        value={selectedTrigger.spawnMax !== undefined ? selectedTrigger.spawnMax : 3}
                        onChange={e => handleUpdateTriggerField('spawnMax', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('spawner_spawn_radius')} (m)</label>
                      <input
                        type="number"
                        value={selectedTrigger.spawnRadius !== undefined ? selectedTrigger.spawnRadius : 10}
                        onChange={e => handleUpdateTriggerField('spawnRadius', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('spawner_spawn_count_limit')}</label>
                      <input
                        type="number"
                        value={selectedTrigger.spawnCountLimit !== undefined ? selectedTrigger.spawnCountLimit : 10}
                        onChange={e => handleUpdateTriggerField('spawnCountLimit', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Задержка очереди (ms)' : 'Queue Delay (ms)'}</label>
                      <input
                        type="number"
                        value={selectedTrigger.spawnQueueDelay !== undefined ? selectedTrigger.spawnQueueDelay : 1000}
                        onChange={e => handleUpdateTriggerField('spawnQueueDelay', Number(e.target.value))}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: '15px' }}>
                      <label className="checkbox-container">
                        <div className={`checkbox-custom ${selectedTrigger.spawnLoopInside === 1 ? 'checked' : ''}`}
                          onClick={() => handleUpdateTriggerField('spawnLoopInside', selectedTrigger.spawnLoopInside === 1 ? 0 : 1)} />
                        <span style={{ fontSize: '12px' }}>{t('spawner_spawn_loop_inside')}</span>
                      </label>
                    </div>
                  </div>

                  {/* Spawn Positions (independent scrolling container) */}
                  <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: '2px', background: 'var(--bg-secondary)', maxWidth: '1200px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-glow)' }}>
                        📍 {lang === 'ru' ? 'Координаты точек спавна существ:' : 'Spawn positions coordinates:'}
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {/* Ground Y = 0 */}
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            const list = Array.isArray(selectedTrigger.spawnPositions) ? selectedTrigger.spawnPositions : [];
                            const updated = list.map(item => {
                              const parts = item.split('|');
                              const coords = parts[0].trim().split(/\s+/);
                              coords[1] = "0.0"; // set Y to 0.0
                              parts[0] = coords.join(' ');
                              return parts.join(' | ');
                            });
                            handleUpdateTriggerField('spawnPositions', updated);
                          }}
                          style={{ padding: '4px 8px', fontSize: '9px', borderColor: 'var(--border-color)' }}
                          title={lang === 'ru' ? 'Сбросить высоту Y всех точек до 0.0 (на землю)' : 'Set Y elevation of all positions to 0.0 (ground level)'}
                        >
                          ⛰️ {lang === 'ru' ? 'На землю' : 'Ground Y=0'}
                        </button>
                        
                        {/* Match Trigger Y */}
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            const parentPosStr = selectedTrigger.triggerPosition || "0.0 0.0 0.0";
                            const parentParts = parentPosStr.split('|');
                            const parentCoords = parentParts[0].trim().split(/\s+/);
                            const triggerY = parentCoords[1] || "0.0";

                            const list = Array.isArray(selectedTrigger.spawnPositions) ? selectedTrigger.spawnPositions : [];
                            const updated = list.map(item => {
                              const parts = item.split('|');
                              const coords = parts[0].trim().split(/\s+/);
                              coords[1] = triggerY; // match parent trigger Y
                              parts[0] = coords.join(' ');
                              return parts.join(' | ');
                            });
                            handleUpdateTriggerField('spawnPositions', updated);
                          }}
                          style={{ padding: '4px 8px', fontSize: '9px', borderColor: 'var(--border-color)' }}
                          title={lang === 'ru' ? 'Выровнять высоту Y всех точек под высоту триггера' : 'Align Y elevation of all positions with parent trigger height'}
                        >
                          📏 {lang === 'ru' ? 'Выровнять Y' : 'Match Trig Y'}
                        </button>

                        {/* Batch Place on Map */}
                        <button
                          type="button"
                          className="btn btn-accent"
                          onClick={() => {
                            if (onStartCoordinatePick) {
                              onStartCoordinatePick('spawner', (coords) => {
                                const parentPosStr = selectedTrigger.triggerPosition || "0.0 0.0 0.0";
                                const parentParts = parentPosStr.split('|');
                                const parentCoords = parentParts[0].trim().split(/\s+/);
                                const triggerY = parentCoords[1] || "0.0";

                                onChangeField(selectedPointPath, [selectedTriggerIdx, 'spawnPositions'], (prevList) => {
                                  const list = Array.isArray(prevList) ? prevList : [];
                                  return [...list, `${coords.x} ${triggerY} ${coords.z}`];
                                });
                              }, { mode: 'batch' });
                            }
                          }}
                          style={{ padding: '4px 8px', fontSize: '9px' }}
                          title={lang === 'ru' ? 'Расставить множество точек кликами по карте' : 'Place multiple coordinates by clicking on the map'}
                        >
                          🗺️ {lang === 'ru' ? 'Пакетная расстановка' : 'Batch Place'}
                        </button>

                        {/* Add Single Manual Position */}
                        <button 
                          className="btn" 
                          type="button"
                          onClick={() => {
                            const list = Array.isArray(selectedTrigger.spawnPositions) ? selectedTrigger.spawnPositions : [];
                            const triggerY = selectedTrigger.triggerPosition.split('|')[0].trim().split(/\s+/)[1] || "0.0";
                            handleUpdateTriggerField('spawnPositions', [...list, `0.0 ${triggerY} 0.0`]);
                          }} 
                          style={{ padding: '4px 10px', fontSize: '9px' }}
                        >
                          + {lang === 'ru' ? 'Точка' : 'Add'}
                        </button>
                      </div>
                    </div>

                    <div style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      paddingRight: '6px'
                    }}>
                      {Array.isArray(selectedTrigger.spawnPositions) && selectedTrigger.spawnPositions.length > 0 ? (
                        selectedTrigger.spawnPositions.map((pos, posIdx) => (
                          <div key={posIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={pos}
                              onChange={e => {
                                const list = [...selectedTrigger.spawnPositions];
                                list[posIdx] = e.target.value;
                                handleUpdateTriggerField('spawnPositions', list);
                              }}
                              style={{ fontSize: '12px', padding: '6px', flex: 1 }}
                            />
                            <button
                              type="button"
                              className="btn btn-accent"
                              onClick={() => {
                                if (onStartCoordinatePick) {
                                  onStartCoordinatePick('spawner', ({ x, z }) => {
                                    const list = [...selectedTrigger.spawnPositions];
                                    const oldPos = list[posIdx] || "0.0 0.0 0.0";
                                    const newPos = updateCoordsInString(oldPos, x, z);
                                    list[posIdx] = newPos;
                                    handleUpdateTriggerField('spawnPositions', list);
                                  });
                                }
                              }}
                              style={{ padding: '0 8px', fontSize: '11px', whiteSpace: 'nowrap', height: '34px' }}
                              title={lang === 'ru' ? 'Выбрать на карте' : 'Pick on Map'}
                            >
                              🗺️
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => {
                                const list = [...selectedTrigger.spawnPositions];
                                list.splice(posIdx, 1);
                                handleUpdateTriggerField('spawnPositions', list);
                              }}
                              style={{ padding: '6px 10px', height: '34px' }}
                            >
                              ✖
                            </button>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-dark)', textAlign: 'center' }}>
                          No spawn positions defined. Set height to 0.0 to spawn on the ground.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Entities list to spawn (independent scrolling container) */}
                  <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: '2px', background: 'var(--bg-secondary)', maxWidth: '1200px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-glow)' }}>
                        🦁 {t('spawner_spawn_list')}
                      </span>
                      <button className="btn btn-accent" onClick={handleAddSpawnListItem} style={{ padding: '6px 12px', fontSize: '11px' }}>
                        + {lang === 'ru' ? 'Добавить в список спавна' : 'Add Entity to list'}
                      </button>
                    </div>

                    <div style={{
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      padding: '12px',
                      borderRadius: '2px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-glow)' }}>
                          🎁 {lang === 'ru' ? 'Шаблоны авто-спавна (пресеты)' : 'Auto-Spawn Presets'}
                        </span>
                        
                        {/* Append/Replace Mode Toggle */}
                        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                          <button
                            type="button"
                            onClick={() => setPresetMode('append')}
                            style={{
                              padding: '2px 8px',
                              fontSize: '9px',
                              background: presetMode === 'append' ? 'var(--border-color)' : 'transparent',
                              color: presetMode === 'append' ? 'var(--text-glow)' : 'var(--text-secondary)',
                              border: 'none',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-heading)',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}
                          >
                            {lang === 'ru' ? 'Добавить' : 'Append'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPresetMode('replace')}
                            style={{
                              padding: '2px 8px',
                              fontSize: '9px',
                              background: presetMode === 'replace' ? 'var(--danger-color)' : 'transparent',
                              color: presetMode === 'replace' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                              border: 'none',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-heading)',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}
                          >
                            {lang === 'ru' ? 'Заменить' : 'Replace'}
                          </button>
                        </div>
                      </div>

                      {/* Category Tabs */}
                      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '4px' }}>
                        {[
                          { id: 'infected', label: lang === 'ru' ? '🧟 Зомби' : '🧟 Infected' },
                          { id: 'fauna', label: lang === 'ru' ? '🐺 Животные' : '🐺 Fauna' },
                          { id: 'loot', label: lang === 'ru' ? '🎒 Лут' : '🎒 Loot' }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActivePresetTab(tab.id)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '10px',
                              fontFamily: 'var(--font-heading)',
                              fontWeight: 'bold',
                              background: activePresetTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
                              color: activePresetTab === tab.id ? 'var(--text-glow)' : 'var(--text-secondary)',
                              border: 'none',
                              borderBottom: activePresetTab === tab.id ? '2px solid var(--text-primary)' : '2px solid transparent',
                              cursor: 'pointer',
                              outline: 'none',
                              textTransform: 'uppercase'
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Presets Grid */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(() => {
                          const presets = {
                            infected: [
                              {
                                label: lang === 'ru' ? '🧟 Военная орда' : '🧟 Military Horde',
                                items: [
                                  "ZmbM_SoldierNormal_Base|1|-3|-3|-3|-3",
                                  "ZmbM_SoldierNormal_Base|0.8|-3|-3|-3|-3",
                                  "ZmbM_SoldierNormal_Heavy|0.5|-3|-3|-3|-3"
                                ]
                              },
                              {
                                label: lang === 'ru' ? '👮 Полицейский кордон' : '👮 Police Barricade',
                                items: [
                                  "ZmbM_PolicemanSpecForce|1|-3|-3|-3|-3",
                                  "ZmbM_PolicemanSpecForce|0.7|-3|-3|-3|-3",
                                  "ZmbF_PoliceNormal|0.8|-3|-3|-3|-3"
                                ]
                              },
                              {
                                label: lang === 'ru' ? '🏥 Медицинская зона' : '🏥 Medical Zone',
                                items: [
                                  "ZmbM_DoctorFat|0.9|-3|-3|-3|-3",
                                  "ZmbF_DoctorSkinny|0.9|-3|-3|-3|-3",
                                  "ZmbM_ParamedicNormal_Red|0.7|-3|-3|-3|-3"
                                ]
                              },
                              {
                                label: lang === 'ru' ? '☣️ ЧС Химзащита' : '☣️ Hazmat Crew',
                                items: [
                                  "ZmbM_JacketJeri|0.8|-3|-3|-3|-3",
                                  "ZmbM_JacketJeri|0.5|-3|-3|-3|-3",
                                  "ZmbM_JacketJeri|0.5|-3|-3|-3|-3"
                                ]
                              }
                            ],
                            fauna: [
                              {
                                label: lang === 'ru' ? '🐺 Стая волков' : '🐺 Wolf Pack',
                                items: [
                                  "Animal_CanisLupus_Grey|1|1200|-3|-3|-3",
                                  "Animal_CanisLupus_Grey|0.8|1200|-3|-3|-3",
                                  "Animal_CanisLupus_White|0.3|1200|-3|-3|-3"
                                ]
                              },
                              {
                                label: lang === 'ru' ? '🐻 Медведь-босс' : '🐻 Bear Boss',
                                items: [
                                  "Animal_UrsusArctos|1|3600|1|100|-3"
                                ]
                              },
                              {
                                label: lang === 'ru' ? '🐗 Стадо кабанов' : '🐗 Boar Group',
                                items: [
                                  "Animal_SusScrofa|1|1200|-3|-3|-3",
                                  "Animal_SusScrofa|0.8|1200|-3|-3|-3",
                                  "Animal_SusScrofa|0.8|1200|-3|-3|-3"
                                ]
                              }
                            ],
                            loot: [
                              {
                                label: lang === 'ru' ? '🎒 M4A1 и патроны' : '🎒 M4A1 & Ammo',
                                items: [
                                  "M4A1|1|-3|1|100|-3",
                                  "Ammo_556x45|1|-3|30|100|-3",
                                  "Mag_STANAG_30Rnd|1|-3|1|100|-3"
                                ]
                              },
                              {
                                label: lang === 'ru' ? '🎯 Снайперское снаряжение' : '🎯 Ghillie Sniper',
                                items: [
                                  "M40A5|1|-3|1|100|-3",
                                  "GhillieBushrag_Tan|1|-3|1|100|-3",
                                  "Ammo_308Win|1|-3|20|100|-3"
                                ]
                              },
                              {
                                label: lang === 'ru' ? '💊 Медикаменты' : '💊 Medical Supplies',
                                items: [
                                  "SalineBagIV|1|-3|1|100|-3",
                                  "BandageDressing|1|-3|4|100|-3",
                                  "Morphine|0.8|-3|1|100|-3"
                                ]
                              }
                            ]
                          };

                          const activePresets = presets[activePresetTab] || [];
                          return activePresets.map((preset, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              className="btn"
                              onClick={() => {
                                if (presetMode === 'replace') {
                                  handleUpdateTriggerField('spawnList', [...preset.items]);
                                } else {
                                  const currentList = Array.isArray(selectedTrigger.spawnList) ? selectedTrigger.spawnList : [];
                                  handleUpdateTriggerField('spawnList', [...currentList, ...preset.items]);
                                }
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '10px',
                                borderColor: 'var(--border-color)',
                                background: 'rgba(255,255,255,0.02)'
                              }}
                            >
                              {preset.label}
                            </button>
                          ));
                        })()}
                      </div>
                    </div>

                    <div style={{
                      maxHeight: '340px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      paddingRight: '6px'
                    }}>
                      {Array.isArray(selectedTrigger.spawnList) && selectedTrigger.spawnList.length > 0 ? (
                        selectedTrigger.spawnList.map((rawItem, listIdx) => {
                          const parsed = parseSpawnListEntry(rawItem);
                          const isExpanded = !!expandedEntities[listIdx];
                          const badge = getEntityTypeBadge(parsed.className || '', lang);

                          const toggleEntityExpanded = (idx) => {
                            setExpandedEntities(prev => ({
                              ...prev,
                              [idx]: !prev[idx]
                            }));
                          };

                          return (
                            <div
                              key={listIdx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0px',
                                marginBottom: '2px'
                              }}
                            >
                              {/* Card Header Row */}
                              <div
                                onClick={() => toggleEntityExpanded(listIdx)}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  background: isExpanded ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                  padding: '8px 12px',
                                  borderRadius: isExpanded ? '2px 2px 0 0' : '2px',
                                  border: '1px solid var(--border-color)',
                                  borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)',
                                  userSelect: 'none',
                                  transition: 'background 0.15s'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '12px', display: 'inline-block' }}>
                                    {isExpanded ? '▼' : '▶'}
                                  </span>
                                  <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 'bold',
                                    fontSize: '11px',
                                    color: isExpanded ? 'var(--text-glow)' : 'var(--text-primary)',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    flex: 1
                                  }}>
                                    {parsed.className || (lang === 'ru' ? 'Выберите класснейм...' : 'Select Classname...')}
                                  </span>
                                  <span style={{
                                    fontSize: '8px',
                                    padding: '1px 4px',
                                    backgroundColor: badge.bg,
                                    color: badge.color,
                                    border: `1px solid ${badge.border}`,
                                    borderRadius: '2px',
                                    fontFamily: 'var(--font-heading)',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    flexShrink: 0
                                  }}>
                                    {badge.text}
                                  </span>
                                  {parsed.chance !== '' && parsed.chance !== '-3' && (
                                    <span style={{
                                      fontSize: '8px',
                                      padding: '1px 4px',
                                      backgroundColor: 'rgba(56, 124, 255, 0.1)',
                                      color: '#387cff',
                                      border: '1px solid rgba(56, 124, 255, 0.3)',
                                      borderRadius: '2px',
                                      fontFamily: 'var(--font-heading)',
                                      fontWeight: 'bold',
                                      flexShrink: 0
                                    }}>
                                      {lang === 'ru' ? 'Шанс: ' : 'Chance: '}{parsed.chance}
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="btn"
                                    onClick={() => {
                                      if (listIdx > 0) {
                                        const list = [...selectedTrigger.spawnList];
                                        const temp = list[listIdx];
                                        list[listIdx] = list[listIdx - 1];
                                        list[listIdx - 1] = temp;
                                        handleUpdateTriggerField('spawnList', list);
                                        // Swap expanded states too
                                        setExpandedEntities(prev => ({
                                          ...prev,
                                          [listIdx]: prev[listIdx - 1],
                                          [listIdx - 1]: prev[listIdx]
                                        }));
                                      }
                                    }}
                                    disabled={listIdx === 0}
                                    style={{ padding: '2px 4px', fontSize: '8px', background: 'none', height: '20px', minWidth: '20px', opacity: listIdx === 0 ? 0.3 : 1 }}
                                    title="Move Up"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    className="btn"
                                    onClick={() => {
                                      const list = [...selectedTrigger.spawnList];
                                      if (listIdx < list.length - 1) {
                                        const temp = list[listIdx];
                                        list[listIdx] = list[listIdx + 1];
                                        list[listIdx + 1] = temp;
                                        handleUpdateTriggerField('spawnList', list);
                                        // Swap expanded states too
                                        setExpandedEntities(prev => ({
                                          ...prev,
                                          [listIdx]: prev[listIdx + 1],
                                          [listIdx + 1]: prev[listIdx]
                                        }));
                                      }
                                    }}
                                    disabled={listIdx === selectedTrigger.spawnList.length - 1}
                                    style={{ padding: '2px 4px', fontSize: '8px', background: 'none', height: '20px', minWidth: '20px', opacity: listIdx === selectedTrigger.spawnList.length - 1 ? 0.3 : 1 }}
                                    title="Move Down"
                                  >
                                    ▼
                                  </button>
                                  <button
                                    type="button"
                                    className="btn"
                                    onClick={() => {
                                      const list = [...selectedTrigger.spawnList];
                                      list.push(rawItem);
                                      handleUpdateTriggerField('spawnList', list);
                                    }}
                                    style={{ padding: '2px 4px', fontSize: '8px', background: 'none', height: '20px', minWidth: '20px' }}
                                    title="Clone"
                                  >
                                    📋
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() => handleRemoveSpawnListItem(listIdx)}
                                    style={{ padding: '2px 4px', fontSize: '8px', height: '20px', minWidth: '20px' }}
                                    title="Delete"
                                  >
                                    ✖
                                  </button>
                                </div>
                              </div>

                              {/* Card Expandable Body Panel */}
                              {isExpanded && (
                                <div
                                  style={{
                                    border: '1px solid var(--border-color)',
                                    borderTop: 'none',
                                    background: 'var(--bg-primary)',
                                    padding: '10px 12px 12px 12px',
                                    borderRadius: '0 0 2px 2px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                  }}
                                >
                                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                      <AutocompleteInput
                                        value={parsed.className}
                                        onChange={val => handleUpdateSpawnListItem(listIdx, 'className', val)}
                                        suggestions={itemSuggestions}
                                        placeholder="Animal_CanisLupus_Grey..."
                                      />
                                    </div>
                                  </div>

                                  {/* Inputs Grid */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                    <div>
                                      <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                        {lang === 'ru' ? 'Шанс' : 'Chance'}
                                      </label>
                                      <SmartDefaultInput
                                        value={parsed.chance}
                                        onChange={val => handleUpdateSpawnListItem(listIdx, 'chance', val)}
                                        placeholder="Default"
                                        title="Шанс спавна (например, 0.7 или -3 для дефолта)"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                        {lang === 'ru' ? 'Жизнь (s)' : 'Lifetime (s)'}
                                      </label>
                                      <SmartDefaultInput
                                        value={parsed.lifetime}
                                        onChange={val => handleUpdateSpawnListItem(listIdx, 'lifetime', val)}
                                        placeholder="Default"
                                        title="Время жизни сущности (сек, -3 для дефолта)"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                        {lang === 'ru' ? 'Патроны' : 'Ammo/Qty'}
                                      </label>
                                      <SmartDefaultInput
                                        value={parsed.count}
                                        onChange={val => handleUpdateSpawnListItem(listIdx, 'count', val)}
                                        placeholder="Default"
                                        title="Количество патронов / предметов (например, 10-30)"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                        {lang === 'ru' ? 'ХП %' : 'Health %'}
                                      </label>
                                      <SmartDefaultInput
                                        value={parsed.health}
                                        onChange={val => handleUpdateSpawnListItem(listIdx, 'health', val)}
                                        placeholder="Default"
                                        title="Процент здоровья (например, 30-100)"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                        {lang === 'ru' ? 'Еда' : 'Food Stage'}
                                      </label>
                                      <SmartDefaultInput
                                        value={parsed.foodStage}
                                        onChange={val => handleUpdateSpawnListItem(listIdx, 'foodStage', val)}
                                        placeholder="Default"
                                        title="Состояние еды (-3 дефолт, -2 рандом, -1 свежее)"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ padding: '24px', fontSize: '11px', color: 'var(--text-dark)', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                          No entities to spawn in this trigger. Add animal or zombie classname.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* SUBTAB 5: LINKS & CLEANUP */}
              {activeSubTab === 'links' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
                  
                  {/* Event triggers activation IDs inputs */}
                  <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: '2px', background: 'var(--bg-secondary)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-glow)', marginBottom: '12px' }}>
                      🔗 {lang === 'ru' ? 'Активация других триггеров при событиях' : 'Activate other triggers on events'}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <TriggerLinkField
                        label={t('spawner_trigger_dependencies')}
                        value={selectedTrigger.triggerDependencies}
                        onChange={val => handleUpdateTriggerField('triggerDependencies', val)}
                        allTriggers={triggers}
                        lang={lang}
                      />
                      <label className="checkbox-container" style={{ marginTop: '-4px', marginBottom: '8px' }}>
                        <div className={`checkbox-custom ${selectedTrigger.triggerDependenciesAnyOf === 1 ? 'checked' : ''}`}
                          onClick={() => handleUpdateTriggerField('triggerDependenciesAnyOf', selectedTrigger.triggerDependenciesAnyOf === 1 ? 0 : 1)} />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('spawner_trigger_dependencies_any_of')}</span>
                      </label>

                      <TriggerLinkField
                        label={t('spawner_triggers_to_enable_on_enter')}
                        value={selectedTrigger.triggersToEnableOnEnter}
                        onChange={val => handleUpdateTriggerField('triggersToEnableOnEnter', val)}
                        allTriggers={triggers}
                        lang={lang}
                      />

                      <TriggerLinkField
                        label={t('spawner_triggers_to_enable_on_first_spawn')}
                        value={selectedTrigger.triggersToEnableOnFirstSpawn}
                        onChange={val => handleUpdateTriggerField('triggersToEnableOnFirstSpawn', val)}
                        allTriggers={triggers}
                        lang={lang}
                      />

                      <TriggerLinkField
                        label={t('spawner_triggers_to_enable_on_win')}
                        value={selectedTrigger.triggersToEnableOnWin}
                        onChange={val => handleUpdateTriggerField('triggersToEnableOnWin', val)}
                        allTriggers={triggers}
                        lang={lang}
                      />

                      <TriggerLinkField
                        label={t('spawner_triggers_to_enable_on_leave')}
                        value={selectedTrigger.triggersToEnableOnLeave}
                        onChange={val => handleUpdateTriggerField('triggersToEnableOnLeave', val)}
                        allTriggers={triggers}
                        lang={lang}
                      />
                    </div>
                  </div>

                  {/* Cleanups toggles */}
                  <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: '2px', background: 'var(--bg-secondary)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-glow)', marginBottom: '12px' }}>
                      🧹 {lang === 'ru' ? 'Правила очистки и отключения' : 'Cleanups and disable rules'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          {lang === 'ru' ? 'Задержка очистки (s)' : 'Cleanup Delay (s)'}
                        </label>
                        <input
                          type="number"
                          value={selectedTrigger.triggerCleanupDelay !== undefined ? selectedTrigger.triggerCleanupDelay : 30}
                          onChange={e => handleUpdateTriggerField('triggerCleanupDelay', Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          {lang === 'ru' ? 'Время удаления убитых животных (s)' : 'Dead animals clear time (s)'}
                        </label>
                        <input
                          type="number"
                          value={selectedTrigger.clearDeathAnimals !== undefined ? selectedTrigger.clearDeathAnimals : 5}
                          onChange={e => handleUpdateTriggerField('clearDeathAnimals', Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          {lang === 'ru' ? 'Время удаления убитых зомби (s)' : 'Dead zombies clear time (s)'}
                        </label>
                        <input
                          type="number"
                          value={selectedTrigger.clearDeathZombies !== undefined ? selectedTrigger.clearDeathZombies : 5}
                          onChange={e => handleUpdateTriggerField('clearDeathZombies', Number(e.target.value))}
                        />
                      </div>
                    </div>

                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <label className="checkbox-container">
                        <div className={`checkbox-custom ${selectedTrigger.triggerCleanupOnLeave === 1 ? 'checked' : ''}`}
                          onClick={() => handleUpdateTriggerField('triggerCleanupOnLeave', selectedTrigger.triggerCleanupOnLeave === 1 ? 0 : 1)} />
                        <span style={{ fontSize: '11px' }} className="label-with-help">
                          {lang === 'ru' ? 'Удалять при выходе игроков' : 'Cleanup on player exit'}
                          <HelpIcon tipKey="tip_mpg_cleanup_leave" />
                        </span>
                      </label>

                      <label className="checkbox-container">
                        <div className={`checkbox-custom ${selectedTrigger.triggerCleanupOnLunchTime === 1 ? 'checked' : ''}`}
                          onClick={() => handleUpdateTriggerField('triggerCleanupOnLunchTime', selectedTrigger.triggerCleanupOnLunchTime === 1 ? 0 : 1)} />
                        <span style={{ fontSize: '11px' }}>{lang === 'ru' ? 'Удалять по расписанию' : 'Cleanup on schedule end'}</span>
                      </label>

                      <label className="checkbox-container">
                        <div className={`checkbox-custom ${selectedTrigger.triggerCleanupImmersive === 1 ? 'checked' : ''}`}
                          onClick={() => handleUpdateTriggerField('triggerCleanupImmersive', selectedTrigger.triggerCleanupImmersive === 1 ? 0 : 1)} />
                        <span style={{ fontSize: '11px' }}>{lang === 'ru' ? 'Иммерсивная анимация смерти' : 'Immersive death animation'}</span>
                      </label>

                      <label className="checkbox-container">
                        <div className={`checkbox-custom ${selectedTrigger.triggerDisableOnWin === 1 ? 'checked' : ''}`}
                          onClick={() => handleUpdateTriggerField('triggerDisableOnWin', selectedTrigger.triggerDisableOnWin === 1 ? 0 : 1)} />
                        <span style={{ fontSize: '11px' }} className="label-with-help">
                          {lang === 'ru' ? 'Отключать при победе' : 'Disable on Win'}
                          <HelpIcon tipKey="tip_mpg_disable_win" />
                        </span>
                      </label>

                      <label className="checkbox-container">
                        <div className={`checkbox-custom ${selectedTrigger.triggerDisableOnLeave === 1 ? 'checked' : ''}`}
                          onClick={() => handleUpdateTriggerField('triggerDisableOnLeave', selectedTrigger.triggerDisableOnLeave === 1 ? 0 : 1)} />
                        <span style={{ fontSize: '11px' }}>{lang === 'ru' ? 'Отключать при выходе' : 'Disable on Leave'}</span>
                      </label>
                    </div>
                  </div>

                </div>
              )}

              {/* SUBTAB 6: MAPPING */}
              {activeSubTab === 'mapping' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-glow)' }}>
                      📦 {t('spawner_mapping_data')}
                    </span>
                    <button className="btn btn-accent" onClick={() => {
                      const currentMap = Array.isArray(selectedTrigger.mappingData) ? selectedTrigger.mappingData : [];
                      const newMapSet = {
                        addOnStartup: 1,
                        addOnEnter: 0,
                        addOnFirstSpawn: 0,
                        addOnWin: 0,
                        addDelay: 0.0,
                        removeOnEnter: 0,
                        removeOnFirstSpawn: 0,
                        removeOnWin: 0,
                        removeDelay: 0.0,
                        mappingObjects: []
                      };
                      handleUpdateTriggerField('mappingData', [...currentMap, newMapSet]);
                    }} style={{ padding: '6px 12px', fontSize: '11px' }}>
                      + {lang === 'ru' ? 'Добавить группу маппинга' : 'Add Mapping Group'}
                    </button>
                  </div>

                  {/* Mapping sets list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {Array.isArray(selectedTrigger.mappingData) && selectedTrigger.mappingData.length > 0 ? (
                      selectedTrigger.mappingData.map((mapSet, mapIdx) => (
                        <div
                          key={mapIdx}
                          style={{
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            padding: '16px',
                            borderRadius: '2px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                              {lang === 'ru' ? `Группа объектов маппинга #${mapIdx + 1}` : `Mapping set #${mapIdx + 1}`}
                            </span>
                            <button
                              className="btn btn-danger"
                              onClick={() => {
                                const currentMap = [...selectedTrigger.mappingData];
                                currentMap.splice(mapIdx, 1);
                                handleUpdateTriggerField('mappingData', currentMap);
                              }}
                              style={{ padding: '4px 8px', fontSize: '10px' }}
                            >
                              ✖ {lang === 'ru' ? 'Удалить группу' : 'Remove group'}
                            </button>
                          </div>

                          {/* Trigger check conditions */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>СПАВНИТЬ ПРИ:</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label className="checkbox-container">
                                  <div className={`checkbox-custom ${mapSet.addOnStartup === 1 ? 'checked' : ''}`}
                                    onClick={() => onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'addOnStartup'], mapSet.addOnStartup === 1 ? 0 : 1)} />
                                  <span style={{ fontSize: '10px' }}>Старте сервера</span>
                                </label>
                                <label className="checkbox-container">
                                  <div className={`checkbox-custom ${mapSet.addOnEnter === 1 ? 'checked' : ''}`}
                                    onClick={() => onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'addOnEnter'], mapSet.addOnEnter === 1 ? 0 : 1)} />
                                  <span style={{ fontSize: '10px' }}>Входе игрока</span>
                                </label>
                                <label className="checkbox-container">
                                  <div className={`checkbox-custom ${mapSet.addOnFirstSpawn === 1 ? 'checked' : ''}`}
                                    onClick={() => onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'addOnFirstSpawn'], mapSet.addOnFirstSpawn === 1 ? 0 : 1)} />
                                  <span style={{ fontSize: '10px' }}>Первом спавне</span>
                                </label>
                                <label className="checkbox-container">
                                  <div className={`checkbox-custom ${mapSet.addOnWin === 1 ? 'checked' : ''}`}
                                    onClick={() => onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'addOnWin'], mapSet.addOnWin === 1 ? 0 : 1)} />
                                  <span style={{ fontSize: '10px' }}>Победе</span>
                                </label>
                              </div>
                            </div>

                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>УДАЛЯТЬ ПРИ:</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label className="checkbox-container">
                                  <div className={`checkbox-custom ${mapSet.removeOnEnter === 1 ? 'checked' : ''}`}
                                    onClick={() => onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'removeOnEnter'], mapSet.removeOnEnter === 1 ? 0 : 1)} />
                                  <span style={{ fontSize: '10px' }}>Входе игрока</span>
                                </label>
                                <label className="checkbox-container">
                                  <div className={`checkbox-custom ${mapSet.removeOnFirstSpawn === 1 ? 'checked' : ''}`}
                                    onClick={() => onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'removeOnFirstSpawn'], mapSet.removeOnFirstSpawn === 1 ? 0 : 1)} />
                                  <span style={{ fontSize: '10px' }}>Первом спавне</span>
                                </label>
                                <label className="checkbox-container">
                                  <div className={`checkbox-custom ${mapSet.removeOnWin === 1 ? 'checked' : ''}`}
                                    onClick={() => onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'removeOnWin'], mapSet.removeOnWin === 1 ? 0 : 1)} />
                                  <span style={{ fontSize: '10px' }}>Победе</span>
                                </label>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Задержка добавления (s)</label>
                                <input
                                  type="number"
                                  value={mapSet.addDelay !== undefined ? mapSet.addDelay : 0}
                                  onChange={e => onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'addDelay'], Number(e.target.value))}
                                  style={{ fontSize: '11px', padding: '4px' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Задержка удаления (s)</label>
                                <input
                                  type="number"
                                  value={mapSet.removeDelay !== undefined ? mapSet.removeDelay : 0}
                                  onChange={e => onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'removeDelay'], Number(e.target.value))}
                                  style={{ fontSize: '11px', padding: '4px' }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* DayZ Editor JSON input area */}
                          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                              📥 {lang === 'ru' 
                                ? `Импортировать объекты маппинга (Объектов в группе: ${mapSet.mappingObjects?.length || 0})` 
                                : `Import mapping objects (Objects count: ${mapSet.mappingObjects?.length || 0})`}
                            </label>
                            
                            <textarea
                              rows={2}
                              placeholder='Вставьте экспортированный JSON из DayZ Editor сюда... { "Objects": [...] } или [...]'
                              onBlur={e => {
                                handleImportMappingObjects(mapIdx, e.target.value);
                                e.target.value = '';
                              }}
                              style={{
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                background: 'var(--bg-primary)',
                                height: '50px'
                              }}
                            />
                            <span style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>
                              * При вставке JSON произойдет парсинг координат, углов наклона (YPR) и масштабирования.
                            </span>
                          </div>

                          {/* Collapsible Mapping Objects Inspector */}
                          {(() => {
                            const allObjects = Array.isArray(mapSet.mappingObjects) ? mapSet.mappingObjects : [];
                            if (allObjects.length === 0) return null;

                            const searchQ = (mappingQueries[mapIdx] || '').toLowerCase().trim();
                            const currentPage = mappingPages[mapIdx] || 0;
                            
                            const filteredObjects = allObjects.map((o, idx) => ({ ...o, originalObjIndex: idx })).filter(obj => {
                              return !searchQ || (obj.name && obj.name.toLowerCase().includes(searchQ));
                            });

                            const pageSize = 10;
                            const totalPages = Math.max(1, Math.ceil(filteredObjects.length / pageSize));
                            const paginatedObjects = filteredObjects.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

                            return (
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '10px' }}>
                                <details style={{ width: '100%' }}>
                                  <summary style={{
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    color: 'var(--text-glow)',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    marginBottom: '8px'
                                  }}>
                                    👁️ {lang === 'ru' ? `Инспектор объектов маппинга (${allObjects.length} шт.)` : `Mapping Objects Inspector (${allObjects.length} items)`}
                                  </summary>
                                  
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-primary)', padding: '10px', borderRadius: '2px', border: '1px solid var(--border-color)', marginTop: '6px' }}>
                                    {/* Filter and Pagination Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                      <input
                                        type="text"
                                        placeholder={lang === 'ru' ? "Поиск объекта..." : "Search object..."}
                                        value={mappingQueries[mapIdx] || ''}
                                        onChange={e => {
                                          setMappingQueries(prev => ({ ...prev, [mapIdx]: e.target.value }));
                                          setMappingPages(prev => ({ ...prev, [mapIdx]: 0 }));
                                        }}
                                        style={{ fontSize: '11px', padding: '4px 8px', width: '200px' }}
                                      />

                                      {totalPages > 1 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <button
                                            type="button"
                                            className="btn"
                                            disabled={currentPage === 0}
                                            onClick={() => setMappingPages(prev => ({ ...prev, [mapIdx]: Math.max(0, currentPage - 1) }))}
                                            style={{ padding: '2px 6px', fontSize: '9px' }}
                                          >
                                            ◀
                                          </button>
                                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                            {currentPage + 1} / {totalPages}
                                          </span>
                                          <button
                                            type="button"
                                            className="btn"
                                            disabled={currentPage >= totalPages - 1}
                                            onClick={() => setMappingPages(prev => ({ ...prev, [mapIdx]: Math.min(totalPages - 1, currentPage + 1) }))}
                                            style={{ padding: '2px 6px', fontSize: '9px' }}
                                          >
                                            ▶
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {/* Collapsible Bulk Transforms Panel */}
                                    <details style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', padding: '8px', marginTop: '4px' }}>
                                      <summary style={{ fontSize: '10px', color: '#ebd667', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }}>
                                        🛠️ {lang === 'ru' ? "Групповые трансформации (сдвиг и поворот)" : "Bulk Transform Controls"}
                                      </summary>
                                      
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                                        {/* Shift Positions */}
                                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                                            1. {lang === 'ru' ? "СДВИГ КООРДИНАТ (МЕТРЫ)" : "SHIFT GROUP COORDINATES (METERS)"}
                                          </span>
                                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input 
                                              type="number" 
                                              step="any" 
                                              id={`bulk-shift-x-${mapIdx}`}
                                              placeholder="Δ X"
                                              style={{ width: '60px', fontSize: '10px', padding: '3px' }} 
                                            />
                                            <input 
                                              type="number" 
                                              step="any" 
                                              id={`bulk-shift-y-${mapIdx}`}
                                              placeholder="Δ Y"
                                              style={{ width: '60px', fontSize: '10px', padding: '3px' }} 
                                            />
                                            <input 
                                              type="number" 
                                              step="any" 
                                              id={`bulk-shift-z-${mapIdx}`}
                                              placeholder="Δ Z"
                                              style={{ width: '60px', fontSize: '10px', padding: '3px' }} 
                                            />
                                            <button
                                              type="button"
                                              className="btn btn-accent"
                                              style={{ padding: '4px 8px', fontSize: '9px' }}
                                              onClick={() => {
                                                const dx = parseFloat(document.getElementById(`bulk-shift-x-${mapIdx}`).value) || 0;
                                                const dy = parseFloat(document.getElementById(`bulk-shift-y-${mapIdx}`).value) || 0;
                                                const dz = parseFloat(document.getElementById(`bulk-shift-z-${mapIdx}`).value) || 0;
                                                
                                                if (dx === 0 && dy === 0 && dz === 0) {
                                                  alert(lang === 'ru' ? "Введите ненулевые значения сдвига!" : "Please enter a non-zero shift offset!");
                                                  return;
                                                }

                                                const updated = allObjects.map(obj => {
                                                  if (!Array.isArray(obj.pos) || obj.pos.length !== 3) return obj;
                                                  return {
                                                    ...obj,
                                                    pos: [
                                                      parseFloat((obj.pos[0] + dx).toFixed(4)),
                                                      parseFloat((obj.pos[1] + dy).toFixed(4)),
                                                      parseFloat((obj.pos[2] + dz).toFixed(4))
                                                    ]
                                                  };
                                                });

                                                onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'mappingObjects'], updated);
                                                alert(lang === 'ru' 
                                                  ? `Успешно сдвинуто ${updated.length} объектов на [X: ${dx}, Y: ${dy}, Z: ${dz}]!` 
                                                  : `Successfully shifted ${updated.length} objects by [X: ${dx}, Y: ${dy}, Z: ${dz}]!`
                                                );
                                                
                                                document.getElementById(`bulk-shift-x-${mapIdx}`).value = "";
                                                document.getElementById(`bulk-shift-y-${mapIdx}`).value = "";
                                                document.getElementById(`bulk-shift-z-${mapIdx}`).value = "";
                                              }}
                                            >
                                              {lang === 'ru' ? "Применить" : "Apply Shift"}
                                            </button>
                                          </div>
                                        </div>

                                        {/* Rotate around centroid */}
                                        <div>
                                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                                            2. {lang === 'ru' ? "ПОВОРОТ ГРУППЫ ВОКРУГ ЦЕНТРА (ГРАДУСЫ)" : "ROTATE GROUP AROUND GEOMETRIC CENTER (DEGREES)"}
                                          </span>
                                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input 
                                              type="number" 
                                              step="any" 
                                              id={`bulk-rot-deg-${mapIdx}`}
                                              placeholder={lang === 'ru' ? "Угол в град." : "Angle (deg)"}
                                              style={{ width: '100px', fontSize: '10px', padding: '3px' }} 
                                            />
                                            <button
                                              type="button"
                                              className="btn btn-accent"
                                              style={{ padding: '4px 8px', fontSize: '9px' }}
                                              onClick={() => {
                                                const deg = parseFloat(document.getElementById(`bulk-rot-deg-${mapIdx}`).value);
                                                if (isNaN(deg) || deg === 0) {
                                                  alert(lang === 'ru' ? "Введите корректный ненулевой угол!" : "Please enter a valid non-zero angle!");
                                                  return;
                                                }

                                                const nonNullObjects = allObjects.filter(o => Array.isArray(o.pos) && o.pos.length === 3);
                                                if (nonNullObjects.length === 0) {
                                                  alert(lang === 'ru' ? "Нет объектов с корректными координатами!" : "No valid objects to rotate!");
                                                  return;
                                                }

                                                let sumX = 0, sumY = 0, sumZ = 0;
                                                nonNullObjects.forEach(o => {
                                                  sumX += o.pos[0];
                                                  sumY += o.pos[1];
                                                  sumZ += o.pos[2];
                                                });
                                                const centerX = sumX / nonNullObjects.length;
                                                const centerY = sumY / nonNullObjects.length;
                                                const centerZ = sumZ / nonNullObjects.length;

                                                const rad = (deg * Math.PI) / 180;
                                                const cos = Math.cos(rad);
                                                const sin = Math.sin(rad);

                                                const updated = allObjects.map(obj => {
                                                  if (!Array.isArray(obj.pos) || obj.pos.length !== 3) return obj;
                                                  
                                                  // Shift to origin, rotate, shift back
                                                  const rx = obj.pos[0] - centerX;
                                                  const rz = obj.pos[2] - centerZ;
                                                  const newX = centerX + (rx * cos - rz * sin);
                                                  const newZ = centerZ + (rx * sin + rz * cos);
                                                  
                                                  // Rotate orientation (Yaw/Y)
                                                  const currentYpr = Array.isArray(obj.ypr) && obj.ypr.length === 3 ? [...obj.ypr] : [0, 0, 0];
                                                  currentYpr[0] = (currentYpr[0] + deg) % 360;
                                                  if (currentYpr[0] < -180) currentYpr[0] += 360;
                                                  if (currentYpr[0] > 180) currentYpr[0] -= 360;

                                                  return {
                                                    ...obj,
                                                    pos: [parseFloat(newX.toFixed(4)), obj.pos[1], parseFloat(newZ.toFixed(4))],
                                                    ypr: [parseFloat(currentYpr[0].toFixed(3)), currentYpr[1], currentYpr[2]]
                                                  };
                                                });

                                                onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'mappingObjects'], updated);
                                                alert(lang === 'ru'
                                                  ? `Успешно повернуто ${updated.length} объектов на ${deg} градусов вокруг центра [X: ${centerX.toFixed(2)}, Z: ${centerZ.toFixed(2)}]!`
                                                  : `Successfully rotated ${updated.length} objects by ${deg}° around centroid [X: ${centerX.toFixed(2)}, Z: ${centerZ.toFixed(2)}]!`
                                                );

                                                document.getElementById(`bulk-rot-deg-${mapIdx}`).value = "";
                                              }}
                                            >
                                              {lang === 'ru' ? "Повернуть" : "Rotate"}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </details>

                                    {/* Objects list table */}
                                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                                        <thead>
                                          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                                            <th style={{ padding: '6px 8px' }}>{lang === 'ru' ? 'Имя объекта' : 'Classname'}</th>
                                            <th style={{ padding: '6px 8px' }}>{lang === 'ru' ? 'Позиция' : 'Position'}</th>
                                            <th style={{ padding: '6px 8px' }}>{lang === 'ru' ? 'Наклон (YPR)' : 'Orientation'}</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'center' }}>✖</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {paginatedObjects.map(obj => (
                                            <tr key={obj.originalObjIndex} style={{ borderBottom: '1px solid rgba(30,48,30,0.3)' }}>
                                              <td style={{ padding: '6px 8px', color: 'var(--text-glow)', wordBreak: 'break-all' }}>
                                                {obj.name}
                                              </td>
                                              <td style={{ padding: '6px 8px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                                {Array.isArray(obj.pos) ? obj.pos.map(v => Number(v).toFixed(2)).join(' ') : '0 0 0'}
                                              </td>
                                              <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                {Array.isArray(obj.ypr) ? obj.ypr.map(v => Number(v).toFixed(1)).join(' ') : '0 0 0'}
                                              </td>
                                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const updatedList = [...allObjects];
                                                    updatedList.splice(obj.originalObjIndex, 1);
                                                    onChangeField(selectedPointPath, [selectedTriggerIdx, 'mappingData', mapIdx, 'mappingObjects'], updatedList);
                                                  }}
                                                  style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: 0 }}
                                                  title="Delete object"
                                                >
                                                  ✖
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                          {paginatedObjects.length === 0 && (
                                            <tr>
                                              <td colSpan={4} style={{ padding: '12px', textAlign: 'center', color: 'var(--text-dark)' }}>
                                                {lang === 'ru' ? 'Объекты не найдены' : 'No objects match'}
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </details>
                              </div>
                          );
                        })()}

                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '24px', fontSize: '11px', color: 'var(--text-dark)', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                        No mapping sets defined for this trigger. Add a set to load structures on server restart or trigger events.
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          </>
        ) : (
          <div style={{ display: 'flex', height: '100%', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: '8px' }}>
            <span>📂 {lang === 'ru' ? 'Выберите триггер из списка во второй колонке' : 'Select a trigger from the list in the middle column'}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>
              {lang === 'ru' 
                ? 'или нажмите кнопку "+ Добавить триггер" для создания новой точки.' 
                : 'or click "+ Add Trigger" to create a new point.'}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
