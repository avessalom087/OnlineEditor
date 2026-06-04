import React, { useState } from 'react';
import { useTranslation } from '../utils/localization';

// Common enums used in DayZ Expansion configuration
const STATIC_ENUMS = {
  'Behaviour': ['ROAMING_LOCAL', 'HALT', 'ROAMING_SELF', 'PATROL_ROAMING', 'LOOP_OR_ALTERNATE', 'ROAMING_UNLIMITED'],
  'LootingBehaviour': [
    'DEFAULT | CLOTHING_BODY | CLOTHING_LEGS | CLOTHING_GLOVES | CLOTHING_FEET | CLOTHING_SIMILAR | UPGRADE',
    'DEFAULT | CLOTHING_BODY | CLOTHING_LEGS | CLOTHING_FEET | CLOTHING_SIMILAR',
    'DEFAULT | CLOTHING_BODY | CLOTHING_LEGS | CLOTHING_HEADGEAR | CLOTHING_MASK | CLOTHING_GLOVES | CLOTHING_FEET | CLOTHING_SIMILAR',
    'NONE'
  ],
  'Faction': ['West', 'East', 'Guards', 'Civilian', 'InvincibleObservers', 'Passive', 'Aggressive', 'Shamans', 'Survivors'],
  'Speed': ['WALK', 'JOG', 'SPRINT'],
  'UnderThreatSpeed': ['WALK', 'JOG', 'SPRINT'],
  'DefaultStance': ['STANDING', 'CROUCHED', 'PRONE', 'RELAXED'],
  'WaypointInterpolation': ['', 'UniformCubic', 'Linear'],
  'Type': [1, 2, 3, 4], // Quest Type
  'ObjectiveType': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
};

// Helper to check if a value is a 3D vector [x, y, z]
function isVector3(arr) {
  return Array.isArray(arr) && arr.length === 3 && arr.every(v => typeof v === 'number');
}

// Collapsible Group Wrapper
function Accordion({ title, children, isDirty, onReset, isList = false, onRemove, t }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="accordion" style={{ borderColor: isDirty ? 'var(--warning-color)' : 'var(--border-color)' }}>
      <div 
        className="accordion-header" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: isDirty ? 'rgba(235, 214, 103, 0.03)' : 'var(--bg-secondary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {isOpen ? '▼' : '▶'}
          </span>
          <span style={{ 
            fontFamily: 'var(--font-heading)', 
            fontWeight: '700', 
            letterSpacing: '1px',
            color: isDirty ? 'var(--warning-color)' : 'var(--text-primary)',
            textTransform: 'uppercase'
          }}>
            {title}
          </span>
          {isDirty && <span className="badge-dirty" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
          {onReset && isDirty && (
            <button 
              className="btn btn-warning" 
              onClick={onReset}
              style={{ padding: '3px 8px', fontSize: '10px' }}
              title={t ? t('config_reset') : "RESET"}
            >
              {t ? t('config_reset') : "RESET"}
            </button>
          )}
          {isList && onRemove && (
            <button 
              className="btn btn-danger" 
              onClick={onRemove}
              style={{ padding: '3px 8px', fontSize: '10px' }}
              title={t ? t('config_delete') : "DELETE"}
            >
              {t ? t('config_delete') : "DELETE"}
            </button>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="accordion-content">
          {children}
        </div>
      )}
    </div>
  );
}

// Checkbox Component
function CustomCheckbox({ checked, onChange, label, isDirty }) {
  return (
    <div 
      className="checkbox-container" 
      onClick={() => onChange(!checked)}
      style={{ margin: '8px 0' }}
    >
      <div className={`checkbox-custom ${checked ? 'checked' : ''}`} />
      <span style={{ 
        color: isDirty ? 'var(--warning-color)' : 'var(--text-primary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px'
      }} className={isDirty ? 'field-dirty-label' : ''}>
        {label}
      </span>
    </div>
  );
}

