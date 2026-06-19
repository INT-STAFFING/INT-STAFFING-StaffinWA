/* @vitest-environment jsdom */
/**
 * @file components/knowledgeBase/LinkedEntityChips.test.tsx
 * @description Test unitari per i chip delle entità collegate.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import LinkedEntityChips from './LinkedEntityChips';
import type { LinkedEntity } from '../../types/knowledgeBase';

afterEach(cleanup);

const entities: LinkedEntity[] = [
    { entityType: 'risorsa', entityId: 'r1', label: 'Mario Rossi' },
    { entityType: 'progetto', entityId: 'p1', label: 'Progetto Alpha' },
];

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('LinkedEntityChips', () => {
    it('renderizza un chip per ogni entità collegata con la sua label', () => {
        renderWithRouter(<LinkedEntityChips entities={entities} />);
        expect(screen.getByText('Mario Rossi')).toBeDefined();
        expect(screen.getByText('Progetto Alpha')).toBeDefined();
    });

    it('i chip cliccabili puntano alla rotta dell\'entità', () => {
        renderWithRouter(<LinkedEntityChips entities={entities} />);
        const resourceLink = screen.getByText('Mario Rossi').closest('a');
        expect(resourceLink?.getAttribute('href')).toContain('/resources?editId=r1');
    });

    it('non renderizza nulla se non ci sono entità', () => {
        const { container } = renderWithRouter(<LinkedEntityChips entities={[]} />);
        expect(container.querySelector('a')).toBeNull();
    });

    it('mostra il pulsante di rimozione e invoca onRemove quando fornito', () => {
        const onRemove = vi.fn();
        renderWithRouter(<LinkedEntityChips entities={entities} onRemove={onRemove} />);
        const removeButtons = screen.getAllByLabelText(/Rimuovi collegamento/);
        expect(removeButtons).toHaveLength(2);
        fireEvent.click(removeButtons[0]);
        expect(onRemove).toHaveBeenCalledWith(entities[0]);
    });

    it('in modalità rimozione i chip non sono link di navigazione', () => {
        const { container } = renderWithRouter(<LinkedEntityChips entities={entities} onRemove={vi.fn()} />);
        expect(container.querySelector('a')).toBeNull();
    });
});
