import React from 'react';
import Modal from './Modal';
import { SpinnerIcon } from './icons';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string | React.ReactNode;
    confirmButtonText?: string;
    cancelButtonText?: string;
    isConfirming?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmButtonText = 'Conferma',
    cancelButtonText = 'Annulla',
    isConfirming = false,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="text-foreground dark:text-dark-foreground">
                {message}
            </div>
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="mt-[var(--space-6)] flex justify-end space-x-[var(--space-3)]">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isConfirming}
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    className="px-[var(--space-4)] py-[var(--space-2)] border border-border dark:border-dark-border rounded-md hover:bg-muted dark:hover:bg-dark-muted disabled:opacity-50"
                >
                    {cancelButtonText}
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isConfirming}
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    className="flex justify-center items-center px-[var(--space-4)] py-[var(--space-2)] bg-destructive text-white rounded-md hover:opacity-90 disabled:opacity-50"
                >
                    {isConfirming ? (
                       // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                       <SpinnerIcon className="w-[var(--space-5)] h-[var(--space-5)]"/>
                    ) : (
                        confirmButtonText
                    )}
                </button>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;