/**
 * Strips UTF-8 BOM, single-line (//) and multi-line block comments, 
 * and trailing commas from raw JSON text before parsing.
 * @param {string} rawText 
 * @returns {string} Cleaned JSON string
 */
export function cleanJsonComments(rawText) {
  if (!rawText) return "";
  const contentCleaned = rawText.replace(/^\uFEFF/, '');
  try {
    JSON.parse(contentCleaned);
    return contentCleaned;
  } catch (e) {
    const strippedComments = contentCleaned
      .replace(/("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/.*$/gm, (match, stringGroup) => {
        return stringGroup ? stringGroup : '';
      });
    
    const strippedCommas = strippedComments
      .replace(/("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*")|,\s*([\]}])/g, (match, stringGroup, brace) => {
        return stringGroup ? stringGroup : brace;
      });

    return strippedCommas;
  }
}

// Helper to get default value based on schema type
export function getDefaultValueForType(propSchema) {
  if (propSchema.sample !== undefined && propSchema.sample !== null) {
    return propSchema.sample;
  }
  switch (propSchema.type) {
    case 'number': return 0;
    case 'string': return '';
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    case 'vector3': return [7500.0, 0.0, 7500.0];
    case 'color': return [255, 255, 255, 255];
    default: return null;
  }
}

