
/**
 * @file services/apiClient.ts
 * @description Client API con intercettore per ambiente di Preview locale.
 */

import { mockFetch } from './mockHandlers';
import { INITIAL_MOCK_DATA } from './mockData';

export interface ApiClientOptions {
    retries?: number;
    retryDelayMs?: number;
    backoffFactor?: number;
    authStrategy?: 'bearer' | 'none' | ((token: string | null) => HeadersInit);
    tokenProvider?: () => string | null;
}

const defaultTokenProvider = () => (typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null);

const resolveAuthHeaders = (strategy: ApiClientOptions['authStrategy'], token: string | null): HeadersInit => {
    if (strategy === 'none') return {};
    if (typeof strategy === 'function') return strategy(token);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Rileva se l'applicazione sta girando in un ambiente di Preview o di sviluppo.
 * Esteso per coprire le sandbox di Google AI Studio e Vercel.
 */
const isLocalPreview = () => {
  if (typeof window === 'undefined') return false;
  
  const h = window.location.hostname;
  const p = window.location.port;

  // Se l'host contiene questi termini o ha una porta non standard, siamo in preview
  return (
    h === 'localhost' || 
    h === '127.0.0.1' || 
    p !== '' && p !== '80' && p !== '443' || 
    h.includes('webcontainer') || 
    h.includes('stackblitz') || 
    h.includes('vercel-preview') ||
    h.includes('google-ai-studio') ||
    h.includes('usercontent.goog') || // Sandbox Google
    h.includes('googleusercontent.com') ||
    h.includes('internal') ||
    !h.includes('.') // Intranet/Local hosts
  );
};

/**
 * Funzione fetch potenziata per interagire con le API dell'applicazione.
 * Intercetta TUTTE le chiamate /api in ambiente Preview e le devia al Mock Engine.
 */
export const apiFetch = async <T = unknown>(url: string, options: RequestInit = {}, clientOptions: ApiClientOptions = {}): Promise<T> => {
    // LOGICA DI INTERCETTAZIONE MOCK (PREVIEW)
    if (isLocalPreview()) {
        try {
            console.log(`[Preview Mode] Intercepting: ${url}`);
            return await mockFetch(url, options) as T;
        } catch (e) {
            console.error(`[Mock Engine Error] ${url}:`, e);
            // Fallback d'emergenza: restituiamo dati coerenti per non bloccare l'UI
            if (url.includes('/api/data')) return INITIAL_MOCK_DATA as unknown as T;
            if (url.includes('notifications') || Array.isArray(INITIAL_MOCK_DATA)) return [] as unknown as T;
            return {} as T;
        }
    }

    // LOGICA API REALE (PRODUZIONE)
    const {
        retries = 3,
        retryDelayMs = 500,
        backoffFactor = 2,
        authStrategy = 'bearer',
        tokenProvider = defaultTokenProvider,
    } = clientOptions;

    const token = tokenProvider();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...resolveAuthHeaders(authStrategy, token),
        ...options.headers,
    };

    let attempt = 0;
    let delay = retryDelayMs;

    while (true) {
        try {
            const response = await fetch(url, { ...options, headers });

            if (response.status === 204) return null as T;

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const errorMessage = (errorBody as { error?: string }).error || `API request failed: ${response.status}`;
                const error = new Error(errorMessage) as Error & { isClientError?: boolean; status?: number };
                error.status = response.status;

                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    error.isClientError = true;
                    throw error;
                }
                throw error;
            }

            return await response.json();
        } catch (error) {
            const typedError = error as Error & { isClientError?: boolean };
            if (typedError.isClientError || attempt >= retries) throw typedError;
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt += 1;
            delay *= backoffFactor;
        }
    }
};
