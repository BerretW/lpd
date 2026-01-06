import React, { useState } from 'react';
import { WorkOrderOut } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Input from './common/Input';
import Icon from './common/Icon';

export interface InvoiceConfig {
    type: 'all' | 'date' | 'tasks';
    startDate?: string;
    endDate?: string;
    selectedTaskIds?: number[];
}

interface InvoiceConfigModalProps {
    workOrder: WorkOrderOut;
    onClose: () => void;
    onGenerate: (config: InvoiceConfig) => void;
    isGenerating: boolean;
}

const InvoiceConfigModal: React.FC<InvoiceConfigModalProps> = ({ workOrder, onClose, onGenerate, isGenerating }) => {
    const [type, setType] = useState<'all' | 'date' | 'tasks'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);

    const handleTaskSelection = (taskId: number) => {
        setSelectedTaskIds(prev =>
            prev.includes(taskId)
                ? prev.filter(id => id !== taskId)
                : [...prev, taskId]
        );
    };

    const handleSubmit = () => {
        onGenerate({ type, startDate, endDate, selectedTaskIds });
    };

    const unbilledTasks = workOrder.tasks.filter(t => t.status !== 'billed');

    return (
        <Modal title="Konfigurace faktury" onClose={onClose}>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Rozsah fakturace</label>
                    <div className="flex space-x-2 bg-slate-200 p-1 rounded-lg">
                        <button onClick={() => setType('all')} className={`w-full p-2 rounded-md font-semibold text-sm transition-colors ${type === 'all' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Celá zakázka</button>
                        <button onClick={() => setType('date')} className={`w-full p-2 rounded-md font-semibold text-sm transition-colors ${type === 'date' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Dle období</button>
                        <button onClick={() => setType('tasks')} className={`w-full p-2 rounded-md font-semibold text-sm transition-colors ${type === 'tasks' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Dle úkolů</button>
                    </div>
                </div>

                {type === 'date' && (
                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-md bg-slate-50">
                        <Input label="Od data" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <Input label="Do data" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                )}

                {type === 'tasks' && (
                    <div className="p-4 border rounded-md bg-slate-50">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Vyberte úkoly k fakturaci</label>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                            {unbilledTasks.length > 0 ? unbilledTasks.map(task => (
                                <div key={task.id} className="flex items-center p-2 bg-white rounded-md">
                                    <input
                                        type="checkbox"
                                        id={`task-${task.id}`}
                                        checked={selectedTaskIds.includes(task.id)}
                                        onChange={() => handleTaskSelection(task.id)}
                                        className="h-4 w-4 rounded"
                                    />
                                    <label htmlFor={`task-${task.id}`} className="ml-3 text-sm text-slate-800">{task.name}</label>
                                </div>
                            )) : <p className="text-sm text-slate-500 italic">Všechny úkoly již byly fakturovány.</p>}
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isGenerating}>Zrušit</Button>
                    <Button type="button" onClick={handleSubmit} disabled={isGenerating || (type === 'tasks' && selectedTaskIds.length === 0)}>
                        {isGenerating ? <><Icon name="fa-spinner fa-spin" className="mr-2" /> Generuji...</> : 'Vygenerovat náhled'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default InvoiceConfigModal;