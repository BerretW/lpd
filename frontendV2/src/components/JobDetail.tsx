import React from 'react';
import { WorkOrderOut, TaskOut, MemberOut, ServiceReportOut, RoleEnum } from '../types';
import Button from './common/Button';
import Icon from './common/Icon';
import BudgetDisplay from './common/BudgetDisplay';
import TaskItem from './TaskItem';
import { useAuth } from '../AuthContext';
import { useI18n } from '../I18nContext';

interface JobDetailProps {
    fullSelectedWO: WorkOrderOut & { tasks: TaskOut[] };
    detailWorkedHours: number | null;
    members: MemberOut[];
    woServiceReports: ServiceReportOut[];
    companyId: number;
    isTaskFormOpen: boolean;
    newTaskName: string;
    onBack: () => void;
    onEdit: () => void;
    onChangeStatus: () => void;
    onInvoice: () => void;
    onToggleTaskForm: () => void;
    onNewTaskNameChange: (name: string) => void;
    onCreateTask: (e: React.FormEvent) => void;
    onAssignTask: (taskId: number, assigneeId: number | null) => void;
    onStatusChange: (taskId: number, status: string) => void;
    onEditTask: (task: TaskOut) => void;
    onRefreshWorkOrder: () => void;
    onRefreshServiceReports: () => void;
    onError: (message: string) => void;
}

const JobDetail: React.FC<JobDetailProps> = ({
    fullSelectedWO, detailWorkedHours, members, woServiceReports, companyId,
    isTaskFormOpen, newTaskName,
    onBack, onEdit, onChangeStatus, onInvoice,
    onToggleTaskForm, onNewTaskNameChange, onCreateTask,
    onAssignTask, onStatusChange, onEditTask,
    onRefreshWorkOrder, onRefreshServiceReports, onError,
}) => {
    const { role } = useAuth();
    const { t } = useI18n();
    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;

    const clientLabel = fullSelectedWO.object
        ? `${fullSelectedWO.object.name}${fullSelectedWO.object.city ? ` – ${fullSelectedWO.object.city}` : ''}${fullSelectedWO.object.customer_name ? ` (${fullSelectedWO.object.customer_name})` : ''}`
        : fullSelectedWO.client?.name || t('dashboard.clientMissing');

    return (
        <div>
            <Button variant="secondary" onClick={onBack} className="mb-4">
                <Icon name="fa-arrow-left" className="mr-2" /> {t('jobs.backToOverview')}
            </Button>
            <div className="bg-white p-6 rounded-lg shadow-md text-slate-800">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{fullSelectedWO.name}</h1>
                        <p className="text-slate-600">Pro: {clientLabel}</p>
                        <p className="text-sm text-slate-500 mt-2">{fullSelectedWO.description}</p>
                        <BudgetDisplay
                            budgetHours={fullSelectedWO.budget_hours}
                            workedHours={detailWorkedHours}
                            className="max-w-sm my-4"
                        />
                    </div>
                    {isAdmin && (
                        <div className="flex items-start space-x-2">
                            <Button onClick={onEdit}>
                                <Icon name="fa-edit" /> {t('jobs.edit')}
                            </Button>
                            <Button onClick={onChangeStatus} variant="secondary">
                                <Icon name="fa-exchange-alt" /> {t('jobs.changeStatus')}
                            </Button>
                            <Button onClick={onInvoice}>
                                <Icon name="fa-file-invoice" /> {t('jobs.invoice')}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-6 border-t">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-semibold text-slate-800">{t('jobs.tasks')}</h3>
                        <Button variant="secondary" onClick={onToggleTaskForm}>
                            <Icon name={isTaskFormOpen ? 'fa-times' : 'fa-plus'} className="mr-2" />
                            {isTaskFormOpen ? t('jobs.closeTaskForm') : t('jobs.newTask')}
                        </Button>
                    </div>
                    {isTaskFormOpen && (
                        <form onSubmit={onCreateTask} className="flex gap-2 mb-4 p-4 bg-slate-100 rounded-md">
                            <input
                                value={newTaskName}
                                onChange={e => onNewTaskNameChange(e.target.value)}
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
                                onAssign={onAssignTask}
                                onEdit={onEditTask}
                                onStatusChange={onStatusChange}
                                members={members}
                                workOrder={fullSelectedWO}
                                companyId={companyId}
                                refreshWorkOrder={onRefreshWorkOrder}
                                onError={onError}
                                serviceReports={woServiceReports.filter(sr => sr.task_id === task.id)}
                                onServiceReportSaved={onRefreshServiceReports}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobDetail;
