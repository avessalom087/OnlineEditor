export const EXPANSION_TRADER_ICONS = [
  { id: 'Trader',           labelRu: 'Торговец (Универсальный)',  labelEn: 'Trader (General)',      emoji: '🏪' },
  { id: 'Shotgun',          labelRu: 'Оружие / Огнестрел',        labelEn: 'Weapons / Firearms',    emoji: '🔫' },
  { id: 'Backpack',         labelRu: 'Одежда и Рюкзаки',          labelEn: 'Clothing & Backpacks',  emoji: '🎒' },
  { id: 'Medic Box',        labelRu: 'Медицина и Аптечки',        labelEn: 'Medicals & Pharmacy',   emoji: '💊' },
  { id: 'Can Of Beans Big', labelRu: 'Еда и Продукты',            labelEn: 'Food & Consumables',    emoji: '🥫' },
  { id: 'Bottle',           labelRu: 'Напитки и Вода',            labelEn: 'Drinks & Beverages',    emoji: '🍶' },
  { id: 'Car',              labelRu: 'Автомобили и Запчасти',     labelEn: 'Cars & Vehicle Parts',  emoji: '🚗' },
  { id: 'Helicopter',       labelRu: 'Вертолеты и Авиация',       labelEn: 'Helicopters & Aircraft',emoji: '🚁' },
  { id: 'Boat',             labelRu: 'Лодки и Катера',            labelEn: 'Boats & Watercraft',    emoji: '🚤' },
  { id: 'Fishing',          labelRu: 'Рыбалка и Снасти',          labelEn: 'Fishing & Tackle',      emoji: '🎣' },
  { id: 'Hammer',           labelRu: 'Инструменты и Стройка',     labelEn: 'Tools & Building',      emoji: '🔨' },
  { id: 'Nails',            labelRu: 'Гвозди и Крепеж',           labelEn: 'Nails & Fasteners',     emoji: '🔩' },
  { id: 'Scrap Metal',      labelRu: 'Компоненты и Металл',       labelEn: 'Components & Scrap',    emoji: '⚙️' },
  { id: 'Gas',              labelRu: 'Топливо и Канистры',        labelEn: 'Fuel & Gas',            emoji: '⛽' },
  { id: 'Grenade',          labelRu: 'Взрывчатка и Гранаты',      labelEn: 'Explosives & Grenades', emoji: '💣' },
  { id: 'Exchange',         labelRu: 'Банкомат / Обмен валют',    labelEn: 'ATM / Currency Exchange',emoji: '🏧' },
  { id: 'Deliver',          labelRu: 'Курьер / Доставка',         labelEn: 'Courier / Delivery',    emoji: '📦' },
  { id: 'Questionmark',     labelRu: 'Секретный / Разное',        labelEn: 'Special / Mystery',     emoji: '❓' },
  { id: 'Heart',            labelRu: 'Сердце / Здоровье',         labelEn: 'Heart / Health',        emoji: '❤️' },
  { id: 'Shield',           labelRu: 'Щит / Оборона',             labelEn: 'Shield / Defense',      emoji: '🛡️' },
  { id: 'Skull',            labelRu: 'Череп / Черный рынок',      labelEn: 'Skull / Black Market',  emoji: '💀' },
  { id: 'Star',             labelRu: 'Звезда / VIP Трейдер',      labelEn: 'Star / VIP Trader',     emoji: '⭐' },
];

/**
 * Trader Health Diagnostics & Auto-Healing Utilities for DayZ Expansion
 * Validates, normalizes, and repairs trader configs, mission .map spawns, SafeZones, and categories.
 */

import { parseTraderMapContent, buildTraderMapLine, upsertTraderInMapContent } from './traderMapUtils.js';
import { getExpansionPrefix, getMarketPrefix } from './pathUtils.js';

/**
 * Inspects a trader config and its environment for structural errors, missing references, and desyncs.
 * @param {Object} traderConfig - The content of the trader JSON file.
 * @param {string} traderPath - Relative path to the trader file.
 * @param {Object} configs - The full configs map from App state.
 * @returns {Object} { isHealthy, healthScore, issues, stats }
 */
