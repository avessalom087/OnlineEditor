export function getExpansionModPrefix(configs) {
  const key = Object.keys(configs).find(k => {
    const l = k.toLowerCase();
    return l.includes('quests/quests/') || l.includes('loadouts/') || l.includes('market/') || l.includes('ai/lootdrops/');
  });
  if (!key) return '';
  const l = key.toLowerCase();
  const idx = l.indexOf('expansionmod/');
  if (idx !== -1) {
    return key.substring(0, idx + 'expansionmod/'.length);
  }
  return '';
}

export function getExpansionPrefix(configs) {
  const key = Object.keys(configs).find(k => {
    const l = k.toLowerCase();
    return l.includes('settings/') || l.includes('traderzones/') || l.includes('missions/');
  });
  if (!key) return '';
  const l = key.toLowerCase();
  const idx = l.indexOf('expansion/');
  if (idx !== -1) {
    return key.substring(0, idx + 'expansion/'.length);
  }
  return '';
}

export function getMpgSpawnerPrefix(configs) {
  const key = Object.keys(configs).find(k => {
    const l = k.toLowerCase();
    return l.includes('mpg_spawner/') || l.includes('points/');
  });
  if (!key) return '';
  const l = key.toLowerCase();
  const idx = l.indexOf('mpg_spawner/');
  if (idx !== -1) {
    return key.substring(0, idx + 'mpg_spawner/'.length);
  }
  return '';
}
