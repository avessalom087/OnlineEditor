export function getExpansionModPrefix(configs) {
  const keys = Object.keys(configs);
  const key = keys.find(k => {
    const l = k.toLowerCase().replace(/\\/g, '/');
    return l.includes('quests/quests/') || l.includes('loadouts/') || l.includes('market/') || l.includes('ai/lootdrops/');
  });
  if (key) {
    const normalizedKey = key.replace(/\\/g, '/');
    const l = normalizedKey.toLowerCase();
    const idx = l.indexOf('expansionmod/');
    if (idx !== -1) {
      const prefix = normalizedKey.substring(0, idx + 'expansionmod/'.length);
      return key.includes('\\') ? prefix.replace(/\//g, '\\') : prefix;
    }
  }

  // Fallback: search for any loaded file key containing "expansionmod/" to find the prefix
  const anyModKey = keys.find(k => k.toLowerCase().replace(/\\/g, '/').includes('expansionmod/'));
  if (anyModKey) {
    const normalized = anyModKey.replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('expansionmod/');
    if (idx !== -1) {
      const prefix = normalized.substring(0, idx + 'expansionmod/'.length);
      return anyModKey.includes('\\') ? prefix.replace(/\//g, '\\') : prefix;
    }
  }
  return 'ExpansionMod/';
}

export function getMarketPrefix(configs) {
  const keys = Object.keys(configs || {});
  // 1. If any category already exists, use its exact folder
  const existingCat = keys.find(k => {
    const l = k.toLowerCase().replace(/\\/g, '/');
    return l.includes('market/') && configs[k]?.success;
  });
  if (existingCat) {
    const normalized = existingCat.replace(/\\/g, '/');
    const idx = normalized.toLowerCase().lastIndexOf('market/');
    if (idx !== -1) {
      const prefix = normalized.substring(0, idx + 'market/'.length);
      return existingCat.includes('\\') ? prefix.replace(/\//g, '\\') : prefix;
    }
  }

  // 2. Otherwise use ExpansionMod prefix
  const modPrefix = getExpansionModPrefix(configs);
  return `${modPrefix}Market/`;
}

export function getTradersPrefix(configs) {
  const keys = Object.keys(configs || {});
  // 1. If any trader already exists, use its exact folder
  const existingTrader = keys.find(k => {
    const l = k.toLowerCase().replace(/\\/g, '/');
    return l.includes('traders/') && configs[k]?.success;
  });
  if (existingTrader) {
    const normalized = existingTrader.replace(/\\/g, '/');
    const idx = normalized.toLowerCase().lastIndexOf('traders/');
    if (idx !== -1) {
      const prefix = normalized.substring(0, idx + 'traders/'.length);
      return existingTrader.includes('\\') ? prefix.replace(/\//g, '\\') : prefix;
    }
  }

  // 2. Otherwise use ExpansionMod prefix
  const modPrefix = getExpansionModPrefix(configs);
  return `${modPrefix}Traders/`;
}

export function getExpansionPrefix(configs) {
  const keys = Object.keys(configs || {});
  const key = keys.find(k => {
    const l = k.toLowerCase().replace(/\\/g, '/');
    return l.includes('settings/') || l.includes('traderzones/') || l.includes('missions/');
  });
  if (key) {
    const normalizedKey = key.replace(/\\/g, '/');
    const l = normalizedKey.toLowerCase();
    const idx = l.indexOf('expansion/');
    if (idx !== -1) {
      const prefix = normalizedKey.substring(0, idx + 'expansion/'.length);
      return key.includes('\\') ? prefix.replace(/\//g, '\\') : prefix;
    }
  }

  // Fallback: search for any loaded file key containing "expansion/"
  const anyExpKey = keys.find(k => k.toLowerCase().replace(/\\/g, '/').includes('expansion/'));
  if (anyExpKey) {
    const normalized = anyExpKey.replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('expansion/');
    if (idx !== -1) {
      const prefix = normalized.substring(0, idx + 'expansion/'.length);
      return anyExpKey.includes('\\') ? prefix.replace(/\//g, '\\') : prefix;
    }
  }
  return 'expansion/';
}

export function getMpgSpawnerPrefix(configs) {
  const keys = Object.keys(configs || {});
  const key = keys.find(k => {
    const l = k.toLowerCase().replace(/\\/g, '/');
    return l.includes('mpg_spawner/') || l.includes('points/');
  });
  if (key) {
    const normalizedKey = key.replace(/\\/g, '/');
    const l = normalizedKey.toLowerCase();
    const idx = l.indexOf('mpg_spawner/');
    if (idx !== -1) {
      const prefix = normalizedKey.substring(0, idx + 'mpg_spawner/'.length);
      return key.includes('\\') ? prefix.replace(/\//g, '\\') : prefix;
    }
  }

  // Fallback: search for any loaded file key containing "mpg_spawner/"
  const anyMpgKey = keys.find(k => k.toLowerCase().replace(/\\/g, '/').includes('mpg_spawner/'));
  if (anyMpgKey) {
    const normalized = anyMpgKey.replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('mpg_spawner/');
    if (idx !== -1) {
      const prefix = normalized.substring(0, idx + 'mpg_spawner/'.length);
      return anyMpgKey.includes('\\') ? prefix.replace(/\//g, '\\') : prefix;
    }
  }
  return 'mpg_spawner/';
}
