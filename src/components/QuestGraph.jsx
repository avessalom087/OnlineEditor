import React, { useState, useEffect, useRef } from 'react';
import AutocompleteInput from './shared/AutocompleteInput';
import { translations } from '../utils/localization';

// Topological sorting layer layout for quest nodes
function layoutQuests(quests, nodeOffsets) {
  const nodeMap = new Map(quests.map(q => [q.id, q]));
  const layers = {};
  const visited = new Set();
  const nodeLayers = {};

  // Find layer for each node recursively
  function getLayer(questId) {
    if (visited.has(questId)) {
      return nodeLayers[questId] || 0;
    }
    
    const quest = nodeMap.get(questId);
    if (!quest) return 0;
    
    visited.add(questId);

    // If there are no prerequisites, it's layer 0
    if (!quest.preQuestIDs || quest.preQuestIDs.length === 0) {
      nodeLayers[questId] = 0;
      return 0;
    }

    // Otherwise, it's 1 + max layer of prerequisites
    let maxParentLayer = -1;
    for (const parentId of quest.preQuestIDs) {
      const parentLayer = getLayer(parentId);
      if (parentLayer > maxParentLayer) {
        maxParentLayer = parentLayer;
      }
    }
    
    const layer = maxParentLayer + 1;
    nodeLayers[questId] = layer;
    return layer;
  }

  // Calculate layers
  quests.forEach(q => getLayer(q.id));

  // Group nodes by layer
  quests.forEach(q => {
    const layer = nodeLayers[q.id] || 0;
    if (!layers[layer]) layers[layer] = [];
    layers[layer].push(q);
  });

  // Calculate coordinates
  const nodes = [];
  const colWidth = 300;
  const rowHeight = 130;

  Object.keys(layers).forEach(layerKey => {
    const colIdx = parseInt(layerKey);
    const colNodes = layers[layerKey];
    
    colNodes.forEach((node, rowIdx) => {
      // Base coordinates from auto-layout
      let x = colIdx * colWidth + 50;
      let y = rowIdx * rowHeight + 50;

      // Add manual offset if dragged
      if (nodeOffsets[node.id]) {
        x += nodeOffsets[node.id].x;
        y += nodeOffsets[node.id].y;
      }

      nodes.push({
        ...node,
        x,
        y,
        width: 220,
        height: 80
      });
    });
  });

  return nodes;
}

// Objective Type Mapping info
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

// Simple Autocomplete block for reuse inside Quest Editor (optimized via off-thread Web Worker in AutocompleteInput)
function ItemAutocomplete({ suggestions, onAdd, label = "Add item", placeholder = "Type ClassName..." }) {
  return (
    <AutocompleteInput 
      suggestions={suggestions} 
      placeholder={placeholder} 
      onSelect={onAdd} 
      buttonLabel={label} 
    />
  );
}

