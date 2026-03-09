/* @vitest-environment jsdom */
/**
 * @file components/__tests__/ConfirmationModal.test.tsx
 * @description Test del componente ConfirmationModal.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmationModal from '../ConfirmationModal';

describe('ConfirmationModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        title: 'Conferma eliminazione',
        message: 'Sei sicuro di voler eliminare questo elemento?',
    };

    it('non renderizza nulla se isOpen è false', () => {
        const { container } = render(<ConfirmationModal {...defaultProps} isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });

    it('mostra il titolo quando è aperta', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByText('Conferma eliminazione')).toBeDefined();
    });

    it('mostra il messaggio', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByText('Sei sicuro di voler eliminare questo elemento?')).toBeDefined();
    });

    it('mostra il testo di default "Conferma" per il bottone di conferma', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByText('Conferma')).toBeDefined();
    });

    it('mostra il testo di default "Annulla" per il bottone di annullamento', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByText('Annulla')).toBeDefined();
    });

    it('usa il testo personalizzato per il bottone di conferma', () => {
        render(<ConfirmationModal {...defaultProps} confirmButtonText="Elimina definitivamente" />);
        expect(screen.getByText('Elimina definitivamente')).toBeDefined();
    });

    it('usa il testo personalizzato per il bottone di annullamento', () => {
        render(<ConfirmationModal {...defaultProps} cancelButtonText="Torna indietro" />);
        expect(screen.getByText('Torna indietro')).toBeDefined();
    });

    it('chiama onConfirm al click sul bottone di conferma', () => {
        const onConfirm = vi.fn();
        render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} />);
        fireEvent.click(screen.getByText('Conferma'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('chiama onClose al click sul bottone di annullamento', () => {
        const onClose = vi.fn();
        render(<ConfirmationModal {...defaultProps} onClose={onClose} />);
        fireEvent.click(screen.getByText('Annulla'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('disabilita i bottoni durante isConfirming=true', () => {
        render(<ConfirmationModal {...defaultProps} isConfirming={true} />);
        const annullaBtn = screen.getByText('Annulla') as HTMLButtonElement;
        expect(annullaBtn.disabled).toBe(true);
    });

    it('non disabilita i bottoni con isConfirming=false (default)', () => {
        render(<ConfirmationModal {...defaultProps} />);
        const annullaBtn = screen.getByText('Annulla') as HTMLButtonElement;
        expect(annullaBtn.disabled).toBe(false);
    });

    it('il bottone di conferma ha classe bg-error', () => {
        render(<ConfirmationModal {...defaultProps} />);
        const confirmBtn = screen.getByText('Conferma');
        expect(confirmBtn.className).toContain('bg-error');
    });

    it('accetta un ReactNode come messaggio', () => {
        const message = <span data-testid="rich-message">Elemento: <strong>Progetto Alpha</strong></span>;
        render(<ConfirmationModal {...defaultProps} message={message} />);
        expect(screen.getByTestId('rich-message')).toBeDefined();
        expect(screen.getByText('Progetto Alpha')).toBeDefined();
    });
});
