/* @vitest-environment jsdom */
/**
 * @file utils/__tests__/auth.test.ts
 * @description Test della funzione getStoredAuthToken.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getStoredAuthToken } from '../auth';

describe('getStoredAuthToken', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('restituisce null se authToken non è presente', () => {
        expect(getStoredAuthToken()).toBeNull();
    });

    it('restituisce il token se presente in localStorage', () => {
        localStorage.setItem('authToken', 'eyJhbGciOiJIUzI1NiJ9.test.token');
        expect(getStoredAuthToken()).toBe('eyJhbGciOiJIUzI1NiJ9.test.token');
    });

    it('restituisce il token aggiornato dopo una modifica', () => {
        localStorage.setItem('authToken', 'token-v1');
        expect(getStoredAuthToken()).toBe('token-v1');

        localStorage.setItem('authToken', 'token-v2');
        expect(getStoredAuthToken()).toBe('token-v2');
    });

    it('restituisce null dopo la rimozione del token', () => {
        localStorage.setItem('authToken', 'some-token');
        localStorage.removeItem('authToken');
        expect(getStoredAuthToken()).toBeNull();
    });
});
