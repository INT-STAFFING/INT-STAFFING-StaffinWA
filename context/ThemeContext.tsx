
/**
 * @file context/ThemeContext.tsx
 * @description Gestione del tema Material 3 e sincronizzazione con il database.
 */

import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo, useCallback } from 'react';
import { apiFetch } from '../services/apiClient';

// --- Types ---

export type M3Palette = {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondary: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    tertiary: string;
    onTertiary: string;
    tertiaryContainer: string;
    onTertiaryContainer: string;
    error: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;
    background: string;
    onBackground: string;
    surface: string;
    onSurface: string;
    surfaceVariant: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    shadow: string;
    scrim: string;
    inverseSurface: string;
    inverseOnSurface: string;
    inversePrimary: string;
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
};

export type Theme = {
    light: M3Palette;
    dark: M3Palette;
    // Toast Customization
    toastPosition: 'top-center' | 'top-right' | 'top-left' | 'bottom-center' | 'bottom-right' | 'bottom-left';
    toastSuccessBackground: string;
    toastSuccessForeground: string;
    toastErrorBackground: string;
    toastErrorForeground: string;
    // Visualization Settings
    visualizationSettings: {
        sankey: {
            nodeWidth: number;
            nodePadding: number;
            linkOpacity: number;
        };
        network: {
            chargeStrength: number;
            linkDistance: number;
            centerStrength: number;
            nodeRadius: number;
        };
    }
};

interface ThemeContextType {
  theme: Theme;
  saveTheme: (theme: Theme) => Promise<void>;
  resetTheme: () => Promise<void>;
  refreshTheme: () => Promise<void>;
  isDbThemeEnabled: boolean;
  mode: 'light' | 'dark';
  toggleMode: () => void;
}

