/**
 * @file utils/dateUtils.test.ts
 * @description Test unitari per le funzioni di utilità sulle date.
 * Verifica il corretto comportamento UTC, la gestione dei fusi orari,
 * il calcolo dei giorni lavorativi e le funzioni di formattazione.
 */
import { describe, it, expect } from 'vitest';
import {
    parseISODate,
    toISODateString,
    addDays,
    getCalendarDays,
    isHoliday,
    getWorkingDaysBetween,
    getLeaveDurationInWorkingDays,
    formatDateFull,
    formatDateSynthetic,
    formatDate,
} from './dateUtils';
import type { CalendarEvent, LeaveRequest, LeaveType } from '../types';

// ---------------------------------------------------------------------------
// parseISODate
// ---------------------------------------------------------------------------
describe('parseISODate', () => {
    it('converte una stringa YYYY-MM-DD in Date UTC mezzanotte', () => {
        const d = parseISODate('2024-03-15');
        expect(d.getUTCFullYear()).toBe(2024);
        expect(d.getUTCMonth()).toBe(2); // 0-indexed
        expect(d.getUTCDate()).toBe(15);
        expect(d.getUTCHours()).toBe(0);
        expect(d.getUTCMinutes()).toBe(0);
    });

    it('ignora la parte orario se presente (ISO 8601 con T)', () => {
        const d = parseISODate('2024-06-01T12:30:00Z');
        expect(d.getUTCFullYear()).toBe(2024);
        expect(d.getUTCMonth()).toBe(5);
        expect(d.getUTCDate()).toBe(1);
    });

    it('gestisce correttamente i mesi di inizio/fine anno', () => {
        const jan = parseISODate('2023-01-01');
        expect(jan.getUTCMonth()).toBe(0);
        expect(jan.getUTCDate()).toBe(1);

        const dec = parseISODate('2023-12-31');
        expect(dec.getUTCMonth()).toBe(11);
        expect(dec.getUTCDate()).toBe(31);
    });

    it('restituisce una data valida per input null/undefined', () => {
        const d1 = parseISODate(null);
        const d2 = parseISODate(undefined);
        expect(d1).toBeInstanceOf(Date);
        expect(d2).toBeInstanceOf(Date);
    });

    it('restituisce una data valida per stringa vuota', () => {
        const d = parseISODate('');
        expect(d).toBeInstanceOf(Date);
    });
});

// ---------------------------------------------------------------------------
// toISODateString
// ---------------------------------------------------------------------------
describe('toISODateString', () => {
    it('converte una Date UTC in YYYY-MM-DD', () => {
        const d = new Date(Date.UTC(2024, 2, 15)); // 15 marzo 2024
        expect(toISODateString(d)).toBe('2024-03-15');
    });

    it('esegue il round-trip con parseISODate', () => {
        const original = '2025-11-30';
        const date = parseISODate(original);
        expect(toISODateString(date)).toBe(original);
    });

    it('effettua il padding corretto per mesi e giorni a singola cifra', () => {
        const d = new Date(Date.UTC(2024, 0, 5)); // 5 gennaio 2024
        expect(toISODateString(d)).toBe('2024-01-05');
    });

    it('restituisce stringa vuota per Date non valide', () => {
        expect(toISODateString(new Date('invalid'))).toBe('');
    });

    it('restituisce stringa vuota per null/undefined', () => {
        expect(toISODateString(null)).toBe('');
        expect(toISODateString(undefined)).toBe('');
    });
});

