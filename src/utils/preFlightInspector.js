/**
 * Pre-Flight Server Readiness & Compatibility Inspector for DayZ Expansion
 * Performs holistic diagnostics across Market, Traders, Mission .map spawns, SafeZones, and Quests.
 */

import { findMarketDuplicates } from './marketAuditUtils.js';
import { inspectTraderHealth } from './traderHealthUtils.js';
import { getTradersPrefix } from './pathUtils.js';

/**
 * Runs a complete pre-flight readiness audit on the server configuration.
 * @param {Object} configs - Full configs map.
 * @returns {Object} Comprehensive diagnostic report.
 */
export function runPreFlightCheck(configs) {
  if (!configs) {
    return {
      isReady: false,
      readinessScore: 0,
      totalErrors: 1,
      totalWarnings: 0,
      marketReport: { duplicatesCount: 0, issues: [] },
      tradersReport: { totalTraders: 0, healthyTraders: 0, issues: [] },
      questsReport: { totalQuests: 0, issues: [] },
      zonesReport: { totalZones: 0, issues: [] }
    };
  }

  // 1. Market Audit (Duplicates & Variants collisions)
  const marketAudit = findMarketDuplicates(configs);
  const marketIssues = [];
  marketAudit.duplicatesList.forEach(dup => {
    const primaryCat = dup.occurrences[0].categoryFileName;
    marketIssues.push({
      severity: 'error',
      message: `[Рынок] Предмет "${dup.className}" дублируется в ${dup.occurrences.length} категориях (Первичная: "${primaryCat}"). Сервер упадет в MARKET CONFIGURATION ERROR!`
    });
  });

  // 2. Traders & Mission Spawns Audit
  const traderPaths = Object.keys(configs).filter(p => {
    const lp = p.toLowerCase();
    return lp.includes('traders/') && lp.endsWith('.json') && !lp.includes('traderzones');
  });

  let healthyTradersCount = 0;
  const traderIssues = [];

  traderPaths.forEach(tp => {
    const file = configs[tp];
    if (file?.success && file.content) {
      const health = inspectTraderHealth(file.content, tp, configs);
      if (health.isHealthy) {
        healthyTradersCount++;
      } else {
        const traderName = tp.split('/').pop().replace('.json', '');
        health.issues.forEach(iss => {
          traderIssues.push({
            severity: iss.severity,
            traderPath: tp,
            traderName,
            message: `[Торговец "${traderName}"] ${iss.message}`
          });
        });
      }
    }
  });

  // 3. Quests & DAG Audit
  const questPaths = Object.keys(configs).filter(p => p.toLowerCase().includes('quests/quests/quest_'));
  const allQuestIds = new Set();
  const questPrereqs = {};
  const questIssues = [];

  questPaths.forEach(qp => {
    const f = configs[qp];
    if (f?.success && f.content && f.content.ID !== undefined) {
      allQuestIds.add(f.content.ID);
      questPrereqs[f.content.ID] = Array.isArray(f.content.PreQuestIDs) ? f.content.PreQuestIDs : [];
    }
  });

  questPaths.forEach(qp => {
    const f = configs[qp];
    if (!f?.success || !f.content) return;
    const q = f.content;
    const qShort = qp.split('/').pop();

    if (q.FollowUpQuest && q.FollowUpQuest > 0 && !allQuestIds.has(q.FollowUpQuest)) {
      questIssues.push({
        severity: 'error',
        message: `[Квест ${qShort}] Ссылка на следующий квест ID ${q.FollowUpQuest} не существует.`
      });
    }

    if (Array.isArray(q.PreQuestIDs)) {
      q.PreQuestIDs.forEach(pid => {
        if (!allQuestIds.has(pid)) {
          questIssues.push({
            severity: 'error',
            message: `[Квест ${qShort}] Пре-квест ID ${pid} не существует.`
          });
        }
      });
    }
  });

  // 4. SafeZones Audit
  const zonePaths = Object.keys(configs).filter(p => p.toLowerCase().includes('traderzones/'));
  const zoneIssues = [];

  zonePaths.forEach(zp => {
    const zf = configs[zp];
    if (zf?.success && zf.content) {
      const zName = zp.split('/').pop();
      if (!Array.isArray(zf.content.Position) || zf.content.Position.length < 3) {
        zoneIssues.push({
          severity: 'error',
          message: `[SafeZone ${zName}] Отсутствуют или повреждены координаты Position.`
        });
      }
      if (typeof zf.content.Radius !== 'number' || zf.content.Radius <= 0) {
        zoneIssues.push({
          severity: 'warning',
          message: `[SafeZone ${zName}] Радиус зоны равен ${zf.content.Radius} (рекомендуется 50-200м).`
        });
      }
    }
  });

  const allIssues = [...marketIssues, ...traderIssues, ...questIssues, ...zoneIssues];
  const totalErrors = allIssues.filter(i => i.severity === 'error').length;
  const totalWarnings = allIssues.filter(i => i.severity === 'warning').length;

  let readinessScore = Math.max(0, 100 - (totalErrors * 25) - (totalWarnings * 5));

  return {
    isReady: totalErrors === 0,
    readinessScore,
    totalErrors,
    totalWarnings,
    allIssues,
    marketReport: {
      duplicatesCount: marketAudit.duplicatesCount,
      totalCollisions: marketAudit.totalCollisions,
      issues: marketIssues
    },
    tradersReport: {
      totalTraders: traderPaths.length,
      healthyTraders: healthyTradersCount,
      issues: traderIssues
    },
    questsReport: {
      totalQuests: questPaths.length,
      issues: questIssues
    },
    zonesReport: {
      totalZones: zonePaths.length,
      issues: zoneIssues
    }
  };
}
