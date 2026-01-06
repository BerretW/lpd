
import React, { useState, useEffect, useCallback } from 'react';
import { WorkOrderOut, TaskOut, MemberOut, RoleEnum, BillingReportOut, WorkOrder, Company } from '../types';
import Button from './common/Button';
import Card from './common/Card';
import Modal from './common/Modal';
import Icon from './common/Icon';
import JobForm from './JobForm';
import Invoice from './Invoice';
import * as api from '../api';
import LogMaterialModal from './LogMaterialModal';
import UpdateStatusModal from './UpdateStatusModal';
import PeriodicInvoiceModal from './PeriodicInvoiceModal';
import ErrorModal from './common/ErrorModal';
import ConfirmModal from './common/ConfirmModal';
import TaskForm from './TaskForm'; // Import nového komponentu
import { useAuth } from '../AuthContext';
import { useI18n } from '../I18nContext';
import InvoiceConfigModal, { InvoiceConfig } from './InvoiceConfigModal';

interface JobsProps {
  companyId: number;
}

const statusColors: { [key: string]: string } = {
    new: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
    billed: 'bg-purple-100 text-purple-800',
};

// Fix: Define a specific type for a work order with full task details to resolve type inference issue.
interface FullWorkOrderOut extends Omit<WorkOrderOut, 'tasks'> {
    tasks: TaskOut[];
}

const BudgetDisplay: React.FC<{ budgetHours?: number | null; workedHours?: number | null; className?: string; }> = ({ budgetHours, workedHours, className }) => {
    const { t } = useI18n();

    if (budgetHours == null || budgetHours <= 0) {
        return null;
    }
    
    const worked = workedHours ?? 0;
    const remaining = budgetHours - worked;
    const percentage = Math.min(100, (worked / budgetHours) * 100);

    let progressColor = 'bg-green-500';
    if (percentage > 95) {
        progressColor = 'bg-red-500';
    } else if (percentage > 75) {
        progressColor = 'bg-yellow-500';
    }

    return (
        <div className={`mt-2 ${className}`}>
            <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
                <span><Icon name="fa-clock" className="mr-1" /> {t('dashboard.budget')}</span>
                <span className="font-semibold">
                    {t('dashboard.remaining', { remaining: remaining.toFixed(1), budget: budgetHours.toFixed(1) })}
                </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                    className={`${progressColor} h-2 rounded-full`} 
                    style={{ width: `${percentage}%` }}
                    title={t('dashboard.worked', { worked: worked.toFixed(1), percentage: percentage.toFixed(0) })}
                ></div>
            </div>
        </div>
    );
};

// Simplified Task Details component embedded within Jobs.tsx
const TaskItem: React.FC<{ 
    task: TaskOut, 
    onAssign: (taskId: number, assigneeId: number | null) => void,
    onEdit: (task: TaskOut) => void,
    onStatusChange: (taskId: number, status: string) => void,
    members: MemberOut[],
    workOrder: WorkOrderOut,
    companyId: number,
    refreshWorkOrder: () => void,
    onError: (message: string) => void;
}> = ({ task, onAssign, onEdit, onStatusChange, members, workOrder, companyId, refreshWorkOrder, onError }) => {
    // FIX: Destructure `translations` from `useI18n` to correctly access translation objects for iterating over status keys.
    const { t, translations } = useI18n();
    const { role } = useAuth();
    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;

    const [isEditingMaterial, setIsEditingMaterial] = useState<any>(null);
    const [isLogMaterialOpen, setIsLogMaterialOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const handleUpdateUsedItem = async (usedItemId: number, newQuantity: number) => {
        try {
            await api.updateUsedItemForTask(companyId, workOrder.id, task.id, usedItemId, newQuantity);
            refreshWorkOrder();
        } catch (error) {
            onError(error instanceof Error ? error.message : `Failed to update material`);
        }
        setIsEditingMaterial(null);
    }
    
    const handleDeleteUsedItem = (usedItemId: number) => {
        setItemToDelete(usedItemId);
    }

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
                                {/* FIX: Iterate over keys from the `translations` object directly, as the `t` function does not support returning objects. */}
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
                                     <button onClick={() => handleDeleteUsedItem(item.id)} className="text-red-500 hover:text-red-700 text-xs"><Icon name="fa-trash-alt"/></button>
                                 </div>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-xs text-slate-500 italic">{t('jobs.noMaterialUsed')}</p>}
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
        </Card>
    )
}

