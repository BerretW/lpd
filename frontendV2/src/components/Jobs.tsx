import React, { useState, useEffect, useCallback } from 'react';
import { WorkOrderOut, TaskOut, MemberOut, RoleEnum, BillingReportOut, WorkOrder, Company, ServiceReportOut } from '../types';
import Modal from './common/Modal';
import JobForm from './JobForm';
import Invoice from './Invoice';
import * as api from '../api';
import UpdateStatusModal from './UpdateStatusModal';
import PeriodicInvoiceModal from './PeriodicInvoiceModal';
import ErrorModal from './common/ErrorModal';
import TaskForm from './TaskForm';
import { useAuth } from '../AuthContext';
import { useI18n } from '../I18nContext';
import InvoiceConfigModal, { InvoiceConfig } from './InvoiceConfigModal';
import JobsList from './JobsList';
import JobDetail from './JobDetail';

interface JobsProps {
    companyId: number;
    initialWorkOrderId?: number;
    onWorkOrderOpened?: () => void;
}

interface FullWorkOrderOut extends Omit<WorkOrderOut, 'tasks'> {
    tasks: TaskOut[];
}

const Jobs: React.FC<JobsProps> = ({ companyId, initialWorkOrderId, onWorkOrderOpened }) => {
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
    const [editingTask, setEditingTask] = useState<TaskOut | null>(null);
    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [members, setMembers] = useState<MemberOut[]>([]);
    const [company, setCompany] = useState<Company | null>(null);

    const [isInvoiceConfigOpen, setIsInvoiceConfigOpen] = useState(false);
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [configuredBillingReport, setConfiguredBillingReport] = useState<BillingReportOut | null>(null);
    const [tasksToBill, setTasksToBill] = useState<number[]>([]);

    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [workOrderForStatus, setWorkOrderForStatus] = useState<WorkOrderOut | null>(null);
    const [isPeriodicInvoiceModalOpen, setIsPeriodicInvoiceModalOpen] = useState(false);
    const [woServiceReports, setWoServiceReports] = useState<ServiceReportOut[]>([]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [woData, memberData, companyData] = await Promise.all([
                api.getWorkOrders(companyId),
                api.getMembers(companyId),
                api.getCompany(companyId),
            ]);
            setWorkOrders(woData);
            setMembers(memberData);
            setCompany(companyData);

            const reportPromises = woData.map(wo =>
                api.getBillingReport(companyId, wo.id).catch(() => ({ total_hours: 0 }))
            );
            const reports = await Promise.all(reportPromises);
            const hoursMap = new Map<number, number>();
            reports.forEach((report, index) => {
                hoursMap.set(woData[index].id, report.total_hours);
            });
            setWorkedHoursMap(hoursMap);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!initialWorkOrderId || loading || workOrders.length === 0) return;
        const wo = workOrders.find((w: WorkOrderOut) => w.id === initialWorkOrderId);
        if (wo) {
            setSelectedWorkOrder(wo);
            onWorkOrderOpened?.();
        }
    }, [initialWorkOrderId, loading, workOrders, onWorkOrderOpened]);

    const fetchWoServiceReports = useCallback(async (workOrderId: number) => {
        try {
            const reports = await api.getServiceReports(companyId, { work_order_id: workOrderId });
            setWoServiceReports(reports);
        } catch { /* tiché selhání – zobrazí se prázdný seznam */ }
    }, [companyId]);

    const fetchFullWorkOrder = useCallback(async (workOrderId: number) => {
        if (!workOrderId) return;
        setDetailWorkedHours(null);
        try {
            const [fullWO, , reports] = await Promise.all([
                api.getWorkOrder(companyId, workOrderId),
                api.getBillingReport(companyId, workOrderId).then(r => setDetailWorkedHours(r.total_hours)).catch(() => {}),
                api.getServiceReports(companyId, { work_order_id: workOrderId }),
            ]);
            const taskPromises = fullWO.tasks.map((taskPreview: TaskOut) => api.getTask(companyId, workOrderId, taskPreview.id));
            const detailedTasks = await Promise.all(taskPromises);
            setFullSelectedWO({ ...fullWO, tasks: detailedTasks });
            setWoServiceReports(reports);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch job details');
        }
    }, [companyId]);

    useEffect(() => {
        if (selectedWorkOrder) {
            fetchFullWorkOrder(selectedWorkOrder.id);
        } else {
            setFullSelectedWO(null);
            setDetailWorkedHours(null);
            setWoServiceReports([]);
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
            } catch (error) {
                setError(error instanceof Error ? error.message : `Failed to create task`);
            }
        }
    };

    const handleAssignTask = async (taskId: number, assigneeId: number | null) => {
        if (fullSelectedWO) {
            try {
                await api.assignTask(companyId, fullSelectedWO.id, taskId, assigneeId);
                fetchFullWorkOrder(fullSelectedWO.id);
            } catch (error) {
                setError(error instanceof Error ? error.message : `Failed to assign task`);
            }
        }
    };

    const handleUpdateTaskStatus = async (taskId: number, status: string) => {
        if (fullSelectedWO) {
            try {
                await api.updateTask(companyId, fullSelectedWO.id, taskId, { status });
                fetchFullWorkOrder(fullSelectedWO.id);
            } catch (error) {
                setError(error instanceof Error ? error.message : `Failed to update task status`);
            }
        }
    };

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
                    .filter((task: TaskOut) => config.selectedTaskIds!.includes(task.id))
                    .map((task: TaskOut) => task.name));

                const filteredTimeLogs = report.time_logs.filter(log => selectedTaskNames.has(log.task_name));
                const filteredUsedItems = report.used_items.filter(item => selectedTaskNames.has(item.task_name));

                const total_price_work = filteredTimeLogs.reduce((sum, log) => sum + log.total_price, 0);
                const total_hours = filteredTimeLogs.reduce((sum, log) => sum + log.hours, 0);
                const total_price_inventory = filteredUsedItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
                const grand_total = total_price_work + total_price_inventory;

                finalReport = { ...report, time_logs: filteredTimeLogs, used_items: filteredUsedItems, total_hours, total_price_work, total_price_inventory, grand_total };
                taskIdsToBill = config.selectedTaskIds;
            } else if (config.type === 'all') {
                taskIdsToBill = fullSelectedWO.tasks.map((task: TaskOut) => task.id);
            } else if (config.type === 'date') {
                const taskNamesInReport = new Set([...report.time_logs.map(l => l.task_name), ...report.used_items.map(i => i.task_name)]);
                taskIdsToBill = fullSelectedWO.tasks.filter((task: TaskOut) => taskNamesInReport.has(task.name)).map((task: TaskOut) => task.id);
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
            await Promise.all(tasksToBill.map((taskId: number) =>
                api.updateTask(companyId, fullSelectedWO.id, taskId, { status: 'billed' })
            ));
            setIsInvoiceModalOpen(false);
            setConfiguredBillingReport(null);
            setTasksToBill([]);
            await fetchFullWorkOrder(fullSelectedWO.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se aktualizovat stav úkolů.');
        }
    };

    if (loading) return <div className="p-8">{t('jobs.loading')}</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-full">
            {selectedWorkOrder && fullSelectedWO ? (
                <JobDetail
                    fullSelectedWO={fullSelectedWO}
                    detailWorkedHours={detailWorkedHours}
                    members={members}
                    woServiceReports={woServiceReports}
                    companyId={companyId}
                    isTaskFormOpen={isTaskFormOpen}
                    newTaskName={newTaskName}
                    onBack={() => setSelectedWorkOrder(null)}
                    onEdit={() => { setEditingWorkOrder(fullSelectedWO); setIsJobFormOpen(true); }}
                    onChangeStatus={() => { setWorkOrderForStatus(fullSelectedWO); setIsStatusModalOpen(true); }}
                    onInvoice={() => setIsInvoiceConfigOpen(true)}
                    onToggleTaskForm={() => setIsTaskFormOpen(!isTaskFormOpen)}
                    onNewTaskNameChange={setNewTaskName}
                    onCreateTask={handleCreateTask}
                    onAssignTask={handleAssignTask}
                    onStatusChange={handleUpdateTaskStatus}
                    onEditTask={setEditingTask}
                    onRefreshWorkOrder={() => fetchFullWorkOrder(fullSelectedWO.id)}
                    onRefreshServiceReports={() => fetchWoServiceReports(fullSelectedWO.id)}
                    onError={setError}
                />
            ) : selectedWorkOrder && !fullSelectedWO ? (
                <div className="p-8 text-slate-700">{t('jobs.detailsLoading')}</div>
            ) : (
                <JobsList
                    workOrders={workOrders}
                    workedHoursMap={workedHoursMap}
                    isAdmin={isAdmin}
                    onSelectWorkOrder={setSelectedWorkOrder}
                    onNewJob={() => { setEditingWorkOrder(null); setIsJobFormOpen(true); }}
                    onPeriodicBilling={() => setIsPeriodicInvoiceModalOpen(true)}
                />
            )}

            {isJobFormOpen && (
                <Modal title={editingWorkOrder ? 'Upravit zakázku' : 'Nová zakázka'} onClose={() => setIsJobFormOpen(false)}>
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
                        onSave={() => { setEditingTask(null); fetchFullWorkOrder(fullSelectedWO.id); }}
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