export function inspectTraderHealth(traderConfig, traderPath, configs) {
  if (!traderConfig || typeof traderConfig !== 'object') {
    return {
      isHealthy: false,
      healthScore: 0,
      issues: [{ type: 'critical', severity: 'error', message: 'Файл торговца пуст или поврежден (Invalid JSON)' }],
      stats: { totalCategories: 0, validCategories: 0, brokenCategories: 0, hasMapSpawn: false, hasSafezone: false }
    };
  }

  const issues = [];
  const traderName = traderPath.split('/').pop().replace('.json', '');
  const prefix = getExpansionPrefix(configs);
  const marketPrefix = getMarketPrefix(configs);

  // 1. Check Schema Version & Required Fields
  if (traderConfig.m_Version !== 13) {
    issues.push({
      type: 'schema',
      severity: 'warning',
      message: `Устаревшая версия схемы (m_Version: ${traderConfig.m_Version ?? 'нет'}). Актуальный стандарт DayZ Expansion — 13.`,
      autoFixable: true
    });
  }

  if (typeof traderConfig.MinRequiredReputation !== 'number' || typeof traderConfig.MaxRequiredReputation !== 'number') {
    issues.push({
      type: 'schema',
      severity: 'warning',
      message: 'Параметры репутации (Min/MaxRequiredReputation) имеют неверный тип данных.',
      autoFixable: true
    });
  }

  if (traderConfig.RequiredCompletedQuestID !== undefined && typeof traderConfig.RequiredCompletedQuestID !== 'number') {
    issues.push({
      type: 'schema',
      severity: 'warning',
      message: 'Поле RequiredCompletedQuestID должно быть числом (-1 если квест не требуется).',
      autoFixable: true
    });
  }

  // 2. Check Categories
  const rawCategories = Array.isArray(traderConfig.Categories) ? traderConfig.Categories : [];
  let brokenCategoriesCount = 0;
  const brokenCatNames = [];

  rawCategories.forEach(rawCat => {
    if (!rawCat) return;
    const catBaseName = String(rawCat).split(':')[0].trim();
    const catLower = catBaseName.toLowerCase();

    // Check if category JSON exists in configs
    const exists = Object.keys(configs).some(p => {
      const lp = p.toLowerCase();
      return lp.includes('market/') && (lp.endsWith(`/${catLower}.json`) || lp.endsWith(`\\${catLower}.json`));
    });

    if (!exists) {
      brokenCategoriesCount++;
      brokenCatNames.push(catBaseName);
    }
  });

  if (brokenCategoriesCount > 0) {
    issues.push({
      type: 'category',
      severity: 'error',
      message: `Обнаружено ${brokenCategoriesCount} битых категорий, которых нет в папке Market: [${brokenCatNames.join(', ')}]. Сервер выдаст ошибку "Category not found"!`,
      autoFixable: true,
      brokenCategories: brokenCatNames
    });
  }

  // 3. Check Mission .map Spawn Line
  let foundInMap = false;
  let matchingMapPath = null;
  let mapEntry = null;

  for (const [mapPath, mapFile] of Object.entries(configs)) {
    if (mapPath.toLowerCase().endsWith('.map') && mapFile?.success) {
      const text = typeof mapFile.content === 'string' ? mapFile.content : (mapFile.raw || '');
      const entries = parseTraderMapContent(text);
      const match = entries.find(e => e.traderName.toLowerCase() === traderName.toLowerCase());
      if (match) {
        foundInMap = true;
        matchingMapPath = mapPath;
        mapEntry = match;
        break;
      }
    }
  }

  if (!foundInMap) {
    issues.push({
      type: 'map',
      severity: 'error',
      message: `Торговец "${traderName}" не зарегистрирован ни в одном .map файле спавна миссии (expansion/traders/*.map). NPC не появится в игре!`,
      autoFixable: true
    });
  } else if (mapEntry) {
    if (!Array.isArray(mapEntry.pos) || mapEntry.pos.length !== 3 || mapEntry.pos.some(isNaN)) {
      issues.push({
        type: 'map',
        severity: 'error',
        message: 'Некорректные 3D-координаты спавна в .map файле.',
        autoFixable: true
      });
    }
  }

  // 4. Check SafeZone Alignment
  let hasSafezone = false;
  for (const [zp, zFile] of Object.entries(configs)) {
    if (zp.toLowerCase().includes('traderzones/') && zFile?.success && zFile.content) {
      const zDisp = (zFile.content.m_DisplayName || '').toLowerCase();
      const zBase = zp.split('/').pop().toLowerCase().replace('.json', '').replace('_zone', '');
      if (zDisp.includes(traderName.toLowerCase()) || zBase === traderName.toLowerCase()) {
        hasSafezone = true;
        break;
      }
    }
  }

  if (!hasSafezone) {
    issues.push({
      type: 'safezone',
      severity: 'warning',
      message: 'Для торговца не настроена безопасная зона (SafeZone). В зоне торговли игроки смогут стрелять.',
      autoFixable: true
    });
  }

  // 5. Check TraderIcon
  const validIconIds = new Set(EXPANSION_TRADER_ICONS.map(i => i.id.toLowerCase()));
  const currentIcon = (traderConfig.TraderIcon || '').trim();
  if (!currentIcon) {
    issues.push({
      type: 'icon',
      severity: 'warning',
      message: 'Иконка торговца не задана (будет отображаться красный квадрат ошибки).',
      autoFixable: true
    });
  } else if (!validIconIds.has(currentIcon.toLowerCase()) && !currentIcon.includes('/') && !currentIcon.includes('.edds')) {
    issues.push({
      type: 'icon',
      severity: 'warning',
      message: `Неизвестная иконка "${currentIcon}". В игре будет отображаться красный квадрат ошибки отсутствия текстуры.`,
      autoFixable: true
    });
  }

  // 5. Check Currencies
  if (!Array.isArray(traderConfig.Currencies) || traderConfig.Currencies.length === 0) {
    issues.push({
      type: 'currency',
      severity: 'warning',
      message: 'Не указана валюта торговли. Торговец не сможет принимать оплату.',
      autoFixable: true
    });
  }

  // Health calculation
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  let healthScore = Math.max(0, 100 - (errorCount * 30) - (warningCount * 10));

  return {
    isHealthy: errorCount === 0,
    healthScore,
    issues,
    stats: {
      totalCategories: rawCategories.length,
      validCategories: rawCategories.length - brokenCategoriesCount,
      brokenCategories: brokenCategoriesCount,
      hasMapSpawn: foundInMap,
      mapFilePath: matchingMapPath,
      hasSafezone
    }
  };
}

