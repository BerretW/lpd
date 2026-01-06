import React, { useState, useEffect } from 'react';
import { TaskOut } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import ErrorMessage from './common/ErrorMessage';
import * as api from '../api';

interface TaskFormProps {
  task: TaskOut;
  companyId: number;
  workOrderId: number;
  onSave: () => void;
  onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ task, companyId, workOrderId, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (task) {
            setName(task.name);
            setDescription(task.description || '');
        }
    }, [task]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);

        try {
            await api.updateTask(companyId, workOrderId, task.id, { name, description });
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <ErrorMessage message={error} />
            <Input
                label="Název úkolu"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={isSaving}
            />
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Popis</label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    className="w-full p-2 border border-slate-300 rounded-md bg-white text-slate-900 shadow-sm focus:ring-red-500 focus:border-red-500"
                    disabled={isSaving}
                />
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
                    Zrušit
                </Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Ukládání...' : 'Uložit změny'}
                </Button>
            </div>
        </form>
    );
};

export default TaskForm;
