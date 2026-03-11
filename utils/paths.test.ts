/**
 * @file utils/paths.test.ts
 * @description Test unitari per normalizePath.
 */
import { describe, it, expect } from 'vitest';
import { normalizePath } from './paths';

describe('normalizePath', () => {
    it('restituisce "/" per la root', () => {
        expect(normalizePath('/')).toBe('/');
    });

    it('rimuove lo slash finale', () => {
        expect(normalizePath('/risorse/')).toBe('/risorse');
    });

    it('non altera un path già normalizzato', () => {
        expect(normalizePath('/risorse')).toBe('/risorse');
    });

    it('rimuove la query string', () => {
        expect(normalizePath('/risorse?editId=123')).toBe('/risorse');
    });

    it('rimuove query string e slash finale', () => {
        expect(normalizePath('/risorse/?editId=123')).toBe('/risorse');
    });

    it('gestisce path multi-segmento', () => {
        expect(normalizePath('/admin/settings')).toBe('/admin/settings');
    });

    it('gestisce stringa vuota restituendo "/"', () => {
        expect(normalizePath('')).toBe('/');
    });

    it('non altera path con underscore e trattini', () => {
        expect(normalizePath('/wbs-analysis')).toBe('/wbs-analysis');
    });
});
