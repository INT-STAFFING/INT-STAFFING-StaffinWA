/* @vitest-environment jsdom */
/**
 * @file context/ThemeContext.test.tsx
 * @description Guardrail contro la duplicazione palette index.css <-> defaultTheme.
 *
 * `defaultTheme` qui e le regole `:root`/`.dark` di index.css descrivono la
 * stessa palette in due posti diversi. Questi test:
 * 1) verificano che i due restino identici (fallisce in CI se qualcuno aggiorna
 *    solo uno dei due file), e
 * 2) verificano che, quando il tema non e personalizzato via DB, il
 *    ThemeProvider non inietti override di colore: index.css resta l'unica
 *    fonte di verita visiva, quindi un eventuale disallineamento (1) non puo
 *    piu produrre colori "invisibili" a runtime come accaduto in precedenza.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/apiClient', () => ({
    apiFetch: vi.fn(),
}));

import { ThemeProvider, useTheme, defaultTheme, type M3Palette } from './ThemeContext';

beforeEach(() => {
    localStorage.clear();
    document.getElementById('dynamic-theme-styles')?.remove();
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
});

const cssVarName = (key: keyof M3Palette) => `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;

const extractBlock = (css: string, selector: string): string => {
    const start = css.indexOf(selector);
    if (start === -1) throw new Error(`Selettore "${selector}" non trovato in index.css`);
    const braceStart = css.indexOf('{', start);
    const braceEnd = css.indexOf('}', braceStart);
    return css.slice(braceStart, braceEnd);
};

const parseColorVars = (block: string): Record<string, string> => {
    const vars: Record<string, string> = {};
    const regex = /(--color-[a-z-]+)\s*:\s*([^;]+);/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(block)) !== null) {
        vars[match[1]] = match[2].trim();
    }
    return vars;
};

describe('defaultTheme <-> index.css (nessuna divergenza silenziosa)', () => {
    const cssPath = path.resolve(__dirname, '../index.css');
    // I commenti CSS possono citare nomi di variabili (es. "era identico a
    // --color-background"): vanno rimossi prima del parsing per non falsare l'estrazione.
    const css = fs.readFileSync(cssPath, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rootVars = parseColorVars(extractBlock(css, ':root'));
    const darkVars = parseColorVars(extractBlock(css, '.dark'));

    it.each(Object.keys(defaultTheme.light) as (keyof M3Palette)[])(
        'light.%s combacia con --color-* in index.css :root',
        (key) => {
            expect(rootVars[cssVarName(key)]).toBe(defaultTheme.light[key]);
        },
    );

    it.each(Object.keys(defaultTheme.dark) as (keyof M3Palette)[])(
        'dark.%s combacia con --color-* in index.css .dark',
        (key) => {
            expect(darkVars[cssVarName(key)]).toBe(defaultTheme.dark[key]);
        },
    );
});

describe('ThemeProvider - injection senza personalizzazioni DB', () => {
    it('non inietta override di colore quando il tema è quello di default', async () => {
        const { result } = renderHook(() => useTheme(), {
            wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
        });

        await waitFor(() => expect(result.current.theme).toEqual(defaultTheme));

        const styleElement = document.getElementById('dynamic-theme-styles');
        expect(styleElement).not.toBeNull();
        expect(styleElement?.innerHTML).not.toMatch(/--color-/);
        // I toast, senza equivalente in index.css, restano sempre espliciti.
        expect(styleElement?.innerHTML).toMatch(/--toast-success-bg/);
    });
});
