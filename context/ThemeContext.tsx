import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo } from 'react';

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
  setTheme: (theme: Theme) => void;
  resetTheme: () => void;
}

// --- Default Theme ---

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
    // Toast Defaults
    toastPosition: 'top-center',
    toastSuccessBackground: 'rgba(220, 252, 231, 0.95)', // green-100 with opacity
    toastSuccessForeground: '#14532d', // green-900
    toastErrorBackground: 'rgba(254, 226, 226, 0.95)', // red-100 with opacity
    toastErrorForeground: '#7f1d1d', // red-900

    // Visualization Setting Defaults
    visualizationSettings: {
        sankey: {
            nodeWidth: 20,
            nodePadding: 10,
            linkOpacity: 0.5,
        },
        network: {
            chargeStrength: -400,
            linkDistance: 200,
            centerStrength: 0.05,
            nodeRadius: 15,
        },
    }
};

// --- Context ---

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// --- Provider ---

const THEME_STORAGE_KEY = 'staffing-app-theme';

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
    
     useEffect(() => {
        const styleElement = document.getElementById('dynamic-theme-styles') || document.createElement('style');
        styleElement.id = 'dynamic-theme-styles';

        const createCssProperties = (palette: M3Palette) => {
            return (Object.entries(palette) as [keyof M3Palette, string][]).map(([key, value]) => {
                const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                return `${cssVarName}: ${value};`;
            }).join('\n');
        };

        styleElement.innerHTML = `
            :root {
                ${createCssProperties(theme.light)}
            }
            .dark {
                ${createCssProperties(theme.dark)}
            }
        `;

        document.head.appendChild(styleElement);
    }, [theme]);
    
    const setTheme = (newTheme: Theme) => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
            _setTheme(newTheme);
        } catch (error) {
            console.error("Failed to save theme to localStorage", error);
        }
    };

    const resetTheme = () => {
        try {
            localStorage.removeItem(THEME_STORAGE_KEY);
            _setTheme(defaultTheme);
        } catch (error) {
            console.error("Failed to remove theme from localStorage", error);
        }
    };
    
    const contextValue = useMemo(() => ({
        theme,
        setTheme,
        resetTheme,
    }), [theme]);

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