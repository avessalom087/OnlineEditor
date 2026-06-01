import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../utils/localization';

const TYPE_STYLES = {
  CONFIG: { color: '#95c095', bg: 'rgba(149,192,149,0.12)', label: 'CONFIG' },
  MARKET: { color: '#ebd667', bg: 'rgba(235,214,103,0.10)', label: 'MARKET' },
  QUEST:  { color: '#7ec8ff', bg: 'rgba(100,180,255,0.10)', label: 'QUEST'  },
  PATROL: { color: '#eb9a67', bg: 'rgba(235,154,103,0.10)', label: 'PATROL' },
  TRADER: { color: '#c9a6f5', bg: 'rgba(180,100,255,0.10)', label: 'TRADER' },
  LOADOUT: { color: '#82e6d9', bg: 'rgba(130,230,217,0.10)', label: 'LOADOUT' },
  COMMAND: { color: '#ff7eb6', bg: 'rgba(255,126,182,0.12)', label: 'COMMAND' },
};

function collectLoadoutClassnames(node, set) {
  if (!node) return;
  if (node.ClassName) set.add(node.ClassName.toLowerCase());
  if (Array.isArray(node.InventoryAttachments)) {
    node.InventoryAttachments.forEach(att => {
      if (Array.isArray(att.Items)) {
        att.Items.forEach(item => collectLoadoutClassnames(item, set));
      }
    });
  }
  if (Array.isArray(node.InventoryCargo)) {
    node.InventoryCargo.forEach(item => collectLoadoutClassnames(item, set));
  }
}


