
/**
 * @file utils/formatters.ts
 * @description Funzioni di utilità centralizzate per la formattazione dei dati (valuta, numeri, ecc.)
 */

/**
 * Formatta un numero come valuta Euro (EUR) con locale italiano (it-IT).
 * Gestisce numeri, stringhe numeriche, null e undefined.
 * 
 * @param {number | string | undefined | null} value - Il valore da formattare.
 * @returns {string} La stringa formattata (es. "1.234,56 €").
 */
export const formatCurrency = (value: number | string | undefined | null): string => {
    const numValue = Number(value);
    // Se il valore non è un numero valido o è nullo/undefined, restituisci 0,00 €
    return (isNaN(numValue) ? 0 : numValue).toLocaleString('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};
