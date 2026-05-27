import React, { useState, useEffect } from 'react';
import AutocompleteInput from './shared/AutocompleteInput';

const FACTIONS = ['West', 'East', 'Guards', 'Civilian', 'Passive', 'Aggressive', 'Shamans', 'Survivors'];
const BEHAVIOURS = ['ROAMING_LOCAL', 'HALT', 'ROAMING_SELF', 'PATROL_ROAMING', 'LOOP_OR_ALTERNATE', 'ROAMING_UNLIMITED'];
const SPEEDS = ['WALK', 'JOG', 'SPRINT'];
const STANCES = ['STANDING', 'CROUCHED', 'PRONE', 'RELAXED'];
const CLOTHING_SLOTS = ['Body', 'Legs', 'Feet', 'Vest', 'Headgear', 'Gloves', 'Backpack', 'Mask', 'Eyewear', 'Shoulder', 'Melee'];
const LOCATION_TYPES = ['Village', 'City', 'Military', 'Industrial', 'Custom'];


export default function AIBotsEditor({ 
  configs, 
  onChangeField, 
  onNavigateToMap, 
  onCreateFile, 
  onDeleteFile, 
  onSaveFile,
  xmlItems = [],
  setActiveTab: setGlobalActiveTab
}) {
  const [activeTab, setActiveTab] = useState('patrols'); // 'patrols', 'loadouts', 'roaming', 'loot_drops'
  const xmlItemsSet = React.useMemo(() => new Set((xmlItems || []).map(i => i.toLowerCase())), [xmlItems]);
  const isItemMissing = (className) => {
    if (!className || !xmlItems || xmlItems.length === 0) return false;
    return !xmlItemsSet.has(className.toLowerCase());
  };
  const [selectedPatrolIdx, setSelectedPatrolIdx] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState('patrols'); // 'patrols', 'general'
  
  // Loadout editor states
  const [selectedLoadoutPath, setSelectedLoadoutPath] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState('Body');
  const [newClothingInput, setNewClothingInput] = useState('');
  const [newCargoInput, setNewCargoInput] = useState('');

  // Roaming locations states
  const [selectedLocationIdx, setSelectedLocationIdx] = useState(0);
  const [newBuildingInput, setNewBuildingInput] = useState('');

  // Loot drops editor states
  const [selectedLootDropPath, setSelectedLootDropPath] = useState(null);
  const [newDropItemInput, setNewDropItemInput] = useState('');

  const patrolConfigPath = 'expansion/settings/AIPatrolSettings.json';
  const patrolFile = configs[patrolConfigPath];

  const locationConfigPath = 'expansion/settings/AILocationSettings.json';
  const locationFile = configs[locationConfigPath];

  const aiSettingsPath = 'ExpansionMod/Settings/AISettings.json';
  const aiSettingsFile = configs[aiSettingsPath];

  // Dynamic autocompletes
  const [loadoutsList, setLoadoutsList] = useState([]);
  const [lootDropsList, setLootDropsList] = useState([]);
  const [itemSuggestions, setItemSuggestions] = useState([]);

  useEffect(() => {
    const loadouts = [];
    const lootDrops = [];
    const items = new Set();

    Object.keys(configs).forEach(filePath => {
      const lower = filePath.toLowerCase();
      if (lower.startsWith('expansionmod/loadouts/') && filePath.endsWith('.json')) {
        loadouts.push(filePath.split('/').pop().replace('.json', ''));
      }
      if (lower.startsWith('expansionmod/ai/lootdrops/') && filePath.endsWith('.json')) {
        lootDrops.push(filePath.split('/').pop().replace('.json', ''));
      }
      
      const file = configs[filePath];
      if (file.success && file.content) {
        if (Array.isArray(file.content.Items)) {
          file.content.Items.forEach(i => i.ClassName && items.add(i.ClassName));
        }
        if (file.content.StartingClothing) {
          const sc = file.content.StartingClothing;
          ['Tops', 'Pants', 'Shoes', 'Backpacks'].forEach(k => {
            if (Array.isArray(sc[k])) sc[k].forEach(item => items.add(item));
          });
        }
      }
    });

    xmlItems.forEach(item => items.add(item));
    setLoadoutsList(loadouts.sort());
    setLootDropsList(lootDrops.sort());
    setItemSuggestions(Array.from(items).sort());
  }, [configs]);

  // Set default loadout selection on load
  const loadoutPaths = Object.keys(configs).filter(p => 
    p.toLowerCase().startsWith('expansionmod/loadouts/') && configs[p].success
  );
  loadoutPaths.sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()));

  useEffect(() => {
    if (loadoutPaths.length > 0 && !selectedLoadoutPath) {
      setSelectedLoadoutPath(loadoutPaths[0]);
    }
  }, [loadoutPaths, selectedLoadoutPath]);

  // Set default loot drop selection on load
  const lootDropPaths = Object.keys(configs).filter(p => 
    p.toLowerCase().startsWith('expansionmod/ai/lootdrops/') && configs[p].success
  );
  lootDropPaths.sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()));

  useEffect(() => {
    if (lootDropPaths.length > 0 && !selectedLootDropPath) {
      setSelectedLootDropPath(lootDropPaths[0]);
    }
  }, [lootDropPaths, selectedLootDropPath]);

  // -------------------------------------------------------------
  // PATROLS ACTIONS & RENDERING
  // -------------------------------------------------------------
  if (!patrolFile || !patrolFile.success) {
    return (
      <div style={{ padding: '24px', color: 'var(--danger-color)', textAlign: 'center' }}>
        <h3>Error: AIPatrolSettings.json is missing or failed to parse.</h3>
        {patrolFile && <p>{patrolFile.error}</p>}
      </div>
    );
  }

  const patrolContent = patrolFile.content;
  const isPatrolDirty = JSON.stringify(patrolFile.content) !== JSON.stringify(patrolFile.originalContent);
  const patrols = Array.isArray(patrolContent.Patrols) ? patrolContent.Patrols : [];
  const selectedPatrol = patrols[selectedPatrolIdx];

  const handleUpdatePatrolVal = (key, value) => {
    onChangeField(patrolConfigPath, ['Patrols', selectedPatrolIdx, key], value);
  };

  const handleUpdateGeneralVal = (key, value) => {
    onChangeField(patrolConfigPath, [key], value);
  };

  const handleWaypointChange = (wpIdx, coordIdx, val) => {
    onChangeField(patrolConfigPath, ['Patrols', selectedPatrolIdx, 'Waypoints', wpIdx, coordIdx], Number(val));
  };

  const handleAddWaypoint = () => {
    if (!selectedPatrol) return;
    const currentWps = Array.isArray(selectedPatrol.Waypoints) ? selectedPatrol.Waypoints : [];
    let newWp = [7500.0, 0.0, 7500.0];
    if (currentWps.length > 0) {
      const last = currentWps[currentWps.length - 1];
      newWp = [last[0] + 40.0, last[1], last[2] + 40.0];
    }
    onChangeField(patrolConfigPath, ['Patrols', selectedPatrolIdx, 'Waypoints'], [...currentWps, newWp]);
  };

  const handleRemoveWaypoint = (wpIdx) => {
    if (!selectedPatrol) return;
    const currentWps = [...selectedPatrol.Waypoints];
    currentWps.splice(wpIdx, 1);
    onChangeField(patrolConfigPath, ['Patrols', selectedPatrolIdx, 'Waypoints'], currentWps);
  };

  // Patrol Unit management
  const handleAddUnit = (className) => {
    if (!selectedPatrol || !className.trim()) return;
    const currentUnits = Array.isArray(selectedPatrol.Units) ? selectedPatrol.Units : [];
    onChangeField(patrolConfigPath, ['Patrols', selectedPatrolIdx, 'Units'], [...currentUnits, className.trim()]);
  };

  const handleRemoveUnit = (unitIdx) => {
    if (!selectedPatrol) return;
    const currentUnits = [...selectedPatrol.Units];
    currentUnits.splice(unitIdx, 1);
    onChangeField(patrolConfigPath, ['Patrols', selectedPatrolIdx, 'Units'], currentUnits);
  };

  const handleAddPatrol = () => {
    const newPatrol = {
      Name: `Custom Patrol #${patrols.length + 1}`,
      Persist: 0,
      Faction: 'West',
      Formation: '',
      FormationScale: 1.5,
      FormationLooseness: 0.0,
      Loadout: loadoutsList.length > 0 ? loadoutsList[0] : 'SurvivorLoadout',
      Units: [],
      NumberOfAI: 1,
      NumberOfAIMax: 2,
      Behaviour: 'LOOP_OR_ALTERNATE',
      LootingBehaviour: 'DEFAULT | CLOTHING_BODY | CLOTHING_LEGS | CLOTHING_GLOVES | CLOTHING_FEET | CLOTHING_SIMILAR | UPGRADE',
      Speed: 'JOG',
      UnderThreatSpeed: 'SPRINT',
      DefaultStance: 'CROUCHED',
      DefaultLookAngle: 0.0,
      CanBeLooted: 1,
      LootDropOnDeath: '',
      UnlimitedReload: 6,
      SniperProneDistanceThreshold: 0.0,
      AccuracyMin: -1.0,
      AccuracyMax: -1.0,
      ThreatDistanceLimit: -1.0,
      NoiseInvestigationDistanceLimit: -1.0,
      MaxFlankingDistance: -1.0,
      EnableFlankingOutsideCombat: -1,
      DamageMultiplier: -1.0,
      DamageReceivedMultiplier: -1.0,
      HeadshotResistance: 0.0,
      ShoryukenChance: 0.0,
      ShoryukenDamageMultiplier: 0.0,
      CanSpawnInContaminatedArea: 0,
      CanBeTriggeredByAI: 0,
      MinDistRadius: -1.0,
      MaxDistRadius: -1.0,
      DespawnRadius: -1.0,
      MinSpreadRadius: 10.0,
      MaxSpreadRadius: 20.0,
      Chance: 0.5,
      DespawnTime: -1.0,
      RespawnTime: -2.0,
      LoadBalancingCategory: 'Patrol',
      ObjectClassName: '',
      WaypointInterpolation: '',
      UseRandomWaypointAsStartPoint: 0,
      Waypoints: [[7500.0, 0.0, 7500.0]]
    };
    onChangeField(patrolConfigPath, ['Patrols'], [...patrols, newPatrol]);
    setSelectedPatrolIdx(patrols.length);
  };

  const handleRemovePatrol = () => {
    if (patrols.length <= 1) {
      alert("At least one patrol must remain in the configuration!");
      return;
    }
    if (window.confirm(`Delete AI Patrol "${selectedPatrol.Name || `Patrol #${selectedPatrolIdx + 1}`}"?`)) {
      const newList = [...patrols];
      newList.splice(selectedPatrolIdx, 1);
      onChangeField(patrolConfigPath, ['Patrols'], newList);
      setSelectedPatrolIdx(Math.max(0, selectedPatrolIdx - 1));
    }
  };

  // -------------------------------------------------------------
  // LOADOUTS ACTIONS
  // -------------------------------------------------------------
  const activeLoadoutConfig = selectedLoadoutPath ? configs[selectedLoadoutPath] : null;
  const isLoadoutDirty = activeLoadoutConfig ? JSON.stringify(activeLoadoutConfig.content) !== JSON.stringify(activeLoadoutConfig.originalContent) : false;

  const handleCreateLoadout = () => {
    const name = prompt("Enter new Loadout profile name (e.g. MilBanditLoadout):");
    if (!name) return;
    const cleanName = name.trim().replace(/\s+/g, '_');
    if (!cleanName) return;
    
    const filePath = `ExpansionMod/Loadouts/${cleanName}.json`;
    if (configs[filePath]) {
      alert("A loadout with this name already exists!");
      return;
    }

    const template = {
      ClassName: "",
      Include: "",
      Chance: 1.0,
      Quantity: { Min: 0.0, Max: 0.0 },
      Health: [],
      InventoryAttachments: CLOTHING_SLOTS.map(s => ({ SlotName: s, Items: [] })),
      InventoryCargo: [],
      ConstructionPartsBuilt: [],
      Sets: []
    };

    onCreateFile(filePath, template);
  };

  const handleDeleteLoadout = () => {
    if (!selectedLoadoutPath) return;
    const name = selectedLoadoutPath.split('/').pop().replace('.json', '');
    if (window.confirm(`Are you sure you want to delete loadout "${name}" from disk?`)) {
      onDeleteFile(selectedLoadoutPath);
      setSelectedLoadoutPath(null);
    }
  };

  const handleCloneLoadout = () => {
    if (!selectedLoadoutPath) return;
    const name = prompt("Enter name for the cloned Loadout profile:");
    if (!name) return;
    const cleanName = name.trim().replace(/\s+/g, '_');
    if (!cleanName) return;

    const newPath = `ExpansionMod/Loadouts/${cleanName}.json`;
    if (configs[newPath]) {
      alert("A loadout with this name already exists!");
      return;
    }

    const sourceContent = configs[selectedLoadoutPath]?.content;
    if (!sourceContent) return;

    onCreateFile(newPath, JSON.parse(JSON.stringify(sourceContent)));
  };

  const getSlotItems = (loadoutContent, slotName) => {
    if (!loadoutContent || !Array.isArray(loadoutContent.InventoryAttachments)) return [];
    const slot = loadoutContent.InventoryAttachments.find(s => s.SlotName.toLowerCase() === slotName.toLowerCase());
    return slot ? (Array.isArray(slot.Items) ? slot.Items : []) : [];
  };

  const handleSetSlotItems = (loadoutPath, loadoutContent, slotName, newItems) => {
    const attachments = Array.isArray(loadoutContent.InventoryAttachments) ? [...loadoutContent.InventoryAttachments] : [];
    const slotIndex = attachments.findIndex(s => s.SlotName.toLowerCase() === slotName.toLowerCase());
    
    if (slotIndex >= 0) {
      if (newItems.length === 0) {
        attachments.splice(slotIndex, 1);
      } else {
        attachments[slotIndex] = { ...attachments[slotIndex], Items: newItems };
      }
    } else if (newItems.length > 0) {
      attachments.push({ SlotName: slotName, Items: newItems });
    }
    
    onChangeField(loadoutPath, ['InventoryAttachments'], attachments);
  };

  const handleAddClothingItem = (slotName, className) => {
    if (!activeLoadoutConfig || !className.trim()) return;
    const current = getSlotItems(activeLoadoutConfig.content, slotName);
    
    const newItem = {
      ClassName: className.trim(),
      Include: "",
      Chance: 1.0,
      Quantity: { Min: 0.0, Max: 0.0 },
      Health: [{ Min: 0.7, Max: 1.0, Zone: "" }],
      InventoryAttachments: [],
      InventoryCargo: [],
      ConstructionPartsBuilt: [],
      Sets: []
    };

    handleSetSlotItems(selectedLoadoutPath, activeLoadoutConfig.content, slotName, [...current, newItem]);
    setNewClothingInput('');
  };

  const handleRemoveClothingItem = (slotName, idx) => {
    if (!activeLoadoutConfig) return;
    const current = [...getSlotItems(activeLoadoutConfig.content, slotName)];
    current.splice(idx, 1);
    handleSetSlotItems(selectedLoadoutPath, activeLoadoutConfig.content, slotName, current);
  };

  const handleUpdateClothingItemField = (slotName, idx, field, val) => {
    if (!activeLoadoutConfig) return;
    const current = [...getSlotItems(activeLoadoutConfig.content, slotName)];
    
    if (field === 'MinHealth' || field === 'MaxHealth') {
      const currentHealth = Array.isArray(current[idx].Health) && current[idx].Health.length > 0 
        ? [...current[idx].Health] 
        : [{ Min: 0.7, Max: 1.0, Zone: "" }];
      
      if (field === 'MinHealth') currentHealth[0] = { ...currentHealth[0], Min: Number(val) };
      if (field === 'MaxHealth') currentHealth[0] = { ...currentHealth[0], Max: Number(val) };
      current[idx] = { ...current[idx], Health: currentHealth };
    } else {
      current[idx] = { ...current[idx], [field]: field === 'Chance' ? Number(val) : val };
    }

    handleSetSlotItems(selectedLoadoutPath, activeLoadoutConfig.content, slotName, current);
  };

  // Loadout Cargo items
  const handleAddCargoItem = (className) => {
    if (!activeLoadoutConfig || !className.trim()) return;
    const currentCargo = Array.isArray(activeLoadoutConfig.content.InventoryCargo) ? activeLoadoutConfig.content.InventoryCargo : [];
    
    const newItem = {
      ClassName: className.trim(),
      Include: "",
      Chance: 1.0,
      Quantity: { Min: 1.0, Max: 1.0 },
      Health: [],
      InventoryAttachments: [],
      InventoryCargo: [],
      ConstructionPartsBuilt: [],
      Sets: []
    };

    onChangeField(selectedLoadoutPath, ['InventoryCargo'], [...currentCargo, newItem]);
    setNewCargoInput('');
  };

  const handleRemoveCargoItem = (idx) => {
    if (!activeLoadoutConfig) return;
    const currentCargo = [...activeLoadoutConfig.content.InventoryCargo];
    currentCargo.splice(idx, 1);
    onChangeField(selectedLoadoutPath, ['InventoryCargo'], currentCargo);
  };

  const handleUpdateCargoItemField = (idx, field, val) => {
    if (!activeLoadoutConfig) return;
    const currentCargo = [...activeLoadoutConfig.content.InventoryCargo];
    
    if (field === 'MinQty' || field === 'MaxQty') {
      const currentQty = currentCargo[idx].Quantity || { Min: 1, Max: 1 };
      if (field === 'MinQty') currentCargo[idx] = { ...currentCargo[idx], Quantity: { ...currentQty, Min: Number(val) } };
      if (field === 'MaxQty') currentCargo[idx] = { ...currentCargo[idx], Quantity: { ...currentQty, Max: Number(val) } };
    } else {
      currentCargo[idx] = { ...currentCargo[idx], [field]: field === 'Chance' ? Number(val) : val };
    }

    onChangeField(selectedLoadoutPath, ['InventoryCargo'], currentCargo);
  };

  // -------------------------------------------------------------
  // ROAMING LOCATIONS ACTIONS & RENDERING
  // -------------------------------------------------------------
  const isLocationFileDirty = locationFile ? JSON.stringify(locationFile.content) !== JSON.stringify(locationFile.originalContent) : false;
  const roamingLocationsList = locationFile?.success && Array.isArray(locationFile.content.RoamingLocations) 
    ? locationFile.content.RoamingLocations 
    : [];
  const selectedLocation = roamingLocationsList[selectedLocationIdx];

  const handleAddLocation = () => {
    if (!locationFile?.success) return;
    const newLoc = {
      Name: `Settlement_Location_${roamingLocationsList.length + 1}`,
      Position: [7500.0, 0.0, 7500.0],
      Radius: 200.0,
      Type: "Village",
      Enabled: 1
    };
    onChangeField(locationConfigPath, ['RoamingLocations'], [...roamingLocationsList, newLoc]);
    setSelectedLocationIdx(roamingLocationsList.length);
  };

  const handleRemoveLocation = () => {
    if (!selectedLocation || !locationFile?.success) return;
    if (window.confirm(`Delete roaming location "${selectedLocation.Name || `Location #${selectedLocationIdx + 1}`}"?`)) {
      const newList = [...roamingLocationsList];
      newList.splice(selectedLocationIdx, 1);
      onChangeField(locationConfigPath, ['RoamingLocations'], newList);
      setSelectedLocationIdx(Math.max(0, selectedLocationIdx - 1));
    }
  };

  const handleUpdateLocationField = (key, value) => {
    onChangeField(locationConfigPath, ['RoamingLocations', selectedLocationIdx, key], value);
  };

  const handleUpdateLocationCoord = (coordIdx, val) => {
    onChangeField(locationConfigPath, ['RoamingLocations', selectedLocationIdx, 'Position', coordIdx], Number(val));
  };

  const handleAddExcludedBuilding = (name) => {
    if (!locationFile?.success || !name.trim()) return;
    const current = Array.isArray(locationFile.content.ExcludedRoamingBuildings) ? locationFile.content.ExcludedRoamingBuildings : [];
    if (current.includes(name.trim())) return;
    onChangeField(locationConfigPath, ['ExcludedRoamingBuildings'], [...current, name.trim()]);
    setNewBuildingInput('');
  };

  const handleRemoveExcludedBuilding = (idx) => {
    if (!locationFile?.success) return;
    const current = [...(locationFile.content.ExcludedRoamingBuildings || [])];
    current.splice(idx, 1);
    onChangeField(locationConfigPath, ['ExcludedRoamingBuildings'], current);
  };

  // Loot drops action handlers
  const handleCreateLootDrop = () => {
    const name = window.prompt("Enter new Loot Drop profile name (e.g. SoldierLoot):");
    if (!name || !name.trim()) return;
    const cleanName = name.trim().replace(/\s+/g, '_');
    const path = `ExpansionMod/AI/LootDrops/${cleanName}.json`;
    if (configs[path]) {
      alert("Loot Drop profile already exists!");
      return;
    }
    onCreateFile(path, []);
    setSelectedLootDropPath(path);
  };

  const handleDeleteLootDrop = () => {
    if (!selectedLootDropPath) return;
    if (window.confirm(`Delete loot drop file: ${selectedLootDropPath}?`)) {
      onDeleteFile(selectedLootDropPath);
      setSelectedLootDropPath(null);
    }
  };

  const handleCloneLootDrop = () => {
    if (!selectedLootDropPath) return;
    const name = prompt("Enter name for the cloned Loot Drop profile:");
    if (!name) return;
    const cleanName = name.trim().replace(/\s+/g, '_');
    if (!cleanName) return;

    const newPath = `ExpansionMod/AI/LootDrops/${cleanName}.json`;
    if (configs[newPath]) {
      alert("A loot drop profile with this name already exists!");
      return;
    }

    const sourceContent = configs[selectedLootDropPath]?.content;
    if (!sourceContent) return;

    onCreateFile(newPath, JSON.parse(JSON.stringify(sourceContent)));
  };

  const handleAddLootDropItem = (classname) => {
    if (!selectedLootDropPath) return;
    const file = configs[selectedLootDropPath];
    if (!file || !file.success) return;
    
    const currentList = Array.isArray(file.content) ? file.content : [];
    if (currentList.some(item => item.ClassName.toLowerCase() === classname.toLowerCase())) {
      alert("Item classname already exists in this loot table!");
      return;
    }

    const newItem = {
      ClassName: classname,
      Include: "",
      Chance: 0.5,
      Quantity: { Min: 1, Max: 1 },
      Health: [{ Min: 0.7, Max: 1.0, Zone: "" }],
      InventoryAttachments: [],
      InventoryCargo: [],
      ConstructionPartsBuilt: [],
      Sets: []
    };

    onChangeField(selectedLootDropPath, [], [...currentList, newItem]);
    setNewDropItemInput('');
  };

  const handleRemoveLootDropItem = (idx) => {
    if (!selectedLootDropPath) return;
    const file = configs[selectedLootDropPath];
    if (!file || !file.success) return;
    
    const currentList = [...file.content];
    currentList.splice(idx, 1);
    onChangeField(selectedLootDropPath, [], currentList);
  };

  const handleUpdateLootDropItemField = (idx, field, val) => {
    if (!selectedLootDropPath) return;
    const file = configs[selectedLootDropPath];
    if (!file || !file.success) return;

    if (field === 'MinQty' || field === 'MaxQty') {
      const currentQty = file.content[idx].Quantity || { Min: 1, Max: 1 };
      const newQty = { ...currentQty, [field === 'MinQty' ? 'Min' : 'Max']: Number(val) };
      onChangeField(selectedLootDropPath, [idx, 'Quantity'], newQty);
    } else if (field === 'MinHealth' || field === 'MaxHealth') {
      const currentHealth = Array.isArray(file.content[idx].Health) && file.content[idx].Health.length > 0 
        ? file.content[idx].Health[0] 
        : { Min: 0.7, Max: 1.0, Zone: "" };
      const newHealth = { ...currentHealth, [field === 'MinHealth' ? 'Min' : 'Max']: Number(val) };
      onChangeField(selectedLootDropPath, [idx, 'Health', 0], newHealth);
    } else {
      onChangeField(selectedLootDropPath, [idx, field], field === 'Chance' ? Number(val) : val);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Top Workspace Tab Selector */}
      <div style={{ 
        display: 'flex', 
        background: 'var(--bg-tertiary)', 
        borderBottom: '1px solid var(--border-color)',
        padding: '8px 16px',
        alignItems: 'center',
        gap: '12px'
      }}>
        <button 
          className={`btn ${activeTab === 'patrols' ? 'btn-accent' : ''}`}
          onClick={() => setActiveTab('patrols')}
          style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}
        >
          🚨 PATROL MANAGER
        </button>
        <button 
          className={`btn ${activeTab === 'loadouts' ? 'btn-accent' : ''}`}
          onClick={() => setActiveTab('loadouts')}
          style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}
        >
          👕 LOADOUT DESIGNER
        </button>
        <button 
          className={`btn ${activeTab === 'roaming' ? 'btn-accent' : ''}`}
          onClick={() => setActiveTab('roaming')}
          style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}
        >
          🗺 ROAMING LOCATIONS
        </button>
        <button 
          className={`btn ${activeTab === 'loot_drops' ? 'btn-accent' : ''}`}
          onClick={() => setActiveTab('loot_drops')}
          style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}
        >
          🎁 LOOT DROPS
        </button>
      </div>

      {/* Main Split Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* ========================================================================= */}
        {/* 1. PATROL MANAGER VIEW */}
        {/* ========================================================================= */}
        {activeTab === 'patrols' && (
          <>
            {/* Sidebar */}
            <div style={{ 
              width: '250px', 
              background: 'var(--bg-secondary)', 
              borderRight: '1px solid var(--border-color)', 
              display: 'flex', 
              flexDirection: 'column',
              userSelect: 'none'
            }}>
              <div style={{ padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
                <button 
                  className={`btn ${activeSubTab === 'patrols' ? 'btn-active' : ''}`}
                  onClick={() => setActiveSubTab('patrols')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                >
                  PATROLS
                </button>
                <button 
                  className={`btn ${activeSubTab === 'general' ? 'btn-active' : ''}`}
                  onClick={() => setActiveSubTab('general')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                >
                  GLOBAL AI
                </button>
              </div>

              {activeSubTab === 'patrols' ? (
                <>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {patrols.map((patrol, idx) => {
                      const isSelected = idx === selectedPatrolIdx;
                      const origPatrols = patrolFile.originalContent?.Patrols || [];
                      const isPatrolDirty = JSON.stringify(patrol) !== JSON.stringify(origPatrols[idx]);
                      const pName = patrol.Name || `Patrol #${idx + 1} (${patrol.Faction})`;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedPatrolIdx(idx)}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            background: isSelected ? 'rgba(149, 192, 149, 0.1)' : 'transparent',
                            borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                            color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)',
                            borderBottom: '1px solid rgba(30, 48, 30, 0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.1s'
                          }}
                          onMouseOver={e => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(149, 192, 149, 0.03)';
                          }}
                          onMouseOut={e => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', textTransform: 'uppercase', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                              {pName}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              FACTION: {patrol.Faction} · WAYPOINTS: {patrol.Waypoints?.length || 0}
                            </span>
                          </div>
                          {isPatrolDirty && <span className="badge-dirty" />}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                    <button className="btn btn-accent" onClick={handleAddPatrol} style={{ width: '100%', justifyContent: 'center' }}>
                      [+] CREATE NEW PATROL
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'center', lineHeight: '1.4' }}>
                  GLOBAL PARAMETERS SELECTED. USE THE CONFIGURATION PANELS ON THE RIGHT TO TWEAK VALUES.
                </div>
              )}
            </div>

            {/* Main Form Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ 
                padding: '16px 20px', 
                background: 'var(--bg-secondary)', 
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>FILE: </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontWeight: 'bold' }}>AIPatrolSettings.json</span>
                  {isPatrolDirty && <span style={{ color: 'var(--warning-color)', fontSize: '11px', marginLeft: '8px' }}>(UNSAVED CHANGES ●)</span>}
                </div>
                <button 
                  className={`btn ${isPatrolDirty ? 'btn-accent' : ''}`}
                  onClick={() => onSaveFile(patrolConfigPath)}
                  disabled={!isPatrolDirty}
                  style={{ opacity: isPatrolDirty ? 1 : 0.5, cursor: isPatrolDirty ? 'pointer' : 'not-allowed' }}
                >
                  SAVE PATROL SETTINGS
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {activeSubTab === 'general' ? (
                    /* Global Defaults Edit Mode */
                    <>
                      <div className="card-hud">
                        <h4>// GLOBAL SPAWN & DESPAWN LIMITS</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>Enable Patrols</label>
                            <select value={patrolContent.Enabled} onChange={e => handleUpdateGeneralVal('Enabled', Number(e.target.value))}>
                              <option value={1}>1 - ENABLED</option>
                              <option value={0}>0 - DISABLED</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Spawn Distance Min (m)</label>
                            <input type="number" value={patrolContent.MinDistRadius ?? 400} onChange={e => handleUpdateGeneralVal('MinDistRadius', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Spawn Distance Max (m)</label>
                            <input type="number" value={patrolContent.MaxDistRadius ?? 1000} onChange={e => handleUpdateGeneralVal('MaxDistRadius', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Despawn Distance Radius (m)</label>
                            <input type="number" value={patrolContent.DespawnRadius ?? 1100} onChange={e => handleUpdateGeneralVal('DespawnRadius', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>AI Despawn Timeout (secs)</label>
                            <input type="number" value={patrolContent.DespawnTime ?? 600} onChange={e => handleUpdateGeneralVal('DespawnTime', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>AI Respawn Cooldown (secs)</label>
                            <input type="number" value={patrolContent.RespawnTime ?? 600} onChange={e => handleUpdateGeneralVal('RespawnTime', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>

                      <div className="card-hud">
                        <h4>// GLOBAL COMBAT & THREAT PARAMETERS</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>Accuracy Min (-1 = use default)</label>
                            <input type="number" step="any" value={patrolContent.AccuracyMin ?? -1.0} onChange={e => handleUpdateGeneralVal('AccuracyMin', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Accuracy Max (-1 = use default)</label>
                            <input type="number" step="any" value={patrolContent.AccuracyMax ?? -1.0} onChange={e => handleUpdateGeneralVal('AccuracyMax', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Threat Distance Limit (m)</label>
                            <input type="number" value={patrolContent.ThreatDistanceLimit ?? -1} onChange={e => handleUpdateGeneralVal('ThreatDistanceLimit', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Noise Investigation Limit (m)</label>
                            <input type="number" value={patrolContent.NoiseInvestigationDistanceLimit ?? -1} onChange={e => handleUpdateGeneralVal('NoiseInvestigationDistanceLimit', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Max Flanking Distance (m)</label>
                            <input type="number" value={patrolContent.MaxFlankingDistance ?? -1} onChange={e => handleUpdateGeneralVal('MaxFlankingDistance', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Enable Flanking Outside Combat</label>
                            <select value={patrolContent.EnableFlankingOutsideCombat ?? -1} onChange={e => handleUpdateGeneralVal('EnableFlankingOutsideCombat', Number(e.target.value))}>
                              <option value={-1}>-1 - Default</option>
                              <option value={1}>1 - Enabled</option>
                              <option value={0}>0 - Disabled</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Damage Multiplier (Dealt)</label>
                            <input type="number" step="any" value={patrolContent.DamageMultiplier ?? -1.0} onChange={e => handleUpdateGeneralVal('DamageMultiplier', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Damage Received Multiplier</label>
                            <input type="number" step="any" value={patrolContent.DamageReceivedMultiplier ?? -1.0} onChange={e => handleUpdateGeneralVal('DamageReceivedMultiplier', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Shoryuken Melee Chance</label>
                            <input type="number" step="any" value={patrolContent.ShoryukenChance ?? 0.0} onChange={e => handleUpdateGeneralVal('ShoryukenChance', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>

                      {/* Advanced AISettings.json Defaults */}
                      {aiSettingsFile && aiSettingsFile.success && (
                        <div className="card-hud" style={{ borderLeft: '3px solid var(--text-glow)', marginTop: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0 }}>// ADVANCED AI CHARACTER BEHAVIORS (AISETTINGS.JSON)</h4>
                            <button 
                              className={`btn ${JSON.stringify(aiSettingsFile.content) !== JSON.stringify(aiSettingsFile.originalContent) ? 'btn-accent' : ''}`}
                              onClick={() => onSaveFile(aiSettingsPath)}
                            >
                              SAVE GLOBAL AI BEHAVIORS
                            </button>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            
                            {/* Vaulting / Climb switches */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>MOVEMENT & OBSTACLES</span>
                              
                              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', marginTop: '6px' }}>
                                <span>ENABLE VAULTING (ПАРКУР БОТОВ):</span>
                                <select 
                                  value={aiSettingsFile.content.Vaulting ?? 1} 
                                  onChange={e => onChangeField(aiSettingsPath, ['Vaulting'], Number(e.target.value))}
                                  style={{ padding: '3px 8px', fontSize: '11px', width: '120px' }}
                                >
                                  <option value={1}>1 - ENABLED</option>
                                  <option value={0}>0 - DISABLED</option>
                                </select>
                              </label>

                              <div className="form-group" style={{ marginTop: '8px' }}>
                                <label style={{ fontSize: '9px' }}>FORMATION SCALE (МАСШТАБ СТРОЯ): {aiSettingsFile.content.FormationScale ?? 1.0}</label>
                                <input 
                                  type="range" 
                                  min="0.1" 
                                  max="3.0" 
                                  step="0.1"
                                  value={aiSettingsFile.content.FormationScale ?? 1.0}
                                  onChange={e => onChangeField(aiSettingsPath, ['FormationScale'], Number(e.target.value))}
                                />
                              </div>
                            </div>

                            {/* Combat melee special options */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>MELEE SPECIALS (SHORYUKEN)</span>
                              
                              <div className="form-group">
                                <label style={{ fontSize: '9px' }}>SHORYUKEN CHANCE (ВЕРОЯТНОСТЬ СУПЕРУДАРА): {Math.round((aiSettingsFile.content.ShoryukenChance ?? 0.01) * 100)}%</label>
                                <input 
                                  type="range" 
                                  min="0.0" 
                                  max="1.0" 
                                  step="0.01"
                                  value={aiSettingsFile.content.ShoryukenChance ?? 0.01}
                                  onChange={e => onChangeField(aiSettingsPath, ['ShoryukenChance'], Number(e.target.value))}
                                />
                              </div>

                              <div className="form-group">
                                <label style={{ fontSize: '9px' }}>SHORYUKEN DAMAGE MULTIPLIER</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  value={aiSettingsFile.content.ShoryukenDamageMultiplier ?? 3.0}
                                  onChange={e => onChangeField(aiSettingsPath, ['ShoryukenDamageMultiplier'], Number(e.target.value))}
                                />
                              </div>
                            </div>

                            {/* Recruit Friendly options */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>RECRUITMENT MECHANICS (НАЙМ БОТОВ)</span>
                              
                              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                                <span>CAN RECRUIT FRIENDLY BOTS:</span>
                                <select 
                                  value={aiSettingsFile.content.CanRecruitFriendly ?? 1} 
                                  onChange={e => onChangeField(aiSettingsPath, ['CanRecruitFriendly'], Number(e.target.value))}
                                  style={{ padding: '3px 8px', fontSize: '11px', width: '120px' }}
                                >
                                  <option value={1}>1 - YES</option>
                                  <option value={0}>0 - NO</option>
                                </select>
                              </label>

                              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                                <span>CAN RECRUIT GUARDS:</span>
                                <select 
                                  value={aiSettingsFile.content.CanRecruitGuards ?? 0} 
                                  onChange={e => onChangeField(aiSettingsPath, ['CanRecruitGuards'], Number(e.target.value))}
                                  style={{ padding: '3px 8px', fontSize: '11px', width: '120px' }}
                                >
                                  <option value={1}>1 - YES</option>
                                  <option value={0}>0 - NO</option>
                                </select>
                              </label>

                              <div className="form-group">
                                <label style={{ fontSize: '9px' }}>MAX RECRUITABLE BOTS PER PLAYER</label>
                                <input 
                                  type="number" 
                                  value={aiSettingsFile.content.MaxRecruitableAI ?? 1} 
                                  onChange={e => onChangeField(aiSettingsPath, ['MaxRecruitableAI'], Number(e.target.value))}
                                />
                              </div>
                            </div>

                            {/* Threat and Manners */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>THREAT TIMEOUTS & CHAT</span>
                              
                              <div className="form-group">
                                <label style={{ fontSize: '9px' }}>COMBAT AGGRESSION TIMEOUT (SECS)</label>
                                <input 
                                  type="number" 
                                  value={aiSettingsFile.content.AggressionTimeout ?? 120.0} 
                                  onChange={e => onChangeField(aiSettingsPath, ['AggressionTimeout'], Number(e.target.value))}
                                />
                              </div>
                              <div className="form-group">
                                <label style={{ fontSize: '9px' }}>GUARDS AGGRESSION TIMEOUT (SECS)</label>
                                <input 
                                  type="number" 
                                  value={aiSettingsFile.content.GuardAggressionTimeout ?? 150.0} 
                                  onChange={e => onChangeField(aiSettingsPath, ['GuardAggressionTimeout'], Number(e.target.value))}
                                />
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </>
                  ) : selectedPatrol ? (
                    /* Selected Patrol Edit Mode */
                    <>
                      {/* Section 1: General details */}
                      <div className="card-hud">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
                          <h4 style={{ margin: 0 }}>// PATROL PROPERTIES</h4>
                          <button className="btn btn-danger" onClick={handleRemovePatrol} style={{ padding: '4px 8px', fontSize: '10px' }}>
                            DELETE PATROL
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="form-group">
                            <label>Patrol Identifier Name</label>
                            <input type="text" value={selectedPatrol.Name || ''} onChange={e => handleUpdatePatrolVal('Name', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label>Loadout Profile</label>
                            <select value={selectedPatrol.Loadout || ''} onChange={e => handleUpdatePatrolVal('Loadout', e.target.value)}>
                              {loadoutsList.map(l => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Unit Count (Min)</label>
                            <input type="number" value={selectedPatrol.NumberOfAI ?? 1} onChange={e => handleUpdatePatrolVal('NumberOfAI', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Unit Count (Max)</label>
                            <input type="number" value={selectedPatrol.NumberOfAIMax ?? 2} onChange={e => handleUpdatePatrolVal('NumberOfAIMax', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Combat & Aiming */}
                      <div className="card-hud">
                        <h4>// COMBAT & TARGETING PARAMETERS (ПРИЦЕЛИВАНИЕ)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>Accuracy Min (-1 = use global)</label>
                            <input type="number" step="any" value={selectedPatrol.AccuracyMin ?? -1.0} onChange={e => handleUpdatePatrolVal('AccuracyMin', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Accuracy Max (-1 = use global)</label>
                            <input type="number" step="any" value={selectedPatrol.AccuracyMax ?? -1.0} onChange={e => handleUpdatePatrolVal('AccuracyMax', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Threat Distance Limit (m)</label>
                            <input type="number" value={selectedPatrol.ThreatDistanceLimit ?? -1} onChange={e => handleUpdatePatrolVal('ThreatDistanceLimit', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Noise Investigation Limit (m)</label>
                            <input type="number" value={selectedPatrol.NoiseInvestigationDistanceLimit ?? -1} onChange={e => handleUpdatePatrolVal('NoiseInvestigationDistanceLimit', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Max Flanking Distance (m)</label>
                            <input type="number" value={selectedPatrol.MaxFlankingDistance ?? -1} onChange={e => handleUpdatePatrolVal('MaxFlankingDistance', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Enable Flanking</label>
                            <select value={selectedPatrol.EnableFlankingOutsideCombat ?? -1} onChange={e => handleUpdatePatrolVal('EnableFlankingOutsideCombat', Number(e.target.value))}>
                              <option value={-1}>-1 - Use Global</option>
                              <option value={1}>1 - Enabled</option>
                              <option value={0}>0 - Disabled</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Factions, Behavior, Loot */}
                      <div className="card-hud">
                        <h4>// BEHAVIOR, FACTIONS & DEATH LOOT</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>AI Faction</label>
                            <select value={selectedPatrol.Faction || 'West'} onChange={e => handleUpdatePatrolVal('Faction', e.target.value)}>
                              {FACTIONS.map(f => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>AI Behavior Model</label>
                            <select value={selectedPatrol.Behaviour || 'LOOP_OR_ALTERNATE'} onChange={e => handleUpdatePatrolVal('Behaviour', e.target.value)}>
                              {BEHAVIOURS.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Patrol Speed</label>
                            <select value={selectedPatrol.Speed || 'JOG'} onChange={e => handleUpdatePatrolVal('Speed', e.target.value)}>
                              {SPEEDS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Under Threat Speed</label>
                            <select value={selectedPatrol.UnderThreatSpeed || 'SPRINT'} onChange={e => handleUpdatePatrolVal('UnderThreatSpeed', e.target.value)}>
                              {SPEEDS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Default Stance</label>
                            <select value={selectedPatrol.DefaultStance || 'CROUCHED'} onChange={e => handleUpdatePatrolVal('DefaultStance', e.target.value)}>
                              {STANCES.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Loot Drop on Death Profile</label>
                            <select value={selectedPatrol.LootDropOnDeath || ''} onChange={e => handleUpdatePatrolVal('LootDropOnDeath', e.target.value)}>
                              <option value="">None (Use default)</option>
                              {lootDropsList.map(l => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Damage Multipliers & Health */}
                      <div className="card-hud">
                        <h4>// HEALTH, DAMAGE MULTIPLIERS & AMMO</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>Damage Multiplier (Dealt)</label>
                            <input type="number" step="any" value={selectedPatrol.DamageMultiplier ?? -1.0} onChange={e => handleUpdatePatrolVal('DamageMultiplier', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Damage Received Multiplier</label>
                            <input type="number" step="any" value={selectedPatrol.DamageReceivedMultiplier ?? -1.0} onChange={e => handleUpdatePatrolVal('DamageReceivedMultiplier', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Headshot Resistance</label>
                            <input type="number" step="any" value={selectedPatrol.HeadshotResistance ?? 0.0} onChange={e => handleUpdatePatrolVal('HeadshotResistance', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Unlimited Reloads (Mags count)</label>
                            <input type="number" value={selectedPatrol.UnlimitedReload ?? 6} onChange={e => handleUpdatePatrolVal('UnlimitedReload', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>AI Lootable on Death</label>
                            <select value={selectedPatrol.CanBeLooted ?? 1} onChange={e => handleUpdatePatrolVal('CanBeLooted', Number(e.target.value))}>
                              <option value={1}>Yes (Can be looted)</option>
                              <option value={0}>No (Inventory locked)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Section 5: Units Classnames Array */}
                      <div className="card-hud">
                        <h4>// CUSTOM NPC UNITS IN PATROL</h4>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Specify the NPC types that spawn inside this patrol. If empty, standard bots spawn.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-primary)', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '2px', maxHeight: '150px', overflowY: 'auto' }}>
                          {(!selectedPatrol.Units || selectedPatrol.Units.length === 0) ? (
                            <span style={{ fontSize: '12px', color: 'var(--text-dark)', padding: '6px' }}>Empty (Spawns default NPCs)</span>
                          ) : (
                            selectedPatrol.Units.map((u, uIdx) => (
                              <div key={uIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ fontFamily: 'var(--font-mono)' }}>{u}</span>
                                <button className="btn btn-danger" onClick={() => handleRemoveUnit(uIdx)} style={{ padding: '2px 6px', fontSize: '10px' }}>×</button>
                              </div>
                            ))
                          )}
                        </div>
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ADD UNIT CLASS:</span>
                          <AutocompleteInput
                            suggestions={itemSuggestions}
                            placeholder="e.g. SurvivorM_Mirek"
                            onSelect={handleAddUnit}
                            value={newClothingInput}
                            onChange={setNewClothingInput}
                          />
                        </div>
                      </div>

                      {/* Section 6: Waypoints route */}
                      <div className="card-hud">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0 }}>// PATROL WAYPOINTS</h4>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn btn-accent" 
                              onClick={() => {
                                if (selectedPatrol.Waypoints?.length > 0) {
                                  onNavigateToMap(selectedPatrol.Waypoints[0], ['Patrols', selectedPatrolIdx, 'Waypoints', 0]);
                                }
                              }}
                              disabled={!selectedPatrol.Waypoints || selectedPatrol.Waypoints.length === 0}
                              style={{ padding: '4px 8px', fontSize: '10px' }}
                            >
                              🗺 PLOT ON MAP
                            </button>
                            <button className="btn" onClick={handleAddWaypoint} style={{ padding: '4px 8px', fontSize: '10px' }}>
                              [+] ADD WAYPOINT
                            </button>
                          </div>
                        </div>
                        {(!selectedPatrol.Waypoints || selectedPatrol.Waypoints.length === 0) ? (
                          <div style={{ padding: '16px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            No waypoints. AI remains static.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {selectedPatrol.Waypoints.map((wp, wpIdx) => (
                              <div key={wpIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-primary)', padding: '6px 10px', border: '1px solid var(--border-color)' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '20px' }}>#{wpIdx+1}</span>
                                <input type="number" step="any" value={wp[0]} onChange={e => handleWaypointChange(wpIdx, 0, e.target.value)} style={{ padding: '3px', fontSize: '11px' }} placeholder="X" />
                                <input type="number" step="any" value={wp[1]} onChange={e => handleWaypointChange(wpIdx, 1, e.target.value)} style={{ padding: '3px', fontSize: '11px' }} placeholder="Y" />
                                <input type="number" step="any" value={wp[2]} onChange={e => handleWaypointChange(wpIdx, 2, e.target.value)} style={{ padding: '3px', fontSize: '11px' }} placeholder="Z" />
                                <button className="btn btn-accent" onClick={() => onNavigateToMap(wp, ['Patrols', selectedPatrolIdx, 'Waypoints', wpIdx])} style={{ padding: '3px 6px', fontSize: '9px' }}>🗺</button>
                                <button className="btn btn-danger" onClick={() => handleRemoveWaypoint(wpIdx)} style={{ padding: '3px 6px', fontSize: '10px' }}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      NO PATROLS DETECTED. CLICK '+' ON THE LEFT PANEL TO CREATE A PATROL.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* 2. LOADOUT DESIGNER VIEW */}
        {/* ========================================================================= */}
        {activeTab === 'loadouts' && (
          <>
            {/* Sidebar of loadout files */}
            <div style={{ 
              width: '240px', 
              background: 'var(--bg-secondary)', 
              borderRight: '1px solid var(--border-color)', 
              display: 'flex', 
              flexDirection: 'column',
              userSelect: 'none'
            }}>
              <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: 'bold' }}>
                  // BOT_LOADOUTS
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '2px' }}>
                  TOTAL: {loadoutPaths.length} PROFILES
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loadoutPaths.map(path => {
                  const isSelected = path === selectedLoadoutPath;
                  const file = configs[path];
                  const hasUnsaved = file && JSON.stringify(file.content) !== JSON.stringify(file.originalContent);
                  const name = path.split('/').pop().replace('.json', '');

                  return (
                    <div
                      key={path}
                      onClick={() => setSelectedLoadoutPath(path)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        background: isSelected ? 'rgba(149, 192, 149, 0.1)' : 'transparent',
                        borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                        color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)',
                        borderBottom: '1px solid rgba(30, 48, 30, 0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.1s'
                      }}
                      onMouseOver={e => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(149, 192, 149, 0.03)';
                      }}
                      onMouseOut={e => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '600' }}>{name}</span>
                      {hasUnsaved && <span className="badge-dirty" />}
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                <button className="btn btn-accent" onClick={handleCreateLoadout} style={{ width: '100%', justifyContent: 'center' }}>
                  [+] CREATE LOADOUT
                </button>
              </div>
            </div>

            {/* Loadout Designer Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              {activeLoadoutConfig ? (
                <>
                  {/* Action Bar */}
                  <div style={{ 
                    padding: '16px 20px', 
                    background: 'var(--bg-secondary)', 
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>EDITING LOADOUT: </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                        {selectedLoadoutPath.split('/').pop()}
                      </span>
                      {isLoadoutDirty && <span style={{ color: 'var(--warning-color)', fontSize: '11px', marginLeft: '8px' }}>(UNSAVED ●)</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className={`btn ${isLoadoutDirty ? 'btn-accent' : ''}`}
                        onClick={() => onSaveFile(selectedLoadoutPath)}
                        disabled={!isLoadoutDirty}
                        style={{ opacity: isLoadoutDirty ? 1 : 0.5 }}
                      >
                        SAVE LOADOUT
                      </button>
                      <button className="btn btn-accent" onClick={handleCloneLoadout}>
                        CLONE PROFILE
                      </button>
                      <button className="btn btn-danger" onClick={handleDeleteLoadout}>
                        DELETE FILE
                      </button>
                    </div>
                  </div>

                  {/* Split Slots and Cargo */}
                  <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    
                    {/* Clothing Slots select list */}
                    <div style={{ 
                      width: '180px', 
                      background: 'var(--bg-secondary)', 
                      borderRight: '1px solid var(--border-color)',
                      overflowY: 'auto'
                    }}>
                      <div style={{ padding: '10px 14px', fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)' }}>
                        CLOTHING SLOTS
                      </div>
                      {CLOTHING_SLOTS.map(s => {
                        const itemsCount = getSlotItems(activeLoadoutConfig.content, s).length;
                        const isSelected = selectedSlot === s;
                        return (
                          <div
                            key={s}
                            onClick={() => setSelectedSlot(s)}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              background: isSelected ? 'rgba(149, 192, 149, 0.08)' : 'transparent',
                              color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)',
                              borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.02)',
                              display: 'flex',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span>{s}</span>
                            {itemsCount > 0 && <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>({itemsCount})</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Clothing Slot Items Details & Cargo */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      {/* Slot items list */}
                      <div className="card-hud">
                        <h4>// CLOTHING ITEMS FOR SLOT: {selectedSlot.toUpperCase()}</h4>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {getSlotItems(activeLoadoutConfig.content, selectedSlot).length === 0 ? (
                            <div style={{ padding: '20px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              No clothes assigned to this slot. The bot will spawn naked in this slot.
                            </div>
                          ) : (
                            getSlotItems(activeLoadoutConfig.content, selectedSlot).map((item, idx) => {
                              const minH = item.Health?.[0]?.Min ?? 0.7;
                              const maxH = item.Health?.[0]?.Max ?? 1.0;
                              return (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'center', background: 'var(--bg-primary)', padding: '10px', border: '1px solid var(--border-color)' }}>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {item.ClassName}
                                    {isItemMissing(item.ClassName) && (
                                      <span title="Warning: This item classname is not found in the loaded types.xml database." style={{ color: 'var(--warning-color)', cursor: 'help' }}>⚠️</span>
                                    )}
                                  </div>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '9px' }}>Chance</label>
                                    <input type="number" step="any" value={item.Chance ?? 1.0} onChange={e => handleUpdateClothingItemField(selectedSlot, idx, 'Chance', e.target.value)} style={{ padding: '2px' }} />
                                  </div>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '9px' }}>Min Health</label>
                                    <input type="number" step="any" value={minH} onChange={e => handleUpdateClothingItemField(selectedSlot, idx, 'MinHealth', e.target.value)} style={{ padding: '2px' }} />
                                  </div>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '9px' }}>Max Health</label>
                                    <input type="number" step="any" value={maxH} onChange={e => handleUpdateClothingItemField(selectedSlot, idx, 'MaxHealth', e.target.value)} style={{ padding: '2px' }} />
                                  </div>
                                  <button className="btn btn-danger" onClick={() => handleRemoveClothingItem(selectedSlot, idx)} style={{ padding: '6px 10px', fontSize: '12px', marginTop: '12px' }}>×</button>
                                </div>
                              );
                            })
                          )}
                          
                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ADD CLOTHING:</span>
                            <AutocompleteInput
                              suggestions={itemSuggestions}
                              placeholder="Type clothing classname..."
                              onSelect={(name) => handleAddClothingItem(selectedSlot, name)}
                              value={newClothingInput}
                              onChange={setNewClothingInput}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cargo Inventory items list */}
                      <div className="card-hud">
                        <h4>// BOT INVENTORY CARGO & WEAPONS (СНАРЯЖЕНИЕ / ЛУТ)</h4>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {(!activeLoadoutConfig.content.InventoryCargo || activeLoadoutConfig.content.InventoryCargo.length === 0) ? (
                            <div style={{ padding: '20px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              Inventory is empty. No extra cargo/weapons spawned.
                            </div>
                          ) : (
                            activeLoadoutConfig.content.InventoryCargo.map((item, idx) => {
                              const minQ = item.Quantity?.Min ?? 1;
                              const maxQ = item.Quantity?.Max ?? 1;
                              return (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'center', background: 'var(--bg-primary)', padding: '10px', border: '1px solid var(--border-color)' }}>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {item.ClassName}
                                    {isItemMissing(item.ClassName) && (
                                      <span title="Warning: This item classname is not found in the loaded types.xml database." style={{ color: 'var(--warning-color)', cursor: 'help' }}>⚠️</span>
                                    )}
                                  </div>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '9px' }}>Spawn Chance</label>
                                    <input type="number" step="any" value={item.Chance ?? 1.0} onChange={e => handleUpdateCargoItemField(idx, 'Chance', e.target.value)} style={{ padding: '2px' }} />
                                  </div>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '9px' }}>Min Qty</label>
                                    <input type="number" value={minQ} onChange={e => handleUpdateCargoItemField(idx, 'MinQty', e.target.value)} style={{ padding: '2px' }} />
                                  </div>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '9px' }}>Max Qty</label>
                                    <input type="number" value={maxQ} onChange={e => handleUpdateCargoItemField(idx, 'MaxQty', e.target.value)} style={{ padding: '2px' }} />
                                  </div>
                                  <button className="btn btn-danger" onClick={() => handleRemoveCargoItem(idx)} style={{ padding: '6px 10px', fontSize: '12px', marginTop: '12px' }}>×</button>
                                </div>
                              );
                            })
                          )}

                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ADD CARGO ITEM:</span>
                            <AutocompleteInput
                              suggestions={itemSuggestions}
                              placeholder="Type weapon or item classname..."
                              onSelect={handleAddCargoItem}
                              value={newCargoInput}
                              onChange={setNewCargoInput}
                            />
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <span>SELECT LOADOUT PROFILE FROM SIDEBAR</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* 3. ROAMING LOCATIONS VIEW */}
        {/* ========================================================================= */}
        {activeTab === 'roaming' && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flex: 1, 
            padding: '40px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            textAlign: 'center'
          }}>
            <div style={{
              background: 'rgba(255, 159, 67, 0.02)',
              border: '1px dashed rgba(255, 159, 67, 0.4)',
              borderRadius: '2px',
              padding: '40px',
              maxWidth: '550px',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🗺️</span>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '20px', margin: '0 0 12px 0' }}>
                VISUAL ROAMING LOCATIONS EDITOR
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                Roaming locations, settlement centers, and spawn boundaries have been migrated completely to the <strong>Interactive Map</strong> tab. 
                This allows you to drag settlements, resize spawn radii, and manage NoGo zones visually in real-time. 
                Global building exclusions are also available in the map sidebar.
              </p>
              <button 
                className="btn btn-accent" 
                onClick={() => setGlobalActiveTab('map')}
                style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 'bold', margin: '0 auto', letterSpacing: '1px' }}
              >
                GO TO INTERACTIVE MAP
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. LOOT DROPS VIEW */}
        {/* ========================================================================= */}
        {activeTab === 'loot_drops' && (
          <>
            {/* Sidebar of Loot Drop files */}
            <div style={{ 
              width: '240px', 
              background: 'var(--bg-secondary)', 
              borderRight: '1px solid var(--border-color)', 
              display: 'flex', 
              flexDirection: 'column',
              userSelect: 'none'
            }}>
              <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: 'bold' }}>
                  // AI_LOOT_TABLES
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '2px' }}>
                  TOTAL: {lootDropPaths.length} PROFILES
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {lootDropPaths.map(path => {
                  const isSelected = path === selectedLootDropPath;
                  const file = configs[path];
                  const hasUnsaved = file && JSON.stringify(file.content) !== JSON.stringify(file.originalContent);
                  const name = path.split('/').pop().replace('.json', '');

                  return (
                    <div
                      key={path}
                      onClick={() => setSelectedLootDropPath(path)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        background: isSelected ? 'rgba(149, 192, 149, 0.1)' : 'transparent',
                        borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                        color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)',
                        borderBottom: '1px solid rgba(30, 48, 30, 0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.1s'
                      }}
                      onMouseOver={e => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(149, 192, 149, 0.03)';
                      }}
                      onMouseOut={e => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '600' }}>{name}</span>
                      {hasUnsaved && <span className="badge-dirty" />}
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                <button className="btn btn-accent" onClick={handleCreateLootDrop} style={{ width: '100%', justifyContent: 'center' }}>
                  [+] CREATE LOOT PROFILE
                </button>
              </div>
            </div>

            {/* Loot Drop Main Editor Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              {selectedLootDropPath && configs[selectedLootDropPath] && configs[selectedLootDropPath].success ? (
                <>
                  <div style={{ 
                    padding: '16px 20px', 
                    background: 'var(--bg-secondary)', 
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>EDITING PROFILE: </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                        {selectedLootDropPath.split('/').pop()}
                      </span>
                      {JSON.stringify(configs[selectedLootDropPath].content) !== JSON.stringify(configs[selectedLootDropPath].originalContent) && (
                        <span style={{ color: 'var(--warning-color)', fontSize: '11px', marginLeft: '8px' }}>(UNSAVED ●)</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-accent"
                        onClick={() => onSaveFile(selectedLootDropPath)}
                      >
                        SAVE LOOT TABLE
                      </button>
                      <button className="btn btn-accent" onClick={handleCloneLootDrop}>
                        CLONE PROFILE
                      </button>
                      <button className="btn btn-danger" onClick={handleDeleteLootDrop}>
                        DELETE PROFILE
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    <div className="card-hud">
                      <h4>// LOOT DROPS INDEX ({configs[selectedLootDropPath].content.length || 0} ITEMS)</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                        {configs[selectedLootDropPath].content.length === 0 ? (
                          <div style={{ padding: '20px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            Loot table is empty. No drops configured for bots using this profile.
                          </div>
                        ) : (
                          configs[selectedLootDropPath].content.map((item, idx) => {
                            const minH = item.Health?.[0]?.Min ?? 0.7;
                            const maxH = item.Health?.[0]?.Max ?? 1.0;
                            const minQ = item.Quantity?.Min ?? 1;
                            const maxQ = item.Quantity?.Max ?? 1;

                            return (
                              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'center', background: 'var(--bg-primary)', padding: '10px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {item.ClassName}
                                  {isItemMissing(item.ClassName) && (
                                    <span title="Warning: This item classname is not found in the loaded types.xml database." style={{ color: 'var(--warning-color)', cursor: 'help' }}>⚠️</span>
                                  )}
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '9px' }}>Drop Chance</label>
                                  <input type="number" step="any" value={item.Chance ?? 1.0} onChange={e => handleUpdateLootDropItemField(idx, 'Chance', e.target.value)} style={{ padding: '2px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '9px' }}>Min Qty</label>
                                  <input type="number" value={minQ} onChange={e => handleUpdateLootDropItemField(idx, 'MinQty', e.target.value)} style={{ padding: '2px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '9px' }}>Max Qty</label>
                                  <input type="number" value={maxQ} onChange={e => handleUpdateLootDropItemField(idx, 'MaxQty', e.target.value)} style={{ padding: '2px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '9px' }}>Min Health</label>
                                  <input type="number" step="any" value={minH} onChange={e => handleUpdateLootDropItemField(idx, 'MinHealth', e.target.value)} style={{ padding: '2px' }} />
                                </div>
                                <button className="btn btn-danger" onClick={() => handleRemoveLootDropItem(idx)} style={{ padding: '6px 10px', fontSize: '12px', marginTop: '12px' }}>×</button>
                              </div>
                            );
                          })
                        )}

                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ADD ITEM TO LOOT DROP:</span>
                          <AutocompleteInput
                            suggestions={itemSuggestions}
                            placeholder="Type classname to drop..."
                            onSelect={handleAddLootDropItem}
                            value={newDropItemInput}
                            onChange={setNewDropItemInput}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <span>SELECT LOOT PROFILE FROM SIDEBAR</span>
                </div>
              )}
            </div>
          </>
        )}

      </div>

    </div>
  );
}
