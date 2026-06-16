/**
 * @file utils/costUtils.test.ts
 * @description Suite consolidata dei test unitari per le funzioni di calcolo dei costi (SCD Type 2).
 * Fusione delle due suite precedentemente duplicate (co-locata + __tests__):
 * la suite A e la suite B usano fixture differenti (id ruolo `role-*` vs `r*` e
 * history divergenti), mantenute localmente in blocchi `describe` separati per
 * preservare tutti i casi senza perdita di copertura.
 * Verifica il recupero del costo storico per data e il calcolo del costo totale
 * su un intervallo con allocazione percentuale variabile.
 */
import { describe, it, expect } from 'vitest';
import { getRoleCostForDate, calculateSegmentCost } from './costUtils';
import type { RoleCostHistory, Role } from '../types';

// ===========================================================================
// SUITE A (originariamente utils/costUtils.test.ts)
// ===========================================================================

// ---------------------------------------------------------------------------
// Fixtures comuni
// ---------------------------------------------------------------------------
const roles: Role[] = [
    { id: 'role-1', name: 'Senior Dev', seniorityLevel: 'SENIOR', dailyCost: 600 },
    { id: 'role-2', name: 'Junior Dev', seniorityLevel: 'JUNIOR', dailyCost: 300 },
];

const history: RoleCostHistory[] = [
    // role-1: costo 500 nel 2023, poi 600 dal 2024 in avanti
    { id: 'h1', roleId: 'role-1', dailyCost: 500, startDate: '2023-01-01', endDate: '2023-12-31' },
    { id: 'h2', roleId: 'role-1', dailyCost: 600, startDate: '2024-01-01', endDate: null },
    // role-2: costo 280 nel 2023
    { id: 'h3', roleId: 'role-2', dailyCost: 280, startDate: '2023-01-01', endDate: '2023-12-31' },
];

// ---------------------------------------------------------------------------
// getRoleCostForDate
// ---------------------------------------------------------------------------
describe('getRoleCostForDate (suite A)', () => {
    it('restituisce il costo storico corretto per una data nel 2023', () => {
        expect(getRoleCostForDate('role-1', '2023-06-15', history, roles)).toBe(500);
    });

    it('restituisce il costo storico corretto per una data nel 2024 (endDate null)', () => {
        expect(getRoleCostForDate('role-1', '2024-03-20', history, roles)).toBe(600);
    });

    it('restituisce il costo storico per l\'esatta data di inizio periodo', () => {
        expect(getRoleCostForDate('role-1', '2023-01-01', history, roles)).toBe(500);
    });

    it('restituisce il costo storico per l\'esatta data di fine periodo', () => {
        expect(getRoleCostForDate('role-1', '2023-12-31', history, roles)).toBe(500);
    });

    it('usa il costo corrente del ruolo come fallback se non c\'è storico per la data', () => {
        // role-2 non ha storico per il 2024, deve fare fallback al valore corrente
        expect(getRoleCostForDate('role-2', '2024-06-01', history, roles)).toBe(300);
    });

    it('accetta un oggetto Date invece di una stringa', () => {
        const d = new Date(Date.UTC(2023, 5, 15)); // 15 giugno 2023
        expect(getRoleCostForDate('role-1', d, history, roles)).toBe(500);
    });

    it('restituisce 0 per un roleId inesistente (senza storico e senza ruolo corrente)', () => {
        expect(getRoleCostForDate('role-unknown', '2024-01-01', [], [])).toBe(0);
    });

    it('restituisce il costo del ruolo corrente se lo storico è vuoto', () => {
        expect(getRoleCostForDate('role-1', '2023-06-15', [], roles)).toBe(600);
    });
});

