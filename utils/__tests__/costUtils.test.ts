/**
 * @file utils/__tests__/costUtils.test.ts
 * @description Test delle funzioni di calcolo costi (getRoleCostForDate, calculateSegmentCost).
 */
import { describe, it, expect } from 'vitest';
import { getRoleCostForDate, calculateSegmentCost } from '../costUtils';
import type { Role, RoleCostHistory } from '../../types';

// ---------------------------------------------------------------------------
// Dati di supporto
// ---------------------------------------------------------------------------
const roles: Role[] = [
    { id: 'r1', name: 'Senior Dev', dailyCost: 600, seniorityLevel: 'Senior' },
    { id: 'r2', name: 'Junior Dev', dailyCost: 300, seniorityLevel: 'Junior' },
];

const history: RoleCostHistory[] = [
    { id: 'h1', roleId: 'r1', dailyCost: 500, startDate: '2023-01-01', endDate: '2023-12-31' },
    { id: 'h2', roleId: 'r1', dailyCost: 550, startDate: '2024-01-01', endDate: '2024-06-30' },
    { id: 'h3', roleId: 'r1', dailyCost: 600, startDate: '2024-07-01', endDate: null },
];

// ---------------------------------------------------------------------------
// getRoleCostForDate
// ---------------------------------------------------------------------------
describe('getRoleCostForDate', () => {
    it('trova il costo storico corretto per una data nel 2023', () => {
        expect(getRoleCostForDate('r1', '2023-06-15', history, roles)).toBe(500);
    });

    it('trova il costo storico corretto per una data nel primo semestre 2024', () => {
        expect(getRoleCostForDate('r1', '2024-03-01', history, roles)).toBe(550);
    });

    it('trova il costo storico con endDate null (ancora valido)', () => {
        expect(getRoleCostForDate('r1', '2025-01-01', history, roles)).toBe(600);
    });

    it('usa il costo corrente del ruolo come fallback se nessun record storico corrisponde', () => {
        // r1 non ha record per il 2022 (prima del 2023)
        expect(getRoleCostForDate('r1', '2022-01-01', history, roles)).toBe(600);
    });

    it('restituisce 0 se il ruolo non esiste né in history né in roles', () => {
        expect(getRoleCostForDate('unknown-role', '2024-01-01', history, roles)).toBe(0);
    });

    it('accetta un oggetto Date oltre a una stringa', () => {
        const date = new Date('2023-06-15T12:00:00Z');
        expect(getRoleCostForDate('r1', date, history, roles)).toBe(500);
    });

    it('usa il costo del ruolo corrente come fallback quando history è vuota', () => {
        expect(getRoleCostForDate('r2', '2024-01-01', [], roles)).toBe(300);
    });

    it('trova il costo esattamente alla data di inizio del record storico', () => {
        expect(getRoleCostForDate('r1', '2024-01-01', history, roles)).toBe(550);
    });

    it('trova il costo esattamente alla data di fine del record storico', () => {
        expect(getRoleCostForDate('r1', '2024-06-30', history, roles)).toBe(550);
    });
});

// ---------------------------------------------------------------------------
// calculateSegmentCost
// ---------------------------------------------------------------------------
describe('calculateSegmentCost', () => {
    // Tutti i giorni sono lavorativi (semplificazione)
    const allWorkingDays = () => true;
    // Nessun giorno è lavorativo
    const noWorkingDays = () => false;

    it('calcola il costo corretto per 5 giorni al 100% con costo 500', () => {
        // 5 giorni lavorativi * 100% * 500 = 2500
        const start = new Date('2023-01-02');
        const end = new Date('2023-01-06');
        const cost = calculateSegmentCost(start, end, 'r1', history, roles, 100, allWorkingDays);
        expect(cost).toBe(2500);
    });

    it('calcola il costo corretto al 50%', () => {
        // 1 giorno al 50% * 500 = 250
        const d = new Date('2023-06-15');
        const cost = calculateSegmentCost(d, d, 'r1', history, roles, 50, allWorkingDays);
        expect(cost).toBe(250);
    });

    it('restituisce 0 se nessun giorno è lavorativo', () => {
        const start = new Date('2024-01-06'); // sabato
        const end = new Date('2024-01-07');   // domenica
        expect(calculateSegmentCost(start, end, 'r1', history, roles, 100, noWorkingDays)).toBe(0);
    });

    it('gestisce un singolo giorno', () => {
        const d = new Date('2024-03-01');
        const cost = calculateSegmentCost(d, d, 'r1', history, roles, 100, allWorkingDays);
        expect(cost).toBe(550);
    });

    it('restituisce 0 se start > end', () => {
        const start = new Date('2024-01-10');
        const end = new Date('2024-01-05');
        expect(calculateSegmentCost(start, end, 'r1', history, roles, 100, allWorkingDays)).toBe(0);
    });
});
