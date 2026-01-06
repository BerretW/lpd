import React from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';

interface ErrorModalProps {
  title: string;
  message: string;
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ title, message, onClose }) => {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-center p-4">
        <Icon name="fa-exclamation-triangle" className="text-5xl text-red-500 mb-4" />
        <p className="text-lg text-slate-700 mb-6 whitespace-pre-wrap">{message}</p>
        <Button onClick={onClose} className="w-1/2">
            Rozumím
        </Button>
      </div>
    </Modal>
  );
};

export default ErrorModal;