export default function QuestGraph({ 
  configs, 
  onChangeField, 
  onOpenFile, 
  onCreateFile, 
  onDeleteFile,
  onNavigateToMap,
  selectedQuestId,
  onSelectQuest,
  xmlItems = [],
  lang = 'ru'
}) {
  const containerRef = useRef(null);

  const t = (key, replacements = {}) => {
    let text = translations[lang]?.[key] || translations['en']?.[key] || key;
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
    return text;
  };

  // Canvas pan & zoom states
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drag offsets for individual node positioning
  const [nodeOffsets, setNodeOffsets] = useState({});
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Drag connection line state
  const [connectionDrag, setConnectionDrag] = useState(null);

  // Selected entities
  const [quests, setQuests] = useState([]);
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [activeAccordion, setActiveAccordion] = useState('general'); // general, npc, flow, items, objectives

  // Modal editor for Objective details
  const [editingObjective, setEditingObjective] = useState(null); // { objective, filePath }

  // Autocomplete suggestions
  const [classnameSuggestions, setClassnameSuggestions] = useState([]);

  // Sync selectedQuestId from parent
  useEffect(() => {
    if (selectedQuestId !== null && selectedQuestId !== undefined) {
      const found = quests.find(q => q.id === selectedQuestId);
      if (found) {
        setSelectedQuest(found);
      }
    }
  }, [selectedQuestId, quests]);

  // Load NPCs list for checkboxes
  const npcsList = [];
  Object.entries(configs).forEach(([p, file]) => {
    if (file.success && file.content && p.toLowerCase().startsWith('expansionmod/quests/npcs/questnpc_') && file.content.ID !== undefined) {
      npcsList.push({
        id: file.content.ID,
        name: file.content.NPCName || `NPC #${file.content.ID}`,
        className: file.content.ClassName
      });
    }
  });
  npcsList.sort((a, b) => a.id - b.id);

  // Sidebar resizing states & handlers
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const isResizingRef = useRef(false);

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  };

  const handleResizeMouseMove = (e) => {
    if (!isResizingRef.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 280 && newWidth < 800) {
      setSidebarWidth(newWidth);
    }
  };

  const handleResizeMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMouseMove);
      document.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, []);

  // Scan configs on mount and when changes occur to assemble quests list
  useEffect(() => {
    const questList = [];
    const classnames = new Set();

    for (const [filePath, file] of Object.entries(configs)) {
      if (!file.success || !file.content) continue;
      const content = file.content;
      
      // Load Quests
      if (filePath.toLowerCase().startsWith('expansionmod/quests/quests/quest_') && content.ID !== undefined) {
        questList.push({
          id: content.ID,
          title: content.Title || `Quest #${content.ID}`,
          followUpQuest: content.FollowUpQuest || 0,
          preQuestIDs: Array.isArray(content.PreQuestIDs) ? content.PreQuestIDs : [],
          giverIDs: Array.isArray(content.QuestGiverIDs) ? content.QuestGiverIDs : [],
          turnInIDs: Array.isArray(content.QuestTurnInIDs) ? content.QuestTurnInIDs : [],
          description: content.Descriptions ? content.Descriptions[0] : '',
          objectives: Array.isArray(content.Objectives) ? content.Objectives : [],
          filePath
        });
      }

      // Collect Classnames for autocompletes
      if (Array.isArray(content.Items)) {
        content.Items.forEach(i => i.ClassName && classnames.add(i.ClassName));
      }
      if (content.StartingClothing) {
        ['Tops', 'Pants', 'Shoes', 'Backpacks'].forEach(k => {
          if (Array.isArray(content.StartingClothing[k])) {
            content.StartingClothing[k].forEach(item => classnames.add(item));
          }
        });
      }
    }
    
    xmlItems.forEach(item => classnames.add(item));
    
    questList.sort((a, b) => a.id - b.id);
    setQuests(questList);
    setClassnameSuggestions(Array.from(classnames).sort());

    if (selectedQuest) {
      const updatedSelected = questList.find(q => q.id === selectedQuest.id);
      if (updatedSelected) {
        setSelectedQuest(updatedSelected);
      }
    }
  }, [configs]);

  const positionedNodes = layoutQuests(quests, nodeOffsets);
  const nodesMap = new Map(positionedNodes.map(n => [n.id, n]));

  // Pan Canvas Handlers
  const getSVGCoords = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    return {
      x: (clientX - panOffset.x) / zoom,
      y: (clientY - panOffset.y) / zoom
    };
  };

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'svg' || e.target.id === 'grid-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (draggedNode !== null) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;

      setNodeOffsets(prev => ({
        ...prev,
        [draggedNode]: {
          x: (prev[draggedNode]?.x || 0) + dx,
          y: (prev[draggedNode]?.y || 0) + dy
        }
      }));

      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (connectionDrag !== null) {
      const coords = getSVGCoords(e);
      setConnectionDrag(prev => prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null);
      return;
    }
  };

  const handleMouseUp = (e) => {
    setIsPanning(false);
    setDraggedNode(null);

    if (connectionDrag !== null) {
      const dropCoords = getSVGCoords(e);
      let targetNode = null;

      for (const node of positionedNodes) {
        if (node.id === connectionDrag.fromNodeId) continue;
        const portX = node.x;
        const portY = node.y + node.height / 2;
        const dist = Math.hypot(portX - dropCoords.x, portY - dropCoords.y);
        if (dist <= 25) { // Collision threshold of 25px
          targetNode = node;
          break;
        }
      }

      if (targetNode) {
        // Node A = connectionDrag.fromNodeId, Node B = targetNode.id
        // 1. Set Node A as prerequisite of Node B
        const targetPre = targetNode.preQuestIDs || [];
        if (!targetPre.includes(connectionDrag.fromNodeId)) {
          onChangeField(targetNode.filePath, ['PreQuestIDs'], [...targetPre, connectionDrag.fromNodeId]);
        }

        // 2. Set Node B as follow-up of Node A
        const sourceNode = positionedNodes.find(n => n.id === connectionDrag.fromNodeId);
        if (sourceNode) {
          onChangeField(sourceNode.filePath, ['FollowUpQuest'], targetNode.id);
        }
      }

      setConnectionDrag(null);
    }
  };

  // Global wheel Zoom listener with mouse centering and passive: false override
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelRaw = (e) => {
      e.preventDefault();
      const zoomFactor = 1.08;
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let newZoom = zoom;
      if (e.deltaY < 0) {
        newZoom = Math.min(zoom * zoomFactor, 3.0);
      } else {
        newZoom = Math.max(zoom / zoomFactor, 0.2);
      }

      if (newZoom !== zoom) {
        const newOffsetX = mouseX - (mouseX - panOffset.x) * (newZoom / zoom);
        const newOffsetY = mouseY - (mouseY - panOffset.y) * (newZoom / zoom);
        
        setZoom(newZoom);
        setPanOffset({ x: newOffsetX, y: newOffsetY });
      }
    };

    container.addEventListener('wheel', handleWheelRaw, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelRaw);
    };
  }, [zoom, panOffset]);

  const handleNodeDragStart = (e, nodeId) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setDraggedNode(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // RELATIONSHIP MODIFICATIONS
  const handleAddPrereq = (targetQuestId) => {
    if (!selectedQuest) return;
    const currentPre = selectedQuest.preQuestIDs;
    if (currentPre.includes(targetQuestId) || targetQuestId === selectedQuest.id) return;
    onChangeField(selectedQuest.filePath, ['PreQuestIDs'], [...currentPre, targetQuestId]);
  };

  const handleRemovePrereq = (targetQuestId) => {
    if (!selectedQuest) return;
    const currentPre = selectedQuest.preQuestIDs.filter(id => id !== targetQuestId);
    onChangeField(selectedQuest.filePath, ['PreQuestIDs'], currentPre);
  };

  const handleSetFollowup = (followUpId) => {
    if (!selectedQuest) return;
    onChangeField(selectedQuest.filePath, ['FollowUpQuest'], followUpId);
  };

  // QUEST CREATION & DELETION
  const handleCreateQuest = () => {
    const nextId = quests.length > 0 ? Math.max(...quests.map(q => q.id)) + 1 : 1;
    const newQuestTemplate = {
      ConfigVersion: 22,
      ID: nextId,
      Type: 1,
      Title: `Quest #${nextId}`,
      Descriptions: [
        "Quest dialog start text.",
        "Quest progress details.",
        "Quest turn-in description."
      ],
      ObjectiveText: "Complete quest objective.",
      FollowUpQuest: -1,
      Repeatable: 0,
      IsDailyQuest: 0,
      IsWeeklyQuest: 0,
      CancelQuestOnPlayerDeath: 0,
      Autocomplete: 0,
      IsGroupQuest: 0,
      ObjectSetFileName: "",
      QuestItems: [],
      Rewards: [],
      NeedToSelectReward: 0,
      RandomReward: 0,
      RandomRewardAmount: -1,
      RewardsForGroupOwnerOnly: 1,
      RewardBehavior: 0,
      QuestGiverIDs: [],
      QuestTurnInIDs: [],
      IsAchievement: 0,
      Objectives: [],
      QuestColor: 0,
      ReputationReward: 0,
      ReputationRequirement: -1,
      PreQuestIDs: [],
      RequiredFaction: "",
      FactionReward: "",
      PlayerNeedQuestItems: 1,
      DeleteQuestItems: 1,
      SequentialObjectives: 1,
      FactionReputationRequirements: {},
      FactionReputationRewards: {},
      SuppressQuestLogOnCompetion: 0,
      Active: 1
    };

    const filePath = `ExpansionMod/Quests/Quests/Quest_${nextId}.json`;
    onCreateFile(filePath, newQuestTemplate);
    setTimeout(() => {
      setSelectedQuest({
        id: nextId,
        title: newQuestTemplate.Title,
        followUpQuest: -1,
        preQuestIDs: [],
        giverIDs: [],
        turnInIDs: [],
        description: newQuestTemplate.Descriptions[0],
        objectives: [],
        filePath
      });
    }, 200);
  };

  const handleDeleteQuest = () => {
    if (!selectedQuest) return;
    if (window.confirm(`Are you sure you want to delete "${selectedQuest.title}" (ID ${selectedQuest.id})?\nThis will physically remove it from disk.`)) {
      
      // 1. Unlink references in other quests
      quests.forEach(q => {
        if (q.id === selectedQuest.id) return;
        if (q.followUpQuest === selectedQuest.id) {
          onChangeField(q.filePath, ['FollowUpQuest'], -1);
        }
        if (q.preQuestIDs.includes(selectedQuest.id)) {
          onChangeField(q.filePath, ['PreQuestIDs'], q.preQuestIDs.filter(id => id !== selectedQuest.id));
        }
      });

      // 2. Unlink & Delete orphaned objectives
      const questConfig = configs[selectedQuest.filePath]?.content;
      if (questConfig && Array.isArray(questConfig.Objectives)) {
        questConfig.Objectives.forEach(obj => {
          // Check if other quests reference this objective
          const isReferenced = quests.some(q => 
            q.id !== selectedQuest.id && 
            q.objectives.some(o => o.ID === obj.ID && o.ObjectiveType === obj.ObjectiveType)
          );
          if (!isReferenced) {
            const objPath = getObjectiveFilePath(obj.ObjectiveType, obj.ID);
            if (objPath) onDeleteFile(objPath);
          }
        });
      }

      // 3. Delete the quest file
      onDeleteFile(selectedQuest.filePath);
      setSelectedQuest(null);
    }
  };

  // OBJECTIVE CREATION & DELETION
  const handleAddObjective = (typeId) => {
    if (!selectedQuest) return;
    const questConfig = configs[selectedQuest.filePath]?.content;
    if (!questConfig) return;

    const folderName = OBJECTIVE_TYPES[typeId].folder;
    const prefix = OBJECTIVE_TYPES[typeId].prefix;

    // Find next ID for this objective type across ALL configs in state
    let maxId = 0;
    Object.keys(configs).forEach(filePath => {
      if (filePath.toLowerCase().startsWith(`expansionmod/quests/objectives/${folderName.toLowerCase()}/objective_${prefix.toLowerCase()}_`)) {
        const file = configs[filePath];
        if (file.success && file.content && file.content.ID !== undefined) {
          if (file.content.ID > maxId) maxId = file.content.ID;
        }
      }
    });
    const nextObjId = maxId + 1;

    // Default template depending on type
    let objTemplate = {
      ConfigVersion: 28,
      ID: nextObjId,
      ObjectiveType: Number(typeId),
      ObjectiveText: `Deliver/Kill/Reach objective #${nextObjId}`,
      TimeLimit: -1,
      Active: 1
    };

    if (Number(typeId) === 3) { // Travel
      objTemplate = {
        ...objTemplate,
        Position: [0.0, 0.0, 0.0],
        MaxDistance: 20.0,
        MarkerName: "Travel Destination",
        ShowDistance: 1,
        TriggerOnEnter: 1,
        TriggerOnExit: 0
      };
    } else if (Number(typeId) === 5) { // Delivery
      objTemplate = {
        ...objTemplate,
        Collections: [],
        ShowDistance: 1,
        AddItemsToNearbyMarketZone: 0,
        MaxDistance: 20.0,
        MarkerName: "Delivery Target"
      };
    } else if (Number(typeId) === 2) { // Target (Kill)
      objTemplate = {
        ...objTemplate,
        Position: [0.0, 0.0, 0.0],
        MaxDistance: -1.0,
        MinDistance: -1.0,
        Amount: 10,
        ClassNames: [],
        CountSelfKill: 0,
        AllowedWeapons: [],
        ExcludedClassNames: [],
        CountAIPlayers: 0,
        AllowedTargetFactions: [],
        AllowedDamageZones: []
      };
    } else if (Number(typeId) === 4) { // Collection
      objTemplate = {
        ...objTemplate,
        Collections: [],
        MaxDistance: 20.0,
        MarkerName: "Collection Target",
        ShowDistance: 1
      };
    }

    const objPath = getObjectiveFilePath(typeId, nextObjId);
    onCreateFile(objPath, objTemplate);

    // Link reference in quest file
    const newObjectiveRef = {
      ConfigVersion: 28,
      ID: nextObjId,
      ObjectiveType: Number(typeId)
    };
    onChangeField(selectedQuest.filePath, ['Objectives'], [...(questConfig.Objectives || []), newObjectiveRef]);
  };

  const handleRemoveObjective = (objIndex, objRef) => {
    if (!selectedQuest) return;
    const questConfig = configs[selectedQuest.filePath]?.content;
    if (!questConfig) return;

    if (window.confirm("Remove this objective from the quest?")) {
      const updatedObjs = [...(questConfig.Objectives || [])];
      updatedObjs.splice(objIndex, 1);
      onChangeField(selectedQuest.filePath, ['Objectives'], updatedObjs);

      // Check if orphaned
      const isReferenced = quests.some(q => 
        q.id !== selectedQuest.id && 
        q.objectives.some(o => o.ID === objRef.ID && o.ObjectiveType === objRef.ObjectiveType)
      );

      if (!isReferenced) {
        const objPath = getObjectiveFilePath(objRef.ObjectiveType, objRef.ID);
        if (objPath) {
          onDeleteFile(objPath);
        }
      }
    }
  };

  // RENDER HELPERS
  const activeQuestConfig = selectedQuest ? configs[selectedQuest.filePath]?.content : null;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Visual Canvas Workspace */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ 
          flex: 1, 
          height: '100%', 
          position: 'relative', 
          overflow: 'hidden', 
          background: '#040604',
          cursor: isPanning ? 'grabbing' : 'default',
          userSelect: 'none'
        }}
      >
        <svg style={{ width: '100%', height: '100%' }}>
          <rect id="grid-bg" width="100%" height="100%" fill="url(#grid)" />

          {/* Group wrapper containing pan and zoom transforms */}
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
            
            {/* Draw Relationship Lines */}
            {positionedNodes.map(node => {
              const lines = [];

              node.preQuestIDs.forEach(preId => {
                const parent = nodesMap.get(preId);
                if (parent) {
                  const startX = parent.x + parent.width;
                  const startY = parent.y + parent.height / 2;
                  const endX = node.x;
                  const endY = node.y + node.height / 2;
                  
                  const cp1X = startX + 50;
                  const cp1Y = startY;
                  const cp2X = endX - 50;
                  const cp2Y = endY;

                  lines.push(
                    <path
                      key={`prereq-${preId}-${node.id}`}
                      d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                      fill="none"
                      stroke="#44aacc"
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                      markerEnd="url(#arrow-prereq)"
                      opacity="0.65"
                    />
                  );
                }
              });

              if (node.followUpQuest > 0) {
                const child = nodesMap.get(node.followUpQuest);
                if (child) {
                  const startX = node.x + node.width;
                  const startY = node.y + node.height / 2;
                  const endX = child.x;
                  const endY = child.y + child.height / 2;

                  const cp1X = startX + 50;
                  const cp1Y = startY;
                  const cp2X = endX - 50;
                  const cp2Y = endY;

                  lines.push(
                    <path
                      key={`follow-${node.id}-${node.followUpQuest}`}
                      d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                      fill="none"
                      stroke="#b2fa9e"
                      strokeWidth="2"
                      markerEnd="url(#arrow-followup)"
                      opacity="0.8"
                    />
                  );
                }
              }

              return lines;
            })}

            {/* Draw Temporary Connection Line being dragged */}
            {connectionDrag && (
              <path
                d={`M ${connectionDrag.startX} ${connectionDrag.startY} C ${(connectionDrag.startX + connectionDrag.currentX) / 2} ${connectionDrag.startY}, ${(connectionDrag.startX + connectionDrag.currentX) / 2} ${connectionDrag.currentY}, ${connectionDrag.currentX} ${connectionDrag.currentY}`}
                fill="none"
                stroke="var(--warning-color)"
                strokeWidth="2.5"
                strokeDasharray="5,5"
                opacity="0.9"
              />
            )}

            {/* Draw Quest Cards */}
            {positionedNodes.map(node => {
              const isSelected = selectedQuest?.id === node.id;
              const hasUnsaved = JSON.stringify(configs[node.filePath]?.content) !== JSON.stringify(configs[node.filePath]?.originalContent);

              const questContent = configs[node.filePath]?.content;
              let headerColor = 'var(--accent-color)'; // Normal (Green)
              if (questContent) {
                if (questContent.IsDailyQuest === 1 || questContent.IsDailyQuest === true) {
                  headerColor = '#60a5fa'; // Daily (Blue)
                } else if (questContent.IsWeeklyQuest === 1 || questContent.IsWeeklyQuest === true) {
                  headerColor = '#c084fc'; // Weekly (Purple)
                } else if (questContent.IsAchievement === 1 || questContent.IsAchievement === true) {
                  headerColor = '#fb923c'; // Achievement (Orange)
                }
              }

              return (
                <g 
                  key={node.id} 
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                  onClick={() => { setSelectedQuest(node); if (onSelectQuest) onSelectQuest(node.id); }}
                  style={{ cursor: 'grab' }}
                >
                  <rect
                    width={node.width}
                    height={node.height}
                    rx="4"
                    fill={isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)'}
                    stroke={isSelected ? 'var(--text-glow)' : hasUnsaved ? 'var(--warning-color)' : 'var(--border-color)'}
                    strokeWidth={isSelected ? '2' : '1.5'}
                    style={{
                      filter: isSelected ? 'drop-shadow(0 0 6px rgba(178, 250, 158, 0.25))' : 'none',
                      transition: 'fill 0.15s, stroke 0.15s'
                    }}
                  />
                  <rect
                    width={node.width}
                    height="4"
                    rx="1"
                    fill={headerColor}
                  />
                  <rect x="8" y="10" width="26" height="18" rx="2" fill="var(--bg-primary)" stroke="var(--border-color)" />
                  <text x="21" y="22" textAnchor="middle" fill="var(--text-glow)" fontFamily="var(--font-mono)" fontSize="11px" fontWeight="bold">
                    {node.id}
                  </text>
                  <text x="42" y="22" fill={isSelected ? 'var(--text-glow)' : 'var(--text-primary)'} fontFamily="var(--font-heading)" fontWeight="700" fontSize="13px" letterSpacing="0.5px">
                    {node.title.length > 22 ? `${node.title.substring(0, 20)}...` : node.title}
                  </text>
                  <text x="10" y="46" fill="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize="10px">
                    {node.preQuestIDs.length > 0 ? `PRE: ${node.preQuestIDs.join(', ')}` : 'PRE: NONE'}
                  </text>
                  <text x="10" y="60" fill="var(--text-secondary)" fontFamily="var(--font-mono)" fontSize="10px">
                    {node.followUpQuest > 0 ? `NEXT: ID ${node.followUpQuest}` : 'NEXT: END OF LINE'}
                  </text>
                  {hasUnsaved && (
                    <circle cx={node.width - 12} cy="15" r="3" fill="var(--warning-color)" style={{ filter: 'drop-shadow(0 0 3px var(--warning-color))' }} />
                  )}

                  {/* Drag connection handles */}
                  {/* Left (input) port for Prerequisites */}
                  <circle
                    cx="0"
                    cy={node.height / 2}
                    r="5"
                    fill="var(--bg-primary)"
                    stroke="#44aacc"
                    strokeWidth="1.5"
                    style={{ cursor: 'crosshair', transition: 'r 0.15s' }}
                    title="Prerequisite Port"
                  />

                  {/* Right (output) port for Follow-ups */}
                  <circle
                    cx={node.width}
                    cy={node.height / 2}
                    r="5"
                    fill="var(--bg-primary)"
                    stroke="#b2fa9e"
                    strokeWidth="1.5"
                    style={{ cursor: 'crosshair', transition: 'r 0.15s' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const coords = getSVGCoords(e);
                      setConnectionDrag({
                        fromNodeId: node.id,
                        startX: node.x + node.width,
                        startY: node.y + node.height / 2,
                        currentX: coords.x,
                        currentY: coords.y
                      });
                    }}
                    title="Follow-up Port (Drag arrow to connect)"
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Zoom & Creation Actions */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          background: 'rgba(7,9,7,0.85)',
          border: '1px solid var(--border-color)',
          padding: '6px',
          borderRadius: '2px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <button className="btn btn-accent" onClick={handleCreateQuest} style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 'bold' }}>
            {t('quest_btn_create')}
          </button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-color)' }} />
          <button className="btn" onClick={() => setZoom(prev => Math.min(prev * 1.2, 3))} style={{ padding: '4px 8px', fontSize: '12px' }}>+</button>
          <button className="btn" onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.3))} style={{ padding: '4px 8px', fontSize: '12px' }}>-</button>
          <button className="btn" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} style={{ padding: '4px 8px', fontSize: '11px' }}>{t('config_reset')}</button>
        </div>
      </div>

      {/* Quest Editor Side Panel */}
      {selectedQuest && activeQuestConfig && (
        <div style={{
          width: `${sidebarWidth}px`,
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative'
        }}>
          
          {/* Resize Drag Handle */}
          <div 
            onMouseDown={handleResizeMouseDown}
            style={{
              width: '6px',
              cursor: 'ew-resize',
              background: 'transparent',
              position: 'absolute',
              top: 0,
              left: -3,
              bottom: 0,
              zIndex: 99,
              transition: 'background 0.15s'
            }}
            onMouseOver={e => e.target.style.background = 'var(--text-primary)'}
            onMouseOut={e => e.target.style.background = 'transparent'}
          />
          
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: 'bold' }}>// {t('quest_editor_title')} (ID {selectedQuest.id})</div>
              <h3 style={{ margin: '2px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '16px' }}>{activeQuestConfig.Title}</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteQuest}
                style={{ padding: '4px 8px', fontSize: '10px' }}
                title={t('quest_delete_tooltip')}
              >
                {t('config_delete')}
              </button>
              <button 
                onClick={() => setSelectedQuest(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '18px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Configuration Form Accordions */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Direct Hop to raw editor */}
            <button className="btn" onClick={() => onOpenFile(selectedQuest.filePath)} style={{ justifyContent: 'center', fontSize: '11px', padding: '6px' }}>
              {t('quest_btn_open_raw')}
            </button>

            {/* Visual Objective Timeline */}
            {Array.isArray(activeQuestConfig.Objectives) && activeQuestConfig.Objectives.length > 0 && (
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '2px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: 'bold' }}>// {t('quest_flow_timeline')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {activeQuestConfig.Objectives.map((objRef, idx) => {
                    const typeInfo = OBJECTIVE_TYPES[objRef.ObjectiveType] || { label: 'Objective', prefix: 'OBJ' };
                    const objPath = getObjectiveFilePath(objRef.ObjectiveType, objRef.ID);
                    const objFile = configs[objPath];
                    const objText = objFile?.success ? objFile.content.ObjectiveText : `${t(`quest_obj_type_${objRef.ObjectiveType}`) || typeInfo.label} #${objRef.ID}`;
                    
                    let typeColor = '#808080';
                    let typeIcon = '❓';
                    if (objRef.ObjectiveType === 3) { typeColor = '#ebd667'; typeIcon = '📌'; } // Travel
                    else if (objRef.ObjectiveType === 2) { typeColor = '#cc4a4a'; typeIcon = '🎯'; } // Target (Kill)
                    else if (objRef.ObjectiveType === 5) { typeColor = '#4a9acc'; typeIcon = '📦'; } // Delivery
                    else if (objRef.ObjectiveType === 4) { typeColor = '#559655'; typeIcon = '🧺'; } // Collection
                    else if (objRef.ObjectiveType === 6) { typeColor = '#d2691e'; typeIcon = '🗝️'; } // Treasure Hunt

                    return (
                      <React.Fragment key={idx}>
                        {idx > 0 && <span style={{ color: 'var(--text-dark)', fontSize: '10px' }}>➔</span>}
                        <div 
                          style={{
                            background: 'var(--bg-primary)',
                            border: `1px solid ${typeColor}`,
                            borderRadius: '2px',
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onClick={() => {
                            if (objFile?.success) {
                              setEditingObjective({ objective: objRef, filePath: objPath });
                            } else {
                              alert(`Objective config file is missing on disk:\n${objPath}`);
                            }
                          }}
                          title={t('quest_edit_obj_tooltip', { id: objRef.ID })}
                        >
                          <span style={{ fontSize: '12px' }}>{typeIcon}</span>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: typeColor, fontWeight: 'bold' }}>
                            {objText.length > 15 ? objText.slice(0, 15) + '...' : objText}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Accordion 1: General Info */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '2px', background: 'var(--bg-primary)' }}>
              <div 
                onClick={() => setActiveAccordion(activeAccordion === 'general' ? '' : 'general')}
                style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', borderBottom: activeAccordion === 'general' ? '1px solid var(--border-color)' : 'none' }}
              >
                <span>{t('quest_acc_general')}</span>
                <span>{activeAccordion === 'general' ? '▼' : '►'}</span>
              </div>
              {activeAccordion === 'general' && (
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_title')}</label>
                    <input 
                      type="text" 
                      value={activeQuestConfig.Title || ''} 
                      onChange={e => onChangeField(selectedQuest.filePath, ['Title'], e.target.value)} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_summary')}</label>
                    <input 
                      type="text" 
                      value={activeQuestConfig.ObjectiveText || ''} 
                      onChange={e => onChangeField(selectedQuest.filePath, ['ObjectiveText'], e.target.value)} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_start')}</label>
                    <textarea 
                      rows="3" 
                      value={activeQuestConfig.Descriptions?.[0] || ''} 
                      onChange={e => onChangeField(selectedQuest.filePath, ['Descriptions', 0], e.target.value)} 
                      style={{ fontSize: '12px', padding: '6px', width: '100%', resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_progress')}</label>
                    <textarea 
                      rows="2" 
                      value={activeQuestConfig.Descriptions?.[1] || ''} 
                      onChange={e => onChangeField(selectedQuest.filePath, ['Descriptions', 1], e.target.value)} 
                      style={{ fontSize: '12px', padding: '6px', width: '100%', resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_completion')}</label>
                    <textarea 
                      rows="2" 
                      value={activeQuestConfig.Descriptions?.[2] || ''} 
                      onChange={e => onChangeField(selectedQuest.filePath, ['Descriptions', 2], e.target.value)} 
                      style={{ fontSize: '12px', padding: '6px', width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    {[
                      { label: t('quest_chk_active'), key: 'Active' },
                      { label: t('quest_chk_repeatable'), key: 'Repeatable' },
                      { label: t('quest_chk_autocomplete'), key: 'Autocomplete' },
                      { label: t('quest_chk_cancel_death'), key: 'CancelQuestOnPlayerDeath' },
                      { label: t('quest_chk_group'), key: 'IsGroupQuest' },
                      { label: t('quest_chk_achievement'), key: 'IsAchievement' }
                    ].map(f => (
                      <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={activeQuestConfig[f.key] === 1 || activeQuestConfig[f.key] === true}
                          onChange={e => onChangeField(selectedQuest.filePath, [f.key], e.target.checked ? 1 : 0)}
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Quest Givers & Turn Ins */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '2px', background: 'var(--bg-primary)' }}>
              <div 
                onClick={() => setActiveAccordion(activeAccordion === 'npc' ? '' : 'npc')}
                style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', borderBottom: activeAccordion === 'npc' ? '1px solid var(--border-color)' : 'none' }}
              >
                <span>{t('quest_acc_npcs')}</span>
                <span>{activeAccordion === 'npc' ? '▼' : '►'}</span>
              </div>
              {activeAccordion === 'npc' && (
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Quest Givers (QuestGiverIDs) */}
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-glow)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>{t('quest_label_givers')}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto', background: 'var(--bg-secondary)', padding: '6px', border: '1px solid var(--border-color)' }}>
                      {npcsList.map(npc => {
                        const isGiver = (activeQuestConfig.QuestGiverIDs || []).includes(npc.id);
                        return (
                          <label key={`giver-${npc.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={isGiver}
                              onChange={e => {
                                const list = activeQuestConfig.QuestGiverIDs || [];
                                const newList = e.target.checked ? [...list, npc.id] : list.filter(id => id !== npc.id);
                                onChangeField(selectedQuest.filePath, ['QuestGiverIDs'], newList);
                              }}
                            />
                            <span>{npc.name} (ID {npc.id})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quest Turn-Ins (QuestTurnInIDs) */}
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-glow)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>{t('quest_label_turnins')}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto', background: 'var(--bg-secondary)', padding: '6px', border: '1px solid var(--border-color)' }}>
                      {npcsList.map(npc => {
                        const isTurnIn = (activeQuestConfig.QuestTurnInIDs || []).includes(npc.id);
                        return (
                          <label key={`turnin-${npc.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={isTurnIn}
                              onChange={e => {
                                const list = activeQuestConfig.QuestTurnInIDs || [];
                                const newList = e.target.checked ? [...list, npc.id] : list.filter(id => id !== npc.id);
                                onChangeField(selectedQuest.filePath, ['QuestTurnInIDs'], newList);
                              }}
                            />
                            <span>{npc.name} (ID {npc.id})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Accordion 3: Flow & Prerequisites */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '2px', background: 'var(--bg-primary)' }}>
              <div 
                onClick={() => setActiveAccordion(activeAccordion === 'flow' ? '' : 'flow')}
                style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', borderBottom: activeAccordion === 'flow' ? '1px solid var(--border-color)' : 'none' }}
              >
                <span>{t('quest_flow_rep_faction')}</span>
                <span>{activeAccordion === 'flow' ? '▼' : '►'}</span>
              </div>
              {activeAccordion === 'flow' && (
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* PreQuestIDs list */}
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_prerequisites')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                      {(activeQuestConfig.PreQuestIDs || []).map(preId => {
                        const title = quests.find(q => q.id === preId)?.title || `Quest ID ${preId}`;
                        return (
                          <div key={preId} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', padding: '3px 8px', fontSize: '11px' }}>
                            <span>{title}</span>
                            <button className="btn-danger" onClick={() => handleRemovePrereq(preId)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--danger-color)' }}>×</button>
                          </div>
                        );
                      })}
                    </div>
                    <select
                      value=""
                      onChange={e => {
                        if (e.target.value) {
                          handleAddPrereq(Number(e.target.value));
                          e.target.value = "";
                        }
                      }}
                      style={{ fontSize: '12px', padding: '6px' }}
                    >
                      <option value="">{t('quest_add_prereq')}</option>
                      {quests.filter(q => q.id !== selectedQuest.id && !(activeQuestConfig.PreQuestIDs || []).includes(q.id)).map(q => (
                        <option key={q.id} value={q.id}>ID {q.id}: {q.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Follow-up quest */}
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_followup')}</label>
                    <select
                      value={activeQuestConfig.FollowUpQuest ?? -1}
                      onChange={e => handleSetFollowup(Number(e.target.value))}
                      style={{ fontSize: '12px', padding: '6px' }}
                    >
                      <option value={-1}>{t('quest_no_followup')}</option>
                      {quests.filter(q => q.id !== selectedQuest.id).map(q => (
                        <option key={q.id} value={q.id}>ID {q.id}: {q.title}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_req_faction')}</label>
                      <input 
                        type="text" 
                        value={activeQuestConfig.RequiredFaction || ''} 
                        onChange={e => onChangeField(selectedQuest.filePath, ['RequiredFaction'], e.target.value)} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_faction_reward')}</label>
                      <input 
                        type="text" 
                        value={activeQuestConfig.FactionReward || ''} 
                        onChange={e => onChangeField(selectedQuest.filePath, ['FactionReward'], e.target.value)} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_rep_req')}</label>
                      <input 
                        type="number" 
                        value={activeQuestConfig.ReputationRequirement ?? -1} 
                        onChange={e => onChangeField(selectedQuest.filePath, ['ReputationRequirement'], Number(e.target.value))} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_rep_reward')}</label>
                      <input 
                        type="number" 
                        value={activeQuestConfig.ReputationReward ?? 0} 
                        onChange={e => onChangeField(selectedQuest.filePath, ['ReputationReward'], Number(e.target.value))} 
                      />
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Accordion 4: Quest Items & Rewards */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '2px', background: 'var(--bg-primary)' }}>
              <div 
                onClick={() => setActiveAccordion(activeAccordion === 'items' ? '' : 'items')}
                style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', borderBottom: activeAccordion === 'items' ? '1px solid var(--border-color)' : 'none' }}
              >
                <span>{t('quest_acc_items')}</span>
                <span>{activeAccordion === 'items' ? '▼' : '►'}</span>
              </div>
              {activeAccordion === 'items' && (
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Quest Items table */}
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-glow)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>{t('quest_label_items')}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto', background: 'var(--bg-secondary)', padding: '6px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                      {(activeQuestConfig.QuestItems || []).length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '4px', textAlign: 'center' }}>{t('quest_no_items')}</div>
                      ) : (
                        (activeQuestConfig.QuestItems || []).map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                            <span>{item.ClassName} ({item.Amount}x)</span>
                            <button 
                              className="btn btn-danger" 
                              onClick={() => {
                                const list = [...activeQuestConfig.QuestItems];
                                list.splice(idx, 1);
                                onChangeField(selectedQuest.filePath, ['QuestItems'], list);
                              }}
                              style={{ padding: '1px 6px', fontSize: '9px' }}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    {/* Add quest item */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <ItemAutocomplete
                        suggestions={classnameSuggestions}
                        onAdd={(name) => {
                          const amt = Number(document.getElementById('new-qitem-amt')?.value || 1);
                          onChangeField(selectedQuest.filePath, ['QuestItems'], [...(activeQuestConfig.QuestItems || []), { ClassName: name, Amount: amt }]);
                        }}
                        label={t('quest_btn_add_item')}
                        placeholder={t('quest_ph_classname')}
                      />
                      <input id="new-qitem-amt" type="number" defaultValue="1" style={{ width: '55px', fontSize: '12px', padding: '6px', textAlign: 'center' }} />
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '1px', background: 'var(--border-color)' }} />

                  {/* Rewards list */}
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-glow)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>{t('quest_label_rewards')}</span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', background: 'var(--bg-secondary)', padding: '6px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                      {(activeQuestConfig.Rewards || []).length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '4px', textAlign: 'center' }}>{t('quest_no_rewards')}</div>
                      ) : (
                        (activeQuestConfig.Rewards || []).map((reward, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                            <div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{reward.ClassName} ({reward.Amount}x)</div>
                              <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('quest_reward_chance', { chance: reward.Chance * 100 })}</div>
                            </div>
                            <button 
                              className="btn btn-danger" 
                              onClick={() => {
                                const list = [...activeQuestConfig.Rewards];
                                list.splice(idx, 1);
                                onChangeField(selectedQuest.filePath, ['Rewards'], list);
                              }}
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', background: 'var(--bg-secondary)', padding: '8px', border: '1px solid var(--border-color)' }}>
                      <ItemAutocomplete
                        suggestions={classnameSuggestions}
                        onAdd={(name) => {
                          const amt = Number(document.getElementById('new-reward-amt')?.value || 1);
                          const chance = Number(document.getElementById('new-reward-chance')?.value || 1.0);
                          const newRew = {
                            ClassName: name,
                            Amount: amt,
                            Attachments: [],
                            DamagePercent: 0,
                            HealthPercent: 0,
                            QuestID: -1,
                            Chance: chance
                          };
                          onChangeField(selectedQuest.filePath, ['Rewards'], [...(activeQuestConfig.Rewards || []), newRew]);
                        }}
                        label={t('quest_btn_add_reward')}
                        placeholder={t('quest_ph_classname')}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('quest_label_amount')}</label>
                          <input id="new-reward-amt" type="number" defaultValue="1" style={{ fontSize: '11px', padding: '4px', textAlign: 'center' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t('quest_label_chance')}</label>
                          <input id="new-reward-chance" type="number" defaultValue="1.0" step="0.1" min="0" max="1" style={{ fontSize: '11px', padding: '4px', textAlign: 'center' }} />
                        </div>
                      </div>
                    </div>

                    {/* Reward options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={activeQuestConfig.NeedToSelectReward === 1 || activeQuestConfig.NeedToSelectReward === true}
                          onChange={e => onChangeField(selectedQuest.filePath, ['NeedToSelectReward'], e.target.checked ? 1 : 0)}
                        />
                        {t('quest_chk_must_select')}
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={activeQuestConfig.RandomReward === 1 || activeQuestConfig.RandomReward === true}
                          onChange={e => onChangeField(selectedQuest.filePath, ['RandomReward'], e.target.checked ? 1 : 0)}
                        />
                        {t('quest_chk_random_reward')}
                      </label>
                      {(activeQuestConfig.RandomReward === 1 || activeQuestConfig.RandomReward === true) && (
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('quest_label_random_amount')}</label>
                          <input 
                            type="number" 
                            value={activeQuestConfig.RandomRewardAmount ?? -1} 
                            onChange={e => onChangeField(selectedQuest.filePath, ['RandomRewardAmount'], Number(e.target.value))} 
                          />
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Accordion 5: Quest Objectives */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '2px', background: 'var(--bg-primary)' }}>
              <div 
                onClick={() => setActiveAccordion(activeAccordion === 'objectives' ? '' : 'objectives')}
                style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', borderBottom: activeAccordion === 'objectives' ? '1px solid var(--border-color)' : 'none' }}
              >
                <span>{t('quest_acc_objectives', { count: activeQuestConfig.Objectives?.length || 0 })}</span>
                <span>{activeAccordion === 'objectives' ? '▼' : '►'}</span>
              </div>
              {activeAccordion === 'objectives' && (
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Objectives list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(activeQuestConfig.Objectives || []).length === 0 ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '12px', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                        {t('quest_no_objectives')}
                      </div>
                    ) : (
                      (activeQuestConfig.Objectives || []).map((objRef, idx) => {
                        const objPath = getObjectiveFilePath(objRef.ObjectiveType, objRef.ID);
                        const objFile = configs[objPath];
                        const text = objFile?.success && objFile.content ? objFile.content.ObjectiveText : `Objective ID ${objRef.ID}`;
                        const typeLabel = t(`quest_obj_type_${objRef.ObjectiveType}`) || OBJECTIVE_TYPES[objRef.ObjectiveType]?.label || 'Unknown';

                        return (
                          <div 
                            key={`${objRef.ObjectiveType}-${objRef.ID}-${idx}`} 
                            style={{ 
                              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', 
                              borderRadius: '2px', padding: '8px 10px', display: 'flex', justifyItems: 'center', 
                              justifyContent: 'space-between', alignItems: 'center', gap: '8px' 
                            }}
                          >
                            <div style={{ overflow: 'hidden', marginRight: '6px' }}>
                              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                                {typeLabel} (ID {objRef.ID})
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--text-glow)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block' }}>
                                {text}
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button 
                                className="btn btn-accent"
                                onClick={() => {
                                  if (objFile?.success) {
                                    setEditingObjective({ objective: objFile.content, filePath: objPath });
                                  } else {
                                    alert("Cannot edit objective file: failed to load or missing.");
                                  }
                                }}
                                style={{ padding: '2px 8px', fontSize: '10px' }}
                              >
                                {t('quest_btn_edit')}
                              </button>
                              <button 
                                className="btn btn-danger"
                                onClick={() => handleRemoveObjective(idx, objRef)}
                                style={{ padding: '2px 6px', fontSize: '10px' }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add objective */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px', border: '1px solid var(--border-color)', marginTop: '6px' }}>
                    <select id="new-obj-type" style={{ fontSize: '12px', flex: 1, padding: '4px' }}>
                      {Object.entries(OBJECTIVE_TYPES).map(([id, info]) => (
                        <option key={id} value={id}>{t(`quest_obj_type_${id}`) || info.label}</option>
                      ))}
                    </select>
                    <button 
                      className="btn btn-accent"
                      onClick={() => {
                        const typeEl = document.getElementById('new-obj-type');
                        if (typeEl) {
                          handleAddObjective(typeEl.value);
                        }
                      }}
                      style={{ fontSize: '11px', padding: '6px 12px' }}
                    >
                      {t('quest_btn_add')}
                    </button>
                  </div>

                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* OBJECTIVE DETAILS MODAL */}
      {editingObjective && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, userSelect: 'none'
        }}>
          <div style={{
            width: '450px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: '2px', display: 'flex', flexDirection: 'column',
            maxHeight: '80%', boxShadow: 'var(--shadow-glow)'
          }}>
            
            {/* Modal Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  // {t('quest_modal_obj_details')} (TYPE: {t(`quest_obj_type_${editingObjective.objective.ObjectiveType}`) || OBJECTIVE_TYPES[editingObjective.objective.ObjectiveType]?.label})
                </span>
                <div style={{ fontSize: '15px', color: 'var(--text-glow)', fontWeight: 'bold', marginTop: '2px' }}>
                  {t('quest_modal_obj_id', { id: editingObjective.objective.ID })}
                </div>
              </div>
              <button 
                onClick={() => setEditingObjective(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Body (Scrollable form) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_objective_text')}</label>
                <input 
                  type="text" 
                  value={editingObjective.objective.ObjectiveText || ''} 
                  onChange={e => {
                    const updated = { ...editingObjective.objective, ObjectiveText: e.target.value };
                    setEditingObjective({ ...editingObjective, objective: updated });
                    onChangeField(editingObjective.filePath, ['ObjectiveText'], e.target.value);
                  }} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_time_limit')}</label>
                  <input 
                    type="number" 
                    value={editingObjective.objective.TimeLimit ?? -1} 
                    onChange={e => {
                      const updated = { ...editingObjective.objective, TimeLimit: Number(e.target.value) };
                      setEditingObjective({ ...editingObjective, objective: updated });
                      onChangeField(editingObjective.filePath, ['TimeLimit'], Number(e.target.value));
                    }} 
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '18px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={editingObjective.objective.Active === 1 || editingObjective.objective.Active === true}
                      onChange={e => {
                        const updated = { ...editingObjective.objective, Active: e.target.checked ? 1 : 0 };
                        setEditingObjective({ ...editingObjective, objective: updated });
                        onChangeField(editingObjective.filePath, ['Active'], e.target.checked ? 1 : 0);
                      }} 
                    />
                    {t('quest_chk_obj_active')}
                  </label>
                </div>
              </div>

              {/* TYPE-SPECIFIC OBJECTIVE FIELDS */}
              
              {/* Position coordinates (Travel (3) / Target (2) / Action (10)) */}
              {editingObjective.objective.Position !== undefined && (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-glow)', fontWeight: 'bold' }}>{t('quest_label_coords')}</span>
                    <button 
                      className="btn btn-accent" 
                      onClick={() => {
                        const pos = editingObjective.objective.Position;
                        onNavigateToMap(pos);
                        setEditingObjective(null);
                      }}
                      style={{ padding: '2px 8px', fontSize: '9px' }}
                      title="Locate coordinates on the Tactical Map"
                    >
                      {t('quest_btn_plot_map')}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {['X', 'Y', 'Z'].map((coord, idx) => (
                      <div key={coord}>
                        <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>{coord}</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={editingObjective.objective.Position[idx] ?? 0.0} 
                          onChange={e => {
                            const newPos = [...editingObjective.objective.Position];
                            newPos[idx] = Number(e.target.value);
                            const updated = { ...editingObjective.objective, Position: newPos };
                            setEditingObjective({ ...editingObjective, objective: updated });
                            onChangeField(editingObjective.filePath, ['Position', idx], Number(e.target.value));
                          }} 
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '4px', textAlign: 'center' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Travel parameters */}
              {editingObjective.objective.ObjectiveType === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_radius_m')}</label>
                      <input 
                        type="number" 
                        value={editingObjective.objective.MaxDistance ?? 20.0} 
                        onChange={e => {
                          const updated = { ...editingObjective.objective, MaxDistance: Number(e.target.value) };
                          setEditingObjective({ ...editingObjective, objective: updated });
                          onChangeField(editingObjective.filePath, ['MaxDistance'], Number(e.target.value));
                        }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_marker_name')}</label>
                      <input 
                        type="text" 
                        value={editingObjective.objective.MarkerName || ''} 
                        onChange={e => {
                          const updated = { ...editingObjective.objective, MarkerName: e.target.value };
                          setEditingObjective({ ...editingObjective, objective: updated });
                          onChangeField(editingObjective.filePath, ['MarkerName'], e.target.value);
                        }} 
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '4px' }}>
                    {[
                      { label: t('quest_chk_show_distance'), key: 'ShowDistance' },
                      { label: t('quest_chk_trigger_enter'), key: 'TriggerOnEnter' },
                      { label: t('quest_chk_trigger_exit'), key: 'TriggerOnExit' }
                    ].map(f => (
                      <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={editingObjective.objective[f.key] === 1 || editingObjective.objective[f.key] === true}
                          onChange={e => {
                            const updated = { ...editingObjective.objective, [f.key]: e.target.checked ? 1 : 0 };
                            setEditingObjective({ ...editingObjective, objective: updated });
                            onChangeField(editingObjective.filePath, [f.key], e.target.checked ? 1 : 0);
                          }}
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery / Collection parameters */}
              {(editingObjective.objective.ObjectiveType === 5 || editingObjective.objective.ObjectiveType === 4) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_max_distance')}</label>
                      <input 
                        type="number" 
                        value={editingObjective.objective.MaxDistance ?? 20.0} 
                        onChange={e => {
                          const updated = { ...editingObjective.objective, MaxDistance: Number(e.target.value) };
                          setEditingObjective({ ...editingObjective, objective: updated });
                          onChangeField(editingObjective.filePath, ['MaxDistance'], Number(e.target.value));
                        }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_marker_name')}</label>
                      <input 
                        type="text" 
                        value={editingObjective.objective.MarkerName || ''} 
                        onChange={e => {
                          const updated = { ...editingObjective.objective, MarkerName: e.target.value };
                          setEditingObjective({ ...editingObjective, objective: updated });
                          onChangeField(editingObjective.filePath, ['MarkerName'], e.target.value);
                        }} 
                      />
                    </div>
                  </div>

                  {/* Collections List */}
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-glow)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>{t('quest_label_req_collections')}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '6px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                      {(editingObjective.objective.Collections || []).length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '4px', textAlign: 'center' }}>{t('quest_no_collections')}</div>
                      ) : (
                        (editingObjective.objective.Collections || []).map((col, colIdx) => (
                          <div key={colIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                            <span>{col.ClassName} ({col.Amount}x)</span>
                            <button 
                              className="btn btn-danger" 
                              onClick={() => {
                                const list = [...editingObjective.objective.Collections];
                                list.splice(colIdx, 1);
                                const updated = { ...editingObjective.objective, Collections: list };
                                setEditingObjective({ ...editingObjective, objective: updated });
                                onChangeField(editingObjective.filePath, ['Collections'], list);
                              }}
                              style={{ padding: '1px 6px', fontSize: '9px' }}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* Add collection item */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <ItemAutocomplete
                        suggestions={classnameSuggestions}
                        onAdd={(name) => {
                          const amt = Number(document.getElementById('new-col-amt')?.value || 1);
                          const list = [...(editingObjective.objective.Collections || []), { ClassName: name, Amount: amt, QuantityPercent: -1, MinQuantityPercent: -1 }];
                          const updated = { ...editingObjective.objective, Collections: list };
                          setEditingObjective({ ...editingObjective, objective: updated });
                          onChangeField(editingObjective.filePath, ['Collections'], list);
                        }}
                        label={t('quest_btn_add_item')}
                        placeholder={t('quest_ph_classname')}
                      />
                      <input id="new-col-amt" type="number" defaultValue="1" style={{ width: '55px', fontSize: '12px', padding: '6px', textAlign: 'center' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Target parameters */}
              {editingObjective.objective.ObjectiveType === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_kill_count')}</label>
                      <input 
                        type="number" 
                        value={editingObjective.objective.Amount ?? 10} 
                        onChange={e => {
                          const updated = { ...editingObjective.objective, Amount: Number(e.target.value) };
                          setEditingObjective({ ...editingObjective, objective: updated });
                          onChangeField(editingObjective.filePath, ['Amount'], Number(e.target.value));
                        }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('quest_label_max_radial')}</label>
                      <input 
                        type="number" 
                        value={editingObjective.objective.MaxDistance ?? -1.0} 
                        onChange={e => {
                          const updated = { ...editingObjective.objective, MaxDistance: Number(e.target.value) };
                          setEditingObjective({ ...editingObjective, objective: updated });
                          onChangeField(editingObjective.filePath, ['MaxDistance'], Number(e.target.value));
                        }} 
                      />
                    </div>
                  </div>

                  {/* ClassNames and AllowedWeapons lists */}
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('quest_label_allowed_weapons')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '4px 0', background: 'var(--bg-primary)', padding: '6px', minHeight: '30px', border: '1px solid var(--border-color)' }}>
                      {(editingObjective.objective.AllowedWeapons || []).map((w, wIdx) => (
                        <div key={w} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', padding: '2px 6px', fontSize: '11px' }}>
                          <span>{w}</span>
                          <button 
                            onClick={() => {
                              const list = (editingObjective.objective.AllowedWeapons || []).filter(item => item !== w);
                              const updated = { ...editingObjective.objective, AllowedWeapons: list };
                              setEditingObjective({ ...editingObjective, objective: updated });
                              onChangeField(editingObjective.filePath, ['AllowedWeapons'], list);
                            }}
                            style={{ border: 'none', background: 'transparent', color: 'var(--danger-color)', cursor: 'pointer', padding: 0 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <ItemAutocomplete
                      suggestions={classnameSuggestions}
                      onAdd={(name) => {
                        const list = [...(editingObjective.objective.AllowedWeapons || []), name];
                        const updated = { ...editingObjective.objective, AllowedWeapons: list };
                        setEditingObjective({ ...editingObjective, objective: updated });
                        onChangeField(editingObjective.filePath, ['AllowedWeapons'], list);
                      }}
                      label={t('quest_btn_add_weapon')}
                      placeholder={t('quest_ph_classname')}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                className="btn btn-warning" 
                onClick={() => {
                  onSaveFile(editingObjective.filePath);
                  alert("Objective file saved successfully!");
                }}
              >
                {t('quest_btn_save_objective')}
              </button>
              <button 
                className="btn" 
                onClick={() => setEditingObjective(null)}
              >
                {t('quest_btn_close')}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
