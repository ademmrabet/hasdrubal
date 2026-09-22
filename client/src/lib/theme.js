import { useEffect, useState } from 'react';

const STORAGE_KEY = 'hasdrubal-theme';

/**
 * Theme clair par defaut (prefere par le patron), memorise par navigateur une
 * fois change. Ne suit jamais automatiquement les preferences systeme : voir
 * public/theme-init.js, applique avant le premier rendu.
 */
export function getStoredTheme() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Navigation privee ou stockage bloque : le choix ne survivra pas a la page, tant pis.
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(getStoredTheme);

  // Le script theme-init.js a deja pose l'attribut avant le montage ; on ne
  // le re-applique que lorsque l'utilisateur change explicitement de theme.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  };

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
