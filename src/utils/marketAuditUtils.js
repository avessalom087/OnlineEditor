/**
 * Market Duplicate & Variants Auditor for DayZ Expansion
 * Prevents and resolves fatal DayZ Expansion server startup errors caused by
 * duplicate items or variants across Market Category files (ExpansionMod/Market/*.json).
 */

/**
 * Finds all item and variant duplicate collisions across all market category files.
 * @param {Object} configs - The full configs object.
 * @returns {Object} { duplicatesCount, totalCollisions, duplicateMap, duplicatesList }
 */
export function findMarketDuplicates(configs) {
  if (!configs) return { duplicatesCount: 0, totalCollisions: 0, duplicateMap: new Map(), duplicatesList: [] };

  const registry = new Map(); // classNameLower -> Array<Occurrence>

  for (const [filePath, file] of Object.entries(configs)) {
    if (!file || !file.success || !file.content) continue;
    const lp = filePath.toLowerCase();
    if (!lp.includes('market/') || !lp.endsWith('.json')) continue;

    const items = file.content.Items;
    if (!Array.isArray(items)) continue;

    const catFileName = filePath.split('/').pop().replace('.json', '');
    const catDisplayName = file.content.DisplayName || catFileName;

    items.forEach((item, itemIdx) => {
      if (!item) return;

      // 1. Check Main ClassName
      if (item.ClassName && typeof item.ClassName === 'string' && item.ClassName.trim()) {
        const cleanName = item.ClassName.trim();
        const lower = cleanName.toLowerCase();
        if (!registry.has(lower)) registry.set(lower, []);
        registry.get(lower).push({
          className: cleanName,
          categoryPath: filePath,
          categoryName: catDisplayName,
          categoryFileName: catFileName,
          itemIndex: itemIdx,
          isVariant: false,
          parentClassName: null
        });
      }

      // 2. Check Variants inside item
      if (Array.isArray(item.Variants)) {
        item.Variants.forEach((variantName, varIdx) => {
          if (variantName && typeof variantName === 'string' && variantName.trim()) {
            const cleanVar = variantName.trim();
            const lowerVar = cleanVar.toLowerCase();
            if (!registry.has(lowerVar)) registry.set(lowerVar, []);
            registry.get(lowerVar).push({
              className: cleanVar,
              categoryPath: filePath,
              categoryName: catDisplayName,
              categoryFileName: catFileName,
              itemIndex: itemIdx,
              variantIndex: varIdx,
              isVariant: true,
              parentClassName: item.ClassName
            });
          }
        });
      }
    });
  }

  const duplicateMap = new Map();
  const duplicatesList = [];
  let totalCollisions = 0;

  for (const [classNameLower, occurrences] of registry.entries()) {
    if (occurrences.length > 1) {
      // Distinct categories check
      const uniqueCats = new Set(occurrences.map(o => o.categoryPath));
      // Also duplicate inside same category
      duplicateMap.set(classNameLower, occurrences);
      duplicatesList.push({
        className: occurrences[0].className,
        classNameLower,
        occurrences,
        uniqueCategoriesCount: uniqueCats.size,
        hasCrossCategoryConflict: uniqueCats.size > 1
      });
      totalCollisions += (occurrences.length - 1);
    }
  }

  return {
    duplicatesCount: duplicatesList.length,
    totalCollisions,
    duplicateMap,
    duplicatesList: duplicatesList.sort((a, b) => b.occurrences.length - a.occurrences.length)
  };
}

/**
 * Automatically resolves duplicate market items by removing secondary occurrences.
 * @param {Object} configs - Current configs map.
 * @param {Array<string>} specificClassesToResolve - Optional list of specific classnames to resolve. If empty, resolves all.
 * @param {Function} onChangeField - Optional callback to notify state changes.
 * @returns {Object} { updatedConfigs, resolvedCount, removedLog }
 */
export function autoResolveMarketDuplicates(configs, specificClassesToResolve = null) {
  const { duplicatesList } = findMarketDuplicates(configs);
  if (duplicatesList.length === 0) return { updatedConfigs: configs, resolvedCount: 0, removedLog: [] };

  const toResolve = specificClassesToResolve 
    ? duplicatesList.filter(d => specificClassesToResolve.includes(d.classNameLower) || specificClassesToResolve.includes(d.className))
    : duplicatesList;

  if (toResolve.length === 0) return { updatedConfigs: configs, resolvedCount: 0, removedLog: [] };

  // Deep clone only market configs
  const updatedConfigs = { ...configs };
  const modifiedPaths = new Set();
  const removedLog = [];

  toResolve.forEach(dup => {
    // Keep occurrence 0 (First category), remove from occurrences 1..n
    const keepOccurrence = dup.occurrences[0];

    for (let i = 1; i < dup.occurrences.length; i++) {
      const toRemove = dup.occurrences[i];
      const filePath = toRemove.categoryPath;

      if (!updatedConfigs[filePath] || !updatedConfigs[filePath].content) continue;

      if (!modifiedPaths.has(filePath)) {
        updatedConfigs[filePath] = {
          ...updatedConfigs[filePath],
          content: JSON.parse(JSON.stringify(updatedConfigs[filePath].content)),
          isDirty: true
        };
        modifiedPaths.add(filePath);
      }

      const fileContent = updatedConfigs[filePath].content;
      if (!Array.isArray(fileContent.Items)) continue;

      if (toRemove.isVariant) {
        // Remove from Variants array of parent item
        fileContent.Items.forEach(item => {
          if (Array.isArray(item.Variants)) {
            item.Variants = item.Variants.filter(v => v.toLowerCase() !== dup.classNameLower);
          }
        });
        removedLog.push({
          className: dup.className,
          removedFrom: toRemove.categoryFileName,
          isVariant: true,
          keptIn: keepOccurrence.categoryFileName
        });
      } else {
        // Remove full item from category Items array
        fileContent.Items = fileContent.Items.filter(item => 
          (item.ClassName || '').toLowerCase() !== dup.classNameLower
        );
        removedLog.push({
          className: dup.className,
          removedFrom: toRemove.categoryFileName,
          isVariant: false,
          keptIn: keepOccurrence.categoryFileName
        });
      }
    }
  });

  return {
    updatedConfigs,
    resolvedCount: removedLog.length,
    removedLog,
    modifiedPaths: Array.from(modifiedPaths)
  };
}
