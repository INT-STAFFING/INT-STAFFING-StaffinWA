/* @vitest-environment jsdom */
/**
 * @file components/__tests__/DataTable.test.tsx
 * @description Test unitari per gli stati vuoti di DataTable.
 * Verifica la distinzione tra "dataset realmente vuoto" e "nessun risultato per i filtri",
 * e che l'azione "Azzera filtri" ripristini le righe (criticità R-D3 / E-10 dell'audit di design).
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DataTable, ColumnDef } from '../DataTable';

afterEach(cleanup);

interface Row { id: string; name: string; }

const columns: ColumnDef<Row>[] = [
    { header: 'Nome', sortKey: 'name', cell: (r) => r.name },
];

const renderRow = (r: Row) => (
    <tr key={r.id}><td>{r.name}</td><td>azioni</td></tr>
);
const renderMobileCard = (r: Row) => <div key={r.id}>{r.name}</div>;

const makeProps = (data: Row[]) => ({
    title: 'Elementi',
    addNewButtonLabel: 'Aggiungi',
    data,
    columns,
    filtersNode: <div />,
    onAddNew: vi.fn(),
    renderRow,
    renderMobileCard,
});

describe('DataTable – stati vuoti', () => {
    it('dataset realmente vuoto: mostra lo stato "Nessun elemento presente" con azione di creazione', () => {
        const props = makeProps([]);
        render(<DataTable<Row> {...props} />);
        // Reso sia in desktop che mobile → almeno un'occorrenza
        expect(screen.getAllByText('Nessun elemento presente').length).toBeGreaterThan(0);
        // Non deve menzionare i filtri quando non ce ne sono
        expect(screen.queryByText('Nessun risultato')).toBeNull();
        // L'azione primaria invita a creare
        expect(screen.getAllByRole('button', { name: 'Aggiungi' }).length).toBeGreaterThan(0);
    });

    it('filtri attivi senza corrispondenze: mostra "Nessun risultato" e "Azzera filtri" che ripristina le righe', () => {
        const props = makeProps([{ id: '1', name: 'Mario Rossi' }]);
        render(<DataTable<Row> {...props} />);

        // La riga è inizialmente visibile
        expect(screen.getAllByText('Mario Rossi').length).toBeGreaterThan(0);

        // Digita un filtro di colonna che non matcha nulla
        const filterInput = screen.getAllByPlaceholderText('Filtra...')[0];
        fireEvent.change(filterInput, { target: { value: 'zzz-non-esiste' } });

        // Ora lo stato vuoto è quello "da filtro"
        expect(screen.getAllByText('Nessun risultato').length).toBeGreaterThan(0);
        const clearBtn = screen.getAllByRole('button', { name: 'Azzera filtri' })[0];

        // Azzerando i filtri la riga riappare
        fireEvent.click(clearBtn);
        expect(screen.getAllByText('Mario Rossi').length).toBeGreaterThan(0);
        expect(screen.queryByText('Nessun risultato')).toBeNull();
    });

    it('rispetta un emptyMessage personalizzato quando il dataset è vuoto e non ci sono filtri', () => {
        const props = makeProps([]);
        render(<DataTable<Row> {...props} emptyMessage={<div>Messaggio su misura</div>} />);
        expect(screen.getAllByText('Messaggio su misura').length).toBeGreaterThan(0);
        expect(screen.queryByText('Nessun elemento presente')).toBeNull();
    });
});
