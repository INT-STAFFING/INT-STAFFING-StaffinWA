export interface Option {
    value: string;
    label: string;
    meta?: Record<string, unknown>;
}

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'range';

export interface FormFieldDefinition {
    name: string;
    label: string | ((values: Record<string, unknown>) => string);
    type: FieldType;
    placeholder?: string;
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    helperText?: string | ((values: Record<string, unknown>) => string | undefined);
    options?: Option[];
    loadOptions?: (query: string) => Promise<Option[]>;
}