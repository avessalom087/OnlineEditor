import React, { useState, useEffect } from 'react';
import AutocompleteInput from './shared/AutocompleteInput';
import CoordinatesInput from './shared/CoordinatesInput';
import HelpIcon from './HelpIcon';
import { useTranslation } from '../utils/localization';
import { getExpansionModPrefix } from '../utils/pathUtils';


const FACTIONS = ['West', 'East', 'Guards', 'Civilian', 'Passive', 'Aggressive', 'Shamans', 'Survivors', 'Raiders', 'Mercenaries', 'Zombies', 'PassiveZombies'];
const BEHAVIOURS = ['HALT', 'LOOP_OR_ALTERNATE', 'HALT_OR_LOOP', 'WANDER', 'PATROL', 'ROAMING_LOCAL', 'ROAMING_SELF', 'PATROL_ROAMING', 'ROAMING_UNLIMITED'];
const SPEEDS = ['WALK', 'JOG', 'RUN', 'SPRINT'];
const STANCES = ['STANDING', 'CROUCHED', 'PRONE', 'RELAXED'];
const CLOTHING_SLOTS = ['Body', 'Legs', 'Feet', 'Vest', 'Headgear', 'Gloves', 'Backpack', 'Mask', 'Eyewear', 'Shoulder', 'Melee'];
const LOCATION_TYPES = ['Village', 'City', 'Military', 'Industrial', 'Custom'];

const DEFAULT_FACTION_UNITS = {
  West: ['ExpansionHardlineAIBotWestMale', 'ExpansionHardlineAIBotWestFemale'],
  East: ['ExpansionHardlineAIBotEastMale', 'ExpansionHardlineAIBotEastFemale'],
  Guards: ['ExpansionHardlineAIBotGuardsMale', 'ExpansionHardlineAIBotGuardsFemale'],
  Civilian: ['ExpansionHardlineAIBotCivMale', 'ExpansionHardlineAIBotCivFemale'],
  Passive: ['ExpansionHardlineAIBotCivMale', 'ExpansionHardlineAIBotCivFemale'],
  Aggressive: ['ExpansionHardlineAIBotCivMale', 'ExpansionHardlineAIBotCivFemale'],
  Shamans: ['ExpansionHardlineAIBotCivMale', 'ExpansionHardlineAIBotCivFemale'],
  Survivors: ['ExpansionHardlineAIBotCivMale', 'ExpansionHardlineAIBotCivFemale'],
  Raiders: ['ExpansionHardlineAIBotCivMale', 'ExpansionHardlineAIBotCivFemale'],
  Mercenaries: ['ExpansionHardlineAIBotWestMale', 'ExpansionHardlineAIBotWestFemale'],
  Zombies: ['ExpansionHardlineAIBotCivMale'],
  PassiveZombies: ['ExpansionHardlineAIBotCivMale']
};

const DIFFICULTY_PRESETS = {
  easy: { AccuracyMin: 0.15, AccuracyMax: 0.35, ThreatDistanceLimit: 100, NoiseInvestigationDistanceLimit: 100, DamageMultiplier: 0.5, DamageReceivedMultiplier: 1.5, HeadshotResistance: 0.0, Speed: 'WALK', UnderThreatSpeed: 'JOG' },
  medium: { AccuracyMin: 0.35, AccuracyMax: 0.65, ThreatDistanceLimit: 180, NoiseInvestigationDistanceLimit: 150, DamageMultiplier: 0.9, DamageReceivedMultiplier: 1.0, HeadshotResistance: 0.1, Speed: 'JOG', UnderThreatSpeed: 'SPRINT' },
  hard: { AccuracyMin: 0.65, AccuracyMax: 0.85, ThreatDistanceLimit: 300, NoiseInvestigationDistanceLimit: 250, DamageMultiplier: 1.3, DamageReceivedMultiplier: 0.7, HeadshotResistance: 0.3, Speed: 'JOG', UnderThreatSpeed: 'SPRINT' },
  sniper: { AccuracyMin: 0.85, AccuracyMax: 0.98, ThreatDistanceLimit: 500, NoiseInvestigationDistanceLimit: 300, DamageMultiplier: 1.8, DamageReceivedMultiplier: 1.0, HeadshotResistance: 0.2, Speed: 'WALK', UnderThreatSpeed: 'SPRINT', DefaultStance: 'PRONE' },
  boss: { AccuracyMin: 0.80, AccuracyMax: 0.95, ThreatDistanceLimit: 400, NoiseInvestigationDistanceLimit: 300, DamageMultiplier: 2.2, DamageReceivedMultiplier: 0.3, HeadshotResistance: 0.7, Speed: 'JOG', UnderThreatSpeed: 'SPRINT' }
};

const CLOTHING_PRESETS = {
  Military: {
    Body: ['M65Jacket_Khaki', 'M65Jacket_Olive', 'M65Jacket_Tan'],
    Legs: ['CargoPants_Beige', 'CargoPants_Green', 'CargoPants_Grey'],
    Feet: ['CombatBoots_Black', 'CombatBoots_Green'],
    Vest: ['HighCapacityVest_Olive', 'HighCapacityVest_Black'],
    Headgear: ['MICH2001Helmet'],
    Backpack: ['TortillaBag'],
    Gloves: ['TacticalGloves_Green', 'TacticalGloves_Black']
  },
  Police: {
    Body: ['PoliceJacket', 'PoliceJacketOrel'],
    Legs: ['PolicePants', 'PolicePantsOrel'],
    Feet: ['CombatBoots_Black'],
    Vest: ['PoliceVest'],
    Headgear: ['PoliceCap'],
    Gloves: ['WorkingGloves_Black']
  },
  Civilian: {
    Body: ['Hoodie_Green', 'Hoodie_Grey', 'Hoodie_Black'],
    Legs: ['Jeans_Black', 'Jeans_BlueDark'],
    Feet: ['AthleticShoes_Black', 'AthleticShoes_Grey'],
    Backpack: ['MountainBag_Red', 'MountainBag_Blue']
  },
  NBC: {
    Body: ['NBCJacket_Yellow', 'NBCJacket_Gray'],
    Legs: ['NBCPants_Yellow', 'NBCPants_Gray'],
    Feet: ['NBCBoots_Yellow', 'NBCBoots_Gray'],
    Gloves: ['NBCGloves_Yellow', 'NBCGloves_Gray'],
    Mask: ['GP5GasMask'],
    Headgear: ['NBCHood_Yellow', 'NBCHood_Gray']
  }
};

const WEAPON_PRESETS = {
  M4A1: {
    weapon: 'M4A1',
    magazine: 'Mag_STANAG_30Rnd',
    ammo: 'Ammo_556x45'
  },
  AKM: {
    weapon: 'AKM',
    magazine: 'Mag_AKM_30Rnd',
    ammo: 'Ammo_762x39'
  },
  MP5K: {
    weapon: 'MP5K',
    magazine: 'Mag_MP5_30Rnd',
    ammo: 'Ammo_9x19'
  },
  Mosin: {
    weapon: 'Mosin9130',
    magazine: '',
    ammo: 'Ammo_762x54'
  },
  Ruger1022: {
    weapon: 'Ruger1022',
    magazine: 'Mag_Ruger1022_30Rnd',
    ammo: 'Ammo_22'
  },
  None: null
};

const LOOT_PRESETS = {
  'Military Ammo': [
    { ClassName: 'Ammo_556x45', Chance: 0.5, Min: 10, Max: 20 },
    { ClassName: 'Ammo_762x39', Chance: 0.5, Min: 10, Max: 20 },
    { ClassName: 'Ammo_9x19', Chance: 0.6, Min: 15, Max: 25 },
    { ClassName: 'Mag_STANAG_30Rnd', Chance: 0.25, Min: 1, Max: 1 }
  ],
  'Medical': [
    { ClassName: 'BandageDressing', Chance: 0.8, Min: 1, Max: 2 },
    { ClassName: 'FirstAidKit', Chance: 0.4, Min: 1, Max: 1 },
    { ClassName: 'Morphine', Chance: 0.2, Min: 1, Max: 1 },
    { ClassName: 'Epinephrine', Chance: 0.2, Min: 1, Max: 1 }
  ],
  'Food & Drinks': [
    { ClassName: 'SodaCan_Cola', Chance: 0.6, Min: 1, Max: 1 },
    { ClassName: 'SodaCan_Spite', Chance: 0.6, Min: 1, Max: 1 },
    { ClassName: 'PeachesCan', Chance: 0.5, Min: 1, Max: 1 },
    { ClassName: 'TunaCan', Chance: 0.4, Min: 1, Max: 1 }
  ],
  'Empty': []
};