// Recursively traverse and validate a JSON object against its schema
export function validateConfig(content, schema, filePath, allQuestsIds = new Set(), marketCategories = new Set(), marketItems = new Set(), configs = {}) {
  const errors = [];

  function validateNode(node, nodeSchema, pathArray) {
    if (!nodeSchema) return;

    // 1. Missing keys check
    if (nodeSchema.type === 'object' && nodeSchema.properties) {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) {
        errors.push({
          path: pathArray,
          type: 'type_mismatch',
          expectedType: 'object',
          actualType: Array.isArray(node) ? 'array' : typeof node,
          value: node,
          message: `Expected object structure, found ${Array.isArray(node) ? 'array' : typeof node}`,
          fixable: true,
          defaultValue: {}
        });
        return;
      }

      for (const [key, propSchema] of Object.entries(nodeSchema.properties)) {
        if (node[key] === undefined) {
          errors.push({
            path: [...pathArray, key],
            type: 'missing_key',
            expectedType: propSchema.type,
            value: undefined,
            message: `Property "${key}" is missing in config`,
            fixable: true,
            defaultValue: getDefaultValueForType(propSchema)
          });
        } else {
          validateNode(node[key], propSchema, [...pathArray, key]);
        }
      }
      return;
    }

    // 2. Array validation
    if (nodeSchema.type === 'array' && nodeSchema.items) {
      if (!Array.isArray(node)) {
        errors.push({
          path: pathArray,
          type: 'type_mismatch',
          expectedType: 'array',
          actualType: typeof node,
          value: node,
          message: `Expected array, found ${typeof node}`,
          fixable: true,
          defaultValue: []
        });
        return;
      }

      node.forEach((item, idx) => {
        validateNode(item, nodeSchema.items, [...pathArray, idx]);
      });
      return;
    }

    // 3. Vector3 validation
    if (nodeSchema.type === 'vector3') {
      if (!Array.isArray(node) || node.length !== 3 || !node.every(x => typeof x === 'number')) {
        errors.push({
          path: pathArray,
          type: 'type_mismatch',
          expectedType: 'vector3',
          actualType: typeof node,
          value: node,
          message: `Expected 3D Vector array [x, y, z], found invalid structure`,
          fixable: true,
          defaultValue: [7500.0, 0.0, 7500.0]
        });
      }
      return;
    }

    // 4. Color validation
    if (nodeSchema.type === 'color') {
      if (!Array.isArray(node) || (node.length !== 3 && node.length !== 4) || !node.every(x => typeof x === 'number')) {
        errors.push({
          path: pathArray,
          type: 'type_mismatch',
          expectedType: 'color',
          actualType: typeof node,
          value: node,
          message: `Expected color array [r, g, b, (a)], found invalid structure`,
          fixable: true,
          defaultValue: [255, 255, 255, 255]
        });
      }
      return;
    }

    // 5. Primitive type checking
    const actualType = typeof node;
    const expected = nodeSchema.type;

    if (expected === 'number' && actualType !== 'number') {
      // Tolerate boolean values (true/false) as numbers (1/0)
      if (typeof node === 'boolean') {
        return;
      }
      const parsedNum = Number(node);
      const isFixable = !isNaN(parsedNum) && node !== '' && node !== null;
      errors.push({
        path: pathArray,
        type: 'type_mismatch',
        expectedType: 'number',
        actualType,
        value: node,
        message: `Type mismatch: expected number, found ${actualType}`,
        fixable: isFixable,
        defaultValue: isFixable ? parsedNum : 0
      });
    } else if (expected === 'boolean' && actualType !== 'boolean') {
      // Tolerate DayZ boolean integer representation (1, 0, '1', '0')
      if (node === 1 || node === 0 || node === '1' || node === '0') {
        return;
      }
      const isFixable = true;
      let boolVal = false;
      if (node === 1 || node === '1' || node === 'true' || node === true) {
        boolVal = true;
      }
      errors.push({
        path: pathArray,
        type: 'type_mismatch',
        expectedType: 'boolean',
        actualType,
        value: node,
        message: `Type mismatch: expected boolean, found ${actualType}`,
        fixable: isFixable,
        defaultValue: boolVal
      });
    } else if (expected === 'string' && actualType !== 'string') {
      errors.push({
        path: pathArray,
        type: 'type_mismatch',
        expectedType: 'string',
        actualType,
        value: node,
        message: `Type mismatch: expected string, found ${actualType}`,
        fixable: true,
        defaultValue: String(node)
      });
    }
  }

  // Run schema validation if schema is present
  if (schema) {
    validateNode(content, schema, []);
  }

  // 6. Cross-reference validations (broken quest links, cycles, orphans, objectives)
  const isQuestFile = filePath.toLowerCase().includes('quests/quests/quest_');
  if (isQuestFile && content && typeof content === 'object') {
    // Check FollowUpQuest link
    if (content.FollowUpQuest && content.FollowUpQuest > 0) {
      if (!allQuestsIds.has(content.FollowUpQuest)) {
        errors.push({
          path: ['FollowUpQuest'],
          type: 'broken_link',
          value: content.FollowUpQuest,
          message: `Broken Quest Link: Quest links to non-existent follow-up Quest ID ${content.FollowUpQuest}`,
          fixable: true,
          defaultValue: 0
        });
      }
    }

    // Check PreQuestIDs links
    if (Array.isArray(content.PreQuestIDs)) {
      const invalidPre = content.PreQuestIDs.filter(id => !allQuestsIds.has(id));
      if (invalidPre.length > 0) {
        errors.push({
          path: ['PreQuestIDs'],
          type: 'broken_link',
          value: content.PreQuestIDs,
          message: `Broken Quest Link: Prerequisites contain non-existent Quest IDs: [${invalidPre.join(', ')}]`,
          fixable: true,
          defaultValue: content.PreQuestIDs.filter(id => !invalidPre.includes(id))
        });
      }
    }

    // Prerequisite Cycles Check
    if (content.ID !== undefined && configs && Object.keys(configs).length > 0) {
      const questPrereqs = {};
      Object.values(configs).forEach(f => {
        if (f && f.success && f.content && f.filePath && f.filePath.toLowerCase().includes('quests/quests/quest_')) {
          if (f.content.ID !== undefined) {
            questPrereqs[f.content.ID] = Array.isArray(f.content.PreQuestIDs) ? f.content.PreQuestIDs : [];
          }
        }
      });

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

      const cycle = findCycle(content.ID);
      if (cycle) {
        errors.push({
          path: ['PreQuestIDs'],
          type: 'quest_cycle',
          value: content.PreQuestIDs,
          message: `Prerequisite Cycle Detected: Quest forms a cycle: ${cycle.join(' -> ')}`,
          fixable: false
        });
      }
    }

    // Orphan Quests Check
    const hasPreQuests = Array.isArray(content.PreQuestIDs) && content.PreQuestIDs.length > 0;
    const hasQuestGivers = Array.isArray(content.QuestGiverIDs) && content.QuestGiverIDs.length > 0;
    if (!hasPreQuests && !hasQuestGivers) {
      errors.push({
        path: [],
        type: 'orphan_quest',
        value: content.ID,
        message: `Orphaned Quest: Quest ID ${content.ID} has no prerequisites (PreQuestIDs) and no quest givers (QuestGiverIDs). It cannot be started.`,
        fixable: false
      });
    }

    // Broken Objectives Check
    if (Array.isArray(content.Objectives) && configs && Object.keys(configs).length > 0) {
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

      content.Objectives.forEach((obj, idx) => {
        if (obj && obj.ID !== undefined && obj.ObjectiveType !== undefined) {
          const typeId = obj.ObjectiveType;
          const objId = obj.ID;
          const info = OBJECTIVE_TYPES[typeId];
          if (!info) {
            errors.push({
              path: ['Objectives', idx],
              type: 'broken_link',
              value: obj,
              message: `Unknown Objective Type: Objective #${idx + 1} has invalid ObjectiveType ${typeId}`,
              fixable: false
            });
          } else {
            const suffix = `quests/objectives/${info.folder.toLowerCase()}/objective_${info.prefix.toLowerCase()}_${objId}.json`;
            const exists = Object.keys(configs).some(k => k.toLowerCase().endsWith(suffix));
            if (!exists) {
              errors.push({
                path: ['Objectives', idx],
                type: 'broken_link',
                value: obj,
                message: `Broken Objective Link: Objective #${idx + 1} (Type: ${info.label}, ID: ${objId}) references file that does not exist in objectives folder.`,
                fixable: false
              });
            }
          }
        }
      });
    }
  }

  // 7. Cross-reference validations for Traders (obsolete categories and items)
  const isTraderFile = filePath.toLowerCase().includes('traders/');
  if (isTraderFile && content && typeof content === 'object') {
    // Check Categories
    if (Array.isArray(content.Categories)) {
      content.Categories.forEach((catStr, idx) => {
        const catName = catStr.includes(':') ? catStr.split(':')[0] : catStr;
        if (!marketCategories.has(catName.toLowerCase())) {
          errors.push({
            path: ['Categories', idx],
            type: 'broken_link',
            value: catStr,
            message: `Missing Category File: Trader references market category "${catName}" which does not exist in Market database.`,
            fixable: true,
            defaultValue: null
          });
        }
      });
    }

    // Check Items
    if (content.Items && typeof content.Items === 'object') {
      Object.keys(content.Items).forEach(classname => {
        if (!marketItems.has(classname.toLowerCase())) {
          errors.push({
            path: ['Items', classname],
            type: 'broken_link',
            value: classname,
            message: `Obsolete Item Override: Trader overrides item "${classname}" which does not exist in Market database.`,
            fixable: true,
            defaultValue: null
          });
        }
      });
    }
  }

  return errors;
}
