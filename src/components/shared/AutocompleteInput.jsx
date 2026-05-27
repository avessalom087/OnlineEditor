import React, { useState, useEffect } from 'react';

/**
 * Reusable Autocomplete Input Component
 * Supports both controlled state (value + onChange) and uncontrolled local state.
 */
export default function AutocompleteInput({
  suggestions = [],
  placeholder = '',
  onSelect,
  value,
  onChange,
  style = {},
  buttonLabel = 'ADD'
}) {
  const isControlled = value !== undefined && onChange !== undefined;
  const [internalValue, setInternalValue] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [show, setShow] = useState(false);

  const inputValue = isControlled ? value : internalValue;

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (isControlled) {
      onChange(val);
    } else {
      setInternalValue(val);
    }

    if (val.trim()) {
      const matched = suggestions.filter(s => 
        s.toLowerCase().includes(val.toLowerCase()) && 
        s.toLowerCase() !== val.toLowerCase()
      ).slice(0, 10);
      setFiltered(matched);
      setShow(true);
    } else {
      setFiltered([]);
      setShow(false);
    }
  };

  const handleSelectSuggestion = (sug) => {
    if (isControlled) {
      onChange(sug);
    } else {
      setInternalValue(sug);
    }
    setShow(false);
    if (onSelect) onSelect(sug);
  };

  const handleAdd = () => {
    if (inputValue.trim()) {
      if (onSelect) onSelect(inputValue.trim());
      if (!isControlled) setInternalValue('');
      setShow(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (inputValue.trim()) setShow(true);
          }}
          onBlur={() => {
            // Delay to allow suggestion clicks to register before blur closes the dropdown
            setTimeout(() => setShow(false), 250);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          style={{ flex: 1 }}
        />
        {onSelect && (
          <button 
            type="button" 
            className="btn btn-accent" 
            onClick={handleAdd}
            style={{ padding: '8px 12px' }}
          >
            {buttonLabel}
          </button>
        )}
      </div>
      {show && filtered.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '2px',
          padding: 0,
          margin: '4px 0 0 0',
          listStyle: 'none',
          zIndex: 9999,
          maxHeight: '180px',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {filtered.map((sug, idx) => (
            <li
              key={idx}
              onClick={() => handleSelectSuggestion(sug)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                borderBottom: '1px solid rgba(30,48,30,0.1)',
                color: 'var(--text-primary)'
              }}
              onMouseOver={e => e.target.style.background = 'rgba(149,192,149,0.08)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
            >
              {sug}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
