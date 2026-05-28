import React, { useState, useEffect } from 'react';
import ConfigForm from './ConfigForm';
import { translations } from '../utils/localization';

export default function SettingsEditor({ 
  configs, 
  onChangeField, 
  onResetField, 
  onResetFile, 
  onSaveFile,
  inferredEnums,
  onNavigateToMap,
  lang = 'ru'
}) {
  const t = (key, replacements = {}) => {
    let text = translations[lang]?.[key] || translations['en']?.[key] || key;
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
    return text;
  };

  const [selectedSettingsPath, setSelectedSettingsPath] = useState(null);

  // Filter all server settings files
  const settingsPaths = Object.keys(configs).filter(p => {
    const lower = p.toLowerCase();
    return (
      (lower.startsWith('expansion/settings/') || lower.startsWith('expansionmod/settings/')) &&
      lower.endsWith('.json')
    );
  });

  // Sort settings files alphabetically by filename
  settingsPaths.sort((a, b) => {
    const fileA = a.split('/').pop();
    const fileB = b.split('/').pop();
    return fileA.localeCompare(fileB);
  });

  // Default select first settings file on load
  useEffect(() => {
    if (settingsPaths.length > 0 && !selectedSettingsPath) {
      setSelectedSettingsPath(settingsPaths[0]);
    }
  }, [settingsPaths, selectedSettingsPath]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Settings list sub-panel */}
      <div style={{ 
        width: '250px', 
        background: 'var(--bg-secondary)', 
        borderRight: '1px solid var(--border-color)', 
        display: 'flex', 
        flexDirection: 'column',
        userSelect: 'none'
      }}>
        <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '2px', fontWeight: 'bold' }}>
            // {t('settings_server_settings')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '4px' }}>
            {t('settings_total', { count: settingsPaths.length })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {settingsPaths.map(path => {
            const isSelected = path === selectedSettingsPath;
            const file = configs[path];
            const hasUnsaved = file && JSON.stringify(file.content) !== JSON.stringify(file.originalContent);
            const success = file ? file.success : true;
            
            // Clean filename for display, e.g. "SafeZoneSettings"
            const name = path.split('/').pop().replace('.json', '');

            let textColor = 'var(--text-primary)';
            if (!success) textColor = 'var(--danger-color)';
            else if (isSelected) textColor = 'var(--text-glow)';

            return (
              <div
                key={path}
                onClick={() => setSelectedSettingsPath(path)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  background: isSelected ? 'rgba(149, 192, 149, 0.1)' : 'transparent',
                  borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                  color: textColor,
                  borderBottom: '1px solid rgba(30, 48, 30, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.1s'
                }}
                onMouseOver={e => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(149, 192, 149, 0.03)';
                }}
                onMouseOut={e => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {name}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                    {path.startsWith('expansion/') ? 'expansion/' : 'ExpansionMod/'}
                  </span>
                </div>
                {hasUnsaved && <span className="badge-dirty" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Embedded Dynamic Form Config Editor on the right */}
      <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        {selectedSettingsPath ? (
          <ConfigForm
            filePath={selectedSettingsPath}
            config={configs[selectedSettingsPath]}
            onChangeField={onChangeField}
            onResetField={onResetField}
            onResetFile={onResetFile}
            onSaveFile={onSaveFile}
            inferredEnums={inferredEnums}
            onNavigateToMap={onNavigateToMap}
            lang={lang}
          />
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <span>{t('settings_select_config')}</span>
          </div>
        )}
      </div>

    </div>
  );
}