// ---------------------------------------------------------------------------
// calculateSegmentCost
// ---------------------------------------------------------------------------
describe('calculateSegmentCost (suite A)', () => {
    // Funzione helper: tutti i giorni lavorativi (esclude sab/dom)
    const isWorkingDay = (date: Date) => {
        const day = date.getUTCDay();
        return day !== 0 && day !== 6;
    };

    // Funzione helper: solo lun-mer lavorativi (per testare filtri personalizzati)
    const isMonWedOnly = (date: Date) => {
        const day = date.getUTCDay();
        return day === 1 || day === 3; // lun = 1, mer = 3
    };

    it('calcola il costo totale per una settimana intera (5 giorni lavorativi) al 100%', () => {
        // Settimana 6-10 gen 2025 (lun-ven), costo storico 600/giorno
        const start = new Date(Date.UTC(2025, 0, 6));
        const end = new Date(Date.UTC(2025, 0, 10));
        const cost = calculateSegmentCost(start, end, 'role-1', history, roles, 100, isWorkingDay);
        expect(cost).toBe(5 * 600); // 3000
    });

    it('applica correttamente la percentuale di allocazione', () => {
        const start = new Date(Date.UTC(2025, 0, 6));
        const end = new Date(Date.UTC(2025, 0, 10));
        const cost50 = calculateSegmentCost(start, end, 'role-1', history, roles, 50, isWorkingDay);
        expect(cost50).toBe(5 * 600 * 0.5); // 1500
    });

    it('restituisce 0 se nessun giorno è lavorativo', () => {
        // weekend 4-5 gen 2025
        const start = new Date(Date.UTC(2025, 0, 4));
        const end = new Date(Date.UTC(2025, 0, 5));
        const cost = calculateSegmentCost(start, end, 'role-1', history, roles, 100, isWorkingDay);
        expect(cost).toBe(0);
    });

    it('usa il costo storico per una data nel 2023', () => {
        // Lunedì 6 gen 2025: costo 600. Ma per il 2023 è 500
        // Prendiamo un solo giorno lavorativo nel 2023 (lun 2 gen 2023)
        const start = new Date(Date.UTC(2023, 0, 2)); // 2 gen 2023 (lunedì)
        const end = new Date(Date.UTC(2023, 0, 2));
        const cost = calculateSegmentCost(start, end, 'role-1', history, roles, 100, isWorkingDay);
        expect(cost).toBe(500);
    });

    it('calcola correttamente con una funzione isWorkingDay personalizzata', () => {
        // Settimana 6-10 gen 2025: solo lun (6) e mer (8) sono considerati lavorativi
        const start = new Date(Date.UTC(2025, 0, 6));
        const end = new Date(Date.UTC(2025, 0, 10));
        const cost = calculateSegmentCost(start, end, 'role-1', history, roles, 100, isMonWedOnly);
        expect(cost).toBe(2 * 600); // 1200 (solo lun e mer)
    });

    it('gestisce un intervallo con start === end su giorno lavorativo', () => {
        const monday = new Date(Date.UTC(2025, 0, 6));
        const cost = calculateSegmentCost(monday, monday, 'role-1', history, roles, 100, isWorkingDay);
        expect(cost).toBe(600);
    });
});

// ===========================================================================
// SUITE B (originariamente utils/__tests__/costUtils.test.ts)
// ===========================================================================

// ---------------------------------------------------------------------------
// Dati di supporto (fixture locali della suite B)
// ---------------------------------------------------------------------------
const rolesB: Role[] = [
    { id: 'r1', name: 'Senior Dev', dailyCost: 600, seniorityLevel: 'Senior' },
    { id: 'r2', name: 'Junior Dev', dailyCost: 300, seniorityLevel: 'Junior' },
];

const historyB: RoleCostHistory[] = [
    { id: 'h1', roleId: 'r1', dailyCost: 500, startDate: '2023-01-01', endDate: '2023-12-31' },
    { id: 'h2', roleId: 'r1', dailyCost: 550, startDate: '2024-01-01', endDate: '2024-06-30' },
    { id: 'h3', roleId: 'r1', dailyCost: 600, startDate: '2024-07-01', endDate: null },
];

