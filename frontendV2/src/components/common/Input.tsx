import React from 'react';

// Base props common to all variants
interface BaseInputProps {
  label?: string;
  id?: string;
  className?: string;
}

// Props specific to standard <input> elements
type InputElementProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'checkbox' | 'radio' | 'file' | 'search' | 'tel' | 'url';
};

// Props specific to <select> elements
type SelectElementProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    type: 'select';
};

// Props specific to <textarea> elements
type TextareaElementProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    type: 'textarea';
};

// Discriminated union of all possible props
type InputProps = BaseInputProps & (InputElementProps | SelectElementProps | TextareaElementProps);

const Input: React.FC<InputProps> = ({ label, id, className = '', ...props }) => {
    const finalId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
    const commonClasses = `w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${className}`;
  
    let element: React.ReactNode;

    // We check the 'type' from props to decide which element to render
    if (props.type === 'select') {
        const { type, ...selectProps } = props as SelectElementProps;
        element = <select id={finalId} className={commonClasses} {...selectProps} />;
    } else if (props.type === 'textarea') {
        const { type, ...textareaProps } = props as TextareaElementProps;
        element = <textarea id={finalId} className={commonClasses} {...textareaProps} />;
    } else {
        // Default to a standard input element
        const inputProps = props as InputElementProps;
        element = <input id={finalId} className={commonClasses} {...inputProps} />;
    }
  
    return (
        <div>
            {label && (
                <label htmlFor={finalId} className="block text-sm font-medium text-slate-700 mb-1">
                    {label}
                </label>
            )}
            {element}
        </div>
    );
};

export default Input;
