import React from 'react';
import Icon from './Icon';
import { useI18n } from '../../I18nContext';

interface BudgetDisplayProps {
    budgetHours?: number | null;
    workedHours?: number | null;
    className?: string;
}

const BudgetDisplay: React.FC<BudgetDisplayProps> = ({ budgetHours, workedHours, className = '' }) => {
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
        <div className={className}>
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

export default BudgetDisplay;
