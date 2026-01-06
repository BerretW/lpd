import React from 'react';

interface ModalProps {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ children, title, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b bg-gray-800 text-white rounded-t-lg">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-white">
            <i className="fas fa-times text-2xl"></i>
          </button>
        </header>
        <main className="p-6 overflow-y-auto bg-white text-slate-800">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Modal;