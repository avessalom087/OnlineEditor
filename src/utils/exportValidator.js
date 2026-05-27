/**
 * Validates all dirty configuration files before export.
 * @param {Object} configs - The full configs map from App state.
 * @returns {Array<{ filePath: string, severity: 'error'|'warning', message: string }>}
 */
export function validateBeforeExport(configs) {
  const issues = [];

  Object.entries(configs).forEach(([path, file]) => {
    if (!file.success || !file.content || !file.originalContent) return;

    // Only validate files that have been modified
    const isDirty = JSON.stringify(file.content) !== JSON.stringify(file.originalContent);
    if (!isDirty) return;

    const lp = path.toLowerCase();
    const shortName = path.split('/').pop();

    // ─── Market Categories ───────────────────────────────────────────────────
    if (lp.startsWith('expansionmod/market/') && Array.isArray(file.content.Items)) {
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
    if (lp.startsWith('expansionmod/quests/quests/quest_')) {
      if (!file.content.Title || file.content.Title.trim() === '') {
        issues.push({
          filePath: path,
          severity: 'warning',
          message: `${shortName}: Quest Title is empty.`,
        });
      }
      if (Array.isArray(file.content.Objectives)) {
        file.content.Objectives.forEach((obj, idx) => {
          if (!obj.ObjectiveName || obj.ObjectiveName.trim() === '') {
            issues.push({
              filePath: path,
              severity: 'warning',
              message: `${shortName} → Objective #${idx + 1}: ObjectiveName is empty.`,
            });
          }
        });
      }
    }

    // ─── AI Patrol Settings ──────────────────────────────────────────────────
    if (lp === 'expansion/settings/aipatrolsettings.json' && Array.isArray(file.content.Patrols)) {
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
    if (lp === 'expansion/settings/safezonesettings.json') {
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
