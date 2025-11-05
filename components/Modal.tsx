/**
 * @file Modal.tsx
 * @description Componente generico per la visualizzazione di finestre modali.
 */

import React, { ReactNode } from 'react';
import Icon from './Icon';

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
    // Non renderizzare nulla se la modale non è aperta.
    if (!isOpen) return null;

    return (
        // Backdrop: overlay scuro che copre la pagina, con padding per non far toccare i bordi alla modale.
        // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-[var(--space-4)] animate-fade-in" onClick={onClose}>
            <div 
                // Contenitore della modale: impedisce la propagazione del click, gestisce il layout verticale e l'overflow.
                className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg mx-auto flex flex-col max-h-full animate-scale-in" 
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header: non si restringe e rimane sempre visibile in alto. */}
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <div className="flex-shrink-0 flex justify-between items-center p-[var(--space-4)] border-b border-border dark:border-dark-border">
                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                    <h3 className="text-[var(--font-size-xl)] font-semibold text-foreground dark:text-dark-foreground">{title}</h3>
                    <button 
                        onClick={onClose} 
                        // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                        className="text-muted-foreground hover:bg-muted dark:hover:bg-dark-muted hover:text-foreground dark:hover:text-dark-foreground rounded-full p-[var(--space-1-5)] transition-colors"
                        aria-label="Chiudi modale"
                    >
                        {/* MODIFICA: Sostituita emoji con icona vettoriale per coerenza. */}
                        <Icon name="X" size={20} />
                    </button>
                </div>
                {/* Area del contenuto: diventa scorrevole se il contenuto è troppo alto. */}
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <div className="p-[var(--space-6)] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;