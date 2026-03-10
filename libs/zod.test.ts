/**
 * @file libs/zod.test.ts
 * @description Test unitari per la libreria Zod custom lightweight.
 * Verifica il comportamento di tutti i tipi supportati, le validazioni,
 * optional/nullable, refine e safeParse.
 */
import { describe, it, expect } from 'vitest';
import { z, ZodError } from './zod';

// ---------------------------------------------------------------------------
// z.string()
// ---------------------------------------------------------------------------
describe('z.string()', () => {
    it('accetta una stringa valida', () => {
        const result = z.string().safeParse('ciao');
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe('ciao');
    });

    it('rifiuta un non-stringa', () => {
        const result = z.string().safeParse(42);
        expect(result.success).toBe(false);
    });

    it('rifiuta null', () => {
        const result = z.string().safeParse(null);
        expect(result.success).toBe(false);
    });

    it('min() rifiuta stringhe troppo corte', () => {
        const schema = z.string().min(5, 'Troppo corta');
        const result = schema.safeParse('abc');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Troppo corta');
        }
    });

    it('min() accetta stringhe sufficientemente lunghe', () => {
        const schema = z.string().min(3, 'Troppo corta');
        expect(schema.safeParse('ciao').success).toBe(true);
    });

    it('trim() rimuove gli spazi e poi applica min()', () => {
        const schema = z.string().trim().min(3, 'Troppo corta');
        expect(schema.safeParse('   ').success).toBe(false);
        expect(schema.safeParse('  abc  ').success).toBe(true);
    });

    it('optional() accetta undefined', () => {
        const schema = z.string().optional();
        const result = schema.safeParse(undefined);
        expect(result.success).toBe(true);
    });

    it('nullable() accetta null', () => {
        const schema = z.string().nullable();
        const result = schema.safeParse(null);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// z.number()
// ---------------------------------------------------------------------------
describe('z.number()', () => {
    it('accetta un numero valido', () => {
        const result = z.number().safeParse(42);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(42);
    });

    it('rifiuta una stringa', () => {
        expect(z.number().safeParse('42').success).toBe(false);
    });

    it('rifiuta NaN', () => {
        expect(z.number().safeParse(NaN).success).toBe(false);
    });

    it('min() rifiuta valori sotto il minimo', () => {
        const schema = z.number().min(0, 'Deve essere >= 0');
        expect(schema.safeParse(-1).success).toBe(false);
        expect(schema.safeParse(0).success).toBe(true);
    });

    it('max() rifiuta valori sopra il massimo', () => {
        const schema = z.number().max(100, 'Deve essere <= 100');
        expect(schema.safeParse(101).success).toBe(false);
        expect(schema.safeParse(100).success).toBe(true);
    });

    it('coerce converte una stringa numerica in number', () => {
        const result = z.coerce.number().safeParse('3.14');
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(3.14);
    });
});

// ---------------------------------------------------------------------------
// z.boolean()
// ---------------------------------------------------------------------------
describe('z.boolean()', () => {
    it('accetta true', () => {
        expect(z.boolean().safeParse(true).success).toBe(true);
    });

    it('accetta false', () => {
        expect(z.boolean().safeParse(false).success).toBe(true);
    });

    it('rifiuta una stringa', () => {
        expect(z.boolean().safeParse('true').success).toBe(false);
    });

    it('rifiuta un numero', () => {
        expect(z.boolean().safeParse(1).success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// z.enum()
// ---------------------------------------------------------------------------
describe('z.enum()', () => {
    const statusSchema = z.enum(['ATTIVA', 'STANDBY', 'CHIUSA']);

    it('accetta un valore valido dell\'enum', () => {
        expect(statusSchema.safeParse('ATTIVA').success).toBe(true);
    });

    it('rifiuta un valore non presente nell\'enum', () => {
        expect(statusSchema.safeParse('UNKNOWN').success).toBe(false);
    });

    it('utilizza required_error personalizzato', () => {
        const schema = z.enum(['A', 'B'], { required_error: 'Seleziona un valore valido' });
        const result = schema.safeParse('C');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Seleziona un valore valido');
        }
    });
});

// ---------------------------------------------------------------------------
// z.object()
// ---------------------------------------------------------------------------
describe('z.object()', () => {
    const personSchema = z.object({
        name: z.string().min(1, 'Nome obbligatorio'),
        age: z.number().min(0, 'Età non valida'),
    });

    it('accetta un oggetto valido', () => {
        const result = personSchema.safeParse({ name: 'Mario', age: 30 });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe('Mario');
            expect(result.data.age).toBe(30);
        }
    });

    it('raccoglie tutti gli errori dei campi', () => {
        const result = personSchema.safeParse({ name: '', age: -1 });
        expect(result.success).toBe(false);
        if (!result.success) {
            const issues = result.error.issues;
            expect(issues.length).toBeGreaterThanOrEqual(2);
        }
    });

    it('rifiuta un non-oggetto', () => {
        expect(personSchema.safeParse('non-oggetto').success).toBe(false);
    });

    it('rifiuta un array', () => {
        expect(personSchema.safeParse([]).success).toBe(false);
    });

    it('supporta campi optional nei nested objects', () => {
        const schema = z.object({
            name: z.string(),
            notes: z.string().optional(),
        });
        expect(schema.safeParse({ name: 'Test' }).success).toBe(true);
        expect(schema.safeParse({ name: 'Test', notes: undefined }).success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// z.array()
// ---------------------------------------------------------------------------
describe('z.array()', () => {
    const strArraySchema = z.array(z.string());

    it('accetta un array di stringhe', () => {
        const result = strArraySchema.safeParse(['a', 'b', 'c']);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toHaveLength(3);
    });

    it('rifiuta un array con elementi del tipo sbagliato', () => {
        expect(strArraySchema.safeParse([1, 2, 3]).success).toBe(false);
    });

    it('accetta un array vuoto', () => {
        expect(strArraySchema.safeParse([]).success).toBe(true);
    });

    it('rifiuta un non-array', () => {
        expect(strArraySchema.safeParse('non-array').success).toBe(false);
    });

    it('min() rifiuta array troppo corti', () => {
        const schema = z.array(z.string()).min(2, 'Minimo 2 elementi');
        expect(schema.safeParse(['solo-uno']).success).toBe(false);
        expect(schema.safeParse(['uno', 'due']).success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// refine()
// ---------------------------------------------------------------------------
describe('refine()', () => {
    it('applica una validazione personalizzata', () => {
        const schema = z.string().refine(
            val => val.startsWith('OSR-'),
            { path: ['osrNumber'], message: 'Deve iniziare con OSR-' }
        );
        expect(schema.safeParse('OSR-1234').success).toBe(true);
        expect(schema.safeParse('1234').success).toBe(false);
    });

    it('refine su oggetto valida con accesso ai campi', () => {
        const schema = z.object({
            startDate: z.string(),
            endDate: z.string(),
        }).refine(
            data => data.endDate >= data.startDate,
            { path: ['endDate'], message: 'La data di fine deve essere dopo l\'inizio' }
        );
        expect(schema.safeParse({ startDate: '2024-01-01', endDate: '2024-06-01' }).success).toBe(true);
        const bad = schema.safeParse({ startDate: '2024-06-01', endDate: '2024-01-01' });
        expect(bad.success).toBe(false);
        if (!bad.success) {
            expect(bad.error.issues[0].message).toContain('fine');
        }
    });
});

// ---------------------------------------------------------------------------
// ZodError.flatten()
// ---------------------------------------------------------------------------
describe('ZodError.flatten()', () => {
    it('raggruppa gli errori per campo', () => {
        const schema = z.object({
            username: z.string().min(3, 'Username troppo corto'),
            password: z.string().min(8, 'Password troppo corta'),
        });
        const result = schema.safeParse({ username: 'ab', password: 'x' });
        expect(result.success).toBe(false);
        if (!result.success) {
            const flat = result.error.flatten();
            expect(flat.fieldErrors['username']).toBeDefined();
            expect(flat.fieldErrors['password']).toBeDefined();
        }
    });

    it('restituisce un array formErrors vuoto', () => {
        const schema = z.string().min(5, 'Troppo corta');
        const result = schema.safeParse('abc');
        expect(result.success).toBe(false);
        if (!result.success) {
            const flat = result.error.flatten();
            expect(flat.formErrors).toEqual([]);
        }
    });
});

// ---------------------------------------------------------------------------
// safeParse – gestione errori
// ---------------------------------------------------------------------------
describe('safeParse – gestione null/undefined su campi obbligatori', () => {
    it('rifiuta null su un campo obbligatorio', () => {
        expect(z.string().safeParse(null).success).toBe(false);
    });

    it('rifiuta undefined su un campo obbligatorio', () => {
        expect(z.string().safeParse(undefined).success).toBe(false);
    });

    it('include il messaggio "Valore obbligatorio mancante." per null/undefined', () => {
        const result = z.string().safeParse(null);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('obbligatorio');
        }
    });
});
