import React, { useMemo, useState, useEffect } from 'react';
import { validateConfig, cleanJsonComments } from '../utils/diagnostics';
import { useToast } from './ToastManager';
import * as fileService from '../services/fileService';
import { useTranslation } from '../utils/localization';

function getDiffPaths(obj1, obj2, currentPath = []) {
  if (obj1 === obj2) return [];
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return [{ path: currentPath, oldVal: obj1, newVal: obj2 }];
  }
  const isArray1 = Array.isArray(obj1);
  const isArray2 = Array.isArray(obj2);
  if (isArray1 !== isArray2) {
    return [{ path: currentPath, oldVal: obj1, newVal: obj2 }];
  }
  const diffs = [];
  if (isArray1) {
    const maxLen = Math.max(obj1.length, obj2.length);
    for (let i = 0; i < maxLen; i++) {
      diffs.push(...getDiffPaths(obj1[i], obj2[i], [...currentPath, i]));
    }
  } else {
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    for (const key of allKeys) {
      diffs.push(...getDiffPaths(obj1[key], obj2[key], [...currentPath, key]));
    }
  }
  return diffs;
}

function formatPath(path) {
  return path.map(p => typeof p === 'number' ? `[${p}]` : p).join(' ➔ ');
}

export default function Dashboard({ 
  configs, 
  schemaReport,
  onOpenFile, 
  onSaveFile, 
  onResetFile, 
  onResetField,
  onSaveAll, 
  onDiscardAll,
  onFixSyntaxError,
  onFixStructuralError,
  onFixAllErrors,
  xmlItems = [],
  onUpdateXmlItems,
  fetchConfigs,
  onShowConfirm,
  initialSubTab,
  onSubTabChange,
  onNavigateToQuestGraph
}) {
  const toast = useToast();
  const { t, lang } = useTranslation();

  const [activeSubTab, setActiveSubTabState] = useState(initialSubTab || 'status');

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTabState(initialSubTab);
    }
  }, [initialSubTab]);

  const setActiveSubTab = (tab) => {
    setActiveSubTabState(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };
  const [backups, setBackups] = useState([]);
  const [isParsingXml, setIsParsingXml] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [errorBackups, setErrorBackups] = useState(null);
  const [expandedBackups, setExpandedBackups] = useState({});
  const paths = Object.keys(configs);
  const totalFiles = paths.length;

  const {
    totalQuests,
    totalNPCs,
    totalMarketItems,
    totalPatrols,
    totalSafeZones,
    syntaxErrors,
    structuralWarnings,
    dirtyFiles,
    allQuestsIds,
    marketCategories,
    marketItems,
    totalPatrolWaypoints,
    totalMpgSpawnerFiles,
    totalMpgTriggers,
    totalMpgSpawnPoints,
    totalQuestObjectives,
    objectiveTypesBreakdown
  } = useMemo(() => {
    let tQuests = 0;
    let tNPCs = 0;
    let tMarketItems = 0;
    let tPatrols = 0;
    let tSafeZones = 0;
    let tPatrolWaypoints = 0;
    let tMpgSpawnerFiles = 0;
    let tMpgTriggers = 0;
    let tMpgSpawnPoints = 0;
    let tQuestObjectivesCount = 0;

    const synErrors = [];
    const structWarnings = [];
    const dFiles = [];
    const objectiveTypesBreakdown = {};

    // Extract all Quest IDs, market categories, and market items to check for broken links
    const allQuestsIds = new Set();
    const marketCategories = new Set();
    const marketItems = new Set();

    paths.forEach(filePath => {
      const file = configs[filePath];
      if (file.success && file.content) {
        if (filePath.toLowerCase().startsWith('expansionmod/quests/quests/quest_')) {
          if (file.content.ID !== undefined) {
            allQuestsIds.add(file.content.ID);
          }
        }
        if (filePath.toLowerCase().startsWith('expansionmod/market/')) {
          const catName = filePath.split('/').pop().replace('.json', '');
          marketCategories.add(catName.toLowerCase());
          if (Array.isArray(file.content.Items)) {
            file.content.Items.forEach(i => {
              if (i.ClassName) marketItems.add(i.ClassName.toLowerCase());
            });
          }
        }
      }
    });

    paths.forEach(filePath => {
      const file = configs[filePath];
      const lowerPath = filePath.toLowerCase();

      // Track unsaved modifications
      const isDirty = file.success && file.isDirty;
      if (isDirty) {
        dFiles.push({ filePath, sizeBytes: file.sizeBytes });
      }

      if (!file.success) {
        synErrors.push({ filePath, error: file.error });
        return;
      }

      const content = file.content;

      // Count statistics
      if (lowerPath.startsWith('expansionmod/quests/quests/quest_') && content.ID !== undefined) {
        tQuests++;
      }
      if (lowerPath.startsWith('expansionmod/quests/npcs/questnpc_')) {
        tNPCs++;
      }
      if (lowerPath.startsWith('expansionmod/market/') && Array.isArray(content.Items)) {
        tMarketItems += content.Items.length;
      }
      if (lowerPath === 'expansion/settings/aipatrolsettings.json' && Array.isArray(content.Patrols)) {
        tPatrols += content.Patrols.length;
        content.Patrols.forEach(p => {
          if (Array.isArray(p.Waypoints)) {
            tPatrolWaypoints += p.Waypoints.length;
          }
        });
      }
      if (lowerPath === 'expansion/settings/safezonesettings.json') {
        if (Array.isArray(content.CircleZones)) tSafeZones += content.CircleZones.length;
        if (Array.isArray(content.PolygonZones)) tSafeZones += content.PolygonZones.length;
        if (Array.isArray(content.CylinderZones)) tSafeZones += content.CylinderZones.length;
      }
      // Quest objective types
      if (lowerPath.startsWith('expansionmod/quests/objectives/')) {
        tQuestObjectivesCount++;
        if (content.ObjectiveType !== undefined) {
          const typeNum = content.ObjectiveType;
          objectiveTypesBreakdown[typeNum] = (objectiveTypesBreakdown[typeNum] || 0) + 1;
        }
      }
      // MPG Spawners
      if (lowerPath.startsWith('mpg_spawner/points/') && lowerPath.endsWith('.json') && Array.isArray(content)) {
        tMpgSpawnerFiles++;
        content.forEach(trig => {
          tMpgTriggers++;
          if (Array.isArray(trig.spawnPositions)) {
            tMpgSpawnPoints += trig.spawnPositions.length;
          }
        });
      }

      // Run structural validator using schema report
      const fileSchema = schemaReport?.files?.[filePath]?.schema;
      if (fileSchema) {
        const fileErrors = validateConfig(content, fileSchema, filePath, allQuestsIds, marketCategories, marketItems, configs);
        if (fileErrors.length > 0) {
          structWarnings.push({
            filePath,
            errors: fileErrors
          });
        }
      }
    });

    return {
      totalQuests: tQuests,
      totalNPCs: tNPCs,
      totalMarketItems: tMarketItems,
      totalPatrols: tPatrols,
      totalSafeZones: tSafeZones,
      syntaxErrors: synErrors,
      structuralWarnings: structWarnings,
      dirtyFiles: dFiles,
      allQuestsIds,
      marketCategories,
      marketItems,
      totalPatrolWaypoints: tPatrolWaypoints,
      totalMpgSpawnerFiles: tMpgSpawnerFiles,
      totalMpgTriggers: tMpgTriggers,
      totalMpgSpawnPoints: tMpgSpawnPoints,
      totalQuestObjectives: tQuestObjectivesCount,
      objectiveTypesBreakdown
    };
  }, [configs, schemaReport, paths.length]); // paths.length is added just in case files are added/deleted

  const totalWarningsCount = structuralWarnings.reduce((acc, curr) => acc + curr.errors.length, 0);
  const totalIssuesCount = syntaxErrors.length + totalWarningsCount;

  const loadBackups = () => {
    setLoadingBackups(true);
    setErrorBackups(null);
    fileService.listBackups()
      .then(backupsList => {
        setBackups(backupsList);
        setLoadingBackups(false);
      })
      .catch(err => {
        console.error(err);
        setErrorBackups(err.message);
        setLoadingBackups(false);
      });
  };

  useEffect(() => {
    if (activeSubTab === 'backups') {
      loadBackups();
    }
  }, [activeSubTab]);

  const detailedChanges = useMemo(() => {
    const list = [];
    paths.forEach(filePath => {
      const file = configs[filePath];
      if (file.success && file.originalContent && file.isDirty) {
        const diffs = getDiffPaths(file.originalContent, file.content);
        if (diffs.length > 0) {
          list.push({
            filePath,
            diffs
          });
        }
      }
    });
    return list;
  }, [configs, paths]);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      
      {/* HUD Stats Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        {[
          { title: t('hud_quests'), count: totalQuests, subtitle: 'ExpansionMod/Quests', color: 'var(--text-glow)' },
          { title: t('hud_npcs'), count: totalNPCs, subtitle: 'Interactive Spawns', color: '#a6f5a6' },
          { title: t('hud_market'), count: totalMarketItems, subtitle: 'Economy Items', color: '#ebd667' },
          { title: t('hud_patrols'), count: totalPatrols, subtitle: 'AIPatrolSettings.json', color: '#cc4a4a' },
          { title: t('hud_safezones'), count: totalSafeZones, subtitle: 'SafeZoneSettings.json', color: '#559655' },
          { title: t('hud_total_configs'), count: totalFiles, subtitle: 'expansion & ExpansionMod', color: 'var(--text-primary)' }
        ].map((stat, idx) => (
          <div 
            key={idx} 
            style={{ 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              padding: '16px', 
              borderRadius: '2px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-glow)'
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {stat.title}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: '700', color: stat.color, margin: '8px 0 2px 0' }}>
              {stat.count}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dark)' }}>
              {stat.subtitle}
            </div>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '4px', background: stat.color }} />
          </div>
        ))}
      </div>

      {/* Sub-Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        {[
          { id: 'status', label: t('dash_sub_status'), icon: '🖥️' },
          { id: 'changelog', label: t('dash_sub_changelog'), icon: '📊', count: dirtyFiles.length },
          { id: 'backups', label: t('dash_sub_backups'), icon: '📂' },
          { id: 'validator', label: t('tab_validator'), icon: '🔍' },
          { id: 'analytics', label: t('dash_sub_analytics') || 'SERVER ANALYTICS', icon: '📈' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className="btn"
            style={{
              padding: '10px 16px',
              fontFamily: 'var(--font-heading)',
              fontWeight: activeSubTab === tab.id ? '700' : '400',
              border: activeSubTab === tab.id ? '1px solid var(--border-glow)' : '1px solid var(--border-color)',
              background: activeSubTab === tab.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              color: activeSubTab === tab.id ? 'var(--text-glow)' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: activeSubTab === tab.id ? '0 0 10px rgba(149,192,149,0.15)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderRadius: '2px',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                background: 'var(--warning-color)',
                color: '#000',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '2px 6px',
                borderRadius: '8px',
                lineHeight: 1,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeSubTab === 'status' && (
        <>
          {/* Main double panel row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'start' }}>
            
            {/* Left Panel: Package Status (Modified files list) */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>{t('status_pending_title')}</div>
                  <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>{t('status_package_title')}</h2>
                </div>
                {dirtyFiles.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-warning" onClick={onSaveAll}>{t('status_save_all_btn')}</button>
                    <button className="btn btn-danger" onClick={onDiscardAll}>{t('status_discard_all_btn')}</button>
                  </div>
                )}
              </div>

              {dirtyFiles.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', borderRadius: '2px' }}>
                  <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>✓</span>
                  <span>{t('status_match_disk')}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                  {dirtyFiles.map((df, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        background: 'var(--bg-primary)', 
                        border: '1px solid var(--warning-color)', 
                        borderRadius: '2px', 
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ overflow: 'hidden', marginRight: '12px' }}>
                        <div 
                          onClick={() => onOpenFile(df.filePath)}
                          style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontSize: '13px', 
                            color: 'var(--text-glow)', 
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden'
                          }}
                        >
                          {df.filePath}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {t('status_size')} {(df.sizeBytes / 1024).toFixed(2)} KB · {t('status_modified')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-accent" 
                          onClick={() => onSaveFile(df.filePath)}
                          style={{ padding: '4px 8px', fontSize: '10px' }}
                        >
                          {t('status_save_btn')}
                        </button>
                        <button 
                          className="btn" 
                          onClick={() => onResetFile(df.filePath)}
                          style={{ padding: '4px 8px', fontSize: '10px' }}
                        >
                          {t('status_revert_btn')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Panel: Advanced Auto-Fix Diagnostics console */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>{t('status_diagnostics_title')}</div>
                  <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>{t('status_healing_title')}</h2>
                </div>
                {totalIssuesCount > 0 && (
                  <button 
                    className="btn btn-warning" 
                    onClick={onFixAllErrors}
                    style={{ textShadow: '0 0 4px rgba(0,0,0,0.5)' }}
                  >
                    {t('status_fix_all_btn')}
                  </button>
                )}
              </div>

              {totalIssuesCount === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--border-color)', color: '#a6f5a6', borderRadius: '2px', background: 'rgba(74, 154, 74, 0.02)' }}>
                  <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>✓</span>
                  <span>{t('status_healthy')}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '400px', overflowY: 'auto' }}>
                  
                  {/* Syntax Errors list (Critical) */}
                  {syntaxErrors.map((pe, idx) => (
                    <div 
                      key={`syntax-${idx}`} 
                      style={{ 
                        background: 'rgba(235, 103, 103, 0.03)', 
                        border: '1px solid var(--danger-color)', 
                        borderRadius: '2px', 
                        padding: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div 
                          onClick={() => onOpenFile(pe.filePath)}
                          style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontSize: '13px', 
                            color: 'var(--danger-color)', 
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontWeight: 'bold'
                          }}
                        >
                          {pe.filePath}
                        </div>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => onFixSyntaxError(pe.filePath)}
                          style={{ padding: '2px 8px', fontSize: '9px' }}
                        >
                          {t('status_repair_syntax')}
                        </button>
                      </div>
                      <div style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '11px', 
                        color: 'var(--text-secondary)', 
                        background: 'var(--bg-primary)',
                        padding: '8px',
                        border: '1px solid #2a1414',
                        borderRadius: '2px',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.4'
                      }}>
                        {pe.error}
                      </div>
                    </div>
                  ))}

                  {/* Structural Warnings List */}
                  {structuralWarnings.map((warn) => (
                    <div 
                      key={warn.filePath} 
                      style={{ 
                        background: 'rgba(235, 214, 103, 0.02)', 
                        border: '1px solid var(--warning-color)', 
                        borderRadius: '2px', 
                        padding: '12px'
                      }}
                    >
                      <div 
                        onClick={() => onOpenFile(warn.filePath)}
                        style={{ 
                          fontFamily: 'var(--font-mono)', 
                          fontSize: '13px', 
                          color: 'var(--warning-color)', 
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontWeight: 'bold',
                          marginBottom: '8px',
                          display: 'block'
                        }}
                      >
                        {warn.filePath}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {warn.errors.map((err, errIdx) => (
                          <div 
                            key={errIdx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '12px',
                              color: 'var(--text-primary)',
                              background: 'var(--bg-primary)',
                              padding: '6px 10px',
                              border: '1px solid rgba(235, 214, 103, 0.15)',
                              borderRadius: '2px'
                            }}
                          >
                            <div style={{ flex: 1, marginRight: '10px' }}>
                              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                {err.path.join('.') || 'root'}:
                              </span>{' '}
                              {err.message}
                            </div>
                            {err.type === 'quest_cycle' && (
                              <button
                                className="btn btn-accent"
                                onClick={() => {
                                  const match = err.message.match(/cycle:\s*([\d\s\->]+)/i);
                                  if (match) {
                                    const ids = match[1].split('->').map(s => Number(s.trim())).filter(id => !isNaN(id));
                                    if (ids.length > 0) {
                                      if (onNavigateToQuestGraph) {
                                        onNavigateToQuestGraph(ids[0], ids);
                                      }
                                    }
                                  }
                                }}
                                style={{ padding: '2px 6px', fontSize: '9px', marginRight: '6px' }}
                              >
                                🔍 {lang === 'ru' ? 'Показать цикл' : 'Show cycle'}
                              </button>
                            )}
                            {err.fixable && (
                              <button
                                className="btn btn-warning"
                                onClick={() => onFixStructuralError(warn.filePath, err)}
                                style={{ padding: '2px 6px', fontSize: '9px' }}
                              >
                                {t('status_heal_btn')}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                </div>
              )}
            </div>

          </div>

          {/* Server Item Database (types.xml uploader) */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', position: 'relative' }}>
            {isParsingXml && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(7, 9, 7, 0.75)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                zIndex: 10,
                borderRadius: '2px'
              }}>
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes spin-xml {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}} />
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(255,255,255,0.08)',
                  borderTop: '3px solid var(--accent-primary)',
                  borderRadius: '50%',
                  animation: 'spin-xml 0.8s linear infinite'
                }} />
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-glow)',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  textShadow: '0 0 8px var(--accent-glow)'
                }}>
                  {lang === 'ru' ? 'ПАРСИНГ БАЗЫ ДАННЫХ...' : 'PARSING DATABASE...'}
                </div>
              </div>
            )}

            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>{t('db_title')}</div>
                <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>{t('db_header')}</h2>
              </div>
              {Array.isArray(xmlItems) && xmlItems.length > 0 && (
                <button 
                  className="btn btn-danger" 
                  onClick={() => {
                    if (window.confirm(t('db_clear_confirm'))) {
                      localStorage.removeItem('dayz_editor_xml_items');
                      onUpdateXmlItems([]);
                    }
                  }}
                >
                  {t('db_clear_btn')}
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {t('db_desc')}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                <label className="btn btn-accent" style={{ display: 'inline-block', cursor: 'pointer', padding: '10px 16px', margin: 0 }}>
                  {t('db_choose_btn')}
                  <input 
                    type="file" 
                    accept=".xml" 
                    onChange={(event) => {
                      const file = event.target.files[0];
                      if (!file) return;

                      const mergeChoice = Array.isArray(xmlItems) && xmlItems.length > 0
                        ? window.confirm(t('db_merge_confirm', { count: xmlItems.length }))
                        : false;

                      setIsParsingXml(true);

                      const reader = new FileReader();
                      reader.onload = (e) => {
                        try {
                          const text = e.target.result;

                          // Inline Web Worker from blob
                          const workerCode = `
                            self.onmessage = function(e) {
                              try {
                                const { text, xmlItems, mergeChoice } = e.data;
                                
                                // Clean comments
                                const cleanText = text.replace(/<!--[\\s\\S]*?-->/g, '');
                                
                                // Fast regex parser
                                const regex = /<type\\s+name=["']([^"']+)["']/g;
                                const newItems = [];
                                let fileDuplicatesCount = 0;
                                const seenInFile = new Set();
                                
                                let match;
                                while ((match = regex.exec(cleanText)) !== null) {
                                  const name = match[1];
                                  if (name) {
                                    if (seenInFile.has(name)) {
                                      fileDuplicatesCount++;
                                    } else {
                                      seenInFile.add(name);
                                      newItems.push(name);
                                    }
                                  }
                                }
                                
                                if (newItems.length === 0) {
                                  self.postMessage({ success: false, error: 'no_tags' });
                                  return;
                                }
                                
                                let finalItems = [];
                                let mergeCount = 0;
                                let databaseDuplicatesCount = 0;
                                let mergedMode = false;
                                
                                if (mergeChoice && xmlItems && xmlItems.length > 0) {
                                  mergedMode = true;
                                  const existingSet = new Set(xmlItems);
                                  newItems.forEach(item => {
                                    if (existingSet.has(item)) {
                                      databaseDuplicatesCount++;
                                    } else {
                                      existingSet.add(item);
                                      mergeCount++;
                                    }
                                  });
                                  finalItems = Array.from(existingSet);
                                } else {
                                  finalItems = newItems;
                                }
                                
                                self.postMessage({
                                  success: true,
                                  finalItems,
                                  newItemsLength: newItems.length,
                                  fileDuplicatesCount,
                                  mergeCount,
                                  databaseDuplicatesCount,
                                  mergedMode
                                });
                              } catch (err) {
                                self.postMessage({ success: false, error: err.message });
                              }
                            };
                          `;

                          const blob = new Blob([workerCode], { type: 'application/javascript' });
                          const worker = new Worker(URL.createObjectURL(blob));

                          worker.onmessage = (evt) => {
                            const data = evt.data;
                            setIsParsingXml(false);
                            worker.terminate();

                            if (data.success) {
                              const {
                                finalItems,
                                newItemsLength,
                                fileDuplicatesCount,
                                mergeCount,
                                databaseDuplicatesCount,
                                mergedMode
                              } = data;

                              onUpdateXmlItems(finalItems);

                              if (mergedMode) {
                                alert(
                                  t('db_import_completed_merge', {
                                    file: file.name,
                                    parsed: newItemsLength,
                                    internal: fileDuplicatesCount,
                                    merged: mergeCount,
                                    dbDupes: databaseDuplicatesCount,
                                    total: finalItems.length
                                  })
                                );
                              } else {
                                alert(
                                  t('db_import_completed_overwrite', {
                                    file: file.name,
                                    parsed: newItemsLength,
                                    internal: fileDuplicatesCount,
                                    total: finalItems.length
                                  })
                                );
                              }
                            } else {
                              if (data.error === 'no_tags') {
                                alert(t('db_no_tags'));
                              } else {
                                alert(t('db_parse_failed', { error: data.error }));
                              }
                            }
                            event.target.value = '';
                          };

                          worker.onerror = (err) => {
                            setIsParsingXml(false);
                            worker.terminate();
                            alert(t('db_parse_failed', { error: err.message }));
                            event.target.value = '';
                          };

                          worker.postMessage({ text, xmlItems, mergeChoice });
                        } catch (err) {
                          setIsParsingXml(false);
                          alert(t('db_parse_failed', { error: err.message }));
                          event.target.value = '';
                        }
                      };
                      reader.readAsText(file);
                    }} 
                    style={{ display: 'none' }} 
                  />
                </label>

                <div style={{ fontSize: '13px', color: (Array.isArray(xmlItems) && xmlItems.length > 0) ? '#a6f5a6' : 'var(--text-secondary)' }}>
                  {(Array.isArray(xmlItems) && xmlItems.length > 0) ? (
                    <strong>{t('db_active_db', { count: xmlItems.length })}</strong>
                  ) : (
                    t('db_no_db')
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Console output HUD */}
          <div style={{ 
            background: '#040604', 
            border: '1px solid var(--border-color)', 
            borderRadius: '2px',
            padding: '14px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            marginTop: 'auto'
          }}>
            <div style={{ color: 'var(--text-glow)', fontWeight: 'bold', display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span>▶</span>
              <span>{t('console_title')}</span>
            </div>
            <div>{t('console_init_ok', { count: totalFiles })}</div>
            <div>{t('console_diagnostics_active')}</div>
            {totalIssuesCount > 0 ? (
              <div style={{ color: 'var(--warning-color)' }}>
                {t('console_warn_issues', { syntax: syntaxErrors.length, struct: totalWarningsCount })}
              </div>
            ) : (
              <div style={{ color: '#a6f5a6' }}>
                {t('console_status_green')}
              </div>
            )}
          </div>
        </>
      )}

      {activeSubTab === 'changelog' && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>{t('change_title')}</div>
            <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>{t('change_header')}</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '8px', lineHeight: '1.4' }}>
              {t('change_desc')}
            </p>
          </div>

          {detailedChanges.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', borderRadius: '2px' }}>
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>✓</span>
              <span>{t('change_no_changes')}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {detailedChanges.map((fileChange) => (
                <div key={fileChange.filePath} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '2px' }}>
                  <div 
                    onClick={() => onOpenFile(fileChange.filePath)}
                    style={{ 
                      fontFamily: 'var(--font-mono)', 
                      fontSize: '14px', 
                      color: 'var(--text-glow)', 
                      cursor: 'pointer', 
                      textDecoration: 'underline',
                      marginBottom: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {fileChange.filePath}
                  </div>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '8px', width: '30%' }}>{t('change_th_path')}</th>
                          <th style={{ padding: '8px', width: '30%' }}>{t('change_th_orig')}</th>
                          <th style={{ padding: '8px', width: '30%' }}>{t('change_th_mod')}</th>
                          <th style={{ padding: '8px', width: '10%', textAlign: 'right' }}>{t('change_th_action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fileChange.diffs.map((d, dIdx) => (
                          <tr key={dIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                              {formatPath(d.path)}
                            </td>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>
                              {d.oldVal === undefined ? (
                                <span style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>undefined (added)</span>
                              ) : d.oldVal === null ? (
                                <span style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>null</span>
                              ) : (
                                <code style={{ color: 'var(--text-secondary)' }}>{JSON.stringify(d.oldVal)}</code>
                              )}
                            </td>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>
                              {d.newVal === undefined ? (
                                <span style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>undefined</span>
                              ) : d.newVal === null ? (
                                <span style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>null (deleted)</span>
                              ) : (
                                <code style={{ color: 'var(--text-glow)' }}>{JSON.stringify(d.newVal)}</code>
                              )}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <button
                                className="btn"
                                onClick={() => {
                                  onResetField(fileChange.filePath, d.path);
                                  toast.info(t('toast_reverted', { path: formatPath(d.path) }));
                                }}
                                style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--warning-color)', borderColor: 'var(--warning-color)' }}
                              >
                                {t('change_undo')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'backups' && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>{t('backup_title')}</div>
              <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>{t('backup_header')}</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '8px', lineHeight: '1.4' }}>
                {t('backup_desc')}
              </p>
            </div>
            <button className="btn" onClick={loadBackups} disabled={loadingBackups}>
              {loadingBackups ? t('backup_refreshing') : t('backup_refresh')}
            </button>
          </div>

          {loadingBackups && backups.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{
                width: '30px', height: '30px',
                border: '2px solid rgba(149,192,149,0.1)',
                borderTopColor: 'var(--text-glow)', borderRadius: '50%',
                animation: 'spin 1s linear infinite', margin: '0 auto 16px auto',
              }} />
              <span>{t('backup_loading')}</span>
            </div>
          ) : errorBackups ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger-color)', border: '1px dashed var(--danger-color)' }}>
              <span>ERROR FAILED TO LOAD BACKUPS: {errorBackups}</span>
            </div>
          ) : backups.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', borderRadius: '2px' }}>
              <span>{t('backup_no_points')}</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {backups.map((backup) => {
                const isFull = backup.name.startsWith('backup_all_');
                const relativeTime = (() => {
                  const diffMin = Math.round((Date.now() - backup.mtime) / 60000);
                  if (diffMin < 1) return t('time_just_now');
                  if (diffMin < 60) return t('time_min_ago', { count: diffMin });
                  const diffHrs = Math.round(diffMin / 60);
                  if (diffHrs < 24) return t('time_hours_ago', { count: diffHrs });
                  return t('time_days_ago', { count: Math.round(diffHrs / 24) });
                })();
                const isExpanded = !!expandedBackups[backup.name];

                return (
                  <div
                    key={backup.name}
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderTop: `3px solid ${isFull ? 'var(--text-glow)' : 'var(--warning-color)'}`,
                      borderRadius: '2px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '9px',
                          color: '#000',
                          background: isFull ? 'var(--text-glow)' : 'var(--warning-color)',
                          padding: '2px 6px',
                          fontWeight: 'bold',
                          borderRadius: '2px',
                          letterSpacing: '1px'
                        }}>
                          {isFull ? t('backup_full') : t('backup_single')}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dark)' }} title={new Date(backup.mtime).toLocaleString()}>
                          {relativeTime}
                        </span>
                      </div>
                      <h4 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-glow)', wordBreak: 'break-all' }}>
                        {backup.name}
                      </h4>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {t('backup_files_in_archive', { count: backup.files.length })}
                    </div>

                    <div>
                      <button
                        className="btn"
                        style={{ width: '100%', padding: '6px', fontSize: '11px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onClick={() => setExpandedBackups(prev => ({ ...prev, [backup.name]: !isExpanded }))}
                      >
                        <span>{isExpanded ? t('backup_hide_files') : t('backup_show_files')}</span>
                        <span>{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div style={{
                          marginTop: '8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          padding: '8px',
                          borderRadius: '2px',
                          maxHeight: '120px',
                          overflowY: 'auto',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          {backup.files.map(f => (
                            <div key={f} style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                              · {f}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                      <button
                        className="btn btn-danger"
                        style={{ width: '100%', padding: '8px', fontWeight: 'bold' }}
                        onClick={() => {
                          onShowConfirm({
                            title: t('modal_confirm_restore_title'),
                            body: t('modal_confirm_restore_body', { backup: backup.name }),
                            severity: 'danger',
                            confirmLabel: t('backup_restore_btn'),
                            cancelLabel: t('modal_confirm_cancel'),
                            onConfirm: () => {
                              fileService.restoreBackup(backup.name)
                                .then(() => {
                                  toast.success(t('toast_restore_success', { backup: backup.name }));
                                  fetchConfigs(); // reload all configs
                                })
                                .catch(err => {
                                  toast.error(t('toast_restore_failed', { error: err.message }));
                                });
                            }
                          });
                        }}
                      >
                        {t('backup_restore_btn')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'validator' && (
        <ValidatorPanel schemaReport={schemaReport} t={t} />
      )}

      {activeSubTab === 'analytics' && (
        <AnalyticsPanel 
          totalQuests={totalQuests}
          totalNPCs={totalNPCs}
          totalMarketItems={totalMarketItems}
          totalPatrols={totalPatrols}
          totalSafeZones={totalSafeZones}
          totalFiles={totalFiles}
          totalPatrolWaypoints={totalPatrolWaypoints}
          totalMpgSpawnerFiles={totalMpgSpawnerFiles}
          totalMpgTriggers={totalMpgTriggers}
          totalMpgSpawnPoints={totalMpgSpawnPoints}
          totalQuestObjectives={totalQuestObjectives}
          objectiveTypesBreakdown={objectiveTypesBreakdown}
          marketItems={marketItems}
          xmlItems={xmlItems}
          t={t}
          lang={lang}
        />
      )}

    </div>
  );
}

function ValidatorPanel({ schemaReport, t }) {
  const [inputText, setInputText] = useState('');
  const [schemaKey, setSchemaKey] = useState('auto');
  const [validationResult, setValidationResult] = useState(null);

  const schemaOptions = useMemo(() => {
    if (!schemaReport || !schemaReport.files) return [];
    return Object.entries(schemaReport.files)
      .map(([filePath, info]) => ({
        filePath,
        name: filePath.split('/').pop().replace('.json', '')
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [schemaReport]);

  const handleValidate = () => {
    if (!inputText.trim()) {
      setValidationResult(null);
      return;
    }

    try {
      const cleaned = cleanJsonComments(inputText);
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (err) {
        setValidationResult({
          success: false,
          syntaxError: err.message,
          errors: []
        });
        return;
      }

      let activeSchema = null;
      let matchedPath = schemaKey;
      if (schemaKey === 'auto') {
        if (parsed.Patrols !== undefined) {
          matchedPath = 'expansion/settings/AIPatrolSettings.json';
        } else if (parsed.CircleZones !== undefined || parsed.PolygonZones !== undefined) {
          matchedPath = 'expansion/settings/SafeZoneSettings.json';
        } else if (parsed.FollowUpQuest !== undefined || parsed.PreQuestIDs !== undefined) {
          matchedPath = 'expansionmod/quests/quests/quest_1.json';
        } else if (parsed.NPCName !== undefined || parsed.NPCClassName !== undefined) {
          matchedPath = 'expansionmod/quests/npcs/questnpc_1.json';
        } else if (parsed.Items !== undefined && parsed.DisplayName === undefined) {
          matchedPath = 'expansionmod/market/category_example.json';
        } else if (parsed.ShoryukenChance !== undefined || parsed.AccuracyMin !== undefined) {
          matchedPath = 'ExpansionMod/Settings/AISettings.json';
        } else {
          const parsedKeys = Object.keys(parsed);
          const bestMatch = schemaOptions.find(opt => {
            const sch = schemaReport.files[opt.filePath]?.schema;
            if (sch && sch.properties) {
              const schKeys = Object.keys(sch.properties);
              const overlap = parsedKeys.filter(k => schKeys.includes(k)).length;
              return overlap > parsedKeys.length * 0.5;
            }
            return false;
          });
          if (bestMatch) {
            matchedPath = bestMatch.filePath;
          }
        }
      }

      if (matchedPath === 'auto' || !schemaReport?.files?.[matchedPath]?.schema) {
        setValidationResult({
          success: false,
          schemaError: t('val_err_no_schema'),
          errors: []
        });
        return;
      }

      const schema = schemaReport.files[matchedPath].schema;
      const errors = validateConfig(parsed, schema, matchedPath, allQuestsIds, marketCategories, marketItems, configs);
      setValidationResult({
        success: errors.length === 0,
        errors,
        detectedSchema: matchedPath.split('/').pop().replace('.json', ''),
        cleanText: JSON.stringify(parsed, null, 4)
      });

    } catch (e) {
      setValidationResult({
        success: false,
        syntaxError: e.message,
        errors: []
      });
    }
  };

  const handleCleanAndFormat = () => {
    if (!inputText.trim()) return;
    try {
      const cleaned = cleanJsonComments(inputText);
      const parsed = JSON.parse(cleaned);
      setInputText(JSON.stringify(parsed, null, 4));
      setTimeout(() => handleValidate(), 50);
    } catch (err) {
      alert(t('val_err_invalid_json', { error: err.message }));
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
      {/* Input panel */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>{t('val_title')}</div>
          <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>{t('val_header')}</h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{t('val_desc')}</p>
        </div>

        <div className="form-group">
          <label style={{ fontSize: '12px' }}>{t('val_label_select_schema')}</label>
          <select value={schemaKey} onChange={(e) => setSchemaKey(e.target.value)}>
            <option value="auto">{t('val_opt_autodetect')}</option>
            {schemaOptions.map(opt => (
              <option key={opt.filePath} value={opt.filePath}>{opt.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea
            style={{ 
              flex: 1, 
              minHeight: '260px', 
              fontFamily: 'var(--font-mono)', 
              fontSize: '12px', 
              background: 'var(--bg-primary)', 
              color: 'var(--text-primary)', 
              border: '1px solid var(--border-color)', 
              padding: '12px',
              resize: 'vertical',
              lineHeight: '1.5'
            }}
            placeholder='{ "Patrols": [...] }'
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-accent" onClick={handleValidate} style={{ flex: 1, justifyContent: 'center' }}>
            {t('val_btn_validate')}
          </button>
          <button className="btn" onClick={handleCleanAndFormat}>
            {t('val_btn_clean')}
          </button>
        </div>
      </div>

      {/* Results panel */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          {t('status_healing_title')}
        </h3>

        {validationResult === null ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', padding: '40px', textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📋</span>
              <span>Paste JSON and click Validate to view results</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
            
            {validationResult.detectedSchema && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Schema Matched: <span style={{ color: 'var(--text-glow)', fontWeight: 'bold' }}>{validationResult.detectedSchema}</span>
              </div>
            )}

            {validationResult.success && (
              <div style={{ padding: '20px', textAlign: 'center', border: '1px solid #a6f5a6', color: '#a6f5a6', borderRadius: '2px', background: 'rgba(74, 154, 74, 0.04)' }}>
                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>✓</span>
                <span>{t('val_status_success')}</span>
              </div>
            )}

            {validationResult.syntaxError && (
              <div style={{ background: 'rgba(235, 103, 103, 0.04)', border: '1px solid var(--danger-color)', borderRadius: '2px', padding: '12px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--danger-color)', fontWeight: 'bold', marginBottom: '6px' }}>
                  Syntax Error
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '8px', border: '1px solid #2a1414', borderRadius: '2px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                  {validationResult.syntaxError}
                </div>
              </div>
            )}

            {validationResult.schemaError && (
              <div style={{ background: 'rgba(235, 214, 103, 0.04)', border: '1px solid var(--warning-color)', borderRadius: '2px', padding: '12px', color: 'var(--warning-color)', fontSize: '13px' }}>
                {validationResult.schemaError}
              </div>
            )}

            {validationResult.errors.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--warning-color)' }}>
                  {t('val_list_errors', { count: validationResult.errors.length })}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {validationResult.errors.map((err, idx) => (
                    <div 
                      key={idx}
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        background: 'var(--bg-primary)',
                        padding: '8px 12px',
                        border: '1px solid rgba(235, 214, 103, 0.15)',
                        borderRadius: '2px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--warning-color)' }}>
                        {err.path.join('.') || 'root'} ({err.type})
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {err.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsPanel({
  totalQuests,
  totalNPCs,
  totalMarketItems,
  totalPatrols,
  totalSafeZones,
  totalFiles,
  totalPatrolWaypoints,
  totalMpgSpawnerFiles,
  totalMpgTriggers,
  totalMpgSpawnPoints,
  totalQuestObjectives,
  objectiveTypesBreakdown,
  marketItems,
  xmlItems = [],
  t,
  lang
}) {
  // 1. Donut Chart Calculations
  const donutData = [
    { label: lang === 'ru' ? 'Квесты' : 'Quests', count: totalQuests, color: '#a29bfe' },
    { label: lang === 'ru' ? 'Безопасные зоны' : 'Safezones', count: totalSafeZones, color: '#2ecc71' },
    { label: lang === 'ru' ? 'NPC Персонажи' : 'NPCs', count: totalNPCs, color: '#eccc68' },
    { label: lang === 'ru' ? 'ИИ Патрули' : 'AI Patrols', count: totalPatrols, color: '#ff7675' },
    { label: lang === 'ru' ? 'Цели квестов' : 'Quest Objectives', count: totalQuestObjectives, color: '#fd79a8' },
    { label: lang === 'ru' ? 'Триггеры MPG' : 'MPG Triggers', count: totalMpgTriggers, color: '#74b9ff' }
  ].filter(item => item.count > 0);

  const totalEntityCount = donutData.reduce((acc, curr) => acc + curr.count, 0);
  const R = 70;
  const circumference = 2 * Math.PI * R;
  let accumulatedCircumference = 0;
  const donutSlices = donutData.map(item => {
    const percentage = totalEntityCount > 0 ? item.count / totalEntityCount : 0;
    const strokeLength = percentage * circumference;
    const strokeOffset = circumference - strokeLength + accumulatedCircumference;
    accumulatedCircumference += strokeLength;
    return {
      ...item,
      percentage: Math.round(percentage * 100),
      strokeDasharray: `${strokeLength} ${circumference}`,
      strokeDashoffset: strokeOffset
    };
  });

  // 2. Bar Chart Calculations
  const typeNames = {
    2: { label: lang === 'ru' ? 'Убийство (Kill)' : 'Kill Target', color: '#ff7675' },
    3: { label: lang === 'ru' ? 'Путешествие' : 'Travel', color: '#74b9ff' },
    4: { label: lang === 'ru' ? 'Сбор' : 'Collection', color: '#ffeaa7' },
    5: { label: lang === 'ru' ? 'Доставка' : 'Delivery', color: '#a29bfe' },
    6: { label: lang === 'ru' ? 'Сокровища' : 'Treasure Hunt', color: '#fab1a0' },
    7: { label: lang === 'ru' ? 'ИИ Патруль' : 'AI Patrol', color: '#81ecec' },
    8: { label: lang === 'ru' ? 'ИИ Лагерь' : 'AI Camp', color: '#fdcb6e' },
    9: { label: lang === 'ru' ? 'VIP Эскорт' : 'VIP Escort', color: '#e84393' },
    10: { label: lang === 'ru' ? 'Действие' : 'Action', color: '#fd79a8' },
    11: { label: lang === 'ru' ? 'Крафт' : 'Crafting', color: '#55efc4' }
  };

  const activeObjKeys = Object.keys(objectiveTypesBreakdown || {}).filter(k => objectiveTypesBreakdown[k] > 0);
  const maxObjVal = Math.max(...Object.values(objectiveTypesBreakdown || {}), 1);

  // 3. Trader XML database coverage
  const hasXml = Array.isArray(xmlItems) && xmlItems.length > 0;
  const uniqueMarketItemsCount = marketItems ? marketItems.size : 0;
  const xmlTotalCount = hasXml ? xmlItems.length : 0;
  const coveragePct = hasXml ? Math.min(Math.round((uniqueMarketItemsCount / xmlTotalCount) * 100), 100) : 0;
  const C_coverage = 2 * Math.PI * 60;
  const strokeOffsetCoverage = C_coverage - (coveragePct / 100) * C_coverage;

  // Find orphaned trader items (configured in market but not in types.xml database)
  const orphanedMarketItems = useMemo(() => {
    if (!hasXml || !marketItems) return 0;
    const xmlSet = new Set(xmlItems.map(i => i.toLowerCase()));
    let count = 0;
    marketItems.forEach(i => {
      if (!xmlSet.has(i.toLowerCase())) count++;
    });
    return count;
  }, [marketItems, xmlItems, hasXml]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginTop: '16px' }}>
      
      {/* 1. Entity Distribution Donut Chart */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>// CONFIGURATION_MAP_ENTITIES</div>
          <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>
            {lang === 'ru' ? 'Распределение объектов' : 'Entity Distribution Ratio'}
          </h2>
        </div>

        {totalEntityCount === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', minHeight: '200px' }}>
            {lang === 'ru' ? 'Нет размещенных объектов на карте' : 'No mapped entities detected'}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '180px', height: '180px' }}>
              <svg width="180" height="180" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="70" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="22" />
                {donutSlices.map((slice, idx) => (
                  <circle
                    key={idx}
                    cx="100"
                    cy="100"
                    r="70"
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth="22"
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    transform="rotate(-90 100 100)"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                ))}
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)' }}>{totalEntityCount}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {lang === 'ru' ? 'всего' : 'total'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '180px' }}>
              {donutSlices.map((slice, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', background: slice.color, borderRadius: '2px' }} />
                    <span style={{ color: 'var(--text-primary)' }}>{slice.label}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                    <span style={{ color: 'var(--text-glow)' }}>{slice.count}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '10px', marginLeft: '6px' }}>({slice.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Trader Database Coverage Circular Gauge */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>// TRADER_ITEMS_INTEGRATION</div>
          <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>
            {lang === 'ru' ? 'Покрытие базы данных XML' : 'Trader XML Database Coverage'}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '140px', height: '140px' }}>
            <svg width="140" height="140" viewBox="0 0 150 150">
              <defs>
                <filter id="glow-neon" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <circle cx="75" cy="75" r="60" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="12" />
              <circle 
                cx="75" 
                cy="75" 
                r="60" 
                fill="none" 
                stroke={hasXml ? "#00ffff" : "rgba(255,255,255,0.15)"}
                strokeWidth="12" 
                strokeDasharray="377" 
                strokeDashoffset={hasXml ? strokeOffsetCoverage : 377} 
                strokeLinecap="round"
                transform="rotate(-90 75 75)"
                filter={hasXml ? "url(#glow-neon)" : "none"}
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
              <text 
                x="75" 
                y="82" 
                fill="#ffffff" 
                fontSize="24px" 
                fontFamily="var(--font-heading)" 
                fontWeight="bold" 
                textAnchor="middle"
              >
                {hasXml ? `${coveragePct}%` : 'N/A'}
              </text>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '2px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {lang === 'ru' ? 'Активных товаров торговцев:' : 'Trader active items:'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text-glow)', fontSize: '14px' }}>
                {uniqueMarketItemsCount}
              </span>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '2px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {lang === 'ru' ? 'Всего предметов в types.xml:' : 'Total types.xml database:'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: hasXml ? '#2ecc71' : 'var(--text-dark)', fontSize: '14px' }}>
                {hasXml ? xmlTotalCount : (lang === 'ru' ? 'не загружен' : 'Not Loaded')}
              </span>
            </div>

            {hasXml && (
              <div 
                style={{ 
                  background: 'rgba(235, 103, 103, 0.03)', 
                  padding: '10px', 
                  borderRadius: '2px', 
                  border: orphanedMarketItems > 0 ? '1px solid rgba(235, 103, 103, 0.3)' : '1px solid var(--border-color)', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}
              >
                <span style={{ fontSize: '12px', color: orphanedMarketItems > 0 ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
                  {lang === 'ru' ? 'Устаревшие/неизвестные товары (ошибки):' : 'Orphaned/Unknown items (errors):'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: orphanedMarketItems > 0 ? 'var(--danger-color)' : '#2ecc71', fontSize: '14px' }}>
                  {orphanedMarketItems}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Quest Objectives by Type Bar Chart */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>// QUEST_OBJECTIVES_CLASSIFICATION</div>
          <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>
            {lang === 'ru' ? 'Цели квестов по типам' : 'Quest Objectives by Type'}
          </h2>
        </div>

        {activeObjKeys.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', minHeight: '200px' }}>
            {lang === 'ru' ? 'Нет созданных целей квестов' : 'No quest objectives configured'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ overflowX: 'auto' }}>
              <svg width="460" height="190">
                <line x1="40" y1="150" x2="450" y2="150" stroke="var(--border-color)" strokeWidth="1" />
                {(() => {
                  const chartWidth = 410;
                  const chartHeight = 150;
                  const barPadding = 16;
                  const numBars = activeObjKeys.length;
                  const barWidth = Math.max(16, (chartWidth - (numBars - 1) * barPadding) / numBars);

                  return activeObjKeys.map((key, idx) => {
                    const count = objectiveTypesBreakdown[key];
                    const info = typeNames[key] || { label: `Type ${key}`, color: '#95afc0' };
                    const barHeight = (count / maxObjVal) * (chartHeight - 30);
                    const x = 45 + idx * (barWidth + barPadding);
                    const y = chartHeight - barHeight;

                    return (
                      <g key={key}>
                        {/* Bar */}
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          fill={info.color}
                          rx="2"
                          ry="2"
                          opacity="0.85"
                          style={{ transition: 'all 0.3s ease' }}
                        />
                        {/* Count text */}
                        <text
                          x={x + barWidth / 2}
                          y={y - 6}
                          fill="var(--text-primary)"
                          fontSize="9px"
                          fontFamily="var(--font-mono)"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {count}
                        </text>
                        {/* Short code label */}
                        <text
                          x={x + barWidth / 2}
                          y={chartHeight + 14}
                          fill="var(--text-secondary)"
                          fontSize="8px"
                          fontFamily="var(--font-mono)"
                          textAnchor="middle"
                        >
                          {info.label.split(' ')[0]}
                        </text>
                      </g>
                    );
                  });
                })()}
              </svg>
            </div>
            
            {/* Detailed Legend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
              {activeObjKeys.map(key => {
                const info = typeNames[key] || { label: `Type ${key}`, color: '#95afc0' };
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', background: info.color, borderRadius: '1px' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{info.label}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text-glow)' }}>
                      {objectiveTypesBreakdown[key]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. MPG Spawners & AI Patrols detailed metrics */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>// SPATIAL_AND_AI_METRICS</div>
          <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>
            {lang === 'ru' ? 'Аналитика ИИ и MPG спавнеров' : 'Spatial Spawner & Patrol Metrics'}
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* MPG Spawner stats */}
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--text-glow)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', display: 'flex', gap: '6px' }}>
              <span>👾</span>
              <span>MPG Spawner</span>
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '2px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Файлы точек' : 'Points Files'}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>{totalMpgSpawnerFiles}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '2px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Всего триггеров' : 'Total Triggers'}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>{totalMpgTriggers}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '2px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Точки спавна' : 'Spawn Points'}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>{totalMpgSpawnPoints}</div>
              </div>
            </div>
          </div>

          {/* AI Patrols stats */}
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--text-glow)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', display: 'flex', gap: '6px' }}>
              <span>🤖</span>
              <span>{lang === 'ru' ? 'ИИ Патрули' : 'AI Patrol Routes'}</span>
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '2px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Активные патрули' : 'Active Patrols'}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>{totalPatrols}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '2px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Всего точек пути' : 'Total Waypoints'}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>{totalPatrolWaypoints}</div>
              </div>
            </div>
          </div>

          {/* Warnings & Optimization section */}
          {(() => {
            const issues = [];
            if (totalPatrols > 0 && totalPatrolWaypoints === 0) {
              issues.push({ text: lang === 'ru' ? 'ВНИМАНИЕ: Все патрули имеют 0 точек пути (будут стоять на месте).' : 'WARNING: All AI patrols have 0 waypoints (they will remain static).', type: 'warning' });
            }
            if (totalMpgTriggers > 0 && totalMpgSpawnPoints === 0) {
              issues.push({ text: lang === 'ru' ? 'ВНИМАНИЕ: MPG спавнеры загружены, но нет ни одной точки спавна.' : 'WARNING: MPG triggers are loaded but contain no spawn points.', type: 'warning' });
            }
            if (issues.length === 0) {
              return (
                <div style={{ background: 'rgba(74, 154, 74, 0.03)', border: '1px solid rgba(74, 154, 74, 0.2)', padding: '10px', borderRadius: '2px', fontSize: '11px', color: '#a6f5a6', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span>✓</span>
                  <span>{lang === 'ru' ? 'Пространственные структуры оптимизированы и валидны.' : 'Spatial structures optimized and valid.'}</span>
                </div>
              );
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {issues.map((issue, idx) => (
                  <div key={idx} style={{ background: 'rgba(235, 214, 103, 0.04)', border: '1px solid rgba(235, 214, 103, 0.3)', padding: '10px', borderRadius: '2px', fontSize: '11px', color: 'var(--warning-color)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span>⚠️</span>
                    <span>{issue.text}</span>
                  </div>
                ))}
              </div>
            );
          })()}

        </div>
      </div>

    </div>
  );
}
