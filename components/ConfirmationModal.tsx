import React, { useEffect, useState } from 'react';
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
    /**
     * Se valorizzata, l'azione di conferma resta bloccata finché l'utente non
     * digita esattamente questa frase. Usata per le operazioni distruttive ad
     * alto impatto (es. svuotamento tabella), dove serve frizione intenzionale.
     */
    confirmPhrase?: string;
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
    confirmPhrase,
}) => {
    const [typed, setTyped] = useState('');

    // Azzera l'input ogni volta che il modale si apre/chiude, per non riusare
    // una conferma precedente.
    useEffect(() => {
        if (!isOpen) setTyped('');
    }, [isOpen]);

    const phraseRequired = Boolean(confirmPhrase);
    const phraseMatches = !phraseRequired || typed === confirmPhrase;
    const confirmDisabled = isConfirming || !phraseMatches;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="text-on-surface-variant">
                {message}
            </div>
            {phraseRequired && (
                <div className="mt-4">
                    <label htmlFor="confirm-phrase-input" className="block text-sm text-on-surface-variant mb-1">
                        Per procedere, digita <span className="font-mono font-bold text-error">{confirmPhrase}</span>
                    </label>
                    <input
                        id="confirm-phrase-input"
                        type="text"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        disabled={isConfirming}
                        autoComplete="off"
                        aria-label={`Digita ${confirmPhrase} per confermare`}
                        className="form-input w-full border-outline focus:border-error"
                    />
                </div>
            )}
            <div className="mt-6 flex justify-end space-x-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isConfirming}
                    className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container disabled:opacity-50 text-primary"
                >
                    {cancelButtonText}
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={confirmDisabled}
                    className="flex justify-center items-center px-6 py-2 bg-error text-on-error rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isConfirming ? (
                       <SpinnerIcon className="w-5 h-5"/>
                    ) : (
                        confirmButtonText
                    )}
                </button>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;