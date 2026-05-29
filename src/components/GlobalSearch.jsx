import React, { useState, useEffect, useRef, useCallback } from 'react';
import { translations } from '../utils/localization';

const TYPE_STYLES = {
  CONFIG: { color: '#95c095', bg: 'rgba(149,192,149,0.12)', label: 'CONFIG' },
  MARKET: { color: '#ebd667', bg: 'rgba(235,214,103,0.10)', label: 'MARKET' },
  QUEST:  { color: '#7ec8ff', bg: 'rgba(100,180,255,0.10)', label: 'QUEST'  },
  PATROL: { color: '#eb9a67', bg: 'rgba(235,154,103,0.10)', label: 'PATROL' },
  TRADER: { color: '#c9a6f5', bg: 'rgba(180,100,255,0.10)', label: 'TRADER' },
};


export default function GlobalSearch({ configs, isOpen, onClose, setActiveTab, lang = 'ru' }) {
  const t = (key, replacements = {}) => {
    let text = translations[lang]?.[key] || translations['en']?.[key] || key;
    Object.entries(replacements).forEach(([k, v]) => { text = text.replace(`{${k}}`, v); });
    return text;
  };

  const SEARCH_HINTS = [
    ['CONFIG', t('search_hint_config')],
    ['MARKET', t('search_hint_market')],
    ['QUEST',  t('search_hint_quest')],
    ['PATROL', t('search_hint_patrol')],
    ['TRADER', t('search_hint_trader')],
  ];

  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  // Build and run search
  const runSearch = useCallback((q) => {
    if (!q.trim()) { setResults([]); return; }
    const lower = q.toLowerCase();
    const found = [];

    Object.entries(configs).forEach(([path, file]) => {
      // Config file paths
      if (path.toLowerCase().includes(lower)) {
        found.push({
          type: 'CONFIG',
          label: path.split('/').pop(),
          sub: path,
          tab: null,
        });
      }

      if (!file.success || !file.content) return;
      const lp = path.toLowerCase();

      // Market item classnames
      if (lp.startsWith('expansionmod/market/') && Array.isArray(file.content.Items)) {
        file.content.Items.forEach(item => {
          if (item.ClassName?.toLowerCase().includes(lower)) {
            found.push({
              type: 'MARKET',
              label: item.ClassName,
              sub: `in ${path.split('/').pop().replace('.json', '')}`,
              tab: 'economy',
            });
          }
        });
      }

      // Quest titles and IDs
      if (lp.startsWith('expansionmod/quests/quests/quest_')) {
        const title = file.content.Title || path.split('/').pop();
        const idStr = String(file.content.ID ?? '');
        if (title.toLowerCase().includes(lower) || idStr.includes(lower)) {
          found.push({
            type: 'QUEST',
            label: title,
            sub: `Quest ID: ${file.content.ID ?? 'N/A'} · ${path.split('/').pop()}`,
            tab: 'quests',
          });
        }
      }

      // AI Patrol routes
      if (lp === 'expansion/settings/aipatrolsettings.json' && Array.isArray(file.content.Patrols)) {
        file.content.Patrols.forEach((patrol, idx) => {
          const name = patrol.Name || `Patrol #${idx + 1}`;
          if (name.toLowerCase().includes(lower)) {
            found.push({
              type: 'PATROL',
              label: name,
              sub: `Faction: ${patrol.Faction || 'Unknown'} · AIPatrolSettings`,
              tab: 'aibots',
            });
          }
        });
      }

      // Trader display names
      if (lp.startsWith('expansionmod/traders/') && file.content.DisplayName) {
        if (file.content.DisplayName.toLowerCase().includes(lower)) {
          found.push({
            type: 'TRADER',
            label: file.content.DisplayName,
            sub: path.split('/').pop(),
            tab: 'economy',
          });
        }
      }
    });

    setResults(found.slice(0, 15));
    setSelectedIdx(0);
  }, [configs]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Re-run search on query change
  useEffect(() => { runSearch(query); }, [query, runSearch]);

  const handleSelect = (result) => {
    if (result.tab) setActiveTab(result.tab);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      handleSelect(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.82)',
        zIndex: 99998,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '600px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glow)',
          borderRadius: '4px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8), 0 0 24px rgba(149,192,149,0.12)',
          overflow: 'hidden',
          animation: 'toastIn 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px 18px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
        }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder={t('search_placeholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '15px',
              outline: 'none',
              color: 'var(--text-glow)',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <kbd style={{
            fontSize: '10px',
            color: 'var(--text-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: '3px',
            padding: '2px 6px',
            fontFamily: 'var(--font-mono)',
          }}>ESC</kbd>
        </div>

        {/* Results list */}
        {results.length > 0 ? (
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {results.map((r, idx) => {
              const ts = TYPE_STYLES[r.type] || TYPE_STYLES.CONFIG;
              const isActive = idx === selectedIdx;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 18px',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(149,192,149,0.07)' : 'transparent',
                    borderBottom: '1px solid rgba(30,48,30,0.3)',
                    transition: 'background 0.1s',
                    borderLeft: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                  }}
                >
                  <span style={{
                    fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px',
                    color: ts.color, background: ts.bg,
                    padding: '3px 7px', borderRadius: '2px', flexShrink: 0,
                    fontFamily: 'var(--font-heading)',
                  }}>
                    {ts.label}
                  </span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '13px',
                      color: 'var(--text-glow)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                      {r.sub}
                    </div>
                  </div>
                  {r.tab && (
                    <span style={{ fontSize: '10px', color: 'var(--text-dark)', whiteSpace: 'nowrap' }}>
                      → {r.tab}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : query.trim() ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
            {t('search_no_results', { query })}
          </div>
        ) : (
          /* Hints when empty */
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dark)', letterSpacing: '1px', marginBottom: '4px' }}>{t('search_categories_header')}</div>
            {SEARCH_HINTS.map(([type, desc]) => {
              const ts = TYPE_STYLES[type];
              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: ts.color, background: ts.bg, padding: '2px 7px', borderRadius: '2px', fontSize: '9px', fontFamily: 'var(--font-heading)', fontWeight: 'bold' }}>
                    {type}
                  </span>
                  <span>{desc}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer shortcuts */}
        <div style={{
          padding: '8px 18px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: '20px',
          fontSize: '10px', color: 'var(--text-dark)',
          fontFamily: 'var(--font-mono)',
          background: 'var(--bg-tertiary)',
        }}>
          <span>{t('search_shortcut_nav')}</span>
          <span>{t('search_shortcut_open')}</span>
          <span>{t('search_shortcut_toggle')}</span>
        </div>
      </div>
    </div>
  );
}
