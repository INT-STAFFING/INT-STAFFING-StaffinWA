/**
 * @file allocationUtils.ts
 * @description Utility pure per la gestione delle allocazioni della griglia di staffing.
 */
import type { Allocation, AllocationUpdate, Project } from '../types';
import { parseISODate, toISODateString } from './dateUtils';

/** Stato progetto che ne determina l'esclusione permanente dalla griglia di Staffing. */
export const COMPLETED_PROJECT_STATUS = 'Completato';

/**
 * I progetti "Completato" non devono mai comparire nella griglia di Staffing:
 * non hanno più bisogno di pianificazione delle risorse.
 */
export const isProjectVisibleInStaffing = (project: Pick<Project, 'status'> | undefined | null): boolean =>
    project?.status !== COMPLETED_PROJECT_STATUS;

/**
 * Determina se una riga di assegnazione va mostrata nella griglia di Staffing.
 *
 * - Se l'assegnazione ha un'allocazione > 0 in un punto qualsiasi del tempo → sempre
 *   mostrata: è staffing reale e nasconderla farebbe sembrare persi i dati (anche se
 *   le giornate allocate cadono fuori dal periodo attualmente visibile).
 * - Se non ha mai ricevuto alcuna percentuale (0% ovunque) → mostrata solo se
 *   `showZeroAllocation` è true (di default nascoste, attivabile dall'utente).
 */
export const shouldShowAssignmentInStaffing = (
    assignmentAllocations: Record<string, number> | undefined,
    showZeroAllocation: boolean
): boolean => {
    if (assignmentAllocations) {
        for (const dateStr in assignmentAllocations) {
            if (assignmentAllocations[dateStr] > 0) return true;
        }
    }
    return showZeroAllocation;
};

/**
 * Costruisce lo "snapshot" dei valori di allocazione **attuali** per i giorni
 * lavorativi (lun–ven) compresi nell'intervallo [startDate, endDate] per una data
 * assegnazione. È la base dell'undo dell'assegnazione massiva (R-A3): applicando
 * questo snapshot si ripristinano i valori precedenti, comprese le celle che erano
 * vuote (percentuale 0 → rimozione).
 *
 * Salta sabato e domenica, coerentemente con `bulkUpdateAllocations`.
 */
export const buildAllocationSnapshot = (
    assignmentId: string,
    startDate: string,
    endDate: string,
    allocations: Allocation
): AllocationUpdate[] => {
    const start = parseISODate(startDate);
    const end = parseISODate(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start.getTime() > end.getTime()) {
        return [];
    }
    const snapshot: AllocationUpdate[] = [];
    const curr = new Date(start.getTime());
    let safety = 0;
    while (curr.getTime() <= end.getTime() && safety < 5000) {
        const day = curr.getUTCDay();
        if (day !== 0 && day !== 6) {
            const d = toISODateString(curr);
            snapshot.push({ assignmentId, date: d, percentage: allocations[assignmentId]?.[d] ?? 0 });
        }
        curr.setUTCDate(curr.getUTCDate() + 1);
        safety++;
    }
    return snapshot;
};
