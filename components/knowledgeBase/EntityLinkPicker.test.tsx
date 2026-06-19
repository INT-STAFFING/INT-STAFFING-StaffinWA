/* @vitest-environment jsdom */
/**
 * @file components/knowledgeBase/EntityLinkPicker.test.tsx
 * @description Test unitari per il selettore di collegamento alle entità.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import EntityLinkPicker from './EntityLinkPicker';
import type { LinkedEntity, LinkedEntityType } from '../../types/knowledgeBase';
import type { Option } from '../forms/types';

// jsdom non implementa scrollIntoView, usato internamente da SearchableSelect.
beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const optionsByType: Record<LinkedEntityType, Option[]> = {
    risorsa: [{ value: 'r1', label: 'Mario Rossi' }, { value: 'r2', label: 'Luigi Bianchi' }],
    competenza: [{ value: 's1', label: 'React' }],
    progetto: [{ value: 'p1', label: 'Progetto Alpha' }],
    contratto: [{ value: 'ct1', label: 'Contratto Beta' }],
    cliente: [{ value: 'c1', label: 'Acme' }],
};

const renderPicker = (value: LinkedEntity[], onChange = vi.fn()) => {
    render(
        <MemoryRouter>
            <EntityLinkPicker value={value} onChange={onChange} optionsByType={optionsByType} />
        </MemoryRouter>
    );
    return onChange;
};

describe('EntityLinkPicker', () => {
    it('renderizza un selettore per ciascun tipo di entità', () => {
        renderPicker([]);
        expect(screen.getByText('Risorse')).toBeDefined();
        expect(screen.getByText('Competenze')).toBeDefined();
        expect(screen.getByText('Progetti')).toBeDefined();
        expect(screen.getByText('Contratti')).toBeDefined();
        expect(screen.getByText('Clienti')).toBeDefined();
    });

    it('aggiunge un\'entità quando se ne seleziona una dal selettore', () => {
        const onChange = renderPicker([]);
        // Apre il selettore Risorse e seleziona la prima opzione.
        fireEvent.click(screen.getByText('Aggiungi risorsa...'));
        fireEvent.click(screen.getByText('Mario Rossi'));
        expect(onChange).toHaveBeenCalledWith([
            { entityType: 'risorsa', entityId: 'r1', label: 'Mario Rossi' },
        ]);
    });

    it('mostra i chip delle entità già collegate con possibilità di rimozione', () => {
        const value: LinkedEntity[] = [{ entityType: 'progetto', entityId: 'p1', label: 'Progetto Alpha' }];
        const onChange = renderPicker(value);
        expect(screen.getByText('Entità collegate (1)')).toBeDefined();
        const removeBtn = screen.getByLabelText('Rimuovi collegamento: Progetto Alpha');
        fireEvent.click(removeBtn);
        expect(onChange).toHaveBeenCalledWith([]);
    });

    it('esclude dalle opzioni le entità già collegate', () => {
        const value: LinkedEntity[] = [{ entityType: 'risorsa', entityId: 'r1', label: 'Mario Rossi' }];
        renderPicker(value);
        fireEvent.click(screen.getByText('Aggiungi risorsa...'));
        // Mario Rossi compare solo nel chip, non più tra le opzioni del listbox.
        const listbox = screen.getByRole('listbox');
        expect(within(listbox).queryByText('Mario Rossi')).toBeNull();
        expect(within(listbox).getByText('Luigi Bianchi')).toBeDefined();
    });
});
