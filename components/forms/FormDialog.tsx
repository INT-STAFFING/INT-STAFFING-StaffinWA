import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { FormFieldDefinition } from './types';
import SearchableSelect from '../SearchableSelect';
import MultiSelectDropdown from '../MultiSelectDropdown';

interface FormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    defaultValues: any;
    onSubmit: (values: any) => void;
    fields: FormFieldDefinition[];
    schema: any;
    submitLabel?: string;
}

export const FormDialog: React.FC<FormDialogProps> = ({
    isOpen,
    onClose,
    title,
    defaultValues,
    onSubmit,
    fields,
    schema,
    submitLabel = 'Salva',
}) => {
    const [values, setValues] = useState(defaultValues);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Reset local state when modal opens with new defaults
    useEffect(() => {
        if (isOpen) {
            setValues(defaultValues);
            setErrors({});
        }
    }, [isOpen, defaultValues]);

    const handleChange = (name: string, value: any) => {
        setValues((prev: any) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Coerce data types before schema validation if necessary
        const coercedValues = { ...values };
        fields.forEach(f => {
            if (f.type === 'number' || f.type === 'range') {
                if (coercedValues[f.name] !== undefined && coercedValues[f.name] !== '') {
                    coercedValues[f.name] = Number(coercedValues[f.name]);
                } else if (f.required) {
                    coercedValues[f.name] = 0;
                }
            }
        });

        const result = schema.safeParse(coercedValues);
        if (result.success) {
            onSubmit(result.data);
            onClose();
        } else {
            const fieldErrors = result.error.flatten().fieldErrors;
            const mappedErrors: Record<string, string> = {};
            Object.keys(fieldErrors).forEach(key => {
                if (fieldErrors[key]) mappedErrors[key] = fieldErrors[key][0];
            });
            setErrors(mappedErrors);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {fields.map((field) => {
                    const label = typeof field.label === 'function' ? field.label(values) : field.label;
                    const helper = typeof field.helperText === 'function' ? field.helperText(values) : field.helperText;

                    return (
                        <div key={field.name}>
                            <label className="block text-sm font-bold text-on-surface-variant mb-1">
                                {label} {field.required && <span className="text-error">*</span>}
                            </label>
                            {field.type === 'date' && (
                                <input
                                    type="date"
                                    value={values[field.name] || ''}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    className="form-input w-full"
                                    required={field.required}
                                />
                            )}
                            {(field.type === 'number' || field.type === 'text') && (
                                <input
                                    type={field.type}
                                    value={values[field.name] ?? ''}
                                    onChange={(e) => handleChange(field.name, field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                                    className="form-input w-full"
                                    required={field.required}
                                    min={field.min}
                                    max={field.max}
                                    step={field.step}
                                    placeholder={field.placeholder}
                                />
                            )}
                            {field.type === 'range' && (
                                <div className="space-y-1">
                                    <input
                                        type="range"
                                        value={values[field.name] ?? 0}
                                        onChange={(e) => handleChange(field.name, Number(e.target.value))}
                                        className="w-full accent-primary"
                                        min={field.min}
                                        max={field.max}
                                        step={field.step}
                                    />
                                    <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">
                                        <span>{field.min}%</span>
                                        <span className="text-primary">{values[field.name] ?? 0}%</span>
                                        <span>{field.max}%</span>
                                    </div>
                                </div>
                            )}
                            {field.type === 'select' && (
                                <SearchableSelect
                                    name={field.name}
                                    value={values[field.name] || ''}
                                    onChange={handleChange}
                                    options={field.options || []}
                                    loadOptions={field.loadOptions}
                                    placeholder={field.placeholder}
                                    required={field.required}
                                />
                            )}
                            {field.type === 'multiselect' && (
                                <MultiSelectDropdown
                                    name={field.name}
                                    selectedValues={values[field.name] || []}
                                    onChange={handleChange}
                                    options={field.options || []}
                                    loadOptions={field.loadOptions}
                                    placeholder={field.placeholder}
                                />
                            )}
                            {errors[field.name] && <p className="mt-1 text-xs font-bold text-error">{errors[field.name]}</p>}
                            {helper && <p className="mt-1 text-xs text-on-surface-variant opacity-70 italic">{helper}</p>}
                        </div>
                    );
                })}
                <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
                    <button type="button" onClick={onClose} className="px-6 py-2 border border-outline rounded-full text-primary font-bold hover:bg-surface-container-low transition-colors">Annulla</button>
                    <button type="submit" className="px-8 py-2 bg-primary text-on-primary rounded-full font-bold hover:opacity-90 shadow-lg transition-all active:scale-95">
                        {submitLabel}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default FormDialog;