// Recursive Form Generator
function RenderFormNode({ 
  keyName, 
  value, 
  originalValue, 
  path, 
  onChange, 
  onResetKey, 
  inferredEnums,
  onNavigateToMap,
  t
}) {
  const isDirty = JSON.stringify(value) !== JSON.stringify(originalValue);
  const displayLabel = keyName.replace(/([A-Z])/g, ' $1').trim(); // Convert CamelCase to readable spacing
  
  // 1. Boolean check
  if (typeof value === 'boolean') {
    return (
      <div className="form-group">
        <CustomCheckbox 
          checked={value} 
          onChange={(newVal) => onChange(path, newVal)} 
          label={displayLabel}
          isDirty={isDirty}
        />
      </div>
    );
  }

  // 2. Vector3 check
  if (isVector3(value)) {
    const origVec = isVector3(originalValue) ? originalValue : [0, 0, 0];
    return (
      <div className="form-group" style={{ borderLeft: isDirty ? '2px solid var(--warning-color)' : 'none', paddingLeft: isDirty ? '8px' : '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className={isDirty ? 'field-dirty-label' : ''} style={{ margin: 0 }}>
            {displayLabel} {t ? "(3D VECTOR)" : "(3D VECTOR)"}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onNavigateToMap && (
              <button 
                type="button" 
                className="btn btn-accent"
                onClick={() => onNavigateToMap(value, path)}
                style={{ padding: '2px 6px', fontSize: '9px', fontFamily: 'var(--font-mono)' }}
              >
                🖈 {t ? t('config_show_on_map') : "SHOW ON MAP"}
              </button>
            )}
            {isDirty && (
              <button 
                type="button" 
                className="btn btn-warning" 
                onClick={() => onResetKey(path)}
                style={{ padding: '2px 6px', fontSize: '9px' }}
              >
                {t ? t('config_reset') : "RESET"}
              </button>
            )}
          </div>
        </div>
        <div className="form-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>X:</span>
            <input 
              type="number" 
              step="any"
              value={value[0]} 
              onChange={e => onChange([...path, 0], Number(e.target.value))}
              className={value[0] !== origVec[0] ? 'field-dirty' : ''}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Y:</span>
            <input 
              type="number" 
              step="any"
              value={value[1]} 
              onChange={e => onChange([...path, 1], Number(e.target.value))}
              className={value[1] !== origVec[1] ? 'field-dirty' : ''}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Z:</span>
            <input 
              type="number" 
              step="any"
              value={value[2]} 
              onChange={e => onChange([...path, 2], Number(e.target.value))}
              className={value[2] !== origVec[2] ? 'field-dirty' : ''}
            />
          </div>
        </div>
      </div>
    );
  }

  // 3. Array check (list of elements)
  if (Array.isArray(value)) {
    const isArrayOfObjects = value.length > 0 && typeof value[0] === 'object' && value[0] !== null;

    const handleAddItem = () => {
      // Get template from original array, or infer from schema, or empty object
      let newItemTemplate = "";
      if (value.length > 0) {
        newItemTemplate = JSON.parse(JSON.stringify(value[0]));
        // Reset properties
        const resetObj = (obj) => {
          for (const k of Object.keys(obj)) {
            if (typeof obj[k] === 'object' && obj[k] !== null) resetObj(obj[k]);
            else if (typeof obj[k] === 'number') obj[k] = 0;
            else if (typeof obj[k] === 'boolean') obj[k] = false;
            else obj[k] = "";
          }
        };
        if (typeof newItemTemplate === 'object' && newItemTemplate !== null) {
          resetObj(newItemTemplate);
        }
      }
      onChange(path, [...value, newItemTemplate]);
    };

    const handleRemoveItem = (index) => {
      const newList = [...value];
      newList.splice(index, 1);
      onChange(path, newList);
    };

    return (
      <div style={{ marginBottom: '16px', borderLeft: isDirty ? '2px solid var(--warning-color)' : 'none', paddingLeft: isDirty ? '8px' : '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className={isDirty ? 'field-dirty-label' : ''} style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
            {displayLabel} (ARRAY · {value.length} {t ? t('econ_all_items') : "ITEMS"})
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              className="btn btn-accent" 
              onClick={handleAddItem}
              style={{ padding: '2px 8px', fontSize: '10px' }}
            >
              [+] {t ? t('trader_add_currency') : "ADD ITEM"}
            </button>
            {isDirty && (
              <button 
                type="button" 
                className="btn btn-warning" 
                onClick={() => onResetKey(path)}
                style={{ padding: '2px 8px', fontSize: '10px' }}
              >
                {t ? t('config_reset') : "RESET"}
              </button>
            )}
          </div>
        </div>

        {value.length === 0 ? (
          <div style={{ padding: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center' }}>
            {t ? t('config_array_empty') : "ARRAY IS EMPTY"}
          </div>
        ) : isArrayOfObjects ? (
          <div>
            {value.map((item, idx) => {
              const origItem = (originalValue && originalValue[idx]) ? originalValue[idx] : {};
              const nameProp = item.Name || item.ClassName || item.NPCName || item.Title || `Item #${idx + 1}`;
              return (
                <Accordion 
                  key={idx}
                  title={`${nameProp}`}
                  isDirty={JSON.stringify(item) !== JSON.stringify(origItem)}
                  onReset={() => onResetKey([...path, idx])}
                  isList={true}
                  onRemove={() => handleRemoveItem(idx)}
                  t={t}
                >
                  {Object.keys(item).map(k => (
                    <RenderFormNode
                      key={k}
                      keyName={k}
                      value={item[k]}
                      originalValue={origItem[k]}
                      path={[...path, idx, k]}
                      onChange={onChange}
                      onResetKey={onResetKey}
                      inferredEnums={inferredEnums}
                      onNavigateToMap={onNavigateToMap}
                      t={t}
                    />
                  ))}
                </Accordion>
              );
            })}
          </div>
        ) : (
          /* Array of primitive values (strings/numbers) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {value.map((item, idx) => {
              const isItemDirty = originalValue && JSON.stringify(item) !== JSON.stringify(originalValue[idx]);
              return (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '20px' }}>#{idx}:</span>
                  <input
                    type={typeof item === 'number' ? 'number' : 'text'}
                    value={item}
                    onChange={e => {
                      let val = typeof item === 'number' ? Number(e.target.value) : e.target.value;
                      if (typeof item === 'number' && Number.isNaN(val)) {
                        val = item;
                      }
                      onChange([...path, idx], val);
                    }}
                    className={isItemDirty ? 'field-dirty' : ''}
                  />
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    onClick={() => handleRemoveItem(idx)}
                    style={{ padding: '8px 12px' }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 4. Object check (nested config properties)
  if (typeof value === 'object' && value !== null) {
    return (
      <Accordion 
        title={displayLabel} 
        isDirty={isDirty}
        onReset={() => onResetKey(path)}
        t={t}
      >
        {Object.keys(value).map(k => (
          <RenderFormNode
            key={k}
            keyName={k}
            value={value[k]}
            originalValue={originalValue ? originalValue[k] : undefined}
            path={[...path, k]}
            onChange={onChange}
            onResetKey={onResetKey}
            inferredEnums={inferredEnums}
            onNavigateToMap={onNavigateToMap}
            t={t}
          />
        ))}
      </Accordion>
    );
  }

  // 5. Standard inputs (String / Number / Enums)
  // Check if it's in STATIC_ENUMS or has inferred enums in schema
  const pathString = path.join('.');
  let enumOptions = STATIC_ENUMS[keyName] || inferredEnums[pathString];
  
  // Extra mapping logic: check if path ends with specific enum-like properties
  if (!enumOptions) {
    for (const [enumKey, options] of Object.entries(STATIC_ENUMS)) {
      if (pathString.endsWith(enumKey)) {
        enumOptions = options;
        break;
      }
    }
  }

  const isTextarea = typeof value === 'string' && (value.length > 50 || keyName.toLowerCase().includes('text') || keyName.toLowerCase().includes('desc'));

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <label className={isDirty ? 'field-dirty-label' : ''} style={{ margin: 0 }}>
          {displayLabel}
        </label>
        {isDirty && (
          <button 
            type="button" 
            className="btn btn-warning" 
            onClick={() => onResetKey(path)}
            style={{ padding: '1px 6px', fontSize: '9px' }}
          >
            {t ? t('config_reset') : "RESET"}
          </button>
        )}
      </div>
      
      {enumOptions ? (
        <select
          value={value}
          onChange={e => {
            const parsed = typeof value === 'number' ? Number(e.target.value) : e.target.value;
            onChange(path, parsed);
          }}
          className={isDirty ? 'field-dirty' : ''}
        >
          {enumOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : isTextarea ? (
        <textarea
          rows={3}
          value={value}
          onChange={e => onChange(path, e.target.value)}
          className={isDirty ? 'field-dirty' : ''}
          placeholder={t ? t('xml_search_missing') : "ENTER TEXT..."}
        />
      ) : (
        <input
          type={typeof value === 'number' ? 'number' : 'text'}
          step="any"
          value={value}
          onChange={e => {
            let val = typeof value === 'number' ? Number(e.target.value) : e.target.value;
            if (typeof value === 'number' && Number.isNaN(val)) {
              val = value; // Fallback to current value to avoid corrupting JSON with NaN
            }
            onChange(path, val);
          }}
          className={isDirty ? 'field-dirty' : ''}
        />
      )}
    </div>
  );
}

export default function ConfigForm({ 
  filePath, 
  config, 
  onChangeField, 
  onResetField, 
  onResetFile, 
  onSaveFile,
  inferredEnums = {},
  onNavigateToMap
}) {
  const { t } = useTranslation();

  if (!config) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
        <span style={{ fontSize: '32px', marginBottom: '12px' }}>◀</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: '700', letterSpacing: '2px' }}>{t('config_select_config')}</span>
      </div>
    );
  }

  if (!config.success) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '40px', color: 'var(--danger-color)' }}>
        <span style={{ fontSize: '48px', marginBottom: '16px' }}>⚠</span>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', letterSpacing: '2px', margin: '0 0 12px 0' }}>{t('config_parsing_error')}</h2>
        <div style={{ 
          fontFamily: 'var(--font-mono)', 
          background: 'rgba(235, 103, 103, 0.05)', 
          border: '1px solid var(--danger-color)', 
          padding: '16px',
          borderRadius: '4px',
          maxWidth: '600px',
          fontSize: '12px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          textAlign: 'left'
        }}>
          {config.error}
        </div>
      </div>
    );
  }

  const isDirty = JSON.stringify(config.content) !== JSON.stringify(config.originalContent);

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config.content, null, 4));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filePath.split('/').pop());
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* File Action Bar */}
      <div style={{ 
        padding: '12px 20px', 
        background: 'var(--bg-secondary)', 
        borderBottom: '1px solid var(--border-color)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{t('config_file_label')}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-glow)', fontWeight: 'bold' }}>{filePath}</span>
            {isDirty && <span style={{ color: 'var(--warning-color)', fontSize: '11px', fontFamily: 'var(--font-heading)' }}>{t('config_modified')}</span>}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px' }}>
            {t('config_size')} {(config.sizeBytes / 1024).toFixed(2)} KB
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => onSaveFile(filePath)} 
            disabled={!isDirty}
            className={`btn ${isDirty ? 'btn-accent' : ''}`}
            style={{ opacity: isDirty ? 1 : 0.5, cursor: isDirty ? 'pointer' : 'not-allowed' }}
          >
            {isDirty ? t('config_save') : t('config_saved')}
          </button>
          <button 
            onClick={handleExportJson}
            className="btn"
          >
            {t('config_export')}
          </button>
          <button 
            onClick={() => onResetFile(filePath)} 
            disabled={!isDirty}
            className="btn btn-warning"
            style={{ opacity: isDirty ? 1 : 0.5, cursor: isDirty ? 'pointer' : 'not-allowed' }}
          >
            {t('config_reset_all')}
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {Object.keys(config.content).map(key => (
            <RenderFormNode
              key={key}
              keyName={key}
              value={config.content[key]}
              originalValue={config.originalContent ? config.originalContent[key] : undefined}
              path={[key]}
              onChange={(path, val) => onChangeField(filePath, path, val)}
              onResetKey={(path) => onResetField(filePath, path)}
              inferredEnums={inferredEnums}
              onNavigateToMap={onNavigateToMap}
              t={t}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