// ---------------------------------------------------------------------------
// addDays
// ---------------------------------------------------------------------------
describe('addDays', () => {
    it('aggiunge giorni positivi a una data', () => {
        const start = new Date(Date.UTC(2024, 0, 28)); // 28 gen
        const result = addDays(start, 5);
        expect(toISODateString(result)).toBe('2024-02-02');
    });

    it('gestisce i giorni negativi (sottrae)', () => {
        const start = new Date(Date.UTC(2024, 1, 1)); // 1 feb
        const result = addDays(start, -5);
        expect(toISODateString(result)).toBe('2024-01-27');
    });

    it('non muta la data originale', () => {
        const start = new Date(Date.UTC(2024, 0, 1));
        addDays(start, 10);
        expect(toISODateString(start)).toBe('2024-01-01');
    });

    it('attraversa correttamente il cambio d\'anno', () => {
        const dec30 = new Date(Date.UTC(2023, 11, 30));
        const result = addDays(dec30, 3);
        expect(toISODateString(result)).toBe('2024-01-02');
    });
});

// ---------------------------------------------------------------------------
// getCalendarDays
// ---------------------------------------------------------------------------
describe('getCalendarDays', () => {
    it('restituisce il numero corretto di giorni consecutivi', () => {
        const start = parseISODate('2024-01-01');
        const days = getCalendarDays(start, 5);
        expect(days).toHaveLength(5);
        expect(toISODateString(days[0])).toBe('2024-01-01');
        expect(toISODateString(days[4])).toBe('2024-01-05');
    });

    it('restituisce array vuoto per count = 0', () => {
        const start = parseISODate('2024-01-01');
        expect(getCalendarDays(start, 0)).toHaveLength(0);
    });

    it('gestisce i mesi attraverso i confini', () => {
        const start = parseISODate('2024-01-30');
        const days = getCalendarDays(start, 4);
        expect(toISODateString(days[3])).toBe('2024-02-02');
    });

    it('ogni elemento è mezzanotte UTC', () => {
        const start = parseISODate('2024-06-01');
        const days = getCalendarDays(start, 3);
        days.forEach(d => {
            expect(d.getUTCHours()).toBe(0);
            expect(d.getUTCMinutes()).toBe(0);
        });
    });
});

