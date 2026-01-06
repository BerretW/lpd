import React from 'react';
import Icon from './Icon';

interface ErrorMessageProps {
  message: string | null;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="p-3 my-2 text-sm text-red-800 bg-red-100 rounded-lg border border-red-200" role="alert">
      <Icon name="fa-exclamation-circle" className="mr-2" />
      <span className="font-medium">Chyba:</span> {message}
    </div>
  );
};

export default ErrorMessage;
