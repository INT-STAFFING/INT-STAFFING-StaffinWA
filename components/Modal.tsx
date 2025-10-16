/**
 * @file Modal.tsx
 * @description Componente generico per la visualizzazione di finestre modali.
 */

import React, { ReactNode } from 'react';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fade-in" onClick={onClose}>
            <div 
                // Contenitore della modale: impedisce la propagazione del click, gestisce il layout verticale e l'overflow.
                className="bg-primary-light dark:bg-primary-dark rounded-lg shadow-xl w-full max-w-lg mx-auto flex flex-col max-h-full animate-scale-in" 
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header: non si restringe e rimane sempre visibile in alto. */}
                <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-white/20">
                    <h3 className="text-xl font-semibold text-primary-dark dark:text-primary-light">{title}</h3>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white rounded-lg text-sm p-1.5"
                        aria-label="Chiudi modale"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                </div>
                {/* Area del contenuto: diventa scorrevole se il contenuto è troppo alto. */}
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;