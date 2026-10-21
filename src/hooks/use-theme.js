import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tpd-theme';

function systemPrefersDark() {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function readExplicitTheme() {
  const value = document.documentElement.dataset.theme;
  return value === 'dark' || value === 'light' ? value : null;
}

// Resolved theme ('light' | 'dark'). Charts subscribe to it so they can re-read
// the CSS colour tokens whenever the page switches.
export function useTheme() {
  const [theme, setTheme] = useState(() => readExplicitTheme() || (systemPrefersDark() ? 'dark' : 'light'));

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = () => {
      if (!readExplicitTheme()) setTheme(media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Theme still applies for this visit when storage is unavailable.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
