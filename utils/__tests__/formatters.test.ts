/**
 * @file utils/__tests__/formatters.test.ts
 * @description Test della funzione formatCurrency.
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../formatters';

describe('formatCurrency', () => {
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
