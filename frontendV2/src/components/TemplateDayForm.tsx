import React, { useState, useEffect, useCallback } from 'react';
import { TemplateDayEntry, WorkOrder, WorkType, TaskPreviewOut } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Icon from './common/Icon';
import Input from './common/Input';
import * as api from '../api';
import { getCookie, setCookie } from '../utils/cookies';

interface TemplateDayFormProps {
  companyId: number;
  userId: number;
  onClose: () => void;
}

const TemplateDayForm: React.FC<TemplateDayFormProps> = ({ companyId, userId, onClose }) => {
    const [entries, setEntries] = useState<TemplateDayEntry[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
    const cookieName = `profitechnik_template_day_${companyId}_${userId}`;

    useEffect(() => {
        const loadInitialData = async () => {
            const [woData, wtData] = await Promise.all([
                api.getWorkOrders(companyId),
                api.getWorkTypes(companyId)
            ]);
            setWorkOrders(woData.filter(wo => wo.status !== 'completed' && wo.status !== 'billed'));
            setWorkTypes(wtData);

            const savedTemplate = getCookie(cookieName);
            if (savedTemplate) {
                try {
                    setEntries(JSON.parse(savedTemplate));
                } catch (e) {
                    console.error("Failed to parse template cookie", e);
                }
            }
        };
        loadInitialData();
    }, [companyId, cookieName]);

    const handleAddEntry = () => {
        setEntries([...entries, {
            id: `new-${Date.now()}`,
            workOrderId: '', taskId: '', workTypeId: '',
            startTime: '08:00', endTime: '12:00',
            breakMinutes: 0, isOvertime: false, notes: ''
        }]);
    };

    const handleRemoveEntry = (id: string) => {
        setEntries(entries.filter(e => e.id !== id));
    };

    const handleEntryChange = (id: string, field: keyof TemplateDayEntry, value: any) => {
        setEntries(entries.map(e => {
            if (e.id === id) {
                const updatedEntry = { ...e, [field]: value };
                // Reset task if work order changes
                if (field === 'workOrderId') {
                    updatedEntry.taskId = '';
                }
                return updatedEntry;
            }
            return e;
        }));
    };

    const handleSaveTemplate = () => {
        // Basic validation
        for (const entry of entries) {
            if (!entry.workOrderId || !entry.taskId || !entry.workTypeId) {
                alert('Prosím, vyplňte zakázku, úkol a druh práce pro všechny položky.');
                return;
            }
        }
        setCookie(cookieName, JSON.stringify(entries), 365);
        alert('Vzorový den byl uložen.');
        onClose();
    };
    
    const getTasksForWorkOrder = (workOrderId: string): TaskPreviewOut[] => {
        if (!workOrderId) return [];
        return workOrders.find(wo => wo.id === parseInt(workOrderId, 10))?.tasks || [];
    };

    return (
        <Modal title="Nastavení vzorového dne" onClose={onClose}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Definujte si typický pracovní den. Tuto šablonu pak můžete jedním klikem vložit do docházky pro libovolný den.
                </p>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {entries.map((entry, index) => (
                        <div key={entry.id} className="p-3 border rounded-md bg-slate-50 relative">
                            <button onClick={() => handleRemoveEntry(entry.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                                <Icon name="fa-trash" />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="space-y-2">
                                    <label className="text-xs font-semibold">Zakázka</label>
                                    <select value={entry.workOrderId} onChange={e => handleEntryChange(entry.id, 'workOrderId', e.target.value)} className="w-full text-sm p-1.5 border rounded">
                                        <option value="">-- Vybrat --</option>
                                        {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.name}</option>)}
                                    </select>
                               </div>
                               <div className="space-y-2">
                                    <label className="text-xs font-semibold">Úkol</label>
                                    <select value={entry.taskId} onChange={e => handleEntryChange(entry.id, 'taskId', e.target.value)} className="w-full text-sm p-1.5 border rounded" disabled={!entry.workOrderId}>
                                        <option value="">-- Vybrat --</option>
                                        {getTasksForWorkOrder(entry.workOrderId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                               </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold">Druh práce</label>
                                    <select value={entry.workTypeId} onChange={e => handleEntryChange(entry.id, 'workTypeId', e.target.value)} className="w-full text-sm p-1.5 border rounded">
                                        <option value="">-- Vybrat --</option>
                                        {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                     <div className="space-y-2"><label className="text-xs font-semibold">Od</label><Input type="time" value={entry.startTime} onChange={e => handleEntryChange(entry.id, 'startTime', e.target.value)} className="!py-1.5 text-sm" /></div>
                                     <div className="space-y-2"><label className="text-xs font-semibold">Do</label><Input type="time" value={entry.endTime} onChange={e => handleEntryChange(entry.id, 'endTime', e.target.value)} className="!py-1.5 text-sm" /></div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold">Poznámka</label>
                                    <Input value={entry.notes} onChange={e => handleEntryChange(entry.id, 'notes', e.target.value)} className="!py-1.5 text-sm" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <Button onClick={handleAddEntry} variant="secondary">
                    <Icon name="fa-plus" className="mr-2" /> Přidat další záznam
                </Button>
                <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
                    <Button type="button" onClick={handleSaveTemplate}>Uložit šablonu</Button>
                </div>
            </div>
        </Modal>
    );
};

export default TemplateDayForm;
