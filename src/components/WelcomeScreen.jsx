import React, { useState, useRef } from 'react';
import { useTranslation } from '../utils/localization';

/**
 * WelcomeScreen
 *
 * Shown when the user hasn't selected a workspace yet (hasAccess === false).
 * Provides dual mode selection:
 * 1. Direct Local Folder Access (File System Access API) for Chrome / Edge
 * 2. Universal ZIP Archive Mode (Drag & Drop / Import) for Firefox / Safari / all browsers
 */
export default function WelcomeScreen({ 
  savedHandle, 
  folderName, 
  onRestoreAccess, 
  onSelectFolder, 
  onSelectZip,
  onLogout 
}) {
  const { t, lang, setLang } = useTranslation();
  const isSupported = typeof window.showDirectoryPicker === 'function';
  const [activeMode, setActiveMode] = useState(isSupported ? 'folder' : 'zip');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.zip') && onSelectZip) {
        onSelectZip(file);
      }
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target?.files?.[0] && onSelectZip) {
      onSelectZip(e.target.files[0]);
    }
  };

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
      {onLogout && (
        <button
          className="btn"
          onClick={onLogout}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '6px 12px',
            fontSize: '11px',
            zIndex: 10,
            fontFamily: 'var(--font-mono)'
          }}
        >
          {t('auth_logout')}
        </button>
      )}

      {/* Futuristic grid pattern background */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'linear-gradient(rgba(30, 48, 30, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 48, 30, 0.15) 1px, transparent 1px)',
        backgroundSize: '30px 30px', pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '620px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-glow), 0 20px 50px rgba(0,0,0,0.8)',
        borderRadius: '4px',
        padding: '36px',
        zIndex: 1,
        animation: 'toastIn 0.3s ease-out',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <img src="./favicon.svg" alt="Project Zero" style={{ width: '68px', height: '68px', filter: 'drop-shadow(0 0 16px rgba(74,222,128,0.45))' }} />
        </div>

        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          marginBottom: '6px',
        }}>
          // EXPANSION_MOD_EDITOR
        </div>

        <h1 style={{
          margin: '0 0 8px 0',
          fontFamily: 'var(--font-heading)',
          fontSize: '30px',
          fontWeight: '700',
          color: 'var(--text-glow)',
          letterSpacing: '2px',
          textShadow: '0 0 15px rgba(178, 250, 158, 0.3)',
        }}>
          {t('welcome_title')}
        </h1>

        <p style={{
          color: 'var(--text-primary)',
          fontSize: '13px',
          lineHeight: '1.5',
          margin: '0 auto 16px auto',
          maxWidth: '480px',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.5px',
        }}>
          {t('welcome_subtitle')}
        </p>

        {/* Language toggle */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
          <button
            className={`btn ${lang === 'ru' ? 'btn-active' : ''}`}
            onClick={() => setLang('ru')}
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            РУССКИЙ
          </button>
          <button
            className={`btn ${lang === 'en' ? 'btn-active' : ''}`}
            onClick={() => setLang('en')}
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            ENGLISH
          </button>
        </div>

        {/* Dual Mode Switcher Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          background: 'var(--bg-tertiary)',
          padding: '4px',
          borderRadius: '3px',
          border: '1px solid var(--border-color)',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            className={`btn ${activeMode === 'folder' ? 'btn-accent' : ''}`}
            onClick={() => setActiveMode('folder')}
            style={{
              padding: '10px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              border: activeMode === 'folder' ? '1px solid var(--accent-glow)' : '1px solid transparent'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📂</span>
              <span>{lang === 'ru' ? 'ПАПКА НА ДИСКЕ' : 'LOCAL FOLDER'}</span>
            </div>
            <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: 'normal' }}>
              Chrome / Edge / Opera
            </span>
          </button>

          <button
            type="button"
            className={`btn ${activeMode === 'zip' ? 'btn-accent' : ''}`}
            onClick={() => setActiveMode('zip')}
            style={{
              padding: '10px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              border: activeMode === 'zip' ? '1px solid var(--accent-glow)' : '1px solid transparent'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📦</span>
              <span>{lang === 'ru' ? 'ZIP-АРХИВ' : 'ZIP ARCHIVE'}</span>
            </div>
            <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: 'normal' }}>
              Firefox / Safari / Любой ПК
            </span>
          </button>
        </div>

        {/* ── Mode 1: Folder Selection ── */}
        {activeMode === 'folder' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', width: '100%' }}>
            {savedHandle ? (
              <>
                <button
                  className="btn btn-accent"
                  onClick={onRestoreAccess}
                  style={{ width: '100%', padding: '15px', fontSize: '14px', justifyContent: 'center', boxShadow: 'var(--shadow-glow-active)', borderWidth: '2px' }}
                >
                  {t('welcome_restore_btn', { folder: folderName.toUpperCase() })}
                </button>
                <button
                  className="btn"
                  onClick={onSelectFolder}
                  style={{ width: '100%', padding: '12px', fontSize: '12px', justifyContent: 'center' }}
                  disabled={!isSupported}
                >
                  {t('welcome_open_diff_btn')}
                </button>
              </>
            ) : (
              <button
                className="btn btn-accent"
                onClick={onSelectFolder}
                style={{ width: '100%', padding: '16px', fontSize: '14px', justifyContent: 'center', boxShadow: 'var(--shadow-glow-active)', borderWidth: '2px' }}
                disabled={!isSupported}
              >
                {t('welcome_open_btn')}
              </button>
            )}

            {!isSupported && (
              <div style={{
                padding: '12px',
                background: 'rgba(235,103,103,0.08)',
                border: '1px solid rgba(235,103,103,0.3)',
                borderRadius: '2px', textAlign: 'left',
                color: 'var(--danger-color)', fontSize: '11px', lineHeight: '1.4',
              }}>
                <strong style={{ display: 'block', marginBottom: '3px' }}>
                  {lang === 'ru' ? 'Браузер не поддерживает прямой доступ к папкам' : 'Browser does not support direct folder access'}
                </strong>
                {lang === 'ru' ? 'Переключитесь на вкладку «ZIP-АРХИВ» выше — она работает в абсолютно любых браузерах!' : 'Switch to the "ZIP ARCHIVE" tab above — it works in all browsers!'}
              </div>
            )}
          </div>
        )}

        {/* ── Mode 2: ZIP Archive Mode ── */}
        {activeMode === 'zip' && (
          <div style={{ width: '100%' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed #4ade80' : '2px dashed var(--border-color)',
                background: isDragging ? 'rgba(74,222,128,0.1)' : 'var(--bg-primary)',
                padding: '30px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{ fontSize: '32px' }}>📥</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-glow)', fontFamily: 'var(--font-heading)' }}>
                {lang === 'ru' ? 'ПЕРЕТАЩИТЕ .ZIP АРХИВ СЕРВЕРА СЮДА' : 'DRAG & DROP SERVER .ZIP ARCHIVE HERE'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {lang === 'ru' ? 'или нажмите для выбора файла с компьютера' : 'or click to browse from your computer'}
              </div>
              <div style={{ fontSize: '10px', color: '#86efac', background: 'rgba(74,222,128,0.1)', padding: '3px 8px', borderRadius: '3px' }}>
                ✓ {lang === 'ru' ? 'Работает в Firefox, Safari, Chrome и на мобильных' : 'Works in Firefox, Safari, Chrome and mobile'}
              </div>
            </div>
          </div>
        )}

        {/* Expected folder structure guide */}
        <div style={{
          marginTop: '26px', padding: '14px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: '2px', textAlign: 'left',
          fontSize: '11px', color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px', fontSize: '11px', fontFamily: 'var(--font-heading)', letterSpacing: '1px' }}>
            {t('welcome_expected_struct')}
          </strong>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <li><strong style={{ color: 'var(--text-glow)' }}>ExpansionMod/</strong> (Market, Traders, Quests, Loadouts...)</li>
            <li><strong style={{ color: 'var(--text-glow)' }}>expansion/</strong> (objects, traderzones, settings...)</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
