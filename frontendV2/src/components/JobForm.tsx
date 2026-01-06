import React, { useState, useEffect } from 'react';
import { WorkOrder, Client } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import * as api from '../api';
import ErrorMessage from './common/ErrorMessage';

interface JobFormProps {
  onSave: (newWorkOrder: WorkOrder) => void;
  onCancel: () => void;
  companyId: number;
  workOrder?: WorkOrder; // Optional for editing
}

const JobForm: React.FC<JobFormProps> = ({ onSave, onCancel, companyId, workOrder }) => {
    const [name, setName] = useState(workOrder?.name || '');
    const [clientId, setClientId] = useState<string>(workOrder?.client_id?.toString() || '');
    const [description, setDescription] = useState(workOrder?.description || '');
    const [budgetHours, setBudgetHours] = useState(workOrder?.budget_hours?.toString() || '');
    const [clients, setClients] = useState<Client[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.getClients(companyId)
          .then(setClients)
          .catch(err => setError("Nepodařilo se načíst seznam klientů."));
    }, [companyId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const payload = {
                name,
                description,
                client_id: clientId ? parseInt(clientId, 10) : undefined,
                budget_hours: budgetHours ? parseFloat(budgetHours) : undefined,
            };
            if (workOrder) {
                // Update logic
                const updatedWO = await api.updateWorkOrder(companyId, workOrder.id, payload);
                onSave(updatedWO);
            } else {
                // Create logic
                const newWO = await api.createWorkOrder(companyId, payload);
                onSave(newWO);
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : `Uložení selhalo`);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <ErrorMessage message={error} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                    label="Název zakázky"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                />
                 <Input
                    label="Budget hodin"
                    type="number"
                    step="0.1"
                    value={budgetHours}
                    onChange={e => setBudgetHours(e.target.value)}
                    placeholder="např. 40.5"
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zákazník</label>
                <select 
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                >
                    <option value="">-- Bez zákazníka --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Popis</label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    className="w-full p-2 border border-slate-300 rounded-md bg-white text-slate-900 shadow-sm focus:ring-red-500 focus:border-red-500"
                />
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel}>Zrušit</Button>
                <Button type="submit">Uložit zakázku</Button>
            </div>
        </form>
    );
};

export default JobForm;