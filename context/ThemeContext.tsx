import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo, useCallback } from 'react';

// --- Types ---

export type Theme = {
    primary: string;
    primaryDarker: string;
    destructive: string;
    success: string;
    warning: string;
    background: string;
    foreground: string;
    card: string;
    border: string;
    muted: string;
    mutedForeground: string;
    darkBackground: string;
    darkForeground: string;
    darkCard: string;
    darkBorder: string;
    darkMuted: string;
    darkMutedForeground: string;
};

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resetTheme: () => void;
  themeMode: ThemeMode;
  toggleThemeMode: () => void;
}

// --- Default Theme ---

export const defaultTheme: Theme = {
    // Main Palette
    primary: '#2563eb',
    primaryDarker: '#1d4ed8',
    destructive: '#dc2626',
    success: '#16a34a',
    warning: '#f59e0b',

    // Light Mode
    background: '#f8fafc',
    foreground: '#0f172a',
    card: '#ffffff',
    border: '#e2e8f0',
    muted: '#f1f5f9',
    mutedForeground: '#64748b',

    // Dark Mode
    darkBackground: '#020617',
    darkForeground: '#f8fafc',
    darkCard: '#0f172a',
    darkBorder: '#1e293b',
    darkMuted: '#1e293b',
    darkMutedForeground: '#94a3b8',
};

// --- Context ---

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// --- Provider ---

const THEME_STORAGE_KEY = 'staffing-app-theme';
const THEME_MODE_STORAGE_KEY = 'staffing-app-theme-mode';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, _setTheme] = useState<Theme>(() => {
        try {
            const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (storedTheme) {
                // Merge stored theme with defaults to prevent missing keys on updates
                return { ...defaultTheme, ...JSON.parse(storedTheme) };
            }
        } catch (error) {
            console.error("Failed to parse theme from localStorage", error);
        }
        return defaultTheme;
    });

    const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
        try {
            const storedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
            if (storedMode === 'light' || storedMode === 'dark') {
                return storedMode;
            }
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
        } catch (error) {
            console.error("Failed to read theme mode from localStorage", error);
        }
        return 'light';
    });
    
    useEffect(() => {
        const root = document.documentElement;
        Object.entries(theme).forEach(([key, value]) => {
            const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            root.style.setProperty(cssVarName, value);
        });
    }, [theme]);
    
    useEffect(() => {
        const root = document.documentElement;
        if (themeMode === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        try {
            localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
        } catch (error) {
            console.error("Failed to save theme mode to localStorage", error);
        }
    }, [themeMode]);

    const setTheme = useCallback((newTheme: Theme) => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
            _setTheme(newTheme);
        } catch (error) {
            console.error("Failed to save theme to localStorage", error);
        }
    }, []);

    const resetTheme = useCallback(() => {
        try {
            localStorage.removeItem(THEME_STORAGE_KEY);
            _setTheme(defaultTheme);
        } catch (error) {
            console.error("Failed to remove theme from localStorage", error);
        }
    }, []);

    const toggleThemeMode = useCallback(() => {
        setThemeMode(prevMode => (prevMode === 'light' ? 'dark' : 'light'));
    }, []);
    
    const contextValue = useMemo(() => ({
        theme,
        setTheme,
        resetTheme,
        themeMode,
        toggleThemeMode,
    }), [theme, setTheme, resetTheme, themeMode, toggleThemeMode]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

// --- Hook ---

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};