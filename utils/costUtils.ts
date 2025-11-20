
/**
 * @file utils/costUtils.ts
 * @description Funzioni di utilità per il calcolo dei costi basato sullo storico (SCD Type 2).
 */

import { RoleCostHistory, Role } from '../types';

/**
 * Restituisce il costo giornaliero di un ruolo valido per una data specifica.
 * Utilizza la tabella storica per trovare il costo corretto nel passato.
 * Se non trova un record storico, ritorna il costo attuale del ruolo.
 * 
 * @param roleId - L'ID del ruolo.
 * @param date - La data di interesse (oggetto Date o stringa YYYY-MM-DD).
 * @param history - L'array completo dello storico costi.
 * @param currentRoles - L'array dei ruoli correnti (fallback).
 * @returns Il costo giornaliero (number).
 */
export const getRoleCostForDate = (
    roleId: string, 
    date: Date | string, 
    history: RoleCostHistory[], 
    currentRoles: Role[]
): number => {
    const targetDateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

    // Cerca nello storico
    const historicRecord = history.find(h => {
        if (h.roleId !== roleId) return false;
        const start = h.startDate;
        const end = h.endDate;
        
        // Logic: startDate <= targetDate <= endDate (if endDate exists)
        // Se endDate è null, significa che è ancora valido (fino a oggi/futuro prossimo)
        return targetDateStr >= start && (!end || targetDateStr <= end);
    });

    if (historicRecord) {
        return Number(historicRecord.dailyCost);
    }

    // Fallback al ruolo corrente se non c'è storico (es. data futura oltre l'ultimo record o buco dati)
    const role = currentRoles.find(r => r.id === roleId);
    return role ? Number(role.dailyCost) : 0;
};

/**
 * Calcola il costo totale di un'allocazione su un intervallo di date, sommando il costo specifico di ogni giorno.
 * Questo è necessario perché il costo del ruolo potrebbe cambiare nel mezzo dell'assegnazione.
 * 
 * @param startDate - Inizio intervallo.
 * @param endDate - Fine intervallo.
 * @param roleId - ID del ruolo.
 * @param history - Storico costi.
 * @param currentRoles - Ruoli correnti.
 * @param allocationPercentage - Percentuale di allocazione (es. 50, 100). Se varia per giorno, questa funzione non è adatta.
 * @param isWorkingDayFn - Funzione che ritorna true se un giorno è lavorativo.
 * @returns Costo totale.
 */
export const calculateSegmentCost = (
    startDate: Date,
    endDate: Date,
    roleId: string,
    history: RoleCostHistory[],
    currentRoles: Role[],
    allocationPercentage: number,
    isWorkingDayFn: (date: Date) => boolean
): number => {
    let totalCost = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
        if (isWorkingDayFn(current)) {
            const dailyRate = getRoleCostForDate(roleId, current, history, currentRoles);
            totalCost += (allocationPercentage / 100) * dailyRate;
        }
        current.setDate(current.getDate() + 1);
    }

    return totalCost;
};