export default function GlobalSearch({ 
  configs, 
  isOpen, 
  onClose, 
  setActiveTab,
  onFixAllErrors,
  onClearXmlDatabase,
  onNavigateToSubTab
}) {
  const { t } = useTranslation();

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
    const COMMANDS = [
      { type: 'COMMAND', label: '/dashboard', sub: t('cmd_palette_go_dashboard'), tab: 'dashboard', action: 'nav' },
      { type: 'COMMAND', label: '/economy', sub: t('cmd_palette_go_economy'), tab: 'economy', action: 'nav' },
      { type: 'COMMAND', label: '/quests', sub: t('cmd_palette_go_quests'), tab: 'quests', action: 'nav' },
      { type: 'COMMAND', label: '/aibots', sub: t('cmd_palette_go_aibots'), tab: 'aibots', action: 'nav' },
      { type: 'COMMAND', label: '/settings', sub: t('cmd_palette_go_settings'), tab: 'settings', action: 'nav' },
      { type: 'COMMAND', label: '/map', sub: t('cmd_palette_go_map'), tab: 'map', action: 'nav' },
      { type: 'COMMAND', label: '/validate', sub: t('cmd_palette_run_validate'), action: 'validate' },
      { type: 'COMMAND', label: '/clear-db', sub: t('cmd_palette_clear_db'), action: 'clear-db' },
      { type: 'COMMAND', label: '/backup', sub: t('cmd_palette_backup'), action: 'backup' }
    ];

    const qTrimmed = q.trim();
    if (!qTrimmed) {
      setResults(COMMANDS);
      setSelectedIdx(0);
      return;
    }

    const lower = qTrimmed.toLowerCase();

    // If query starts with /, only search commands!
    if (lower.startsWith('/')) {
      const filteredCommands = COMMANDS.filter(cmd => cmd.label.toLowerCase().includes(lower));
      setResults(filteredCommands);
      setSelectedIdx(0);
      return;
    }

    const found = [];

    // Prepend commands that match the search term
    COMMANDS.forEach(cmd => {
      if (cmd.label.toLowerCase().includes(lower) || cmd.sub.toLowerCase().includes(lower)) {
        found.push(cmd);
      }
    });

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
              sub: `in Market: ${path.split('/').pop().replace('.json', '')}`,
              tab: 'economy',
            });
          }
        });
      }

      // Quest titles, IDs, and reward/item classnames
      if (lp.startsWith('expansionmod/quests/quests/quest_')) {
        const title = file.content.Title || path.split('/').pop();
        const idStr = String(file.content.ID ?? '');
        const items = new Set();
        if (Array.isArray(file.content.QuestItems)) {
          file.content.QuestItems.forEach(x => typeof x === 'string' && items.add(x.toLowerCase()));
        }
        if (Array.isArray(file.content.Rewards)) {
          file.content.Rewards.forEach(x => x && x.ClassName && items.add(x.ClassName.toLowerCase()));
        }
        let matchItem = false;
        for (const cls of items) {
          if (cls.includes(lower)) {
            matchItem = true;
            break;
          }
        }
        if (title.toLowerCase().includes(lower) || idStr.includes(lower) || matchItem) {
          found.push({
            type: 'QUEST',
            label: title,
            sub: matchItem 
              ? `Quest ID: ${file.content.ID ?? 'N/A'} · Rewards/Quest Items match "${qTrimmed}"` 
              : `Quest ID: ${file.content.ID ?? 'N/A'} · ${path.split('/').pop()}`,
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

      // AI Roaming locations
      if (lp === 'expansion/settings/ailocationsettings.json' && Array.isArray(file.content.RoamingLocations)) {
        file.content.RoamingLocations.forEach(loc => {
          if (loc.Name && loc.Name.toLowerCase().includes(lower)) {
            found.push({
              type: 'PATROL',
              label: loc.Name,
              sub: `Roaming Location (Radius: ${loc.Radius}m) · AILocationSettings`,
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

      // AI Loadout items
      if (lp.startsWith('expansionmod/loadouts/')) {
        const clsNames = new Set();
        collectLoadoutClassnames(file.content, clsNames);
        let matchLoadout = false;
        for (const cls of clsNames) {
          if (cls.includes(lower)) {
            matchLoadout = true;
            break;
          }
        }
        if (matchLoadout || path.split('/').pop().toLowerCase().includes(lower)) {
          found.push({
            type: 'LOADOUT',
            label: path.split('/').pop().replace('.json', ''),
            sub: matchLoadout ? `AI Loadout containing matches for "${qTrimmed}"` : `AI Loadout File`,
            tab: 'aibots',
          });
        }
      }

      // Spawn starting gear and clothing
      if (lp === 'expansion/settings/spawnsettings.json') {
        const c = file.content;
        const itemSet = new Set();
        if (c.StartingClothing) {
          ['Headgear', 'Glasses', 'Masks', 'Tops', 'Vests', 'Gloves', 'Pants', 'Belts', 'Shoes', 'Armbands', 'Backpacks'].forEach(k => {
            if (Array.isArray(c.StartingClothing[k])) {
              c.StartingClothing[k].forEach(x => typeof x === 'string' && itemSet.add(x.toLowerCase()));
            }
          });
        }
        if (c.StartingGear) {
          ['UpperGear', 'PantsGear', 'BackpackGear', 'VestGear'].forEach(k => {
            if (Array.isArray(c.StartingGear[k])) {
              c.StartingGear[k].forEach(x => x && x.ClassName && itemSet.add(x.ClassName.toLowerCase()));
            }
          });
          if (c.StartingGear.PrimaryWeapon && c.StartingGear.PrimaryWeapon.ClassName) {
            itemSet.add(c.StartingGear.PrimaryWeapon.ClassName.toLowerCase());
          }
          if (c.StartingGear.SecondaryWeapon && c.StartingGear.SecondaryWeapon.ClassName) {
            itemSet.add(c.StartingGear.SecondaryWeapon.ClassName.toLowerCase());
          }
        }
        let foundMatch = false;
        for (const cls of itemSet) {
          if (cls.includes(lower)) {
            foundMatch = true;
            break;
          }
        }
        if (foundMatch) {
          found.push({
            type: 'CONFIG',
            label: 'SpawnSettings.json',
            sub: `Starting Clothing / Gear contains matches for "${qTrimmed}"`,
            tab: 'settings',
          });
        }
      }
    });

    setResults(found.slice(0, 15));
    setSelectedIdx(0);
  }, [configs, t]);

  // Focus input and populate default commands on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      runSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, runSearch]);

  // Re-run search on query change
  useEffect(() => { runSearch(query); }, [query, runSearch]);

  const handleSelect = (result) => {
    if (result.type === 'COMMAND') {
      if (result.action === 'nav') {
        if (result.tab) {
          setActiveTab(result.tab);
          if (result.tab === 'dashboard' && onNavigateToSubTab) {
            onNavigateToSubTab('status');
          }
        }
      } else if (result.action === 'validate') {
        if (onFixAllErrors) onFixAllErrors();
        setActiveTab('dashboard');
        if (onNavigateToSubTab) onNavigateToSubTab('status');
      } else if (result.action === 'clear-db') {
        if (onClearXmlDatabase) onClearXmlDatabase();
      } else if (result.action === 'backup') {
        setActiveTab('dashboard');
        if (onNavigateToSubTab) onNavigateToSubTab('backups');
      }
    } else {
      if (result.tab) setActiveTab(result.tab);
    }
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
