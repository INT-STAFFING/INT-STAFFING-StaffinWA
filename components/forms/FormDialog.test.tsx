/**
 * @file FormDialog.test.tsx
 * @description Test di regressione per la risincronizzazione dello stato interno
 * di FormDialog con i defaultValues a ogni apertura (BUG-01 del QA modali:
 * preselezioni ignorate e valori stantii riproposti tra un'apertura e l'altra).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormDialog } from './FormDialog';
import { z } from '../../libs/zod';
import { FormFieldDefinition } from './types';

const fields: FormFieldDefinition[] = [
    { name: 'startDate', label: 'Data Inizio', type: 'date', required: true },
    { name: 'endDate', label: 'Data Fine', type: 'date', required: true },
];

const schema = z.object({
    startDate: z.string().min(1, 'Seleziona una data di inizio'),
    endDate: z.string().min(1, 'Seleziona una data di fine'),
});

describe('FormDialog - risincronizzazione defaultValues', () => {
    it('mostra i defaultValues correnti quando viene riaperto (niente stato stantio)', () => {
        const onSubmit = vi.fn();
        const onClose = vi.fn();

        const { rerender, container } = render(
            <FormDialog
                isOpen={true}
                onClose={onClose}
                title="Assegnazione Massiva"
                defaultValues={{ startDate: '2026-01-01', endDate: '2026-01-31' }}
                onSubmit={onSubmit}
                fields={fields}
                schema={schema}
            />
        );

        let inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="date"]'));
        expect(inputs[0].value).toBe('2026-01-01');

        // L'utente modifica un valore...
        fireEvent.change(inputs[0], { target: { value: '2026-03-15' } });
        expect(inputs[0].value).toBe('2026-03-15');

        // ...poi la modale viene chiusa e riaperta con nuovi defaultValues
        // (es. apertura per un'altra assegnazione): il form deve ripartire
        // dai nuovi valori, non da quelli della sessione precedente.
        rerender(
            <FormDialog
                isOpen={false}
                onClose={onClose}
                title="Assegnazione Massiva"
                defaultValues={{ startDate: '2026-01-01', endDate: '2026-01-31' }}
                onSubmit={onSubmit}
                fields={fields}
                schema={schema}
            />
        );
        rerender(
            <FormDialog
                isOpen={true}
                onClose={onClose}
                title="Assegnazione Massiva"
                defaultValues={{ startDate: '2026-06-01', endDate: '2026-06-30' }}
                onSubmit={onSubmit}
                fields={fields}
                schema={schema}
            />
        );

        inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="date"]'));
        expect(inputs[0].value).toBe('2026-06-01');
        expect(inputs[1].value).toBe('2026-06-30');
    });

    it('invia i valori correnti alla submit e chiude la modale', () => {
        const onSubmit = vi.fn();
        const onClose = vi.fn();

        const { container } = render(
            <FormDialog
                isOpen={true}
                onClose={onClose}
                title="Assegnazione Massiva"
                defaultValues={{ startDate: '2026-02-01', endDate: '2026-02-28' }}
                onSubmit={onSubmit}
                fields={fields}
                schema={schema}
            />
        );

        fireEvent.click(screen.getByText('Salva'));

        expect(onSubmit).toHaveBeenCalledWith({ startDate: '2026-02-01', endDate: '2026-02-28' });
        expect(onClose).toHaveBeenCalled();
        expect(container).toBeTruthy();
    });
});
