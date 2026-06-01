import React, { useState, useEffect, useRef } from 'react';
import { useToast } from './ToastManager';
import { useTranslation } from '../utils/localization';

const MAP_PRESETS = [
  { name: '10km Grid (10000m)', size: 10000 },
  { name: 'Chernarus (15360m)', size: 15360 },
  { name: 'Livonia (12800m)', size: 12800 },
  { name: 'Takistan (12800m)', size: 12800 },
  { name: 'Namalsk (12800m)', size: 12800 }
];

const OBJECTIVE_TYPES = {
  10: { folder: 'Action', prefix: 'A', label: 'Action' },
  8: { folder: 'AICamp', prefix: 'AIC', label: 'AI Camp' },
  7: { folder: 'AIPatrol', prefix: 'AIP', label: 'AI Patrol' },
  9: { folder: 'AIVIP', prefix: 'AIESCORT', label: 'AI VIP Escort' },
  4: { folder: 'Collection', prefix: 'C', label: 'Collection' },
  11: { folder: 'Crafting', prefix: 'CR', label: 'Crafting' },
  5: { folder: 'Delivery', prefix: 'D', label: 'Delivery' },
  2: { folder: 'Target', prefix: 'TA', label: 'Target (Kill)' },
  3: { folder: 'Travel', prefix: 'T', label: 'Travel' },
  6: { folder: 'TreasureHunt', prefix: 'TH', label: 'Treasure Hunt' }
};

function getObjectiveFilePath(typeId, id) {
  const info = OBJECTIVE_TYPES[typeId];
  if (!info) return null;
  return `ExpansionMod/Quests/Objectives/${info.folder}/Objective_${info.prefix}_${id}.json`;
}

