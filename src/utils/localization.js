import React, { createContext, useContext, useState } from 'react';
import en from './lang/en';
import ru from './lang/ru';

export const translations = {
  en,
  ru
};

// --- Language Context & Provider ---
const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('dayz_editor_lang') || 'ru';
  });

  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('dayz_editor_lang', newLang);
  };

  const t = (key, replacements = {}) => {
    let text = translations[lang]?.[key] || translations['en']?.[key] || key;
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
    return text;
  };

  return React.createElement(LanguageContext.Provider, { value: { lang, setLang, t } }, children);
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
