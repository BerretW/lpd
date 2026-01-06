
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WorkOrderOut, TaskOut, ServiceReport, TaskTotalHoursOut, TimeLogOut } from '../types';
import * as api from '../api';
import Card from './common/Card';
import Button from './common/Button';
import Icon from './common/Icon';
import ManageTaskMaterialsModal from './ManageTaskMaterialsModal';
import ErrorMessage from './common/ErrorMessage';
import Modal from './common/Modal';
import ServiceReportForm from './ServiceReportForm';
import ServiceReportPrint from './ServiceReportPrint';
import LogMaterialModal from './LogMaterialModal';

interface MyTasksViewProps {
    companyId: number;
    userId: number;
}

// We need to combine task with its parent Work Order for context
interface TaskWithWorkOrder {
    task: TaskOut;
    workOrder: WorkOrderOut;
}

type ModalInfo =
    | { type: 'CLOSED' }
    | { type: 'MANAGE_MATERIALS', data: TaskWithWorkOrder }
    | { type: 'ADD_FROM_STOCK', data: TaskWithWorkOrder }
    | { type: 'DIRECT_PURCHASE', data: TaskWithWorkOrder }
    | { type: 'SERVICE_REPORT', data: TaskWithWorkOrder, isFetching: boolean, totalHours: number | null, timeLogs: TimeLogOut[] | null };


// Copied from Jobs.tsx for status display
const statusTranslations: { [key: string]: string } = {
    new: 'Nová',
    in_progress: 'Probíhá',
    completed: 'Hotovo',
    billed: 'Fakturováno',
};

const statusColors: { [key: string]: string } = {
    new: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
    billed: 'bg-purple-100 text-purple-800',
};

const BudgetDisplay: React.FC<{ budgetHours?: number | null; workedHours?: number | null; className?: string; }> = ({ budgetHours, workedHours, className }) => {
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
                <span><Icon name="fa-clock" className="mr-1" /> Budget</span>
                <span className="font-semibold">
                    Zbývá: {remaining.toFixed(1)} / {budgetHours.toFixed(1)} h
                </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                    className={`${progressColor} h-2 rounded-full`} 
                    style={{ width: `${percentage}%` }}
                    title={`Odpracováno: ${worked.toFixed(1)} hod (${percentage.toFixed(0)}%)`}
                ></div>
            </div>
        </div>
    );
};


