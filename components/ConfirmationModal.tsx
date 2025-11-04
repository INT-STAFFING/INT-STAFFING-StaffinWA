import React from 'react';
import Modal from './Modal';
import { SpinnerIcon, ShieldCheckIcon, XMarkIcon } from './icons';

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
            <div className="space-y-6">
                <div className="flex items-start gap-4 text-foreground dark:text-dark-foreground">
                    <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                        <ShieldCheckIcon className="w-6 h-6" aria-hidden />
                    </div>
                    <div className="space-y-2 text-sm leading-relaxed">
                        {typeof message === 'string' ? <p>{message}</p> : message}
                    </div>
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isConfirming}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-60"
                    >
                        <XMarkIcon className="w-4 h-4" aria-hidden />
                        {cancelButtonText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isConfirming}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-5 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.01] disabled:opacity-60"
                    >
                        {isConfirming ? <SpinnerIcon className="w-5 h-5" /> : confirmButtonText}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;