import React, {
    createContext,
    useState,
    useEffect,
    useContext,
    ReactNode,
    useMemo,
    useCallback,
} from 'react';

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
    headerBackground: string;
    headerForeground: string;
    headerBorder: string;
    sidebarBackground: string;
    sidebarForeground: string;
    sidebarMuted: string;
    sidebarBorder: string;
    sidebarActiveBackground: string;
    sidebarActiveForeground: string;
    darkBackground: string;
    darkForeground: string;
    darkCard: string;
    darkBorder: string;
    darkMuted: string;
    darkMutedForeground: string;
    darkHeaderBackground: string;
    darkHeaderForeground: string;
    darkHeaderBorder: string;
    darkSidebarBackground: string;
    darkSidebarForeground: string;
    darkSidebarMuted: string;
    darkSidebarBorder: string;
    darkSidebarActiveBackground: string;
    darkSidebarActiveForeground: string;
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resetTheme: () => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export type ThemeMode = 'light' | 'dark';

// --- Default Theme ---

export const defaultTheme: Theme = {
    // Main Palette
    primary: '#0a9396', // Dark cyan
    primaryDarker: '#005f73', // Midnight green
    destructive: '#ae2012', // Rufous
    success: '#94d2bd', // Tiffany blue
    warning: '#ee9b00', // Gamboge

    // Light Mode
    background: '#f4efdf',
    foreground: '#001219', // Rich black
    card: '#ffffff',
    border: '#d7c79a',
    muted: '#f2ecdc',
    mutedForeground: '#005f73',
    headerBackground: '#ffffff',
    headerForeground: '#001219',
    headerBorder: '#d7c79a',
    sidebarBackground: '#005f73',
    sidebarForeground: '#e9d8a6',
    sidebarMuted: '#0a9396',
    sidebarBorder: '#0a9396',
    sidebarActiveBackground: '#0a9396',
    sidebarActiveForeground: '#e9d8a6',

    // Dark Mode
    darkBackground: '#001219',
    darkForeground: '#e9d8a6',
    darkCard: '#003f52',
    darkBorder: '#0a9396',
    darkMuted: '#003f52',
    darkMutedForeground: '#94d2bd',
    darkHeaderBackground: '#001219',
    darkHeaderForeground: '#e9d8a6',
    darkHeaderBorder: '#0a9396',
    darkSidebarBackground: '#001219',
    darkSidebarForeground: '#94d2bd',
    darkSidebarMuted: '#003f52',
    darkSidebarBorder: '#0a9396',
    darkSidebarActiveBackground: '#0a9396',
    darkSidebarActiveForeground: '#e9d8a6',
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
    const [mode, _setMode] = useState<ThemeMode>(() => {
        try {
            const storedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY) as ThemeMode | null;
            if (storedMode === 'light' || storedMode === 'dark') {
                return storedMode;
            }
        } catch (error) {
            console.error('Failed to parse theme mode from localStorage', error);
        }

        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
        if (mode === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        root.setAttribute('data-theme-mode', mode);
        try {
            localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
        } catch (error) {
            console.error('Failed to persist theme mode', error);
        }
    }, [mode]);

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

    const setMode = useCallback((newMode: ThemeMode) => {
        _setMode(newMode);
    }, []);

    const toggleMode = useCallback(() => {
        _setMode(prev => (prev === 'light' ? 'dark' : 'light'));
    }, []);

    const contextValue = useMemo(() => ({
        theme,
        setTheme,
        resetTheme,
        mode,
        setMode,
        toggleMode,
    }), [mode, resetTheme, setMode, setTheme, theme, toggleMode]);

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
