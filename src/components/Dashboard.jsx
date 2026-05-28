import React, { useMemo, useState, useEffect } from 'react';
import { validateConfig } from '../utils/diagnostics';
import { useToast } from './ToastManager';
import * as fileService from '../services/fileService';
import { translations } from '../utils/localization';

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
  lang = 'ru'
}) {
  const toast = useToast();

  const t = (key, replacements = {}) => {
    let text = translations[lang]?.[key] || translations['en']?.[key] || key;
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
    return text;
  };

  const [activeSubTab, setActiveSubTab] = useState('status');
  const [backups, setBackups] = useState([]);
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
    dirtyFiles
  } = useMemo(() => {
    let tQuests = 0;
    let tNPCs = 0;
    let tMarketItems = 0;
    let tPatrols = 0;
    let tSafeZones = 0;

    const synErrors = [];
    const structWarnings = [];
    const dFiles = [];

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
      const isDirty = file.success && JSON.stringify(file.content) !== JSON.stringify(file.originalContent);
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
      }
      if (lowerPath === 'expansion/settings/safezonesettings.json') {
        if (Array.isArray(content.CircleZones)) tSafeZones += content.CircleZones.length;
        if (Array.isArray(content.PolygonZones)) tSafeZones += content.PolygonZones.length;
        if (Array.isArray(content.CylinderZones)) tSafeZones += content.CylinderZones.length;
      }

      // Run structural validator using schema report
      const fileSchema = schemaReport?.files?.[filePath]?.schema;
      if (fileSchema) {
        const fileErrors = validateConfig(content, fileSchema, filePath, allQuestsIds, marketCategories, marketItems);
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
      dirtyFiles: dFiles
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
      if (file.success && file.originalContent && JSON.stringify(file.content) !== JSON.stringify(file.originalContent)) {
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
          { id: 'backups', label: t('dash_sub_backups'), icon: '📂' }
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
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '2px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>{t('db_title')}</div>
                <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-glow)' }}>{t('db_header')}</h2>
              </div>
              {xmlItems.length > 0 && (
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

                      const reader = new FileReader();
                      reader.onload = (e) => {
                        try {
                          const text = e.target.result;
                          const parser = new DOMParser();
                          const xmlDoc = parser.parseFromString(text, 'text/xml');
                          
                          const parseError = xmlDoc.getElementsByTagName('parsererror');
                          if (parseError.length > 0) {
                            throw new Error('Invalid XML format: ' + parseError[0].textContent);
                          }

                          const typeNodes = xmlDoc.getElementsByTagName('type');
                          const newItems = [];
                          let fileDuplicatesCount = 0;
                          const seenInFile = new Set();
                          
                          for (let i = 0; i < typeNodes.length; i++) {
                            const name = typeNodes[i].getAttribute('name');
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
                            alert(t('db_no_tags'));
                            return;
                          }

                          let finalItems = [];
                          let mergeCount = 0;
                          let databaseDuplicatesCount = 0;
                          let mergedMode = false;

                          if (xmlItems.length > 0) {
                            const mergeChoice = window.confirm(
                              t('db_merge_confirm', { count: xmlItems.length })
                            );

                            if (mergeChoice) {
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
                          } else {
                            finalItems = newItems;
                          }

                          localStorage.setItem('dayz_editor_xml_items', JSON.stringify(finalItems));
                          onUpdateXmlItems(finalItems);

                          if (mergedMode) {
                            alert(
                              t('db_import_completed_merge', {
                                file: file.name,
                                parsed: newItems.length,
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
                                parsed: newItems.length,
                                internal: fileDuplicatesCount,
                                total: finalItems.length
                              })
                            );
                          }
                        } catch (err) {
                          alert(t('db_parse_failed', { error: err.message }));
                        }
                      };
                      reader.readAsText(file);
                    }} 
                    style={{ display: 'none' }} 
                  />
                </label>

                <div style={{ fontSize: '13px', color: xmlItems.length > 0 ? '#a6f5a6' : 'var(--text-secondary)' }}>
                  {xmlItems.length > 0 ? (
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

    </div>
  );
}
