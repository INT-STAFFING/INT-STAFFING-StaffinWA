/**
 * @file allocationUtils.test.ts
 * @description Test per lo snapshot delle allocazioni usato dall'undo
 * dell'assegnazione massiva (R-A3).
 */
import { describe, it, expect } from 'vitest';
import { buildAllocationSnapshot, isProjectVisibleInStaffing, shouldShowAssignmentInStaffing } from './allocationUtils';
import type { Allocation } from '../types';

describe('buildAllocationSnapshot (R-A3 undo)', () => {
    const allocations: Allocation = {
        a1: {
            '2024-06-03': 50, // lunedì
            '2024-06-05': 30, // mercoledì
            // 2024-06-04 (martedì) assente → 0
        },
    };

    it('cattura solo i giorni lavorativi (esclude sab/dom)', () => {
        // 2024-06-03 lun → 2024-06-09 dom
        const snap = buildAllocationSnapshot('a1', '2024-06-03', '2024-06-09', allocations);
        const dates = snap.map(s => s.date);
        expect(dates).toEqual(['2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07']);
        // niente sabato 08 / domenica 09
        expect(dates).not.toContain('2024-06-08');
        expect(dates).not.toContain('2024-06-09');
    });

    it('registra i valori precedenti, con 0 per le celle vuote', () => {
        const snap = buildAllocationSnapshot('a1', '2024-06-03', '2024-06-05', allocations);
        expect(snap).toEqual([
            { assignmentId: 'a1', date: '2024-06-03', percentage: 50 },
            { assignmentId: 'a1', date: '2024-06-04', percentage: 0 },
            { assignmentId: 'a1', date: '2024-06-05', percentage: 30 },
        ]);
    });

    it('usa 0 per un assignment senza allocazioni note', () => {
        const snap = buildAllocationSnapshot('sconosciuto', '2024-06-03', '2024-06-04', allocations);
        expect(snap).toEqual([
            { assignmentId: 'sconosciuto', date: '2024-06-03', percentage: 0 },
            { assignmentId: 'sconosciuto', date: '2024-06-04', percentage: 0 },
        ]);
    });

    it('range invalido o invertito → snapshot vuoto', () => {
        expect(buildAllocationSnapshot('a1', '2024-06-10', '2024-06-03', allocations)).toEqual([]);
        expect(buildAllocationSnapshot('a1', 'invalid', '2024-06-03', allocations)).toEqual([]);
    });

    it('un solo giorno feriale', () => {
        const snap = buildAllocationSnapshot('a1', '2024-06-05', '2024-06-05', allocations);
        expect(snap).toEqual([{ assignmentId: 'a1', date: '2024-06-05', percentage: 30 }]);
    });
});

describe('isProjectVisibleInStaffing', () => {
    it('nasconde i progetti con stato "Completato"', () => {
        expect(isProjectVisibleInStaffing({ status: 'Completato' })).toBe(false);
    });

    it('mostra i progetti con qualsiasi altro stato', () => {
        expect(isProjectVisibleInStaffing({ status: 'In corso' })).toBe(true);
        expect(isProjectVisibleInStaffing({ status: 'In pausa' })).toBe(true);
        expect(isProjectVisibleInStaffing({ status: null })).toBe(true);
    });

    it('mostra per riferimento a progetto mancante (fail-open sulla ricerca, non sul filtro stato)', () => {
        expect(isProjectVisibleInStaffing(undefined)).toBe(true);
    });
});

describe('shouldShowAssignmentInStaffing', () => {
    it('nasconde di default un\'assegnazione senza alcuna allocazione registrata (0%)', () => {
        expect(shouldShowAssignmentInStaffing(undefined, false)).toBe(false);
    });

    it('mostra un\'assegnazione a 0% quando il toggle utente è attivo', () => {
        expect(shouldShowAssignmentInStaffing(undefined, true)).toBe(true);
    });

    it('mostra sempre un\'assegnazione con allocazione > 0, a prescindere dal toggle', () => {
        const allocs = { '2024-06-04': 50 };
        expect(shouldShowAssignmentInStaffing(allocs, false)).toBe(true);
        expect(shouldShowAssignmentInStaffing(allocs, true)).toBe(true);
    });

    it('mostra un\'assegnazione con allocazioni > 0 anche lontane nel tempo (lo staffing reale non deve mai sparire dalla griglia)', () => {
        const allocs = { '2030-01-07': 50 };
        expect(shouldShowAssignmentInStaffing(allocs, false)).toBe(true);
    });

    it('tratta un oggetto allocazioni presente ma tutto a 0 come assegnazione a 0%, soggetta al toggle', () => {
        const allocs = { '2024-06-04': 0 };
        expect(shouldShowAssignmentInStaffing(allocs, false)).toBe(false);
        expect(shouldShowAssignmentInStaffing(allocs, true)).toBe(true);
    });
});
