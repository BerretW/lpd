import React, { useState } from 'react';
import { TaskOut, MemberOut, WorkOrderOut, ServiceReportOut, RoleEnum } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Icon from './common/Icon';
import ConfirmModal from './common/ConfirmModal';
import Modal from './common/Modal';
import LogMaterialModal from './LogMaterialModal';
import ServiceReportForm from './ServiceReportForm';
import * as api from '../api';
import { useAuth } from '../AuthContext';
import { useI18n } from '../I18nContext';

const statusColors: { [key: string]: string } = {
    new: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
    billed: 'bg-purple-100 text-purple-800',
};

interface TaskItemProps {
    task: TaskOut;
    onAssign: (taskId: number, assigneeId: number | null) => void;
    onEdit: (task: TaskOut) => void;
    onStatusChange: (taskId: number, status: string) => void;
    members: MemberOut[];
    workOrder: WorkOrderOut;
    companyId: number;
    refreshWorkOrder: () => void;
    onError: (message: string) => void;
    serviceReports: ServiceReportOut[];
    onServiceReportSaved: () => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
    task, onAssign, onEdit, onStatusChange, members, workOrder,
    companyId, refreshWorkOrder, onError, serviceReports, onServiceReportSaved,
}) => {
    const { t, translations } = useI18n();
    const { role } = useAuth();
    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;

    const [isEditingMaterial, setIsEditingMaterial] = useState<any>(null);
    const [isLogMaterialOpen, setIsLogMaterialOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [reportModal, setReportModal] = useState<ServiceReportOut | 'new' | null>(null);

    const handleUpdateUsedItem = async (usedItemId: number, newQuantity: number) => {
        try {
            await api.updateUsedItemForTask(companyId, workOrder.id, task.id, usedItemId, newQuantity);
            refreshWorkOrder();
        } catch (error) {
            onError(error instanceof Error ? error.message : `Failed to update material`);
        }
        setIsEditingMaterial(null);
    };

    const handleDeleteUsedItem = (usedItemId: number) => {
        setItemToDelete(usedItemId);
    };

    const executeDelete = async () => {
        if (itemToDelete === null) return;
        try {
            await api.deleteUsedItemFromTask(companyId, workOrder.id, task.id, itemToDelete);
            refreshWorkOrder();
        } catch (error) {
            onError(error instanceof Error ? error.message : `Failed to delete material`);
        } finally {
            setItemToDelete(null);
        }
    };

    return (
        <Card className="mb-4">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-lg font-semibold text-slate-900">{task.name}</h4>
                    <p className="text-sm text-slate-500">{task.description}</p>
                    <div className="mt-2">
                        {isAdmin ? (
                            <select
                                value={task.status}
                                onChange={(e) => onStatusChange(task.id, e.target.value)}
                                className={`text-xs p-1 border rounded font-semibold ${statusColors[task.status] || 'bg-gray-100 text-gray-800'}`}
                            >
                                {Object.keys(translations.jobs.status).map((key) => (
                                    <option key={key} value={key}>{t(`jobs.status.${key}`)}</option>
                                ))}
                            </select>
                        ) : (
                            <span className={`px-2 py-1 rounded-full font-semibold text-xs ${statusColors[task.status] || 'bg-gray-100 text-gray-800'}`}>
                                {t(`jobs.status.${task.status}`) || task.status}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <select
                        value={task.assignee?.id || ''}
                        onChange={(e) => onAssign(task.id, e.target.value ? parseInt(e.target.value) : null)}
                        className="text-xs p-1 border border-slate-300 rounded bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    >
                        <option value="">{t('jobs.unassigned')}</option>
                        {members.map(m => <option key={m.user.id} value={m.user.id}>{m.user.email}</option>)}
                    </select>
                    <Button variant="secondary" className="!text-xs !py-1 !px-2" onClick={() => onEdit(task)} title={t('jobs.editTask')}>
                        <Icon name="fa-pencil-alt" />
                    </Button>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                    <h5 className="font-semibold text-sm text-slate-800">{t('jobs.usedMaterial')}</h5>
                    <Button variant="secondary" className="!text-xs !py-1 !px-2" onClick={() => setIsLogMaterialOpen(true)}>
                        <Icon name="fa-plus" className="mr-1" /> {t('jobs.add')}
                    </Button>
                </div>
                {task.used_items.length > 0 ? (
                    <ul className="text-sm space-y-1">
                        {task.used_items.map(item => (
                            <li key={item.id} className="flex justify-between items-center p-1 hover:bg-slate-50 rounded">
                                <span className="text-slate-700">{item.inventory_item.name} ({item.inventory_item.sku})</span>
                                <div className="flex items-center space-x-2">
                                    {isEditingMaterial?.id === item.id ? (
                                        <input
                                            type="number"
                                            defaultValue={item.quantity}
                                            onBlur={(e) => handleUpdateUsedItem(item.id, Number(e.target.value))}
                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateUsedItem(item.id, Number((e.target as HTMLInputElement).value))}
                                            className="w-16 p-1 text-xs border rounded"
                                            autoFocus
                                        />
                                    ) : (
                                        <span onClick={() => setIsEditingMaterial(item)} className="cursor-pointer font-semibold text-slate-800">{item.quantity} ks</span>
                                    )}
                                    <button onClick={() => handleDeleteUsedItem(item.id)} className="text-red-500 hover:text-red-700 text-xs"><Icon name="fa-trash-alt" /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-xs text-slate-500 italic">{t('jobs.noMaterialUsed')}</p>}
            </div>

            {/* ── Servisní listy ── */}
            <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <h5 className="font-semibold text-sm text-slate-800">Servisní listy</h5>
                        {serviceReports.length > 0 ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                                {serviceReports.length}
                            </span>
                        ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                žádný
                            </span>
                        )}
                    </div>
                    <Button variant="secondary" className="!text-xs !py-1 !px-2" onClick={() => setReportModal('new')}>
                        <Icon name="fa-plus" className="mr-1" /> Přidat
                    </Button>
                </div>
                {serviceReports.length > 0 && (
                    <ul className="text-sm space-y-1">
                        {serviceReports.map(sr => (
                            <li key={sr.id} className="flex justify-between items-center p-1.5 hover:bg-slate-50 rounded-md group">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Icon name="fa-file-alt" className="text-slate-400 text-xs flex-shrink-0" />
                                    <span className="text-slate-700 truncate">
                                        {new Date(sr.date).toLocaleDateString('cs-CZ')}
                                    </span>
                                    <span className="text-slate-400 text-xs whitespace-nowrap">
                                        {sr.work_hours} h · {sr.technicians.join(', ')}
                                    </span>
                                    {sr.work_type.length > 0 && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 whitespace-nowrap">
                                            {sr.work_type.join(', ')}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setReportModal(sr)}
                                    className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 hover:underline flex-shrink-0 ml-2 transition-opacity"
                                >
                                    <Icon name="fa-edit" className="mr-1" />Upravit
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {isLogMaterialOpen && (
                <LogMaterialModal
                    companyId={companyId}
                    workOrderId={workOrder.id}
                    taskId={task.id}
                    existingMaterials={task.used_items}
                    onClose={() => setIsLogMaterialOpen(false)}
                    onSaveSuccess={() => { setIsLogMaterialOpen(false); refreshWorkOrder(); }}
                />
            )}
            {itemToDelete !== null && (
                <ConfirmModal
                    title={t('jobs.confirmDeleteMaterialTitle')}
                    message={t('jobs.confirmDeleteMaterialMessage')}
                    onConfirm={executeDelete}
                    onCancel={() => setItemToDelete(null)}
                />
            )}
            {reportModal !== null && (
                <Modal
                    title={reportModal === 'new'
                        ? `Nový servisní list – ${task.name}`
                        : `Upravit servisní list – ${new Date((reportModal as ServiceReportOut).date).toLocaleDateString('cs-CZ')}`
                    }
                    onClose={() => setReportModal(null)}
                >
                    <ServiceReportForm
                        workOrder={workOrder}
                        task={task}
                        existingReport={reportModal === 'new' ? undefined : reportModal as ServiceReportOut}
                        onSave={() => {
                            setReportModal(null);
                            onServiceReportSaved();
                        }}
                    />
                </Modal>
            )}
        </Card>
    );
};

export default TaskItem;
