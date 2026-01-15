/*
 * Lightweight Zod-compatible subset tailored for client-side schema validation.
 * Supports: object, string (trim/min), boolean, enum, number (coerce, min, max), optional/nullable, refine, safeParse.
 */

export type SafeParseSuccess<T> = { success: true; data: T };
export type SafeParseError = { success: false; error: ZodError };
export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseError;

type Refinement<T> = {
    check: (value: T) => boolean;
    message: string;
    path: (string | number)[];
};

export class ZodError extends Error {
    issues: { path: (string | number)[]; message: string }[];

    constructor(issues: { path: (string | number)[]; message: string }[]) {
        super('Validation error');
        this.issues = issues;
    }

    flatten() {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of this.issues) {
            const key = issue.path.join('.') || 'formErrors';
            fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
        }
        return { fieldErrors, formErrors: [] as string[] };
    }
}

abstract class BaseSchema<T> {
    protected allowNull = false;
    protected allowUndefined = false;
    protected refinements: Refinement<T>[] = [];

    /**
     * Expose parsing for nested schemas while keeping the core parser encapsulated.
     */
    parseWithPath(data: unknown, path: (string | number)[]): T {
        return this.parseInternal(data, path);
    }

    optional(): BaseSchema<T | undefined> {
        this.allowUndefined = true;
        return this as unknown as BaseSchema<T | undefined>;
    }

    nullable(): BaseSchema<T | null> {
        this.allowNull = true;
        return this as unknown as BaseSchema<T | null>;
    }

    refine(check: (value: T) => boolean, params: { path: (string | number)[]; message: string }): this {
        this.refinements.push({ check, path: params.path, message: params.message });
        return this;
    }

    safeParse(data: unknown): SafeParseResult<T> {
        try {
            const parsed = this.parseInternal(data, []);
            return { success: true as const, data: parsed };
        } catch (error) {
            return { success: false as const, error: error as ZodError };
        }
    }

    protected checkRefinements(value: T) {
        const issues: Refinement<T>[] = [];
        for (const refinement of this.refinements) {
            if (!refinement.check(value)) {
                issues.push(refinement);
            }
        }
        if (issues.length) {
            throw new ZodError(issues.map(({ path, message }) => ({ path, message })));
        }
    }

    protected handleNullability(value: unknown, path: (string | number)[]): T {
        if (value === undefined && this.allowUndefined) {
            return undefined as unknown as T;
        }
        if (value === null && this.allowNull) {
            return null as unknown as T;
        }
        if (value === undefined || value === null) {
            throw new ZodError([{ path, message: 'Valore obbligatorio mancante.' }]);
        }
        return value as T;
    }

    protected abstract parseInternal(data: unknown, path: (string | number)[]): T;
}

class ZodString extends BaseSchema<string> {
    private minLength?: { value: number; message: string };
    private shouldTrim = false;

    trim() {
        this.shouldTrim = true;
        return this;
    }

    min(value: number, message: string) {
        this.minLength = { value, message };
        return this;
    }

    protected parseInternal(data: unknown, path: (string | number)[]): string {
        const handled = this.handleNullability(data, path);
        if (handled === null || handled === undefined) {
            return handled as unknown as string;
        }
        if (typeof handled !== 'string') {
            throw new ZodError([{ path, message: 'Deve essere una stringa.' }]);
        }
        const value = this.shouldTrim ? handled.trim() : handled;
        if (this.minLength && value.length < this.minLength.value) {
            throw new ZodError([{ path, message: this.minLength.message }]);
        }
        this.checkRefinements(value as unknown as any);
        return value;
    }
}

type NumberRange = { min?: { value: number; message: string }; max?: { value: number; message: string } };

class ZodNumber extends BaseSchema<number> {
    private range: NumberRange = {};
    private coerce = false;

    constructor(coerce = false) {
        super();
        this.coerce = coerce;
    }

    min(value: number, message: string) {
        this.range.min = { value, message };
        return this;
    }

    max(value: number, message: string) {
        this.range.max = { value, message };
        return this;
    }

    protected parseInternal(data: unknown, path: (string | number)[]): number {
        let value = data;
        if (this.coerce && typeof value === 'string') {
            value = Number(value);
        }
        const handled = this.handleNullability(value, path);
        if (handled === null || handled === undefined) {
            return handled as unknown as number;
        }
        if (typeof handled !== 'number' || Number.isNaN(handled)) {
            throw new ZodError([{ path, message: 'Deve essere un numero.' }]);
        }
        if (this.range.min && handled < this.range.min.value) {
            throw new ZodError([{ path, message: this.range.min.message }]);
        }
        if (this.range.max && handled > this.range.max.value) {
            throw new ZodError([{ path, message: this.range.max.message }]);
        }
        this.checkRefinements(handled as unknown as any);
        return handled;
    }
}

