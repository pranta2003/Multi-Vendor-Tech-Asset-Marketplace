import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'theme_preference';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeToDom = (resolved: 'light' | 'dark'): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'system';
};

const initialTheme = getInitialTheme();
const initialResolved = initialTheme === 'system' ? getSystemTheme() : initialTheme;
applyThemeToDom(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => {
  // Listen to system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (get().theme === 'system') {
        const resolved = e.matches ? 'dark' : 'light';
        applyThemeToDom(resolved);
        set({ resolvedTheme: resolved });
      }
    });
  }

  return {
    theme: initialTheme,
    resolvedTheme: initialResolved,
    setTheme: (theme: Theme) => {
      localStorage.setItem(STORAGE_KEY, theme);
      const resolved = theme === 'system' ? getSystemTheme() : theme;
      applyThemeToDom(resolved);
      set({ theme, resolvedTheme: resolved });
    },
  };
});

