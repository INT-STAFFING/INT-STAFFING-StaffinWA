/**
 * @file utils/formatters.test.ts
 * @description Test unitari per le funzioni di formattazione dati.
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatters';

describe('formatCurrency', () => {
    it('formatta un numero intero in Euro (contiene simbolo € e il valore)', () => {
        const result = formatCurrency(1000);
        expect(result).toContain('€');
        // Verifica che il valore numerico sia presente (con o senza separatore migliaia)
        expect(result).toMatch(/1[.']?000/);
    });

    it('formatta un numero decimale con due cifre dopo la virgola', () => {
        const result = formatCurrency(1234.5);
        expect(result).toContain('€');
        // Verifica due decimali con separatore locale (virgola o punto a seconda dell'ambiente)
        expect(result).toMatch(/1[.']?234[,.]50/);
    });

    it('formatta zero come 0,00 €', () => {
        const result = formatCurrency(0);
        expect(result).toContain('0');
        expect(result).toContain('€');
        expect(result).toMatch(/0[,.]?00/);
    });

    it('formatta valori negativi', () => {
        const result = formatCurrency(-500);
        expect(result).toContain('500');
        expect(result).toContain('€');
    });

    it('gestisce una stringa numerica', () => {
        const result = formatCurrency('2500.75');
        expect(result).toContain('€');
        expect(result).toMatch(/2[.']?500[,.]75/);
    });

    it('gestisce null restituendo 0,00 €', () => {
        const result = formatCurrency(null);
        expect(result).toContain('€');
        expect(result).toMatch(/0[,.]?00/);
    });

    it('gestisce undefined restituendo 0,00 €', () => {
        const result = formatCurrency(undefined);
        expect(result).toContain('€');
        expect(result).toMatch(/0[,.]?00/);
    });

    it('gestisce una stringa non numerica restituendo 0,00 €', () => {
        const result = formatCurrency('non-un-numero');
        expect(result).toContain('€');
        expect(result).toMatch(/0[,.]?00/);
    });

    it('formatta numeri grandi contenendo il simbolo € e il valore', () => {
        const result = formatCurrency(1000000);
        expect(result).toContain('€');
        expect(result).toMatch(/1[.'\s]?000/);
    });
});