class ZodBoolean extends BaseSchema<boolean> {
    protected parseInternal(data: unknown, path: (string | number)[]): boolean {
        const handled = this.handleNullability(data, path);
        if (handled === null || handled === undefined) {
            return handled as unknown as boolean;
        }
        if (typeof handled !== 'boolean') {
            throw new ZodError([{ path, message: 'Deve essere un valore booleano.' }]);
        }
        this.checkRefinements(handled as unknown as any);
        return handled;
    }
}

class ZodEnum<T extends [string, ...string[]]> extends BaseSchema<T[number]> {
    private values: T;

    constructor(values: T, private options?: { required_error?: string }) {
        super();
        this.values = values;
    }

    protected parseInternal(data: unknown, path: (string | number)[]): T[number] {
        const handled = this.handleNullability(data, path);
        if (handled === null || handled === undefined) {
            return handled as unknown as T[number];
        }
        if (typeof handled !== 'string' || !this.values.includes(handled)) {
            throw new ZodError([
                { path, message: this.options?.required_error || 'Valore non valido.' },
            ]);
        }
        this.checkRefinements(handled as unknown as any);
        return handled as T[number];
    }
}

class ZodObject<Shape extends Record<string, BaseSchema<any>>> extends BaseSchema<{ [K in keyof Shape]: Infer<Shape[K]> }> {
    private shape: Shape;

    constructor(shape: Shape) {
        super();
        this.shape = shape;
    }

    protected parseInternal(data: unknown, path: (string | number)[]) {
        const handled = this.handleNullability(data, path);
        if (handled === null || handled === undefined) {
            return handled as unknown as { [K in keyof Shape]: Infer<Shape[K]> };
        }
        if (typeof handled !== 'object' || Array.isArray(handled)) {
            throw new ZodError([{ path, message: 'Deve essere un oggetto.' }]);
        }

        const output: Record<string, unknown> = {};
        const issues: { path: (string | number)[]; message: string }[] = [];

        for (const key of Object.keys(this.shape)) {
            try {
                output[key] = this.shape[key].parseWithPath((handled as Record<string, unknown>)[key], [...path, key]);
            } catch (err) {
                const zodError = err as ZodError;
                issues.push(...zodError.issues);
            }
        }

        if (issues.length) {
            throw new ZodError(issues);
        }

        const parsedObject = output as { [K in keyof Shape]: Infer<Shape[K]> };
        this.checkRefinements(parsedObject as unknown as any);
        return parsedObject;
    }
}

type Infer<TSchema> = TSchema extends BaseSchema<infer TType> ? TType : never;

class ZodArray<TSchema extends BaseSchema<any>> extends BaseSchema<Infer<TSchema>[]> {
    constructor(private readonly itemSchema: TSchema) {
        super();
    }

    private minLength?: { value: number; message: string };

    min(value: number, message: string) {
        this.minLength = { value, message };
        return this;
    }

    protected parseInternal(data: unknown, path: (string | number)[]): Infer<TSchema>[] {
        const handled = this.handleNullability(data, path);
        if (handled === null || handled === undefined) {
            return handled as unknown as Infer<TSchema>[];
        }
        if (!Array.isArray(handled)) {
            throw new ZodError([{ path, message: 'Deve essere un array.' }]);
        }

        const parsedItems: Infer<TSchema>[] = [];
        const issues: { path: (string | number)[]; message: string }[] = [];

        handled.forEach((item, index) => {
            try {
                parsedItems.push(this.itemSchema.parseWithPath(item, [...path, index]));
            } catch (error) {
                const zodError = error as ZodError;
                issues.push(...zodError.issues);
            }
        });

        if (this.minLength && parsedItems.length < this.minLength.value) {
            issues.push({ path, message: this.minLength.message });
        }

        if (issues.length) {
            throw new ZodError(issues);
        }

        this.checkRefinements(parsedItems as unknown as any);
        return parsedItems;
    }
}

export const z = {
    string: () => new ZodString(),
    number: () => new ZodNumber(),
    boolean: () => new ZodBoolean(),
    enum: <T extends [string, ...string[]]>(values: T, options?: { required_error?: string }) => new ZodEnum(values, options),
    object: <Shape extends Record<string, BaseSchema<any>>>(shape: Shape) => new ZodObject(shape),
    array: <TSchema extends BaseSchema<any>>(schema: TSchema) => new ZodArray(schema),
    coerce: {
        number: () => new ZodNumber(true),
    },
};

export default z;