// ---------------------------------------------------------------------------
// isHoliday
// ---------------------------------------------------------------------------
describe('isHoliday', () => {
    const calendar: CalendarEvent[] = [
        { id: '1', name: 'Natale', date: '2024-12-25', type: 'NATIONAL_HOLIDAY', location: null },
        { id: '2', name: 'Chiusura aziendale', date: '2024-08-15', type: 'COMPANY_CLOSURE', location: null },
        { id: '3', name: 'Festa locale Milano', date: '2024-12-07', type: 'LOCAL_HOLIDAY', location: 'Milano' },
    ];

    it('riconosce una NATIONAL_HOLIDAY', () => {
        expect(isHoliday(parseISODate('2024-12-25'), null, calendar)).toBe(true);
    });

    it('riconosce una COMPANY_CLOSURE', () => {
        expect(isHoliday(parseISODate('2024-08-15'), null, calendar)).toBe(true);
    });

    it('riconosce una LOCAL_HOLIDAY per la location corretta', () => {
        expect(isHoliday(parseISODate('2024-12-07'), 'Milano', calendar)).toBe(true);
    });

    it('non riconosce una LOCAL_HOLIDAY per una location diversa', () => {
        expect(isHoliday(parseISODate('2024-12-07'), 'Roma', calendar)).toBe(false);
    });

    it('restituisce false per un giorno normale', () => {
        expect(isHoliday(parseISODate('2024-03-15'), null, calendar)).toBe(false);
    });

    it('funziona con calendario vuoto', () => {
        expect(isHoliday(parseISODate('2024-12-25'), null, [])).toBe(false);
    });

    it('gestisce eventi con data come stringa ISO con timestamp', () => {
        const calWithTimestamp: CalendarEvent[] = [
            { id: '4', name: 'Pasqua', date: '2024-03-31T00:00:00.000Z', type: 'NATIONAL_HOLIDAY', location: null },
        ];
        expect(isHoliday(parseISODate('2024-03-31'), null, calWithTimestamp)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// getWorkingDaysBetween
// ---------------------------------------------------------------------------
describe('getWorkingDaysBetween', () => {
    const emptyCalendar: CalendarEvent[] = [];

    it('conta i giorni lavorativi di una settimana standard (lun-ven)', () => {
        // Settimana 6-10 gen 2025 (lun-ven)
        const start = parseISODate('2025-01-06');
        const end = parseISODate('2025-01-10');
        expect(getWorkingDaysBetween(start, end, emptyCalendar)).toBe(5);
    });

    it('esclude sabato e domenica', () => {
        // 4-6 gen 2025 (sab, dom, lun)
        const start = parseISODate('2025-01-04');
        const end = parseISODate('2025-01-06');
        expect(getWorkingDaysBetween(start, end, emptyCalendar)).toBe(1);
    });

    it('restituisce 0 per un intervallo di un solo weekend', () => {
        const sat = parseISODate('2025-01-04');
        const sun = parseISODate('2025-01-05');
        expect(getWorkingDaysBetween(sat, sun, emptyCalendar)).toBe(0);
    });

    it('restituisce 1 per start === end su un giorno lavorativo', () => {
        const mon = parseISODate('2025-01-06'); // lunedì
        expect(getWorkingDaysBetween(mon, mon, emptyCalendar)).toBe(1);
    });

    it('esclude le festività nazionali', () => {
        const calendar: CalendarEvent[] = [
            { id: '1', name: 'Natale', date: '2024-12-25', type: 'NATIONAL_HOLIDAY', location: null },
        ];
        // 23-27 dic 2024 (lun-ven), 25 dic è Natale
        const start = parseISODate('2024-12-23');
        const end = parseISODate('2024-12-27');
        expect(getWorkingDaysBetween(start, end, calendar)).toBe(4);
    });

    it('restituisce 0 per date non valide', () => {
        expect(getWorkingDaysBetween(new Date('invalid'), new Date('invalid'), emptyCalendar)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// getLeaveDurationInWorkingDays
// ---------------------------------------------------------------------------
describe('getLeaveDurationInWorkingDays', () => {
    const emptyCalendar: CalendarEvent[] = [];
    const leaveTypeCapacity: LeaveType = {
        name: 'Ferie',
        color: '#FF0000',
        requiresApproval: true,
        affectsCapacity: true,
    };
    const leaveTypeNoCapacity: LeaveType = {
        name: 'Permesso',
        color: '#00FF00',
        requiresApproval: false,
        affectsCapacity: false,
    };

    const baseLeave: LeaveRequest = {
        resourceId: 'r1',
        typeId: 'lt1',
        startDate: '2025-01-06', // lunedì
        endDate: '2025-01-10',   // venerdì
        status: 'APPROVED',
    };

    it('calcola la durata per un\'assenza approvata che incide sulla capacità', () => {
        const period = { start: parseISODate('2025-01-01'), end: parseISODate('2025-01-31') };
        const duration = getLeaveDurationInWorkingDays(
            period.start, period.end, baseLeave, leaveTypeCapacity, emptyCalendar, null
        );
        expect(duration).toBe(5);
    });

    it('restituisce 0 se il tipo non incide sulla capacità', () => {
        const period = { start: parseISODate('2025-01-01'), end: parseISODate('2025-01-31') };
        const duration = getLeaveDurationInWorkingDays(
            period.start, period.end, baseLeave, leaveTypeNoCapacity, emptyCalendar, null
        );
        expect(duration).toBe(0);
    });

    it('restituisce 0 se l\'assenza non è APPROVED', () => {
        const period = { start: parseISODate('2025-01-01'), end: parseISODate('2025-01-31') };
        const pendingLeave: LeaveRequest = { ...baseLeave, status: 'PENDING' };
        const duration = getLeaveDurationInWorkingDays(
            period.start, period.end, pendingLeave, leaveTypeCapacity, emptyCalendar, null
        );
        expect(duration).toBe(0);
    });

    it('calcola l\'intersezione parziale tra assenza e periodo', () => {
        // Periodo: solo i primi 3 giorni della settimana (lun-mer)
        const period = { start: parseISODate('2025-01-06'), end: parseISODate('2025-01-08') };
        const duration = getLeaveDurationInWorkingDays(
            period.start, period.end, baseLeave, leaveTypeCapacity, emptyCalendar, null
        );
        expect(duration).toBe(3);
    });

    it('restituisce 0 se assenza e periodo non si sovrappongono', () => {
        const period = { start: parseISODate('2025-02-01'), end: parseISODate('2025-02-28') };
        const duration = getLeaveDurationInWorkingDays(
            period.start, period.end, baseLeave, leaveTypeCapacity, emptyCalendar, null
        );
        expect(duration).toBe(0);
    });

    it('restituisce 0.5 per mezza giornata', () => {
        // Assenza di mezza giornata su un solo lunedì
        const halfDayLeave: LeaveRequest = {
            ...baseLeave,
            startDate: '2025-01-06',
            endDate: '2025-01-06',
            isHalfDay: true,
        };
        const period = { start: parseISODate('2025-01-01'), end: parseISODate('2025-01-31') };
        const duration = getLeaveDurationInWorkingDays(
            period.start, period.end, halfDayLeave, leaveTypeCapacity, emptyCalendar, null
        );
        expect(duration).toBe(0.5);
    });

    it('restituisce 0 se il leaveType è undefined', () => {
        const period = { start: parseISODate('2025-01-01'), end: parseISODate('2025-01-31') };
        const duration = getLeaveDurationInWorkingDays(
            period.start, period.end, baseLeave, undefined, emptyCalendar, null
        );
        expect(duration).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// formatDateFull
// ---------------------------------------------------------------------------
describe('formatDateFull', () => {
    it('formatta una data UTC come DD/MM/YYYY', () => {
        const d = new Date(Date.UTC(2024, 2, 5)); // 5 marzo
        expect(formatDateFull(d)).toBe('05/03/2024');
    });

    it('formatta una stringa YYYY-MM-DD', () => {
        expect(formatDateFull('2024-12-31')).toBe('31/12/2024');
    });

    it('restituisce N/A per null/undefined', () => {
        expect(formatDateFull(null)).toBe('N/A');
        expect(formatDateFull(undefined)).toBe('N/A');
    });

    it('esegue il padding corretto per giorno e mese a singola cifra', () => {
        expect(formatDateFull('2024-01-05')).toBe('05/01/2024');
    });
});

// ---------------------------------------------------------------------------
// formatDateSynthetic
// ---------------------------------------------------------------------------
describe('formatDateSynthetic', () => {
    it('formatta come GG/MM', () => {
        expect(formatDateSynthetic('2024-07-04')).toBe('04/07');
    });

    it('restituisce N/A per null/undefined', () => {
        expect(formatDateSynthetic(null)).toBe('N/A');
        expect(formatDateSynthetic(undefined)).toBe('N/A');
    });

    it('esegue il padding corretto', () => {
        expect(formatDateSynthetic('2024-01-09')).toBe('09/01');
    });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
    const d = new Date(Date.UTC(2025, 3, 7)); // 7 aprile 2025 (lunedì)

    it('modalità iso restituisce YYYY-MM-DD', () => {
        expect(formatDate(d, 'iso')).toBe('2025-04-07');
    });

    it('modalità short restituisce DD/MM/YYYY', () => {
        expect(formatDate(d, 'short')).toBe('07/04/2025');
    });

    it('modalità day restituisce il nome abbreviato del giorno in italiano', () => {
        const result = formatDate(d, 'day');
        // Il lunedì in italiano è 'lun'
        expect(result.toLowerCase()).toContain('lun');
    });

    it('modalità full restituisce DD/MM/YYYY', () => {
        expect(formatDate(d, 'full')).toBe('07/04/2025');
    });
});
