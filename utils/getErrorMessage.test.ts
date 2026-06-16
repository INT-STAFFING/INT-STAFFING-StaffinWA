/**
 * @file utils/getErrorMessage.test.ts
 * @description Test per getErrorMessage: estrazione del messaggio da valori catch.
 */
import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './getErrorMessage';

describe('getErrorMessage', () => {
    it('restituisce il message di un Error', () => {
        expect(getErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('restituisce stringa vuota per un Error senza messaggio', () => {
        expect(getErrorMessage(new Error())).toBe('');
    });

    it('gestisce le sottoclassi di Error', () => {
        class CustomError extends Error {}
        expect(getErrorMessage(new CustomError('custom'))).toBe('custom');
    });

    it('converte a stringa un valore non-Error (string)', () => {
        expect(getErrorMessage('errore semplice')).toBe('errore semplice');
    });

    it('converte a stringa un valore non-Error (number)', () => {
        expect(getErrorMessage(42)).toBe('42');
    });

    it('gestisce null e undefined', () => {
        expect(getErrorMessage(null)).toBe('null');
        expect(getErrorMessage(undefined)).toBe('undefined');
    });

    it('preserva la semantica del fallback (Error con messaggio vuoto è falsy)', () => {
        // Pattern usato nel codebase: getErrorMessage(e) || 'fallback'
        expect(getErrorMessage(new Error('')) || 'fallback').toBe('fallback');
        expect(getErrorMessage(new Error('reale')) || 'fallback').toBe('reale');
    });
});