const Jobs: React.FC<JobsProps> = ({ companyId }) => {
  const { role } = useAuth();
  const { t } = useI18n();
  const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;

  const [workOrders, setWorkOrders] = useState<WorkOrderOut[]>([]);
  const [workedHoursMap, setWorkedHoursMap] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderOut | null>(null);
  const [fullSelectedWO, setFullSelectedWO] = useState<FullWorkOrderOut | null>(null);
  const [detailWorkedHours, setDetailWorkedHours] = useState<number | null>(null);
  
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrderOut | null>(null);
  const [editingTask, setEditingTask] = useState<TaskOut | null>(null); // Nový stav pro editaci úkolu
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [members, setMembers] = useState<MemberOut[]>([]);
  const [company, setCompany] = useState<Company | null>(null);

  // Invoicing state
  const [isInvoiceConfigOpen, setIsInvoiceConfigOpen] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [configuredBillingReport, setConfiguredBillingReport] = useState<BillingReportOut | null>(null);
  const [tasksToBill, setTasksToBill] = useState<number[]>([]);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [workOrderForStatus, setWorkOrderForStatus] = useState<WorkOrderOut | null>(null);
  const [isPeriodicInvoiceModalOpen, setIsPeriodicInvoiceModalOpen] = useState(false);

  
  const fetchData = useCallback(async () => {
    try {
        setLoading(true);
        const [woData, memberData, companyData] = await Promise.all([
            api.getWorkOrders(companyId),
            api.getMembers(companyId),
            api.getCompany(companyId)
        ]);
        setWorkOrders(woData);
        setMembers(memberData);
        setCompany(companyData);
        
        // Fetch worked hours for all work orders
        const reportPromises = woData.map(wo => 
            api.getBillingReport(companyId, wo.id).catch(e => {
                console.warn(`Could not fetch billing report for WO ${wo.id}:`, e);
                return { total_hours: 0 };
            })
        );
        const reports = await Promise.all(reportPromises);
        const hoursMap = new Map<number, number>();
        reports.forEach((report, index) => {
            const woId = woData[index].id;
            hoursMap.set(woId, report.total_hours);
        });
        setWorkedHoursMap(hoursMap);
        
        setError(null);
    } catch(err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
        setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const fetchFullWorkOrder = useCallback(async (workOrderId: number) => {
    if (!workOrderId) return;
    setDetailWorkedHours(null);
    try {
        const fullWO = await api.getWorkOrder(companyId, workOrderId);
        const taskPromises = fullWO.tasks.map(taskPreview => api.getTask(companyId, workOrderId, taskPreview.id));
        const detailedTasks = await Promise.all(taskPromises);
        setFullSelectedWO({ ...fullWO, tasks: detailedTasks });

        const report = await api.getBillingReport(companyId, workOrderId);
        setDetailWorkedHours(report.total_hours);
    } catch(err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch job details');
    }
  }, [companyId]);

  useEffect(() => {
    if (selectedWorkOrder) {
      fetchFullWorkOrder(selectedWorkOrder.id);
    } else {
      setFullSelectedWO(null);
      setDetailWorkedHours(null);
    }
  }, [selectedWorkOrder, fetchFullWorkOrder]);

  const handleSaveJob = (savedWorkOrder: WorkOrder) => {
    setIsJobFormOpen(false);
    setEditingWorkOrder(null);
    fetchData(); 
    if (selectedWorkOrder && selectedWorkOrder.id === savedWorkOrder.id) {
        setSelectedWorkOrder(savedWorkOrder);
    }
  };
  
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullSelectedWO && newTaskName) {
        try {
            await api.createTask(companyId, fullSelectedWO.id, { name: newTaskName });
            setNewTaskName('');
            setIsTaskFormOpen(false);
            fetchFullWorkOrder(fullSelectedWO.id);
        } catch(error) {
            setError(error instanceof Error ? error.message : `Failed to create task`);
        }
    }
  };
  
  const handleAssignTask = async (taskId: number, assigneeId: number | null) => {
    if (fullSelectedWO) {
        try {
            await api.assignTask(companyId, fullSelectedWO.id, taskId, assigneeId);
            fetchFullWorkOrder(fullSelectedWO.id);
        } catch(error) {
            setError(error instanceof Error ? error.message : `Failed to assign task`);
        }
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, status: string) => {
     if (fullSelectedWO) {
        try {
            await api.updateTask(companyId, fullSelectedWO.id, taskId, { status });
            fetchFullWorkOrder(fullSelectedWO.id);
        } catch(error) {
            setError(error instanceof Error ? error.message : `Failed to update task status`);
        }
    }
  }

  const handleSaveStatus = async (newStatus: string) => {
    if (!workOrderForStatus) return;
    try {
        await api.updateWorkOrderStatus(companyId, workOrderForStatus.id, newStatus);
        
        if (selectedWorkOrder?.id === workOrderForStatus.id) {
            setSelectedWorkOrder(null);
        }
        
        await fetchData();
    } catch (error) {
        setError(error instanceof Error ? error.message : 'Nepodařilo se aktualizovat stav zakázky.');
    }
  };

  const handleGenerateInvoicePreview = async (config: InvoiceConfig) => {
    if (!fullSelectedWO) return;

    setIsGeneratingInvoice(true);
    setError(null);
    try {
        const report = await api.getBillingReport(companyId, fullSelectedWO.id, config.startDate, config.endDate);
        
        let finalReport = report;
        let taskIdsToBill: number[] = [];

        if (config.type === 'tasks' && config.selectedTaskIds) {
            const selectedTaskNames = new Set(fullSelectedWO.tasks
                .filter(t => config.selectedTaskIds!.includes(t.id))
                .map(t => t.name));

            const filteredTimeLogs = report.time_logs.filter(log => selectedTaskNames.has(log.task_name));
            const filteredUsedItems = report.used_items.filter(item => selectedTaskNames.has(item.task_name));

            const total_price_work = filteredTimeLogs.reduce((sum, log) => sum + log.total_price, 0);
            const total_hours = filteredTimeLogs.reduce((sum, log) => sum + log.hours, 0);
            const total_price_inventory = filteredUsedItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
            const grand_total = total_price_work + total_price_inventory;
            
            finalReport = {
                ...report,
                time_logs: filteredTimeLogs,
                used_items: filteredUsedItems,
                total_hours,
                total_price_work,
                total_price_inventory,
                grand_total
            };
            taskIdsToBill = config.selectedTaskIds;

        } else if (config.type === 'all') {
            taskIdsToBill = fullSelectedWO.tasks.map(t => t.id);
        } else if (config.type === 'date') {
            const taskNamesInReport = new Set([...report.time_logs.map(l => l.task_name), ...report.used_items.map(i => i.task_name)]);
            taskIdsToBill = fullSelectedWO.tasks.filter(t => taskNamesInReport.has(t.name)).map(t => t.id);
        }
        
        setConfiguredBillingReport(finalReport);
        setTasksToBill(taskIdsToBill);
        setIsInvoiceConfigOpen(false);
        setIsInvoiceModalOpen(true);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Generování faktury selhalo.');
    } finally {
        setIsGeneratingInvoice(false);
    }
  };

  const handleMarkBilled = async () => {
    if (tasksToBill.length === 0 || !fullSelectedWO) return;

    setError(null);
    try {
        const updatePromises = tasksToBill.map(taskId => 
            api.updateTask(companyId, fullSelectedWO.id, taskId, { status: 'billed' })
        );
        await Promise.all(updatePromises);
        
        setIsInvoiceModalOpen(false);
        setConfiguredBillingReport(null);
        setTasksToBill([]);
        await fetchFullWorkOrder(fullSelectedWO.id);

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Nepodařilo se aktualizovat stav úkolů.');
    }
  };


  const renderWorkOrderList = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">{t('jobs.title')}</h1>
        {isAdmin && (
            <div className="flex space-x-2">
                <Button onClick={() => setIsPeriodicInvoiceModalOpen(true)} variant="secondary">
                    <Icon name="fa-calendar-alt" className="mr-2" /> {t('jobs.periodicBilling')}
                </Button>
                <Button onClick={() => { setEditingWorkOrder(null); setIsJobFormOpen(true); }}>
                  <Icon name="fa-plus" className="mr-2" /> {t('jobs.newJob')}
                </Button>
            </div>
        )}
      </div>
      <div className="space-y-6">
          {Object.entries(workOrders.reduce<Record<string, WorkOrderOut[]>>((acc, wo) => {
              (acc[wo.status] = acc[wo.status] || []).push(wo);
              return acc;
          }, {})).map(([status, wos]) => (
              <div key={status}>
                  <h2 className="text-xl font-semibold text-slate-700 mb-3 capitalize">{t(`jobs.status.${status}`) || status}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(wos as WorkOrderOut[]).map(wo => (
                           <Card key={wo.id} className="cursor-pointer hover:shadow-lg hover:border-red-500" onClick={() => setSelectedWorkOrder(wo)}>
                               <h3 className="font-bold text-slate-900">{wo.name}</h3>
                               <p className="text-sm text-slate-600">{wo.client?.name || t('dashboard.clientMissing')}</p>
                               <p className="text-xs text-slate-500 mt-2">{wo.description?.substring(0, 100)}...</p>
                               <div className="mt-2 pt-2 border-t border-slate-100">
                                   <BudgetDisplay budgetHours={wo.budget_hours} workedHours={workedHoursMap.get(wo.id)} />
                               </div>
                           </Card>
                      ))}
                  </div>
              </div>
          ))}
      </div>
    </>
  );

  const renderWorkOrderDetail = () => {
    if (!fullSelectedWO) return <div className="p-8 text-slate-700">{t('jobs.detailsLoading')}</div>;
    
    return (
      <div>
        <Button variant="secondary" onClick={() => setSelectedWorkOrder(null)} className="mb-4">
            <Icon name="fa-arrow-left" className="mr-2"/> {t('jobs.backToOverview')}
        </Button>
        <div className="bg-white p-6 rounded-lg shadow-md text-slate-800">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">{fullSelectedWO.name}</h1>
                    <p className="text-slate-600">Pro: {fullSelectedWO.client?.name || t('dashboard.clientMissing')}</p>
                    <p className="text-sm text-slate-500 mt-2">{fullSelectedWO.description}</p>
                    <BudgetDisplay budgetHours={fullSelectedWO.budget_hours} workedHours={detailWorkedHours} className="max-w-sm my-4" />
                </div>
                 {isAdmin && (
                    <div className="flex items-start space-x-2">
                        <Button onClick={() => { setEditingWorkOrder(fullSelectedWO); setIsJobFormOpen(true); }}><Icon name="fa-edit" /> {t('jobs.edit')}</Button>
                        <Button onClick={() => { setWorkOrderForStatus(fullSelectedWO); setIsStatusModalOpen(true); }} variant="secondary">
                            <Icon name="fa-exchange-alt" /> {t('jobs.changeStatus')}
                        </Button>
                        <Button onClick={() => setIsInvoiceConfigOpen(true)}><Icon name="fa-file-invoice" /> {t('jobs.invoice')}</Button>
                    </div>
                 )}
            </div>
            
            <div className="mt-6 pt-6 border-t">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-semibold text-slate-800">{t('jobs.tasks')}</h3>
                    <Button variant="secondary" onClick={() => setIsTaskFormOpen(!isTaskFormOpen)}>
                        <Icon name={isTaskFormOpen ? "fa-times" : "fa-plus"} className="mr-2"/> {isTaskFormOpen ? t('jobs.closeTaskForm') : t('jobs.newTask')}
                    </Button>
                </div>
                {isTaskFormOpen && (
                    <form onSubmit={handleCreateTask} className="flex gap-2 mb-4 p-4 bg-slate-100 rounded-md">
                        <input 
                            value={newTaskName}
                            onChange={e => setNewTaskName(e.target.value)}
                            placeholder={t('jobs.newTaskPlaceholder')}
                            className="flex-grow p-2 border rounded text-slate-900"
                            required
                        />
                        <Button type="submit">{t('jobs.createTask')}</Button>
                    </form>
                )}
                <div>
                    {fullSelectedWO.tasks.map(task => (
                        <TaskItem 
                            key={task.id} 
                            task={task} 
                            onAssign={handleAssignTask}
                            onEdit={setEditingTask}
                            onStatusChange={handleUpdateTaskStatus}
                            members={members}
                            workOrder={fullSelectedWO}
                            companyId={companyId}
                            refreshWorkOrder={() => fetchFullWorkOrder(fullSelectedWO.id)}
                            onError={setError}
                        />
                    ))}
                </div>
            </div>
        </div>
      </div>
    );
  };


  if (loading) return <div className="p-8">{t('jobs.loading')}</div>;
  
  return (
    <div className="p-8 bg-slate-50 min-h-full">
      {selectedWorkOrder ? renderWorkOrderDetail() : renderWorkOrderList()}
      {isJobFormOpen && (
        <Modal title={editingWorkOrder ? "Upravit zakázku" : "Nová zakázka"} onClose={() => setIsJobFormOpen(false)}>
            <JobForm 
                onSave={handleSaveJob} 
                onCancel={() => setIsJobFormOpen(false)}
                companyId={companyId}
                workOrder={editingWorkOrder || undefined}
            />
        </Modal>
      )}
       {editingTask && fullSelectedWO && (
          <Modal title="Upravit úkol" onClose={() => setEditingTask(null)}>
            <TaskForm
              task={editingTask}
              companyId={companyId}
              workOrderId={fullSelectedWO.id}
              onSave={() => {
                setEditingTask(null);
                fetchFullWorkOrder(fullSelectedWO.id);
              }}
              onCancel={() => setEditingTask(null)}
            />
          </Modal>
        )}
      {isInvoiceConfigOpen && fullSelectedWO && (
          <InvoiceConfigModal
              workOrder={fullSelectedWO}
              onClose={() => setIsInvoiceConfigOpen(false)}
              onGenerate={handleGenerateInvoicePreview}
              isGenerating={isGeneratingInvoice}
          />
      )}
      {isInvoiceModalOpen && selectedWorkOrder && (
          <Invoice 
            workOrder={selectedWorkOrder}
            billingReport={configuredBillingReport}
            company={company}
            onClose={() => setIsInvoiceModalOpen(false)}
            vatSettings={{ laborRate: 21, materialRate: 21 }}
            onMarkAsBilled={handleMarkBilled}
          />
      )}
      {isPeriodicInvoiceModalOpen && (
        <PeriodicInvoiceModal onClose={() => setIsPeriodicInvoiceModalOpen(false)} />
      )}
      {isStatusModalOpen && workOrderForStatus && (
          <UpdateStatusModal 
              workOrder={workOrderForStatus}
              onClose={() => setIsStatusModalOpen(false)}
              onSave={handleSaveStatus}
          />
      )}
      {error && <ErrorModal title="Chyba v sekci Zakázky" message={error} onClose={() => setError(null)} />}
    </div>
  );
};

export default Jobs;
