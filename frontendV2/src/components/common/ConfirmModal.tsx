import React from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Smazat',
  cancelText = 'Zrušit',
}) => {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="text-slate-700">
        <div className="text-center">
            <Icon name="fa-exclamation-triangle" className="text-4xl text-yellow-500 mb-4" />
        </div>
        <p className="text-center text-lg">{message}</p>
        <div className="flex justify-center mt-8 space-x-4">
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button onClick={onConfirm} variant="primary">
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
