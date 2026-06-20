import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/localization';

/**
 * HelpIcon — compact "?" badge that shows a rich glassmorphism tooltip
 * on hover. Text is pulled from the localization dictionary (tipKey).
 *
 * Usage:
 *   <HelpIcon tipKey="tip_accuracy_min" />
 *   <HelpIcon tipKey="tip_despawn_time" position="left" />
 */
export default function HelpIcon({ tipKey, position = 'right', style = {} }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const iconRef = useRef(null);
  const tooltipRef = useRef(null);
  const timerRef = useRef(null);

  const text = t(tipKey);
  // If there's no translation for this key, don't render
  if (!text || text === tipKey) return null;

  const show = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(false), 120);
  }, []);

  useEffect(() => {
    if (!visible || !iconRef.current || !tooltipRef.current) return;

    const iconRect = iconRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const GAP = 8;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let top = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2;
    let left;

    if (position === 'left') {
      left = iconRect.left - tooltipRect.width - GAP;
    } else if (position === 'top') {
      top = iconRect.top - tooltipRect.height - GAP;
      left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
    } else if (position === 'bottom') {
      top = iconRect.bottom + GAP;
      left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
    } else {
      // right (default)
      left = iconRect.right + GAP;
    }

    // Clamp to viewport
    top = Math.max(8, Math.min(top, vpH - tooltipRect.height - 8));
    left = Math.max(8, Math.min(left, vpW - tooltipRect.width - 8));

    setCoords({ top, left });
  }, [visible, position]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <>
      <span
        ref={iconRef}
        className="help-icon"
        style={style}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={e => e.stopPropagation()}
        aria-label="Help"
        role="button"
        tabIndex={-1}
      >
        ?
      </span>

      {visible && createPortal(
        <div
          ref={tooltipRef}
          className="help-tooltip"
          style={{ top: coords.top, left: coords.left }}
          onMouseEnter={show}
          onMouseLeave={hide}
          onClick={e => e.stopPropagation()}
        >
          <div className="help-tooltip-arrow" />
          <div className="help-tooltip-text">{text}</div>
        </div>,
        document.body
      )}
    </>
  );
}
