/* @vitest-environment jsdom */
/**
 * @file components/__tests__/ConfirmationModal.test.tsx
 * @description Test unitari per ConfirmationModal.
 * Verifica apertura/chiusura, pulsanti, stato isConfirming e testi predefiniti.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import ConfirmationModal from '../ConfirmationModal';

afterEach(cleanup);

const makeProps = () => ({
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Conferma eliminazione',
    message: 'Sei sicuro di voler eliminare questo elemento?',
});

// alias per brevità
let defaultProps: ReturnType<typeof makeProps>;
beforeEach(() => { defaultProps = makeProps(); });

describe('ConfirmationModal – rendering', () => {
    it('non renderizza nulla quando isOpen=false', () => {
        const { container } = render(<ConfirmationModal {...defaultProps} isOpen={false} />);
        // Il modal non deve avere role=dialog visibile
        expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it('renderizza il titolo quando isOpen=true', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByText('Conferma eliminazione')).toBeDefined();
    });

    it('renderizza il messaggio testuale', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByText('Sei sicuro di voler eliminare questo elemento?')).toBeDefined();
    });

    it('renderizza un ReactNode come messaggio', () => {
        render(
            <ConfirmationModal
                {...defaultProps}
                message={<span data-testid="custom-msg">Messaggio personalizzato</span>}
            />
        );
        expect(screen.getByTestId('custom-msg')).toBeDefined();
    });

    it('usa i testi predefiniti per i pulsanti (Conferma / Annulla)', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByText('Conferma')).toBeDefined();
        expect(screen.getByText('Annulla')).toBeDefined();
    });

    it('accetta testi personalizzati per i pulsanti', () => {
        render(
            <ConfirmationModal
                {...defaultProps}
                confirmButtonText="Elimina"
                cancelButtonText="Torna indietro"
            />
        );
        expect(screen.getByText('Elimina')).toBeDefined();
        expect(screen.getByText('Torna indietro')).toBeDefined();
    });
});

describe('ConfirmationModal – interazioni', () => {
    it('chiama onConfirm cliccando il pulsante di conferma', () => {
        const onConfirm = vi.fn();
        render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} />);
        fireEvent.click(screen.getByText('Conferma'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('chiama onClose cliccando il pulsante Annulla', () => {
        const onClose = vi.fn();
        render(<ConfirmationModal {...defaultProps} onClose={onClose} />);
        fireEvent.click(screen.getByText('Annulla'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('chiama onClose cliccando il pulsante X del modal header', () => {
        const onClose = vi.fn();
        render(<ConfirmationModal {...defaultProps} onClose={onClose} />);
        const closeBtn = screen.getByLabelText('Chiudi modale');
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('ConfirmationModal – stato isConfirming', () => {
    it('disabilita entrambi i pulsanti quando isConfirming=true', () => {
        render(<ConfirmationModal {...defaultProps} isConfirming />);
        const buttons = screen.getAllByRole('button').filter(b => b.getAttribute('aria-label') !== 'Chiudi modale');
        buttons.forEach(btn => {
            expect((btn as HTMLButtonElement).disabled).toBe(true);
        });
    });

    it('mostra lo spinner invece del testo di conferma quando isConfirming=true', () => {
        const { container } = render(<ConfirmationModal {...defaultProps} isConfirming />);
        // Il testo "Conferma" non deve essere visibile
        expect(screen.queryByText('Conferma')).toBeNull();
        // Deve esserci un SVG (SpinnerIcon)
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('i pulsanti non sono disabilitati di default', () => {
        render(<ConfirmationModal {...defaultProps} />);
        const annullaBtn = screen.getByText('Annulla') as HTMLButtonElement;
        const confermaBtn = screen.getByText('Conferma') as HTMLButtonElement;
        expect(annullaBtn.disabled).toBe(false);
        expect(confermaBtn.disabled).toBe(false);
    });
});
