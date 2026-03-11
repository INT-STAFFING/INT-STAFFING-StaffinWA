/**
 * @file utils/__tests__/dateUtils.test.ts
 * @description Test delle funzioni di utilità per la manipolazione delle date.
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
} from '../dateUtils';
import type { CalendarEvent, LeaveRequest, LeaveType } from '../../types';

// ---------------------------------------------------------------------------
// parseISODate
// ---------------------------------------------------------------------------
describe('parseISODate', () => {
    it('converte una stringa YYYY-MM-DD in Date UTC', () => {
        const d = parseISODate('2024-03-15');
        expect(d.getUTCFullYear()).toBe(2024);
        expect(d.getUTCMonth()).toBe(2); // marzo = 2 (0-indexed)
        expect(d.getUTCDate()).toBe(15);
    });

    it('ignora la parte temporale (T) se presente', () => {
        const d = parseISODate('2024-06-01T12:30:00Z');
        expect(d.getUTCFullYear()).toBe(2024);
        expect(d.getUTCMonth()).toBe(5);
        expect(d.getUTCDate()).toBe(1);
    });

    it('restituisce Date corrente per input null', () => {
        const before = Date.now();
        const d = parseISODate(null);
        expect(d.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('restituisce Date corrente per input undefined', () => {
        const before = Date.now();
        const d = parseISODate(undefined);
        expect(d.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('gestisce correttamente il primo gennaio', () => {
        const d = parseISODate('2023-01-01');
        expect(d.getUTCFullYear()).toBe(2023);
        expect(d.getUTCMonth()).toBe(0);
        expect(d.getUTCDate()).toBe(1);
    });

    it('gestisce il 31 dicembre', () => {
        const d = parseISODate('2023-12-31');
        expect(d.getUTCFullYear()).toBe(2023);
        expect(d.getUTCMonth()).toBe(11);
        expect(d.getUTCDate()).toBe(31);
    });
});

// ---------------------------------------------------------------------------
// toISODateString
// ---------------------------------------------------------------------------
describe('toISODateString', () => {
    it('converte una Date UTC in stringa YYYY-MM-DD', () => {
        const d = new Date(Date.UTC(2024, 5, 15)); // 2024-06-15
        expect(toISODateString(d)).toBe('2024-06-15');
    });

    it('aggiunge il padding per mesi e giorni a singola cifra', () => {
        const d = new Date(Date.UTC(2024, 0, 5)); // 2024-01-05
        expect(toISODateString(d)).toBe('2024-01-05');
    });

    it('restituisce stringa vuota per null', () => {
        expect(toISODateString(null)).toBe('');
    });

    it('restituisce stringa vuota per undefined', () => {
        expect(toISODateString(undefined)).toBe('');
    });

    it('restituisce stringa vuota per Date non valida', () => {
        expect(toISODateString(new Date('invalid'))).toBe('');
    });
});

// ---------------------------------------------------------------------------
// Round-trip parseISODate <-> toISODateString
// ---------------------------------------------------------------------------
describe('round-trip parseISODate / toISODateString', () => {
    it('mantiene la data invariata dopo round-trip', () => {
        const dateStr = '2025-11-20';
        expect(toISODateString(parseISODate(dateStr))).toBe(dateStr);
    });
});

// ---------------------------------------------------------------------------
// addDays
// ---------------------------------------------------------------------------
describe('addDays', () => {
    it('aggiunge giorni positivi', () => {
        const start = new Date(Date.UTC(2024, 0, 1));
        const result = addDays(start, 10);
        expect(toISODateString(result)).toBe('2024-01-11');
    });

    it('sottrae giorni con valore negativo', () => {
        const start = new Date(Date.UTC(2024, 0, 15));
        const result = addDays(start, -5);
        expect(toISODateString(result)).toBe('2024-01-10');
    });

    it('aggiunge 0 giorni non modifica la data', () => {
        const start = new Date(Date.UTC(2024, 5, 1));
        const result = addDays(start, 0);
        expect(toISODateString(result)).toBe('2024-06-01');
    });

    it('attraversa il cambio di mese correttamente', () => {
        const start = new Date(Date.UTC(2024, 0, 30)); // 30 gen
        const result = addDays(start, 3);
        expect(toISODateString(result)).toBe('2024-02-02');
    });

    it('non muta la data originale', () => {
        const start = new Date(Date.UTC(2024, 0, 1));
        addDays(start, 5);
        expect(toISODateString(start)).toBe('2024-01-01');
    });
});

// ---------------------------------------------------------------------------
// getCalendarDays
// ---------------------------------------------------------------------------
describe('getCalendarDays', () => {
    it('restituisce il numero corretto di giorni', () => {
        const start = new Date(Date.UTC(2024, 0, 1));
        const days = getCalendarDays(start, 5);
        expect(days.length).toBe(5);
    });

    it('il primo giorno corrisponde alla data iniziale', () => {
        const start = new Date(Date.UTC(2024, 2, 1));
        const days = getCalendarDays(start, 3);
        expect(toISODateString(days[0])).toBe('2024-03-01');
    });

    it('i giorni sono consecutivi', () => {
        const start = new Date(Date.UTC(2024, 0, 29));
        const days = getCalendarDays(start, 5);
        expect(toISODateString(days[0])).toBe('2024-01-29');
        expect(toISODateString(days[1])).toBe('2024-01-30');
        expect(toISODateString(days[2])).toBe('2024-01-31');
        expect(toISODateString(days[3])).toBe('2024-02-01');
        expect(toISODateString(days[4])).toBe('2024-02-02');
    });

    it('restituisce array vuoto con count=0', () => {
        const start = new Date(Date.UTC(2024, 0, 1));
        expect(getCalendarDays(start, 0)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// isHoliday
// ---------------------------------------------------------------------------
describe('isHoliday', () => {
    const calendar: CalendarEvent[] = [
        { id: '1', date: '2024-12-25', name: 'Natale', type: 'NATIONAL_HOLIDAY', location: null },
        { id: '2', date: '2024-12-26', name: 'Santo Stefano', type: 'NATIONAL_HOLIDAY', location: null },
        { id: '3', date: '2024-08-15', name: 'Ferragosto aziendale', type: 'COMPANY_CLOSURE', location: null },
        { id: '4', date: '2024-04-23', name: 'San Giorgio', type: 'LOCAL_HOLIDAY', location: 'Barcelona' },
    ];

    it('riconosce una festività nazionale', () => {
        const d = parseISODate('2024-12-25');
        expect(isHoliday(d, null, calendar)).toBe(true);
    });

    it('riconosce una chiusura aziendale', () => {
        const d = parseISODate('2024-08-15');
        expect(isHoliday(d, null, calendar)).toBe(true);
    });

    it('riconosce festività locale per la location corretta', () => {
        const d = parseISODate('2024-04-23');
        expect(isHoliday(d, 'Barcelona', calendar)).toBe(true);
    });

    it('ignora festività locale per location diversa', () => {
        const d = parseISODate('2024-04-23');
        expect(isHoliday(d, 'Milano', calendar)).toBe(false);
    });

    it('restituisce false per un giorno normale', () => {
        const d = parseISODate('2024-03-15');
        expect(isHoliday(d, null, calendar)).toBe(false);
    });

    it('gestisce il calendario vuoto', () => {
        const d = parseISODate('2024-12-25');
        expect(isHoliday(d, null, [])).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getWorkingDaysBetween
// ---------------------------------------------------------------------------
describe('getWorkingDaysBetween', () => {
    const emptyCalendar: CalendarEvent[] = [];

    it('conta solo i giorni feriali in una settimana completa (lun-dom)', () => {
        // 2024-01-08 è lunedì, 2024-01-14 è domenica
        const start = parseISODate('2024-01-08');
        const end = parseISODate('2024-01-14');
        expect(getWorkingDaysBetween(start, end, emptyCalendar)).toBe(5);
    });

    it('ritorna 1 per un singolo giorno lavorativo', () => {
        const d = parseISODate('2024-01-08'); // lunedì
        expect(getWorkingDaysBetween(d, d, emptyCalendar)).toBe(1);
    });

    it('ritorna 0 per un weekend', () => {
        const sat = parseISODate('2024-01-06');
        const sun = parseISODate('2024-01-07');
        expect(getWorkingDaysBetween(sat, sun, emptyCalendar)).toBe(0);
    });

    it('esclude le festività nazionali', () => {
        const calendar: CalendarEvent[] = [
            { id: '1', date: '2024-01-08', name: 'Festività test', type: 'NATIONAL_HOLIDAY', location: null },
        ];
        // Settimana lun-ven con lunedì festivo => 4 giorni
        const start = parseISODate('2024-01-08');
        const end = parseISODate('2024-01-12');
        expect(getWorkingDaysBetween(start, end, calendar)).toBe(4);
    });

    it('ritorna 0 se start > end', () => {
        const start = parseISODate('2024-01-15');
        const end = parseISODate('2024-01-10');
        expect(getWorkingDaysBetween(start, end, emptyCalendar)).toBe(0);
    });

    it('gestisce un mese intero (gennaio 2024: 23 giorni lavorativi)', () => {
        const start = parseISODate('2024-01-01');
        const end = parseISODate('2024-01-31');
        // Gen 2024: 1 (lun), 2 (mar), 3 (mer), 4 (gio), 5 (ven) = 5
        //          8-12 = 5, 15-19 = 5, 22-26 = 5, 29-31 = 3 => totale = 23
        expect(getWorkingDaysBetween(start, end, emptyCalendar)).toBe(23);
    });
});

// ---------------------------------------------------------------------------
// getLeaveDurationInWorkingDays
// ---------------------------------------------------------------------------
describe('getLeaveDurationInWorkingDays', () => {
    const emptyCalendar: CalendarEvent[] = [];
    const leaveType: LeaveType = { id: 'lt1', name: 'Ferie', affectsCapacity: true, color: '#4caf50', requiresApproval: true };
    const noCapacityLeaveType: LeaveType = { id: 'lt2', name: 'Permesso Formazione', affectsCapacity: false, color: '#2196f3', requiresApproval: false };

    const baseLeave: LeaveRequest = {
        id: 'lr1',
        resourceId: 'r1',
        typeId: 'lt1',
        startDate: '2024-01-08',
        endDate: '2024-01-12',
        status: 'APPROVED',
        isHalfDay: false,
    };

    it('calcola i giorni lavorativi di un\'assenza approvata', () => {
        const period = { start: parseISODate('2024-01-01'), end: parseISODate('2024-01-31') };
        const days = getLeaveDurationInWorkingDays(
            period.start, period.end, baseLeave, leaveType, emptyCalendar, null
        );
        expect(days).toBe(5);
    });

    it('ritorna 0 per assenza non approvata', () => {
        const pending: LeaveRequest = { ...baseLeave, status: 'PENDING' };
        const period = { start: parseISODate('2024-01-01'), end: parseISODate('2024-01-31') };
        expect(getLeaveDurationInWorkingDays(period.start, period.end, pending, leaveType, emptyCalendar, null)).toBe(0);
    });

    it('ritorna 0 per tipo assenza che non impatta capacità', () => {
        const period = { start: parseISODate('2024-01-01'), end: parseISODate('2024-01-31') };
        expect(getLeaveDurationInWorkingDays(period.start, period.end, baseLeave, noCapacityLeaveType, emptyCalendar, null)).toBe(0);
    });

    it('calcola 0.5 per assenza mezza giornata', () => {
        const halfDay: LeaveRequest = {
            ...baseLeave,
            startDate: '2024-01-08',
            endDate: '2024-01-08',
            isHalfDay: true,
        };
        const period = { start: parseISODate('2024-01-01'), end: parseISODate('2024-01-31') };
        expect(getLeaveDurationInWorkingDays(period.start, period.end, halfDay, leaveType, emptyCalendar, null)).toBe(0.5);
    });

    it('rispetta l\'intersezione con il periodo di analisi', () => {
        // Assenza 1-15 gen, periodo 8-12 gen => 5 giorni lavorativi
        const period = { start: parseISODate('2024-01-08'), end: parseISODate('2024-01-12') };
        const leave: LeaveRequest = { ...baseLeave, startDate: '2024-01-01', endDate: '2024-01-31' };
        expect(getLeaveDurationInWorkingDays(period.start, period.end, leave, leaveType, emptyCalendar, null)).toBe(5);
    });

    it('ritorna 0 se il periodo non si sovrappone all\'assenza', () => {
        const period = { start: parseISODate('2024-02-01'), end: parseISODate('2024-02-28') };
        expect(getLeaveDurationInWorkingDays(period.start, period.end, baseLeave, leaveType, emptyCalendar, null)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// formatDateFull
// ---------------------------------------------------------------------------
describe('formatDateFull', () => {
    it('formatta correttamente una data come DD/MM/YYYY', () => {
        const d = new Date(Date.UTC(2024, 2, 5)); // 5 marzo 2024
        expect(formatDateFull(d)).toBe('05/03/2024');
    });

    it('accetta una stringa YYYY-MM-DD', () => {
        expect(formatDateFull('2024-12-25')).toBe('25/12/2024');
    });

    it('restituisce N/A per null', () => {
        expect(formatDateFull(null)).toBe('N/A');
    });

    it('restituisce N/A per undefined', () => {
        expect(formatDateFull(undefined)).toBe('N/A');
    });
});

// ---------------------------------------------------------------------------
// formatDateSynthetic
// ---------------------------------------------------------------------------
describe('formatDateSynthetic', () => {
    it('formatta correttamente come DD/MM', () => {
        expect(formatDateSynthetic('2024-07-04')).toBe('04/07');
    });

    it('restituisce N/A per null', () => {
        expect(formatDateSynthetic(null)).toBe('N/A');
    });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
    const d = new Date(Date.UTC(2024, 5, 15)); // 2024-06-15

    it('format iso restituisce YYYY-MM-DD', () => {
        expect(formatDate(d, 'iso')).toBe('2024-06-15');
    });

    it('format short restituisce DD/MM/YYYY', () => {
        expect(formatDate(d, 'short')).toBe('15/06/2024');
    });

    it('format full restituisce DD/MM/YYYY', () => {
        expect(formatDate(d, 'full')).toBe('15/06/2024');
    });

    it('format day restituisce abbreviazione giorno in italiano', () => {
        // 2024-06-15 è sabato
        const day = formatDate(d, 'day');
        expect(typeof day).toBe('string');
        expect(day.length).toBeGreaterThan(0);
    });
});
