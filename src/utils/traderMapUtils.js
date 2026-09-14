/**
 * DayZ Expansion Trader .map format utilities
 * Handles parsing, generation, and clothing/wardrobe presets for native DayZ Expansion trader spawning.
 *
 * Line Format:
 * <NPCModel>.<TraderFileName>|<X> <Y> <Z>|<Yaw> <Pitch> <Roll>|<Cloth1,Cloth2,Cloth3...>
 */

export const TRADER_OUTFIT_PRESETS = {
  hunter: {
    id: 'hunter',
    labelRu: '🏹 Охотник (Hunter)',
    labelEn: '🏹 Hunter',
    clothing: [
      'HuntingJacket_Summer',
      'HunterPants_Spring',
      'CombatBoots_Green',
      'CowboyHat_black',
      'HuntingBag',
      'WorkingGloves_Black'
    ]
  },
  military: {
    id: 'military',
    labelRu: '🪖 Военный / Оружейник (Military)',
    labelEn: '🪖 Military / Gunsmith',
    clothing: [
      'GorkaEJacket_Flat',
      'GorkaPants_Flat',
      'CombatBoots_Black',
      'BallisticHelmet_Black',
      'UKAssVest_Black',
      'TacticalGloves_Black'
    ]
  },
  medic: {
    id: 'medic',
    labelRu: '🩺 Медик (Medic)',
    labelEn: '🩺 Medic / Paramedic',
    clothing: [
      'ParamedicJacket_Crimson',
      'ParamedicPants_Crimson',
      'WorkingBoots_Brown',
      'SurgicalMask',
      'SurgicalGloves_Green',
      'MountainBag_Red'
    ]
  },
  mechanic: {
    id: 'mechanic',
    labelRu: '🔧 Автомеханик (Mechanic)',
    labelEn: '🔧 Mechanic',
    clothing: [
      'QuiltedJacket_Grey',
      'CargoPants_Grey',
      'WorkingBoots_Brown',
      'ReflexVest',
      'WorkingGloves_Black',
      'BaseballCap_Beige'
    ]
  },
  business: {
    id: 'business',
    labelRu: '👔 Деловой костюм (Business)',
    labelEn: '👔 Business Suit',
    clothing: [
      'ManSuit_Blue',
      'SlacksPants_Blue',
      'DressShoes_Brown',
      'FlatCap_BlackCheck',
      'CivilianBelt',
      'ThinFramesGlasses'
    ]
  },
  police: {
    id: 'police',
    labelRu: '👮 Полицейский (Police)',
    labelEn: '👮 Police Officer',
    clothing: [
      'PoliceJacket',
      'PolicePants',
      'CombatBoots_Black',
      'PoliceCap',
      'AviatorGlasses',
      'CivilianBelt'
    ]
  },
  survivor: {
    id: 'survivor',
    labelRu: '📦 Выживший (Survivor)',
    labelEn: '📦 Survivor',
    clothing: [
      'Shirt_BlueCheck',
      'CargoPants_Beige',
      'AthleticShoes_Blue',
      'BaseballCap_Black',
      'DryBag_Blue'
    ]
  }
};

/**
 * Parses a single .map line into structured trader spawn object.
 * @param {string} line 
 * @returns {object|null}
 */
