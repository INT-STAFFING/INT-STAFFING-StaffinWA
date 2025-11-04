/**
 * @file Modal.tsx
 * @description Componente generico per la visualizzazione di finestre modali.
 */

import React, { ReactNode } from 'react';
import { XMarkIcon } from './icons';

/**
 * @interface ModalProps
 * @description Prop per il componente Modal.
 */
interface ModalProps {
    /** @property {boolean} isOpen - Controlla la visibilità della modale. */
    isOpen: boolean;
    /** @property {() => void} onClose - Funzione callback chiamata quando la modale deve essere chiusa (es. click sul backdrop o sul pulsante di chiusura). */
    onClose: () => void;
    /** @property {string} title - Il titolo visualizzato nell'intestazione della modale. */
    title: string;
    /** @property {ReactNode} children - Il contenuto (elementi React) da visualizzare all'interno della modale. */
    children: ReactNode;
}

/**
 * Un componente modale riutilizzabile che mostra un overlay e una finestra di dialogo.
 * Gestisce l'apertura/chiusura e contiene uno slot per contenuti personalizzati.
 * @param {ModalProps} props - Le prop del componente.
 * @returns {React.ReactElement | null} Il componente modale se `isOpen` è true, altrimenti null.
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    const handleBackdropClick = () => onClose();

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur px-4 py-8 animate-fade-in"
            onClick={handleBackdropClick}
            role="presentation"
        >
            <div
                className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border/60 dark:border-dark-border/60 bg-card dark:bg-dark-card shadow-soft animate-scale-in"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="flex items-start justify-between gap-6 border-b border-border/60 dark:border-dark-border/60 px-6 py-5">
                    <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Dialogo</p>
                        <h3 id="modal-title" className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-transparent text-muted-foreground transition-colors hover:text-foreground hover:border-border"
                        aria-label="Chiudi modale"
                        type="button"
                    >
                        <XMarkIcon className="w-5 h-5" aria-hidden />
                    </button>
                </div>
                <div className="px-6 py-6 overflow-y-auto max-h-[70vh]">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;