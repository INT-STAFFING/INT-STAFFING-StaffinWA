/**
 * @file libs/zod.test.ts
 * @description Suite consolidata dei test unitari per la libreria Zod custom lightweight.
 * Fusione delle due suite precedentemente duplicate (co-locata + __tests__):
 * suite A e suite B contengono casi differenti, mantenuti in blocchi `describe`
 * separati per preservare tutti i casi senza perdita di copertura.
 * Verifica il comportamento di tutti i tipi supportati, le validazioni,
 * optional/nullable, refine e safeParse.
 */
import { describe, it, expect } from 'vitest';
import { z, ZodError } from './zod';

// ===========================================================================
// SUITE A (originariamente libs/zod.test.ts)
// ===========================================================================

// ---------------------------------------------------------------------------
// z.string()
// ---------------------------------------------------------------------------
describe('z.string() (suite A)', () => {
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
describe('z.number() (suite A)', () => {
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
describe('z.boolean() (suite A)', () => {
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
describe('z.enum() (suite A)', () => {
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
describe('z.object() (suite A)', () => {
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
describe('z.array() (suite A)', () => {
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
describe('refine() (suite A)', () => {
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
describe('ZodError.flatten() (suite A)', () => {
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

// ===========================================================================
// SUITE B (originariamente libs/__tests__/zod.test.ts)
// ===========================================================================

// ---------------------------------------------------------------------------
// ZodString
// ---------------------------------------------------------------------------
describe('z.string() (suite B)', () => {
    it('accetta una stringa valida', () => {
        const result = z.string().safeParse('ciao');
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe('ciao');
    });

    it('rifiuta un numero invece di una stringa', () => {
        const result = z.string().safeParse(42);
        expect(result.success).toBe(false);
    });

    it('rifiuta null (non nullable)', () => {
        const result = z.string().safeParse(null);
        expect(result.success).toBe(false);
    });

    it('rifiuta undefined (non optional)', () => {
        const result = z.string().safeParse(undefined);
        expect(result.success).toBe(false);
    });

    it('.trim() rimuove gli spazi', () => {
        const result = z.string().trim().safeParse('  hello  ');
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe('hello');
    });

    it('.min() rifiuta stringa troppo corta', () => {
        const result = z.string().min(5, 'Troppo corta').safeParse('abc');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect((result as any).error.issues[0].message).toBe('Troppo corta');
        }
    });

    it('.min() accetta stringa con lunghezza esatta', () => {
        const result = z.string().min(3, 'Troppo corta').safeParse('abc');
        expect(result.success).toBe(true);
    });

    it('.nullable() accetta null', () => {
        const result = z.string().nullable().safeParse(null);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBeNull();
    });

    it('.optional() accetta undefined', () => {
        const result = z.string().optional().safeParse(undefined);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ZodNumber
// ---------------------------------------------------------------------------
describe('z.number() (suite B)', () => {
    it('accetta un numero valido', () => {
        const result = z.number().safeParse(42);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(42);
    });

    it('accetta 0', () => {
        expect(z.number().safeParse(0).success).toBe(true);
    });

    it('accetta numeri negativi', () => {
        expect(z.number().safeParse(-99).success).toBe(true);
    });

    it('rifiuta una stringa non numerica', () => {
        expect(z.number().safeParse('abc').success).toBe(false);
    });

    it('rifiuta NaN', () => {
        expect(z.number().safeParse(NaN).success).toBe(false);
    });

    it('.min() rifiuta valore sotto la soglia', () => {
        const result = z.number().min(10, 'Minimo 10').safeParse(5);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect((result as any).error.issues[0].message).toBe('Minimo 10');
        }
    });

    it('.max() rifiuta valore sopra la soglia', () => {
        const result = z.number().max(100, 'Massimo 100').safeParse(150);
        expect(result.success).toBe(false);
    });

    it('.min() e .max() accettano valore esattamente al limite', () => {
        expect(z.number().min(0, '').max(100, '').safeParse(0).success).toBe(true);
        expect(z.number().min(0, '').max(100, '').safeParse(100).success).toBe(true);
    });

    it('z.coerce.number() converte stringa numerica in numero', () => {
        const result = z.coerce.number().safeParse('42');
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(42);
    });

    it('z.coerce.number() rifiuta stringa non numerica (risulta NaN)', () => {
        expect(z.coerce.number().safeParse('abc').success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ZodBoolean
// ---------------------------------------------------------------------------
describe('z.boolean() (suite B)', () => {
    it('accetta true', () => {
        const result = z.boolean().safeParse(true);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(true);
    });

    it('accetta false', () => {
        const result = z.boolean().safeParse(false);
        expect(result.success).toBe(true);
    });

    it('rifiuta una stringa', () => {
        expect(z.boolean().safeParse('true').success).toBe(false);
    });

    it('rifiuta un numero', () => {
        expect(z.boolean().safeParse(1).success).toBe(false);
    });

    it('.nullable() accetta null', () => {
        expect(z.boolean().nullable().safeParse(null).success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ZodEnum
// ---------------------------------------------------------------------------
describe('z.enum() (suite B)', () => {
    const statusSchema = z.enum(['ATTIVA', 'STANDBY', 'CHIUSA']);

    it('accetta un valore valido dell\'enum', () => {
        const result = statusSchema.safeParse('ATTIVA');
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe('ATTIVA');
    });

    it('rifiuta un valore non incluso nell\'enum', () => {
        expect(statusSchema.safeParse('ELIMINATA').success).toBe(false);
    });

    it('rifiuta un numero', () => {
        expect(statusSchema.safeParse(1).success).toBe(false);
    });

    it('usa il messaggio di errore personalizzato', () => {
        const schema = z.enum(['A', 'B'], { required_error: 'Seleziona un valore' });
        const result = schema.safeParse('C');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect((result as any).error.issues[0].message).toBe('Seleziona un valore');
        }
    });

    it('.nullable() accetta null', () => {
        expect(statusSchema.nullable().safeParse(null).success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ZodObject
// ---------------------------------------------------------------------------
describe('z.object() (suite B)', () => {
    const userSchema = z.object({
        name: z.string().min(1, 'Nome obbligatorio'),
        age: z.number().min(0, 'Età non valida'),
        active: z.boolean(),
    });

    it('accetta un oggetto valido', () => {
        const result = userSchema.safeParse({ name: 'Mario', age: 30, active: true });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe('Mario');
            expect(result.data.age).toBe(30);
        }
    });

    it('accumula tutti gli errori dei campi', () => {
        const result = userSchema.safeParse({ name: '', age: -1, active: 'yes' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect((result as any).error.issues.length).toBeGreaterThanOrEqual(2);
        }
    });

    it('rifiuta un array al posto di un oggetto', () => {
        expect(userSchema.safeParse([]).success).toBe(false);
    });

    it('rifiuta null', () => {
        expect(userSchema.safeParse(null).success).toBe(false);
    });

    it('.nullable() accetta null', () => {
        expect(userSchema.nullable().safeParse(null).success).toBe(true);
    });

    it('restituisce gli errori con path corretto', () => {
        const result = userSchema.safeParse({ name: '', age: 30, active: true });
        expect(result.success).toBe(false);
        if (!result.success) {
            const fieldErrors = (result as any).error.flatten().fieldErrors;
            expect(fieldErrors['name']).toBeDefined();
        }
    });
});

// ---------------------------------------------------------------------------
// ZodArray
// ---------------------------------------------------------------------------
describe('z.array() (suite B)', () => {
    const strArraySchema = z.array(z.string());

    it('accetta un array di stringhe', () => {
        const result = strArraySchema.safeParse(['a', 'b', 'c']);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toEqual(['a', 'b', 'c']);
    });

    it('accetta un array vuoto', () => {
        expect(strArraySchema.safeParse([]).success).toBe(true);
    });

    it('rifiuta un non-array', () => {
        expect(strArraySchema.safeParse('ciao').success).toBe(false);
    });

    it('rifiuta elementi del tipo sbagliato', () => {
        expect(strArraySchema.safeParse([1, 2, 3]).success).toBe(false);
    });

    it('.min() rifiuta array troppo corto', () => {
        const result = z.array(z.string()).min(2, 'Almeno 2 elementi').safeParse(['solo']);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect((result as any).error.issues[0].message).toBe('Almeno 2 elementi');
        }
    });
});

// ---------------------------------------------------------------------------
// z.any()
// ---------------------------------------------------------------------------
describe('z.any() (suite B)', () => {
    it('accetta qualsiasi valore', () => {
        expect(z.any().safeParse(42).success).toBe(true);
        expect(z.any().safeParse('ciao').success).toBe(true);
        expect(z.any().safeParse(null).success).toBe(true);
        expect(z.any().safeParse(undefined).success).toBe(true);
        expect(z.any().safeParse({ a: 1 }).success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// .refine()
// ---------------------------------------------------------------------------
describe('.refine() (suite B)', () => {
    it('rifiuta quando il refine fallisce', () => {
        const schema = z.string().refine(
            (v) => v.startsWith('OSR-'),
            { path: ['osrNumber'], message: 'Deve iniziare con OSR-' }
        );
        const result = schema.safeParse('12345');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect((result as any).error.issues[0].message).toBe('Deve iniziare con OSR-');
        }
    });

    it('accetta quando il refine ha successo', () => {
        const schema = z.string().refine(
            (v) => v.startsWith('OSR-'),
            { path: ['osrNumber'], message: 'Deve iniziare con OSR-' }
        );
        expect(schema.safeParse('OSR-1234').success).toBe(true);
    });

    it('refine su oggetto con path personalizzato', () => {
        const schema = z.object({
            start: z.string(),
            end: z.string(),
        }).refine(
            (obj) => obj.end >= obj.start,
            { path: ['end'], message: 'La data fine deve essere >= data inizio' }
        );
        const bad = schema.safeParse({ start: '2024-06-01', end: '2024-05-01' });
        expect(bad.success).toBe(false);
        if (!bad.success) {
            expect((bad as any).error.issues[0].message).toContain('fine');
        }
    });
});

// ---------------------------------------------------------------------------
// ZodError.flatten()
// ---------------------------------------------------------------------------
describe('ZodError.flatten() (suite B)', () => {
    it('raggruppa gli errori per path', () => {
        const schema = z.object({
            username: z.string().min(3, 'Username troppo corto'),
            email: z.string().min(5, 'Email troppo corta'),
        });
        const result = schema.safeParse({ username: 'ab', email: 'x' });
        expect(result.success).toBe(false);
        if (!result.success) {
            const { fieldErrors } = (result as any).error.flatten();
            expect(fieldErrors['username']).toContain('Username troppo corto');
            expect(fieldErrors['email']).toContain('Email troppo corta');
        }
    });
});
