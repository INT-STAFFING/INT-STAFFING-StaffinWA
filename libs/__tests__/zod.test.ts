/**
 * @file libs/__tests__/zod.test.ts
 * @description Test della libreria di validazione zod custom (sottoinsieme compatibile con Zod).
 */
import { describe, it, expect } from 'vitest';
import { z, ZodError } from '../zod';

// ---------------------------------------------------------------------------
// ZodString
// ---------------------------------------------------------------------------
describe('z.string()', () => {
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
describe('z.number()', () => {
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
describe('z.boolean()', () => {
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
describe('z.enum()', () => {
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
describe('z.object()', () => {
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
describe('z.array()', () => {
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
describe('z.any()', () => {
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
describe('.refine()', () => {
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
describe('ZodError.flatten()', () => {
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
