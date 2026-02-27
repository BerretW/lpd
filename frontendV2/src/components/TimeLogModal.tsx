import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TimeLogOut, TimeLogEntryType, WorkOrderOut, WorkTypeOut, TaskPreviewOut, TimeLogCreateIn } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Input from './common/Input';
import ErrorMessage from './common/ErrorMessage';
import * as api from '../api';
// --- ZMĚNA: Import ExtensionPoint ---
import { ExtensionPoint } from '../lib/PluginSystem';

interface TimeLogModalProps {
    date: Date;
    entryType: TimeLogEntryType;
    timeLog?: TimeLogOut;
    initialData?: any;
    onClose: () => void;
    onSave: () => void;
    companyId: number;
    dailyLogs: TimeLogOut[];
}

const TimeLogModal: React.FC<TimeLogModalProps> = ({ date, entryType, timeLog, initialData, onClose, onSave, companyId, dailyLogs }) => {
    // ... (stávající state proměnné) ...
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('16:30');
    const [notes, setNotes] = useState('');
    const [workOrderId, setWorkOrderId] = useState<string>('');
    const [taskId, setTaskId] = useState<string>('');
    const [workTypeId, setWorkTypeId] = useState<string>('');
    const [breakMinutes, setBreakMinutes] = useState(0);
    const [isOvertime, setIsOvertime] = useState(false);
    
    const [isCreatingNewTask, setIsCreatingNewTask] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');

    const [workOrdersWithHours, setWorkOrdersWithHours] = useState<(WorkOrderOut & { worked_hours: number })[]>([]);
    const [workTypes, setWorkTypes] = useState<WorkTypeOut[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- ZMĚNA: Ref pro uložení akcí z pluginů ---
    // Pluginy se sem zaregistrují a my je zavoláme po úspěšném uložení docházky
    const postSaveActions = useRef<(() => Promise<void>)[]>([]);

    const registerPostSaveAction = (action: () => Promise<void>) => {
        postSaveActions.current.push(action);
    };
    // ---------------------------------------------

    const isWorkEntry = entryType === TimeLogEntryType.Work;

    // ... (stávající useEffecty pro načítání dat zůstávají stejné) ...
    useEffect(() => {
        const loadDropdownData = async () => {
            if (!isWorkEntry) {
                setLoading(false);
                return;
            }
            try {
                const [woData, wtData] = await Promise.all([
                    api.getWorkOrders(companyId),
                    api.getWorkTypes(companyId),
                ]);
                setWorkTypes(wtData);
                
                const reportPromises = woData.map(wo => 
                    api.getBillingReport(companyId, wo.id).catch(() => ({ total_hours: 0 }))
                );
                const reports = await Promise.all(reportPromises);
                const woWithHours = woData.map((wo, index) => ({
                    ...wo,
                    worked_hours: reports[index].total_hours,
                })).filter(wo => wo.status !== 'completed' && wo.status !== 'billed');

                setWorkOrdersWithHours(woWithHours);

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nepodařilo se načíst data pro formulář.');
            } finally {
                setLoading(false);
            }
        };

        loadDropdownData();
    }, [companyId, isWorkEntry]);

    useEffect(() => {
        if (timeLog) {
            setStartTime(timeLog.start_time.substring(11, 16));
            setEndTime(timeLog.end_time.substring(11, 16));
            setNotes(timeLog.notes || '');
            if (isWorkEntry) {
                setBreakMinutes(timeLog.break_duration_minutes || 0);
                setIsOvertime(timeLog.is_overtime || false);
                setWorkTypeId(timeLog.work_type_id?.toString() || '');
                if (timeLog.task?.id) {
                    setTaskId(timeLog.task.id.toString());
                    const parentWO = workOrdersWithHours.find(wo => wo.tasks.some(t => t.id === timeLog.task!.id));
                    if (parentWO) {
                        setWorkOrderId(parentWO.id.toString());
                    }
                }
            }
        } else if (initialData) {
            if (initialData.startTime) setStartTime(initialData.startTime);
            if (initialData.endTime) setEndTime(initialData.endTime);
            if (initialData.notes) setNotes(initialData.notes);
        }
    }, [timeLog, initialData, isWorkEntry, workOrdersWithHours]);

    const availableTasks = useMemo((): TaskPreviewOut[] => {
        if (!workOrderId) return [];
        return workOrdersWithHours.find(wo => wo.id === parseInt(workOrderId, 10))?.tasks || [];
    }, [workOrderId, workOrdersWithHours]);

    const toggleCreateNewTask = () => {
        if (isCreatingNewTask) {
            setNewTaskName('');
        } else {
            setTaskId('');
        }
        setIsCreatingNewTask(!isCreatingNewTask);
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const toYYYYMMDD = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const dateString = toYYYYMMDD(date);
        const startISOString = `${dateString}T${startTime}:00.000Z`;
        const endISOString = `${dateString}T${endTime}:00.000Z`;

        if (new Date(endISOString) <= new Date(startISOString)) {
            setError('Konečný čas musí být po počátečním čase.');
            return;
        }

        const payload: TimeLogCreateIn = {
            entry_type: entryType,
            start_time: startISOString,
            end_time: endISOString,
            notes: notes || null,
        };

        if (isWorkEntry) {
            if (isCreatingNewTask) {
                if (!workOrderId || !newTaskName) {
                    setError('Pro vytvoření nového úkolu musíte vybrat zakázku a zadat jeho název.');
                    return;
                }
                payload.task_id = null;
                payload.new_task = {
                    work_order_id: parseInt(workOrderId, 10),
                    name: newTaskName,
                };
            } else {
                if (!workOrderId || !taskId) {
                    setError('Pro pracovní záznam musíte vybrat zakázku a úkol.');
                    return;
                }
                payload.task_id = parseInt(taskId, 10);
                payload.new_task = null;
            }
            if (!workTypeId) {
                setError('Prosím vyberte druh práce.');
                return;
            }
            payload.work_type_id = parseInt(workTypeId, 10);
            payload.break_duration_minutes = breakMinutes;
            payload.is_overtime = isOvertime;
        }
        
        try {
            if (timeLog) {
                await api.updateTimeLog(companyId, timeLog.id, payload);
            } else {
                await api.createTimeLog(companyId, payload);
            }

            // --- ZMĚNA: Spuštění akcí z pluginů ---
            // Tady se zavolá náš plugin pro zápis auta, pokud je aktivní
            if (postSaveActions.current.length > 0) {
                await Promise.all(postSaveActions.current.map(action => action()));
            }
            // --------------------------------------

            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení záznamu se nezdařilo.');
        }
    };
    
    const title = timeLog ? 'Upravit záznam' : 'Nový záznam';

    // Helper to find selected work order details (for the plugin)
    const selectedWorkOrder = workOrdersWithHours.find(wo => wo.id.toString() === workOrderId);

    return (
        <Modal title={title} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <ErrorMessage message={error} />
                
                {isWorkEntry && (
                    <>
                        {/* ... (stávající kód formuláře) ... */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Zakázka</label>
                            <select value={workOrderId} onChange={e => { setWorkOrderId(e.target.value); setTaskId(''); setNewTaskName(''); setIsCreatingNewTask(false); }} className="w-full p-2 border rounded bg-white text-slate-900" disabled={loading}>
                                <option value="">-- Vybrat zakázku --</option>
                                {workOrdersWithHours.map(wo => {
                                    const remaining = wo.budget_hours != null ? `(Zbývá: ${(wo.budget_hours - wo.worked_hours).toFixed(1)} hod)` : '';
                                    return <option key={wo.id} value={wo.id}>{wo.name} {remaining}</option>
                                })}
                            </select>
                        </div>
                         <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-slate-700">Úkol</label>
                                {workOrderId && (
                                    <button type="button" onClick={toggleCreateNewTask} className="text-xs text-red-600 hover:underline focus:outline-none">
                                        {isCreatingNewTask ? 'Vybrat existující' : 'Vytvořit nový'}
                                    </button>
                                )}
                            </div>
                            {isCreatingNewTask ? (
                                <Input 
                                    value={newTaskName}
                                    onChange={e => setNewTaskName(e.target.value)}
                                    placeholder="Zadejte název nového úkolu"
                                    required
                                />
                            ) : (
                                <select value={taskId} onChange={e => setTaskId(e.target.value)} className="w-full p-2 border rounded bg-white text-slate-900" disabled={!workOrderId}>
                                    <option value="">-- Vybrat úkol --</option>
                                    {availableTasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            )}
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Druh práce</label>
                            <select value={workTypeId} onChange={e => setWorkTypeId(e.target.value)} className="w-full p-2 border rounded bg-white text-slate-900" disabled={loading}>
                                <option value="">-- Vybrat druh práce --</option>
                                {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name} ({wt.rate} Kč/h)</option>)}
                            </select>
                        </div>
                    </>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Input label="Začátek" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                    <Input label="Konec" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                </div>
                
                {isWorkEntry && (
                    <div className="grid grid-cols-2 gap-4 items-center">
                        <Input label="Pauza (minuty)" type="number" value={breakMinutes} onChange={e => setBreakMinutes(Number(e.target.value))} min="0" />
                        <div className="flex items-center pt-6">
                             <input type="checkbox" id="isOvertime" checked={isOvertime} onChange={e => setIsOvertime(e.target.checked)} className="h-4 w-4 rounded" />
                             <label htmlFor="isOvertime" className="ml-2 font-medium text-slate-800">Práce přesčas</label>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Poznámky</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-slate-900"></textarea>
                </div>

                {/* --- ZMĚNA: Zde vkládáme ExtensionPoint --- */}
                {/* Ten umožní pluginům vykreslit svá pole (např. knihu jízd) */}
                {isWorkEntry && (
                    <ExtensionPoint 
                        name="time-log-form-fields" 
                        context={{ 
                            companyId, 
                            workOrder: selectedWorkOrder, // Předáváme vybranou zakázku, aby plugin věděl adresu
                            date,
                            registerPostSaveAction
                        }} 
                    />
                )}
                {/* ------------------------------------------- */}
                
                <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
                    <Button type="submit" disabled={isWorkEntry && loading}>Uložit</Button>
                </div>
            </form>
        </Modal>
    );
};

export default TimeLogModal;