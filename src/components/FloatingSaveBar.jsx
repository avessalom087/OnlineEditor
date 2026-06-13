import React from 'react';
import { useTranslation } from '../utils/localization';

/**
 * renderResponsiveButtonText — shared helper for the save bar buttons.
 * Wraps text labels that start with a short prefix (≤3 chars) so the label
 * can be hidden on narrow viewports via CSS.
 */
function renderResponsiveButtonText(text) {
  if (!text) return null;
  const parts = text.split(' ');
  if (parts.length > 1 && parts[0].length <= 3) {
    return (
      <>
        <span>{parts[0]}</span>
        <span className="btn-text-responsive" style={{ marginLeft: '4px' }}>{parts.slice(1).join(' ')}</span>
      </>
    );
  }
  return <span>{text}</span>;
}

/**
 * FloatingSaveBar
 *
 * Sticky bar shown at the bottom of the viewport whenever there are unsaved
 * changes. Supports a minimized "pill" mode.
 *
 * @param {{
 *   dirtyCount:        number,
 *   dirtyFiles:        Set<string>,
 *   isMinimized:       boolean,
 *   onMinimize:        Function,
 *   onExpand:          Function,
 *   onSaveAll:         Function,
 *   onDiscardAll:      Function,
 *   onListChanges:     Function,
 * }} props
 */
export default function FloatingSaveBar({
  dirtyCount,
  dirtyFiles,
  isMinimized,
  onMinimize,
  onExpand,
  onSaveAll,
  onDiscardAll,
  onListChanges,
}) {
  const { t, lang } = useTranslation();

  if (dirtyCount === 0) return null;

  return (
    <div className={`floating-save-bar ${isMinimized ? 'minimized' : ''}`}>
      {isMinimized ? (
        <div
          className="floating-save-bar-minimized-pill"
          onClick={onExpand}
          title={lang === 'ru' ? 'Развернуть панель сохранения' : 'Expand save panel'}
        >
          <span className="pulse-dot-warning" />
          <span className="minimized-text">
            {lang === 'ru' ? `Правки: ${dirtyCount}` : `Drafts: ${dirtyCount}`}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onSaveAll(); }}
            className="btn btn-warning btn-glass compact-btn"
            style={{ padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={t('header_export_package')}
          >
            💾
          </button>
        </div>
      ) : (
        <div className="floating-save-bar-content">
          <div className="floating-save-bar-info">
            <span className="pulse-dot-warning" />
            <span className="floating-save-bar-text">
              {lang === 'ru'
                ? `Несохраненные правки: ${dirtyCount}`
                : `Unsaved changes: ${dirtyCount}`}
            </span>
            <button
              className="btn-list-changes"
              title={lang === 'ru' ? 'Показать измененные файлы' : 'Show modified files'}
              onClick={onListChanges}
            >
              ℹ️
            </button>
          </div>

          <div className="floating-save-bar-actions">
            <button onClick={onDiscardAll} className="btn btn-danger btn-glass">
              ✖ {t('header_discard')}
            </button>
            <button onClick={onSaveAll} className="btn btn-warning btn-glass btn-glow-pulse">
              {renderResponsiveButtonText(t('header_export_package'))}
            </button>
            <button
              onClick={onMinimize}
              className="btn btn-glass"
              style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={lang === 'ru' ? 'Свернуть' : 'Minimize'}
            >
              ➖
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
