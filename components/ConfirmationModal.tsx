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
            <div className="text-gray-700 dark:text-gray-300">
                {message}
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isConfirming}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                    {cancelButtonText}
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isConfirming}
                    className="flex justify-center items-center px-4 py-2 bg-accent-red text-white rounded-md hover:opacity-90 disabled:opacity-50"
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