/* @vitest-environment jsdom */
/**
 * @file services/__tests__/apiClient.test.ts
 * @description Test della funzione isLocalPreview.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// Helper per sovrascrivere window.location con Object.defineProperty
const setLocation = (hostname: string, port: string) => {
    Object.defineProperty(window, 'location', {
        writable: true,
        value: { hostname, port },
    });
};

describe('isLocalPreview', () => {
    afterEach(() => {
        vi.resetModules();
    });

    const check = async (hostname: string, port: string): Promise<boolean> => {
        setLocation(hostname, port);
        const { isLocalPreview } = await import('../apiClient');
        return isLocalPreview();
    };

    it('restituisce true per localhost', async () => {
        expect(await check('localhost', '')).toBe(true);
    });

    it('restituisce true per 127.0.0.1', async () => {
        expect(await check('127.0.0.1', '')).toBe(true);
    });

    it('restituisce true per hostname con porta non standard', async () => {
        expect(await check('myapp.example.com', '3000')).toBe(true);
    });

    it('restituisce false per porta 80', async () => {
        expect(await check('myapp.example.com', '80')).toBe(false);
    });

    it('restituisce false per porta 443', async () => {
        expect(await check('myapp.example.com', '443')).toBe(false);
    });

    it('restituisce true per hostname stackblitz', async () => {
        expect(await check('myapp.stackblitz.io', '')).toBe(true);
    });

    it('restituisce true per hostname webcontainer', async () => {
        expect(await check('myapp.webcontainer.io', '')).toBe(true);
    });

    it('restituisce true per hostname senza punto (intranet)', async () => {
        expect(await check('intranetserver', '')).toBe(true);
    });

    it('restituisce false per hostname di produzione', async () => {
        expect(await check('staffing-app.vercel.app', '')).toBe(false);
    });

    it('restituisce true per hostname googleusercontent.com', async () => {
        expect(await check('abc.googleusercontent.com', '')).toBe(true);
    });
});
