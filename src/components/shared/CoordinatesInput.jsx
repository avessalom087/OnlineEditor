import React from 'react';

/**
 * CoordinatesInput — A reusable UI component to edit [X, Y, Z] coordinate arrays.
 * Supports both standard Grid layout and compact Row layout (e.g. for waypoint lists).
 * 
 * @param {object} props
 * @param {string} [props.label] - Optional header label (Grid layout only)
 * @param {Array<number>} [props.position] - Array of [x, y, z] numbers
 * @param {Function} props.onChange - Callback triggered on change: (newPos, changedIdx, newValue) => void
 * @param {Function} [props.onPickFromMap] - Optional map picker trigger
 * @param {string} [props.pickLabel] - Text or symbol for the map button
 * @param {string} [props.step] - Numeric step size (defaults to '0.1')
 * @param {'grid' | 'row'} [props.layout] - Layout format ('grid' or 'row')
 * @param {string} [props.indexLabel] - Row indicator label (Row layout only, e.g. "#1")
 * @param {Function} [props.onDelete] - Optional delete handler (Row layout only)
 * @param {object} [props.style] - Custom wrapper style overrides
 * @param {object} [props.inputStyle] - Custom style overrides for the input fields
 */
export default function CoordinatesInput({
  label,
  position = [0.0, 0.0, 0.0],
  onChange,
  onPickFromMap,
  pickLabel = '🎯 Pick from Map',
  step = '0.1',
  layout = 'grid',
  indexLabel,
  onDelete,
  style = {},
  inputStyle = {}
}) {
  const coords = Array.isArray(position) ? position : [0.0, 0.0, 0.0];

  const handleValChange = (idx, valueString) => {
    const val = valueString === '' ? 0.0 : Number(valueString);
    const newPos = [...coords];
    newPos[idx] = val;
    onChange(newPos, idx, val);
  };

  if (layout === 'row') {
    return (
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          background: 'var(--bg-primary)',
          padding: '6px 10px',
          border: '1px solid var(--border-color)',
          ...style
        }}
      >
        {indexLabel && (
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '20px' }}>
            {indexLabel}
          </span>
        )}
        {['X', 'Y', 'Z'].map((coord, idx) => (
          <input
            key={coord}
            type="number"
            step={step}
            value={coords[idx] ?? 0.0}
            onChange={(e) => handleValChange(idx, e.target.value)}
            style={{
              padding: '3px',
              fontSize: '11px',
              width: '100%',
              ...inputStyle
            }}
            placeholder={coord}
          />
        ))}
        {onPickFromMap && (
          <button
            type="button"
            className="btn btn-accent"
            onClick={onPickFromMap}
            style={{ padding: '3px 6px', fontSize: '9px', height: '24px' }}
            title={pickLabel}
          >
            🗺
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={onDelete}
            style={{ padding: '3px 6px', fontSize: '10px', height: '24px' }}
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // Default Grid Layout
  return (
    <div style={{ ...style }}>
      {(label || onPickFromMap) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          {label && (
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              {label}
            </span>
          )}
          {onPickFromMap && (
            <button
              type="button"
              className="btn btn-accent"
              onClick={onPickFromMap}
              style={{ padding: '2px 8px', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {pickLabel}
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {['X', 'Y', 'Z'].map((coord, idx) => (
          <div key={coord}>
            <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
              {coord}
            </label>
            <input
              type="number"
              step={step}
              value={coords[idx] ?? 0.0}
              onChange={(e) => handleValChange(idx, e.target.value)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '4px',
                textAlign: 'center',
                width: '100%',
                ...inputStyle
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
