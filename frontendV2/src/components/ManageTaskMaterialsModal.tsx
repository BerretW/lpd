import React, { useState, useCallback, useEffect } from 'react';
import { WorkOrderOut, TaskOut } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Icon from './common/Icon';
import LogMaterialModal from './LogMaterialModal';
import * as api from '../api';
import ErrorMessage from './common/ErrorMessage';
import ConfirmModal from './common/ConfirmModal';

interface ManageTaskMaterialsModalProps {
    workOrder: WorkOrderOut;
    initialTask: TaskOut;
    companyId: number;
    onClose: () => void;
    onSaveSuccess: () => void;
}

const ManageTaskMaterialsModal: React.FC<ManageTaskMaterialsModalProps> = ({ workOrder, initialTask, companyId, onClose, onSaveSuccess }) => {
    const [task, setTask] = useState<TaskOut | null>(initialTask);
    const [isEditingMaterial, setIsEditingMaterial] = useState<any>(null);
    const [isLogMaterialOpen, setIsLogMaterialOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    useEffect(() => {
        // This is a sanity check for runtime values, as TypeScript can't guarantee them from an API.
        if (!workOrder || !initialTask) {
            setError("Chybí potřebná data pro zobrazení tohoto okna (zakázka nebo úkol).");
        }
    }, [workOrder, initialTask]);

    const refreshTask = useCallback(async () => {
        // Guard against calls if the initial data was bad.
        if (!workOrder || !task) return;
        try {
            setError(null);
            const updatedTask = await api.getTask(companyId, workOrder.id, task.id);
            setTask(updatedTask);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se znovu načíst data úkolu.');
        }
    }, [companyId, workOrder, task]); // Depend on whole objects for safety

    const handleUpdateUsedItem = async (usedItemId: number, newQuantity: number) => {
        if (!workOrder || !task) return;
        setError(null);
        try {
            await api.updateUsedItemForTask(companyId, workOrder.id, task.id, usedItemId, newQuantity);
            await refreshTask();
        } catch (err) {
            setError(err instanceof Error ? err.message : `Chyba při aktualizaci materiálu.`);
        }
        setIsEditingMaterial(null);
    };
    
    const handleDeleteUsedItem = (usedItemId: number) => {
        setItemToDelete(usedItemId);
    };

    const executeDelete = async () => {
        if (!workOrder || !task || itemToDelete === null) return;
        
        setError(null);
        try {
            await api.deleteUsedItemFromTask(companyId, workOrder.id, task.id, itemToDelete);
            await refreshTask();
        } catch (err) {
            setError(err instanceof Error ? err.message : `Chyba při mazání materiálu.`);
        } finally {
            setItemToDelete(null);
        }
    };

    const handleAddNewMaterial = () => {
        setIsLogMaterialOpen(false);
        refreshTask();
    }
    
    // Main render guard to prevent crash.
    if (!task || !workOrder) {
         return (
            <Modal title="Chyba načítání" onClose={onClose}>
                <div>
                    <ErrorMessage message={error || "Data pro správu materiálu nelze načíst."} />
                    <div className="flex justify-end pt-6">
                        <Button onClick={onClose}>Zavřít</Button>
                    </div>
                </div>
            </Modal>
        );
    }

    return (
        <>
            <Modal title={`Správa materiálu: ${task.name}`} onClose={onClose}>
                <div className="space-y-4">
                    <ErrorMessage message={error} />
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-slate-800">Použitý materiál</h3>
                        <Button variant="secondary" onClick={() => setIsLogMaterialOpen(true)}>
                            <Icon name="fa-plus" className="mr-2" /> Přidat materiál
                        </Button>
                    </div>
                    
                    {task.used_items.length > 0 ? (
                        <ul className="text-sm space-y-2 border rounded-md p-2 max-h-80 overflow-y-auto">
                            {task.used_items.map(item => (
                                 <li key={item.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded">
                                     <span className="text-slate-700">{item.inventory_item.name} ({item.inventory_item.sku})</span>
                                     <div className="flex items-center space-x-3">
                                         {isEditingMaterial?.id === item.id ? (
                                             <input 
                                                 type="number"
                                                 defaultValue={item.quantity}
                                                 onBlur={(e) => handleUpdateUsedItem(item.id, Number(e.target.value))}
                                                 onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateUsedItem(item.id, Number((e.target as HTMLInputElement).value)) }}
                                                 className="w-20 p-1 text-sm border rounded"
                                                 autoFocus
                                             />
                                         ) : (
                                            <span onClick={() => setIsEditingMaterial(item)} className="cursor-pointer font-semibold text-slate-800 p-1 min-w-[3rem] text-center">{item.quantity} ks</span>
                                         )}
                                         <button onClick={() => handleDeleteUsedItem(item.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1"><Icon name="fa-trash-alt"/></button>
                                     </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center p-8 border-2 border-dashed rounded-lg">
                            <p className="text-sm text-slate-500 italic">K tomuto úkolu zatím nebyl přiřazen žádný materiál.</p>
                        </div>
                    )}

                     <div className="flex justify-end pt-6">
                        <Button onClick={onClose}>
                            Zavřít
                        </Button>
                    </div>
                </div>
            </Modal>
            
            {isLogMaterialOpen && (
                <LogMaterialModal
                    companyId={companyId}
                    workOrderId={workOrder.id}
                    taskId={task.id}
                    existingMaterials={task.used_items}
                    onClose={() => setIsLogMaterialOpen(false)}
                    onSaveSuccess={handleAddNewMaterial}
                />
            )}
            
            {itemToDelete !== null && (
                <ConfirmModal
                    title="Potvrdit smazání"
                    message="Opravdu chcete odebrat tento materiál z úkolu?"
                    onConfirm={executeDelete}
                    onCancel={() => setItemToDelete(null)}
                />
            )}
        </>
    );
};

export default ManageTaskMaterialsModal;