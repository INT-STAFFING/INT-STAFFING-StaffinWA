import React from 'react';

interface FormFieldFeedbackProps {
    error?: string;
    helperText?: string;
    id?: string;
}

export const FormFieldFeedback: React.FC<FormFieldFeedbackProps> = ({ error, helperText, id }) => {
    if (error) {
        return (
            <p className="mt-1 text-sm text-error" role="alert" id={id}>
                {error}
            </p>
        );
    }

    if (helperText) {
        return (
            <p className="mt-1 text-sm text-on-surface-variant" id={id}>
                {helperText}
            </p>
        );
    }

    return null;
};

export default FormFieldFeedback;
