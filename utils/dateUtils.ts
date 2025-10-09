/**
 * @file dateUtils.ts
 * @description Funzioni di utilità per la manipolazione e formattazione delle date.
 */

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
 * Restituisce un array di date corrispondenti ai prossimi giorni lavorativi (lunedì-venerdì)
 * a partire da una data specificata.
 * @param {Date} startDate - La data da cui iniziare a contare.
 * @param {number} count - Il numero di giorni lavorativi da restituire.
 * @returns {Date[]} Un array di oggetti Date.
 */
export const getWorkingDays = (startDate: Date, count: number): Date[] => {
    const days: Date[] = [];
    let currentDate = new Date(startDate);
    while (days.length < count) {
        const dayOfWeek = currentDate.getDay(); // 0 = Domenica, 6 = Sabato
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            days.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
};

/**
 * Calcola il numero di giorni lavorativi (lunedì-venerdì) tra due date (inclusive).
 * @param {Date} startDate - La data di inizio.
 * @param {Date} endDate - La data di fine.
 * @returns {number} Il numero totale di giorni lavorativi.
 */
export const getWorkingDaysBetween = (startDate: Date, endDate: Date): number => {
    let count = 0;
    const currentDate = new Date(startDate.getTime());
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
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