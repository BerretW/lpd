import React, { useState, useEffect } from 'react';
import { WorkOrder, View, RoleEnum } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import * as api from '../api';
import { useAuth } from '../AuthContext';
import { useI18n } from '../I18nContext';
import WorkReport from './WorkReport';
import ErrorModal from './common/ErrorModal';

interface DashboardProps {
    setCurrentView: (view: View) => void;
    companyId: number;
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
        <div className={`mt-4 pt-4 border-t border-slate-200 ${className}`}>
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


const Dashboard: React.FC<DashboardProps> = ({ setCurrentView, companyId }) => {
    const { user, role } = useAuth();
    const { t } = useI18n();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [workedHoursMap, setWorkedHoursMap] = useState<Map<number, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWorkReportModalOpen, setIsWorkReportModalOpen] = useState(false);
    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;
    
    useEffect(() => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }
        const fetchAdminDashboardData = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await api.getWorkOrders(companyId);
                setWorkOrders(data);

                // Fetch worked hours for all work orders
                const reportPromises = data.map(wo => 
                    api.getBillingReport(companyId, wo.id).catch(() => ({ total_hours: 0 }))
                );
                const reports = await Promise.all(reportPromises);
                const hoursMap = new Map<number, number>();
                reports.forEach((report, index) => {
                    hoursMap.set(data[index].id, report.total_hours);
                });
                setWorkedHoursMap(hoursMap);

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };
        fetchAdminDashboardData();
    }, [companyId, isAdmin]);

    if (loading) {
        return <div className="p-8">{t('dashboard.loading')}</div>;
    }

    const activeWorkOrders = workOrders.filter(j => j.status === 'in_progress');
    const newWorkOrders = workOrders.filter(j => j.status === 'new');

    const QuickLink: React.FC<{ view: View, label: string, icon: string, color: string }> = ({ view, label, icon, color }) => (
        <div 
            onClick={() => setCurrentView(view)}
            className={`flex flex-col items-center justify-center p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer ${color}`}
        >
            <Icon name={icon} className="w-12 h-12 text-white mb-3" />
            <span className="text-xl font-semibold text-white">{label}</span>
        </div>
    );

    const renderDashboard = () => (
        <>
            <section className={`grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                <QuickLink view={View.Attendance} label={t('dashboard.logAttendance')} icon="fa-calendar-plus" color="bg-gray-700 hover:bg-gray-800" />
                {isAdmin && <QuickLink view={View.Jobs} label={t('dashboard.manageJobs')} icon="fa-briefcase" color="bg-gray-800 hover:bg-gray-900" />}
                 <div 
                    onClick={() => setIsWorkReportModalOpen(true)}
                    className={`flex flex-col items-center justify-center p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer bg-blue-600 hover:bg-blue-700`}
                >
                    <Icon name="fa-file-pdf" className="w-12 h-12 text-white mb-3" />
                    <span className="text-xl font-semibold text-white">{t('dashboard.monthlyReport')}</span>
                </div>
                <QuickLink view={View.Planning} label={t('dashboard.planning')} icon="fa-calendar-check" color="bg-gray-900 hover:bg-black" />
            </section>
            {isAdmin && (
                <>
                    <section>
                        <h2 className="text-2xl font-semibold text-slate-700 mb-4">{t('dashboard.activeJobs')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeWorkOrders.length > 0 ? activeWorkOrders.map(wo => (
                                <Card key={wo.id} className="hover:border-red-500">
                                    <h3 className="text-lg font-bold text-slate-900">{wo.name}</h3>
                                    <p className="text-sm text-slate-600 mt-1">{wo.client?.name || t('dashboard.clientMissing')}</p>
                                    <p className="text-sm text-slate-500">{wo.client?.address || ''}</p>
                                    <BudgetDisplay budgetHours={wo.budget_hours} workedHours={workedHoursMap.get(wo.id)} />
                                </Card>
                            )) : (
                                <p className="text-slate-500">{t('dashboard.noActiveJobs')}</p>
                            )}
                        </div>
                    </section>
                    
                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-700 mb-4">{t('dashboard.newJobs')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {newWorkOrders.length > 0 ? newWorkOrders.map(wo => (
                                <Card key={wo.id} className="hover:border-green-500">
                                    <h3 className="text-lg font-bold text-green-700">{wo.name}</h3>
                                    <p className="text-sm text-slate-600 mt-1">{wo.client?.name || t('dashboard.clientMissing')}</p>
                                    <p className="text-sm text-slate-500">{wo.client?.address || ''}</p>
                                    <BudgetDisplay budgetHours={wo.budget_hours} workedHours={workedHoursMap.get(wo.id)} />
                                </Card>
                            )) : (
                                <p className="text-slate-500">{t('dashboard.noNewJobs')}</p>
                            )}
                        </div>
                    </section>
                </>
            )}
        </>
    );

    return (
        <div className="p-8 bg-slate-50 min-h-full">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-slate-800">{t('dashboard.welcome', { name: user?.email.split('@')[0] })}</h1>
                <p className="text-slate-500 mt-2 text-lg">{t('dashboard.todayOverview')}</p>
            </header>
            {renderDashboard()}
            {isWorkReportModalOpen && user && (
                <WorkReport 
                    onClose={() => setIsWorkReportModalOpen(false)}
                    companyId={companyId}
                    userId={user.id}
                    userEmail={user.email}
                />
            )}
            {error && <ErrorModal title="Chyba při načítání dat" message={error} onClose={() => setError(null)} />}
        </div>
    );
};

export default Dashboard;