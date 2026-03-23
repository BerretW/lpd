import React from 'react';
import { WorkOrderOut } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Icon from './common/Icon';
import BudgetDisplay from './common/BudgetDisplay';
import { useI18n } from '../I18nContext';

interface JobsListProps {
    workOrders: WorkOrderOut[];
    workedHoursMap: Map<number, number>;
    isAdmin: boolean;
    onSelectWorkOrder: (wo: WorkOrderOut) => void;
    onNewJob: () => void;
    onPeriodicBilling: () => void;
}

const JobsList: React.FC<JobsListProps> = ({
    workOrders, workedHoursMap, isAdmin,
    onSelectWorkOrder, onNewJob, onPeriodicBilling,
}) => {
    const { t } = useI18n();

    const grouped = workOrders.reduce<Record<string, WorkOrderOut[]>>((acc, wo) => {
        (acc[wo.status] = acc[wo.status] || []).push(wo);
        return acc;
    }, {});

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">{t('jobs.title')}</h1>
                {isAdmin && (
                    <div className="flex space-x-2">
                        <Button onClick={onPeriodicBilling} variant="secondary">
                            <Icon name="fa-calendar-alt" className="mr-2" /> {t('jobs.periodicBilling')}
                        </Button>
                        <Button onClick={onNewJob}>
                            <Icon name="fa-plus" className="mr-2" /> {t('jobs.newJob')}
                        </Button>
                    </div>
                )}
            </div>
            <div className="space-y-6">
                {Object.entries(grouped).map(([status, wos]) => (
                    <div key={status}>
                        <h2 className="text-xl font-semibold text-slate-700 mb-3 capitalize">
                            {t(`jobs.status.${status}`) || status}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {wos.map(wo => (
                                <Card
                                    key={wo.id}
                                    className="cursor-pointer hover:shadow-lg hover:border-red-500"
                                    onClick={() => onSelectWorkOrder(wo)}
                                >
                                    <h3 className="font-bold text-slate-900">{wo.name}</h3>
                                    <p className="text-sm text-slate-600">
                                        {wo.object
                                            ? `${wo.object.name}${wo.object.city ? ` – ${wo.object.city}` : ''}`
                                            : wo.client?.name || t('dashboard.clientMissing')}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">{wo.description?.substring(0, 100)}...</p>
                                    <BudgetDisplay
                                        budgetHours={wo.budget_hours}
                                        workedHours={workedHoursMap.get(wo.id)}
                                        className="mt-2 pt-2 border-t border-slate-100"
                                    />
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export default JobsList;
