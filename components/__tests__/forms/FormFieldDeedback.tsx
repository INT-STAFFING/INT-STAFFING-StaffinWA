import React from 'react';

interface FormFieldFeedbackProps {
    error?: string;
    helperText?: string;
}

export const FormFieldFeedback: React.FC<FormFieldFeedbackProps> = ({ error, helperText }) => {
    if (error) {
        return (
            <p className="mt-1 text-sm text-error" role="alert">
                {error}
            </p>
        );
    }

    if (helperText) {
        return (
            <p className="mt-1 text-sm text-on-surface-variant">
                {helperText}
            </p>
        );
    }

    return null;
};

export default FormFieldFeedback;