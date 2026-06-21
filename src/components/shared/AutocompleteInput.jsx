import React, { useState, useEffect } from 'react';
import { AutocompleteWorkerWrapper } from '../../utils/autocompleteWorker';

import { useTranslation } from '../../utils/localization';

function highlightMatch(text, query) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <strong key={i} style={{ color: 'var(--text-glow)', textShadow: '0 0 4px rgba(178, 250, 158, 0.4)' }}>{part}</strong> 
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

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
  buttonLabel,
  layout = 'horizontal',
  showButton = true
}) {
  const { t } = useTranslation();
  const actualButtonLabel = buttonLabel || t('map_add_btn');
  const isControlled = value !== undefined && onChange !== undefined;
  const [internalValue, setInternalValue] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [show, setShow] = useState(false);
  const [worker, setWorker] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (Array.isArray(suggestions) && suggestions.length > 100) {
      const w = new AutocompleteWorkerWrapper();
      w.init(suggestions);
      setWorker(w);
      return () => {
        w.terminate();
      };
    } else {
      setWorker(null);
    }
  }, [suggestions]);

  // Reset active keyboard selection index when suggestions list changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [filtered]);

  const inputValue = isControlled ? value : internalValue;

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (isControlled) {
      onChange(val);
    } else {
      setInternalValue(val);
    }

    if (val.trim()) {
      if (worker) {
        worker.search(val, 10, (matched) => {
          setFiltered(matched.filter(s => s.toLowerCase() !== val.toLowerCase()));
          setShow(true);
        });
      } else {
        const matched = suggestions.filter(s => 
          s.toLowerCase().includes(val.toLowerCase()) && 
          s.toLowerCase() !== val.toLowerCase()
        ).slice(0, 10);
        setFiltered(matched);
        setShow(true);
      }
    } else {
      if (worker) {
        worker.search('', 10, () => {});
      }
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
    <div style={{ width: '100%', ...style }}>
      <div style={{ display: 'flex', flexDirection: layout === 'vertical' ? 'column' : 'row', gap: '6px' }}>
        <div style={{ position: 'relative', width: '100%', flex: 1 }}>
          <input
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => {
              if (inputValue.trim()) setShow(true);
            }}
            onBlur={() => {
              setShow(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (show && activeIndex >= 0 && activeIndex < filtered.length) {
                  handleSelectSuggestion(filtered[activeIndex]);
                } else {
                  handleAdd();
                }
              } else if (e.key === 'ArrowDown') {
                if (show && filtered.length > 0) {
                  e.preventDefault();
                  setActiveIndex(prev => (prev + 1) % filtered.length);
                }
              } else if (e.key === 'ArrowUp') {
                if (show && filtered.length > 0) {
                  e.preventDefault();
                  setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
                }
              } else if (e.key === 'Escape') {
                if (show) {
                  e.preventDefault();
                  setShow(false);
                  setActiveIndex(-1);
                }
              }
            }}
            style={{ width: '100%' }}
          />
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
              {filtered.map((sug, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevents input from losing focus immediately
                      handleSelectSuggestion(sug);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      borderBottom: '1px solid rgba(30,48,30,0.1)',
                      color: isActive ? 'var(--text-glow)' : 'var(--text-primary)',
                      background: isActive ? 'rgba(149, 192, 149, 0.15)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                    onMouseOver={() => setActiveIndex(idx)}
                    onMouseOut={() => setActiveIndex(-1)}
                  >
                    {highlightMatch(sug, inputValue)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {onSelect && showButton && (
          <button 
            type="button" 
            className="btn btn-accent" 
            onClick={handleAdd}
            style={{ padding: '8px 12px', justifyContent: 'center', width: layout === 'vertical' ? '100%' : 'auto' }}
          >
            {actualButtonLabel}
          </button>
        )}
      </div>
    </div>
  );
}
