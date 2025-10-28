/**
 * @file Modal.tsx
 * @description Componente generico per la visualizzazione di finestre modali.
 */

import React, { ReactNode, useEffect, useRef } from 'react';

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
 * Gestisce l'apertura/chiusura, l'accessibilità (focus trap, escape key) e contiene uno slot per contenuti personalizzati.
 * @param {ModalProps} props - Le prop del componente.
 * @returns {React.ReactElement | null} Il componente modale se `isOpen` è true, altrimenti null.
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedElement = useRef<HTMLElement | null>(null);
    const titleId = `modal-title-${React.useId()}`;

    useEffect(() => {
        if (!isOpen) return;

        previouslyFocusedElement.current = document.activeElement as HTMLElement;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
            if (event.key === 'Tab') {
                const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusableElements || focusableElements.length === 0) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (event.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        event.preventDefault();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        event.preventDefault();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        
        // Focus the first focusable element in the modal
        const timer = setTimeout(() => {
             const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            firstFocusable?.focus();
        }, 100);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timer);
            previouslyFocusedElement.current?.focus();
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fade-in" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <div 
                ref={modalRef}
                className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg mx-auto flex flex-col max-h-full animate-scale-in" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-border dark:border-dark-border">
                    <h3 id={titleId} className="text-xl font-semibold text-foreground dark:text-dark-foreground">{title}</h3>
                    <button 
                        onClick={onClose} 
                        className="text-muted-foreground hover:bg-muted dark:hover:bg-dark-muted hover:text-foreground dark:hover:text-dark-foreground rounded-lg text-sm p-1.5"
                        aria-label="Chiudi modale"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
