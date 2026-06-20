/**
 * Validates all dirty configuration files before export.
 * @param {Object} configs - The full configs map from App state.
 * @returns {Array<{ filePath: string, severity: 'error'|'warning', message: string }>}
 */
export function validateBeforeExport(configs) {
  const issues = [];

  // Extract all Quest IDs
  const allQuestsIds = new Set();
  const questPrereqs = {};
  Object.entries(configs).forEach(([p, f]) => {
    if (f.success && f.content && p.toLowerCase().includes('quests/quests/quest_')) {
      if (f.content.ID !== undefined) {
        allQuestsIds.add(f.content.ID);
        questPrereqs[f.content.ID] = Array.isArray(f.content.PreQuestIDs) ? f.content.PreQuestIDs : [];
      }
    }
  });

  // Cycle checker DFS
  const findCycle = (startId) => {
    const visited = new Set();
    const recStack = new Set();
    const path = [];

    const dfs = (id) => {
      visited.add(id);
      recStack.add(id);
      path.push(id);

      const pres = questPrereqs[id] || [];
      for (const preId of pres) {
        if (!visited.has(preId)) {
          if (dfs(preId)) return true;
        } else if (recStack.has(preId)) {
          const idx = path.indexOf(preId);
          if (idx !== -1) {
            path.push(preId);
            return true;
          }
        }
      }

      recStack.delete(id);
      path.pop();
      return false;
    };

    if (dfs(startId)) {
      return path;
    }
    return null;
  };

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

  Object.entries(configs).forEach(([path, file]) => {
    if (!file.success || !file.content || !file.originalContent) return;

    // Only validate files that have been modified
    const isDirty = file.isDirty;
    if (!isDirty) return;

    const lp = path.toLowerCase();
    const shortName = path.split('/').pop();

    // ─── Market Categories ───────────────────────────────────────────────────
    if (lp.includes('market/') && Array.isArray(file.content.Items)) {
      file.content.Items.forEach((item, idx) => {
        if (!item.ClassName || item.ClassName.trim() === '') {
          issues.push({
            filePath: path,
            severity: 'error',
            message: `${shortName} → Item #${idx + 1}: ClassName is empty.`,
          });
        }
        if (
          typeof item.MinPriceThreshold === 'number' &&
          typeof item.MaxPriceThreshold === 'number' &&
          item.MinPriceThreshold > item.MaxPriceThreshold
        ) {
          issues.push({
            filePath: path,
            severity: 'warning',
            message: `${shortName} → "${item.ClassName}": MinPrice (${item.MinPriceThreshold}) > MaxPrice (${item.MaxPriceThreshold}).`,
          });
        }
        if (
          typeof item.MinStockThreshold === 'number' &&
          typeof item.MaxStockThreshold === 'number' &&
          item.MinStockThreshold > item.MaxStockThreshold
        ) {
          issues.push({
            filePath: path,
            severity: 'warning',
            message: `${shortName} → "${item.ClassName}": MinStock (${item.MinStockThreshold}) > MaxStock (${item.MaxStockThreshold}).`,
          });
        }
      });
    }

    // ─── Quests ──────────────────────────────────────────────────────────────
    if (lp.includes('quests/quests/quest_')) {
      if (!file.content.Title || file.content.Title.trim() === '') {
        issues.push({
          filePath: path,
          severity: 'warning',
          message: `${shortName}: Quest Title is empty.`,
        });
      }

      // Check FollowUpQuest link
      if (file.content.FollowUpQuest && file.content.FollowUpQuest > 0) {
        if (!allQuestsIds.has(file.content.FollowUpQuest)) {
          issues.push({
            filePath: path,
            severity: 'error',
            message: `${shortName}: Follow-up Quest ID ${file.content.FollowUpQuest} does not exist.`,
          });
        }
      }

      // Check PreQuestIDs links
      if (Array.isArray(file.content.PreQuestIDs)) {
        const invalidPre = file.content.PreQuestIDs.filter(id => !allQuestsIds.has(id));
        if (invalidPre.length > 0) {
          issues.push({
            filePath: path,
            severity: 'error',
            message: `${shortName}: Prerequisites contain non-existent Quest IDs: [${invalidPre.join(', ')}]`,
          });
        }
      }

      // Prerequisite cycle check
      if (file.content.ID !== undefined) {
        const cycle = findCycle(file.content.ID);
        if (cycle) {
          issues.push({
            filePath: path,
            severity: 'error',
            message: `${shortName}: Prerequisite Cycle Detected: ${cycle.join(' -> ')}`,
          });
        }
      }

      // Orphan check
      const hasPreQuests = Array.isArray(file.content.PreQuestIDs) && file.content.PreQuestIDs.length > 0;
      const hasQuestGivers = Array.isArray(file.content.QuestGiverIDs) && file.content.QuestGiverIDs.length > 0;
      if (!hasPreQuests && !hasQuestGivers) {
        issues.push({
          filePath: path,
          severity: 'warning',
          message: `${shortName}: Orphaned Quest: Has no prerequisites (PreQuestIDs) and no quest givers (QuestGiverIDs). It cannot be started.`,
        });
      }

      // Objectives check
      if (Array.isArray(file.content.Objectives)) {
        file.content.Objectives.forEach((obj, idx) => {
          // Note: ObjectiveName is an editor-only label, not validated here

          if (obj && obj.ID !== undefined && obj.ObjectiveType !== undefined) {
            const typeId = obj.ObjectiveType;
            const objId = obj.ID;
            const info = OBJECTIVE_TYPES[typeId];
            if (!info) {
              issues.push({
                filePath: path,
                severity: 'error',
                message: `${shortName} → Objective #${idx + 1}: Invalid or unknown ObjectiveType ${typeId}`,
              });
            } else {
              const suffix = `quests/objectives/${info.folder.toLowerCase()}/objective_${info.prefix.toLowerCase()}_${objId}.json`;
              const exists = Object.keys(configs).some(k => k.toLowerCase().endsWith(suffix));
              if (!exists) {
                issues.push({
                  filePath: path,
                  severity: 'error',
                  message: `${shortName} → Objective #${idx + 1} (Type: ${info.label}, ID: ${objId}): References objective file that does not exist in objectives folder.`,
                });
              }
            }
          }
        });
      }
    }

    // ─── AI Patrol Settings ──────────────────────────────────────────────────
    if (lp.endsWith('settings/aipatrolsettings.json') && Array.isArray(file.content.Patrols)) {
      file.content.Patrols.forEach((patrol, idx) => {
        const name = patrol.Name || `Patrol #${idx + 1}`;
        if (Array.isArray(patrol.Waypoints)) {
          const hasZero = patrol.Waypoints.some(wp =>
            Array.isArray(wp.Position) &&
            wp.Position[0] === 0 &&
            wp.Position[2] === 0
          );
          if (hasZero) {
            issues.push({
              filePath: path,
              severity: 'warning',
              message: `Patrol "${name}": has waypoint(s) at [0, y, 0] (likely unset coordinates).`,
            });
          }
        }
      });
    }

    // ─── Safe Zone Settings ──────────────────────────────────────────────────
    if (lp.endsWith('settings/safezonesettings.json')) {
      const allZones = [
        ...(file.content.CircleZones  || []),
        ...(file.content.PolygonZones || []),
        ...(file.content.CylinderZones || []),
      ];
      allZones.forEach((zone, idx) => {
        if (zone.Position) {
          const pos = zone.Position;
          const x = Array.isArray(pos) ? pos[0] : pos.x;
          const z = Array.isArray(pos) ? pos[2] : pos.z;
          if (x === 0 && z === 0) {
            issues.push({
              filePath: path,
              severity: 'warning',
              message: `SafeZone #${idx + 1}: position is [0, y, 0] (likely unset).`,
            });
          }
        }
      });
    }
  });

  return issues;
}
