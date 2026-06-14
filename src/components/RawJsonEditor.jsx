import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../utils/localization';
import { useToast } from './ToastManager';

export default function RawJsonEditor({ filePath, config, onChangeField, onSaveFile, onResetFile }) {
  const { t, lang } = useTranslation();
  const toast = useToast();
  const [text, setText] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [errorLine, setErrorLine] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  
  const [scrollTop, setScrollTop] = useState(0);
  
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const validationTimerRef = useRef(null);

  // Clean up validation timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, []);

  // Load configuration content into local text state when filePath or config.content changes
  useEffect(() => {
    if (config && config.success && config.content) {
      try {
        const formatted = JSON.stringify(config.content, null, 2);
        setText(formatted);
        setErrorMsg(null);
        setErrorLine(null);
        setIsDirty(false);
        setScrollTop(0);
        if (textareaRef.current) textareaRef.current.scrollTop = 0;
      } catch (e) {
        console.error(e);
      }
    } else {
      setText('');
      setErrorMsg(null);
      setErrorLine(null);
      setIsDirty(false);
      setScrollTop(0);
    }
  }, [filePath, config]);

  // Sync scroll between textarea and line number gutter
  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Synchronous JSON validation safeguard
  const validateSync = (currentText) => {
    try {
      JSON.parse(currentText);
      setErrorMsg(null);
      setErrorLine(null);
      return true;
    } catch (err) {
      setErrorMsg(err.message);
      const posMatch = err.message.match(/position\s+(\d+)/i);
      if (posMatch) {
        const charPos = parseInt(posMatch[1], 10);
        const prefix = currentText.substring(0, charPos);
        const lineNum = prefix.split('\n').length;
        setErrorLine(lineNum);
      } else {
        setErrorLine(null);
      }
      return false;
    }
  };

  // Perform JSON validation with a debounce to prevent input lag on large files
  const handleChangeText = (newVal) => {
    setText(newVal);
    setIsDirty(true);
    
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }

    if (!newVal.trim()) {
      setErrorMsg(null);
      setErrorLine(null);
      return;
    }

    validationTimerRef.current = setTimeout(() => {
      validateSync(newVal);
    }, 300);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(text);
      const formatted = JSON.stringify(parsed, null, 2);
      setText(formatted);
      setErrorMsg(null);
      setErrorLine(null);
      toast.success(lang === 'ru' ? 'Синтаксис отформатирован!' : 'Formatted successfully!');
    } catch (err) {
      toast.error((lang === 'ru' ? 'Ошибка форматирования: ' : 'Format error: ') + err.message);
    }
  };

  const handleApply = () => {
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }
    const isValid = validateSync(text);
    if (!isValid) {
      toast.error(lang === 'ru' ? 'Исправьте ошибки синтаксиса перед сохранением!' : 'Fix syntax errors before saving!');
      return;
    }
    try {
      const parsed = JSON.parse(text);
      onChangeField(filePath, [], parsed);
      setIsDirty(false);
      toast.success(lang === 'ru' ? 'Изменения применены к редактору!' : 'Changes applied to config!');
    } catch (err) {
      toast.error((lang === 'ru' ? 'Ошибка разбора JSON: ' : 'JSON Parse Error: ') + err.message);
    }
  };

  const handleSave = () => {
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }
    const isValid = validateSync(text);
    if (!isValid) {
      toast.error(lang === 'ru' ? 'Исправьте ошибки синтаксиса перед сохранением!' : 'Fix syntax errors before saving!');
      return;
    }
    try {
      const parsed = JSON.parse(text);
      onChangeField(filePath, [], parsed);
      // Wait a tick for state to propagate
      setTimeout(() => {
        onSaveFile(filePath);
        setIsDirty(false);
      }, 50);
    } catch (err) {
      toast.error((lang === 'ru' ? 'Ошибка разбора: ' : 'Parse error: ') + err.message);
    }
  };

  const handleReset = () => {
    const confirmMsg = lang === 'ru' 
      ? 'Вы уверены, что хотите отменить все изменения и сбросить этот файл до исходного состояния сессии?' 
      : 'Are you sure you want to discard all changes and reset this file to its initial session state?';
    
    if (window.confirm(confirmMsg)) {
      if (onResetFile) {
        onResetFile(filePath);
        toast.info(lang === 'ru' ? 'Файл сброшен до исходного состояния сессии.' : 'File reset to initial session state.');
      }
    }
  };

  if (!filePath || !config) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        <span>{lang === 'ru' ? 'Выберите файл в левом меню для просмотра RAW JSON' : 'Select a file in the sidebar to view RAW JSON'}</span>
      </div>
    );
  }

  const linesCount = text.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(1, linesCount) }, (_, i) => i + 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
      {/* Header Toolbar */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {lang === 'ru' ? 'RAW JSON РЕДАКТОР' : 'RAW JSON EDITOR'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-glow)', fontWeight: 'bold' }}>
            {filePath.split('/').pop()}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={handleFormat}>
            ✨ {lang === 'ru' ? 'Форматировать' : 'Format'}
          </button>
          <button 
            className={`btn ${isDirty && !errorMsg ? 'btn-accent' : ''}`} 
            onClick={handleApply}
            disabled={errorMsg !== null}
            style={{ opacity: errorMsg ? 0.5 : 1 }}
          >
            📥 {lang === 'ru' ? 'Применить' : 'Apply'}
          </button>
          <button 
            className="btn btn-warning" 
            onClick={handleSave}
            disabled={errorMsg !== null}
            style={{ opacity: errorMsg ? 0.5 : 1 }}
          >
            💾 {lang === 'ru' ? 'Сохранить на диск' : 'Save to Disk'}
          </button>
          <button 
            className="btn btn-danger" 
            onClick={handleReset}
            disabled={!isDirty}
            style={{ opacity: isDirty ? 1 : 0.5 }}
          >
            ↺ {lang === 'ru' ? 'Сбросить' : 'Reset'}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', background: 'var(--bg-primary)' }}>
        {errorLine && (
          <div 
            style={{
              position: 'absolute',
              left: '45px',
              right: 0,
              top: `${12 + (errorLine - 1) * 20}px`,
              height: '20px',
              background: 'rgba(255, 77, 77, 0.1)',
              borderLeft: '3px solid #ff4d4d',
              boxShadow: 'inset 0 0 10px rgba(255, 77, 77, 0.05)',
              pointerEvents: 'none',
              transform: `translateY(-${scrollTop}px)`,
              zIndex: 0,
            }}
          />
        )}
        
        {/* Line Numbers Gutter */}
        <div 
          ref={gutterRef}
          style={{
            width: '45px',
            background: 'var(--bg-tertiary)',
            borderRight: '1px solid var(--border-color)',
            color: 'var(--text-dark)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: '20px',
            textAlign: 'right',
            padding: '12px 8px 12px 0',
            overflowY: 'hidden',
            userSelect: 'none',
            boxSizing: 'border-box',
            zIndex: 2
          }}
        >
          {lineNumbers.map(n => {
            const isErrorLine = n === errorLine;
            return (
              <div 
                key={n} 
                style={{ 
                  color: isErrorLine ? '#ff4d4d' : 'var(--text-dark)',
                  textShadow: isErrorLine ? '0 0 6px rgba(255, 77, 77, 0.6)' : 'none',
                  fontWeight: isErrorLine ? 'bold' : 'normal',
                  paddingRight: '4px'
                }}
              >
                {n}
              </div>
            );
          })}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChangeText(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          style={{
            flex: 1,
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: '20px',
            border: 'none',
            outline: 'none',
            resize: 'none',
            padding: '12px',
            overflowY: 'auto',
            whiteSpace: 'pre',
            wordWrap: 'normal',
            boxSizing: 'border-box',
            zIndex: 1
          }}
        />
      </div>

      {/* Validation Banner */}
      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid var(--border-color)',
        background: errorMsg ? 'rgba(231, 76, 60, 0.08)' : 'rgba(46, 204, 113, 0.08)',
        color: errorMsg ? 'var(--danger-color)' : '#2ecc71',
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {errorMsg ? (
          <>
            <span>❌</span>
            <span>
              {lang === 'ru' ? 'Синтаксическая ошибка в JSON' : 'JSON Syntax Error'} 
              {errorLine ? ` (${lang === 'ru' ? 'строка' : 'line'} ${errorLine})` : ''}: {errorMsg}
            </span>
          </>
        ) : (
          <>
            <span>✓</span>
            <span>{lang === 'ru' ? 'Синтаксис корректен' : 'JSON Syntax is valid'}</span>
          </>
        )}
      </div>
    </div>
  );
}