function ConfigListRow({
  className,
  isMissing,
  missingTooltip,
  fields,
  onRemove
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'center', background: 'var(--bg-primary)', padding: '10px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {className}
        {isMissing && (
          <span title={missingTooltip} style={{ color: 'var(--warning-color)', cursor: 'help' }}>⚠️</span>
        )}
      </div>
      {fields.map((f, idx) => (
        <div key={idx} className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '11px' }}>{f.label}</label>
          <input type="number" step={f.step || '1'} value={f.value} onChange={f.onChange} style={{ padding: '2px' }} />
        </div>
      ))}
      <button className="btn btn-danger" onClick={onRemove} style={{ padding: '6px 10px', fontSize: '12px', marginTop: '12px' }}>×</button>
    </div>
  );
}


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
  const { t, lang } = useTranslation();

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('dayz_editor_aibots_active_tab') || 'patrols'); // 'patrols', 'loadouts', 'roaming', 'loot_drops'

  useEffect(() => {
    localStorage.setItem('dayz_editor_aibots_active_tab', activeTab);
  }, [activeTab]);
  const xmlItemsSet = React.useMemo(() => {
    const arr = Array.isArray(xmlItems) ? xmlItems : [];
    return new Set(arr.filter(i => typeof i === 'string').map(i => i.toLowerCase()));
  }, [xmlItems]);
  const isItemMissing = (className) => {
    if (typeof className !== 'string' || !className) return false;
    const arr = Array.isArray(xmlItems) ? xmlItems : [];
    if (arr.length === 0) return false;
    return !xmlItemsSet.has(className.toLowerCase());
  };
  const [selectedPatrolIdx, setSelectedPatrolIdx] = useState(0);
  const [selectedPatrols, setSelectedPatrols] = useState([]);
  const [bulkFields, setBulkFields] = useState({
    Faction: { enabled: false, value: 'West' },
    Behaviour: { enabled: false, value: 'LOOP_OR_ALTERNATE' },
    Speed: { enabled: false, value: 'JOG' },
    UnderThreatSpeed: { enabled: false, value: 'SPRINT' },
    DefaultStance: { enabled: false, value: 'CROUCHED' },
    Loadout: { enabled: false, value: 'SurvivorLoadout' },
    LootDropOnDeath: { enabled: false, value: '' },
    NumberOfAI: { enabled: false, value: 1 },
    NumberOfAIMax: { enabled: false, value: 2 }
  });
  const [activeSubTab, setActiveSubTab] = useState('patrols'); // 'patrols', 'general'
  
  // Loadout editor states
  const [selectedLoadoutPath, setSelectedLoadoutPath] = useState(() => localStorage.getItem('dayz_editor_aibots_selected_loadout_path') || null);

  useEffect(() => {
    if (selectedLoadoutPath) {
      localStorage.setItem('dayz_editor_aibots_selected_loadout_path', selectedLoadoutPath);
    } else {
      localStorage.removeItem('dayz_editor_aibots_selected_loadout_path');
    }
  }, [selectedLoadoutPath]);
  const [selectedSlot, setSelectedSlot] = useState('Body');
  const [newClothingInput, setNewClothingInput] = useState('');
  const [newCargoInput, setNewCargoInput] = useState('');

  // Roaming locations states
  const [selectedLocationIdx, setSelectedLocationIdx] = useState(0);
  const [newBuildingInput, setNewBuildingInput] = useState('');

  // Loot drops editor states
  const [selectedLootDropPath, setSelectedLootDropPath] = useState(null);
  const [newDropItemInput, setNewDropItemInput] = useState('');

  // Global AI list states
  const [newAdminInput, setNewAdminInput] = useState('');
  const [newFactionInput, setNewFactionInput] = useState('');
  const [newClimbInput, setNewClimbInput] = useState('');

  // Patrol Wizard states
  const [showPatrolWizard, setShowPatrolWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wPatrolName, setWPatrolName] = useState('');
  const [wFaction, setWFaction] = useState('West');
  const [wDifficulty, setWDifficulty] = useState('medium');
  const [wNumAI, setWNumAI] = useState(1);
  const [wNumAIMax, setWNumAIMax] = useState(2);
  const [wBehaviour, setWBehaviour] = useState('LOOP_OR_ALTERNATE');
  const [wCoords, setWCoords] = useState([7500.0, 0.0, 7500.0]);
  const [wUnits, setWUnits] = useState(['ExpansionHardlineAIBotWestMale', 'ExpansionHardlineAIBotWestFemale']);
  const [wLoadoutName, setWLoadoutName] = useState('');
  const [wClothingPreset, setWClothingPreset] = useState('Military');
  const [wWeaponChoice, setWWeaponChoice] = useState('M4A1');
  const [wFoodChoice, setWFoodChoice] = useState(true);
  const [wLootName, setWLootName] = useState('');
  const [wLootPreset, setWLootPreset] = useState('Military Ammo');
  const [wLootItems, setWLootItems] = useState([]);

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
      if ((lower.includes('/loadouts/') || lower.startsWith('loadouts/')) && filePath.endsWith('.json')) {
        loadouts.push(filePath.split('/').pop().replace('.json', ''));
      }
      if ((lower.includes('/ai/lootdrops/') || lower.startsWith('ai/lootdrops/')) && filePath.endsWith('.json')) {
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

    (Array.isArray(xmlItems) ? xmlItems : []).forEach(item => {
      if (typeof item === 'string') items.add(item);
    });
    setLoadoutsList(loadouts.sort());
    setLootDropsList(lootDrops.sort());
    setItemSuggestions(Array.from(items).sort());
  }, [configs, xmlItems]);

  // Set default loadout selection on load
  const loadoutPaths = Object.keys(configs).filter(p => 
    (p.toLowerCase().includes('/loadouts/') || p.toLowerCase().startsWith('loadouts/')) && configs[p].success
  );
  loadoutPaths.sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()));

  useEffect(() => {
    const saved = localStorage.getItem('dayz_editor_aibots_selected_loadout_path');
    if (saved && loadoutPaths.includes(saved)) {
      if (selectedLoadoutPath !== saved) {
        setSelectedLoadoutPath(saved);
      }
    } else if (loadoutPaths.length > 0 && (!selectedLoadoutPath || !loadoutPaths.includes(selectedLoadoutPath))) {
      setSelectedLoadoutPath(loadoutPaths[0]);
    }
  }, [loadoutPaths, selectedLoadoutPath]);

  // Set default loot drop selection on load
  const lootDropPaths = Object.keys(configs).filter(p => 
    (p.toLowerCase().includes('/ai/lootdrops/') || p.toLowerCase().startsWith('ai/lootdrops/')) && configs[p].success
  );
  lootDropPaths.sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()));

  useEffect(() => {
    if (lootDropPaths.length > 0 && !selectedLootDropPath) {
      setSelectedLootDropPath(lootDropPaths[0]);
    }
  }, [lootDropPaths, selectedLootDropPath]);

  const patrolsCount = (patrolFile && patrolFile.success && patrolFile.content && Array.isArray(patrolFile.content.Patrols))
    ? patrolFile.content.Patrols.length 
    : 0;

  useEffect(() => {
    setSelectedPatrols([]);
  }, [patrolsCount]);

  // -------------------------------------------------------------
  // PATROLS ACTIONS & RENDERING
  // -------------------------------------------------------------
  if (!patrolFile || !patrolFile.success) {
    return (
      <div style={{ padding: '24px', color: 'var(--danger-color)', textAlign: 'center' }}>
        <h3>{t('ai_err_missing_config')}</h3>
        {patrolFile && <p>{patrolFile.error}</p>}
      </div>
    );
  }

  const patrolContent = patrolFile.content;
  const isPatrolDirty = patrolFile?.isDirty;
  const patrols = Array.isArray(patrolContent.Patrols) ? patrolContent.Patrols : [];
  const selectedPatrol = patrols[selectedPatrolIdx];

  const currentDifficultyPreset = React.useMemo(() => {
    if (!selectedPatrol) return "";
    const presets = {
      easy: { AccuracyMin: 0.15, AccuracyMax: 0.35, ThreatDistanceLimit: 100, NoiseInvestigationDistanceLimit: 100, DamageMultiplier: 0.5, DamageReceivedMultiplier: 1.5, HeadshotResistance: 0.0, Speed: 'WALK', UnderThreatSpeed: 'JOG', Faction: 'Civilian' },
      medium: { AccuracyMin: 0.35, AccuracyMax: 0.65, ThreatDistanceLimit: 180, NoiseInvestigationDistanceLimit: 150, DamageMultiplier: 0.9, DamageReceivedMultiplier: 1.0, HeadshotResistance: 0.1, Speed: 'JOG', UnderThreatSpeed: 'SPRINT', Faction: 'Aggressive' },
      hard: { AccuracyMin: 0.65, AccuracyMax: 0.85, ThreatDistanceLimit: 300, NoiseInvestigationDistanceLimit: 250, DamageMultiplier: 1.3, DamageReceivedMultiplier: 0.7, HeadshotResistance: 0.3, Speed: 'JOG', UnderThreatSpeed: 'SPRINT', Faction: 'West' },
      sniper: { AccuracyMin: 0.85, AccuracyMax: 0.98, ThreatDistanceLimit: 500, NoiseInvestigationDistanceLimit: 300, DamageMultiplier: 1.8, DamageReceivedMultiplier: 1.0, HeadshotResistance: 0.2, Speed: 'WALK', UnderThreatSpeed: 'SPRINT', Faction: 'East', DefaultStance: 'PRONE' },
      boss: { AccuracyMin: 0.80, AccuracyMax: 0.95, ThreatDistanceLimit: 400, NoiseInvestigationDistanceLimit: 300, DamageMultiplier: 2.2, DamageReceivedMultiplier: 0.3, HeadshotResistance: 0.7, Speed: 'JOG', UnderThreatSpeed: 'SPRINT', Faction: 'Guards' }
    };
    
    for (const [presetName, values] of Object.entries(presets)) {
      const match = Object.entries(values).every(([k, v]) => {
        const patrolVal = selectedPatrol[k];
        if (patrolVal === undefined) return false;
        if (typeof v === 'number') {
          return Math.abs(Number(patrolVal) - v) < 0.01;
        }
        return String(patrolVal).toLowerCase() === String(v).toLowerCase();
      });
      if (match) return presetName;
    }
    return "";
  }, [selectedPatrol]);

  const handleUpdatePatrolVal = (key, value) => {
    onChangeField(patrolConfigPath, ['Patrols', selectedPatrolIdx, key], value);
  };

  const handleUpdatePatrolFields = (fieldsObj) => {
    onChangeField(patrolConfigPath, [], (content) => {
      if (!content || !Array.isArray(content.Patrols)) return content;
      const updatedContent = JSON.parse(JSON.stringify(content));
      const patrol = updatedContent.Patrols[selectedPatrolIdx];
      if (patrol) {
        Object.entries(fieldsObj).forEach(([k, v]) => {
          patrol[k] = v;
        });
      }
      return updatedContent;
    });
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
      alert(t('ai_alert_min_patrol'));
      return;
    }
    const nameVal = selectedPatrol.Name || `Patrol #${selectedPatrolIdx + 1}`;
    if (window.confirm(t('ai_confirm_delete_patrol', { name: nameVal }))) {
      const newList = [...patrols];
      newList.splice(selectedPatrolIdx, 1);
      onChangeField(patrolConfigPath, ['Patrols'], newList);
      setSelectedPatrolIdx(Math.max(0, selectedPatrolIdx - 1));
    }
  };

  const handleWizardFactionChange = (fac) => {
    setWFaction(fac);
    if (DEFAULT_FACTION_UNITS[fac]) {
      setWUnits(DEFAULT_FACTION_UNITS[fac]);
    } else {
      setWUnits([]);
    }
  };

  const handleWizardPresetLootSelect = (presetKey) => {
    setWLootPreset(presetKey);
    const items = LOOT_PRESETS[presetKey] || [];
    setWLootItems(items.map(item => ({ ...item })));
  };

  const handlePatrolWizardGenerate = () => {
    if (!wPatrolName.trim()) {
      alert(lang === 'ru' ? 'Введите имя патруля!' : 'Please enter a patrol name!');
      return;
    }

    const prefix = getExpansionModPrefix(configs);
    const loadoutName = wLoadoutName.trim() || `${wPatrolName.trim()}_Loadout`;
    const lootName = wLootName.trim() || `${wPatrolName.trim()}_Loot`;

    const loadoutPath = `${prefix}Loadouts/${loadoutName}.json`;
    const lootPath = `${prefix}AI/LootDrops/${lootName}.json`;

    // 1. Generate Loadout JSON content
    const attachments = CLOTHING_SLOTS.map(slotName => {
      const presetItems = CLOTHING_PRESETS[wClothingPreset]?.[slotName] || [];
      const items = presetItems.map(clsName => ({
        ClassName: clsName,
        Include: "",
        Chance: 1.0,
        Quantity: { Min: 0.0, Max: 0.0 },
        Health: [{ Min: 0.7, Max: 1.0, Zone: "" }],
        InventoryAttachments: [],
        InventoryCargo: [],
        ConstructionPartsBuilt: [],
        Sets: []
      }));
      return { SlotName: slotName, Items: items };
    });

    if (wWeaponChoice && wWeaponChoice !== 'None') {
      const wpPreset = WEAPON_PRESETS[wWeaponChoice];
      const weaponItem = {
        ClassName: wpPreset.weapon,
        Include: "",
        Chance: 1.0,
        Quantity: { Min: 0.0, Max: 0.0 },
        Health: [{ Min: 0.7, Max: 1.0, Zone: "" }],
        InventoryAttachments: [],
        InventoryCargo: [],
        ConstructionPartsBuilt: [],
        Sets: []
      };

      if (wpPreset.magazine) {
        weaponItem.InventoryAttachments.push({
          SlotName: "magazine",
          Items: [{
            ClassName: wpPreset.magazine,
            Include: "",
            Chance: 1.0,
            Quantity: { Min: 0.0, Max: 0.0 },
            Health: [{ Min: 0.7, Max: 1.0, Zone: "" }],
            InventoryAttachments: [],
            InventoryCargo: [],
            ConstructionPartsBuilt: [],
            Sets: []
          }]
        });
      }

      const shoulderSlot = attachments.find(a => a.SlotName === 'Shoulder');
      if (shoulderSlot) {
        shoulderSlot.Items.push(weaponItem);
      }
    }

    const cargo = [];
    if (wWeaponChoice && wWeaponChoice !== 'None') {
      const wpPreset = WEAPON_PRESETS[wWeaponChoice];
      if (wpPreset.ammo) {
        cargo.push({
          ClassName: wpPreset.ammo,
          Include: "",
          Chance: 1.0,
          Quantity: { Min: 1.0, Max: 1.0 },
          Health: [],
          InventoryAttachments: [],
          InventoryCargo: [],
          ConstructionPartsBuilt: [],
          Sets: []
        });
        cargo.push({
          ClassName: wpPreset.ammo,
          Include: "",
          Chance: 0.8,
          Quantity: { Min: 1.0, Max: 1.0 },
          Health: [],
          InventoryAttachments: [],
          InventoryCargo: [],
          ConstructionPartsBuilt: [],
          Sets: []
        });
      }
    }

    if (wFoodChoice) {
      cargo.push({
        ClassName: 'BandageDressing',
        Include: "",
        Chance: 0.9,
        Quantity: { Min: 0.0, Max: 0.0 },
        Health: [],
        InventoryAttachments: [],
        InventoryCargo: [],
        ConstructionPartsBuilt: [],
        Sets: []
      });
      cargo.push({
        ClassName: 'SodaCan_Cola',
        Include: "",
        Chance: 0.8,
        Quantity: { Min: 0.0, Max: 0.0 },
        Health: [],
        InventoryAttachments: [],
        InventoryCargo: [],
        ConstructionPartsBuilt: [],
        Sets: []
      });
      cargo.push({
        ClassName: 'PeachesCan',
        Include: "",
        Chance: 0.7,
        Quantity: { Min: 0.0, Max: 0.0 },
        Health: [],
        InventoryAttachments: [],
        InventoryCargo: [],
        ConstructionPartsBuilt: [],
        Sets: []
      });
    }

    const loadoutTemplate = {
      ClassName: "",
      Include: "",
      Chance: 1.0,
      Quantity: { Min: 0.0, Max: 0.0 },
      Health: [],
      InventoryAttachments: attachments,
      InventoryCargo: cargo,
      ConstructionPartsBuilt: [],
      Sets: []
    };

    // 2. Generate LootDrop JSON content
    const lootDropsContent = wLootItems.map(item => ({
      ClassName: item.ClassName,
      Include: "",
      Chance: Number(item.Chance) || 0.5,
      Quantity: {
        Min: Number(item.Min) || 0.0,
        Max: Number(item.Max) || 0.0
      },
      Health: [{ Min: 0.7, Max: 1.0, Zone: "" }],
      InventoryAttachments: [],
      InventoryCargo: [],
      ConstructionPartsBuilt: [],
      Sets: []
    }));

    // Create the files
    onCreateFile(loadoutPath, loadoutTemplate);
    onCreateFile(lootPath, lootDropsContent);

    // 3. Generate Patrol object
    const patrolDiff = DIFFICULTY_PRESETS[wDifficulty] || DIFFICULTY_PRESETS.medium;
    const newPatrol = {
      Name: wPatrolName.trim(),
      Persist: 0,
      Faction: wFaction,
      Formation: "",
      FormationScale: 1.5,
      FormationLooseness: 0.0,
      Loadout: loadoutName,
      Units: wUnits.filter(u => u.trim()),
      NumberOfAI: Number(wNumAI) || 1,
      NumberOfAIMax: Number(wNumAIMax) || 2,
      Behaviour: wBehaviour,
      LootingBehaviour: 'DEFAULT | CLOTHING_BODY | CLOTHING_LEGS | CLOTHING_GLOVES | CLOTHING_FEET | CLOTHING_SIMILAR | UPGRADE',
      Speed: patrolDiff.Speed || 'JOG',
      UnderThreatSpeed: patrolDiff.UnderThreatSpeed || 'SPRINT',
      DefaultStance: patrolDiff.DefaultStance || 'CROUCHED',
      DefaultLookAngle: 0.0,
      CanBeLooted: 1,
      LootDropOnDeath: lootName,
      UnlimitedReload: 6,
      SniperProneDistanceThreshold: 0.0,
      AccuracyMin: patrolDiff.AccuracyMin ?? -1.0,
      AccuracyMax: patrolDiff.AccuracyMax ?? -1.0,
      ThreatDistanceLimit: patrolDiff.ThreatDistanceLimit ?? -1.0,
      NoiseInvestigationDistanceLimit: patrolDiff.NoiseInvestigationDistanceLimit ?? -1.0,
      MaxFlankingDistance: -1.0,
      EnableFlankingOutsideCombat: -1,
      DamageMultiplier: patrolDiff.DamageMultiplier ?? -1.0,
      DamageReceivedMultiplier: patrolDiff.DamageReceivedMultiplier ?? -1.0,
      HeadshotResistance: patrolDiff.HeadshotResistance ?? 0.0,
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
      Waypoints: [wCoords]
    };

    // Update AIPatrolSettings
    const updatedPatrols = [...patrols, newPatrol];
    onChangeField(patrolConfigPath, ['Patrols'], updatedPatrols);
    setSelectedPatrolIdx(updatedPatrols.length - 1);

    // Reset wizard
    setShowPatrolWizard(false);
    setWizardStep(1);
    setWPatrolName('');
  };

  const togglePatrolSelection = (idx, e) => {
    e.stopPropagation();
    setSelectedPatrols(prev => {
      if (prev.includes(idx)) {
        return prev.filter(i => i !== idx);
      } else {
        return [...prev, idx];
      }
    });
  };

  const handleSelectAllPatrols = (checked) => {
    if (checked) {
      setSelectedPatrols(patrols.map((_, idx) => idx));
    } else {
      setSelectedPatrols([]);
    }
  };

  const handleToggleBulkField = (field) => {
    setBulkFields(prev => ({
      ...prev,
      [field]: { ...prev[field], enabled: !prev[field].enabled }
    }));
  };

  const handleUpdateBulkFieldValue = (field, value) => {
    setBulkFields(prev => ({
      ...prev,
      [field]: { ...prev[field], value }
    }));
  };

  const handleApplyBulkChanges = () => {
    const fieldsToApply = {};
    Object.entries(bulkFields).forEach(([field, data]) => {
      if (data.enabled) {
        fieldsToApply[field] = data.value;
      }
    });

    if (Object.keys(fieldsToApply).length === 0) {
      alert('Please select at least one property to update.');
      return;
    }

    selectedPatrols.forEach(idx => {
      Object.entries(fieldsToApply).forEach(([key, value]) => {
        onChangeField(patrolConfigPath, ['Patrols', idx, key], value);
      });
    });

    alert(t('ai_bulk_applied_success', { count: selectedPatrols.length }));
  };

  // -------------------------------------------------------------
  // LOADOUTS ACTIONS
  // -------------------------------------------------------------
  const activeLoadoutConfig = selectedLoadoutPath ? configs[selectedLoadoutPath] : null;
  const isLoadoutDirty = activeLoadoutConfig ? activeLoadoutConfig.isDirty : false;

  const handleCreateLoadout = () => {
    const name = prompt(t('ai_prompt_loadout_name'));
    if (!name) return;
    const cleanName = name.trim().replace(/\s+/g, '_');
    if (!cleanName) return;
    
    const prefix = getExpansionModPrefix(configs);
    const filePath = `${prefix}Loadouts/${cleanName}.json`;
    if (configs[filePath]) {
      alert(t('ai_alert_loadout_exists'));
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
    if (window.confirm(t('ai_confirm_delete_loadout', { name }))) {
      onDeleteFile(selectedLoadoutPath);
      setSelectedLoadoutPath(null);
    }
  };

  const handleCloneLoadout = () => {
    if (!selectedLoadoutPath) return;
    const name = prompt(t('ai_prompt_clone_loadout'));
    if (!name) return;
    const cleanName = name.trim().replace(/\s+/g, '_');
    if (!cleanName) return;

    const prefix = getExpansionModPrefix(configs);
    const newPath = `${prefix}Loadouts/${cleanName}.json`;
    if (configs[newPath]) {
      alert(t('ai_alert_loadout_exists'));
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
  const isLocationFileDirty = locationFile ? locationFile.isDirty : false;
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
    const nameVal = selectedLocation.Name || `Location #${selectedLocationIdx + 1}`;
    if (window.confirm(t('ai_confirm_delete_location', { name: nameVal }))) {
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
    const name = window.prompt(t('ai_prompt_loot_name'));
    if (!name || !name.trim()) return;
    const cleanName = name.trim().replace(/\s+/g, '_');
    const prefix = getExpansionModPrefix(configs);
    const path = `${prefix}AI/LootDrops/${cleanName}.json`;
    if (configs[path]) {
      alert(t('ai_alert_loot_exists'));
      return;
    }
    onCreateFile(path, []);
    setSelectedLootDropPath(path);
  };

  const handleDeleteLootDrop = () => {
    if (!selectedLootDropPath) return;
    if (window.confirm(t('ai_confirm_delete_loot', { path: selectedLootDropPath }))) {
      onDeleteFile(selectedLootDropPath);
      setSelectedLootDropPath(null);
    }
  };

  const handleAddAdmin = (steamId) => {
    if (!aiSettingsFile?.success || !steamId.trim()) return;
    const current = Array.isArray(aiSettingsFile.content.Admins) ? aiSettingsFile.content.Admins : [];
    if (current.includes(steamId.trim())) return;
    onChangeField(aiSettingsPath, ['Admins'], [...current, steamId.trim()]);
    setNewAdminInput('');
  };

  const handleRemoveAdmin = (idx) => {
    if (!aiSettingsFile?.success) return;
    const current = [...(aiSettingsFile.content.Admins || [])];
    current.splice(idx, 1);
    onChangeField(aiSettingsPath, ['Admins'], current);
  };

  const handleAddFaction = (faction) => {
    if (!aiSettingsFile?.success || !faction.trim()) return;
    const current = Array.isArray(aiSettingsFile.content.PlayerFactions) ? aiSettingsFile.content.PlayerFactions : [];
    if (current.includes(faction.trim())) return;
    onChangeField(aiSettingsPath, ['PlayerFactions'], [...current, faction.trim()]);
    setNewFactionInput('');
  };

  const handleRemoveFaction = (idx) => {
    if (!aiSettingsFile?.success) return;
    const current = [...(aiSettingsFile.content.PlayerFactions || [])];
    current.splice(idx, 1);
    onChangeField(aiSettingsPath, ['PlayerFactions'], current);
  };

  const handleAddPreventClimb = (className) => {
    if (!aiSettingsFile?.success || !className.trim()) return;
    const current = Array.isArray(aiSettingsFile.content.PreventClimb) ? aiSettingsFile.content.PreventClimb : [];
    if (current.includes(className.trim())) return;
    onChangeField(aiSettingsPath, ['PreventClimb'], [...current, className.trim()]);
    setNewClimbInput('');
  };

  const handleRemovePreventClimb = (idx) => {
    if (!aiSettingsFile?.success) return;
    const current = [...(aiSettingsFile.content.PreventClimb || [])];
    current.splice(idx, 1);
    onChangeField(aiSettingsPath, ['PreventClimb'], current);
  };

  const handleCloneLootDrop = () => {
    if (!selectedLootDropPath) return;
    const name = prompt(t('ai_prompt_clone_loot'));
    if (!name) return;
    const cleanName = name.trim().replace(/\s+/g, '_');
    if (!cleanName) return;

    const prefix = getExpansionModPrefix(configs);
    const newPath = `${prefix}AI/LootDrops/${cleanName}.json`;
    if (configs[newPath]) {
      alert(t('ai_alert_loot_exists'));
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
      alert(t('ai_alert_loot_item_exists'));
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
          {t('ai_tab_patrol_manager')}
        </button>
        <button 
          className={`btn ${activeTab === 'loadouts' ? 'btn-accent' : ''}`}
          onClick={() => setActiveTab('loadouts')}
          style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}
        >
          {t('ai_tab_loadout_designer')}
        </button>
        <button 
          className={`btn ${activeTab === 'roaming' ? 'btn-accent' : ''}`}
          onClick={() => setActiveTab('roaming')}
          style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}
        >
          {t('ai_tab_roaming_locations')}
        </button>
        <button 
          className={`btn ${activeTab === 'loot_drops' ? 'btn-accent' : ''}`}
          onClick={() => setActiveTab('loot_drops')}
          style={{ padding: '6px 16px', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}
        >
          {t('ai_tab_loot_drops')}
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
                  style={{ flex: 1, padding: '6px 4px', fontSize: '11px', justifyContent: 'center', letterSpacing: '0.5px' }}
                >
                  {t('ai_subtab_patrols')}
                </button>
                <button 
                  className={`btn ${activeSubTab === 'general' ? 'btn-active' : ''}`}
                  onClick={() => setActiveSubTab('general')}
                  style={{ flex: 1, padding: '6px 4px', fontSize: '11px', justifyContent: 'center', letterSpacing: '0.5px' }}
                >
                  {t('ai_subtab_global')}
                </button>
              </div>

              {activeSubTab === 'patrols' ? (
                <>
                  <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="btn" onClick={handleAddPatrol} style={{ width: '100%', justifyContent: 'center', fontSize: '11px', letterSpacing: '0.5px', padding: '6px 8px', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.2' }}>
                      + {lang === 'ru' ? 'Быстрый патруль' : 'Quick Patrol'}
                    </button>
                    <button className="btn btn-accent" onClick={() => { setShowPatrolWizard(true); setWizardStep(1); }} style={{ width: '100%', justifyContent: 'center', fontSize: '11px', letterSpacing: '0.5px', padding: '6px 8px', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.2' }}>
                      🧙‍♂️ {lang === 'ru' ? 'Конструктор патрулей' : 'Patrol Builder'}
                    </button>
                  </div>
                  <div style={{ 
                    padding: '8px 16px', 
                    background: 'var(--bg-primary)', 
                    borderBottom: '1px solid var(--border-color)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '11px',
                    color: 'var(--text-secondary)'
                  }}>
                    <input 
                      type="checkbox" 
                      id="bulk-select-all"
                      checked={patrols.length > 0 && selectedPatrols.length === patrols.length}
                      onChange={e => handleSelectAllPatrols(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="bulk-select-all" style={{ cursor: 'pointer', flex: 1, fontWeight: 'bold' }}>
                      {t('ai_select_all_patrols', { count: patrols.length }).toUpperCase()}
                    </label>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {patrols.map((patrol, idx) => {
                      const isSelected = idx === selectedPatrolIdx;
                      const isChecked = selectedPatrols.includes(idx);
                      const origPatrols = patrolFile.originalContent?.Patrols || [];
                      const isPatrolDirty = JSON.stringify(patrol) !== JSON.stringify(origPatrols[idx]);
                      const pName = patrol.Name || `Patrol #${idx + 1} (${patrol.Faction})`;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedPatrolIdx(idx);
                            setSelectedPatrols([idx]);
                          }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            background: isSelected ? 'rgba(149, 192, 149, 0.1)' : (isChecked ? 'rgba(149, 192, 149, 0.05)' : 'transparent'),
                            borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                            color: isSelected || isChecked ? 'var(--text-glow)' : 'var(--text-primary)',
                            borderBottom: '1px solid rgba(30, 48, 30, 0.1)',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'center',
                            transition: 'all 0.1s'
                          }}
                          onMouseOver={e => {
                            if (!isSelected && !isChecked) e.currentTarget.style.background = 'rgba(149, 192, 149, 0.03)';
                          }}
                          onMouseOut={e => {
                            if (!isSelected && !isChecked) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => togglePatrolSelection(idx, e)}
                            style={{ cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', textTransform: 'uppercase', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                              {pName}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              {t('ai_label_faction').toUpperCase()}: {patrol.Faction} · {t('ai_patrol_waypoints').replace('// ', '').toUpperCase()}: {patrol.Waypoints?.length || 0}
                            </span>
                          </div>
                          {isPatrolDirty && <span className="badge-dirty" />}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'center', lineHeight: '1.4' }}>
                  {t('ai_msg_global_selected')}
                </div>
              )}
            </div>

            {/* Main Form Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                <div style={{ maxWidth: '1250px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {activeSubTab === 'general' ? (
                    /* Global Defaults Edit Mode */
                    <>
                      {/* Section 1: AIPatrolSettings.json */}
                      <div style={{
                        background: 'linear-gradient(90deg, rgba(0, 206, 201, 0.08), transparent)',
                        borderLeft: '4px solid var(--accent-glow)',
                        padding: '12px 18px',
                        borderRadius: '4px 0 0 4px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        marginBottom: '10px'
                      }}>
                        <div style={{ 
                          fontSize: '13px', 
                          color: 'var(--text-primary)', 
                          fontWeight: 'bold', 
                          letterSpacing: '1px', 
                          textTransform: 'uppercase',
                          fontFamily: 'var(--font-heading)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>📦</span>
                          <span>{lang === 'ru' ? 'РАЗДЕЛ 1: НАСТРОЙКИ ПАТРУЛЕЙ (AIPatrolSettings.json)' : 'SECTION 1: PATROL SETTINGS (AIPatrolSettings.json)'}</span>
                        </div>
                      </div>

                      <div className="card-hud">
                        <h4>{t('ai_global_limits')}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>{t('ai_label_enable_patrols')}</label>
                            <select value={patrolContent.Enabled} onChange={e => handleUpdateGeneralVal('Enabled', Number(e.target.value))}>
                              <option value={1}>{t('ai_opt_enabled')}</option>
                              <option value={0}>{t('ai_opt_disabled')}</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>
                              <span className="label-with-help">
                                {t('ai_label_spawn_min')}
                                <HelpIcon tipKey="tip_patrol_min_dist" />
                              </span>
                            </label>
                            <input type="number" value={patrolContent.MinDistRadius ?? 400} onChange={e => handleUpdateGeneralVal('MinDistRadius', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>
                              <span className="label-with-help">
                                {t('ai_label_spawn_max')}
                                <HelpIcon tipKey="tip_patrol_max_dist" />
                              </span>
                            </label>
                            <input type="number" value={patrolContent.MaxDistRadius ?? 1000} onChange={e => handleUpdateGeneralVal('MaxDistRadius', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>
                              <span className="label-with-help">
                                {t('ai_label_despawn_radius')}
                                <HelpIcon tipKey="tip_patrol_despawn_radius" />
                              </span>
                            </label>
                            <input type="number" value={patrolContent.DespawnRadius ?? 1100} onChange={e => handleUpdateGeneralVal('DespawnRadius', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>
                              <span className="label-with-help">
                                {t('ai_label_despawn_timeout')}
                                <HelpIcon tipKey="tip_patrol_despawn_time" />
                              </span>
                            </label>
                            <input type="number" value={patrolContent.DespawnTime ?? 600} onChange={e => handleUpdateGeneralVal('DespawnTime', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>
                              <span className="label-with-help">
                                {t('ai_label_respawn_cooldown')}
                                <HelpIcon tipKey="tip_patrol_respawn_time" />
                              </span>
                            </label>
                            <input type="number" value={patrolContent.RespawnTime ?? 600} onChange={e => handleUpdateGeneralVal('RespawnTime', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>

                      <div className="card-hud">
                        <h4>{t('ai_global_combat')}</h4>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                          {t('ai_global_combat_desc')}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>{t('ai_label_accuracy_min_ph')}: {patrolContent.AccuracyMin != null && patrolContent.AccuracyMin > -1 ? Number(patrolContent.AccuracyMin).toFixed(2) : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1.0"
                              max="1.0"
                              step="0.05"
                              value={patrolContent.AccuracyMin ?? -1.0} 
                              onChange={e => handleUpdateGeneralVal('AccuracyMin', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_accuracy_max_ph')}: {patrolContent.AccuracyMax != null && patrolContent.AccuracyMax > -1 ? Number(patrolContent.AccuracyMax).toFixed(2) : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1.0"
                              max="1.0"
                              step="0.05"
                              value={patrolContent.AccuracyMax ?? -1.0} 
                              onChange={e => handleUpdateGeneralVal('AccuracyMax', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_threat_distance')}: {patrolContent.ThreatDistanceLimit != null && patrolContent.ThreatDistanceLimit > -1 ? patrolContent.ThreatDistanceLimit + 'm' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1"
                              max="2000"
                              step="50"
                              value={patrolContent.ThreatDistanceLimit ?? -1} 
                              onChange={e => handleUpdateGeneralVal('ThreatDistanceLimit', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_noise_limit')}: {patrolContent.NoiseInvestigationDistanceLimit != null && patrolContent.NoiseInvestigationDistanceLimit > -1 ? patrolContent.NoiseInvestigationDistanceLimit + 'm' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1"
                              max="1500"
                              step="50"
                              value={patrolContent.NoiseInvestigationDistanceLimit ?? -1} 
                              onChange={e => handleUpdateGeneralVal('NoiseInvestigationDistanceLimit', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_flanking_distance')}: {patrolContent.MaxFlankingDistance != null && patrolContent.MaxFlankingDistance > -1 ? patrolContent.MaxFlankingDistance + 'm' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1"
                              max="1000"
                              step="20"
                              value={patrolContent.MaxFlankingDistance ?? -1} 
                              onChange={e => handleUpdateGeneralVal('MaxFlankingDistance', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_enable_flanking_combat')}</label>
                            <select value={patrolContent.EnableFlankingOutsideCombat ?? -1} onChange={e => handleUpdateGeneralVal('EnableFlankingOutsideCombat', Number(e.target.value))}>
                              <option value={-1}>{t('ai_opt_default')}</option>
                              <option value={1}>{t('ai_opt_enabled')}</option>
                              <option value={0}>{t('ai_opt_disabled')}</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_damage_multiplier')}: {patrolContent.DamageMultiplier != null && patrolContent.DamageMultiplier > -1 ? Number(patrolContent.DamageMultiplier).toFixed(2) + 'x' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1.0"
                              max="5.0"
                              step="0.05"
                              value={patrolContent.DamageMultiplier ?? -1.0} 
                              onChange={e => handleUpdateGeneralVal('DamageMultiplier', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_damage_received')}: {patrolContent.DamageReceivedMultiplier != null && patrolContent.DamageReceivedMultiplier > -1 ? Number(patrolContent.DamageReceivedMultiplier).toFixed(2) + 'x' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1.0"
                              max="5.0"
                              step="0.05"
                              value={patrolContent.DamageReceivedMultiplier ?? -1.0} 
                              onChange={e => handleUpdateGeneralVal('DamageReceivedMultiplier', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_shoryuken_chance')}: {patrolContent.ShoryukenChance != null ? Math.round(Number(patrolContent.ShoryukenChance) * 100) + '%' : '0%'}</label>
                            <input 
                              type="range" 
                              min="0.0"
                              max="1.0"
                              step="0.01"
                              value={patrolContent.ShoryukenChance ?? 0.0} 
                              onChange={e => handleUpdateGeneralVal('ShoryukenChance', Number(e.target.value))} 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Advanced AISettings.json Defaults */}
                      {aiSettingsFile && aiSettingsFile.success && (
                        <>
                          {/* Section 2: AISettings.json */}
                          <div style={{
                            background: 'linear-gradient(90deg, rgba(235, 214, 103, 0.08), transparent)',
                            borderLeft: '4px solid #ebd667',
                            padding: '12px 18px',
                            borderRadius: '4px 0 0 4px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            marginTop: '24px',
                            marginBottom: '10px'
                          }}>
                            <div style={{ 
                              fontSize: '13px', 
                              color: 'var(--text-primary)', 
                              fontWeight: 'bold', 
                              letterSpacing: '1px', 
                              textTransform: 'uppercase',
                              fontFamily: 'var(--font-heading)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span>⚙️</span>
                              <span>{lang === 'ru' ? 'РАЗДЕЛ 2: БАЗОВЫЙ ДВИЖОК ИИ (AISettings.json)' : 'SECTION 2: AI ENGINE DEFAULTS (AISettings.json)'}</span>
                            </div>
                          </div>

                          <div className="card-hud" style={{ borderLeft: '3px solid var(--text-glow)', marginTop: '0px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0 }}>{t('ai_advanced_behaviors')}</h4>
                            <button 
                              className={`btn ${aiSettingsFile?.isDirty ? 'btn-accent' : ''}`}
                              onClick={() => onSaveFile(aiSettingsPath)}
                            >
                              {t('ai_btn_save_behaviors')}
                            </button>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            
                            {/* Card 1: Global Combat & Accuracy Defaults */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_combat_defaults')}</span>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                                {t('ai_combat_defaults_desc')}
                              </div>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>
                                    <span className="label-with-help">{t('ai_label_accuracy_min')}: {aiSettingsFile.content.AccuracyMin != null ? Number(aiSettingsFile.content.AccuracyMin).toFixed(2) : '0.35'}<HelpIcon tipKey="tip_ai_accuracy_min" /></span>
                                  </label>
                                  <input 
                                    type="range" 
                                    min="0.0"
                                    max="1.0"
                                    step="0.01"
                                    value={aiSettingsFile.content.AccuracyMin ?? 0.35} 
                                    onChange={e => onChangeField(aiSettingsPath, ['AccuracyMin'], Number(e.target.value))}
                                  />
                                </div>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>
                                    <span className="label-with-help">{t('ai_label_accuracy_max')}: {aiSettingsFile.content.AccuracyMax != null ? Number(aiSettingsFile.content.AccuracyMax).toFixed(2) : '0.95'}<HelpIcon tipKey="tip_ai_accuracy_max" /></span>
                                  </label>
                                  <input 
                                    type="range" 
                                    min="0.0"
                                    max="1.0"
                                    step="0.01"
                                    value={aiSettingsFile.content.AccuracyMax ?? 0.95} 
                                    onChange={e => onChangeField(aiSettingsPath, ['AccuracyMax'], Number(e.target.value))}
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>
                                    <span className="label-with-help">{t('ai_label_threat_distance_limit')}: {aiSettingsFile.content.ThreatDistanceLimit ?? 1000}m<HelpIcon tipKey="tip_ai_threat_distance" /></span>
                                  </label>
                                  <input 
                                    type="range" 
                                    min="50"
                                    max="2000"
                                    step="50"
                                    value={aiSettingsFile.content.ThreatDistanceLimit ?? 1000} 
                                    onChange={e => onChangeField(aiSettingsPath, ['ThreatDistanceLimit'], Number(e.target.value))}
                                  />
                                </div>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_noise_investigation_distance_limit')}: {aiSettingsFile.content.NoiseInvestigationDistanceLimit ?? 500}m</label>
                                  <input 
                                    type="range" 
                                    min="0"
                                    max="1500"
                                    step="50"
                                    value={aiSettingsFile.content.NoiseInvestigationDistanceLimit ?? 500} 
                                    onChange={e => onChangeField(aiSettingsPath, ['NoiseInvestigationDistanceLimit'], Number(e.target.value))}
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>
                                    <span className="label-with-help">{t('ai_label_max_flanking_distance')}: {aiSettingsFile.content.MaxFlankingDistance ?? 200}m<HelpIcon tipKey="tip_patrol_flanking" /></span>
                                  </label>
                                  <input 
                                    type="range" 
                                    min="0"
                                    max="1000"
                                    step="20"
                                    value={aiSettingsFile.content.MaxFlankingDistance ?? 200} 
                                    onChange={e => onChangeField(aiSettingsPath, ['MaxFlankingDistance'], Number(e.target.value))}
                                  />
                                </div>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>
                                    <span className="label-with-help">{t('ai_label_enable_flanking_outside_combat')}<HelpIcon tipKey="tip_patrol_flanking_combat" /></span>
                                  </label>
                                  <select 
                                    value={aiSettingsFile.content.EnableFlankingOutsideCombat ?? 0} 
                                    onChange={e => onChangeField(aiSettingsPath, ['EnableFlankingOutsideCombat'], Number(e.target.value))}
                                    style={{ padding: '3px 8px', fontSize: '11px' }}
                                  >
                                    <option value={1}>{t('ai_opt_enabled')}</option>
                                    <option value={0}>{t('ai_opt_disabled')}</option>
                                  </select>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>
                                    <span className="label-with-help">{t('ai_label_damage_multiplier_global')}: {aiSettingsFile.content.DamageMultiplier != null ? Number(aiSettingsFile.content.DamageMultiplier).toFixed(2) : '1.00'}x<HelpIcon tipKey="tip_ai_damage_multiplier" /></span>
                                  </label>
                                  <input 
                                    type="range" 
                                    min="0.1" 
                                    max="5.0"
                                    step="0.05"
                                    value={aiSettingsFile.content.DamageMultiplier ?? 1.0} 
                                    onChange={e => onChangeField(aiSettingsPath, ['DamageMultiplier'], Number(e.target.value))}
                                  />
                                </div>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_damage_received_multiplier_global')}: {aiSettingsFile.content.DamageReceivedMultiplier != null ? Number(aiSettingsFile.content.DamageReceivedMultiplier).toFixed(2) : '1.00'}x</label>
                                  <input 
                                    type="range" 
                                    min="0.1" 
                                    max="5.0"
                                    step="0.05"
                                    value={aiSettingsFile.content.DamageReceivedMultiplier ?? 1.0} 
                                    onChange={e => onChangeField(aiSettingsPath, ['DamageReceivedMultiplier'], Number(e.target.value))}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Card 2: Vaulting / Climb / Melee specials */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_movement_obstacles')} & {t('ai_melee_specials')}</span>
                              
                              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', marginTop: '6px' }}>
                                <span>{t('ai_label_vaulting')}</span>
                                <select 
                                  value={aiSettingsFile.content.Vaulting ?? 1} 
                                  onChange={e => onChangeField(aiSettingsPath, ['Vaulting'], Number(e.target.value))}
                                  style={{ padding: '3px 8px', fontSize: '11px', width: '120px' }}
                                >
                                  <option value={1}>{t('ai_opt_enabled')}</option>
                                  <option value={0}>{t('ai_opt_disabled')}</option>
                                </select>
                              </label>

                              <div className="form-group">
                                <label style={{ fontSize: '11px' }}>{t('ai_label_formation_scale', { scale: aiSettingsFile.content.FormationScale != null ? Number(aiSettingsFile.content.FormationScale).toFixed(1) : '1.0' })}</label>
                                <input 
                                  type="range" 
                                  min="0.1" 
                                  max="3.0" 
                                  step="0.1"
                                  value={aiSettingsFile.content.FormationScale ?? 1.0}
                                  onChange={e => onChangeField(aiSettingsPath, ['FormationScale'], Number(e.target.value))}
                                />
                              </div>

                              <div className="form-group">
                                <label style={{ fontSize: '11px' }}>{t('ai_label_shoryuken_percent', { chance: Math.round((aiSettingsFile.content.ShoryukenChance ?? 0.01) * 100) })}</label>
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
                                <label style={{ fontSize: '11px' }}>{t('ai_label_shoryuken_damage_mult')}: {aiSettingsFile.content.ShoryukenDamageMultiplier != null ? Number(aiSettingsFile.content.ShoryukenDamageMultiplier).toFixed(1) : '3.0'}x</label>
                                <input 
                                  type="range" 
                                  min="0.1"
                                  max="10.0"
                                  step="0.1"
                                  value={aiSettingsFile.content.ShoryukenDamageMultiplier ?? 3.0}
                                  onChange={e => onChangeField(aiSettingsPath, ['ShoryukenDamageMultiplier'], Number(e.target.value))}
                                />
                              </div>
                            </div>

                            {/* Card 3: Recruit Friendly options */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_recruitment_mechanics')}</span>
                              
                              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                                <span>{t('ai_label_recruit_friendly')}</span>
                                <select 
                                  value={aiSettingsFile.content.CanRecruitFriendly ?? 1} 
                                  onChange={e => onChangeField(aiSettingsPath, ['CanRecruitFriendly'], Number(e.target.value))}
                                  style={{ padding: '3px 8px', fontSize: '11px', width: '120px' }}
                                >
                                  <option value={1}>{t('ai_opt_yes')}</option>
                                  <option value={0}>{t('ai_opt_no')}</option>
                                </select>
                              </label>

                              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                                <span>{t('ai_label_recruit_guards')}</span>
                                <select 
                                  value={aiSettingsFile.content.CanRecruitGuards ?? 0} 
                                  onChange={e => onChangeField(aiSettingsPath, ['CanRecruitGuards'], Number(e.target.value))}
                                  style={{ padding: '3px 8px', fontSize: '11px', width: '120px' }}
                                >
                                  <option value={1}>{t('ai_opt_yes')}</option>
                                  <option value={0}>{t('ai_opt_no')}</option>
                                </select>
                              </label>

                              <div className="form-group">
                                <label style={{ fontSize: '11px' }}>{t('ai_label_max_recruitable')}</label>
                                <input 
                                  type="number" 
                                  value={aiSettingsFile.content.MaxRecruitableAI ?? 1} 
                                  onChange={e => onChangeField(aiSettingsPath, ['MaxRecruitableAI'], Number(e.target.value))}
                                />
                              </div>
                            </div>

                            {/* Card 4: Threat, Behavior & Sniping */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_threat_timeouts')} & Behavior</span>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_combat_timeout')}</label>
                                  <input 
                                    type="number" 
                                    value={aiSettingsFile.content.AggressionTimeout ?? 120.0} 
                                    onChange={e => onChangeField(aiSettingsPath, ['AggressionTimeout'], Number(e.target.value))}
                                  />
                                </div>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_guards_timeout')}</label>
                                  <input 
                                    type="number" 
                                    value={aiSettingsFile.content.GuardAggressionTimeout ?? 150.0} 
                                    onChange={e => onChangeField(aiSettingsPath, ['GuardAggressionTimeout'], Number(e.target.value))}
                                  />
                                </div>
                              </div>

                              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                                <span>{t('ai_label_manners')}</span>
                                <select 
                                  value={aiSettingsFile.content.Manners ?? 0} 
                                  onChange={e => onChangeField(aiSettingsPath, ['Manners'], Number(e.target.value))}
                                  style={{ padding: '3px 8px', fontSize: '11px', width: '120px' }}
                                >
                                  <option value={0}>{t('ai_opt_manners_neutral')}</option>
                                  <option value={1}>{t('ai_opt_manners_aggressive')}</option>
                                </select>
                              </label>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_meme_level')}: {aiSettingsFile.content.MemeLevel ?? 1}</label>
                                  <input 
                                    type="range" 
                                    min="0"
                                    max="3"
                                    step="1"
                                    value={aiSettingsFile.content.MemeLevel ?? 1} 
                                    onChange={e => onChangeField(aiSettingsPath, ['MemeLevel'], Number(e.target.value))}
                                  />
                                </div>
                                <div className="form-group">
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_sniper_prone_distance')}: {aiSettingsFile.content.SniperProneDistanceThreshold ?? 0}m</label>
                                  <input 
                                    type="range" 
                                    min="0"
                                    max="1000"
                                    step="10"
                                    value={aiSettingsFile.content.SniperProneDistanceThreshold ?? 0} 
                                    onChange={e => onChangeField(aiSettingsPath, ['SniperProneDistanceThreshold'], Number(e.target.value))}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Card 5: Networking & Compatibility */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_networking_compat')}</span>
                              
                              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                                <span>{t('ai_label_override_client_weapon_firing')}</span>
                                <select 
                                  value={aiSettingsFile.content.OverrideClientWeaponFiring ?? 1} 
                                  onChange={e => onChangeField(aiSettingsPath, ['OverrideClientWeaponFiring'], Number(e.target.value))}
                                  style={{ padding: '3px 8px', fontSize: '11px', width: '120px' }}
                                >
                                  <option value={1}>{t('ai_opt_enabled')}</option>
                                  <option value={0}>{t('ai_opt_disabled')}</option>
                                </select>
                              </label>

                              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                                <span>{t('ai_label_recreate_weapon_network_representation')}</span>
                                <select 
                                  value={aiSettingsFile.content.RecreateWeaponNetworkRepresentation ?? 1} 
                                  onChange={e => onChangeField(aiSettingsPath, ['RecreateWeaponNetworkRepresentation'], Number(e.target.value))}
                                  style={{ padding: '3px 8px', fontSize: '11px', width: '120px' }}
                                >
                                  <option value={1}>{t('ai_opt_enabled')}</option>
                                  <option value={0}>{t('ai_opt_disabled')}</option>
                                </select>
                              </label>
                            </div>

                            {/* Card 6: Logging & Vehicle interactions */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_logging_zombies')}</span>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                                  <span>{t('ai_label_log_ai_hit_by')}</span>
                                  <select 
                                    value={aiSettingsFile.content.LogAIHitBy ?? 1} 
                                    onChange={e => onChangeField(aiSettingsPath, ['LogAIHitBy'], Number(e.target.value))}
                                    style={{ padding: '3px', fontSize: '10px' }}
                                  >
                                    <option value={1}>{t('ai_opt_enabled')}</option>
                                    <option value={0}>{t('ai_opt_disabled')}</option>
                                  </select>
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                                  <span>{t('ai_label_log_ai_killed')}</span>
                                  <select 
                                    value={aiSettingsFile.content.LogAIKilled ?? 1} 
                                    onChange={e => onChangeField(aiSettingsPath, ['LogAIKilled'], Number(e.target.value))}
                                    style={{ padding: '3px', fontSize: '10px' }}
                                  >
                                    <option value={1}>{t('ai_opt_enabled')}</option>
                                    <option value={0}>{t('ai_opt_disabled')}</option>
                                  </select>
                                </label>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                                  <span>{t('ai_label_zombie_vehicle_handler')}</span>
                                  <select 
                                    value={aiSettingsFile.content.EnableZombieVehicleAttackHandler ?? 0} 
                                    onChange={e => onChangeField(aiSettingsPath, ['EnableZombieVehicleAttackHandler'], Number(e.target.value))}
                                    style={{ padding: '3px', fontSize: '10px' }}
                                  >
                                    <option value={1}>{t('ai_opt_enabled')}</option>
                                    <option value={0}>{t('ai_opt_disabled')}</option>
                                  </select>
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                                  <span>{t('ai_label_zombie_vehicle_physics')}</span>
                                  <select 
                                    value={aiSettingsFile.content.EnableZombieVehicleAttackPhysics ?? 0} 
                                    onChange={e => onChangeField(aiSettingsPath, ['EnableZombieVehicleAttackPhysics'], Number(e.target.value))}
                                    style={{ padding: '3px', fontSize: '10px' }}
                                  >
                                    <option value={1}>{t('ai_opt_enabled')}</option>
                                    <option value={0}>{t('ai_opt_disabled')}</option>
                                  </select>
                                </label>
                              </div>
                            </div>

                            {/* Card 7: Night Visibility Range */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_night_visibility')}</span>
                              
                              <div className="form-group">
                                <label style={{ fontSize: '11px' }}>{t('ai_label_night_visibility_0')}</label>
                                <input 
                                  type="number" 
                                  value={aiSettingsFile.content.LightingConfigMinNightVisibilityMeters?.["0"] ?? 100.0} 
                                  onChange={e => onChangeField(aiSettingsPath, ['LightingConfigMinNightVisibilityMeters', '0'], Number(e.target.value))}
                                />
                              </div>

                              <div className="form-group">
                                <label style={{ fontSize: '11px' }}>{t('ai_label_night_visibility_1')}</label>
                                <input 
                                  type="number" 
                                  value={aiSettingsFile.content.LightingConfigMinNightVisibilityMeters?.["1"] ?? 10.0} 
                                  onChange={e => onChangeField(aiSettingsPath, ['LightingConfigMinNightVisibilityMeters', '1'], Number(e.target.value))}
                                />
                              </div>
                            </div>

                            {/* Card 8: Admin Steam64 IDs */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_label_admins')}</span>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-secondary)', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '2px', maxHeight: '120px', overflowY: 'auto' }}>
                                {(!aiSettingsFile.content.Admins || aiSettingsFile.content.Admins.length === 0) ? (
                                  <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic', padding: '4px' }}>No Admins</span>
                                ) : (
                                  aiSettingsFile.content.Admins.map((adm, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                      <span style={{ fontFamily: 'var(--font-mono)' }}>{adm}</span>
                                      <button className="btn btn-danger" onClick={() => handleRemoveAdmin(idx)} style={{ padding: '0px 4px', fontSize: '10px', height: '18px', lineHeight: '18px' }}>×</button>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                <input 
                                  type="text" 
                                  value={newAdminInput} 
                                  onChange={e => setNewAdminInput(e.target.value)} 
                                  placeholder={t('ai_ph_steam_id')}
                                  style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                                />
                                <button className="btn btn-accent" onClick={() => handleAddAdmin(newAdminInput)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                                  {t('ai_btn_add')}
                                </button>
                              </div>
                            </div>

                            {/* Card 9: Player Factions */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_label_player_factions')}</span>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-secondary)', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '2px', maxHeight: '120px', overflowY: 'auto' }}>
                                {(!aiSettingsFile.content.PlayerFactions || aiSettingsFile.content.PlayerFactions.length === 0) ? (
                                  <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic', padding: '4px' }}>No Player Factions</span>
                                ) : (
                                  aiSettingsFile.content.PlayerFactions.map((fac, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                      <span style={{ fontFamily: 'var(--font-mono)' }}>{fac}</span>
                                      <button className="btn btn-danger" onClick={() => handleRemoveFaction(idx)} style={{ padding: '0px 4px', fontSize: '10px', height: '18px', lineHeight: '18px' }}>×</button>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                <input 
                                  type="text" 
                                  value={newFactionInput} 
                                  onChange={e => setNewFactionInput(e.target.value)} 
                                  placeholder={t('ai_ph_faction')}
                                  style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                                />
                                <button className="btn btn-accent" onClick={() => handleAddFaction(newFactionInput)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                                  {t('ai_btn_add')}
                                </button>
                              </div>
                            </div>

                            {/* Card 10: Prevent Climb Buildings */}
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('ai_label_prevent_climb')}</span>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-secondary)', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '2px', maxHeight: '120px', overflowY: 'auto' }}>
                                {(!aiSettingsFile.content.PreventClimb || aiSettingsFile.content.PreventClimb.length === 0) ? (
                                  <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic', padding: '4px' }}>No Restricting Classnames</span>
                                ) : (
                                  aiSettingsFile.content.PreventClimb.map((clb, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                      <span style={{ fontFamily: 'var(--font-mono)' }}>{clb}</span>
                                      <button className="btn btn-danger" onClick={() => handleRemovePreventClimb(idx)} style={{ padding: '0px 4px', fontSize: '10px', height: '18px', lineHeight: '18px' }}>×</button>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                <input 
                                  type="text" 
                                  value={newClimbInput} 
                                  onChange={e => setNewClimbInput(e.target.value)} 
                                  placeholder={t('ai_ph_classname')}
                                  style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                                />
                                <button className="btn btn-accent" onClick={() => handleAddPreventClimb(newClimbInput)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                                  {t('ai_btn_add')}
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                        </>
                      )}
                    </>
                  ) : selectedPatrols.length > 1 ? (
                    /* Bulk Edit Mode */
                    <div className="card-hud" style={{ borderLeft: '3px solid var(--text-glow)' }}>
                      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--text-glow)' }}>
                          {t('ai_bulk_edit_title', { count: selectedPatrols.length })}
                        </h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {t('ai_bulk_edit_desc')}
                        </p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        
                        {/* Faction */}
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={bulkFields.Faction.enabled} 
                              onChange={() => handleToggleBulkField('Faction')} 
                            />
                            <span>{t('ai_label_faction')}</span>
                          </label>
                          <select 
                            value={bulkFields.Faction.value} 
                            disabled={!bulkFields.Faction.enabled}
                            onChange={e => handleUpdateBulkFieldValue('Faction', e.target.value)}
                            style={{ opacity: bulkFields.Faction.enabled ? 1 : 0.5 }}
                          >
                            {FACTIONS.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>

                        {/* Behavior Model */}
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={bulkFields.Behaviour.enabled} 
                              onChange={() => handleToggleBulkField('Behaviour')} 
                            />
                            <span>{t('ai_label_behavior_model')}</span>
                          </label>
                          <select 
                            value={bulkFields.Behaviour.value} 
                            disabled={!bulkFields.Behaviour.enabled}
                            onChange={e => handleUpdateBulkFieldValue('Behaviour', e.target.value)}
                            style={{ opacity: bulkFields.Behaviour.enabled ? 1 : 0.5 }}
                          >
                            {BEHAVIOURS.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>

                        {/* Patrol Speed */}
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={bulkFields.Speed.enabled} 
                              onChange={() => handleToggleBulkField('Speed')} 
                            />
                            <span>{t('ai_label_patrol_speed')}</span>
                          </label>
                          <select 
                            value={bulkFields.Speed.value} 
                            disabled={!bulkFields.Speed.enabled}
                            onChange={e => handleUpdateBulkFieldValue('Speed', e.target.value)}
                            style={{ opacity: bulkFields.Speed.enabled ? 1 : 0.5 }}
                          >
                            {SPEEDS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        {/* Under Threat Speed */}
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={bulkFields.UnderThreatSpeed.enabled} 
                              onChange={() => handleToggleBulkField('UnderThreatSpeed')} 
                            />
                            <span>{t('ai_label_threat_speed')}</span>
                          </label>
                          <select 
                            value={bulkFields.UnderThreatSpeed.value} 
                            disabled={!bulkFields.UnderThreatSpeed.enabled}
                            onChange={e => handleUpdateBulkFieldValue('UnderThreatSpeed', e.target.value)}
                            style={{ opacity: bulkFields.UnderThreatSpeed.enabled ? 1 : 0.5 }}
                          >
                            {SPEEDS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        {/* Default Stance */}
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={bulkFields.DefaultStance.enabled} 
                              onChange={() => handleToggleBulkField('DefaultStance')} 
                            />
                            <span>{t('ai_label_default_stance')}</span>
                          </label>
                          <select 
                            value={bulkFields.DefaultStance.value} 
                            disabled={!bulkFields.DefaultStance.enabled}
                            onChange={e => handleUpdateBulkFieldValue('DefaultStance', e.target.value)}
                            style={{ opacity: bulkFields.DefaultStance.enabled ? 1 : 0.5 }}
                          >
                            {STANCES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        {/* Loadout Profile */}
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={bulkFields.Loadout.enabled} 
                              onChange={() => handleToggleBulkField('Loadout')} 
                            />
                            <span>{t('ai_label_loadout_profile')}</span>
                          </label>
                          <select 
                            value={bulkFields.Loadout.value} 
                            disabled={!bulkFields.Loadout.enabled}
                            onChange={e => handleUpdateBulkFieldValue('Loadout', e.target.value)}
                            style={{ opacity: bulkFields.Loadout.enabled ? 1 : 0.5 }}
                          >
                            {loadoutsList.map(l => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </div>

                        {/* Loot Drop Profile */}
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={bulkFields.LootDropOnDeath.enabled} 
                              onChange={() => handleToggleBulkField('LootDropOnDeath')} 
                            />
                            <span>{t('ai_label_loot_drop_profile')}</span>
                          </label>
                          <select 
                            value={bulkFields.LootDropOnDeath.value} 
                            disabled={!bulkFields.LootDropOnDeath.enabled}
                            onChange={e => handleUpdateBulkFieldValue('LootDropOnDeath', e.target.value)}
                            style={{ opacity: bulkFields.LootDropOnDeath.enabled ? 1 : 0.5 }}
                          >
                            <option value="">{t('ai_opt_none_default')}</option>
                            {lootDropsList.map(l => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </div>

                        {/* Unit Min */}
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={bulkFields.NumberOfAI.enabled} 
                              onChange={() => handleToggleBulkField('NumberOfAI')} 
                            />
                            <span>{t('ai_label_unit_min')}</span>
                          </label>
                          <input 
                            type="number"
                            value={bulkFields.NumberOfAI.value} 
                            disabled={!bulkFields.NumberOfAI.enabled}
                            onChange={e => handleUpdateBulkFieldValue('NumberOfAI', Number(e.target.value))}
                            style={{ opacity: bulkFields.NumberOfAI.enabled ? 1 : 0.5 }}
                          />
                        </div>

                        {/* Unit Max */}
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={bulkFields.NumberOfAIMax.enabled} 
                              onChange={() => handleToggleBulkField('NumberOfAIMax')} 
                            />
                            <span>{t('ai_label_unit_max')}</span>
                          </label>
                          <input 
                            type="number"
                            value={bulkFields.NumberOfAIMax.value} 
                            disabled={!bulkFields.NumberOfAIMax.enabled}
                            onChange={e => handleUpdateBulkFieldValue('NumberOfAIMax', Number(e.target.value))}
                            style={{ opacity: bulkFields.NumberOfAIMax.enabled ? 1 : 0.5 }}
                          />
                        </div>

                      </div>

                      <button 
                        className="btn btn-accent" 
                        onClick={handleApplyBulkChanges}
                        style={{ width: '100%', justifyContent: 'center', padding: '12px', fontWeight: 'bold' }}
                      >
                        {t('ai_bulk_apply_btn', { count: selectedPatrols.length }).toUpperCase()}
                      </button>
                    </div>
                  ) : selectedPatrol ? (
                    /* Selected Patrol Edit Mode */
                    <>
                      {/* Section 1: General details */}
                      <div className="card-hud">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
                          <h4 style={{ margin: 0 }}>{t('ai_patrol_properties')}</h4>
                          <button className="btn btn-danger" onClick={handleRemovePatrol} style={{ padding: '4px 8px', fontSize: '10px' }}>
                            {t('ai_btn_delete_patrol')}
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label style={{ color: '#ebd667', fontWeight: 'bold' }}>{lang === 'ru' ? "⭐ ЗАГРУЗЧИК ПРЕСЕТОВ СЛОЖНОСТИ (АВТОЗАПОЛНЕНИЕ)" : "⭐ DIFFICULTY PRESET LOADER (AUTO-FILL MULTIPLIERS)"}</label>
                            <select 
                              value={currentDifficultyPreset}
                              onChange={e => {
                                const preset = e.target.value;
                                if (!preset) return;
                                const presets = {
                                  easy: { AccuracyMin: 0.15, AccuracyMax: 0.35, ThreatDistanceLimit: 100, NoiseInvestigationDistanceLimit: 100, DamageMultiplier: 0.5, DamageReceivedMultiplier: 1.5, HeadshotResistance: 0.0, Speed: 'WALK', UnderThreatSpeed: 'JOG', Faction: 'Civilian' },
                                  medium: { AccuracyMin: 0.35, AccuracyMax: 0.65, ThreatDistanceLimit: 180, NoiseInvestigationDistanceLimit: 150, DamageMultiplier: 0.9, DamageReceivedMultiplier: 1.0, HeadshotResistance: 0.1, Speed: 'JOG', UnderThreatSpeed: 'SPRINT', Faction: 'Aggressive' },
                                  hard: { AccuracyMin: 0.65, AccuracyMax: 0.85, ThreatDistanceLimit: 300, NoiseInvestigationDistanceLimit: 250, DamageMultiplier: 1.3, DamageReceivedMultiplier: 0.7, HeadshotResistance: 0.3, Speed: 'JOG', UnderThreatSpeed: 'SPRINT', Faction: 'West' },
                                  sniper: { AccuracyMin: 0.85, AccuracyMax: 0.98, ThreatDistanceLimit: 500, NoiseInvestigationDistanceLimit: 300, DamageMultiplier: 1.8, DamageReceivedMultiplier: 1.0, HeadshotResistance: 0.2, Speed: 'WALK', UnderThreatSpeed: 'SPRINT', Faction: 'East', DefaultStance: 'PRONE' },
                                  boss: { AccuracyMin: 0.80, AccuracyMax: 0.95, ThreatDistanceLimit: 400, NoiseInvestigationDistanceLimit: 300, DamageMultiplier: 2.2, DamageReceivedMultiplier: 0.3, HeadshotResistance: 0.7, Speed: 'JOG', UnderThreatSpeed: 'SPRINT', Faction: 'Guards' }
                                };
                                const values = presets[preset];
                                if (values) {
                                  handleUpdatePatrolFields(values);
                                  alert(lang === 'ru' 
                                    ? `Успешно загружен пресет сложности: ${preset.toUpperCase()}! Изменено 10 параметров боя, фракции, скорости и защиты.`
                                    : `Successfully loaded Difficulty Preset: ${preset.toUpperCase()}! Modified 10 combat, faction, speed, and defense parameters.`
                                  );
                                }
                              }}
                              style={{ 
                                border: '1px solid var(--warning-color)', 
                                color: 'var(--warning-color)', 
                                backgroundColor: 'rgba(235,214,103,0.05)', 
                                fontWeight: 'bold',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 12px center',
                                backgroundSize: '14px',
                                paddingRight: '36px'
                              }}
                            >
                              <option value="" style={{ color: 'var(--text-primary)' }}>{lang === 'ru' ? "-- Выберите пресет для загрузки параметров --" : "-- Select preset to load parameters --"}</option>
                              <option value="easy" style={{ color: 'var(--text-primary)' }}>{lang === 'ru' ? "Гражданский / Легко (Низкая точность, высокий получаемый урон)" : "Civilian / Easy (Low accuracy, high damage received)"}</option>
                              <option value="medium" style={{ color: 'var(--text-primary)' }}>{lang === 'ru' ? "Бандит / Средне (Стандартные статы, агрессивная фракция)" : "Bandit / Medium (Standard stats, aggressive faction)"}</option>
                              <option value="hard" style={{ color: 'var(--text-primary)' }}>{lang === 'ru' ? "Военный / Сложно (Высокая точность, низкий получаемый урон)" : "Military / Hard (High accuracy, low damage received)"}</option>
                              <option value="sniper" style={{ color: 'var(--text-primary)' }}>{lang === 'ru' ? "Снайпер (Очень высокая дальность/точность, положение лежа)" : "Sniper (Extremely high range/accuracy, prone stance)"}</option>
                              <option value="boss" style={{ color: 'var(--text-primary)' }}>{lang === 'ru' ? "Босс / Тяжелый (Огромное сопротивление в голову, высокий урон)" : "Boss / Heavy (Extreme headshot resistance, high damage)"}</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_patrol_name')}</label>
                            <input type="text" value={selectedPatrol.Name || ''} onChange={e => handleUpdatePatrolVal('Name', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_loadout_profile')}</label>
                            <select value={selectedPatrol.Loadout || ''} onChange={e => handleUpdatePatrolVal('Loadout', e.target.value)}>
                              {loadoutsList.map(l => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_unit_min')}</label>
                            <input type="number" value={selectedPatrol.NumberOfAI ?? 1} onChange={e => handleUpdatePatrolVal('NumberOfAI', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_unit_max')}</label>
                            <input type="number" value={selectedPatrol.NumberOfAIMax ?? 2} onChange={e => handleUpdatePatrolVal('NumberOfAIMax', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Combat & Aiming */}
                      <div className="card-hud">
                        <h4>{t('ai_combat_targeting')}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>{t('ai_label_accuracy_min_patrol')}: {selectedPatrol.AccuracyMin != null && selectedPatrol.AccuracyMin > -1 ? Number(selectedPatrol.AccuracyMin).toFixed(2) : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1.0"
                              max="1.0"
                              step="0.05"
                              value={selectedPatrol.AccuracyMin ?? -1.0} 
                              onChange={e => handleUpdatePatrolVal('AccuracyMin', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_accuracy_max_patrol')}: {selectedPatrol.AccuracyMax != null && selectedPatrol.AccuracyMax > -1 ? Number(selectedPatrol.AccuracyMax).toFixed(2) : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1.0"
                              max="1.0"
                              step="0.05"
                              value={selectedPatrol.AccuracyMax ?? -1.0} 
                              onChange={e => handleUpdatePatrolVal('AccuracyMax', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_threat_distance')}: {selectedPatrol.ThreatDistanceLimit != null && selectedPatrol.ThreatDistanceLimit > -1 ? selectedPatrol.ThreatDistanceLimit + 'm' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1"
                              max="2000"
                              step="50"
                              value={selectedPatrol.ThreatDistanceLimit ?? -1} 
                              onChange={e => handleUpdatePatrolVal('ThreatDistanceLimit', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_noise_limit')}: {selectedPatrol.NoiseInvestigationDistanceLimit != null && selectedPatrol.NoiseInvestigationDistanceLimit > -1 ? selectedPatrol.NoiseInvestigationDistanceLimit + 'm' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1"
                              max="1500"
                              step="50"
                              value={selectedPatrol.NoiseInvestigationDistanceLimit ?? -1} 
                              onChange={e => handleUpdatePatrolVal('NoiseInvestigationDistanceLimit', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_flanking_distance')}: {selectedPatrol.MaxFlankingDistance != null && selectedPatrol.MaxFlankingDistance > -1 ? selectedPatrol.MaxFlankingDistance + 'm' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1"
                              max="1000"
                              step="20"
                              value={selectedPatrol.MaxFlankingDistance ?? -1} 
                              onChange={e => handleUpdatePatrolVal('MaxFlankingDistance', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_enable_flanking')}</label>
                            <select value={selectedPatrol.EnableFlankingOutsideCombat ?? -1} onChange={e => handleUpdatePatrolVal('EnableFlankingOutsideCombat', Number(e.target.value))}>
                              <option value={-1}>{t('ai_opt_use_global')}</option>
                              <option value={1}>{t('ai_opt_enabled')}</option>
                              <option value={0}>{t('ai_opt_disabled')}</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Factions, Behavior, Loot */}
                      <div className="card-hud">
                        <h4>{t('ai_behavior_factions')}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>{t('ai_label_faction')}</label>
                            <select value={selectedPatrol.Faction || 'West'} onChange={e => handleUpdatePatrolVal('Faction', e.target.value)}>
                              {FACTIONS.map(f => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_behavior_model')}</label>
                            <select value={selectedPatrol.Behaviour || 'LOOP_OR_ALTERNATE'} onChange={e => handleUpdatePatrolVal('Behaviour', e.target.value)}>
                              {BEHAVIOURS.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_patrol_speed')}</label>
                            <select value={selectedPatrol.Speed || 'JOG'} onChange={e => handleUpdatePatrolVal('Speed', e.target.value)}>
                              {SPEEDS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_threat_speed')}</label>
                            <select value={selectedPatrol.UnderThreatSpeed || 'SPRINT'} onChange={e => handleUpdatePatrolVal('UnderThreatSpeed', e.target.value)}>
                              {SPEEDS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_default_stance')}</label>
                            <select value={selectedPatrol.DefaultStance || 'CROUCHED'} onChange={e => handleUpdatePatrolVal('DefaultStance', e.target.value)}>
                              {STANCES.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_loot_drop_profile')}</label>
                            <select value={selectedPatrol.LootDropOnDeath || ''} onChange={e => handleUpdatePatrolVal('LootDropOnDeath', e.target.value)}>
                              <option value="">{t('ai_opt_none_default')}</option>
                              {lootDropsList.map(l => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Damage Multipliers & Health */}
                      <div className="card-hud">
                        <h4>{t('ai_health_damage')}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label>{t('ai_label_damage_multiplier')}: {selectedPatrol.DamageMultiplier != null && selectedPatrol.DamageMultiplier > -1 ? Number(selectedPatrol.DamageMultiplier).toFixed(2) + 'x' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1.0"
                              max="5.0"
                              step="0.05"
                              value={selectedPatrol.DamageMultiplier ?? -1.0} 
                              onChange={e => handleUpdatePatrolVal('DamageMultiplier', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_damage_received')}: {selectedPatrol.DamageReceivedMultiplier != null && selectedPatrol.DamageReceivedMultiplier > -1 ? Number(selectedPatrol.DamageReceivedMultiplier).toFixed(2) + 'x' : 'Default'}</label>
                            <input 
                              type="range" 
                              min="-1.0"
                              max="5.0"
                              step="0.05"
                              value={selectedPatrol.DamageReceivedMultiplier ?? -1.0} 
                              onChange={e => handleUpdatePatrolVal('DamageReceivedMultiplier', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_headshot_resistance')}: {selectedPatrol.HeadshotResistance != null ? Number(selectedPatrol.HeadshotResistance).toFixed(2) : '0.00'}</label>
                            <input 
                              type="range" 
                              min="0.0"
                              max="1.0"
                              step="0.05"
                              value={selectedPatrol.HeadshotResistance ?? 0.0} 
                              onChange={e => handleUpdatePatrolVal('HeadshotResistance', Number(e.target.value))} 
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_unlimited_reloads')}</label>
                            <input type="number" value={selectedPatrol.UnlimitedReload ?? 6} onChange={e => handleUpdatePatrolVal('UnlimitedReload', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>{t('ai_label_lootable')}</label>
                            <select value={selectedPatrol.CanBeLooted ?? 1} onChange={e => handleUpdatePatrolVal('CanBeLooted', Number(e.target.value))}>
                              <option value={1}>{t('ai_opt_yes_looted')}</option>
                              <option value={0}>{t('ai_opt_no_locked')}</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Section 5: Units Classnames Array */}
                      <div className="card-hud">
                        <h4>{t('ai_custom_npc_units')}</h4>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          {t('ai_custom_npc_desc')}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-primary)', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '2px', maxHeight: '150px', overflowY: 'auto' }}>
                          {(!selectedPatrol.Units || selectedPatrol.Units.length === 0) ? (
                            <span style={{ fontSize: '12px', color: 'var(--text-dark)', padding: '6px' }}>{t('ai_custom_npc_empty')}</span>
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
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('ai_label_add_unit')}</span>
                          <AutocompleteInput
                            suggestions={itemSuggestions}
                            placeholder={t('ai_ph_unit_class')}
                            onSelect={handleAddUnit}
                            value={newClothingInput}
                            onChange={setNewClothingInput}
                          />
                        </div>
                      </div>

                      {/* Section 6: Waypoints route */}
                      <div className="card-hud">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0 }}>{t('ai_patrol_waypoints')}</h4>
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
                                {t('ai_btn_plot_map')}
                              </button>
                              <button className="btn" onClick={handleAddWaypoint} style={{ padding: '4px 8px', fontSize: '10px' }}>
                                {t('ai_btn_add_waypoint')}
                              </button>
                            </div>
                          </div>
                          {(!selectedPatrol.Waypoints || selectedPatrol.Waypoints.length === 0) ? (
                            <div style={{ padding: '16px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              {t('ai_waypoints_empty')}
                            </div>
                          ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {selectedPatrol.Waypoints.map((wp, wpIdx) => (
                              <CoordinatesInput
                                key={wpIdx}
                                layout="row"
                                indexLabel={`#${wpIdx + 1}`}
                                position={wp}
                                step="any"
                                onChange={(newPos, changedIdx, newVal) => handleWaypointChange(wpIdx, changedIdx, newVal)}
                                onPickFromMap={() => onNavigateToMap(wp, ['Patrols', selectedPatrolIdx, 'Waypoints', wpIdx])}
                                onDelete={() => handleRemoveWaypoint(wpIdx)}
                                inputStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {t('ai_patrols_none_detected')}
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
                  {t('ai_bot_loadouts')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '2px' }}>
                  {t('ai_total_profiles', { count: loadoutPaths.length })}
                </div>
              </div>
              <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-accent" onClick={handleCreateLoadout} style={{ width: '100%', justifyContent: 'center', fontSize: '11px', letterSpacing: '0.5px', padding: '6px 8px', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.2' }}>
                  {t('ai_btn_create_loadout')}
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loadoutPaths.map(path => {
                  const isSelected = path === selectedLoadoutPath;
                  const file = configs[path];
                  const hasUnsaved = file?.isDirty;
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
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('ai_editing_loadout')}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                        {selectedLoadoutPath.split('/').pop()}
                      </span>
                      {isLoadoutDirty && <span style={{ color: 'var(--warning-color)', fontSize: '11px', marginLeft: '8px' }}>{t('ai_unsaved')}</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className={`btn ${isLoadoutDirty ? 'btn-accent' : ''}`}
                        onClick={() => onSaveFile(selectedLoadoutPath)}
                        disabled={!isLoadoutDirty}
                        style={{ opacity: isLoadoutDirty ? 1 : 0.5 }}
                      >
                        {t('ai_btn_save_loadout')}
                      </button>
                      <button className="btn btn-accent" onClick={handleCloneLoadout}>
                        {t('ai_btn_clone_profile')}
                      </button>
                      <button className="btn btn-danger" onClick={handleDeleteLoadout}>
                        {t('ai_btn_delete_file')}
                      </button>
                    </div>
                  </div>

                  {/* Split Slots and Cargo */}
                  <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    
                    {/* Clothing Slots list */}
                    <div style={{ 
                      width: '180px', 
                      background: 'var(--bg-secondary)', 
                      borderRight: '1px solid var(--border-color)',
                      overflowY: 'auto' 
                    }}>
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
                        <h4>{t('ai_clothing_items_slot', { slot: selectedSlot.toUpperCase() })}</h4>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {getSlotItems(activeLoadoutConfig.content, selectedSlot).length === 0 ? (
                            <div style={{ padding: '20px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              {t('ai_clothing_slot_empty')}
                            </div>
                          ) : (
                            getSlotItems(activeLoadoutConfig.content, selectedSlot).map((item, idx) => {
                              const minH = item.Health?.[0]?.Min ?? 0.7;
                              const maxH = item.Health?.[0]?.Max ?? 1.0;
                              return (
                                <ConfigListRow
                                  key={idx}
                                  className={item.ClassName}
                                  isMissing={isItemMissing(item.ClassName)}
                                  missingTooltip={t('ai_tooltip_item_missing')}
                                  onRemove={() => handleRemoveClothingItem(selectedSlot, idx)}
                                  fields={[
                                    { label: t('ai_label_chance'), value: item.Chance ?? 1.0, step: 'any', onChange: e => handleUpdateClothingItemField(selectedSlot, idx, 'Chance', e.target.value) },
                                    { label: t('ai_label_min_health'), value: minH, step: 'any', onChange: e => handleUpdateClothingItemField(selectedSlot, idx, 'MinHealth', e.target.value) },
                                    { label: t('ai_label_max_health'), value: maxH, step: 'any', onChange: e => handleUpdateClothingItemField(selectedSlot, idx, 'MaxHealth', e.target.value) }
                                  ]}
                                />
                              );
                            })
                          )}
                          
                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('ai_label_add_clothing')}</span>
                            <AutocompleteInput
                              suggestions={itemSuggestions}
                              placeholder={t('ai_ph_clothing_class')}
                              onSelect={(name) => handleAddClothingItem(selectedSlot, name)}
                              value={newClothingInput}
                              onChange={setNewClothingInput}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cargo Inventory items list */}
                      <div className="card-hud">
                        <h4>{t('ai_inventory_cargo')}</h4>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {(!activeLoadoutConfig.content.InventoryCargo || activeLoadoutConfig.content.InventoryCargo.length === 0) ? (
                            <div style={{ padding: '20px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              {t('ai_inventory_cargo_empty')}
                            </div>
                          ) : (
                            activeLoadoutConfig.content.InventoryCargo.map((item, idx) => {
                              const minQ = item.Quantity?.Min ?? 1;
                              const maxQ = item.Quantity?.Max ?? 1;
                              return (
                                <ConfigListRow
                                  key={idx}
                                  className={item.ClassName}
                                  isMissing={isItemMissing(item.ClassName)}
                                  missingTooltip={t('ai_tooltip_cargo_missing')}
                                  onRemove={() => handleRemoveCargoItem(idx)}
                                  fields={[
                                    { label: t('ai_label_spawn_chance'), value: item.Chance ?? 1.0, step: 'any', onChange: e => handleUpdateCargoItemField(idx, 'Chance', e.target.value) },
                                    { label: t('ai_label_min_qty'), value: minQ, step: '1', onChange: e => handleUpdateCargoItemField(idx, 'MinQty', e.target.value) },
                                    { label: t('ai_label_max_qty'), value: maxQ, step: '1', onChange: e => handleUpdateCargoItemField(idx, 'MaxQty', e.target.value) }
                                  ]}
                                />
                              );
                            })
                          )}

                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('ai_label_add_cargo')}</span>
                            <AutocompleteInput
                              suggestions={itemSuggestions}
                              placeholder={t('ai_ph_cargo_class')}
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
                  <span>{t('ai_select_loadout_sidebar')}</span>
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
                {t('ai_visual_roaming_title')}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                {t('ai_visual_roaming_desc')}
              </p>
              <button 
                className="btn btn-accent" 
                onClick={() => setGlobalActiveTab('map')}
                style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 'bold', margin: '0 auto', letterSpacing: '1px' }}
              >
                {t('ai_btn_goto_map')}
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
                  {t('ai_loot_tables')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '2px' }}>
                  {t('ai_total_profiles', { count: lootDropPaths.length })}
                </div>
              </div>
              <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-accent" onClick={handleCreateLootDrop} style={{ width: '100%', justifyContent: 'center', fontSize: '11px', letterSpacing: '0.5px', padding: '6px 8px', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.2' }}>
                  {t('ai_btn_create_loot_profile')}
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {lootDropPaths.map(path => {
                  const isSelected = path === selectedLootDropPath;
                  const file = configs[path];
                  const hasUnsaved = file?.isDirty;
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
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('ai_editing_loot_profile')}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontWeight: 'bold' }}>
                        {selectedLootDropPath.split('/').pop()}
                      </span>
                      {configs[selectedLootDropPath]?.isDirty && (
                        <span style={{ color: 'var(--warning-color)', fontSize: '11px', marginLeft: '8px' }}>{t('ai_unsaved')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-accent"
                        onClick={() => onSaveFile(selectedLootDropPath)}
                      >
                        {t('ai_btn_save_loot_table')}
                      </button>
                      <button className="btn btn-accent" onClick={handleCloneLootDrop}>
                        {t('ai_btn_clone_loot_profile')}
                      </button>
                      <button className="btn btn-danger" onClick={handleDeleteLootDrop}>
                        {t('ai_btn_delete_loot_profile')}
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    <div className="card-hud">
                      <h4>{t('ai_loot_drops_index', { count: configs[selectedLootDropPath].content.length || 0 })}</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                        {configs[selectedLootDropPath].content.length === 0 ? (
                          <div style={{ padding: '20px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {t('ai_loot_table_empty')}
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
                                    <span title={t('ai_tooltip_item_missing')} style={{ color: 'var(--warning-color)', cursor: 'help' }}>⚠️</span>
                                  )}
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_drop_chance')}</label>
                                  <input type="number" step="any" value={item.Chance ?? 1.0} onChange={e => handleUpdateLootDropItemField(idx, 'Chance', e.target.value)} style={{ padding: '2px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_min_qty')}</label>
                                  <input type="number" value={minQ} onChange={e => handleUpdateLootDropItemField(idx, 'MinQty', e.target.value)} style={{ padding: '2px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_max_qty')}</label>
                                  <input type="number" value={maxQ} onChange={e => handleUpdateLootDropItemField(idx, 'MaxQty', e.target.value)} style={{ padding: '2px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '11px' }}>{t('ai_label_min_health')}</label>
                                  <input type="number" step="any" value={minH} onChange={e => handleUpdateLootDropItemField(idx, 'MinHealth', e.target.value)} style={{ padding: '2px' }} />
                                </div>
                                <button className="btn btn-danger" onClick={() => handleRemoveLootDropItem(idx)} style={{ padding: '6px 10px', fontSize: '12px', marginTop: '12px' }}>×</button>
                              </div>
                            );
                          })
                        )}

                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('ai_label_add_loot_item')}</span>
                          <AutocompleteInput
                            suggestions={itemSuggestions}
                            placeholder={t('ai_ph_loot_item_class')}
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
                  <span>{t('ai_select_loot_sidebar')}</span>
                </div>
              )}
            </div>
          </>
        )}
      {/* ── Patrol Wizard Modal ───────────────────────────────── */}
      {showPatrolWizard && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div style={{ width: '640px', height: '640px', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--border-glow)', borderRadius: '4px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px' }}>// PATROL_WIZARD_STEP_{wizardStep}_OF_4</div>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>
                  {lang === 'ru' ? 'Конструктор ИИ-патрулей' : 'Patrol Builder'}
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
              
              {/* STEP 1: Patrol Basics */}
              {wizardStep === 1 && (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' ? 'Шаг 1: Укажите имя, фракцию, сложность патруля и добавьте вейпоинт.' : 'Step 1: Set patrol name, faction, difficulty preset, and starting waypoint.'}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Имя патруля *' : 'Patrol Name *'}
                    </label>
                    <input
                      type="text"
                      value={wPatrolName}
                      onChange={e => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                        setWPatrolName(val);
                        setWLoadoutName(val ? val + '_Loadout' : '');
                        setWLootName(val ? val + '_Loot' : '');
                      }}
                      placeholder="e.g. Mil_Barracks_North"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {lang === 'ru' ? 'Фракция' : 'Faction'}
                      </label>
                      <select value={wFaction} onChange={e => handleWizardFactionChange(e.target.value)}>
                        {FACTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {lang === 'ru' ? 'Сложность ИИ' : 'AI Difficulty'}
                      </label>
                      <select value={wDifficulty} onChange={e => setWDifficulty(e.target.value)}>
                        <option value="easy">{lang === 'ru' ? 'Легкая (Easy)' : 'Easy'}</option>
                        <option value="medium">{lang === 'ru' ? 'Средняя (Medium)' : 'Medium'}</option>
                        <option value="hard">{lang === 'ru' ? 'Сложная (Hard)' : 'Hard'}</option>
                        <option value="sniper">{lang === 'ru' ? 'Снайпер (Sniper)' : 'Sniper'}</option>
                        <option value="boss">{lang === 'ru' ? 'Босс (Boss)' : 'Boss'}</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {lang === 'ru' ? 'Количество ботов (Мин)' : 'Bot Count (Min)'}
                      </label>
                      <input type="number" min={1} value={wNumAI} onChange={e => setWNumAI(Math.max(1, Number(e.target.value)))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {lang === 'ru' ? 'Количество ботов (Макс)' : 'Bot Count (Max)'}
                      </label>
                      <input type="number" min={1} value={wNumAIMax} onChange={e => setWNumAIMax(Math.max(1, Number(e.target.value)))} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Поведение' : 'Behaviour'}
                    </label>
                    <select value={wBehaviour} onChange={e => setWBehaviour(e.target.value)}>
                      {BEHAVIOURS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Начальные координаты вейпоинта (X, Y, Z)' : 'Starting Waypoint Coords (X, Y, Z)'}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>X</span>
                        <input type="number" step="any" value={wCoords[0]} onChange={e => setWCoords([Number(e.target.value), wCoords[1], wCoords[2]])} style={{ padding: '4px' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>Y</span>
                        <input type="number" step="any" value={wCoords[1]} onChange={e => setWCoords([wCoords[0], Number(e.target.value), wCoords[2]])} style={{ padding: '4px' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>Z</span>
                        <input type="number" step="any" value={wCoords[2]} onChange={e => setWCoords([wCoords[0], wCoords[1], Number(e.target.value)])} style={{ padding: '4px' }} />
                      </div>
                    </div>
                  </div>

                  {/* Units list editor */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Класснеймы ботов в патруле' : 'Bot Classnames in Patrol'}
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                      {wUnits.map((u, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{u}</span>
                          <span onClick={() => setWUnits(prev => prev.filter((_, idx) => idx !== i))} style={{ color: 'var(--text-dark)', cursor: 'pointer', fontSize: '13px', padding: '0 4px' }}>×</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="ExpansionHardlineAIBot..."
                        id="patrol-wizard-unit-input"
                        list="wizard-bot-suggestions"
                        style={{ flex: 1 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            setWUnits(prev => [...prev, e.target.value.trim()]);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button className="btn btn-accent" onClick={() => {
                        const input = document.getElementById('patrol-wizard-unit-input');
                        if (input && input.value.trim()) {
                          setWUnits(prev => [...prev, input.value.trim()]);
                          input.value = '';
                        }
                      }}>+</button>
                      <datalist id="wizard-bot-suggestions">
                        <option value="ExpansionHardlineAIBotCivMale" />
                        <option value="ExpansionHardlineAIBotCivFemale" />
                        <option value="ExpansionHardlineAIBotWestMale" />
                        <option value="ExpansionHardlineAIBotWestFemale" />
                        <option value="ExpansionHardlineAIBotEastMale" />
                        <option value="ExpansionHardlineAIBotEastFemale" />
                        <option value="ExpansionHardlineAIBotGuardsMale" />
                        <option value="ExpansionHardlineAIBotGuardsFemale" />
                      </datalist>
                    </div>
                  </div>
                </>
              )}

              {/* STEP 2: Loadouts */}
              {wizardStep === 2 && (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' ? 'Шаг 2: Укажите имя профиля снаряжения и выберите комплекты одежды и оружия.' : 'Step 2: Set loadout file name and choose clothing/weapon templates.'}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Имя файла снаряжения *' : 'Loadout File Name *'}
                    </label>
                    <input
                      type="text"
                      value={wLoadoutName}
                      onChange={e => setWLoadoutName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="e.g. Military_Barracks_Loadout"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  {/* Clothing presets */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      {lang === 'ru' ? 'Комплект одежды' : 'Clothing Style Preset'}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {Object.keys(CLOTHING_PRESETS).map(key => (
                        <button
                          key={key}
                          className="btn"
                          onClick={() => setWClothingPreset(key)}
                          style={{
                            padding: '10px 4px', fontSize: '11px', textTransform: 'none', letterSpacing: 'normal',
                            background: wClothingPreset === key ? 'rgba(149,192,149,0.12)' : 'var(--bg-primary)',
                            border: wClothingPreset === key ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                            color: wClothingPreset === key ? 'var(--text-glow)' : 'var(--text-secondary)'
                          }}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weapon presets */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      {lang === 'ru' ? 'Вооружение (Оружие)' : 'Primary Weapon Preset'}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {Object.keys(WEAPON_PRESETS).map(key => (
                        <button
                          key={key}
                          className="btn"
                          onClick={() => setWWeaponChoice(key)}
                          style={{
                            padding: '8px 4px', fontSize: '11px', textTransform: 'none', letterSpacing: 'normal',
                            background: wWeaponChoice === key ? 'rgba(149,192,149,0.12)' : 'var(--bg-primary)',
                            border: wWeaponChoice === key ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                            color: wWeaponChoice === key ? 'var(--text-glow)' : 'var(--text-secondary)'
                          }}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Food checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                    <input
                      type="checkbox"
                      id="wizard-food-choice"
                      checked={wFoodChoice}
                      onChange={e => setWFoodChoice(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="wizard-food-choice" style={{ cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {lang === 'ru' ? 'Выдать боту медикаменты и еду в инвентарь' : 'Give bot medical supplies and food in cargo'}
                    </label>
                  </div>
                </>
              )}

              {/* STEP 3: Loot Drops */}
              {wizardStep === 3 && (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' ? 'Шаг 3: Настройте имя таблицы лута, выберите шаблон или наполните список предметов.' : 'Step 3: Set loot drops file name, choose a template preset, or add custom drops.'}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {lang === 'ru' ? 'Имя файла таблицы лута *' : 'Loot Drop File Name *'}
                    </label>
                    <input
                      type="text"
                      value={wLootName}
                      onChange={e => setWLootName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="e.g. Military_Barracks_Loot"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  {/* Loot drop templates */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      {lang === 'ru' ? 'Быстрое наполнение шаблоном' : 'Quick Fill Preset'}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {Object.keys(LOOT_PRESETS).map(key => (
                        <button
                          key={key}
                          className="btn"
                          onClick={() => handleWizardPresetLootSelect(key)}
                          style={{
                            padding: '8px 4px', fontSize: '10px', textTransform: 'none', letterSpacing: 'normal',
                            background: wLootPreset === key ? 'rgba(149,192,149,0.12)' : 'var(--bg-primary)',
                            border: wLootPreset === key ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                            color: wLootPreset === key ? 'var(--text-glow)' : 'var(--text-secondary)'
                          }}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loot Items list */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      {lang === 'ru' ? 'Список предметов лута при смерти' : 'Death Loot Drops Items List'}
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', marginBottom: '10px' }}>
                      {wLootItems.length === 0 ? (
                        <div style={{ padding: '16px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                          {lang === 'ru' ? 'Список пуст. Боты не будут оставлять лут при смерти.' : 'List empty. Bots will not drop extra loot.'}
                        </div>
                      ) : (
                        wLootItems.map((item, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1fr 1fr auto', gap: '8px', alignItems: 'center', background: 'var(--bg-primary)', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.ClassName}>{item.ClassName}</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>Chance</span>
                              <input type="number" step="any" min={0} max={1} value={item.Chance} onChange={e => {
                                const newL = [...wLootItems];
                                newL[idx].Chance = Number(e.target.value);
                                setWLootItems(newL);
                              }} style={{ padding: '2px', fontSize: '10px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>Min</span>
                              <input type="number" value={item.Min ?? 0} onChange={e => {
                                const newL = [...wLootItems];
                                newL[idx].Min = Number(e.target.value);
                                setWLootItems(newL);
                              }} style={{ padding: '2px', fontSize: '10px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>Max</span>
                              <input type="number" value={item.Max ?? 0} onChange={e => {
                                const newL = [...wLootItems];
                                newL[idx].Max = Number(e.target.value);
                                setWLootItems(newL);
                              }} style={{ padding: '2px', fontSize: '10px' }} />
                            </div>
                            <span onClick={() => setWLootItems(prev => prev.filter((_, i) => i !== idx))} style={{ color: 'var(--text-dark)', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</span>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <AutocompleteInput
                        suggestions={itemSuggestions}
                        placeholder={lang === 'ru' ? 'Добавить предмет...' : 'Add item classname...'}
                        onSelect={(name) => {
                          if (name.trim()) {
                            setWLootItems(prev => [...prev, { ClassName: name.trim(), Chance: 0.5, Min: 1, Max: 1 }]);
                          }
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* STEP 4: Summary */}
              {wizardStep === 4 && (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {lang === 'ru' ? 'Шаг 4: Подтвердите создание следующих файлов и настроек.' : 'Step 4: Confirm generation of the following configurations.'}
                  </div>

                  <div className="card-hud" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-glow)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                      {lang === 'ru' ? '📦 Новый патруль ИИ' : '📦 New AI Patrol'}
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      <strong>{lang === 'ru' ? 'Имя' : 'Name'}:</strong> {wPatrolName}<br />
                      <strong>{lang === 'ru' ? 'Фракция' : 'Faction'}:</strong> {wFaction}<br />
                      <strong>{lang === 'ru' ? 'Сложность' : 'Difficulty'}:</strong> {wDifficulty}<br />
                      <strong>{lang === 'ru' ? 'Количество ботов' : 'Quantity'}:</strong> {wNumAI} - {wNumAIMax}<br />
                      <strong>{lang === 'ru' ? 'Вейпоинт' : 'Waypoint'}:</strong> [{wCoords.join(', ')}]
                    </div>
                  </div>

                  <div className="card-hud" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-glow)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                      {lang === 'ru' ? '📄 Файл снаряжения (Loadout)' : '📄 Loadout File'}
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      <strong>{lang === 'ru' ? 'Путь' : 'Path'}:</strong> ExpansionMod/Loadouts/{wLoadoutName || `${wPatrolName}_Loadout`}.json<br />
                      <strong>{lang === 'ru' ? 'Стиль одежды' : 'Clothing style'}:</strong> {wClothingPreset}<br />
                      <strong>{lang === 'ru' ? 'Оружие' : 'Primary weapon'}:</strong> {wWeaponChoice}<br />
                      <strong>{lang === 'ru' ? 'Стартовый лут в карманах' : 'Starter cargo'}:</strong> {wFoodChoice ? (lang === 'ru' ? 'Еда/Аптечки включены' : 'Food/Medics included') : (lang === 'ru' ? 'Пусто' : 'Empty')}
                    </div>
                  </div>

                  <div className="card-hud" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-glow)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                      {lang === 'ru' ? '📄 Файл лута при смерти (Loot Drops)' : '📄 Loot Drops File'}
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      <strong>{lang === 'ru' ? 'Путь' : 'Path'}:</strong> ExpansionMod/AI/LootDrops/{wLootName || `${wPatrolName}_Loot`}.json<br />
                      <strong>{lang === 'ru' ? 'Количество позиций лута' : 'Item positions'}:</strong> {wLootItems.length}
                    </div>
                  </div>
                </>
              )}

            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '14px' }}>
              <button className="btn" onClick={() => { setShowPatrolWizard(false); setWizardStep(1); }}>
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              {wizardStep > 1 && (
                <button className="btn" onClick={() => setWizardStep(prev => prev - 1)}>
                  {lang === 'ru' ? 'Назад' : 'Back'}
                </button>
              )}
              {wizardStep < 4 ? (
                <button
                  className="btn btn-accent"
                  disabled={wizardStep === 1 && !wPatrolName.trim()}
                  onClick={() => setWizardStep(prev => prev + 1)}
                >
                  {lang === 'ru' ? 'Далее' : 'Next'}
                </button>
              ) : (
                <button className="btn btn-accent" onClick={handlePatrolWizardGenerate}>
                  {lang === 'ru' ? 'Создать патруль' : 'Generate Patrol'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      </div>

    </div>
  );
}
