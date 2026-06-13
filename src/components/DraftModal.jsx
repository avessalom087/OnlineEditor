import React from 'react';
import { useTranslation } from '../utils/localization';

/**
 * DraftModal
 *
 * Shown after configs load when IndexedDB contains an unsaved draft from a
 * previous session. Lets the user choose to restore or discard it.
 *
 * @param {{ draftToRestore: object, onRestore: Function, onDiscard: Function }} props
 */
export default function DraftModal({ draftToRestore, onRestore, onDiscard }) {
  const { t } = useTranslation();
  if (!draftToRestore) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, userSelect: 'none',
    }}>
      <div style={{
        width: '420px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--warning-color)',
        padding: '24px',
        borderRadius: '2px',
        boxShadow: 'var(--shadow-glow)',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--warning-color)', fontFamily: 'var(--font-mono)', letterSpacing: '1px', fontWeight: 'bold' }}>
            {t('draft_header_label')}
          </div>
          <h3 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', color: 'var(--text-glow)', fontSize: '18px' }}>
            {t('draft_title')}
          </h3>
        </div>

        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
          {t('draft_body', { count: Object.keys(draftToRestore).length })}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button className="btn btn-warning" onClick={onRestore} style={{ padding: '8px 16px' }}>
            {t('draft_restore_btn')}
          </button>
          <button className="btn btn-danger" onClick={onDiscard} style={{ padding: '8px 16px' }}>
            {t('draft_discard_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}
