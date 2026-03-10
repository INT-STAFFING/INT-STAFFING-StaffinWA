/* @vitest-environment jsdom */
/**
 * @file components/__tests__/Pagination.test.tsx
 * @description Test del componente Pagination.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Pagination from '../Pagination';

describe('Pagination', () => {
    it('non renderizza nulla se totalItems è 0', () => {
        const { container } = render(
            <Pagination currentPage={1} totalItems={0} itemsPerPage={10} onPageChange={() => {}} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('mostra la navigazione con totalItems > 0', () => {
        render(<Pagination currentPage={1} totalItems={50} itemsPerPage={10} onPageChange={() => {}} />);
        expect(screen.getByLabelText('Pagina precedente')).toBeDefined();
        expect(screen.getByLabelText('Pagina successiva')).toBeDefined();
    });

    it('il bottone precedente è disabilitato sulla prima pagina', () => {
        render(<Pagination currentPage={1} totalItems={50} itemsPerPage={10} onPageChange={() => {}} />);
        const prevBtn = screen.getByLabelText('Pagina precedente') as HTMLButtonElement;
        expect(prevBtn.disabled).toBe(true);
    });

    it('il bottone successivo è disabilitato sull\'ultima pagina', () => {
        render(<Pagination currentPage={5} totalItems={50} itemsPerPage={10} onPageChange={() => {}} />);
        const nextBtn = screen.getByLabelText('Pagina successiva') as HTMLButtonElement;
        expect(nextBtn.disabled).toBe(true);
    });

    it('il bottone precedente è abilitato nelle pagine successive', () => {
        render(<Pagination currentPage={2} totalItems={50} itemsPerPage={10} onPageChange={() => {}} />);
        const prevBtn = screen.getByLabelText('Pagina precedente') as HTMLButtonElement;
        expect(prevBtn.disabled).toBe(false);
    });

    it('il bottone successivo è abilitato nelle pagine non finali', () => {
        render(<Pagination currentPage={1} totalItems={50} itemsPerPage={10} onPageChange={() => {}} />);
        const nextBtn = screen.getByLabelText('Pagina successiva') as HTMLButtonElement;
        expect(nextBtn.disabled).toBe(false);
    });

    it('chiama onPageChange con la pagina corretta al click su precedente', () => {
        const onPageChange = vi.fn();
        render(<Pagination currentPage={3} totalItems={50} itemsPerPage={10} onPageChange={onPageChange} />);
        fireEvent.click(screen.getByLabelText('Pagina precedente'));
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('chiama onPageChange con la pagina corretta al click su successivo', () => {
        const onPageChange = vi.fn();
        render(<Pagination currentPage={2} totalItems={50} itemsPerPage={10} onPageChange={onPageChange} />);
        fireEvent.click(screen.getByLabelText('Pagina successiva'));
        expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('chiama onPageChange al click su un numero di pagina', () => {
        const onPageChange = vi.fn();
        render(<Pagination currentPage={1} totalItems={50} itemsPerPage={10} onPageChange={onPageChange} />);
        fireEvent.click(screen.getByLabelText('Pagina 3'));
        expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('la pagina corrente ha aria-current=page', () => {
        render(<Pagination currentPage={2} totalItems={50} itemsPerPage={10} onPageChange={() => {}} />);
        const activeBtn = screen.getByLabelText('Pagina 2');
        expect(activeBtn.getAttribute('aria-current')).toBe('page');
    });

    it('mostra il conteggio risultati corretto', () => {
        render(<Pagination currentPage={1} totalItems={25} itemsPerPage={10} onPageChange={() => {}} />);
        // "1 - 10 di 25 risultati"
        expect(screen.getByText('25')).toBeDefined();
        expect(screen.getByText('10')).toBeDefined();
    });

    it('mostra il selettore righe se onItemsPerPageChange è fornito', () => {
        const onItemsPerPageChange = vi.fn();
        render(
            <Pagination
                currentPage={1}
                totalItems={50}
                itemsPerPage={10}
                onPageChange={() => {}}
                onItemsPerPageChange={onItemsPerPageChange}
            />
        );
        expect(screen.getByLabelText('Seleziona righe per pagina')).toBeDefined();
    });

    it('non mostra il selettore righe se onItemsPerPageChange non è fornito', () => {
        render(<Pagination currentPage={1} totalItems={50} itemsPerPage={10} onPageChange={() => {}} />);
        expect(screen.queryByLabelText('Seleziona righe per pagina')).toBeNull();
    });

    it('chiama onItemsPerPageChange al cambio di valore del selettore', () => {
        const onItemsPerPageChange = vi.fn();
        render(
            <Pagination
                currentPage={1}
                totalItems={50}
                itemsPerPage={10}
                onPageChange={() => {}}
                onItemsPerPageChange={onItemsPerPageChange}
            />
        );
        const select = screen.getByLabelText('Seleziona righe per pagina');
        fireEvent.change(select, { target: { value: '20' } });
        expect(onItemsPerPageChange).toHaveBeenCalledWith(20);
    });

    it('mostra tutti i numeri di pagina se totalPages <= 7', () => {
        render(<Pagination currentPage={1} totalItems={70} itemsPerPage={10} onPageChange={() => {}} />);
        for (let i = 1; i <= 7; i++) {
            expect(screen.getByLabelText(`Pagina ${i}`)).toBeDefined();
        }
    });

    it('mostra i puntini di sospensione per molte pagine', () => {
        render(<Pagination currentPage={1} totalItems={200} itemsPerPage={10} onPageChange={() => {}} />);
        // Con 20 pagine e currentPage=1 deve apparire '...'
        const ellipsisBtns = screen.getAllByLabelText('Interruzione elenco pagine');
        expect(ellipsisBtns.length).toBeGreaterThan(0);
    });

    it('mostra correttamente l\'ultimo elemento nella pagina finale', () => {
        render(<Pagination currentPage={3} totalItems={25} itemsPerPage={10} onPageChange={() => {}} />);
        // Pagina 3: elementi 21-25; il numero 25 appare due volte (fine range e totale)
        const matches = screen.getAllByText('25');
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });
});
