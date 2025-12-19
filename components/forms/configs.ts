import { z } from 'zod';
import { FormFieldDefinition, Option } from './types';

export type BulkAssignmentFormValues = { startDate: string; endDate: string; percentage: number; };
export type AssignmentFormValues = { resourceId: string; projectIds: string[] };

export const bulkAssignmentSchema = z.object({
    startDate: z.string().min(1, 'Seleziona una data di inizio'),
    endDate: z.string().min(1, 'Seleziona una data di fine'),
    percentage: z.number().min(0, 'La percentuale non può essere negativa').max(100, 'La percentuale non può superare il 100'),
});

export const assignmentSchema = z.object({
    resourceId: z.string().min(1, 'Seleziona una risorsa'),
    projectIds: z.array(z.string()).min(1, 'Seleziona almeno un progetto'),
});

export const bulkFormFields: FormFieldDefinition[] = [
    { name: 'startDate', label: 'Data Inizio', type: 'date', required: true },
    { name: 'endDate', label: 'Data Fine', type: 'date', required: true },
    { 
        name: 'percentage',
        label: (values) => `Percentuale (${(values.percentage as number | undefined) ?? 0}%)`,
        type: 'range',
        min: 0,
        max: 100,
        step: 5,
        helperText: (values) => `Allocazione: ${(values.percentage as number | undefined) ?? 0}%`,
    },
];

export const buildAssignmentFormFields = (resourceOptions: Option[], projectOptions: Option[]): FormFieldDefinition[] => [
    {
        name: 'resourceId',
        label: 'Risorsa',
        type: 'select',
        required: true,
        placeholder: 'Seleziona una risorsa',
        options: resourceOptions,
    },
    {
        name: 'projectIds',
        label: 'Progetto/i',
        type: 'multiselect',
        required: true,
        placeholder: 'Seleziona uno o più progetti',
        options: projectOptions,
        helperText: 'Puoi selezionare più progetti',
    },
];
