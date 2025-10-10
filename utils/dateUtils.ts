/**
 * @file dateUtils.ts
 * @description Funzioni di utilità per la manipolazione e formattazione delle date.
 */
import { CalendarEvent } from '../types';

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
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const isNonWorkingDay = dayOfWeek === 0 || dayOfWeek === 6 || isHoliday(currentDate, resourceLocation, companyCalendar);
        if (!isNonWorkingDay) {
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
}

/**
 * Formatta un oggetto Date in una stringa secondo il formato specificato.
 * @param {Date} date - L'oggetto Date da formattare.
 * @param {'iso' | 'short' | 'day'} format - Il formato desiderato:
 *   'iso': "YYYY-MM-DD"
 *   'short': "DD/MM" (formato italiano)
 *   'day': "Lun", "Mar", etc. (giorno della settimana abbreviato in italiano)
 * @returns {string} La data formattata come stringa.
 */
export const formatDate = (date: Date, format: 'iso' | 'short' | 'day'): string => {
    if (format === 'iso') {
        return date.toISOString().split('T')[0];
    }
    if (format === 'short') {
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    }
    if (format === 'day') {
        return date.toLocaleDateString('it-IT', { weekday: 'short' });
    }
    return date.toString();
};