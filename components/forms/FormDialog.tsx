import React, { useEffect, useMemo, useState } from 'react';
import type { SafeParseResult } from 'zod';
import Modal from '../Modal';
import SearchableSelect from '../SearchableSelect';
import MultiSelectDropdown from '../MultiSelectDropdown';
import { FormFieldFeedback } from './FormFieldFeedback';
import { FormFieldDefinition } from './types';

type ResolvedField = FormFieldDefinition & { resolvedLabel: string; resolvedHelperText?: string };

interface FormDialogProps<TValues extends Record<string, unknown>> {
    isOpen: boolean;
    title: string;
    defaultValues: TValues;
    onClose: () => void;
    onSubmit: (values: TValues) => void | Promise<void>;
    fields: FormFieldDefinition[];
    schema?: { safeParse: (values: TValues) => SafeParseResult<TValues> };
    submitLabel?: string;
    cancelLabel?: string;
}

const resolveLabel = (label: FormFieldDefinition['label'], values: Record<string, unknown>): string =>
    typeof label === 'function' ? label(values) : label;

const resolveHelperText = (
    helperText: FormFieldDefinition['helperText'],
    values: Record<string, unknown>
): string | undefined => {
    if (!helperText) return undefined;
    return typeof helperText === 'function' ? helperText(values) : helperText;
};

export const FormDialog = <TValues extends Record<string, unknown>>({
    isOpen,
    title,
    defaultValues,
    onClose,
    onSubmit,
    fields,
    schema,
    submitLabel = 'Salva',
    cancelLabel = 'Annulla',
}: FormDialogProps<TValues>) => {
    const [values, setValues] = useState<TValues>(defaultValues);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setValues(defaultValues);
            setErrors({});
        }
    }, [defaultValues, isOpen]);

    const handleFieldChange = (fieldName: string, nextValue: unknown) => {
        setValues(prev => ({ ...prev, [fieldName]: nextValue } as TValues));
    };

    const fieldConfigs = useMemo<ResolvedField[]>(
        () =>
            fields.map(field => ({
                ...field,
                resolvedLabel: resolveLabel(field.label, values),
                resolvedHelperText: resolveHelperText(field.helperText, values),
            })),
        [fields, values]
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setErrors({});

        let parsedValues = values;
        if (schema) {
            const result = schema.safeParse(values);
            if (!result.success) {
                const nextErrors: Record<string, string> = {};
                result.error.issues.forEach(issue => {
                    const pathKey = issue.path[0];
                    if (typeof pathKey === 'string' && !nextErrors[pathKey]) {
                        nextErrors[pathKey] = issue.message;
                    }
                });
                setErrors(nextErrors);
                return;
            }
            parsedValues = result.data;
        }

        try {
            setIsSubmitting(true);
            await onSubmit(parsedValues);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderField = (field: ResolvedField) => {
        const fieldId = `${field.name}-input`;
        const describedById = errors[field.name]
            ? `${fieldId}-error`
            : field.resolvedHelperText
                ? `${fieldId}-helper`
                : undefined;

        switch (field.type) {
            case 'text':
            case 'number':
            case 'date':
            case 'range':
                return (
                    <div key={field.name} className="flex flex-col">
                        <label htmlFor={fieldId} className="block text-sm font-medium text-on-surface-variant mb-1">
                            {field.resolvedLabel}
                        </label>
                        <input
                            id={fieldId}
                            name={field.name}
                            type={field.type === 'range' ? 'range' : field.type}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            required={field.required}
                            value={
                                (typeof values[field.name] === 'number' || typeof values[field.name] === 'string'
                                    ? values[field.name]
                                    : '') as string | number
                            }
                            onChange={event => {
                                const baseValue = event.target.value;
                                const nextValue =
                                    field.type === 'number' || field.type === 'range'
                                        ? Number(baseValue)
                                        : baseValue;
                                handleFieldChange(field.name, nextValue);
                            }}
                            className="form-input"
                            placeholder={field.placeholder}
                            aria-invalid={Boolean(errors[field.name])}
                            aria-describedby={describedById}
                        />
                        <FormFieldFeedback
                            id={describedById}
                            error={errors[field.name]}
                            helperText={field.resolvedHelperText}
                        />
                    </div>
                );
            case 'textarea':
                return (
                    <div key={field.name} className="flex flex-col">
                        <label htmlFor={fieldId} className="block text-sm font-medium text-on-surface-variant mb-1">
                            {field.resolvedLabel}
                        </label>
                        <textarea
                            id={fieldId}
                            name={field.name}
                            required={field.required}
                            value={(values[field.name] as string) || ''}
                            onChange={event => handleFieldChange(field.name, event.target.value)}
                            className="form-input min-h-[96px]"
                            placeholder={field.placeholder}
                            aria-invalid={Boolean(errors[field.name])}
                            aria-describedby={describedById}
                        />
                        <FormFieldFeedback
                            id={describedById}
                            error={errors[field.name]}
                            helperText={field.resolvedHelperText}
                        />
                    </div>
                );
            case 'select':
                return (
                    <div key={field.name} className="flex flex-col">
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">
                            {field.resolvedLabel}
                        </label>
                        <SearchableSelect
                            name={field.name}
                            value={(values[field.name] as string) || ''}
                            onChange={(name, optionValue) => handleFieldChange(name, optionValue)}
                            options={field.options || []}
                            placeholder={field.placeholder}
                            required={field.required}
                            loadOptions={field.loadOptions}
                        />
                        <FormFieldFeedback
                            id={describedById}
                            error={errors[field.name]}
                            helperText={field.resolvedHelperText}
                        />
                    </div>
                );
            case 'multiselect':
                return (
                    <div key={field.name} className="flex flex-col">
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">
                            {field.resolvedLabel}
                        </label>
                        <MultiSelectDropdown
                            name={field.name}
                            selectedValues={(values[field.name] as string[]) || []}
                            onChange={(name, selected) => handleFieldChange(name, selected)}
                            options={field.options || []}
                            placeholder={field.placeholder}
                            loadOptions={field.loadOptions}
                        />
                        <FormFieldFeedback
                            id={describedById}
                            error={errors[field.name]}
                            helperText={field.resolvedHelperText}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
                <div className="space-y-4 flex-grow">
                    {fieldConfigs.map(renderField)}
                </div>
                <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-outline-variant">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold hover:opacity-90 disabled:opacity-60"
                        disabled={isSubmitting}
                    >
                        {submitLabel}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default FormDialog;
