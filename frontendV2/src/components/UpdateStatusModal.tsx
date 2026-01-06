import React, { useState } from 'react';
import { WorkOrderOut } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import ErrorMessage from './common/ErrorMessage';

interface UpdateStatusModalProps {
    workOrder: WorkOrderOut;
    onClose: () => void;
    onSave: (newStatus: string) => Promise<void>;
}

const statusOptions = [
    { value: 'new', label: 'Nová' },
    { value: 'in_progress', label: 'Probíhá' },
    { value: 'completed', label: 'Hotovo' },
    { value: 'billed', label: 'Fakturováno' },
];

const UpdateStatusModal: React.FC<UpdateStatusModalProps> = ({ workOrder, onClose, onSave }) => {
    const [newStatus, setNewStatus] = useState(workOrder.status);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await onSave(newStatus);
            onClose();
        } catch (error) {
            setError(error instanceof Error ? error.message : `Failed to update status`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal title={`Změnit stav zakázky: ${workOrder.name}`} onClose={onClose}>
            <div className="space-y-4">
                <ErrorMessage message={error} />
                <div>
                    <label htmlFor="status-select" className="block text-sm font-medium text-slate-700 mb-1">
                        Nový stav
                    </label>
                    <select
                        id="status-select"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    >
                        {statusOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                        Zrušit
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? 'Ukládání...' : 'Uložit změnu'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default UpdateStatusModal;