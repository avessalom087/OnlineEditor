import React from 'react';
import { useTranslation } from '../utils/localization';

/**
 * WelcomeScreen
 *
 * Shown when the user hasn't selected a folder yet (hasAccess === false).
 * Receives callbacks from AppContent — contains zero business logic.
 */
export default function WelcomeScreen({ savedHandle, folderName, onRestoreAccess, onSelectFolder }) {
  const { t, lang, setLang } = useTranslation();
  const isSupported = typeof window.showDirectoryPicker === 'function';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(ellipse at 50% 30%, #0c200c 0%, transparent 70%), radial-gradient(ellipse at 50% 90%, #060806 0%, transparent 80%)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Futuristic grid pattern background */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'linear-gradient(rgba(30, 48, 30, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 48, 30, 0.15) 1px, transparent 1px)',
        backgroundSize: '30px 30px', pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '580px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-glow), 0 20px 50px rgba(0,0,0,0.8)',
        borderRadius: '4px',
        padding: '40px',
        zIndex: 1,
        animation: 'toastIn 0.3s ease-out',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}>
          // EXPANSION_MOD_EDITOR
        </div>

        <h1 style={{
          margin: '0 0 10px 0',
          fontFamily: 'var(--font-heading)',
          fontSize: '32px',
          fontWeight: '700',
          color: 'var(--text-glow)',
          letterSpacing: '2px',
          textShadow: '0 0 15px rgba(178, 250, 158, 0.3)',
        }}>
          {t('welcome_title')}
        </h1>

        <p style={{
          color: 'var(--text-primary)',
          fontSize: '14px',
          lineHeight: '1.6',
          margin: '0 auto 20px auto',
          maxWidth: '460px',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.5px',
        }}>
          {t('welcome_subtitle')}
        </p>

        {/* Language toggle */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
          <button
            className={`btn ${lang === 'ru' ? 'btn-active' : ''}`}
            onClick={() => setLang('ru')}
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            РУССКИЙ
          </button>
          <button
            className={`btn ${lang === 'en' ? 'btn-active' : ''}`}
            onClick={() => setLang('en')}
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            ENGLISH
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', width: '100%' }}>
          {savedHandle ? (
            <>
              <button
                className="btn btn-accent"
                onClick={onRestoreAccess}
                style={{ width: '100%', padding: '16px', fontSize: '15px', justifyContent: 'center', boxShadow: 'var(--shadow-glow-active)', borderWidth: '2px' }}
              >
                {t('welcome_restore_btn', { folder: folderName.toUpperCase() })}
              </button>
              <button
                className="btn"
                onClick={onSelectFolder}
                style={{ width: '100%', padding: '12px', fontSize: '13px', justifyContent: 'center' }}
                disabled={!isSupported}
              >
                {t('welcome_open_diff_btn')}
              </button>
            </>
          ) : (
            <button
              className="btn btn-accent"
              onClick={onSelectFolder}
              style={{ width: '100%', padding: '18px', fontSize: '15px', justifyContent: 'center', boxShadow: 'var(--shadow-glow-active)', borderWidth: '2px' }}
              disabled={!isSupported}
            >
              {t('welcome_open_btn')}
            </button>
          )}
        </div>

        {!isSupported && (
          <div style={{
            marginTop: '30px', padding: '16px',
            background: 'rgba(235,103,103,0.08)',
            border: '1px solid rgba(235,103,103,0.3)',
            borderRadius: '2px', textAlign: 'left',
            color: 'var(--danger-color)', fontSize: '12px', lineHeight: '1.5',
          }}>
            <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
              {t('welcome_browser_warn_title')}
            </strong>
            {t('welcome_browser_warn_body')}
          </div>
        )}

        {isSupported && (
          <div style={{
            marginTop: '35px', padding: '16px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '2px', textAlign: 'left',
            fontSize: '12px', color: 'var(--text-secondary)',
          }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '8px', fontSize: '12px', fontFamily: 'var(--font-heading)', letterSpacing: '1px' }}>
              {t('welcome_expected_struct')}
            </strong>
            {t('welcome_expected_desc')}
            <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <li><strong style={{ color: 'var(--text-glow)' }}>expansion/</strong> (settings, traders, missions...)</li>
              <li><strong style={{ color: 'var(--text-glow)' }}>ExpansionMod/</strong> (AI, Quests, Market, Loadouts...)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