/**
 * Normalizes, repairs, and auto-heals a trader config.
 * @param {Object} traderConfig 
 * @param {string} traderPath 
 * @param {Object} configs 
 * @param {Object} options 
 * @returns {Object} healedTraderConfig
 */
export function healTraderConfig(traderConfig, traderPath, configs, options = {}) {
  const traderName = traderPath.split('/').pop().replace('.json', '');

  // 1. Clean and filter categories (remove non-existent categories if requested or fix formatting)
  const rawCategories = Array.isArray(traderConfig?.Categories) ? traderConfig.Categories : [];
  const cleanCategories = [];

  rawCategories.forEach(rawCat => {
    if (!rawCat) return;
    const catStr = String(rawCat).trim();
    const parts = catStr.split(':');
    const catBase = parts[0].trim();
    const mode = parts[1] ? Number(parts[1]) : 3;

    if (!catBase) return;

    // Verify existence if stripBroken is enabled
    if (options.stripBrokenCategories) {
      const exists = Object.keys(configs).some(p => {
        const lp = p.toLowerCase();
        return lp.includes('market/') && (lp.endsWith(`/${catBase.toLowerCase()}.json`) || lp.endsWith(`\\${catBase.toLowerCase()}.json`));
      });
      if (!exists) return; // Skip broken category
    }

    cleanCategories.push(mode === 3 ? catBase : `${catBase}:${mode}`);
  });

  // 2. Clean Currencies
  let cleanCurrencies = Array.isArray(traderConfig?.Currencies) ? traderConfig.Currencies.map(c => String(c).trim().toLowerCase()).filter(Boolean) : [];
  if (cleanCurrencies.length === 0) {
    cleanCurrencies = ['expansionbanknotehryvnia'];
  }

  // 3. Build pristine standardized m_Version: 13 JSON
  const healedConfig = {
    m_Version: 13,
    DisplayName: traderConfig?.DisplayName?.trim() || traderName,
    MinRequiredReputation: Number(traderConfig?.MinRequiredReputation) || 0,
    MaxRequiredReputation: traderConfig?.MaxRequiredReputation !== undefined && !isNaN(Number(traderConfig.MaxRequiredReputation)) 
      ? Number(traderConfig.MaxRequiredReputation) 
      : 2147483647,
    RequiredFaction: traderConfig?.RequiredFaction || "",
    RequiredCompletedQuestID: traderConfig?.RequiredCompletedQuestID !== undefined && !isNaN(Number(traderConfig.RequiredCompletedQuestID))
      ? Number(traderConfig.RequiredCompletedQuestID)
      : -1,
    TraderIcon: traderConfig?.TraderIcon || "Trader",
    Currencies: cleanCurrencies,
    DisplayCurrencyValue: Number(traderConfig?.DisplayCurrencyValue) || 1,
    DisplayCurrencyName: traderConfig?.DisplayCurrencyName || "",
    UseCategoryOrder: Number(traderConfig?.UseCategoryOrder) || 0,
    Categories: cleanCategories,
    Items: typeof traderConfig?.Items === 'object' && traderConfig?.Items !== null ? traderConfig.Items : {}
  };

  return healedConfig;
}
