
/**
 * @file dateUtils.ts
 * @description Funzioni di utilità per la manipolazione e formattazione delle date.
 * 
 * CRITICAL: Tutte le funzioni qui definite trattano le date come "Pure Dates" (YYYY-MM-DD).
 * Per evitare bug di fuso orario (off-by-one), le istanze di `Date` vengono create e lette 
 * esclusivamente utilizzando i metodi UTC (Date.UTC, getUTCFullYear, ecc.).
 * 
 * Non utilizzare mai metodi locali (getDate, getMonth) su oggetti destinati a rappresentare date pure.
 */
import { CalendarEvent, LeaveRequest, LeaveType } from '../types';

/**
 * Converte una stringa 'YYYY-MM-DD' in un oggetto Date impostato alla mezzanotte UTC.
 * @param dateStr Stringa data YYYY-MM-DD
 */
export const parseISODate = (dateStr: string | null | undefined): Date => {
    if (!dateStr) return new Date(); // Fallback to now (imperfect but safe for strict TS)
    
    // Gestione robusta input
    const cleanStr = dateStr.split('T')[0];
    const [year, month, day] = cleanStr.split('-').map(Number);
    
    if (!year || isNaN(month) || !day) return new Date();

    // Crea la data in UTC puro (Mese è 0-indexed)
    return new Date(Date.UTC(year, month - 1, day));
};

/**
 * Converte un oggetto Date in una stringa 'YYYY-MM-DD' usando i componenti UTC.
 * @param date Oggetto Date
 */
export const toISODateString = (date: Date | null | undefined): string => {
    if (!date || isNaN(date.getTime())) return '';
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Aggiunge giorni a una data in modo sicuro (UTC).
 */
export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date.getTime());
    result.setUTCDate(result.getUTCDate() + days);
    return result;
};

/**
 * Restituisce array di date consecutive (UTC).
 */
export const getCalendarDays = (startDate: Date, count: number): Date[] => {
    const days: Date[] = [];
    let currentDate = new Date(startDate.getTime());
    // Normalizza a mezzanotte UTC per sicurezza se l'input non lo era
    currentDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));

    for (let i = 0; i < count; i++) {
        days.push(new Date(currentDate));
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return days;
};

/**
 * Controlla se è vacanza (usa confronto stringhe YYYY-MM-DD per massima sicurezza).
 */
export const isHoliday = (date: Date, resourceLocation: string | null, companyCalendar: CalendarEvent[]): boolean => {
    const dateStr = toISODateString(date);
    
    return companyCalendar.some(event => {
        // Normalizza la data dell'evento (potrebbe arrivare come stringa o Date dal context)
        const eventDateStr = typeof event.date === 'string' ? event.date.split('T')[0] : toISODateString(event.date);
        
        if (eventDateStr !== dateStr) return false;
        if (event.type === 'NATIONAL_HOLIDAY' || event.type === 'COMPANY_CLOSURE') return true;
        if (event.type === 'LOCAL_HOLIDAY' && event.location === resourceLocation) return true;
        return false;
    });
};

/**
 * Calcola giorni lavorativi tra due date (inclusive).
 */
export const getWorkingDaysBetween = (
    startDate: Date, 
    endDate: Date, 
    companyCalendar: CalendarEvent[], 
    resourceLocation: string | null = null
): number => {
    // Normalizzazione UTC iniziale
    let current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
    
    if (isNaN(current.getTime()) || isNaN(end.getTime())) return 0;
    
    let count = 0;
    let safety = 0;
    
    while (current.getTime() <= end.getTime() && safety < 5000) {
        const dayOfWeek = current.getUTCDay(); // 0 = Sun, 6 = Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        if (!isWeekend && !isHoliday(current, resourceLocation, companyCalendar)) {
            count++;
        }
        
        current.setUTCDate(current.getUTCDate() + 1);
        safety++;
    }
    return count;
};

/**
 * Calcola durata assenza in giorni lavorativi.
 */
export const getLeaveDurationInWorkingDays = (
    periodStart: Date,
    periodEnd: Date,
    leave: LeaveRequest,
    leaveType: LeaveType | undefined,
    companyCalendar: CalendarEvent[],
    resourceLocation: string | null
): number => {
    if (!leaveType?.affectsCapacity || leave.status !== 'APPROVED') return 0;

    const leaveStart = parseISODate(leave.startDate);
    const leaveEnd = parseISODate(leave.endDate);

    // Intersezione periodi
    const start = new Date(Math.max(periodStart.getTime(), leaveStart.getTime()));
    const end = new Date(Math.min(periodEnd.getTime(), leaveEnd.getTime()));

    if (start > end) return 0;

    if (leave.isHalfDay) {
        const workingDays = getWorkingDaysBetween(start, end, companyCalendar, resourceLocation);
        return workingDays > 0 ? 0.5 : 0;
    }

    return getWorkingDaysBetween(start, end, companyCalendar, resourceLocation);
};

/**
 * Formatta Data -> DD/MM/YYYY
 */
export const formatDateFull = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    
    const d = typeof date === 'string' ? parseISODate(date) : date;
    if (isNaN(d.getTime())) return 'N/A';
    
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();

    return `${day}/${month}/${year}`;
};

/**
 * Formatta Data -> GG/MM
 */
export const formatDateSynthetic = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? parseISODate(date) : date;
    if (isNaN(d.getTime())) return 'N/A';
    
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');

    return `${day}/${month}`;
};

/**
 * Formatter generico.
 * @param format 'iso' (YYYY-MM-DD) | 'short' (DD/MM/YYYY) | 'day' (Lun) | 'full'
 */
export const formatDate = (date: Date, format: 'iso' | 'short' | 'day' | 'full'): string => {
    if (format === 'iso') {
        return toISODateString(date);
    }
    if (format === 'day') {
        // Per il nome del giorno, possiamo usare toLocaleDateString ma dobbiamo assicurarci
        // che la data non shifta. Usiamo UTC per settare le ore a 12:00 per sicurezza locale.
        const safeDate = new Date(date.getTime());
        safeDate.setUTCHours(12, 0, 0, 0); 
        return safeDate.toLocaleDateString('it-IT', { weekday: 'short', timeZone: 'UTC' });
    }
    return formatDateFull(date);
};
