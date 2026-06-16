/**
 * @file utils/formatters.test.ts
 * @description Suite consolidata dei test unitari per le funzioni di formattazione dati.
 * Fusione delle due suite precedentemente duplicate (co-locata + __tests__):
 * suite A e suite B usano asserzioni differenti, mantenute in blocchi separati
 * per preservare tutti i casi senza perdita di copertura.
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatters';

// ===========================================================================
// SUITE A (originariamente utils/formatters.test.ts)
// ===========================================================================
describe('formatCurrency (suite A)', () => {
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

// ===========================================================================
// SUITE B (originariamente utils/__tests__/formatters.test.ts)
// ===========================================================================
describe('formatCurrency (suite B)', () => {
    it('formatta un numero intero positivo', () => {
        const result = formatCurrency(1234);
        // Formato italiano: 1.234,00 €
        expect(result).toContain('1');
        expect(result).toContain('234');
        expect(result).toContain('€');
    });

    it('formatta un numero con decimali', () => {
        const result = formatCurrency(1234.56);
        expect(result).toContain('1');
        expect(result).toContain('234');
        expect(result).toContain('56');
        expect(result).toContain('€');
    });

    it('formatta zero come 0,00 €', () => {
        const result = formatCurrency(0);
        expect(result).toContain('0');
        expect(result).toContain('€');
    });

    it('formatta numeri negativi', () => {
        const result = formatCurrency(-500);
        expect(result).toContain('500');
        expect(result).toContain('€');
        // Il locale italiano include il segno meno
        expect(result).toContain('-');
    });

    it('formatta una stringa numerica', () => {
        const result = formatCurrency('2500');
        expect(result).toContain('2');
        expect(result).toContain('500');
        expect(result).toContain('€');
    });

    it('tratta null come 0', () => {
        const result = formatCurrency(null);
        expect(result).toContain('0');
        expect(result).toContain('€');
    });

    it('tratta undefined come 0', () => {
        const result = formatCurrency(undefined);
        expect(result).toContain('0');
        expect(result).toContain('€');
    });

    it('tratta stringa non numerica come 0', () => {
        const result = formatCurrency('abc');
        expect(result).toContain('0');
        expect(result).toContain('€');
    });

    it('ha sempre 2 cifre decimali', () => {
        // 1000 deve mostrare ,00
        const result = formatCurrency(1000);
        expect(result).toMatch(/00/);
    });

    it('non arrotonda in modo errato valori con 2 decimali', () => {
        const result = formatCurrency(9.99);
        expect(result).toContain('9');
        expect(result).toContain('99');
    });
});
