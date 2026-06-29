/**
 * @file allocationUtils.ts
 * @description Utility pure per la gestione delle allocazioni della griglia di staffing.
 */
import type { Allocation, AllocationUpdate } from '../types';
import { parseISODate, toISODateString } from './dateUtils';

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