// --- Default Theme (Fallback Hardcoded) ---
export const defaultTheme: Theme = {
    light: {
        primary: '#006493',
        onPrimary: '#ffffff',
        primaryContainer: '#cae6ff',
        onPrimaryContainer: '#001e2f',
        secondary: '#50606e',
        onSecondary: '#ffffff',
        secondaryContainer: '#d3e5f5',
        onSecondaryContainer: '#0c1d29',
        tertiary: '#64597b',
        onTertiary: '#ffffff',
        tertiaryContainer: '#eaddff',
        onTertiaryContainer: '#1f1635',
        error: '#ba1a1a',
        onError: '#ffffff',
        errorContainer: '#ffdad6',
        onErrorContainer: '#410002',
        background: '#f8fafc',
        onBackground: '#191c1e',
        surface: '#f8fafc',
        onSurface: '#191c1e',
        surfaceVariant: '#dee3e9',
        onSurfaceVariant: '#42474c',
        outline: '#72787d',
        outlineVariant: '#c2c7cd',
        shadow: '#000000',
        scrim: '#000000',
        inverseSurface: '#2e3133',
        inverseOnSurface: '#f0f1f3',
        inversePrimary: '#8dcdff',
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: '#f2f4f7',
        surfaceContainer: '#eceef1',
        surfaceContainerHigh: '#e6e8eb',
        surfaceContainerHighest: '#e1e3e5',
    },
    dark: {
        primary: '#8dcdff',
        onPrimary: '#00344f',
        primaryContainer: '#004b70',
        onPrimaryContainer: '#cae6ff',
        secondary: '#b7c9d9',
        onSecondary: '#22323f',
        secondaryContainer: '#384956',
        onSecondaryContainer: '#d3e5f5',
        tertiary: '#cec0e8',
        onTertiary: '#352b4b',
        tertiaryContainer: '#4c4263',
        onTertiaryContainer: '#eaddff',
        error: '#ffb4ab',
        onError: '#690005',
        errorContainer: '#93000a',
        onErrorContainer: '#ffdad6',
        background: '#101418',
        onBackground: '#e1e3e5',
        surface: '#101418',
        onSurface: '#e1e3e5',
        surfaceVariant: '#42474c',
        onSurfaceVariant: '#c2c7cd',
        outline: '#8c9197',
        outlineVariant: '#42474c',
        shadow: '#000000',
        scrim: '#000000',
        inverseSurface: '#e1e3e5',
        inverseOnSurface: '#2e3133',
        inversePrimary: '#006493',
        surfaceContainerLowest: '#0b0f13',
        surfaceContainerLow: '#191c1e',
        surfaceContainer: '#1d2022',
        surfaceContainerHigh: '#272a2d',
        surfaceContainerHighest: '#323538',
    },
    toastPosition: 'top-center',
    toastSuccessBackground: '#2e7d32',
    toastSuccessForeground: '#ffffff',
    toastErrorBackground: '#c62828',
    toastErrorForeground: '#ffffff',
    visualizationSettings: {
        sankey: { nodeWidth: 20, nodePadding: 10, linkOpacity: 0.5 },
        network: { chargeStrength: -400, linkDistance: 200, centerStrength: 0.05, nodeRadius: 15 },
    }
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'staffing-app-db-theme';
const hexRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;

// Helper to overlay DB values ON TOP of default theme
const parseDbTheme = (dbConfig: { key: string; value: string }[]): Theme => {
    // Start with a clean copy of default
    const merged = JSON.parse(JSON.stringify(defaultTheme));

    for (const { key, value } of dbConfig) {
        if (!value) continue;

        if (key.startsWith('theme.light.')) {
            const paletteKey = key.substring(12) as keyof M3Palette;
            if (hexRegex.test(value)) merged.light[paletteKey] = value;
        } else if (key.startsWith('theme.dark.')) {
            const paletteKey = key.substring(11) as keyof M3Palette;
            if (hexRegex.test(value)) merged.dark[paletteKey] = value;
        } else if (key === 'theme.toastPosition') {
            merged.toastPosition = value as any;
        } else if (key === 'theme.toastSuccessBackground') {
            merged.toastSuccessBackground = value;
        } else if (key === 'theme.toastSuccessForeground') {
            merged.toastSuccessForeground = value;
        } else if (key === 'theme.toastErrorBackground') {
            merged.toastErrorBackground = value;
        } else if (key === 'theme.toastErrorForeground') {
            merged.toastErrorForeground = value;
        } else if (key.startsWith('theme.viz.')) {
            const parts = key.split('.');
            const chart = parts[2] as 'sankey' | 'network';
            const prop = parts[3];
            if (merged.visualizationSettings[chart]) {
                merged.visualizationSettings[chart][prop] = Number(value);
            }
        }
    }
    
    return merged;
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, _setTheme] = useState<Theme>(defaultTheme);
    const [isDbThemeEnabled, setIsDbThemeEnabled] = useState(false);

    const [mode, setMode] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            if (localStorage.getItem('themeMode') === 'dark' || 
                (!('themeMode' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                return 'dark';
            }
        }
        return 'light';
    });

    const createCssProperties = useCallback((palette: M3Palette) => {
        return (Object.entries(palette) as [keyof M3Palette, string][]).map(([key, value]) => {
            const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            return `${cssVarName}: ${value};`;
        }).join('\n');
    }, []);

    const injectStyles = useCallback((currentTheme: Theme) => {
        let styleElement = document.getElementById('dynamic-theme-styles');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'dynamic-theme-styles';
            document.head.appendChild(styleElement);
        }

        styleElement.innerHTML = `
            :root {
                ${createCssProperties(currentTheme.light)}
                --toast-success-bg: ${currentTheme.toastSuccessBackground};
                --toast-success-fg: ${currentTheme.toastSuccessForeground};
                --toast-error-bg: ${currentTheme.toastErrorBackground};
                --toast-error-fg: ${currentTheme.toastErrorForeground};
            }
            .dark {
                ${createCssProperties(currentTheme.dark)}
            }
        `;
    }, [createCssProperties]);

    // Initial Injection from state (Default or Cached)
    useEffect(() => {
        injectStyles(theme);
    }, [theme, injectStyles]);

    const loadAndApplyTheme = useCallback(async () => {
        // 1. Try to load from LocalStorage FIRST for immediate render (Stale-While-Revalidate)
        try {
            const cachedThemeJSON = localStorage.getItem(THEME_STORAGE_KEY);
            if (cachedThemeJSON) {
                const cachedTheme = JSON.parse(cachedThemeJSON);
                _setTheme(cachedTheme);
                injectStyles(cachedTheme);
            }
        } catch (e) {
            console.warn("Failed to load theme from cache", e);
        }

        // 2. Fetch from DB
        try {
            const token = localStorage.getItem('authToken');
            // If no token (not logged in), we might want to stick to default or cache.
            // But let's try fetching if it's a public endpoint or if we have a token.
            // Assuming authorized access is required for full config reading.
            if (!token) return;

            const dbConfig: { key: string; value: string }[] = await apiFetch('/api/resources?entity=theme');
            const enabledEntry = dbConfig.find(c => c.key === 'theme.db.enabled');
            const enabled = enabledEntry ? enabledEntry.value === 'true' : true; // Default to true if not set
            setIsDbThemeEnabled(enabled);

            if (!enabled) {
                // Explicitly disabled in DB -> Force Default
                _setTheme(defaultTheme);
                injectStyles(defaultTheme);
                localStorage.removeItem(THEME_STORAGE_KEY); // Clear cache if disabled
                return;
            }

            // 3. Merge DB Config over Defaults
            const newTheme = parseDbTheme(dbConfig);
            
            // 4. Update State and Cache
            _setTheme(newTheme);
            injectStyles(newTheme);
            localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));

        } catch (error) {
            console.error("Failed to load theme from DB:", error);
            // In case of error, we stay with whatever we loaded in step 1 (Cache) or initial state (Default)
        }
    }, [injectStyles]);

    // Load on mount
    useEffect(() => {
        loadAndApplyTheme();
    }, [loadAndApplyTheme]);
    
    // Handle Dark/Light mode toggle
    useEffect(() => {
        const root = window.document.documentElement;
        if (mode === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('themeMode', mode);
    }, [mode]);

    const saveTheme = useCallback(async (newTheme: Theme) => {
        const updates: Record<string, string> = {};
        for (const key of Object.keys(defaultTheme.light) as (keyof M3Palette)[]) updates[`theme.light.${key}`] = newTheme.light[key];
        for (const key of Object.keys(defaultTheme.dark) as (keyof M3Palette)[]) updates[`theme.dark.${key}`] = newTheme.dark[key];

        updates['theme.toastPosition'] = newTheme.toastPosition;
        updates['theme.toastSuccessBackground'] = newTheme.toastSuccessBackground;
        updates['theme.toastSuccessForeground'] = newTheme.toastSuccessForeground;
        updates['theme.toastErrorBackground'] = newTheme.toastErrorBackground;
        updates['theme.toastErrorForeground'] = newTheme.toastErrorForeground;

        updates['theme.viz.sankey.nodeWidth'] = String(newTheme.visualizationSettings.sankey.nodeWidth);
        updates['theme.viz.sankey.nodePadding'] = String(newTheme.visualizationSettings.sankey.nodePadding);
        updates['theme.viz.sankey.linkOpacity'] = String(newTheme.visualizationSettings.sankey.linkOpacity);
        updates['theme.viz.network.chargeStrength'] = String(newTheme.visualizationSettings.network.chargeStrength);
        updates['theme.viz.network.linkDistance'] = String(newTheme.visualizationSettings.network.linkDistance);
        updates['theme.viz.network.centerStrength'] = String(newTheme.visualizationSettings.network.centerStrength);
        updates['theme.viz.network.nodeRadius'] = String(newTheme.visualizationSettings.network.nodeRadius);

        try {
            await apiFetch('/api/resources?entity=theme', {
                method: 'POST',
                body: JSON.stringify({ updates }),
            });
            await loadAndApplyTheme(); // Reload to confirm DB persistence
        } catch (error) {
            console.error("Failed to save theme to DB", error);
            throw error;
        }
    }, [loadAndApplyTheme]);

    const resetTheme = useCallback(async () => { await saveTheme(defaultTheme); }, [saveTheme]);
    const toggleMode = () => { setMode(prevMode => (prevMode === 'light' ? 'dark' : 'light')); };
    
    const contextValue = useMemo(() => ({
        theme, saveTheme, resetTheme, refreshTheme: loadAndApplyTheme, isDbThemeEnabled, mode, toggleMode,
    }), [theme, mode, saveTheme, resetTheme, loadAndApplyTheme, isDbThemeEnabled]);

    return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
