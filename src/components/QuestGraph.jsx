import React, { useState, useEffect, useRef, useMemo } from 'react';
import AutocompleteInput from './shared/AutocompleteInput';
import FormCard from './shared/FormCard';
import CoordinatesInput from './shared/CoordinatesInput';
import { useTranslation } from '../utils/localization';
import HelpIcon from './HelpIcon';

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

      // Use manual absolute position if dragged
      if (nodeOffsets[node.id]) {
        x = nodeOffsets[node.id].x;
        y = nodeOffsets[node.id].y;
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
function ItemAutocomplete({ suggestions, onAdd, label = "Add item", placeholder = "Type ClassName...", layout = "vertical" }) {
  return (
    <AutocompleteInput 
      suggestions={suggestions} 
      placeholder={placeholder} 
      onSelect={onAdd} 
      buttonLabel={label} 
      layout={layout}
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
  highlightedQuestIds = [],
  setCoordinatePicker,
  setActiveTab
}) {
  const containerRef = useRef(null);
  const { t, lang } = useTranslation();



  const highlightSet = useMemo(() => {
    return new Set(Array.isArray(highlightedQuestIds) ? highlightedQuestIds.map(Number) : []);
  }, [highlightedQuestIds]);

  // Canvas pan & zoom states
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // Use refs for all transient pointer-event state to avoid stale-closure bugs
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);

  // Sync pan/zoom refs whenever state changes
  useEffect(() => { panOffsetRef.current = panOffset; }, [panOffset]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Drag offsets for individual node positioning
  const [nodeOffsets, setNodeOffsets] = useState(() => {
    try {
      const saved = localStorage.getItem('dayz_editor_quest_node_offsets');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('dayz_editor_quest_node_offsets', JSON.stringify(nodeOffsets));
  }, [nodeOffsets]);
  // Refs for node dragging (avoid stale closures in document mousemove)
  const draggedNodeRef = useRef(null);       // nodeId being dragged
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);       // true once mouse moves >3px

  // Refs for drag-selection rectangle
  const isDragSelectingRef = useRef(false);
  const dragSelectStartRef = useRef(null);   // { clientX, clientY }
  // Visual rect state (triggers re-render only when rect visually changes)
  const [dragSelectRect, setDragSelectRect] = useState(null); // { x, y, w, h } in container-local coords

  // selectedQuestIds ref — lets handlers always read the freshest value
  const selectedQuestIdsRef = useRef(new Set());

  // Positioned nodes ref — updated after every render for use inside handlers
  const positionedNodesRef = useRef([]);

  // Drag connection line state
  const [connectionDrag, setConnectionDrag] = useState(null);

  // State and memoized derivation for topological list and autocomplete suggestions
  const { quests, classnameSuggestions } = useMemo(() => {
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
    
    (Array.isArray(xmlItems) ? xmlItems : []).forEach(item => {
      if (typeof item === 'string') classnames.add(item);
    });
    
    questList.sort((a, b) => a.id - b.id);
    return {
      quests: questList,
      classnameSuggestions: Array.from(classnames).sort()
    };
  }, [configs, xmlItems]);

  // Selected entities and sync logic during rendering pass (React 18 style)
  const [prevQuests, setPrevQuests] = useState([]);
  const [prevSelectedQuestId, setPrevSelectedQuestId] = useState(null);
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [selectedQuestIds, setSelectedQuestIds] = useState(new Set());

  // Helper: update both the state and the ref atomically
  const applySelection = (newSet, activeNode) => {
    selectedQuestIdsRef.current = newSet;
    setSelectedQuestIds(new Set(newSet)); // new Set so React sees a change
    setSelectedQuest(activeNode);
    const activeId = activeNode ? activeNode.id : null;
    setPrevSelectedQuestId(activeId);
    if (onSelectQuest) onSelectQuest(activeId);
  };

  if (selectedQuestId !== prevSelectedQuestId || quests !== prevQuests) {
    setPrevSelectedQuestId(selectedQuestId);
    setPrevQuests(quests);
    const found = quests.find(q => q.id === selectedQuestId) || null;
    setSelectedQuest(found);
    if (selectedQuestId && !selectedQuestIdsRef.current.has(selectedQuestId)) {
      const ns = new Set([selectedQuestId]);
      selectedQuestIdsRef.current = ns;
      setSelectedQuestIds(ns);
    } else if (!selectedQuestId) {
      selectedQuestIdsRef.current = new Set();
      setSelectedQuestIds(new Set());
    }
  }

  const [activeAccordion, setActiveAccordion] = useState('general'); // general, npc, flow, items, objectives

  // Modal editor for Objective details
  const [editingObjective, setEditingObjective] = useState(null); // { objective, filePath }

  // Graph Search HUD
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredConnectionKey, setHoveredConnectionKey] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState(() => localStorage.getItem('dayz_editor_quest_active_subtab') || 'graph'); // graph, npcs
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditResults, setAuditResults] = useState([]);

  // Right-click context menu state
  // type: 'canvas' | 'node' | 'connection'
  const [questCtxMenu, setQuestCtxMenu] = useState(null);

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

  // Redundant scanner hook removed in favor of useMemo derivation

  const positionedNodes = layoutQuests(quests, nodeOffsets);
  const nodesMap = new Map(positionedNodes.map(n => [n.id, n]));

  // Proximity highlight when dragging relationship line near an input port
  const activeHoverPortNodeId = useMemo(() => {
    if (!connectionDrag) return null;
    const { currentX, currentY } = connectionDrag;
    for (const node of positionedNodes) {
      if (node.id === connectionDrag.fromNodeId) continue;
      const portX = node.x;
      const portY = node.y + node.height / 2;
      const dist = Math.hypot(portX - currentX, portY - currentY);
      if (dist <= 25) { // Collision range matching the handleMouseUp threshold
        return node.id;
      }
    }
    return null;
  }, [connectionDrag, positionedNodes]);

  // Pan Canvas Handlers (ref-based to avoid stale closures)
  const getSVGCoords = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const po = panOffsetRef.current;
    const z  = zoomRef.current;
    return {
      x: (e.clientX - rect.left - po.x) / z,
      y: (e.clientY - rect.top  - po.y) / z,
    };
  };

  // Keep positionedNodesRef current after every render
  positionedNodesRef.current = positionedNodes;

  // ─── Document-level pointer events (mount-once, reads from refs) ──────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onContainerDown = (e) => {
      if (e.button === 1) {
        e.preventDefault();
        isPanningRef.current = true;
        const po = panOffsetRef.current;
        panStartRef.current = { x: e.clientX - po.x, y: e.clientY - po.y };
        return;
      }
      if (e.button === 0) {
        const tag = e.target.tagName;
        const id  = e.target.id;
        if (tag === 'svg' || id === 'grid-bg') {
          isDragSelectingRef.current = true;
          dragSelectStartRef.current = { clientX: e.clientX, clientY: e.clientY };
          setDragSelectRect(null);
          if (!e.ctrlKey) {
            selectedQuestIdsRef.current = new Set();
            setSelectedQuestIds(new Set());
            setSelectedQuest(null);
            setPrevSelectedQuestId(null);
            if (onSelectQuest) onSelectQuest(null);
          }
        }
      }
    };

    const onDocMove = (e) => {
      if (isPanningRef.current) {
        const ps = panStartRef.current;
        const newOffset = { x: e.clientX - ps.x, y: e.clientY - ps.y };
        panOffsetRef.current = newOffset;
        setPanOffset(newOffset);
        return;
      }

      if (isDragSelectingRef.current && dragSelectStartRef.current) {
        const cRect = containerRef.current && containerRef.current.getBoundingClientRect();
        if (!cRect) return;
        const sx = dragSelectStartRef.current.clientX;
        const sy = dragSelectStartRef.current.clientY;
        setDragSelectRect({
          x: Math.min(sx, e.clientX) - cRect.left,
          y: Math.min(sy, e.clientY) - cRect.top,
          w: Math.abs(e.clientX - sx),
          h: Math.abs(e.clientY - sy),
        });
        return;
      }

      if (draggedNodeRef.current !== null) {
        const rawDx = e.clientX - dragStartRef.current.x;
        const rawDy = e.clientY - dragStartRef.current.y;
        if (Math.hypot(rawDx, rawDy) > 2) hasDraggedRef.current = true;
        const z = zoomRef.current;
        const dragId = draggedNodeRef.current;
        const selIds = selectedQuestIdsRef.current;
        const nodesToDrag = selIds.has(dragId) ? Array.from(selIds) : [dragId];
        const nodes = positionedNodesRef.current;
        setNodeOffsets(prev => {
          const updated = { ...prev };
          nodesToDrag.forEach(id => {
            const n = nodes.find(nd => nd.id === id);
            const cx = n ? n.x : (prev[id] ? prev[id].x : 0);
            const cy = n ? n.y : (prev[id] ? prev[id].y : 0);
            updated[id] = { x: cx + rawDx / z, y: cy + rawDy / z };
          });
          return updated;
        });
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      setConnectionDrag(prev => {
        if (!prev) return null;
        const po = panOffsetRef.current;
        const z  = zoomRef.current;
        const cRect = containerRef.current ? containerRef.current.getBoundingClientRect() : { left: 0, top: 0 };
        const svgX = (e.clientX - cRect.left - po.x) / z;
        const svgY = (e.clientY - cRect.top  - po.y) / z;
        return { ...prev, currentX: svgX, currentY: svgY };
      });
    };

    const onDocUp = (e) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        return;
      }

      if (isDragSelectingRef.current) {
        isDragSelectingRef.current = false;
        setDragSelectRect(null);
        const start = dragSelectStartRef.current;
        dragSelectStartRef.current = null;
        if (start) {
          const dx = Math.abs(e.clientX - start.clientX);
          const dy = Math.abs(e.clientY - start.clientY);
          if (dx >= 4 || dy >= 4) {
            const cRect = containerRef.current && containerRef.current.getBoundingClientRect();
            if (cRect) {
              const po = panOffsetRef.current;
              const z  = zoomRef.current;
              const x1 = Math.min(start.clientX, e.clientX);
              const y1 = Math.min(start.clientY, e.clientY);
              const x2 = Math.max(start.clientX, e.clientX);
              const y2 = Math.max(start.clientY, e.clientY);
              const nodes = positionedNodesRef.current;
              const overlapping = nodes.filter(node => {
                const nl = node.x * z + po.x + cRect.left;
                const nt = node.y * z + po.y + cRect.top;
                const nr = nl + node.width  * z;
                const nb = nt + node.height * z;
                return nl < x2 && nr > x1 && nt < y2 && nb > y1;
              });
              const prev = selectedQuestIdsRef.current;
              const next = e.ctrlKey ? new Set(prev) : new Set();
              overlapping.forEach(nd => next.add(nd.id));
              selectedQuestIdsRef.current = next;
              setSelectedQuestIds(new Set(next));
              const activeNode = overlapping.length > 0
                ? overlapping[overlapping.length - 1]
                : (next.size > 0 ? nodes.find(nd => nd.id === Array.from(next)[0]) || null : null);
              setSelectedQuest(activeNode);
              const activeId = activeNode ? activeNode.id : null;
              setPrevSelectedQuestId(activeId);
              if (onSelectQuest) onSelectQuest(activeId);
            }
          }
        }
        return;
      }

      if (draggedNodeRef.current !== null) {
        const wasDragged = hasDraggedRef.current;
        const nodeId = draggedNodeRef.current;
        draggedNodeRef.current = null;
        hasDraggedRef.current  = false;
        if (!wasDragged && !e.ctrlKey) {
          const nodes = positionedNodesRef.current;
          const activeNode = nodes.find(n => n.id === nodeId) || null;
          const ns = new Set([nodeId]);
          selectedQuestIdsRef.current = ns;
          setSelectedQuestIds(new Set(ns));
          setSelectedQuest(activeNode);
          setPrevSelectedQuestId(nodeId);
          if (onSelectQuest) onSelectQuest(nodeId);
        }
        return;
      }

      setConnectionDrag(prev => {
        if (!prev) return null;
        const po    = panOffsetRef.current;
        const z     = zoomRef.current;
        const cRect = containerRef.current ? containerRef.current.getBoundingClientRect() : { left: 0, top: 0 };
        const dropX = (e.clientX - cRect.left - po.x) / z;
        const dropY = (e.clientY - cRect.top  - po.y) / z;
        const nodes = positionedNodesRef.current;
        let targetNode = null;
        for (const node of nodes) {
          if (node.id === prev.fromNodeId) continue;
          const portX = node.x;
          const portY = node.y + node.height / 2;
          if (Math.hypot(portX - dropX, portY - dropY) <= 25) {
            targetNode = node;
            break;
          }
        }
        if (targetNode) {
          setTimeout(() => {
            setNodeOffsets(prevOff => {
              const updated = { ...prevOff };
              positionedNodesRef.current.forEach(n => {
                if (!updated[n.id]) updated[n.id] = { x: n.x, y: n.y };
              });
              return updated;
            });
            const targetPre = targetNode.preQuestIDs || [];
            if (!targetPre.includes(prev.fromNodeId)) {
              onChangeField(targetNode.filePath, ['PreQuestIDs'], [...targetPre, prev.fromNodeId]);
            }
            const sourceNode = positionedNodesRef.current.find(n => n.id === prev.fromNodeId);
            if (sourceNode) {
              onChangeField(sourceNode.filePath, ['FollowUpQuest'], targetNode.id);
            }
          }, 0);
        }
        return null;
      });
    };

    container.addEventListener('mousedown', onContainerDown);
    document.addEventListener('mousemove', onDocMove);
    document.addEventListener('mouseup',   onDocUp);
    return () => {
      container.removeEventListener('mousedown', onContainerDown);
      document.removeEventListener('mousemove', onDocMove);
      document.removeEventListener('mouseup',   onDocUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Lightweight node mousedown handler ──────────────────────────────────
  const handleNodeDragStart = (e, nodeId) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    draggedNodeRef.current  = nodeId;
    dragStartRef.current    = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current   = false;

    const isCtrl = e.ctrlKey;
    const prev   = selectedQuestIdsRef.current;
    const next   = new Set(prev);
    if (isCtrl) {
      if (next.has(nodeId)) { next.delete(nodeId); } else { next.add(nodeId); }
    } else {
      if (!next.has(nodeId)) { next.clear(); next.add(nodeId); }
    }
    const nodes = positionedNodesRef.current;
    const activeNode = next.has(nodeId)
      ? (nodes.find(n => n.id === nodeId) || null)
      : (next.size > 0 ? (nodes.find(n => n.id === Array.from(next)[0]) || null) : null);
    selectedQuestIdsRef.current = next;
    setSelectedQuestIds(new Set(next));
    setSelectedQuest(activeNode);
    const activeId = activeNode ? activeNode.id : null;
    setPrevSelectedQuestId(activeId);
    if (onSelectQuest) onSelectQuest(activeId);
  };

  const freezeCurrentLayout = () => {
    setNodeOffsets(prev => {
      const updated = { ...prev };
      positionedNodes.forEach(n => {
        if (!updated[n.id]) {
          updated[n.id] = { x: n.x, y: n.y };
        }
      });
      return updated;
    });
  };


  // Smooth pan+zoom to center a quest node on screen
  const zoomToNode = (node) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const targetZoom = Math.max(zoom, 1.0);
    const targetOffsetX = rect.width / 2 - (node.x + node.width / 2) * targetZoom;
    const targetOffsetY = rect.height / 2 - (node.y + node.height / 2) * targetZoom;
    const startZoom = zoom;
    const startOffsetX = panOffset.x;
    const startOffsetY = panOffset.y;
    const duration = 280;
    const start = performance.now();
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function animate(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOut(progress);
      setZoom(startZoom + (targetZoom - startZoom) * eased);
      setPanOffset({
        x: startOffsetX + (targetOffsetX - startOffsetX) * eased,
        y: startOffsetY + (targetOffsetY - startOffsetY) * eased
      });
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  };

  // RELATIONSHIP MODIFICATIONS
  const handleAddPrereq = (targetQuestId) => {
    if (!selectedQuest) return;
    const currentPre = selectedQuest.preQuestIDs;
    if (currentPre.includes(targetQuestId) || targetQuestId === selectedQuest.id) return;
    freezeCurrentLayout();
    
    // Add prerequisite to selected quest (Node B)
    onChangeField(selectedQuest.filePath, ['PreQuestIDs'], [...currentPre, targetQuestId]);

    // Set follow-up on the parent quest (Node A)
    const parentQuest = quests.find(q => q.id === targetQuestId);
    if (parentQuest) {
      onChangeField(parentQuest.filePath, ['FollowUpQuest'], selectedQuest.id);
    }
  };

  const handleRemovePrereq = (targetQuestId) => {
    if (!selectedQuest) return;
    freezeCurrentLayout();

    // Remove prerequisite from selected quest (Node B)
    const currentPre = selectedQuest.preQuestIDs.filter(id => id !== targetQuestId);
    onChangeField(selectedQuest.filePath, ['PreQuestIDs'], currentPre);

    // Clear follow-up on the parent quest (Node A) if it pointed to selected quest
    const parentQuest = quests.find(q => q.id === targetQuestId);
    if (parentQuest && parentQuest.followUpQuest === selectedQuest.id) {
      onChangeField(parentQuest.filePath, ['FollowUpQuest'], -1);
    }
  };

  const handleSetFollowup = (followUpId) => {
    if (!selectedQuest) return;
    freezeCurrentLayout();

    const oldFollowUpId = activeQuestConfig?.FollowUpQuest ?? -1;

    // 1. Update FollowUpQuest on selected quest
    onChangeField(selectedQuest.filePath, ['FollowUpQuest'], followUpId);

    // 2. Remove selected quest from the old follow-up quest's prerequisites
    if (oldFollowUpId > 0) {
      const oldFollowUpQuest = quests.find(q => q.id === oldFollowUpId);
      if (oldFollowUpQuest) {
        const list = (oldFollowUpQuest.preQuestIDs || []).filter(id => id !== selectedQuest.id);
        onChangeField(oldFollowUpQuest.filePath, ['PreQuestIDs'], list);
      }
    }

    // 3. Add selected quest to the new follow-up quest's prerequisites
    if (followUpId > 0) {
      const newFollowUpQuest = quests.find(q => q.id === followUpId);
      if (newFollowUpQuest) {
        const list = newFollowUpQuest.preQuestIDs || [];
        if (!list.includes(selectedQuest.id)) {
          onChangeField(newFollowUpQuest.filePath, ['PreQuestIDs'], [...list, selectedQuest.id]);
        }
      }
    }
  };

  const handleSeverConnection = (type, nodeAId, nodeBId) => {
    const nodeA = quests.find(q => q.id === nodeAId);
    const nodeB = quests.find(q => q.id === nodeBId);
    if (!nodeA || !nodeB) return;

    const msg = t('quest_confirm_sever_link', { src: nodeA.title, dst: nodeB.title }) || `Sever connection between Quest "${nodeA.title}" and "${nodeB.title}"?`;
    if (window.confirm(msg)) {
      freezeCurrentLayout();

      // Bi-directional link severing: update both PreQuestIDs (Node B) and FollowUpQuest (Node A)
      const list = (nodeB.preQuestIDs || []).filter(id => id !== nodeAId);
      onChangeField(nodeB.filePath, ['PreQuestIDs'], list);

      if (nodeA.followUpQuest === nodeBId) {
        onChangeField(nodeA.filePath, ['FollowUpQuest'], -1);
      }

      setHoveredConnectionKey(null);
    }
  };

  // Sever ALL connections for a quest node (both prereqs and follow-up)
  const handleSeverAllConnections = (nodeId) => {
    const node = quests.find(q => q.id === nodeId);
    if (!node) return;
    const ru = lang === 'ru';
    const confirmMsg = ru
      ? `Разорвать ВСЕ связи квеста "${node.title}" (ID ${nodeId})?`
      : `Sever ALL connections for quest "${node.title}" (ID ${nodeId})?`;
    if (!window.confirm(confirmMsg)) return;
    freezeCurrentLayout();
    // Remove from all PreQuestIDs references in other quests
    quests.forEach(q => {
      if (q.id === nodeId) return;
      if (q.preQuestIDs.includes(nodeId)) {
        onChangeField(q.filePath, ['PreQuestIDs'], q.preQuestIDs.filter(id => id !== nodeId));
      }
      if (q.followUpQuest === nodeId) {
        onChangeField(q.filePath, ['FollowUpQuest'], -1);
      }
    });
    // Clear own prereqs and follow-up
    onChangeField(node.filePath, ['PreQuestIDs'], []);
    onChangeField(node.filePath, ['FollowUpQuest'], -1);
    setQuestCtxMenu(null);
  };

  const runQuestAudit = () => {
    const results = [];

    // 1. Detect circular dependencies & broken links
    const visited = {}; // 0 = unvisited, 1 = visiting, 2 = visited
    const checkCycle = (qId, path = []) => {
      visited[qId] = 1;
      const qObj = quests.find(q => q.id === qId);
      if (qObj) {
        // Check prerequisite references
        (qObj.preQuestIDs || []).forEach(preId => {
          if (!quests.some(q => q.id === preId)) {
            results.push({
              type: 'error',
              category: t('quest_audit_broken') || "Broken Prerequisite Reference",
              msg: `Quest ID ${qId} ("${qObj.title}") references non-existent prerequisite Quest ID ${preId}.`,
              questId: qId
            });
          }
        });

        // Check FollowUpQuest reference
        const followId = qObj.followUpQuest;
        if (followId > 0) {
          if (!quests.some(q => q.id === followId)) {
            results.push({
              type: 'error',
              category: t('quest_audit_broken') || "Broken Follow-up Reference",
              msg: `Quest ID ${qId} ("${qObj.title}") references non-existent follow-up Quest ID ${followId}.`,
              questId: qId
            });
          } else {
            if (visited[followId] === 1) {
              results.push({
                type: 'error',
                category: t('quest_audit_circular') || "Circular Dependency Cycle",
                msg: `Quest ID ${qId} ("${qObj.title}") creates a circular cycle with Quest ID ${followId}. Path: ${path.concat(qId, followId).join(' -> ')}`,
                questId: qId
              });
            } else if (!visited[followId]) {
              checkCycle(followId, path.concat(qId));
            }
          }
        }
      }
      visited[qId] = 2;
    };

    quests.forEach(q => {
      if (!visited[q.id]) {
        checkCycle(q.id, []);
      }
    });

    // 2. Empty dialogues / titles check
    quests.forEach(q => {
      const file = configs[q.filePath]?.content;
      if (file) {
        if (!file.Title || file.Title.trim() === "") {
          results.push({
            type: 'warning',
            category: t('quest_audit_empty_fields') || "Empty Title",
            msg: `Quest ID ${q.id} has an empty Title.`,
            questId: q.id
          });
        }
        if (!file.Descriptions || !file.Descriptions.some(d => d && d.trim() !== "")) {
          results.push({
            type: 'warning',
            category: t('quest_audit_empty_fields') || "Empty Dialogue Text",
            msg: `Quest ID ${q.id} has no valid start dialogue or description texts.`,
            questId: q.id
          });
        }
      }
    });

    // 3. Missing NPC configurations check
    quests.forEach(q => {
      const file = configs[q.filePath]?.content;
      if (file) {
        const checkNpcExists = (npcId, label) => {
          if (npcId !== undefined && npcId !== null && npcId !== 0) {
            const npcExists = Object.values(configs).some(f => 
              f.success && f.content && f.content.ID === npcId
            );
            if (!npcExists) {
              results.push({
                type: 'error',
                category: t('quest_audit_missing_npc') || "Missing NPC Config",
                msg: `Quest ID ${q.id} references non-existent NPC ID ${npcId} as ${label}.`,
                questId: q.id
              });
            }
          }
        };

        if (Array.isArray(file.QuestGiverIDs)) {
          file.QuestGiverIDs.forEach(id => checkNpcExists(id, 'Quest Giver'));
        }
        if (Array.isArray(file.QuestTurnInIDs)) {
          file.QuestTurnInIDs.forEach(id => checkNpcExists(id, 'Quest Turn-In'));
        }
      }
    });

    // 4. Orphaned Objectives on disk check
    const referencedObjectivePaths = new Set();
    quests.forEach(q => {
      if (Array.isArray(q.objectives)) {
        q.objectives.forEach(objRef => {
          const path = getObjectiveFilePath(objRef.ObjectiveType, objRef.ID);
          if (path) referencedObjectivePaths.add(path.toLowerCase());
        });
      }
    });

    Object.keys(configs).forEach(filePath => {
      const lower = filePath.toLowerCase();
      if (lower.startsWith('expansionmod/quests/objectives/') && lower.endsWith('.json')) {
        if (!referencedObjectivePaths.has(lower)) {
          results.push({
            type: 'warning',
            category: t('quest_audit_orphaned') || "Orphaned Objective File",
            msg: `Objective file "${filePath}" exists on disk but is not linked to any Quest.`,
            action: () => {
              if (window.confirm(`Delete orphaned objective file: ${filePath}?`)) {
                onDeleteFile(filePath);
                setIsAuditOpen(false);
              }
            }
          });
        }
      }
    });

    setAuditResults(results);
    setIsAuditOpen(true);
  };

  // QUEST CREATION & DELETION
  // spawnPos: optional { x, y } in SVG canvas space — used by RMB context menu to place the node under the cursor
  const handleCreateQuest = (spawnPos = null) => {
    freezeCurrentLayout();
    const nextId = quests.length > 0 ? Math.max(...quests.map(q => Number(q.id) || 0)) + 1 : 1;
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

    // Pin the new node at the cursor position if spawned via RMB
    if (spawnPos && typeof spawnPos.x === 'number' && typeof spawnPos.y === 'number') {
      setNodeOffsets(prev => ({ ...prev, [nextId]: { x: spawnPos.x, y: spawnPos.y } }));
    }

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

  const handleDeleteQuest = (singleQuestToDelete) => {
    // If a specific quest node is passed (from RMB context menu on a non-selected node),
    // delete only it; otherwise delete all currently selected quests.
    const idsToDelete = (singleQuestToDelete && !selectedQuestIdsRef.current.has(singleQuestToDelete.id))
      ? new Set([singleQuestToDelete.id])
      : new Set(selectedQuestIdsRef.current);

    if (idsToDelete.size === 0) return;

    const questsToDelete = Array.from(idsToDelete)
      .map(id => quests.find(q => q.id === id))
      .filter(Boolean);

    const names = questsToDelete.map(q => `"${q.title}" (ID ${q.id})`).join('\n');
    const msg = idsToDelete.size === 1
      ? `Are you sure you want to delete ${names}?\nThis will physically remove it from disk.`
      : `Are you sure you want to delete ${idsToDelete.size} quests?\n${names}\n\nThis will physically remove them from disk.`;

    if (window.confirm(msg)) {
      freezeCurrentLayout();

      // 1. Unlink references in other quests
      quests.forEach(q => {
        if (idsToDelete.has(q.id)) return;
        if (idsToDelete.has(q.followUpQuest)) {
          onChangeField(q.filePath, ['FollowUpQuest'], -1);
        }
        const filteredPre = q.preQuestIDs.filter(id => !idsToDelete.has(id));
        if (filteredPre.length !== q.preQuestIDs.length) {
          onChangeField(q.filePath, ['PreQuestIDs'], filteredPre);
        }
      });

      // 2. Delete orphaned objectives, then the quest file itself
      questsToDelete.forEach(q => {
        const questConfig = configs[q.filePath]?.content;
        if (questConfig && Array.isArray(questConfig.Objectives)) {
          questConfig.Objectives.forEach(obj => {
            const isReferenced = quests.some(q2 =>
              !idsToDelete.has(q2.id) &&
              q2.objectives.some(o => o.ID === obj.ID && o.ObjectiveType === obj.ObjectiveType)
            );
            if (!isReferenced) {
              const objPath = getObjectiveFilePath(obj.ObjectiveType, obj.ID);
              if (objPath) onDeleteFile(objPath);
            }
          });
        }
        onDeleteFile(q.filePath);
      });

      // Clear selection
      selectedQuestIdsRef.current = new Set();
      setSelectedQuestIds(new Set());
      setSelectedQuest(null);
      setPrevSelectedQuestId(null);
      if (onSelectQuest) onSelectQuest(null);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Sub-tab selection bar */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 10px',
        height: '42px',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0
      }}>
        {[
          { id: 'graph', label: t('quest_tab_flow') || "Quest Graph", icon: "🗺️" },
          { id: 'npcs', label: t('quest_tab_npcs') || "Quest NPCs", icon: "👤" }
        ].map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                localStorage.setItem('dayz_editor_quest_active_subtab', tab.id);
              }}
              style={{
                background: isActive ? 'var(--bg-secondary)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: isActive ? 'var(--text-glow)' : 'var(--text-secondary)',
                padding: '8px 16px',
                fontSize: '12px',
                fontFamily: 'var(--font-heading)',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '100%',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeSubTab === 'graph' ? (
        <div style={{ display: 'flex', flex: 1, height: 'calc(100% - 42px)', overflow: 'hidden', position: 'relative' }}>
          {/* Visual Canvas Workspace */}
          <div 
            ref={containerRef}
            onAuxClick={(e) => { if (e.button === 1) e.preventDefault(); }}
            onContextMenu={(e) => {
              e.preventDefault();
              const coords = getSVGCoords(e);
              setQuestCtxMenu({ type: 'canvas', px: e.clientX, py: e.clientY, svgX: coords.x, svgY: coords.y });
            }}
            onClick={() => questCtxMenu && setQuestCtxMenu(null)}
            style={{ 
              flex: 1, 
              height: '100%', 
              position: 'relative', 
              overflow: 'hidden', 
              background: '#040604',
              cursor: isPanningRef.current ? 'grabbing' : 'default',
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
              const sq = searchQuery.trim().toLowerCase();
              const isNodeMatch = sq ? (
                String(node.id).includes(sq) || node.title.toLowerCase().includes(sq)
              ) : true;

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

                  const isHighlight = highlightSet.has(Number(preId)) && highlightSet.has(Number(node.id));
                  const isSelectedLine = selectedQuestIds.has(node.id) || selectedQuestIds.has(preId);
                  const isParentMatch = sq ? (
                    String(parent.id).includes(sq) || parent.title.toLowerCase().includes(sq)
                  ) : true;
                  const lineVisible = !sq || (isNodeMatch || isParentMatch);

                  const midX = 0.125 * startX + 0.375 * cp1X + 0.375 * cp2X + 0.125 * endX;
                  const midY = 0.125 * startY + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * endY;
                  const connKey = `prereq-${preId}-${node.id}`;
                  const isHovered = hoveredConnectionKey === connKey;

                  lines.push(
                    <g 
                      key={connKey}
                      onMouseEnter={() => setHoveredConnectionKey(connKey)}
                      onMouseLeave={() => setHoveredConnectionKey(null)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setQuestCtxMenu({ type: 'connection', px: e.clientX, py: e.clientY, connType: 'prereq', nodeAId: preId, nodeBId: node.id });
                      }}
                    >
                      <path
                        d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="12"
                        style={{ cursor: 'pointer' }}
                      />
                      {isHighlight && (
                        <path
                          d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                          fill="none"
                          stroke="rgba(255, 74, 74, 0.4)"
                          strokeWidth="6"
                          opacity={lineVisible ? '0.8' : '0.08'}
                        />
                      )}
                      <path
                        className={isSelectedLine && !isHighlight ? 'quest-line-prereq-active' : undefined}
                        d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                        fill="none"
                        stroke={isHovered ? '#ff6b6b' : (isHighlight ? '#ff4a4a' : '#44aacc')}
                        strokeWidth={isHovered ? '3' : (isHighlight ? '2.5' : (isSelectedLine ? '2' : '1.5'))}
                        strokeDasharray={isHighlight || isSelectedLine ? undefined : '4,4'}
                        markerEnd="url(#arrow-prereq)"
                        opacity={lineVisible ? (isHighlight ? '1.0' : '0.65') : '0.08'}
                      />
                      {isHovered && lineVisible && (
                        <g 
                          transform={`translate(${midX}, ${midY})`}
                          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleSeverConnection('prereq', preId, node.id); }}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle r="25" fill="transparent" />
                          <circle r="8" fill="#ff4a4a" stroke="#ffffff" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 4px rgba(255,74,74,0.6))' }} />
                          <line x1="-3" y1="-3" x2="3" y2="3" stroke="#ffffff" strokeWidth="1.5" />
                          <line x1="3" y1="-3" x2="-3" y2="3" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      )}
                    </g>
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

                  const isHighlight = highlightSet.has(Number(node.id)) && highlightSet.has(Number(node.followUpQuest));
                  const isSelectedLine = selectedQuestIds.has(node.id) || selectedQuestIds.has(node.followUpQuest);
                  const isChildMatch = sq ? (
                    String(child.id).includes(sq) || child.title.toLowerCase().includes(sq)
                  ) : true;
                  const lineVisible = !sq || (isNodeMatch || isChildMatch);

                  const midX = 0.125 * startX + 0.375 * cp1X + 0.375 * cp2X + 0.125 * endX;
                  const midY = 0.125 * startY + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * endY;
                  const connKey = `follow-${node.id}-${node.followUpQuest}`;
                  const isHovered = hoveredConnectionKey === connKey;

                  lines.push(
                    <g
                      key={connKey}
                      onMouseEnter={() => setHoveredConnectionKey(connKey)}
                      onMouseLeave={() => setHoveredConnectionKey(null)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setQuestCtxMenu({ type: 'connection', px: e.clientX, py: e.clientY, connType: 'follow', nodeAId: node.id, nodeBId: node.followUpQuest });
                      }}
                    >
                      <path
                        d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="12"
                        style={{ cursor: 'pointer' }}
                      />
                      {isHighlight && (
                        <path
                          d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                          fill="none"
                          stroke="rgba(255, 74, 74, 0.4)"
                          strokeWidth="6"
                          opacity={lineVisible ? '0.8' : '0.08'}
                        />
                      )}
                      <path
                        className={isSelectedLine && !isHighlight ? 'quest-line-followup-active' : undefined}
                        d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                        fill="none"
                        stroke={isHovered ? '#ff6b6b' : (isHighlight ? '#ff4a4a' : '#b2fa9e')}
                        strokeWidth={isHovered ? '3' : (isHighlight ? '3' : (isSelectedLine ? '2.5' : '2'))}
                        markerEnd="url(#arrow-followup)"
                        opacity={lineVisible ? (isHighlight ? '1.0' : '0.8') : '0.08'}
                      />
                      {isHovered && lineVisible && (
                        <g 
                          transform={`translate(${midX}, ${midY})`}
                          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleSeverConnection('follow', node.id, node.followUpQuest); }}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle r="25" fill="transparent" />
                          <circle r="8" fill="#ff4a4a" stroke="#ffffff" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 4px rgba(255,74,74,0.6))' }} />
                          <line x1="-3" y1="-3" x2="3" y2="3" stroke="#ffffff" strokeWidth="1.5" />
                          <line x1="3" y1="-3" x2="-3" y2="3" stroke="#ffffff" strokeWidth="1.5" />
                        </g>
                      )}
                    </g>
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
              const isSelected = selectedQuestIds.has(node.id);
              const sq2 = searchQuery.trim().toLowerCase();
              const isMatch = !sq2 || String(node.id).includes(sq2) || node.title.toLowerCase().includes(sq2);
              const nodeOpacity = sq2 && !isMatch ? 0.1 : 1;
              const hasUnsaved = configs[node.filePath]?.isDirty;

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
                  style={{ opacity: nodeOpacity, transition: 'opacity 0.2s', cursor: 'grab' }}
                  onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                  onDoubleClick={() => { if (onOpenFile) onOpenFile(node.filePath); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setQuestCtxMenu({ type: 'node', px: e.clientX, py: e.clientY, node });
                  }}
                >
                  <rect
                    width={node.width}
                    height={node.height}
                    rx="4"
                    fill={isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)'}
                    stroke={highlightSet.has(Number(node.id)) ? '#ff4a4a' : (isSelected ? 'var(--text-glow)' : hasUnsaved ? 'var(--warning-color)' : 'var(--border-color)')}
                    strokeWidth={highlightSet.has(Number(node.id)) ? '2.5' : (isSelected ? '2' : '1.5')}
                    style={{
                      filter: highlightSet.has(Number(node.id)) ? 'drop-shadow(0 0 10px rgba(255, 74, 74, 0.6))' : (isSelected ? 'drop-shadow(0 0 6px rgba(178, 250, 158, 0.25))' : 'none'),
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
                    r={activeHoverPortNodeId === node.id ? 8 : 5}
                    fill={activeHoverPortNodeId === node.id ? "var(--warning-color)" : "var(--bg-primary)"}
                    stroke={activeHoverPortNodeId === node.id ? "var(--text-glow)" : "#44aacc"}
                    strokeWidth={activeHoverPortNodeId === node.id ? 2.5 : 1.5}
                    style={{ 
                      cursor: 'crosshair', 
                      transition: 'all 0.15s ease-in-out',
                      filter: activeHoverPortNodeId === node.id ? 'drop-shadow(0 0 6px var(--warning-color))' : 'none'
                    }}
                    title={t('quest_port_prereq')}
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
                    title={t('quest_port_followup')}
                  />
                </g>
              );
            })}
          </g>
          {dragSelectRect && (
            <rect
              x={dragSelectRect.x}
              y={dragSelectRect.y}
              width={dragSelectRect.w}
              height={dragSelectRect.h}
              fill="rgba(178, 250, 158, 0.10)"
              stroke="var(--accent-color)"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>

        {/* Floating Search HUD */}
        {(() => {
          const sq = searchQuery.trim().toLowerCase();
          const searchResults = sq ? positionedNodes.filter(n =>
            String(n.id).includes(sq) || n.title.toLowerCase().includes(sq)
          ).slice(0, 8) : [];
          return (
            <div className="quest-search-hud">
              <div className="quest-search-input-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-glow)" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  className="quest-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('quest_search_graph_ph')}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setSearchQuery('');
                    if (e.key === 'Enter' && searchResults.length > 0) {
                      setSelectedQuest(searchResults[0]);
                      if (onSelectQuest) onSelectQuest(searchResults[0].id);
                      zoomToNode(searchResults[0]);
                    }
                  }}
                />
                {searchQuery && (
                  <span
                    onClick={() => setSearchQuery('')}
                    style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1 }}
                    title="Clear"
                  >✕</span>
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="quest-search-results">
                  {searchResults.map(n => (
                    <div
                      key={n.id}
                      className="quest-search-result-item"
                      onClick={() => {
                        setSelectedQuest(n);
                        if (onSelectQuest) onSelectQuest(n.id);
                        zoomToNode(n);
                        setSearchQuery('');
                      }}
                    >
                      <span className="result-id">#{n.id}</span>
                      <span>{n.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

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
          <button className="btn" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} style={{ padding: '4px 8px', fontSize: '11px' }} title="Reset Pan & Zoom">{t('config_reset')}</button>
          <button className="btn" onClick={() => setNodeOffsets({})} style={{ padding: '4px 8px', fontSize: '11px' }} title="Auto-align all nodes to default columns">{t('quest_btn_reset_layout') || 'Auto-Layout'}</button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-color)' }} />
          <button className="btn btn-danger" onClick={runQuestAudit} style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 'bold' }} title="Run circular references, orphan objectives, and link validations">
            {t('quest_audit_btn') || "🛠️ DIAGNOSTICS"}
          </button>
        </div>

        {/* ─── RIGHT-CLICK CONTEXT MENU ─── */}
        {questCtxMenu && (
          <div
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onContextMenu={e => e.preventDefault()}
            style={{
              position: 'fixed',
              top: questCtxMenu.py,
              left: questCtxMenu.px,
              zIndex: 99999,
              background: 'rgba(7,9,7,0.97)',
              border: '1px solid var(--border-color)',
              borderRadius: '3px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
              overflow: 'hidden',
              minWidth: '220px',
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'auto',
            }}
          >
            {/* Header label */}
            <div style={{ padding: '4px 10px', fontSize: '9px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', letterSpacing: '0.08em' }}>
              {questCtxMenu.type === 'node' && `// QUEST_NODE: ID ${questCtxMenu.node.id}`}
              {questCtxMenu.type === 'connection' && `// CONNECTION: ${questCtxMenu.connType.toUpperCase()}`}
              {questCtxMenu.type === 'canvas' && '// QUEST_GRAPH'}
            </div>

            {/* ── NODE CONTEXT ── */}
            {questCtxMenu.type === 'node' && (() => {
              const ru = lang === 'ru';
              const n = questCtxMenu.node;
              const BTN = (onClick, color, label) => (
                <button
                  onClick={onClick}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 12px', background:'transparent', border:'none', color: color || 'var(--text-glow)', cursor:'pointer', fontSize:'11px', fontFamily:'var(--font-mono)', transition:'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = color === '#ff6b6b' ? 'rgba(255,80,80,0.12)' : 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{label}</button>
              );
              return (
                <>
                  <div style={{ padding:'5px 12px', fontSize:'10px', color:'var(--text-secondary)', borderBottom:'1px solid rgba(255,255,255,0.05)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {n.title}
                  </div>

                  {BTN(() => {
                    setSelectedQuest(n);
                    if (onSelectQuest) onSelectQuest(n.id);
                    const full = positionedNodes.find(pn => pn.id === n.id);
                    if (full) zoomToNode(full);
                    setQuestCtxMenu(null);
                  }, null, `🔍 ${ru ? 'Выбрать и приблизить' : 'Select & Zoom To'}`)}

                  {BTN(() => {
                    if (onOpenFile) onOpenFile(n.filePath);
                    setQuestCtxMenu(null);
                  }, null, `📂 ${ru ? 'Открыть в редакторе' : 'Open in Editor'}`)}

                  <div style={{ height:'1px', background:'var(--border-color)', opacity:0.4, margin:'4px 0' }} />

                  {BTN(() => {
                    const text = String(n.id);
                    navigator.clipboard.writeText(text).catch(() => {});
                    setQuestCtxMenu(null);
                  }, null, `📋 ${ru ? 'Копировать ID' : 'Copy Quest ID'}`)}

                  {BTN(() => {
                    navigator.clipboard.writeText(n.title).catch(() => {});
                    setQuestCtxMenu(null);
                  }, null, `📋 ${ru ? 'Копировать название' : 'Copy Quest Title'}`)}

                  <div style={{ height:'1px', background:'var(--border-color)', opacity:0.4, margin:'4px 0' }} />

                  {BTN(() => {
                    handleSeverAllConnections(n.id);
                  }, '#ff6b6b', `✂️ ${ru ? 'Разорвать все связи' : 'Sever All Connections'}`)}

                  {BTN(() => { if (!selectedQuestIdsRef.current.has(n.id)) { const ns = new Set([n.id]); selectedQuestIdsRef.current = ns; setSelectedQuestIds(new Set(ns)); setSelectedQuest(n); setPrevSelectedQuestId(n.id); if (onSelectQuest) onSelectQuest(n.id); } setQuestCtxMenu(null); setTimeout(() => handleDeleteQuest(n), 50); }, '#ff6b6b', ru ? (selectedQuestIds.has(n.id) && selectedQuestIds.size > 1 ? `\u0423\u0434\u0430\u043b\u0438\u0442\u044c ${selectedQuestIds.size} \u043a\u0432\u0435\u0441\u0442\u0430` : '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u0432\u0435\u0441\u0442') : (selectedQuestIds.has(n.id) && selectedQuestIds.size > 1 ? `Delete ${selectedQuestIds.size} Quests` : 'Delete Quest'))}
                </>
              );
            })()}

            {/* ── CONNECTION CONTEXT ── */}
            {questCtxMenu.type === 'connection' && (() => {
              const ru = lang === 'ru';
              const nA = quests.find(q => q.id === questCtxMenu.nodeAId);
              const nB = quests.find(q => q.id === questCtxMenu.nodeBId);
              return (
                <>
                  <div style={{ padding:'5px 12px', fontSize:'10px', color:'var(--text-secondary)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                    {nA?.title} → {nB?.title}
                  </div>
                  <button
                    onClick={() => {
                      handleSeverConnection(questCtxMenu.connType, questCtxMenu.nodeAId, questCtxMenu.nodeBId);
                      setQuestCtxMenu(null);
                    }}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 12px', background:'transparent', border:'none', color:'#ff6b6b', cursor:'pointer', fontSize:'11px', fontFamily:'var(--font-mono)', transition:'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,80,80,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    ✂️ {ru ? 'Разорвать связь' : 'Sever Connection'}
                  </button>
                </>
              );
            })()}

            {/* ── CANVAS CONTEXT ── */}
            {questCtxMenu.type === 'canvas' && (() => {
              const ru = lang === 'ru';
              const BTN = (onClick, color, label) => (
                <button
                  onClick={onClick}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 12px', background:'transparent', border:'none', color: color || 'var(--text-glow)', cursor:'pointer', fontSize:'11px', fontFamily:'var(--font-mono)', transition:'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = color === '#ff6b6b' ? 'rgba(255,80,80,0.12)' : 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{label}</button>
              );
              return (
                <>
                  {BTN(() => {
                    handleCreateQuest({ x: questCtxMenu.svgX, y: questCtxMenu.svgY });
                    setQuestCtxMenu(null);
                  }, null, `✨ ${ru ? 'Создать новый квест' : 'Create New Quest'}`)}

                  <div style={{ height:'1px', background:'var(--border-color)', opacity:0.4, margin:'4px 0' }} />

                  {BTN(() => {
                    setZoom(1);
                    setPanOffset({ x: 0, y: 0 });
                    setQuestCtxMenu(null);
                  }, null, `🔄 ${ru ? 'Сброс просмотра' : 'Reset Pan & Zoom'}`)}

                  {BTN(() => {
                    setNodeOffsets({});
                    setQuestCtxMenu(null);
                  }, null, `📐 ${ru ? 'Авто-раскладка нодов' : 'Auto-Layout Nodes'}`)}

                  <div style={{ height:'1px', background:'var(--border-color)', opacity:0.4, margin:'4px 0' }} />

                  {BTN(() => {
                    runQuestAudit();
                    setQuestCtxMenu(null);
                  }, null, `🛠️ ${ru ? 'Диагностика' : 'Run Diagnostics'}`)}
                </>
              );
            })()}

            {/* Close button row */}
            <div style={{ borderTop:'1px solid var(--border-color)', padding:'4px 10px', display:'flex', justifyContent:'flex-end' }}>
              <button
                onClick={() => setQuestCtxMenu(null)}
                style={{ background:'transparent', border:'none', color:'var(--text-secondary)', fontSize:'10px', cursor:'pointer', fontFamily:'var(--font-mono)', padding:'2px 6px' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                {lang === 'ru' ? 'Закрыть' : 'Close'} ✕
              </button>
            </div>
          </div>
        )}
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
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {t('quest_label_title')}
                    </label>
                    <input 
                      type="text" 
                      value={activeQuestConfig.Title || ''} 
                      onChange={e => onChangeField(selectedQuest.filePath, ['Title'], e.target.value)} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {t('quest_label_summary')}
                    </label>
                    <input 
                      type="text" 
                      value={activeQuestConfig.ObjectiveText || ''} 
                      onChange={e => onChangeField(selectedQuest.filePath, ['ObjectiveText'], e.target.value)} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {t('quest_label_start')}
                    </label>
                    <textarea 
                      rows="3" 
                      value={activeQuestConfig.Descriptions?.[0] || ''} 
                      onChange={e => onChangeField(selectedQuest.filePath, ['Descriptions', 0], e.target.value)} 
                      style={{ fontSize: '12px', padding: '6px', width: '100%', resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {t('quest_label_progress')}
                    </label>
                    <textarea 
                      rows="2" 
                      value={activeQuestConfig.Descriptions?.[1] || ''} 
                      onChange={e => onChangeField(selectedQuest.filePath, ['Descriptions', 1], e.target.value)} 
                      style={{ fontSize: '12px', padding: '6px', width: '100%', resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      {t('quest_label_completion')}
                    </label>
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
                      { label: t('quest_chk_repeatable'), key: 'Repeatable', tipKey: 'tip_quest_repeatable' },
                      { label: t('quest_chk_autocomplete'), key: 'Autocomplete', tipKey: 'tip_quest_autocomplete' },
                      { label: t('quest_chk_cancel_death'), key: 'CancelQuestOnPlayerDeath', tipKey: 'tip_quest_cancel_death' },
                      { label: t('quest_chk_group'), key: 'IsGroupQuest', tipKey: 'tip_quest_group' },
                      { label: t('quest_chk_achievement'), key: 'IsAchievement', tipKey: 'tip_quest_achievement' }
                    ].map(f => (
                      <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={activeQuestConfig[f.key] === 1 || activeQuestConfig[f.key] === true}
                          onChange={e => onChangeField(selectedQuest.filePath, [f.key], e.target.checked ? 1 : 0)}
                        />
                        <span className="label-with-help">
                          {f.label}
                          {f.tipKey && <HelpIcon tipKey={f.tipKey} />}
                        </span>
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
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      <span className="label-with-help">{t('quest_prerequisites')}<HelpIcon tipKey="tip_quest_prequests" /></span>
                    </label>
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
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      <span className="label-with-help">{t('quest_followup')}<HelpIcon tipKey="tip_quest_followup" /></span>
                    </label>
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
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        <span className="label-with-help">{t('quest_label_rep_req')}<HelpIcon tipKey="tip_quest_reputation" /></span>
                      </label>
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
                  {(!xmlItems || xmlItems.length === 0) && (
                    <div style={{ 
                      padding: '8px 10px', 
                      background: 'rgba(230,162,60,0.08)', 
                      border: '1px solid rgba(230,162,60,0.25)', 
                      borderRadius: '2px', 
                      color: '#e6a23c', 
                      fontSize: '11px', 
                      lineHeight: '1.4' 
                    }}>
                      {t('quest_warning_xml_missing') || "⚠️ Items database (types.xml) is not loaded. Autocomplete is limited to local files."}
                    </div>
                  )}
                  
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-secondary)', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '2px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('quest_label_amount') || "Amount"}:</span>
                        <input id="new-qitem-amt" type="number" defaultValue="1" style={{ width: '70px', fontSize: '12px', padding: '4px', textAlign: 'center' }} />
                      </div>
                      <ItemAutocomplete
                        suggestions={classnameSuggestions}
                        onAdd={(name) => {
                          const amt = Number(document.getElementById('new-qitem-amt')?.value || 1);
                          onChangeField(selectedQuest.filePath, ['QuestItems'], [...(activeQuestConfig.QuestItems || []), { ClassName: name, Amount: amt }]);
                        }}
                        label={t('quest_btn_add_item')}
                        placeholder={t('quest_ph_classname')}
                      />
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

                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', background: 'var(--bg-secondary)', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>{t('quest_label_amount')}</label>
                          <input id="new-reward-amt" type="number" defaultValue="1" style={{ fontSize: '12px', padding: '6px', textAlign: 'center', width: '100%' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>{t('quest_label_chance')}</label>
                          <input id="new-reward-chance" type="number" defaultValue="1.0" step="0.1" min="0" max="1" style={{ fontSize: '12px', padding: '6px', textAlign: 'center', width: '100%' }} />
                        </div>
                      </div>
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
                                    alert(t('quest_obj_file_missing'));
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
    </div>
  ) : (
    <QuestNPCsManager 
      configs={configs}
      onChangeField={onChangeField}
      onCreateFile={onCreateFile}
      onDeleteFile={onDeleteFile}
      setCoordinatePicker={setCoordinatePicker}
      setActiveTab={setActiveTab}
      xmlItems={xmlItems}
      t={t}
      lang={lang}
    />
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
              {(!xmlItems || xmlItems.length === 0) && (
                <div style={{ 
                  padding: '8px 10px', 
                  background: 'rgba(230,162,60,0.08)', 
                  border: '1px solid rgba(230,162,60,0.25)', 
                  borderRadius: '2px', 
                  color: '#e6a23c', 
                  fontSize: '11px', 
                  lineHeight: '1.4' 
                }}>
                  {t('quest_warning_xml_missing') || "⚠️ Items database (types.xml) is not loaded. Autocomplete is limited to local files."}
                </div>
              )}
              
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
                  <CoordinatesInput
                    label={t('quest_label_coords')}
                    position={editingObjective.objective.Position}
                    onChange={(newPos, idx, val) => {
                      const updated = { ...editingObjective.objective, Position: newPos };
                      setEditingObjective({ ...editingObjective, objective: updated });
                      onChangeField(editingObjective.filePath, ['Position', idx], val);
                    }}
                    onPickFromMap={() => {
                      const originalTab = 'quests';
                      const obj = editingObjective.objective;
                      const path = editingObjective.filePath;
                      setCoordinatePicker({
                        returnTab: originalTab,
                        callback: ({ x, z }) => {
                          const newPos = [x, 0.0, z];
                          const updated = { ...obj, Position: newPos };
                          setEditingObjective({ objective: updated, filePath: path });
                          onChangeField(path, ['Position'], newPos);
                        }
                      });
                      setActiveTab('map');
                      setEditingObjective(null);
                    }}
                    pickLabel={t('quest_label_pick_coords') || "🎯 Pick from Map"}
                    step="0.1"
                    inputStyle={{ border: '1px solid var(--border-color)' }}
                  />
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      type="button"
                      className="btn btn-accent" 
                      onClick={() => {
                        const pos = editingObjective.objective.Position;
                        onNavigateToMap(pos);
                        setEditingObjective(null);
                      }}
                      style={{ padding: '2px 8px', fontSize: '9px' }}
                      title={t('quest_locate_on_map')}
                    >
                      {t('quest_btn_plot_map')}
                    </button>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-secondary)', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '2px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('quest_label_amount') || "Amount"}:</span>
                        <input id="new-col-amt" type="number" defaultValue="1" style={{ width: '70px', fontSize: '12px', padding: '4px', textAlign: 'center' }} />
                      </div>
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

                  {/* ClassNames, ExcludedClassNames, and AllowedWeapons lists */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    
                    {/* Target ClassNames */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>{t('quest_label_target_classnames') || 'TARGET ENTITY CLASSNAMES (EMPTY FOR ANY)'}</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '4px 0', background: 'var(--bg-primary)', padding: '6px', minHeight: '30px', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                        {(editingObjective.objective.ClassNames || []).length === 0 ? (
                          <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>Any target / Любые цели</span>
                        ) : (
                          (editingObjective.objective.ClassNames || []).map((cn, cnIdx) => (
                            <div key={cn} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', padding: '2px 6px', fontSize: '11px' }}>
                              <span>{cn}</span>
                              <button 
                                onClick={() => {
                                  const list = (editingObjective.objective.ClassNames || []).filter(item => item !== cn);
                                  const updated = { ...editingObjective.objective, ClassNames: list };
                                  setEditingObjective({ ...editingObjective, objective: updated });
                                  onChangeField(editingObjective.filePath, ['ClassNames'], list);
                                }}
                                style={{ border: 'none', background: 'transparent', color: 'var(--danger-color)', cursor: 'pointer', padding: 0, fontSize: '12px', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        <ItemAutocomplete
                          suggestions={classnameSuggestions}
                          onAdd={(name) => {
                            const list = [...(editingObjective.objective.ClassNames || []), name];
                            const updated = { ...editingObjective.objective, ClassNames: list };
                            setEditingObjective({ ...editingObjective, objective: updated });
                            onChangeField(editingObjective.filePath, ['ClassNames'], list);
                          }}
                          label={t('quest_btn_add_target')}
                          placeholder={t('quest_ph_classname')}
                        />
                      </div>
                    </div>

                    {/* Excluded ClassNames */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>{t('quest_label_excluded_classnames') || 'EXCLUDED CLASSNAMES'}</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '4px 0', background: 'var(--bg-primary)', padding: '6px', minHeight: '30px', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                        {(editingObjective.objective.ExcludedClassNames || []).length === 0 ? (
                          <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>None / Нет</span>
                        ) : (
                          (editingObjective.objective.ExcludedClassNames || []).map((ecn, ecnIdx) => (
                            <div key={ecn} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', padding: '2px 6px', fontSize: '11px' }}>
                              <span>{ecn}</span>
                              <button 
                                onClick={() => {
                                  const list = (editingObjective.objective.ExcludedClassNames || []).filter(item => item !== ecn);
                                  const updated = { ...editingObjective.objective, ExcludedClassNames: list };
                                  setEditingObjective({ ...editingObjective, objective: updated });
                                  onChangeField(editingObjective.filePath, ['ExcludedClassNames'], list);
                                }}
                                style={{ border: 'none', background: 'transparent', color: 'var(--danger-color)', cursor: 'pointer', padding: 0, fontSize: '12px', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        <ItemAutocomplete
                          suggestions={classnameSuggestions}
                          onAdd={(name) => {
                            const list = [...(editingObjective.objective.ExcludedClassNames || []), name];
                            const updated = { ...editingObjective.objective, ExcludedClassNames: list };
                            setEditingObjective({ ...editingObjective, objective: updated });
                            onChangeField(editingObjective.filePath, ['ExcludedClassNames'], list);
                          }}
                          label={t('quest_btn_add_excluded')}
                          placeholder={t('quest_ph_classname')}
                        />
                      </div>
                    </div>

                    {/* Allowed Weapons */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>{t('quest_label_allowed_weapons')}</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '4px 0', background: 'var(--bg-primary)', padding: '6px', minHeight: '30px', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                        {(editingObjective.objective.AllowedWeapons || []).length === 0 ? (
                          <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>Any weapon / Любое оружие</span>
                        ) : (
                          (editingObjective.objective.AllowedWeapons || []).map((w, wIdx) => (
                            <div key={w} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '2px', padding: '2px 6px', fontSize: '11px' }}>
                              <span>{w}</span>
                              <button 
                                onClick={() => {
                                  const list = (editingObjective.objective.AllowedWeapons || []).filter(item => item !== w);
                                  const updated = { ...editingObjective.objective, AllowedWeapons: list };
                                  setEditingObjective({ ...editingObjective, objective: updated });
                                  onChangeField(editingObjective.filePath, ['AllowedWeapons'], list);
                                }}
                                style={{ border: 'none', background: 'transparent', color: 'var(--danger-color)', cursor: 'pointer', padding: 0, fontSize: '12px', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div style={{ marginTop: '6px' }}>
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

      {/* Quest Audit Modal */}
      {isAuditOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            width: '650px', maxHeight: '80%', borderRadius: '2px', display: 'flex',
            flexDirection: 'column', boxShadow: 'var(--shadow-glow)'
          }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>// {t('quest_audit_title') || "QUEST DIAGNOSTICS"}</span>
                <h3 style={{ margin: '2px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '16px' }}>
                  {t('quest_audit_title') || "Quest Diagnostics Audit"}
                </h3>
              </div>
              <button 
                onClick={() => setIsAuditOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditResults.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6ecb8a', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                  {t('quest_audit_no_issues') || "✓ No circular dependencies, orphaned objectives, or broken connections detected!"}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {auditResults.map((res, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        padding: '10px 12px', 
                        background: 'var(--bg-primary)', 
                        border: `1px solid ${res.type === 'error' ? 'rgba(235,76,60,0.3)' : 'rgba(230,162,60,0.3)'}`,
                        borderLeft: `4px solid ${res.type === 'error' ? 'var(--danger-color)' : 'var(--warning-color)'}`,
                        borderRadius: '2px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px', color: res.type === 'error' ? '#ff6b6b' : '#f0ad4e', display: 'block', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                          {res.category}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-primary)', display: 'block', marginTop: '2px', lineHeight: '1.4' }}>
                          {res.msg}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {res.questId !== undefined && (
                          <button 
                            className="btn"
                            style={{ padding: '4px 8px', fontSize: '10px' }}
                            onClick={() => {
                              const found = positionedNodes.find(n => n.id === res.questId);
                              if (found) {
                                setSelectedQuest(found);
                                if (onSelectQuest) onSelectQuest(found.id);
                                zoomToNode(found);
                              }
                              setIsAuditOpen(false);
                            }}
                          >
                            🔍 {lang === 'ru' ? 'ПЕРЕЙТИ' : 'GOTO'}
                          </button>
                        )}
                        {res.action && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: '10px' }}
                            onClick={res.action}
                          >
                            🛠️ {lang === 'ru' ? 'ИСПРАВИТЬ' : 'FIX'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setIsAuditOpen(false)}>
                {t('quest_btn_close') || "Close"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Preset emotes list
const EMOTE_PRESETS = [
  { id: 46, label: "Sitting / Idle (46)" },
  { id: 1, label: "Wave / Greet (1)" },
  { id: 11, label: "Salute (11)" },
  { id: 39, label: "Thumb Up (39)" },
  { id: 58, label: "Quest Start (58)" },
  { id: 60, label: "Quest Cancel (60)" },
  { id: 2, label: "Heart (2)" },
  { id: 3, label: "Thumbs Down (3)" }
];

// Preset factions list
const FACTIONS = [
  'InvincibleObservers',
  'West',
  'East',
  'Guards',
  'Civilian',
  'Passive',
  'Aggressive',
  'Shamans',
  'Survivors'
];

function QuestNPCsManager({
  configs,
  onChangeField,
  onCreateFile,
  onDeleteFile,
  setCoordinatePicker,
  setActiveTab,
  xmlItems,
  t,
  lang
}) {
  const [selectedNpcId, setSelectedNpcId] = useState(() => {
    const saved = localStorage.getItem('dayz_editor_quest_selected_npc_id');
    return saved ? Number(saved) : null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [forceManualLoadout, setForceManualLoadout] = useState(false);

  useEffect(() => {
    setForceManualLoadout(false);
  }, [selectedNpcId]);

  // Get NPCs list
  const npcs = useMemo(() => {
    const list = [];
    Object.entries(configs).forEach(([path, file]) => {
      if (file.success && file.content && path.toLowerCase().startsWith('expansionmod/quests/npcs/questnpc_') && file.content.ID !== undefined) {
        list.push({
          filePath: path,
          content: file.content
        });
      }
    });
    return list.sort((a, b) => a.content.ID - b.content.ID);
  }, [configs]);

  const selectNpc = (id) => {
    setSelectedNpcId(id);
    if (id !== null) {
      localStorage.setItem('dayz_editor_quest_selected_npc_id', id);
    } else {
      localStorage.removeItem('dayz_editor_quest_selected_npc_id');
    }
  };

  const selectedNpc = npcs.find(n => n.content.ID === selectedNpcId);

  // Get Loadouts list from configs
  const loadoutsList = useMemo(() => {
    const list = [];
    Object.keys(configs).forEach(filePath => {
      const lower = filePath.toLowerCase();
      if (lower.startsWith('expansionmod/loadouts/') && filePath.endsWith('.json')) {
        const name = filePath.split('/').pop().replace('.json', '');
        list.push(name);
      }
    });
    return list.sort();
  }, [configs]);

  const currentLoadout = selectedNpc?.content?.NPCLoadoutFile || '';
  const isCustomLoadout = currentLoadout !== '' && !loadoutsList.includes(currentLoadout);
  const useManual = isCustomLoadout || forceManualLoadout;

  const handleGoToLoadout = () => {
    if (!currentLoadout) return;
    const path = `ExpansionMod/Loadouts/${currentLoadout}.json`;
    localStorage.setItem('dayz_editor_aibots_active_tab', 'loadouts');
    localStorage.setItem('dayz_editor_aibots_selected_loadout_path', path);
    setActiveTab('aibots');
  };

  const filteredNpcs = npcs.filter(npc => {
    const name = (npc.content.NPCName || '').toLowerCase();
    const className = (npc.content.ClassName || '').toLowerCase();
    const id = String(npc.content.ID);
    const query = searchQuery.toLowerCase();
    return name.includes(query) || className.includes(query) || id.includes(query);
  });

  const handleCreateNpc = () => {
    const maxId = npcs.reduce((max, npc) => Math.max(max, npc.content.ID || 0), 0);
    const newId = maxId + 1;
    const filePath = `ExpansionMod/Quests/NPCs/QuestNPC_${newId}.json`;
    const newNpc = {
      ConfigVersion: 6,
      ID: newId,
      ClassName: "ExpansionQuestNPCDenis",
      Position: [0.0, 0.0, 0.0],
      Orientation: [0.0, 0.0, 0.0],
      NPCName: `New NPC #${newId}`,
      DefaultNPCText: "Hello! How can I help you?",
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
    onCreateFile(filePath, newNpc);
    selectNpc(newId);
  };

  const handleDeleteNpc = (npc) => {
    const confirmMsg = t('quest_npc_confirm_delete', { name: npc.content.NPCName, id: npc.content.ID }) || `Are you sure you want to delete NPC "${npc.content.NPCName}" (ID ${npc.content.ID})?`;
    if (window.confirm(confirmMsg)) {
      onDeleteFile(npc.filePath);
      if (selectedNpcId === npc.content.ID) {
        selectNpc(null);
      }
    }
  };

  const classnameSuggestions = useMemo(() => {
    const classnames = new Set();
    Object.values(configs).forEach(file => {
      if (file.success && file.content) {
        const content = file.content;
        if (content.ClassName) classnames.add(content.ClassName);
      }
    });
    (Array.isArray(xmlItems) ? xmlItems : []).forEach(item => {
      if (typeof item === 'string') classnames.add(item);
    });
    return Array.from(classnames).sort();
  }, [configs, xmlItems]);

  return (
    <div style={{ display: 'flex', flex: 1, height: 'calc(100% - 42px)', overflow: 'hidden' }}>
      
      {/* LEFT COLUMN: NPC List */}
      <div style={{
        width: '320px',
        borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-tertiary)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0
      }}>
        {/* Header/Search Area */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-glow)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-heading)' }}>
            {t('quest_npc_manager_title') || "QUEST NPCS CONFIGURATION"}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {t('quest_npc_total', { count: npcs.length }) || `TOTAL: ${npcs.length} NPCS ON DISK`}
          </div>
          
          <button 
            className="btn btn-accent"
            onClick={handleCreateNpc}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', margin: '4px 0' }}
          >
            <span>{t('quest_npc_btn_create') || "CREATE NEW NPC"}</span>
          </button>

          <input 
            type="text"
            placeholder={lang === 'ru' ? 'Поиск NPC...' : 'Search NPCs...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border-color)',
              borderRadius: '2px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* NPCs List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {filteredNpcs.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'center', marginTop: '20px', fontFamily: 'var(--font-mono)' }}>
              {lang === 'ru' ? 'NPC не найдены' : 'No NPCs found'}
            </div>
          ) : (
            filteredNpcs.map(npc => {
              const isSelected = npc.content.ID === selectedNpcId;
              return (
                <div 
                  key={npc.content.ID}
                  onClick={() => selectNpc(npc.content.ID)}
                  style={{
                    padding: '10px 12px',
                    background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    marginBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ overflow: 'hidden', marginRight: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        [ID {npc.content.ID}]
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: isSelected ? 'var(--text-glow)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {npc.content.NPCName || `NPC #${npc.content.ID}`}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {npc.content.ClassName}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNpc(npc);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '4px 8px',
                      borderRadius: '2px',
                      transition: 'color 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    title={lang === 'ru' ? 'Удалить NPC' : 'Delete NPC'}
                  >
                    🗑
                  </button>
                </div>
              );
            })
          )}
        </div>



      </div>

      {/* RIGHT COLUMN: Form Editor */}
      <div style={{ flex: 1, background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
        {!selectedNpc ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            padding: '40px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.1))' }}>👤</div>
            <div style={{ fontSize: '14px', color: 'var(--text-glow)', fontWeight: 'bold', marginBottom: '4px' }}>
              {lang === 'ru' ? 'Персонаж не выбран' : 'No NPC Selected'}
            </div>
            <div style={{ fontSize: '11px' }}>
              {lang === 'ru' ? 'Выберите NPC из списка слева или создайте нового.' : 'Select an NPC from the list or create a new one.'}
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px', maxWidth: '1200px' }}>
            
            {/* Form Title */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  // {t('quest_npc_editing') || "EDITING NPC: "} ID {selectedNpc.content.ID}
                </span>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-glow)', marginTop: '2px' }}>
                  {selectedNpc.content.NPCName || `NPC #${selectedNpc.content.ID}`}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {selectedNpc.filePath}
                </span>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* General Properties Card */}
              <FormCard title="// GENERAL SETTINGS">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Name Input */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                      NPC NAME
                    </label>
                    <input 
                      type="text"
                      value={selectedNpc.content.NPCName || ''}
                      onChange={e => onChangeField(selectedNpc.filePath, ['NPCName'], e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '2px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Faction Dropdown */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                      {t('quest_npc_label_faction') || "NPC FACTION"}
                    </label>
                    <select
                      value={selectedNpc.content.NPCFaction || 'InvincibleObservers'}
                      onChange={e => onChangeField(selectedNpc.filePath, ['NPCFaction'], e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '2px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    >
                      {FACTIONS.map(fac => (
                        <option key={fac} value={fac}>{fac}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Classname Autocomplete */}
                <div style={{ marginTop: '16px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                    CLASSNAME
                  </label>
                  {classnameSuggestions.length === 0 && (
                    <div style={{ fontSize: '10px', color: '#f0ad4e', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                      {t('quest_warning_xml_missing') || "⚠️ Items database (types.xml) is not loaded. Autocomplete is limited to local files."}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <AutocompleteInput 
                        suggestions={classnameSuggestions}
                        placeholder="e.g. ExpansionQuestNPCDenis"
                        value={selectedNpc.content.ClassName || ''}
                        onChange={val => onChangeField(selectedNpc.filePath, ['ClassName'], val)}
                        onSelect={val => onChangeField(selectedNpc.filePath, ['ClassName'], val)}
                        buttonLabel={lang === 'ru' ? 'Выбрать' : 'Select'}
                        layout="horizontal"
                      />
                    </div>
                  </div>
                </div>
              </FormCard>

              {/* Position and Orientation Card */}
              <FormCard title="// SPAWN POSITION & ORIENTATION">
                <CoordinatesInput
                  label="POSITION"
                  position={selectedNpc.content.Position}
                  onChange={(newPos, idx, val) => {
                    onChangeField(selectedNpc.filePath, ['Position'], newPos);
                  }}
                  onPickFromMap={() => {
                    setCoordinatePicker({
                      returnTab: 'quests',
                      callback: ({ x, z }) => {
                        const newPos = [x, 0.0, z];
                        onChangeField(selectedNpc.filePath, ['Position'], newPos);
                      }
                    });
                    setActiveTab('map');
                  }}
                  pickLabel={t('quest_label_pick_coords') || "🎯 Pick from Map"}
                  step="0.0001"
                  style={{ marginBottom: '16px' }}
                  inputStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '12px' }}
                />

                {/* Orientation Yaw Pitch Roll */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {['YAW (Y)', 'PITCH (X)', 'ROLL (Z)'].map((axis, idx) => {
                    const val = Array.isArray(selectedNpc.content.Orientation) ? (selectedNpc.content.Orientation[idx] ?? 0.0) : 0.0;
                    return (
                      <div key={axis}>
                        <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                          {axis}
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          value={val}
                          onChange={e => {
                            const newOri = Array.isArray(selectedNpc.content.Orientation) ? [...selectedNpc.content.Orientation] : [0.0, 0.0, 0.0];
                            newOri[idx] = Number(e.target.value);
                            onChangeField(selectedNpc.filePath, ['Orientation'], newOri);
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '2px',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </FormCard>

              {/* Dialogue & Loadout Card */}
              <FormCard title="// DIALOGUE & VISUAL APPEARANCE">

                {/* Dialogue Text */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                    {t('quest_npc_label_dialogue') || "DEFAULT DIALOGUE TEXT"}
                  </label>
                  <textarea
                    rows={3}
                    value={selectedNpc.content.DefaultNPCText || ''}
                    onChange={e => onChangeField(selectedNpc.filePath, ['DefaultNPCText'], e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '2px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
                  {/* Loadout Profile */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                        {t('quest_npc_label_loadout') || "LOADOUT PROFILE"}
                      </label>
                      <button
                        onClick={() => setForceManualLoadout(!useManual)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: '0',
                          textDecoration: 'underline'
                        }}
                      >
                        {useManual 
                          ? (lang === 'ru' ? 'Выбрать из списка' : 'Select from list')
                          : (lang === 'ru' ? 'Ввести вручную' : 'Enter manually')
                        }
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {useManual ? (
                        <input 
                          type="text"
                          value={currentLoadout}
                          onChange={e => onChangeField(selectedNpc.filePath, ['NPCLoadoutFile'], e.target.value)}
                          placeholder="e.g. NBCLoadout"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '2px',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            boxSizing: 'border-box'
                          }}
                        />
                      ) : (
                        <select
                          value={currentLoadout}
                          onChange={e => onChangeField(selectedNpc.filePath, ['NPCLoadoutFile'], e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '2px',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">-- {lang === 'ru' ? 'Без экипировки (Пусто)' : 'No Loadout (Empty)'} --</option>
                          {loadoutsList.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      )}

                      {currentLoadout && (
                        <button
                          onClick={handleGoToLoadout}
                          className="btn"
                          title={lang === 'ru' ? "Открыть этот пресет во вкладке ИИ Боты" : "Open this loadout preset in AI Bots tab"}
                          style={{
                            padding: '0 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            flexShrink: 0
                          }}
                        >
                          📂
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Toggle & Static Emote */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
                      ADDITIONAL FLAGS
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                        <input 
                          type="checkbox"
                          checked={selectedNpc.content.Active === 1}
                          onChange={e => onChangeField(selectedNpc.filePath, ['Active'], e.target.checked ? 1 : 0)}
                        />
                        <span>ACTIVE ON DISK</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                        <input 
                          type="checkbox"
                          checked={selectedNpc.content.NPCEmoteIsStatic === 1}
                          onChange={e => onChangeField(selectedNpc.filePath, ['NPCEmoteIsStatic'], e.target.checked ? 1 : 0)}
                        />
                        <span>STATIC STARTING EMOTE</span>
                      </label>
                    </div>
                  </div>
                </div>

              </FormCard>

              {/* Emotes Configuration Card */}
              <FormCard title="// EMOTE TRIGGERS" style={{ marginBottom: '20px' }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  
                  {[
                    { label: t('quest_npc_label_emote') || "STARTING EMOTE", key: 'NPCEmoteID' },
                    { label: t('quest_npc_label_interact_emote') || "INTERACTION EMOTE", key: 'NPCInteractionEmoteID' },
                    { label: t('quest_npc_label_start_emote') || "QUEST START EMOTE", key: 'NPCQuestStartEmoteID' },
                    { label: t('quest_npc_label_cancel_emote') || "QUEST CANCEL EMOTE", key: 'NPCQuestCancelEmoteID' },
                    { label: t('quest_npc_label_complete_emote') || "QUEST COMPLETE EMOTE", key: 'NPCQuestCompleteEmoteID' }
                  ].map(emoteField => {
                    const currentVal = selectedNpc.content[emoteField.key] ?? 0;
                    return (
                      <div key={emoteField.key}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                          {emoteField.label}
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input 
                            type="number"
                            value={currentVal}
                            onChange={e => onChangeField(selectedNpc.filePath, [emoteField.key], Number(e.target.value))}
                            style={{
                              width: '80px',
                              padding: '6px 8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '2px',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              fontFamily: 'var(--font-mono)',
                              boxSizing: 'border-box'
                            }}
                          />
                          <select
                            value={EMOTE_PRESETS.some(p => p.id === currentVal) ? currentVal : ''}
                            onChange={e => {
                              if (e.target.value !== '') {
                                onChangeField(selectedNpc.filePath, [emoteField.key], Number(e.target.value));
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '2px',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="">-- {lang === 'ru' ? 'Выберите пресет' : 'Select preset'} --</option>
                            {EMOTE_PRESETS.map(preset => (
                              <option key={preset.id} value={preset.id}>{preset.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}

                </div>
              </FormCard>

            </div>

          </div>
        )}
      </div>

    </div>
  );
}