const MyTasksView: React.FC<MyTasksViewProps> = ({ companyId, userId }) => {
    const [assignedTasks, setAssignedTasks] = useState<TaskWithWorkOrder[]>([]);
    const [workedHoursMap, setWorkedHoursMap] = useState<Map<number, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
    
    const [modalInfo, setModalInfo] = useState<ModalInfo>({ type: 'CLOSED' });
    const [reportToPrint, setReportToPrint] = useState<{ report: ServiceReport; data: TaskWithWorkOrder } | null>(null);

    const fetchAssignedTasks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const allWorkOrders = await api.getWorkOrders(companyId);
            
            const reportPromises = allWorkOrders.map(wo => 
                api.getBillingReport(companyId, wo.id).catch(() => ({ total_hours: 0 }))
            );
            const reports = await Promise.all(reportPromises);
            const hoursMap = new Map<number, number>();
            reports.forEach((report, index) => {
                hoursMap.set(allWorkOrders[index].id, report.total_hours);
            });
            setWorkedHoursMap(hoursMap);

            const activeWorkOrders = allWorkOrders.filter(wo => wo.status !== 'completed' && wo.status !== 'billed');

            // Fetch full details for all tasks in parallel
            const taskFetchPromises = activeWorkOrders.flatMap(wo => 
                wo.tasks.map(taskPreview => 
                    api.getTask(companyId, wo.id, taskPreview.id).then(fullTask => ({
                        task: fullTask,
                        workOrder: wo
                    }))
                )
            );
            
            const allTasksWithWO = await Promise.all(taskFetchPromises);

            // Filter for tasks assigned to the current user that are NOT billed
            const userTasks = allTasksWithWO.filter(item => 
                item.task.assignee?.id === userId && item.task.status !== 'billed'
            );
            
            setAssignedTasks(userTasks);

        } catch (err) {
            setError(err instanceof Error ? err.message : "Nepodařilo se načíst úkoly.");
        } finally {
            setLoading(false);
        }
    }, [companyId, userId]);

    useEffect(() => {
        fetchAssignedTasks();
    }, [fetchAssignedTasks]);

    useEffect(() => {
        if (modalInfo.type === 'SERVICE_REPORT' && modalInfo.isFetching) {
            const fetchReportData = async () => {
                setError(null);
                try {
                    const [hoursData, logsData] = await Promise.all([
                        api.getTaskTotalHours(companyId, modalInfo.data.workOrder.id, modalInfo.data.task.id),
                        api.getTaskTimeLogs(companyId, modalInfo.data.workOrder.id, modalInfo.data.task.id)
                    ]);
                    setModalInfo(prev => {
                        if (prev.type === 'SERVICE_REPORT' && prev.isFetching) {
                            return { ...prev, isFetching: false, totalHours: hoursData.total_hours, timeLogs: logsData };
                        }
                        return prev;
                    });
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Nepodařilo se načíst data pro servisní list.');
                    setModalInfo({ type: 'CLOSED' });
                }
            };
            fetchReportData();
        }
    }, [modalInfo, companyId]);
    
    
    const handleCloseModal = () => {
        setModalInfo({ type: 'CLOSED' });
        setError(null);
    };

    const handleSaveSuccess = () => {
        handleCloseModal();
        fetchAssignedTasks(); // Refresh data after changes
    };
    
    const handleOpenReportModal = (taskData: TaskWithWorkOrder) => {
        setModalInfo({ type: 'SERVICE_REPORT', data: taskData, isFetching: true, totalHours: null, timeLogs: null });
    };
    
    const handleSaveReport = (report: ServiceReport) => {
        if (modalInfo.type === 'SERVICE_REPORT') {
            setReportToPrint({ report, data: modalInfo.data });
            handleCloseModal();
        }
    };

    const handleCompleteTask = async (workOrderId: number, taskId: number) => {
        setUpdatingTaskId(taskId);
        setError(null);
        try {
            await api.updateTask(companyId, workOrderId, taskId, { status: 'completed' });
            // Refetch tasks to show the updated status without removing it from the list.
            await fetchAssignedTasks();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Nepodařilo se dokončit úkol.");
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const groupedTasks = useMemo(() => {
        // FIX: Explicitly typing the generic for `reduce` ensures correct type inference for `acc` and the final result (`groupedTasks`).
        return assignedTasks.reduce<Record<string, TaskWithWorkOrder[]>>((acc, current) => {
            const woName = current.workOrder.name;
            if (!acc[woName]) {
                acc[woName] = [];
            }
            acc[woName].push(current);
            return acc;
        }, {});
    }, [assignedTasks]);

    const renderModals = () => {
        switch (modalInfo.type) {
            case 'MANAGE_MATERIALS':
                return <ManageTaskMaterialsModal 
                            workOrder={modalInfo.data.workOrder}
                            initialTask={modalInfo.data.task}
                            companyId={companyId}
                            onClose={handleCloseModal}
                            onSaveSuccess={handleSaveSuccess} />;
            case 'ADD_FROM_STOCK':
                return <LogMaterialModal
                            companyId={companyId}
                            workOrderId={modalInfo.data.workOrder.id}
                            taskId={modalInfo.data.task.id}
                            existingMaterials={modalInfo.data.task.used_items}
                            onClose={handleCloseModal}
                            onSaveSuccess={handleSaveSuccess}
                            initialMode="stock" />;
            case 'DIRECT_PURCHASE':
                return <LogMaterialModal
                            companyId={companyId}
                            workOrderId={modalInfo.data.workOrder.id}
                            taskId={modalInfo.data.task.id}
                            existingMaterials={modalInfo.data.task.used_items}
                            onClose={handleCloseModal}
                            onSaveSuccess={handleSaveSuccess}
                            initialMode="direct" />;
            case 'SERVICE_REPORT':
                return (
                    <Modal title={`Servisní list pro: ${modalInfo.data.task.name}`} onClose={handleCloseModal}>
                        {modalInfo.isFetching && <p>Načítání dat pro servisní list...</p>}
                        <ErrorMessage message={!modalInfo.isFetching ? error : null} />
                        {!modalInfo.isFetching && modalInfo.totalHours !== null && modalInfo.timeLogs !== null && (
                            <ServiceReportForm
                                workOrder={modalInfo.data.workOrder}
                                task={modalInfo.data.task}
                                totalHours={modalInfo.totalHours}
                                timeLogs={modalInfo.timeLogs}
                                onSave={handleSaveReport}
                            />
                        )}
                    </Modal>
                );
            case 'CLOSED':
            default:
                return null;
        }
    };


    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Icon name="fa-spinner fa-spin" className="text-3xl text-slate-500" />
                <span className="ml-4 text-slate-600">Načítání vašich úkolů...</span>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <ErrorMessage message={error} />

            {Object.keys(groupedTasks).length > 0 ? (
                Object.entries(groupedTasks).map(([workOrderName, tasks]) => (
                    <div key={workOrderName}>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-xl font-semibold text-slate-700">{workOrderName}</h2>
                            <div className="w-1/3">
                                <BudgetDisplay 
                                    budgetHours={tasks[0]?.workOrder.budget_hours} 
                                    workedHours={workedHoursMap.get(tasks[0]?.workOrder.id)}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {(tasks as TaskWithWorkOrder[]).map(({ task, workOrder }) => (
                                <Card key={task.id} className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0">
                                    <div className="flex-grow">
                                        <div className="flex items-center space-x-3 mb-1">
                                            <h3 className="font-bold text-slate-900">{task.name}</h3>
                                            <span className={`px-2 py-0.5 rounded-full font-semibold text-xs ${statusColors[task.status] || 'bg-gray-100 text-gray-800'}`}>
                                                {statusTranslations[task.status] || task.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500">{task.description}</p>
                                    </div>
                                    <div className="flex items-center space-x-2 flex-shrink-0">
                                        <Button onClick={() => setModalInfo({ type: 'MANAGE_MATERIALS', data: { task, workOrder } })} variant="secondary" className="!text-xs !py-1 !px-2" title="Stav materiálu">
                                            <Icon name="fa-boxes" className="mr-1" /> Stav
                                        </Button>
                                        <Button onClick={() => setModalInfo({ type: 'ADD_FROM_STOCK', data: { task, workOrder } })} variant="secondary" className="!text-xs !py-1 !px-2" title="Přidat ze skladu">
                                            <Icon name="fa-plus" className="mr-1" /> Ze skladu
                                        </Button>
                                        <Button onClick={() => setModalInfo({ type: 'DIRECT_PURCHASE', data: { task, workOrder } })} variant="secondary" className="!text-xs !py-1 !px-2" title="Přímý nákup">
                                            <Icon name="fa-shopping-cart" className="mr-1" /> Nákup
                                        </Button>
                                        <Button onClick={() => handleOpenReportModal({ task, workOrder })} variant="secondary">
                                            <Icon name="fa-file-alt" className="mr-2" />
                                            Servisní list
                                        </Button>
                                        <Button 
                                            onClick={() => handleCompleteTask(workOrder.id, task.id)}
                                            disabled={updatingTaskId === task.id || task.status === 'completed'}
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            {updatingTaskId === task.id ? (
                                                <><Icon name="fa-spinner fa-spin" className="mr-2" /> Dokončuji...</>
                                            ) : task.status === 'completed' ? (
                                                <><Icon name="fa-check-double" className="mr-2" /> Dokončeno</>
                                            ) : (
                                                <><Icon name="fa-check" className="mr-2" /> Dokončit úkol</>
                                            )}
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center text-slate-500 mt-16">
                    <Icon name="fa-check-circle" className="text-5xl mb-4 text-green-500" />
                    <h2 className="text-xl font-semibold">Nemáte žádné přiřazené úkoly</h2>
                    <p>Aktuálně nemáte žádné aktivní úkoly. Užijte si volno!</p>
                </div>
            )}
            
            {renderModals()}

            {reportToPrint && (
                <ServiceReportPrint
                    report={reportToPrint.report}
                    workOrder={reportToPrint.data.workOrder}
                    onClose={() => setReportToPrint(null)}
                />
            )}
        </div>
    );
};

export default MyTasksView;