export default function TacticalMap({ 
  configs, 
  onChangeField, 
  focusedCoordinate, 
  onClearFocus, 
  onCreateFile, 
  onDeleteFile,
  onSelectQuest,
  setActiveTab,
  onOpenFile
}) {
  const { t } = useTranslation();

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const toast = useToast();
  
  // Map dimensions configuration
  const [mapSize, setMapSize] = useState(10000);
  const [isCustomPreset, setIsCustomPreset] = useState(false);
  const [customSizeStr, setCustomSizeStr] = useState('10000');

  // Layer Visibility
  const [layers, setLayers] = useState({
    airdrops: true,
    safezones: true,
    npcs: true,
    patrols: true,
    traders: true,
    questObjectives: true,
    nogoareas: true,
    roamingLocations: true
  });

  // Pan and Zoom state
  const [scale, setScale] = useState(0.8);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Mouse HUD coords
  const [mouseCoords, setMouseCoords] = useState({ x: 0, z: 0 });

  // Image load state
  const [mapImage, setMapImage] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Dragging / Selection state
  const [draggedEntity, setDraggedEntity] = useState(null);
  const [hoveredEntity, setHoveredEntity] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  
  // Ruler measurement states
  const [isRulerActive, setIsRulerActive] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [rulerPoints, setRulerPoints] = useState(null); // { start: {x, y}, end: {x, y} }
  
  // Excluded buildings sidebar section toggle
  const [excludeCollapse, setExcludeCollapse] = useState(false);
  const [newExcludeInput, setNewExcludeInput] = useState('');
  
  // Entity Search query inside Map Sidebar
  const [searchQuery, setSearchQuery] = useState('');

  // AI Patrol Route drawing & merging states
  const [activePatrolDrawIndex, setActivePatrolDrawIndex] = useState(-1); // -1 = disabled
  const [isDrawModeActive, setIsDrawModeActive] = useState(false);
  const [mergeTargetPatrolIndex, setMergeTargetPatrolIndex] = useState(-1);

  // Visual Safezone drawing states
  const [isSafezoneDrawing, setIsSafezoneDrawing] = useState(false);
  const [safezoneDrawCenter, setSafezoneDrawCenter] = useState(null); // {x, z} in game coords
  const [safezoneDrawRadius, setSafezoneDrawRadius] = useState(100);

  // Spawn Modal state
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [spawnCoords, setSpawnCoords] = useState({ x: 0, z: 0 });
  const [spawnType, setSpawnType] = useState('airdrop'); // 'airdrop', 'npc', 'safezone', 'traderzone', 'roaming_location'
  const [spawnName, setSpawnName] = useState('');
  const [spawnRadius, setSpawnRadius] = useState(150);
  const [npcClassName, setNpcClassName] = useState('ExpansionQuestNPCDenis');


  // Gather entities from the configs list
  const [entities, setEntities] = useState({
    airdrops: [],
    npcs: [],
    safezones: [],
    patrols: [],
    traderzones: [],
    questObjectives: [],
    nogoareas: [],
    roamingLocations: []
  });

  const handleUpdateSelectedCoord = (coordName, val) => {
    const numVal = Number(val);
    if (isNaN(numVal)) return;
    
    const { filePath, xPath, zPath } = selectedEntity;
    const isX = coordName === 'x';
    const targetPath = isX ? xPath : zPath;
    
    if (filePath && targetPath) {
      onChangeField(filePath, targetPath, numVal);
    }
    
    setSelectedEntity(prev => prev ? { ...prev, [coordName]: numVal } : null);
    
    setEntities(prev => {
      const update = (list) => 
        list.map(item => item.id === selectedEntity.id ? { ...item, [coordName]: numVal } : item);
      const updatePatrols = (list) =>
        list.map(wp => wp.id === selectedEntity.id ? { ...wp, [coordName]: numVal } : wp);
      
      return {
        ...prev,
        airdrops: update(prev.airdrops),
        npcs: update(prev.npcs),
        safezones: update(prev.safezones),
        traderzones: update(prev.traderzones),
        patrols: updatePatrols(prev.patrols),
        questObjectives: update(prev.questObjectives),
        nogoareas: update(prev.nogoareas),
        roamingLocations: update(prev.roamingLocations)
      };
    });
  };

  const handleUpdateSelectedField = (fieldName, val) => {
    const { filePath, arrayIndex } = selectedEntity;
    if (filePath && arrayIndex !== undefined) {
      onChangeField(filePath, ['RoamingLocations', arrayIndex, fieldName], val);
    }
    
    setSelectedEntity(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      if (fieldName === 'Name') updated.name = val;
      if (fieldName === 'Type') updated.locationType = val;
      if (fieldName === 'Radius') updated.radius = val;
      if (fieldName === 'Enabled') updated.enabled = val;
      return updated;
    });
    
    setEntities(prev => {
      return {
        ...prev,
        roamingLocations: prev.roamingLocations.map(item => {
          if (item.id === selectedEntity.id) {
            const updated = { ...item };
            if (fieldName === 'Name') updated.name = val;
            if (fieldName === 'Type') updated.locationType = val;
            if (fieldName === 'Radius') updated.radius = val;
            if (fieldName === 'Enabled') updated.enabled = val;
            return updated;
          }
          return item;
        })
      };
    });
  };

  const handleCustomMapUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setMapImage(img);
      setImageLoaded(true);
      toast.success(`Custom map loaded: ${file.name}`);
    };
    img.onerror = () => {
      toast.error("Failed to load custom map image.");
    };
  };

  // Load the map image on mount
  useEffect(() => {
    const img = new Image();
    img.src = 'map.png';
    img.onload = () => {
      setMapImage(img);
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.warn("Failed to load map.png. Using blank grid background.");
    };
  }, []);

  // Global keydown listeners for Escape (deselect/cancel draw) and Delete (delete selected entity)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isDrawModeActive) {
          setIsDrawModeActive(false);
          setActivePatrolDrawIndex(-1);
          toast.info('AI Patrol Draw Mode deactivated.');
        }
        setSelectedEntity(null);
      } else if (e.key === 'Delete' || e.key === 'Del') {
        if (selectedEntity) {
          // Check if focus is in an input or select element to avoid deleting while typing
          const activeTag = document.activeElement?.tagName?.toLowerCase();
          if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') {
            return;
          }
          handleDeleteEntity(selectedEntity);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntity, configs, isDrawModeActive]);


  // Center coordinate focused via Form Editor
  useEffect(() => {
    if (focusedCoordinate) {
      const { x, z } = focusedCoordinate;
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const canvasCenterX = rect.width / 2;
        const canvasCenterY = rect.height / 2;

        const mapPxSize = 1024;
        const normX = x / mapSize;
        const normY = 1 - (z / mapSize);
        const mapPxX = normX * mapPxSize;
        const mapPxY = normY * mapPxSize;

        const newScale = 2.0;
        setScale(newScale);

        setOffset({
          x: canvasCenterX - mapPxX * newScale,
          y: canvasCenterY - mapPxY * newScale
        });

        setHoveredEntity({
          id: 'focus-target',
          type: 'focused',
          name: 'Focus Position',
          x,
          z
        });
      }
      onClearFocus();
    }
  }, [focusedCoordinate, mapSize, onClearFocus]);

  // Update entities list dynamically when configs change
  useEffect(() => {
    const airdrops = [];
    const npcs = [];
    const safezones = [];
    const patrols = [];
    const traderzones = [];
    const questObjectives = [];
    const nogoareas = [];
    const roamingLocations = [];

    // Map objective paths to parent quests
    const objectiveToQuestMap = {};
    for (const [filePath, file] of Object.entries(configs)) {
      if (!file.success || !file.content) continue;
      const content = file.content;
      if (filePath.toLowerCase().startsWith('expansionmod/quests/quests/quest_') && content.ID !== undefined) {
        const questId = content.ID;
        const questTitle = content.Title || `Quest #${questId}`;
        if (Array.isArray(content.Objectives)) {
          content.Objectives.forEach(objRef => {
            const objPath = getObjectiveFilePath(objRef.ObjectiveType, objRef.ID);
            if (objPath) {
              const lowerPath = objPath.toLowerCase();
              if (!objectiveToQuestMap[lowerPath]) {
                objectiveToQuestMap[lowerPath] = [];
              }
              objectiveToQuestMap[lowerPath].push({ questId, questTitle });
            }
          });
        }
      }
    }

    for (const [filePath, file] of Object.entries(configs)) {
      if (!file.success || !file.content) continue;
      const content = file.content;

      // 1. Airdrops
      if (filePath.toLowerCase().startsWith('expansion/missions/airdrop_') && content.DropLocation) {
        airdrops.push({
          id: filePath,
          filePath,
          name: content.MissionName || content.DropLocation.Name || filePath.split('/').pop().replace('.json', ''),
          x: content.DropLocation.x,
          z: content.DropLocation.z,
          radius: content.DropLocation.Radius || 100,
          type: 'airdrop',
          xPath: ['DropLocation', 'x'],
          zPath: ['DropLocation', 'z']
        });
      }

      // 2. NPCs
      if (filePath.toLowerCase().startsWith('expansionmod/quests/npcs/') && Array.isArray(content.Position)) {
        npcs.push({
          id: filePath,
          filePath,
          name: content.NPCName || `NPC ${content.ID}`,
          x: content.Position[0],
          z: content.Position[2],
          type: 'npc',
          xPath: ['Position', 0],
          zPath: ['Position', 2]
        });
      }

      // 3. Safe Zones & Cylinder Zones
      if (filePath.toLowerCase() === 'expansion/settings/safezonesettings.json') {
        if (Array.isArray(content.CircleZones)) {
          content.CircleZones.forEach((zone, idx) => {
            if (Array.isArray(zone.Center)) {
              safezones.push({
                id: `sz-circle-${idx}`,
                filePath,
                name: zone.Name || `SafeZone Circle #${idx + 1}`,
                x: zone.Center[0],
                z: zone.Center[2],
                radius: zone.Radius || 100,
                type: 'safezone',
                xPath: ['CircleZones', idx, 'Center', 0],
                zPath: ['CircleZones', idx, 'Center', 2],
                arrayIndex: idx
              });
            }
          });
        }
        if (Array.isArray(content.CylinderZones)) {
          content.CylinderZones.forEach((zone, idx) => {
            if (Array.isArray(zone.Center)) {
              safezones.push({
                id: `sz-cylinder-${idx}`,
                filePath,
                name: zone.Name || `SafeZone Cylinder #${idx + 1}`,
                x: zone.Center[0],
                z: zone.Center[2],
                radius: zone.Radius || 100,
                type: 'safezone_cylinder',
                xPath: ['CylinderZones', idx, 'Center', 0],
                zPath: ['CylinderZones', idx, 'Center', 2],
                arrayIndex: idx
              });
            }
          });
        }
      }

      // 7. NoGo Areas
      if (filePath.toLowerCase() === 'expansion/settings/ailocationsettings.json') {
        if (Array.isArray(content.NoGoAreas)) {
          content.NoGoAreas.forEach((area, idx) => {
            if (Array.isArray(area.Position)) {
              nogoareas.push({
                id: `nogo-${idx}`,
                filePath,
                name: area.Name || `NoGo Area #${idx + 1}`,
                x: area.Position[0],
                z: area.Position[2],
                radius: area.Radius || 100,
                type: 'nogo_area',
                xPath: ['NoGoAreas', idx, 'Position', 0],
                zPath: ['NoGoAreas', idx, 'Position', 2],
                arrayIndex: idx
              });
            }
          });
        }
      }

      // 8. Roaming Locations
      if (filePath.toLowerCase() === 'expansion/settings/ailocationsettings.json') {
        if (Array.isArray(content.RoamingLocations)) {
          content.RoamingLocations.forEach((loc, idx) => {
            if (Array.isArray(loc.Position)) {
              roamingLocations.push({
                id: `roaming-${idx}`,
                filePath,
                name: loc.Name || `Roaming Loc #${idx + 1}`,
                x: loc.Position[0],
                z: loc.Position[2],
                radius: loc.Radius || 200,
                type: 'roaming_location',
                locationType: loc.Type || 'Village',
                enabled: loc.Enabled ?? 1,
                xPath: ['RoamingLocations', idx, 'Position', 0],
                zPath: ['RoamingLocations', idx, 'Position', 2],
                arrayIndex: idx
              });
            }
          });
        }
      }

      // 4. Trader Zones
      if (filePath.toLowerCase().startsWith('expansion/traderzones/') && Array.isArray(content.Position)) {
        traderzones.push({
          id: filePath,
          filePath,
          name: content.m_DisplayName || filePath.split('/').pop().replace('.json', ''),
          x: content.Position[0],
          z: content.Position[2],
          radius: content.Radius || 100,
          type: 'traderzone',
          xPath: ['Position', 0],
          zPath: ['Position', 2]
        });
      }

      // 5. AI Patrols
      if (filePath.toLowerCase() === 'expansion/settings/aipatrolsettings.json' && Array.isArray(content.Patrols)) {
        content.Patrols.forEach((patrol, idx) => {
          if (Array.isArray(patrol.Waypoints) && patrol.Waypoints.length > 0) {
            const wps = patrol.Waypoints.map((wp, wpIdx) => ({
              id: `patrol-${idx}-wp-${wpIdx}`,
              filePath,
              name: `Waypoint #${wpIdx + 1} of ${patrol.Name || `Patrol #${idx + 1}`}`,
              x: wp[0],
              z: wp[2],
              wpIdx,
              patrolIdx: idx,
              type: 'patrol_waypoint',
              xPath: ['Patrols', idx, 'Waypoints', wpIdx, 0],
              zPath: ['Patrols', idx, 'Waypoints', wpIdx, 2]
            }));
            
            wps.forEach(wp => patrols.push(wp));
          }
        });
      }

      // 6. Quest Objectives
      if (filePath.toLowerCase().startsWith('expansionmod/quests/objectives/')) {
        const lowerPath = filePath.toLowerCase();
        const questRefs = objectiveToQuestMap[lowerPath] || [];
        
        if (Array.isArray(content.Position) && content.Position.length >= 3) {
          const x = content.Position[0];
          const z = content.Position[2];
          
          if (questRefs.length > 0) {
            questRefs.forEach((qRef, qIdx) => {
              questObjectives.push({
                id: `${filePath}-pos-${qIdx}`,
                filePath,
                name: content.ObjectiveText || `Objective ${content.ID}`,
                x,
                z,
                radius: content.MaxDistance > 0 ? content.MaxDistance : 50,
                type: 'quest_objective',
                questId: qRef.questId,
                questTitle: qRef.questTitle,
                objectiveType: content.ObjectiveType,
                xPath: ['Position', 0],
                zPath: ['Position', 2]
              });
            });
          } else {
            questObjectives.push({
              id: `${filePath}-pos-orphaned`,
              filePath,
              name: content.ObjectiveText || `Objective ${content.ID}`,
              x,
              z,
              radius: content.MaxDistance > 0 ? content.MaxDistance : 50,
              type: 'quest_objective',
              questId: null,
              questTitle: 'Orphaned Objective',
              objectiveType: content.ObjectiveType,
              xPath: ['Position', 0],
              zPath: ['Position', 2]
            });
          }
        } else if (Array.isArray(content.Positions)) {
          content.Positions.forEach((pos, pIdx) => {
            if (Array.isArray(pos) && pos.length >= 3) {
              const x = pos[0];
              const z = pos[2];
              if (questRefs.length > 0) {
                questRefs.forEach((qRef, qIdx) => {
                  questObjectives.push({
                    id: `${filePath}-pos-${pIdx}-${qIdx}`,
                    filePath,
                    name: `${content.ObjectiveText || `Objective ${content.ID}`} (Point #${pIdx + 1})`,
                    x,
                    z,
                    radius: content.MaxDistance > 0 ? content.MaxDistance : 50,
                    type: 'quest_objective',
                    questId: qRef.questId,
                    questTitle: qRef.questTitle,
                    objectiveType: content.ObjectiveType,
                    xPath: ['Positions', pIdx, 0],
                    zPath: ['Positions', pIdx, 2]
                  });
                });
              } else {
                questObjectives.push({
                  id: `${filePath}-pos-${pIdx}-orphaned`,
                  filePath,
                  name: `${content.ObjectiveText || `Objective ${content.ID}`} (Point #${pIdx + 1})`,
                  x,
                  z,
                  radius: content.MaxDistance > 0 ? content.MaxDistance : 50,
                  type: 'quest_objective',
                  questId: null,
                  questTitle: 'Orphaned Objective',
                  objectiveType: content.ObjectiveType,
                  xPath: ['Positions', pIdx, 0],
                  zPath: ['Positions', pIdx, 2]
                });
              }
            }
          });
        }
      }
    }

    setEntities({ airdrops, npcs, safezones, patrols, traderzones, questObjectives, nogoareas, roamingLocations });
  }, [configs]);

  // Coordinate Conversion Helpers
  const gameToPixels = (x, z) => {
    const mapPxSize = 1024;
    const normX = x / mapSize;
    const normY = 1 - (z / mapSize);
    
    const mapPxX = normX * mapPxSize;
    const mapPxY = normY * mapPxSize;
    
    const screenX = mapPxX * scale + offset.x;
    const screenY = mapPxY * scale + offset.y;
    
    return { x: screenX, y: screenY };
  };

  const pixelsToGame = (px, py) => {
    const mapPxSize = 1024;
    const mapPxX = (px - offset.x) / scale;
    const mapPxY = (py - offset.y) / scale;
    
    const normX = mapPxX / mapPxSize;
    const normY = mapPxY / mapPxSize;
    
    const x = normX * mapSize;
    const z = (1 - normY) * mapSize;
    
    return { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 };
  };

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const rect = containerRef.current.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const mapSizePx = 1024;
    const screenW = mapSizePx * scale;
    const screenH = mapSizePx * scale;

    // Draw Map background
    if (imageLoaded && mapImage) {
      ctx.drawImage(mapImage, offset.x, offset.y, screenW, screenH);
    } else {
      ctx.fillStyle = '#060a06';
      ctx.fillRect(offset.x, offset.y, screenW, screenH);
      ctx.strokeStyle = '#1e301e';
      ctx.lineWidth = 2;
      ctx.strokeRect(offset.x, offset.y, screenW, screenH);
    }

    // Border
    ctx.strokeStyle = '#5a9a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(offset.x, offset.y, screenW, screenH);

    // Draw Safe Zones & Cylinder Zones
    if (layers.safezones) {
      entities.safezones.forEach(sz => {
        const pos = gameToPixels(sz.x, sz.z);
        const rad = (sz.radius / mapSize) * 1024 * scale;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, rad, 0, 2 * Math.PI);
        ctx.fillStyle = sz.type === 'safezone_cylinder' ? 'rgba(74, 154, 120, 0.15)' : 'rgba(74, 154, 74, 0.15)';
        ctx.fill();
        
        ctx.strokeStyle = '#559655';
        ctx.lineWidth = 1.5;
        if (sz.type === 'safezone_cylinder') {
          ctx.setLineDash([6, 3, 2, 3]); // Dash-dot pattern
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        ctx.beginPath();
        ctx.moveTo(pos.x - 4, pos.y); ctx.lineTo(pos.x + 4, pos.y);
        ctx.moveTo(pos.x, pos.y - 4); ctx.lineTo(pos.x, pos.y + 4);
        ctx.stroke();
      });
    }

    // Draw Safezone preview during drawing
    if (isSafezoneDrawing && safezoneDrawCenter) {
      const centerPos = gameToPixels(safezoneDrawCenter.x, safezoneDrawCenter.z);
      const rad = (safezoneDrawRadius / mapSize) * 1024 * scale;

      ctx.save();
      // Draw outer circle
      ctx.beginPath();
      ctx.arc(centerPos.x, centerPos.y, rad, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(74, 154, 120, 0.25)'; // semi-transparent green
      ctx.fill();
      ctx.strokeStyle = '#2ebd59';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      
      // Draw center dot
      ctx.beginPath();
      ctx.arc(centerPos.x, centerPos.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }

    // Draw NoGo Areas
    if (layers.nogoareas && entities.nogoareas) {
      entities.nogoareas.forEach(nogo => {
        const pos = gameToPixels(nogo.x, nogo.z);
        const rad = (nogo.radius / mapSize) * 1024 * scale;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, rad, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(204, 74, 74, 0.12)';
        ctx.fill();
        
        ctx.strokeStyle = '#cc4a4a';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]); // Dashed line
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        ctx.beginPath();
        ctx.moveTo(pos.x - 4, pos.y); ctx.lineTo(pos.x + 4, pos.y);
        ctx.moveTo(pos.x, pos.y - 4); ctx.lineTo(pos.x, pos.y + 4);
        ctx.strokeStyle = '#cc4a4a';
        ctx.stroke();
      });
    }

    // Draw Roaming Locations
    if (layers.roamingLocations && entities.roamingLocations) {
      entities.roamingLocations.forEach(loc => {
        const pos = gameToPixels(loc.x, loc.z);
        const rad = (loc.radius / mapSize) * 1024 * scale;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, rad, 0, 2 * Math.PI);
        ctx.fillStyle = loc.enabled ? 'rgba(255, 159, 67, 0.08)' : 'rgba(255, 159, 67, 0.02)';
        ctx.fill();
        
        ctx.strokeStyle = loc.enabled ? '#ff9f43' : 'rgba(255, 159, 67, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 4]); // Long dashed pattern
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Center cross
        ctx.beginPath();
        ctx.moveTo(pos.x - 4, pos.y); ctx.lineTo(pos.x + 4, pos.y);
        ctx.moveTo(pos.x, pos.y - 4); ctx.lineTo(pos.x, pos.y + 4);
        ctx.strokeStyle = '#ff9f43';
        ctx.stroke();
      });
    }

    // Draw Trader Zones
    if (layers.traders) {
      entities.traderzones.forEach(tz => {
        const pos = gameToPixels(tz.x, tz.z);
        const rad = (tz.radius / mapSize) * 1024 * scale;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, rad, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(68, 170, 204, 0.08)';
        ctx.fill();
        ctx.strokeStyle = '#44aacc';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Draw Airdrops
    if (layers.airdrops) {
      entities.airdrops.forEach(ad => {
        const pos = gameToPixels(ad.x, ad.z);
        const rad = (ad.radius / mapSize) * 1024 * scale;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, rad, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(235, 214, 103, 0.12)';
        ctx.fill();
        ctx.strokeStyle = '#ebd667';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ebd667';
        ctx.fill();
      });
    }

    // Draw AI Patrol routes (Waypoints paths)
    if (layers.patrols) {
      // Group patrol waypoints back together by patrol index
      const grouped = {};
      entities.patrols.forEach(wp => {
        if (!grouped[wp.patrolIdx]) grouped[wp.patrolIdx] = [];
        grouped[wp.patrolIdx].push(wp);
      });

      Object.entries(grouped).forEach(([pIdx, wps]) => {
        wps.sort((a, b) => a.wpIdx - b.wpIdx);
        const isActivePatrol = activePatrolDrawIndex === parseInt(pIdx);
        
        // Set faction coloring
        const firstFile = configs['expansion/settings/AIPatrolSettings.json'];
        const faction = (firstFile?.content?.Patrols[parseInt(pIdx)]?.Faction || 'West').toLowerCase();
        let factionColor = '#808080';
        if (faction === 'west') factionColor = '#4a9acc';
        else if (faction === 'east') factionColor = '#cc4a4a';
        else if (faction === 'guards') factionColor = '#ebd667';

        ctx.save();
        ctx.beginPath();
        wps.forEach((wp, wIdx) => {
          const pos = gameToPixels(wp.x, wp.z);
          if (wIdx === 0) ctx.moveTo(pos.x, pos.y);
          else ctx.lineTo(pos.x, pos.y);
        });

        ctx.strokeStyle = factionColor;
        if (isActivePatrol) {
          ctx.lineWidth = 4;
          ctx.shadowBlur = 10;
          ctx.shadowColor = factionColor;
        } else {
          ctx.lineWidth = 2;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.restore();

        // Draw directional arrows at the midpoints of segments
        ctx.save();
        ctx.fillStyle = factionColor;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        wps.forEach((wp, wIdx) => {
          if (wIdx === 0) return;
          const posA = gameToPixels(wps[wIdx - 1].x, wps[wIdx - 1].z);
          const posB = gameToPixels(wp.x, wp.z);
          
          const midX = (posA.x + posB.x) / 2;
          const midY = (posA.y + posB.y) / 2;
          const angle = Math.atan2(posB.y - posA.y, posB.x - posA.x);
          
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(-6, -4);
          ctx.lineTo(6, 0);
          ctx.lineTo(-6, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
        ctx.restore();

        // Draw dashed preview line to current mouse position
        if (isActivePatrol && isDrawModeActive && wps.length > 0) {
          const lastWp = wps[wps.length - 1];
          const lastWpPos = gameToPixels(lastWp.x, lastWp.z);
          const mousePos = gameToPixels(mouseCoords.x, mouseCoords.z);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(lastWpPos.x, lastWpPos.y);
          ctx.lineTo(mousePos.x, mousePos.y);
          ctx.strokeStyle = factionColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]); // Dashed line
          ctx.stroke();
          ctx.restore();
        }

        wps.forEach((wp) => {
          const pos = gameToPixels(wp.x, wp.z);
          ctx.save();
          ctx.beginPath();
          if (isActivePatrol) {
            ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff'; // White center for active waypoints
            ctx.fill();
            ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
            ctx.strokeStyle = factionColor;
            ctx.lineWidth = 2;
          } else {
            ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = factionColor;
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
          }
          ctx.stroke();
          ctx.restore();
        });
      });
    }


    // Draw NPCs
    if (layers.npcs) {
      entities.npcs.forEach(npc => {
        const pos = gameToPixels(npc.x, npc.z);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - 8);
        ctx.lineTo(pos.x - 6, pos.y + 6);
        ctx.lineTo(pos.x + 6, pos.y + 6);
        ctx.closePath();
        ctx.fillStyle = '#a6f5a6';
        ctx.fill();
        ctx.strokeStyle = '#070907';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(166, 245, 166, 0.4)';
        ctx.stroke();
      });
    }

    // Draw Quest Objectives
    if (layers.questObjectives && entities.questObjectives) {
      entities.questObjectives.forEach(qo => {
        const pos = gameToPixels(qo.x, qo.z);
        const rad = (qo.radius / mapSize) * 1024 * scale;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, rad, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(192, 132, 252, 0.06)';
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#c084fc';
        ctx.fill();
        ctx.strokeStyle = '#070907';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Draw selected entity highlight
    if (selectedEntity) {
      const pos = gameToPixels(selectedEntity.x, selectedEntity.z);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 16, 0, 2 * Math.PI);
      ctx.strokeStyle = '#00ffff'; // Glowing neon cyan border
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 2]); // Pulsing/dashed border
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Outer glow circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 22, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw targeted focus pointer if active
    if (hoveredEntity) {
      const pos = gameToPixels(hoveredEntity.x, hoveredEntity.z);
      ctx.font = 'bold 12px "Share Tech Mono", monospace';
      
      let label = `${hoveredEntity.type.toUpperCase()}: ${hoveredEntity.name}`;
      let subLabel = `GRID: ${Math.round(hoveredEntity.x)}, ${Math.round(hoveredEntity.z)}`;
      if (hoveredEntity.type === 'quest_objective') {
        label = `QUEST: ${hoveredEntity.questTitle}`;
        subLabel = `OBJ: ${hoveredEntity.name}`;
      } else if (hoveredEntity.type === 'patrol_waypoint') {
        label = `WAYPOINT #${hoveredEntity.wpIdx + 1}`;
        subLabel = `Patrol #${hoveredEntity.patrolIdx + 1} · GRID: ${Math.round(hoveredEntity.x)}, ${Math.round(hoveredEntity.z)}`;
      }
      
      let showDeleteBtn = false;
      if (hoveredEntity.type === 'patrol_waypoint' && isDrawModeActive && hoveredEntity.patrolIdx === activePatrolDrawIndex) {
        subLabel += " | [X] DELETE";
        showDeleteBtn = true;
      }
      
      const width = Math.max(ctx.measureText(label).width, ctx.measureText(subLabel).width) + 16;
      const height = 36;
      
      ctx.fillStyle = 'rgba(13, 18, 13, 0.9)';
      ctx.strokeStyle = 'var(--border-color)';
      ctx.lineWidth = 1;
      ctx.fillRect(pos.x + 10, pos.y - 45, width, height);
      ctx.strokeRect(pos.x + 10, pos.y - 45, width, height);
      
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + 10, pos.y - 15);
      ctx.stroke();

      ctx.fillStyle = hoveredEntity.type === 'airdrop' ? '#ebd667' : 
                      hoveredEntity.type === 'npc' ? '#a6f5a6' : 
                      hoveredEntity.type === 'quest_objective' ? '#c084fc' : '#95c095';
      ctx.fillText(label, pos.x + 18, pos.y - 32);
      ctx.fillStyle = 'var(--text-secondary)';
      ctx.fillText(subLabel, pos.x + 18, pos.y - 18);

      if (showDeleteBtn) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x + 15, pos.y - 15, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#cc4a4a';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×', pos.x + 15, pos.y - 15);
        ctx.restore();
      }
    }

    // Draw ruler line if active and points are defined
    if (isRulerActive && rulerPoints && rulerPoints.start && rulerPoints.end) {
      ctx.beginPath();
      ctx.moveTo(rulerPoints.start.x, rulerPoints.start.y);
      ctx.lineTo(rulerPoints.end.x, rulerPoints.end.y);
      ctx.strokeStyle = '#2ebd59'; // Neon green
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw start/end dots
      ctx.beginPath();
      ctx.arc(rulerPoints.start.x, rulerPoints.start.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#2ebd59';
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(rulerPoints.end.x, rulerPoints.end.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#2ebd59';
      ctx.fill();

      // Calculate distance in meters
      const startG = pixelsToGame(rulerPoints.start.x, rulerPoints.start.y);
      const endG = pixelsToGame(rulerPoints.end.x, rulerPoints.end.y);
      const dist = Math.hypot(startG.x - endG.x, startG.z - endG.z);

      // Draw text label at the middle of the line
      const midX = (rulerPoints.start.x + rulerPoints.end.x) / 2;
      const midY = (rulerPoints.start.y + rulerPoints.end.y) / 2;
      const label = `${Math.round(dist)}m`;
      ctx.font = 'bold 12px "Share Tech Mono", monospace';
      const textW = ctx.measureText(label).width;
      
      ctx.fillStyle = 'rgba(7, 9, 7, 0.9)';
      ctx.strokeStyle = '#2ebd59';
      ctx.lineWidth = 1;
      ctx.fillRect(midX - textW/2 - 6, midY - 10, textW + 12, 20);
      ctx.strokeRect(midX - textW/2 - 6, midY - 10, textW + 12, 20);
      
      ctx.fillStyle = '#2ebd59';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY);
      ctx.textAlign = 'left'; // Restore
      ctx.textBaseline = 'alphabetic'; // Restore
    }
  }, [offset, scale, entities, layers, hoveredEntity, selectedEntity, imageLoaded, mapImage, mapSize, isRulerActive, rulerPoints, isSafezoneDrawing, safezoneDrawCenter, safezoneDrawRadius, activePatrolDrawIndex, isDrawModeActive]);

  // Handle Zooming
  const handleWheel = (e) => {
    e.preventDefault();
    if (isSafezoneDrawing && safezoneDrawCenter) {
      const delta = e.deltaY < 0 ? 10 : -10;
      setSafezoneDrawRadius(r => Math.max(10, r + delta));
      return;
    }
    const zoomFactor = 1.1;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let newScale = scale;
    if (e.deltaY < 0) {
      newScale = Math.min(scale * zoomFactor, 20);
    } else {
      newScale = Math.max(scale / zoomFactor, 0.1);
    }

    const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale);
    const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale);

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  // Find entity under cursor
  const getEntityAt = (mouseX, mouseY) => {
    const threshold = 12;

    if (layers.npcs) {
      for (const npc of entities.npcs) {
        const pos = gameToPixels(npc.x, npc.z);
        if (Math.hypot(pos.x - mouseX, pos.y - mouseY) <= threshold) return npc;
      }
    }
    if (layers.questObjectives && entities.questObjectives) {
      for (const qo of entities.questObjectives) {
        const pos = gameToPixels(qo.x, qo.z);
        if (Math.hypot(pos.x - mouseX, pos.y - mouseY) <= threshold) return qo;
      }
    }
    if (layers.airdrops) {
      for (const ad of entities.airdrops) {
        const pos = gameToPixels(ad.x, ad.z);
        if (Math.hypot(pos.x - mouseX, pos.y - mouseY) <= threshold) return ad;
      }
    }
    if (layers.safezones) {
      for (const sz of entities.safezones) {
        const pos = gameToPixels(sz.x, sz.z);
        if (Math.hypot(pos.x - mouseX, pos.y - mouseY) <= threshold) return sz;
      }
    }
    if (layers.traders) {
      for (const tz of entities.traderzones) {
        const pos = gameToPixels(tz.x, tz.z);
        if (Math.hypot(pos.x - mouseX, pos.y - mouseY) <= threshold) return tz;
      }
    }
    if (layers.patrols) {
      for (const wp of entities.patrols) {
        const pos = gameToPixels(wp.x, wp.z);
        if (Math.hypot(pos.x - mouseX, pos.y - mouseY) <= threshold) return wp;
      }
    }
    if (layers.nogoareas && entities.nogoareas) {
      for (const nogo of entities.nogoareas) {
        const pos = gameToPixels(nogo.x, nogo.z);
        if (Math.hypot(pos.x - mouseX, pos.y - mouseY) <= threshold) return nogo;
      }
    }
    if (layers.roamingLocations && entities.roamingLocations) {
      for (const loc of entities.roamingLocations) {
        const pos = gameToPixels(loc.x, loc.z);
        if (Math.hypot(pos.x - mouseX, pos.y - mouseY) <= threshold) return loc;
      }
    }

    return null;
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isSafezoneDrawing) {
      if (e.button === 0) {
        const gameCoords = pixelsToGame(mouseX, mouseY);
        setSafezoneDrawCenter(gameCoords);
        setSafezoneDrawRadius(50); // initial radius
        setIsPanning(false);
        return;
      }
    }

    if (isDrawModeActive && activePatrolDrawIndex !== -1 && hoveredEntity && hoveredEntity.type === 'patrol_waypoint' && hoveredEntity.patrolIdx === activePatrolDrawIndex) {
      if (e.button === 0) {
        const wpPos = gameToPixels(hoveredEntity.x, hoveredEntity.z);
        const delX = wpPos.x + 15;
        const delY = wpPos.y - 15;
        if (Math.hypot(mouseX - delX, mouseY - delY) <= 10) {
          handleDeleteWaypoint(hoveredEntity.patrolIdx, hoveredEntity.wpIdx);
          return;
        }
      }
    }

    if (isRulerActive) {
      setIsMeasuring(true);
      setRulerPoints({
        start: { x: mouseX, y: mouseY },
        end: { x: mouseX, y: mouseY }
      });
      return;
    }

    if (e.button === 0) { // Left-click
      const hit = getEntityAt(mouseX, mouseY);
      if (hit) {
        setDraggedEntity(hit);
        setSelectedEntity(hit);
        return;
      } else {
        setSelectedEntity(null);
      }
    }

    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };


  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const game = pixelsToGame(mouseX, mouseY);
    setMouseCoords(game);

    if (isSafezoneDrawing && safezoneDrawCenter) {
      const centerPos = gameToPixels(safezoneDrawCenter.x, safezoneDrawCenter.z);
      const distPx = Math.hypot(mouseX - centerPos.x, mouseY - centerPos.y);
      const distGame = (distPx / (1024 * scale)) * mapSize;
      setSafezoneDrawRadius(Math.max(10, Math.round(distGame)));
      return;
    }

    if (isRulerActive && isMeasuring) {
      setRulerPoints(prev => prev ? {
        ...prev,
        end: { x: mouseX, y: mouseY }
      } : null);
      return;
    }

    if (draggedEntity) {
      const newGameCoords = pixelsToGame(mouseX, mouseY);
      
      setEntities(prev => {
        const updateCoords = (list) => 
          list.map(item => item.id === draggedEntity.id ? { ...item, x: newGameCoords.x, z: newGameCoords.z } : item);
        
        const updatePatrols = (list) =>
          list.map(wp => wp.id === draggedEntity.id ? { ...wp, x: newGameCoords.x, z: newGameCoords.z } : wp);

        return {
          airdrops: updateCoords(prev.airdrops),
          npcs: updateCoords(prev.npcs),
          safezones: updateCoords(prev.safezones),
          traderzones: updateCoords(prev.traderzones),
          patrols: updatePatrols(prev.patrols),
          questObjectives: updateCoords(prev.questObjectives),
          nogoareas: updateCoords(prev.nogoareas),
          roamingLocations: updateCoords(prev.roamingLocations)
        };
      });

      setDraggedEntity(prev => ({ ...prev, x: newGameCoords.x, z: newGameCoords.z }));
      setHoveredEntity(prev => prev ? { ...prev, x: newGameCoords.x, z: newGameCoords.z } : null);
      setSelectedEntity(prev => prev && prev.id === draggedEntity.id ? { ...prev, x: newGameCoords.x, z: newGameCoords.z } : prev);
      return;
    }

    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    const hit = getEntityAt(mouseX, mouseY);
    setHoveredEntity(hit);
    canvas.style.cursor = isRulerActive ? 'crosshair' : isSafezoneDrawing ? 'crosshair' : hit ? 'move' : isPanning ? 'grabbing' : 'default';
  };

  const handleMouseUp = () => {
    if (isSafezoneDrawing && safezoneDrawCenter) {
      const currentCenter = safezoneDrawCenter;
      const currentRadius = safezoneDrawRadius;
      
      setSafezoneDrawCenter(null);
      
      const confirmMsg = `Create a new Safezone at [${Math.round(currentCenter.x)}, ${Math.round(currentCenter.z)}] with radius ${Math.round(currentRadius)}m?`;
      if (window.confirm(confirmMsg)) {
        handleSaveNewSafezone(currentCenter.x, currentCenter.z, currentRadius);
      }
      setIsSafezoneDrawing(false);
      return;
    }

    if (isRulerActive && isMeasuring) {
      setIsMeasuring(false);
      if (rulerPoints && Math.hypot(rulerPoints.start.x - rulerPoints.end.x, rulerPoints.start.y - rulerPoints.end.y) < 2) {
        setRulerPoints(null);
      }
      return;
    }
    if (draggedEntity) {
      const { filePath, xPath, zPath, x, z } = draggedEntity;
      if (filePath && xPath && zPath) {
        onChangeField(filePath, xPath, x);
        onChangeField(filePath, zPath, z);
      }
      setDraggedEntity(null);
    }
    setIsPanning(false);
  };

  // Double Click opens Spawn Modal
  const handleDoubleClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDrawModeActive && activePatrolDrawIndex !== -1) {
      const hit = getEntityAt(mouseX, mouseY);
      if (hit) return; // Ignore double clicks on existing waypoints
      
      const game = pixelsToGame(mouseX, mouseY);
      const patrolConfigPath = 'expansion/settings/AIPatrolSettings.json';
      const patrolFile = configs[patrolConfigPath];
      if (patrolFile?.success && Array.isArray(patrolFile.content.Patrols)) {
        const patrol = patrolFile.content.Patrols[activePatrolDrawIndex];
        if (patrol) {
          const currentWps = Array.isArray(patrol.Waypoints) ? patrol.Waypoints : [];
          const newWp = [parseFloat(game.x.toFixed(3)), 0.0, parseFloat(game.z.toFixed(3))];
          onChangeField(patrolConfigPath, ['Patrols', activePatrolDrawIndex, 'Waypoints'], [...currentWps, newWp]);
          toast.success(`Waypoint #${currentWps.length + 1} added to ${patrol.Name || `Patrol #${activePatrolDrawIndex + 1}`}`);
          return;
        }
      }
      return;
    }

    const hit = getEntityAt(mouseX, mouseY);
    if (hit) {
      setSelectedEntity(hit);
      return;
    }

    const game = pixelsToGame(mouseX, mouseY);
    setSpawnCoords(game);
    setSpawnName(`Spawn_Zone_${Math.floor(game.x)}`);
    setShowSpawnModal(true);
  };

  // Visual Deletion handler
  const handleDeleteEntity = (entity) => {
    if (entity.type === 'quest_objective') {
      alert("Quest objectives must be managed and deleted inside the Quests Editor (Quests tab) to preserve quest tree flow and avoid orphans.");
      return;
    }

    if (!window.confirm(`Delete this ${entity.type.toUpperCase()}? \n"${entity.name}"`)) {
      return;
    }

    const { filePath, type, arrayIndex, patrolIdx, wpIdx } = entity;

    // Embedded entity deletions (Inside settings arrays)
    if (type === 'safezone') {
      const file = configs[filePath];
      const newZones = [...file.content.CircleZones];
      newZones.splice(arrayIndex, 1);
      onChangeField(filePath, ['CircleZones'], newZones);
    } else if (type === 'safezone_cylinder') {
      const file = configs[filePath];
      const newZones = [...file.content.CylinderZones];
      newZones.splice(arrayIndex, 1);
      onChangeField(filePath, ['CylinderZones'], newZones);
    } else if (type === 'nogo_area') {
      const file = configs[filePath];
      const newAreas = [...file.content.NoGoAreas];
      newAreas.splice(arrayIndex, 1);
      onChangeField(filePath, ['NoGoAreas'], newAreas);
    } else if (type === 'patrol_waypoint') {
      const file = configs[filePath];
      const newWaypoints = [...file.content.Patrols[patrolIdx].Waypoints];
      newWaypoints.splice(wpIdx, 1);
      onChangeField(filePath, ['Patrols', patrolIdx, 'Waypoints'], newWaypoints);
    } else if (type === 'roaming_location') {
      const file = configs[filePath];
      const newLocs = [...file.content.RoamingLocations];
      newLocs.splice(arrayIndex, 1);
      onChangeField(filePath, ['RoamingLocations'], newLocs);
    } else {
      // Standalone entity deletions (Physical file deletes)
      onDeleteFile(filePath);
    }

    setHoveredEntity(null);
    setSelectedEntity(null);
  };

  const handleDeleteWaypoint = (patrolIdx, wpIdx) => {
    const patrolConfigPath = 'expansion/settings/AIPatrolSettings.json';
    const file = configs[patrolConfigPath];
    if (file?.success && Array.isArray(file.content.Patrols)) {
      const patrol = file.content.Patrols[patrolIdx];
      if (patrol && Array.isArray(patrol.Waypoints)) {
        const newWaypoints = patrol.Waypoints.filter((_, idx) => idx !== wpIdx);
        onChangeField(patrolConfigPath, ['Patrols', patrolIdx, 'Waypoints'], newWaypoints);
        toast.success(`Deleted Waypoint #${wpIdx + 1}`);
      }
    }
  };

  const handleSaveNewSafezone = (x, z, radius) => {
    const safezonesConfigPath = Object.keys(configs).find(p => p.toLowerCase() === 'expansion/settings/safezonesettings.json') || 'expansion/settings/safezonesettings.json';
    const file = configs[safezonesConfigPath];
    if (file?.success && file.content) {
      const cylinderZones = Array.isArray(file.content.CylinderZones) ? file.content.CylinderZones : [];
      const newZone = {
        Name: `SafeZone Cylinder #${cylinderZones.length + 1}`,
        Center: [parseFloat(x.toFixed(3)), 0.0, parseFloat(z.toFixed(3))],
        Radius: parseFloat(radius.toFixed(3))
      };
      onChangeField(safezonesConfigPath, ['CylinderZones'], [...cylinderZones, newZone]);
      toast.success(t('map_safezone_created_success', { x: Math.round(x), z: Math.round(z), radius: Math.round(radius) }));
    } else {
      toast.error("Could not find safezonesettings.json configuration.");
    }
  };

  const handleMergePatrols = () => {
    if (activePatrolDrawIndex === -1 || mergeTargetPatrolIndex === -1) return;
    
    const patrolConfigPath = 'expansion/settings/AIPatrolSettings.json';
    const patrolFile = configs[patrolConfigPath];
    if (!patrolFile?.success || !Array.isArray(patrolFile.content.Patrols)) return;
    
    const patrolA = patrolFile.content.Patrols[activePatrolDrawIndex];
    const patrolB = patrolFile.content.Patrols[mergeTargetPatrolIndex];
    
    if (!patrolA || !patrolB) return;
    
    const wpsA = Array.isArray(patrolA.Waypoints) ? patrolA.Waypoints : [];
    const wpsB = Array.isArray(patrolB.Waypoints) ? patrolB.Waypoints : [];
    
    if (wpsB.length === 0) {
      toast.warning(`Target Patrol #${mergeTargetPatrolIndex + 1} has no waypoints to merge.`);
      return;
    }
    
    const confirmMessage = `Merge route of Patrol #${mergeTargetPatrolIndex + 1} (${wpsB.length} waypoints) into Patrol #${activePatrolDrawIndex + 1}?\n\nTarget patrol's waypoints will be appended to the current patrol.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    // Append waypoints
    const mergedWaypoints = [...wpsA, ...wpsB.map(wp => [...wp])];
    
    // Save to Patrol A
    onChangeField(patrolConfigPath, ['Patrols', activePatrolDrawIndex, 'Waypoints'], mergedWaypoints);
    
    // Ask if they want to clear the merged patrol's waypoints to avoid double patrollers
    if (window.confirm(`Clear waypoints of Patrol #${mergeTargetPatrolIndex + 1} to prevent duplicate routing?`)) {
      onChangeField(patrolConfigPath, ['Patrols', mergeTargetPatrolIndex, 'Waypoints'], []);
    }
    
    toast.success(`Successfully merged ${wpsB.length} waypoints.`);
    setMergeTargetPatrolIndex(-1);
  };


  // Spawn visual entity submit callback
  const handleSpawnSubmit = (e) => {
    e.preventDefault();
    if (!spawnName.trim()) return;

    if (spawnType === 'airdrop') {
      // Create airdrop JSON file
      const fileName = `expansion/missions/Airdrop_Random_Settlement_${spawnName.trim().replace(/\s+/g, '_')}.json`;
      const template = {
        m_Version: 3,
        Enabled: 1,
        Weight: 1,
        MissionMaxTime: 1200,
        MissionName: `Random_Settlement_${spawnName.trim()}`,
        Difficulty: 0,
        Objective: 0,
        Reward: "",
        ShowNotification: 1,
        Height: 450,
        DropZoneHeight: 450,
        Speed: 25,
        DropZoneSpeed: 25,
        Container: "Random",
        FallSpeed: 4.5,
        DropLocation: {
          x: spawnCoords.x,
          z: spawnCoords.z,
          Name: spawnName.trim(),
          Radius: Number(spawnRadius)
        },
        Infected: [],
        ItemCount: -1,
        InfectedCount: -1,
        AirdropPlaneClassName: "",
        Loot: []
      };
      onCreateFile(fileName, template);
    } else if (spawnType === 'npc') {
      // Find next available integer ID for NPC
      let maxId = 0;
      entities.npcs.forEach(n => {
        const file = configs[n.filePath];
        if (file?.success && file.content.ID > maxId) {
          maxId = file.content.ID;
        }
      });
      const nextId = maxId + 1;
      const fileName = `ExpansionMod/Quests/NPCs/QuestNPC_${nextId}.json`;
      const template = {
        ConfigVersion: 6,
        ID: nextId,
        ClassName: npcClassName,
        Position: [spawnCoords.x, 0.0, spawnCoords.z],
        Orientation: [0.0, 0.0, 0.0],
        NPCName: spawnName.trim(),
        DefaultNPCText: "Hmm?",
        Waypoints: [],
        NPCEmoteID: 46,
        NPCEmoteIsStatic: 0,
        NPCLoadoutFile: "NBCLoadout",
        NPCInteractionEmoteID: 1,
        NPCQuestCancelEmoteID: 60,
        NPCQuestStartEmoteID: 58,
        NPCQuestCompleteEmoteID: 39,
        NPCFaction: "InvincibleObservers",
        NPCType: 0,
        Active: 1
      };
      onCreateFile(fileName, template);
    } else if (spawnType === 'safezone') {
      // Append to SafeZoneSettings CircleZones array
      const filePath = 'expansion/settings/SafeZoneSettings.json';
      const file = configs[filePath];
      if (file?.success) {
        const currentZones = Array.isArray(file.content.CircleZones) ? file.content.CircleZones : [];
        const newZone = {
          Center: [spawnCoords.x, 0.0, spawnCoords.z],
          Radius: Number(spawnRadius),
          Name: spawnName.trim()
        };
        onChangeField(filePath, ['CircleZones'], [...currentZones, newZone]);
      }
    } else if (spawnType === 'nogo_area') {
      // Append to AILocationSettings.json NoGoAreas array
      const filePath = 'expansion/settings/AILocationSettings.json';
      const file = configs[filePath];
      if (file?.success && file.content) {
        const currentAreas = Array.isArray(file.content.NoGoAreas) ? file.content.NoGoAreas : [];
        const newArea = {
          Name: spawnName.trim(),
          Position: [spawnCoords.x, 0.0, spawnCoords.z],
          Radius: Number(spawnRadius)
        };
        onChangeField(filePath, ['NoGoAreas'], [...currentAreas, newArea]);
      } else {
        alert("AILocationSettings.json is missing or corrupt!");
      }
    } else if (spawnType === 'roaming_location') {
      // Append to AILocationSettings.json RoamingLocations array
      const filePath = 'expansion/settings/AILocationSettings.json';
      const file = configs[filePath];
      if (file?.success && file.content) {
        const currentLocs = Array.isArray(file.content.RoamingLocations) ? file.content.RoamingLocations : [];
        const newLoc = {
          Name: spawnName.trim(),
          Position: [spawnCoords.x, 0.0, spawnCoords.z],
          Radius: Number(spawnRadius),
          Type: 'Village',
          Enabled: 1
        };
        onChangeField(filePath, ['RoamingLocations'], [...currentLocs, newLoc]);
      } else {
        alert("AILocationSettings.json is missing or corrupt!");
      }
    } else if (spawnType === 'traderzone') {
      // Create traderzone JSON file
      const fileName = `expansion/traderzones/${spawnName.trim().replace(/\s+/g, '_')}.json`;
      const template = {
        m_Version: 6,
        m_DisplayName: spawnName.trim(),
        Position: [spawnCoords.x, 0.0, spawnCoords.z],
        Radius: Number(spawnRadius),
        BuyPricePercent: 100.0,
        SellPricePercent: -1.0,
        Stock: {}
      };
      onCreateFile(fileName, template);
    }

    setShowSpawnModal(false);
  };

  // Center view on entity from Sidebar click
  const handleLocateEntity = (entity) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;

    const mapPxSize = 1024;
    const normX = entity.x / mapSize;
    const normY = 1 - (entity.z / mapSize);
    const mapPxX = normX * mapPxSize;
    const mapPxY = normY * mapPxSize;

    setScale(2.5); // zoom in
    setOffset({
      x: canvasCenterX - mapPxX * 2.5,
      y: canvasCenterY - mapPxY * 2.5
    });

    setHoveredEntity(entity);
  };

  // Gather and filter all list items for map sidebar index
  const allListItems = [
    ...entities.airdrops,
    ...entities.npcs,
    ...entities.safezones,
    ...entities.traderzones,
    ...entities.patrols,
    ...(entities.questObjectives || []),
    ...(entities.nogoareas || []),
    ...(entities.roamingLocations || [])
  ].filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Map Search Sidebar index */}
      <div style={{ 
        width: '280px', 
        background: 'var(--bg-secondary)', 
        borderRight: '1px solid var(--border-color)', 
        display: 'flex', 
        flexDirection: 'column',
        userSelect: 'none'
      }}>
        {/* Layer checkboxes HUD */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '8px' }}>
            // {t('map_grid_presets')}
          </div>
          <select 
            value={isCustomPreset ? 'custom' : mapSize} 
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'custom') {
                setIsCustomPreset(true);
                const num = Number(customSizeStr) || 10000;
                setMapSize(num);
              } else {
                setIsCustomPreset(false);
                setMapSize(Number(val));
              }
            }}
            style={{ marginBottom: '12px' }}
          >
            {MAP_PRESETS.map(p => (
              <option key={p.name} value={p.size}>{p.name}</option>
            ))}
            <option value="custom">{t('map_custom_size_opt')}</option>
          </select>

          {isCustomPreset && (
            <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('map_custom_size_label')}</label>
              <input 
                type="number"
                value={customSizeStr}
                onChange={(e) => {
                  setCustomSizeStr(e.target.value);
                  const num = Number(e.target.value);
                  if (num > 0) {
                    setMapSize(num);
                  }
                }}
                style={{ fontSize: '12px', padding: '6px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-glow)', width: '100%' }}
              />
            </div>
          )}

          <label className="btn btn-accent" style={{ display: 'inline-flex', width: '100%', padding: '8px 12px', fontSize: '11px', justifyContent: 'center', cursor: 'pointer', marginBottom: '12px', textAlign: 'center' }}>
            {t('map_load_custom')}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleCustomMapUpload} 
              style={{ display: 'none' }} 
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => {
                  setIsRulerActive(!isRulerActive);
                  setRulerPoints(null);
                  setIsSafezoneDrawing(false);
                  setSafezoneDrawCenter(null);
                }}
                className="btn"
                style={{ 
                  flex: 1,
                  padding: '6px 12px', 
                  fontSize: '10px', 
                  fontWeight: 'bold',
                  justifyContent: 'center',
                  borderColor: isRulerActive ? '#2ebd59' : 'var(--border-color)',
                  background: isRulerActive ? 'rgba(46, 189, 89, 0.15)' : 'transparent',
                  color: isRulerActive ? '#2ebd59' : 'var(--text-primary)'
                }}
              >
                📏 {isRulerActive ? t('map_measure_on') : t('map_measure_btn')}
              </button>
              {isRulerActive && rulerPoints && (
                <button 
                  onClick={() => setRulerPoints(null)}
                  className="btn btn-danger"
                  style={{ padding: '6px 8px', fontSize: '10px' }}
                >
                  {t('modal_confirm_cancel')}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setIsSafezoneDrawing(!isSafezoneDrawing);
                  setSafezoneDrawCenter(null);
                  setIsRulerActive(false);
                  setRulerPoints(null);
                }}
                className="btn"
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  justifyContent: 'center',
                  borderColor: isSafezoneDrawing ? '#559655' : 'var(--border-color)',
                  background: isSafezoneDrawing ? 'rgba(85, 150, 85, 0.15)' : 'transparent',
                  color: isSafezoneDrawing ? '#559655' : 'var(--text-primary)'
                }}
              >
                🛡️ {isSafezoneDrawing ? t('map_draw_safezone_mode') + " (ON)" : t('map_draw_safezone_mode')}
              </button>
              {isSafezoneDrawing && safezoneDrawCenter && (
                <button
                  onClick={() => {
                    setSafezoneDrawCenter(null);
                  }}
                  className="btn btn-danger"
                  style={{ padding: '6px 8px', fontSize: '10px' }}
                >
                  {t('modal_confirm_cancel')}
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '8px' }}>
            // {t('map_layer_overlays')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: 'AIR', key: 'airdrops', color: '#ebd667' },
              { label: 'SAFE', key: 'safezones', color: '#559655' },
              { label: 'P2P', key: 'traders', color: '#44aacc' },
              { label: 'NPC', key: 'npcs', color: '#a6f5a6' },
              { label: 'AI', key: 'patrols', color: 'var(--text-primary)' },
              { label: 'QUEST', key: 'questObjectives', color: '#c084fc' },
              { label: 'NOGO', key: 'nogoareas', color: '#cc4a4a' },
              { label: 'ROAMING', key: 'roamingLocations', color: '#ff9f43' }
            ].map(l => {
              let count = 0;
              if (l.key === 'patrols') {
                count = new Set(entities.patrols.map(wp => wp.patrolIdx)).size;
              } else {
                count = entities[l.key]?.length || 0;
              }
              
              return (
                <button 
                  key={l.key}
                  onClick={() => setLayers(prev => ({ ...prev, [l.key]: !prev[l.key] }))}
                  className="btn"
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '9px',
                    background: layers[l.key] ? 'rgba(30,50,30,0.4)' : 'transparent',
                    borderColor: layers[l.key] ? l.color : 'var(--border-color)',
                    color: layers[l.key] ? l.color : 'var(--text-secondary)'
                  }}
                >
                  {l.label} ({count})
                </button>
              );
            })}
          </div>

          {layers.patrols && (
            <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '8px' }}>
                // {t('map_ai_patrol_routing')}
              </div>
              
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('map_select_active_patrol')}</label>
                <select
                  value={activePatrolDrawIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setActivePatrolDrawIndex(idx);
                    if (idx === -1) {
                      setIsDrawModeActive(false);
                    }
                  }}
                  style={{ fontSize: '11px', padding: '4px', width: '100%' }}
                >
                  <option value={-1}>-- {t('map_select_patrol_ph')} --</option>
                  {(configs['expansion/settings/AIPatrolSettings.json']?.content?.Patrols || []).map((patrol, idx) => (
                    <option key={idx} value={idx}>
                      #{idx + 1}: {patrol.Name || `Patrol #${idx + 1}`} ({patrol.Faction})
                    </option>
                  ))}
                </select>
              </div>

              {activePatrolDrawIndex !== -1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsDrawModeActive(!isDrawModeActive)}
                    className="btn"
                    style={{
                      padding: '6px 12px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      justifyContent: 'center',
                      borderColor: isDrawModeActive ? '#ebd667' : 'var(--border-color)',
                      background: isDrawModeActive ? 'rgba(235, 214, 103, 0.15)' : 'transparent',
                      color: isDrawModeActive ? '#ebd667' : 'var(--text-primary)'
                    }}
                  >
                    {isDrawModeActive ? '✍️ ' + t('map_draw_wp_active') : '✍️ ' + t('map_draw_wp')}
                  </button>

                  <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', marginTop: '4px', paddingTop: '8px' }}>
                    <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('map_merge_patrol_route')}</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <select
                        value={mergeTargetPatrolIndex}
                        onChange={(e) => setMergeTargetPatrolIndex(Number(e.target.value))}
                        style={{ fontSize: '11px', padding: '4px', flex: 1, minWidth: 0 }}
                      >
                        <option value={-1}>-- {t('map_merge_with')} --</option>
                        {(configs['expansion/settings/AIPatrolSettings.json']?.content?.Patrols || [])
                          .map((patrol, idx) => ({ patrol, idx }))
                          .filter(({ idx }) => idx !== activePatrolDrawIndex)
                          .map(({ patrol, idx }) => (
                            <option key={idx} value={idx}>
                              #{idx + 1}: {patrol.Name || `Patrol #${idx + 1}`}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleMergePatrols}
                        disabled={mergeTargetPatrolIndex === -1}
                        className="btn btn-accent"
                        style={{ padding: '4px 8px', fontSize: '10px', opacity: mergeTargetPatrolIndex === -1 ? 0.5 : 1 }}
                      >
                        {t('map_merge_btn')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ position: 'relative' }}>

            <input
              type="text"
              placeholder={t('map_search_placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: '11px', padding: '6px 20px 6px 20px' }}
            />
            <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '10px' }}>▶</span>
          </div>
        </div>

        {/* Collapsible Excluded Buildings list */}
        {layers.roamingLocations && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <div 
              onClick={() => setExcludeCollapse(!excludeCollapse)}
              style={{ 
                fontSize: '10px', 
                color: 'var(--text-glow)', 
                fontWeight: 'bold', 
                cursor: 'pointer',
                display: 'flex', 
                justifyContent: 'space-between',
                letterSpacing: '1px'
              }}
            >
              <span>📁 {t('map_excluded_buildings')} ({configs['expansion/settings/AILocationSettings.json']?.content?.ExcludedRoamingBuildings?.length || 0})</span>
              <span>{excludeCollapse ? '▼' : '►'}</span>
            </div>
            
            {!excludeCollapse && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '4px', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                  {(configs['expansion/settings/AILocationSettings.json']?.content?.ExcludedRoamingBuildings || []).length === 0 ? (
                    <div style={{ fontSize: '10px', color: 'var(--text-dark)', padding: '4px', textAlign: 'center' }}>{t('map_no_exclusions')}</div>
                  ) : (
                    (configs['expansion/settings/AILocationSettings.json']?.content?.ExcludedRoamingBuildings || []).map((b, bIdx) => (
                      <div key={bIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', flex: 1, marginRight: '4px' }}>{b}</span>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => {
                            const filePath = 'expansion/settings/AILocationSettings.json';
                            const file = configs[filePath];
                            const current = [...(file.content.ExcludedRoamingBuildings || [])];
                            current.splice(bIdx, 1);
                            onChangeField(filePath, ['ExcludedRoamingBuildings'], current);
                          }} 
                          style={{ padding: '0 4px', fontSize: '8px', lineHeight: '1.2' }}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="text" 
                    placeholder={t('map_exclude_placeholder')} 
                    value={newExcludeInput}
                    onChange={e => setNewExcludeInput(e.target.value)}
                    style={{ fontSize: '10px', padding: '4px 6px', flex: 1 }}
                  />
                  <button 
                    className="btn btn-accent" 
                    onClick={() => {
                      if (!newExcludeInput.trim()) return;
                      const filePath = 'expansion/settings/AILocationSettings.json';
                      const file = configs[filePath];
                      const current = [...(file?.content?.ExcludedRoamingBuildings || [])];
                      if (!current.includes(newExcludeInput.trim())) {
                        onChangeField(filePath, ['ExcludedRoamingBuildings'], [...current, newExcludeInput.trim()]);
                      }
                      setNewExcludeInput('');
                    }}
                    style={{ padding: '4px 8px', fontSize: '10px' }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scrollable list of indices */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {allListItems.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center' }}>
              {t('map_no_entities_plotted')}
            </div>
          ) : (
            allListItems.map((item, idx) => {
              let labelColor = 'var(--text-primary)';
              if (item.type === 'airdrop') labelColor = '#ebd667';
              else if (item.type === 'safezone' || item.type === 'safezone_cylinder') labelColor = '#559655';
              else if (item.type === 'traderzone') labelColor = '#44aacc';
              else if (item.type === 'npc') labelColor = '#a6f5a6';
              else if (item.type === 'quest_objective') labelColor = '#c084fc';
              else if (item.type === 'roaming_location') labelColor = '#ff9f43';
              else if (item.type === 'nogo_area') labelColor = '#cc4a4a';

              return (
                <div
                  key={`${item.type}-${idx}`}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(30, 48, 30, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(149, 192, 149, 0.03)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div 
                    onClick={() => handleLocateEntity(item)}
                    style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', color: labelColor }}>
                      {item.name}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {item.type.toUpperCase()} · ({Math.round(item.x)}, {Math.round(item.z)})
                    </span>
                  </div>
                  
                  {/* Delete button directly in panel */}
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteEntity(item)}
                    style={{ padding: '2px 6px', fontSize: '9px', fontFamily: 'monospace' }}
                  >
                    {t('map_del_btn')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Interactive Map canvas */}
      <div ref={containerRef} className="map-canvas-container" style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          style={{ display: 'block', width: '100%', height: '100%', cursor: isPanning ? 'grabbing' : 'default' }}
        />

        {/* Floating Controls / HUD Overlay */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(7,9,7,0.85)',
          border: '1px solid var(--border-color)',
          padding: '6px 12px',
          borderRadius: '2px',
          color: 'var(--text-glow)',
          fontSize: '11px',
          display: 'flex',
          gap: '12px',
          pointerEvents: 'none'
        }}>
          <div>X: {mouseCoords.x}</div>
          <div>Z: {mouseCoords.z}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{t('map_double_click_spawn')}</div>
        </div>

        {/* Selected Entity Inspector Panel / Hovered Tooltip */}
        {selectedEntity ? (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'rgba(7,9,7,0.92)',
            border: '2px solid var(--border-color)',
            padding: '16px',
            borderRadius: '2px',
            width: '280px',
            boxShadow: 'var(--shadow-glow)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            zIndex: 99
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '9px', color: 'var(--text-glow)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                // {t('map_inspect_selected')}
              </div>
              <button 
                onClick={() => setSelectedEntity(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', padding: 0 }}
              >
                ×
              </button>
            </div>

            {selectedEntity.type === 'roaming_location' ? (
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '9px' }}>{t('map_settlement_name')}</label>
                <input 
                  type="text" 
                  value={selectedEntity.name} 
                  onChange={e => handleUpdateSelectedField('Name', e.target.value)}
                  style={{ padding: '4px 6px', fontSize: '11px' }}
                />
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', color: 'var(--text-glow)', fontSize: '14px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {selectedEntity.name}
              </div>
            )}

            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              {t('map_type_label') || "TYPE"}: <span style={{ color: 'var(--text-primary)' }}>{selectedEntity.type.toUpperCase()}</span>
            </div>

             {/* Manual Coordinates inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '9px' }}>{t('map_x_coord')}</label>
                <input 
                  type="number" 
                  step="any"
                  value={selectedEntity.x} 
                  onChange={e => handleUpdateSelectedCoord('x', e.target.value)} 
                  style={{ padding: '4px', fontSize: '11px', textAlign: 'center' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '9px' }}>{t('map_z_coord')}</label>
                <input 
                  type="number" 
                  step="any"
                  value={selectedEntity.z} 
                  onChange={e => handleUpdateSelectedCoord('z', e.target.value)} 
                  style={{ padding: '4px', fontSize: '11px', textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Copy Vector Button */}
            <button 
              onClick={() => {
                const vecStr = `[${Number(selectedEntity.x).toFixed(1)}, 0.0, ${Number(selectedEntity.z).toFixed(1)}]`;
                navigator.clipboard.writeText(vecStr)
                  .then(() => alert(`Copied DayZ Vector ${vecStr} to clipboard!`))
                  .catch(err => console.error("Clipboard copy failed", err));
              }}
              className="btn"
              style={{ 
                padding: '4px 8px', 
                fontSize: '10px', 
                justifyContent: 'center', 
                fontFamily: 'var(--font-mono)',
                borderColor: 'var(--border-color)',
                marginTop: '2px'
              }}
            >
              📋 {t('map_copy_vector')}
            </button>

            {/* Roaming Specific Fields */}
            {selectedEntity.type === 'roaming_location' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>{t('map_zone_radius_label')}</label>
                    <input 
                      type="number" 
                      value={selectedEntity.radius} 
                      onChange={e => handleUpdateSelectedField('Radius', Number(e.target.value))}
                      style={{ padding: '4px', fontSize: '11px', textAlign: 'center' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>{t('map_type_label')}</label>
                    <select 
                      value={selectedEntity.locationType} 
                      onChange={e => handleUpdateSelectedField('Type', e.target.value)}
                      style={{ padding: '4px', fontSize: '11px' }}
                    >
                      <option value="Village">Village</option>
                      <option value="City">City</option>
                      <option value="Military">Military</option>
                      <option value="Industrial">Industrial</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: '2px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedEntity.enabled === 1}
                      onChange={e => handleUpdateSelectedField('Enabled', e.target.checked ? 1 : 0)}
                    />
                    <span>{t('map_location_enabled')}</span>
                  </label>
                </div>
              </>
            )}

            {/* Deletion & Transition Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button 
                className="btn btn-accent"
                onClick={() => {
                  if (selectedEntity.type === 'quest_objective') {
                    if (selectedEntity.questId) {
                      onSelectQuest(selectedEntity.questId);
                      setActiveTab('quests');
                    } else {
                      alert("Quest objective is orphaned.");
                    }
                  } else if (selectedEntity.type === 'patrol_waypoint') {
                    setActiveTab('aibots');
                  } else if (selectedEntity.filePath) {
                    onOpenFile(selectedEntity.filePath);
                  }
                }}
                style={{ flex: 1.2, justifyContent: 'center', padding: '6px', fontSize: '11px', whiteSpace: 'nowrap' }}
              >
                {t('map_more_settings')}
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => handleDeleteEntity(selectedEntity)}
                style={{ flex: 0.8, justifyContent: 'center', padding: '6px', fontSize: '11px' }}
              >
                {t('config_delete')}
              </button>
            </div>
          </div>
        ) : hoveredEntity ? (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'rgba(7,9,7,0.88)',
            border: '1px solid var(--border-color)',
            padding: '10px 12px',
            borderRadius: '2px',
            minWidth: '220px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            pointerEvents: 'none'
          }}>
            <div style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>// {t('map_hovered_entity')}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', color: 'var(--text-glow)', fontSize: '12px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {hoveredEntity.name}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-primary)' }}>
              {t('map_type_label') || "TYPE"}: {hoveredEntity.type.toUpperCase()}<br />
              COORDS: {Math.round(hoveredEntity.x)}, {Math.round(hoveredEntity.z)}
            </div>
          </div>
        ) : null}

        {/* Spawn Modal Overlay */}
        {showSpawnModal && (
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}>
            <form 
              onSubmit={handleSpawnSubmit}
              style={{
                background: 'var(--bg-secondary)',
                border: '2px solid var(--border-color)',
                borderRadius: '2px',
                padding: '24px',
                width: '380px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '2px' }}>// {t('map_spawn_new_entity')}</div>
                <h3 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>{t('map_create_map_point')}</h3>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                COORDINATES: X = {spawnCoords.x}, Z = {spawnCoords.z}
              </div>

              <div className="form-group">
                <label>{t('map_spawn_modal_type')}</label>
                <select 
                  value={spawnType} 
                  onChange={e => setSpawnType(e.target.value)}
                >
                  <option value="airdrop">{t('map_opt_airdrop')}</option>
                  <option value="npc">{t('map_opt_npc')}</option>
                  <option value="safezone">{t('map_opt_safezone')}</option>
                  <option value="traderzone">{t('map_opt_trader')}</option>
                  <option value="nogo_area">{t('map_opt_nogo')}</option>
                  <option value="roaming_location">{t('map_opt_roaming')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('map_spawn_modal_name')}</label>
                <input
                  type="text"
                  required
                  value={spawnName}
                  onChange={e => setSpawnName(e.target.value)}
                  placeholder="ENTER UNIQUE NAME..."
                />
              </div>

              {spawnType === 'npc' ? (
                <div className="form-group">
                  <label>{t('map_spawn_modal_npc_class')}</label>
                  <input
                    type="text"
                    required
                    value={npcClassName}
                    onChange={e => setNpcClassName(e.target.value)}
                    placeholder="e.g. ExpansionQuestNPCDenis"
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>{t('map_spawn_modal_radius')}</label>
                  <input
                    type="number"
                    required
                    value={spawnRadius}
                    onChange={e => setSpawnRadius(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="submit" className="btn btn-accent" style={{ flex: 1, justifyContent: 'center' }}>{t('map_spawn_modal_btn')}</button>
                <button type="button" className="btn" onClick={() => setShowSpawnModal(false)} style={{ flex: 1, justifyContent: 'center' }}>{t('modal_confirm_cancel')}</button>
              </div>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
