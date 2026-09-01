/**
 * Centralized Intelligent DayZ Classnames Parser
 * Supports types.xml, logs, configs, delimited lists, key-value pairs,
 * with strict CE metadata and noise filtering.
 */

export const CE_BLACKLIST = new Set([
  'tier', 'tier1', 'tier2', 'tier3', 'tier4', 'military', 'police', 'medic',
  'hunting', 'town', 'village', 'farm', 'industrial', 'coast', 'office',
  'school', 'firefighter', 'contaminatedarea', 'prison', 'unique', 'weapons',
  'tools', 'food', 'clothes', 'containers', 'vehicles', 'explosives',
  'coordinates', 'position', 'pos', 'ypr', 'orientation', 'radius', 'scale', 'rotation',
  'true', 'false', 'null', 'undefined', 'item', 'items', 'classname', 'classnames',
  'name', 'type', 'types', 'object', 'objects', 'model', 'spawn', 'spawns', 'category', 'categories',
  'description', 'displayname', 'icon', 'color', 'minprice', 'maxprice', 'minstock', 'maxstock',
  'sellpercent', 'initstockpercent', 'isdefines', 'isexchange', 'version', 'm_version',
  'quantity', 'nominal', 'lifetime', 'restock', 'min', 'cost', 'flags', 'tag', 'usage', 'value',
  'class', 'classes', 'names', 'root', 'header', 'data', 'config', 'mod', 'mods',
  'the', 'and', 'with', 'for', 'from', 'this', 'that', 'have', 'your', 'about', 'damage', 'health'
]);

export function parseClassnamesFromText(rawText, xmlItemsSet = null) {
  if (!rawText || typeof rawText !== 'string') return [];

  // 1. If text is XML (e.g. types.xml / xml chunk), STRICTLY extract from <type name="..."> only
  const isXml = /<\s*types|<\s*type\s+name=/i.test(rawText);
  if (isXml) {
    const xmlRegex = /<type\s+name=["']([^"']+)["']/gi;
    const seen = new Set();
    const result = [];
    let match;
    while ((match = xmlRegex.exec(rawText)) !== null) {
      const cls = match[1]?.trim();
      if (cls && !seen.has(cls.toLowerCase())) {
        seen.add(cls.toLowerCase());
        result.push(cls);
      }
    }
    return result;
  }

  const seen = new Set();
  const result = [];

  const isLikelyClassname = (str) => {
    if (!str || typeof str !== 'string') return false;
    const clean = str.trim().replace(/^[^a-zA-Z0-9_]+|[^a-zA-Z0-9_]+$/g, '');
    if (!clean || clean.length < 2) return false;
    if (/^[\d.-]+$/.test(clean)) return false;

    const lower = clean.toLowerCase();
    if (CE_BLACKLIST.has(lower)) return false;

    // If exists in loaded types.xml database -> 100% genuine
    if (xmlItemsSet && xmlItemsSet.size > 0 && xmlItemsSet.has(lower)) {
      return true;
    }

    const hasUnderscore = clean.includes('_');
    const hasDigits = /\d/.test(clean);
    const isAllCaps = /^[A-Z0-9_]+$/.test(clean) && clean.length >= 2 && clean.length <= 16;
    const isMultiWordPascal = /^[A-Z][a-z0-9]+[A-Z]/.test(clean);
    const isSingleWordCapitalized = /^[A-Z][a-z0-9]{3,}$/.test(clean);
    const isAllLowercase = /^[a-z]+$/.test(clean);

    if (isAllLowercase) return false;

    return hasUnderscore || hasDigits || isAllCaps || isMultiWordPascal || isSingleWordCapitalized;
  };

  const addClass = (cls) => {
    if (!cls || typeof cls !== 'string') return;
    let clean = cls.trim().replace(/^[^a-zA-Z0-9_]+|[^a-zA-Z0-9_]+$/g, '');
    if (isLikelyClassname(clean)) {
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(clean);
      }
    }
  };

  // 2. Check for key=value or key:value pairs like classname=AK74 or "ClassName": "AK74"
  const kvRegex = /(?:classname|item)\s*[:=]\s*["']?([a-zA-Z0-9_]+)["']?/gi;
  let kvMatch;
  let foundKv = false;
  while ((kvMatch = kvRegex.exec(rawText)) !== null) {
    if (kvMatch[1]) {
      addClass(kvMatch[1]);
      foundKv = true;
    }
  }

  if (foundKv) {
    return result;
  }

  // 3. Fallback: split by common delimiters and clean tokens
  const tokens = rawText.split(/[\r\n,;"'`\t|]+/);
  tokens.forEach(tok => {
    const subTokens = tok.split(/\s+/);
    subTokens.forEach(st => addClass(st));
  });

  return result;
}
