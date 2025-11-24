
/**
 * @file dateUtils.ts
 * @description Funzioni di utilità per la manipolazione e formattazione delle date.
 */
import { CalendarEvent, LeaveRequest, LeaveType } from '../types';

/**
 * Aggiunge o sottrae un numero specificato di giorni a una data.
 * @param {Date} date - La data di partenza.
 * @param {number} days - Il numero di giorni da aggiungere (può essere negativo per sottrarre).
 * @returns {Date} Una nuova istanza di Date con il calcolo applicato.
 */
export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

/**
 * Restituisce un array di date consecutive a partire da una data specificata.
 * @param {Date} startDate - La data da cui iniziare a contare.
 * @param {number} count - Il numero di giorni da restituire.
 * @returns {Date[]} Un array di oggetti Date.
 */
export const getCalendarDays = (startDate: Date, count: number): Date[] => {
    const days: Date[] = [];
    let currentDate = new Date(startDate);
    while (days.length < count) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
};

/**
 * Controlla se una data specifica è un giorno festivo o di chiusura aziendale.
 * @param {Date} date - La data da controllare.
 * @param {string | null} resourceLocation - La sede della risorsa, per controllare le festività locali.
 * @param {CalendarEvent[]} companyCalendar - L'array di eventi del calendario aziendale.
 * @returns {boolean} True se la data è un giorno non lavorativo, altrimenti false.
 */
export const isHoliday = (date: Date, resourceLocation: string | null, companyCalendar: CalendarEvent[]): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return companyCalendar.some(event => {
        if (event.date !== dateStr) return false;
        if (event.type === 'NATIONAL_HOLIDAY' || event.type === 'COMPANY_CLOSURE') return true;
        if (event.type === 'LOCAL_HOLIDAY' && event.location === resourceLocation) return true;
        return false;
    });
};


/**
 * Calcola il numero di giorni lavorativi (lunedì-venerdì, escluse festività) tra due date (inclusive).
 * @param {Date} startDate - La data di inizio.
 * @param {Date} endDate - La data di fine.
 * @param {CalendarEvent[]} companyCalendar - L'array di eventi del calendario per escludere i giorni non lavorativi.
 * @param {string | null} [resourceLocation=null] - (Opzionale) La sede per considerare anche le festività locali.
 * @returns {number} Il numero totale di giorni lavorativi.
 */
export const getWorkingDaysBetween = (startDate: Date, endDate: Date, companyCalendar: CalendarEvent[], resourceLocation: string | null = null): number => {
    let count = 0;
    const currentDate = new Date(startDate.getTime());
    // Ensure we don't mutate the original dates or enter infinite loops if dates are invalid
    if (isNaN(currentDate.getTime()) || isNaN(endDate.getTime())) return 0;
    
    // Safety break for extremely long ranges
    let safetyCounter = 0;
    
    while (currentDate <= endDate && safetyCounter < 10000) {
        const dayOfWeek = currentDate.getDay();
        const isNonWorkingDay = dayOfWeek === 0 || dayOfWeek === 6 || isHoliday(currentDate, resourceLocation, companyCalendar);
        if (!isNonWorkingDay) {
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
        safetyCounter++;
    }
    return count;
}

/**
 * Calcola quanti giorni lavorativi sono consumati da un'assenza in un determinato periodo.
 * Interseca il periodo dell'assenza con il periodo richiesto e sottrae weekend/festivi.
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

    const leaveStart = new Date(leave.startDate);
    const leaveEnd = new Date(leave.endDate);

    // Calcola l'intersezione tra il periodo richiesto e il periodo di ferie
    const start = new Date(Math.max(periodStart.getTime(), leaveStart.getTime()));
    const end = new Date(Math.min(periodEnd.getTime(), leaveEnd.getTime()));

    // Se non c'è sovrapposizione
    if (start > end) return 0;

    // Se è una mezza giornata, conta sempre 0.5, indipendentemente dall'intervallo (dato che start == end per definizione)
    // Ma solo se il giorno stesso è lavorativo.
    if (leave.isHalfDay) {
        const workingDays = getWorkingDaysBetween(start, end, companyCalendar, resourceLocation);
        return workingDays > 0 ? 0.5 : 0;
    }

    // Conta i giorni lavorativi nel periodo di sovrapposizione
    return getWorkingDaysBetween(start, end, companyCalendar, resourceLocation);
};

/**
 * Formatta una data nel formato standard europeo completo GG/MM/AAAA.
 * Forza l'interpretazione manuale per garantire il formato esatto.
 * @param {Date | string | null | undefined} date - La data da formattare.
 * @returns {string} La data formattata es. "31/12/2024" o "N/A" se nulla/invalida.
 */
export const formatDateFull = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    
    let d: Date;
    let isUtc = false;

    if (typeof date === 'string') {
        // Se è una stringa YYYY-MM-DD pura, la trattiamo come UTC per evitare shift di fuso orario
        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            d = new Date(date);
            isUtc = true;
        } else {
            d = new Date(date);
        }
    } else {
        d = date;
    }

    if (isNaN(d.getTime())) return 'N/A';
    
    // Estrazione manuale componenti per formato DD/MM/YYYY
    const day = isUtc ? d.getUTCDate() : d.getDate();
    const month = isUtc ? d.getUTCMonth() + 1 : d.getMonth() + 1;
    const year = isUtc ? d.getUTCFullYear() : d.getFullYear();

    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
};

/**
 * Formatta una data nel formato sintetico GG/MM.
 * @param {Date | string | null | undefined} date - La data da formattare.
 * @returns {string} La data formattata es. "31/12" o "N/A".
 */
export const formatDateSynthetic = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    
    let d: Date;
    let isUtc = false;

    if (typeof date === 'string') {
        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            d = new Date(date);
            isUtc = true;
        } else {
            d = new Date(date);
        }
    } else {
        d = date;
    }

    if (isNaN(d.getTime())) return 'N/A';
    
    const day = isUtc ? d.getUTCDate() : d.getDate();
    const month = isUtc ? d.getUTCMonth() + 1 : d.getMonth() + 1;

    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

/**
 * Formatta un oggetto Date in una stringa secondo il formato specificato.
 * @param {Date} date - L'oggetto Date da formattare.
 * @param {'iso' | 'short' | 'day' | 'full'} format - Il formato desiderato:
 *   'iso': "YYYY-MM-DD"
 *   'short': "DD/MM/AAAA" (Standard Europeo)
 *   'day': "Lun", "Mar", etc.
 *   'full': "DD/MM/AAAA"
 * @returns {string} La data formattata come stringa.
 */
export const formatDate = (date: Date, format: 'iso' | 'short' | 'day' | 'full'): string => {
    if (format === 'iso') {
        return date.toISOString().split('T')[0];
    }
    if (format === 'day') {
        return date.toLocaleDateString('it-IT', { weekday: 'short' });
    }
    if (format === 'full' || format === 'short') {
        return formatDateFull(date);
    }
    return date.toLocaleDateString('it-IT');
};