// ---------------------------------------------------------------------------
// getRoleCostForDate
// ---------------------------------------------------------------------------
describe('getRoleCostForDate (suite B)', () => {
    it('trova il costo storico corretto per una data nel 2023', () => {
        expect(getRoleCostForDate('r1', '2023-06-15', historyB, rolesB)).toBe(500);
    });

    it('trova il costo storico corretto per una data nel primo semestre 2024', () => {
        expect(getRoleCostForDate('r1', '2024-03-01', historyB, rolesB)).toBe(550);
    });

    it('trova il costo storico con endDate null (ancora valido)', () => {
        expect(getRoleCostForDate('r1', '2025-01-01', historyB, rolesB)).toBe(600);
    });

    it('usa il costo corrente del ruolo come fallback se nessun record storico corrisponde', () => {
        // r1 non ha record per il 2022 (prima del 2023)
        expect(getRoleCostForDate('r1', '2022-01-01', historyB, rolesB)).toBe(600);
    });

    it('restituisce 0 se il ruolo non esiste né in history né in roles', () => {
        expect(getRoleCostForDate('unknown-role', '2024-01-01', historyB, rolesB)).toBe(0);
    });

    it('accetta un oggetto Date oltre a una stringa', () => {
        const date = new Date('2023-06-15T12:00:00Z');
        expect(getRoleCostForDate('r1', date, historyB, rolesB)).toBe(500);
    });

    it('usa il costo del ruolo corrente come fallback quando history è vuota', () => {
        expect(getRoleCostForDate('r2', '2024-01-01', [], rolesB)).toBe(300);
    });

    it('trova il costo esattamente alla data di inizio del record storico', () => {
        expect(getRoleCostForDate('r1', '2024-01-01', historyB, rolesB)).toBe(550);
    });

    it('trova il costo esattamente alla data di fine del record storico', () => {
        expect(getRoleCostForDate('r1', '2024-06-30', historyB, rolesB)).toBe(550);
    });
});

// ---------------------------------------------------------------------------
// calculateSegmentCost
// ---------------------------------------------------------------------------
describe('calculateSegmentCost (suite B)', () => {
    // Tutti i giorni sono lavorativi (semplificazione)
    const allWorkingDays = () => true;
    // Nessun giorno è lavorativo
    const noWorkingDays = () => false;

    it('calcola il costo corretto per 5 giorni al 100% con costo 500', () => {
        // 5 giorni lavorativi * 100% * 500 = 2500
        const start = new Date('2023-01-02');
        const end = new Date('2023-01-06');
        const cost = calculateSegmentCost(start, end, 'r1', historyB, rolesB, 100, allWorkingDays);
        expect(cost).toBe(2500);
    });

    it('calcola il costo corretto al 50%', () => {
        // 1 giorno al 50% * 500 = 250
        const d = new Date('2023-06-15');
        const cost = calculateSegmentCost(d, d, 'r1', historyB, rolesB, 50, allWorkingDays);
        expect(cost).toBe(250);
    });

    it('restituisce 0 se nessun giorno è lavorativo', () => {
        const start = new Date('2024-01-06'); // sabato
        const end = new Date('2024-01-07');   // domenica
        expect(calculateSegmentCost(start, end, 'r1', historyB, rolesB, 100, noWorkingDays)).toBe(0);
    });

    it('gestisce un singolo giorno', () => {
        const d = new Date('2024-03-01');
        const cost = calculateSegmentCost(d, d, 'r1', historyB, rolesB, 100, allWorkingDays);
        expect(cost).toBe(550);
    });

    it('restituisce 0 se start > end', () => {
        const start = new Date('2024-01-10');
        const end = new Date('2024-01-05');
        expect(calculateSegmentCost(start, end, 'r1', historyB, rolesB, 100, allWorkingDays)).toBe(0);
    });
});
