/**
 * @file Modal.tsx
 * @description Componente generico per la visualizzazione di finestre modali.
 */

import React, { ReactNode, useEffect, useId, useRef } from 'react';

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

    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        dialogRef.current?.focus();
    }, []);

    return (
        // Backdrop: overlay scuro che copre la pagina, con padding per non far toccare i bordi alla modale.
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim bg-opacity-50 p-4 animate-fade-in"
            onClick={onClose}
            role="presentation"
        >
            <div
                // Contenitore della modale: impedisce la propagazione del click, gestisce il layout verticale e l'overflow.
                className="bg-surface-container-high rounded-2xl shadow-xl w-full max-w-lg mx-auto flex flex-col max-h-[90vh] animate-scale-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                ref={dialogRef}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        onClose();
                    }
                }}
            >
                {/* Header: non si restringe e rimane sempre visibile in alto. */}
                <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-outline-variant">
                    <h3 id={titleId} className="text-xl font-semibold text-on-surface">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-full p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        aria-label="Chiudi modale"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                {/* Area del contenuto: diventa scorrevole se il contenuto è troppo alto. */}
                <div id={descriptionId} className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;