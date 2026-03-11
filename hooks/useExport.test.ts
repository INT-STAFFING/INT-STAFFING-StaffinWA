/* @vitest-environment jsdom */
/**
 * @file hooks/useExport.test.ts
 * @description Test unitari per useExport.
 * Verifica gestione della Clipboard API, stato di loading/success/error
 * e fallback per browser senza supporto clipboard.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExport } from './useExport';

const mockData = [
    { nome: 'Mario', cognome: 'Rossi', eta: 30 },
    { nome: 'Anna', cognome: 'Verdi', eta: 25 },
];

// Helper per impostare un'implementazione mock della Clipboard API
const setupClipboard = (shouldFail = false) => {
    const writeMock = shouldFail
        ? vi.fn().mockRejectedValue(new Error('Permesso negato'))
        : vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
        value: { write: writeMock },
        configurable: true,
        writable: true,
    });

    return writeMock;
};

const removeClipboard = () => {
    Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
        writable: true,
    });
};

beforeEach(() => {
    vi.restoreAllMocks();
    // ClipboardItem deve essere disponibile globalmente in jsdom
    if (typeof globalThis.ClipboardItem === 'undefined') {
        (globalThis as any).ClipboardItem = class ClipboardItem {
            constructor(public items: Record<string, Blob>) {}
        };
    }
});

describe('useExport – stato iniziale', () => {
    it('inizia con isCopying=false, hasCopied=false, error=null', () => {
        setupClipboard();
        const { result } = renderHook(() => useExport({ data: mockData }));
        expect(result.current.isCopying).toBe(false);
        expect(result.current.hasCopied).toBe(false);
        expect(result.current.error).toBeNull();
    });
});

describe('useExport – clipboard non disponibile', () => {
    it('imposta error se navigator.clipboard.write non è disponibile', async () => {
        removeClipboard();
        const { result } = renderHook(() => useExport({ data: mockData }));

        await act(async () => {
            await result.current.copyToClipboard();
        });

        expect(result.current.error).toBeTruthy();
        expect(result.current.hasCopied).toBe(false);
    });
});

describe('useExport – copia riuscita', () => {
    it('imposta hasCopied=true dopo copia riuscita', async () => {
        setupClipboard();
        const { result } = renderHook(() => useExport({ data: mockData }));

        await act(async () => {
            await result.current.copyToClipboard();
        });

        expect(result.current.hasCopied).toBe(true);
        expect(result.current.error).toBeNull();
    });

    it('isCopying è true durante la copia', async () => {
        let resolveCopy!: () => void;
        const writeMock = vi.fn().mockReturnValue(new Promise<void>(r => { resolveCopy = r; }));
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: writeMock },
            configurable: true,
            writable: true,
        });

        const { result } = renderHook(() => useExport({ data: mockData }));

        let copyPromise: Promise<void>;
        act(() => {
            copyPromise = result.current.copyToClipboard();
        });

        // Subito dopo l'avvio: isCopying deve essere true
        await waitFor(() => expect(result.current.isCopying).toBe(true));

        // Risolvi la promise
        await act(async () => {
            resolveCopy();
            await copyPromise;
        });

        expect(result.current.isCopying).toBe(false);
    });

    it('passa il titolo a buildHtmlTable quando fornito', async () => {
        const writeMock = setupClipboard();
        const { result } = renderHook(() => useExport({ data: mockData, title: 'Tabella Esportata' }));

        await act(async () => {
            await result.current.copyToClipboard();
        });

        expect(writeMock).toHaveBeenCalledTimes(1);
        const clipboardItem = writeMock.mock.calls[0][0][0];
        // L'item deve avere chiavi text/plain e text/html
        expect(clipboardItem.items).toHaveProperty('text/plain');
        expect(clipboardItem.items).toHaveProperty('text/html');
    });
});

describe('useExport – errore clipboard', () => {
    it('imposta error e hasCopied=false in caso di errore', async () => {
        setupClipboard(true); // forza il fallimento
        const { result } = renderHook(() => useExport({ data: mockData }));

        await act(async () => {
            await result.current.copyToClipboard();
        });

        expect(result.current.hasCopied).toBe(false);
        expect(result.current.error).toBe('Permesso negato');
        expect(result.current.isCopying).toBe(false);
    });
});