export function parseTraderMapLine(line) {
  if (!line || typeof line !== 'string') return null;
  let trimmed = line.trim();

  // Strip surrounding quotes or JSON serialization artifacts
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const unjson = JSON.parse(trimmed);
      if (typeof unjson === 'string') trimmed = unjson.trim();
    } catch (e) {
      trimmed = trimmed.slice(1, -1).trim();
    }
  }

  // Clean unescaped slashes/newlines
  trimmed = trimmed.replace(/\\r/g, '').replace(/\\n/g, '').replace(/\\"/g, '"').replace(/\r/g, '').replace(/\n/g, '').trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return null;

  const parts = trimmed.split('|');
  if (parts.length < 2) return null;

  const header = parts[0].trim().replace(/^["']|["']$/g, '');
  const dotIndex = header.indexOf('.');
  const npcModel = dotIndex !== -1 ? header.substring(0, dotIndex).trim() : header;
  const traderName = dotIndex !== -1 ? header.substring(dotIndex + 1).trim() : '';

  // Position
  const posParts = (parts[1] || '').trim().split(/\s+/).map(Number);
  const pos = posParts.length >= 3 && !posParts.some(isNaN) ? posParts : [0, 0, 0];

  // Rotation YPR (Yaw, Pitch, Roll)
  let ypr = [0, 0, 0];
  if (parts[2]) {
    const yprParts = parts[2].trim().split(/\s+/).map(Number);
    if (yprParts.length >= 3 && !yprParts.some(isNaN)) {
      ypr = yprParts;
    }
  }

  // Clothing - strictly sanitize and filter only valid classname identifiers
  let clothing = [];
  if (parts[3]) {
    clothing = parts[3]
      .split(',')
      .map(c => c.replace(/["'\\;\r\n]/g, '').trim())
      .filter(c => c.length > 0 && /^[a-zA-Z0-9_]+$/.test(c));
  }

  return {
    npcModel: npcModel || 'ExpansionTraderSurvivorM',
    traderName,
    pos,
    ypr,
    yaw: ypr[0] || 0,
    clothing,
    rawLine: trimmed
  };
}

/**
 * Parses full content of a .map file.
 * @param {string} text 
 * @returns {Array<object>}
 */
export function parseTraderMapContent(text) {
  if (!text || typeof text !== 'string') return [];
  let cleanText = text;

  // Handle case where text was JSON.stringify'd
  if (cleanText.trim().startsWith('"') && cleanText.trim().endsWith('"')) {
    try {
      const unjson = JSON.parse(cleanText.trim());
      if (typeof unjson === 'string') cleanText = unjson;
    } catch (e) {}
  }

  const lines = cleanText.split(/\r?\n/);
  const entries = [];
  for (const line of lines) {
    const parsed = parseTraderMapLine(line);
    if (parsed) {
      entries.push(parsed);
    }
  }
  return entries;
}

/**
 * Builds a single standard DayZ Expansion .map line.
 * @param {object} trader
 * @returns {string}
 */
export function buildTraderMapLine({ npcModel, traderName, pos, ypr, clothing }) {
  const model = (npcModel || 'ExpansionTraderSurvivorM').trim();
  const name = (traderName || 'Trader').trim();
  const px = Number(pos?.[0] ?? 0).toFixed(6);
  const py = Number(pos?.[1] ?? 0).toFixed(6);
  const pz = Number(pos?.[2] ?? 0).toFixed(6);

  const yaw = Number(ypr?.[0] ?? 0).toFixed(6);
  const pitch = Number(ypr?.[1] ?? 0).toFixed(6);
  const roll = Number(ypr?.[2] ?? 0).toFixed(6);

  const cleanClothing = Array.isArray(clothing) 
    ? clothing.map(c => c.replace(/["'\\;\r\n]/g, '').trim()).filter(c => c.length > 0 && /^[a-zA-Z0-9_]+$/.test(c))
    : [];

  const clothStr = cleanClothing.join(',');

  if (clothStr.length > 0) {
    return `${model}.${name}|${px} ${py} ${pz}|${yaw} ${pitch} ${roll}|${clothStr}`;
  }
  return `${model}.${name}|${px} ${py} ${pz}|${yaw} ${pitch} ${roll}`;
}

/**
 * Updates or inserts a trader entry in an existing .map file content.
 * @param {string} existingContent 
 * @param {object} traderData 
 * @returns {string}
 */
export function upsertTraderInMapContent(existingContent, traderData) {
  const newMapLine = buildTraderMapLine(traderData);
  if (!existingContent || typeof existingContent !== 'string' || !existingContent.trim()) {
    return newMapLine + '\n';
  }

  let text = existingContent;
  if (text.trim().startsWith('"') && text.trim().endsWith('"')) {
    try {
      const unjson = JSON.parse(text.trim());
      if (typeof unjson === 'string') text = unjson;
    } catch (e) {}
  }

  const lines = text.split(/\r?\n/);
  const targetTraderName = (traderData.traderName || '').toLowerCase();
  let found = false;

  const updatedLines = lines.map(line => {
    const parsed = parseTraderMapLine(line);
    if (parsed && parsed.traderName.toLowerCase() === targetTraderName) {
      found = true;
      return newMapLine;
    }
    return line;
  });

  if (!found) {
    const cleanExisting = updatedLines.filter(l => l.trim().length > 0);
    cleanExisting.push(newMapLine);
    return cleanExisting.join('\n') + '\n';
  }

  return updatedLines.join('\n') + '\n';
}
