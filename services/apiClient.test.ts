/* @vitest-environment jsdom */
/**
 * @file services/apiClient.test.ts
 * @description Test unitari per apiClient.
 * Verifica isLocalPreview (rilevamento ambiente) e la logica di retry/backoff di apiFetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isLocalPreview, apiFetch } from './apiClient';

// ---------------------------------------------------------------------------
// Mock del mockFetch per evitare dipendenze da mockHandlers/mockData
// ---------------------------------------------------------------------------
vi.mock('./mockHandlers', () => ({
    mockFetch: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('./mockData', () => ({
    INITIAL_MOCK_DATA: {},
}));

// ---------------------------------------------------------------------------
// Helper per sovrascrivere window.location in jsdom
// ---------------------------------------------------------------------------
const setHostname = (hostname: string, port = '') => {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, hostname, port },
    });
};

describe('isLocalPreview', () => {
    afterEach(() => {
        // Ripristina localhost dopo ogni test
        setHostname('localhost', '3000');
    });

    it('restituisce true per localhost', () => {
        setHostname('localhost', '3000');
        expect(isLocalPreview()).toBe(true);
    });

    it('restituisce true per 127.0.0.1', () => {
        setHostname('127.0.0.1', '');
        expect(isLocalPreview()).toBe(true);
    });

    it('restituisce true per porta non standard', () => {
        setHostname('mia-app.com', '8080');
        expect(isLocalPreview()).toBe(true);
    });

    it('restituisce false per porta 80', () => {
        setHostname('mia-app.com', '80');
        expect(isLocalPreview()).toBe(false);
    });

    it('restituisce false per porta 443', () => {
        setHostname('mia-app.com', '443');
        expect(isLocalPreview()).toBe(false);
    });

    it('restituisce true per host con "webcontainer"', () => {
        setHostname('my.webcontainer.io', '');
        expect(isLocalPreview()).toBe(true);
    });

    it('restituisce true per host con "stackblitz"', () => {
        setHostname('app.stackblitz.io', '');
        expect(isLocalPreview()).toBe(true);
    });

    it('restituisce true per host senza punto (intranet)', () => {
        setHostname('mioserver', '');
        expect(isLocalPreview()).toBe(true);
    });

    it('restituisce true per usercontent.goog', () => {
        setHostname('sandbox.usercontent.goog', '');
        expect(isLocalPreview()).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// apiFetch – logica produzione (simulando un hostname di produzione)
// ---------------------------------------------------------------------------
describe('apiFetch – produzione (mocked fetch)', () => {
    beforeEach(() => {
        // Imposta hostname di produzione per bypassare il mock intercept
        setHostname('mia-app.com', '443');
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        setHostname('localhost', '3000');
    });

    it('restituisce il JSON della risposta in caso di successo', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: 'ok' }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const result = await apiFetch('/api/data');
        expect(result).toEqual({ data: 'ok' });
    });

    it('restituisce null per risposta 204 (No Content)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));

        const result = await apiFetch('/api/data');
        expect(result).toBeNull();
    });

    it('aggiunge header Authorization Bearer se il token è presente', async () => {
        localStorage.setItem('authToken', 'my-jwt-token');
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true, status: 200, json: () => Promise.resolve({}),
        });
        vi.stubGlobal('fetch', mockFetch);

        await apiFetch('/api/data');

        const calledHeaders = mockFetch.mock.calls[0][1].headers;
        expect(calledHeaders['Authorization']).toBe('Bearer my-jwt-token');
        localStorage.removeItem('authToken');
    });

    it('non aggiunge header Authorization se authStrategy=none', async () => {
        localStorage.setItem('authToken', 'my-jwt-token');
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true, status: 200, json: () => Promise.resolve({}),
        });
        vi.stubGlobal('fetch', mockFetch);

        await apiFetch('/api/data', {}, { authStrategy: 'none' });

        const calledHeaders = mockFetch.mock.calls[0][1].headers;
        expect(calledHeaders['Authorization']).toBeUndefined();
        localStorage.removeItem('authToken');
    });

    it('lancia immediatamente per errori 4xx (client error, no retry)', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Not found' }),
        });
        vi.stubGlobal('fetch', mockFetch);

        await expect(apiFetch('/api/missing')).rejects.toThrow('Not found');
        // Nessun retry per 4xx
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('riprova fino a retries volte per errori 5xx', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            json: () => Promise.resolve({ error: 'Service unavailable' }),
        });
        vi.stubGlobal('fetch', mockFetch);

        // retries=2: 1 tentativo iniziale + 2 retry = 3 chiamate totali
        const promise = apiFetch('/api/data', {}, { retries: 2, retryDelayMs: 10 });
        promise.catch(() => {}); // evita unhandled rejection warning

        // Avanza i timer per i delay di retry
        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow();
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('applica backoff esponenziale: secondo delay doppio del primo', async () => {
        // Verifica il backoff esponenziale contando le chiamate avanzando il clock
        // manualmente: retryDelayMs=100, backoffFactor=2 → delay1=100ms, delay2=200ms
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            json: () => Promise.resolve({ error: 'err' }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const promise = apiFetch('/api/data', {}, {
            retries: 2,
            retryDelayMs: 100,
            backoffFactor: 2,
        });
        promise.catch(() => {}); // evita unhandled rejection warning

        // Primo tentativo avviene subito
        await vi.advanceTimersByTimeAsync(0);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Avanza 100ms: parte il secondo tentativo (delay1 = 100ms)
        await vi.advanceTimersByTimeAsync(100);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Avanza 200ms: parte il terzo tentativo (delay2 = 100 * 2 = 200ms)
        await vi.advanceTimersByTimeAsync(200);
        expect(mockFetch).toHaveBeenCalledTimes(3);

        // Dopo tutti i retry la promise rigetta
        await expect(promise).rejects.toThrow();
    });
});
