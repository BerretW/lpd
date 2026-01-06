

import React, { useState, useEffect, useMemo } from 'react';
import { TimeLogOut, Company, TimeLogEntryType } from '../types';
import Button from './common/Button';
import Icon from './common/Icon';
import * as api from '../api';
import ErrorMessage from './common/ErrorMessage';

interface WorkReportProps {
    onClose: () => void;
    companyId: number;
    userId: number;
    userEmail: string;
    initialDate?: Date;
}

interface DailySummary {
    date: string;
    work: number;
    vacation: number;
    sick: number;
    doctor: number;
    unpaid: number;
    workDetails: string[];
}

const toYYYYMMDD = (d: Date) => d.toISOString().split('T')[0];

const entryTypeTranslations: { [key in TimeLogEntryType]: string } = {
    [TimeLogEntryType.Work]: 'Práce',
    [TimeLogEntryType.Vacation]: 'Dovolená',
    [TimeLogEntryType.SickDay]: 'Nemoc',
    [TimeLogEntryType.Doctor]: 'Lékař',
    [TimeLogEntryType.UnpaidLeave]: 'Neplacené volno',
};


const WorkReport: React.FC<WorkReportProps> = ({ onClose, companyId, userId, userEmail, initialDate }) => {
    const [date, setDate] = useState(initialDate || new Date());
    const [logs, setLogs] = useState<TimeLogOut[]>([]);
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchReportData = async () => {
            setLoading(true);
            setError(null);
            try {
                const year = date.getFullYear();
                const month = date.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                
                const promises: Promise<TimeLogOut[]>[] = [];
                for (let i = 1; i <= daysInMonth; i++) {
                    const currentDate = new Date(year, month, i);
                    promises.push(api.getTimeLogs(companyId, {
                        user_id_filter: userId,
                        work_date: toYYYYMMDD(currentDate)
                    }));
                }
                
                const monthLogsArrays = await Promise.all(promises);
                const flattenedLogs = monthLogsArrays.flat().sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
                setLogs(flattenedLogs);

                const companyData = await api.getCompany(companyId);
                setCompany(companyData);

            } catch (error) {
                console.error("Failed to fetch work report data", error);
                setError(error instanceof Error ? error.message : "Nepodařilo se načíst data pro výkaz práce.");
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [companyId, userId, date]);
    
    const handlePrint = () => {
        const printContent = document.getElementById('work-report-print-area');
        if (printContent) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write('<html><head><title>Měsíční výkaz práce</title>');
            printWindow?.document.write('<script src="https://cdn.tailwindcss.com"></script>');
            printWindow?.document.write('<style>@media print { body { -webkit-print-color-adjust: exact; } .no-print { display: none; } }</style>');
            printWindow?.document.write('</head><body>');
            printWindow?.document.write(printContent.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            setTimeout(() => {
                printWindow?.print();
                printWindow?.close();
            }, 250);
        }
    };

    const dailySummaries = useMemo((): DailySummary[] => {
        const grouped = logs.reduce((acc: Record<string, DailySummary>, log) => {
            const dateKey = toYYYYMMDD(new Date(log.start_time));
            if (!acc[dateKey]) {
                acc[dateKey] = {
                    date: dateKey,
                    work: 0,
                    vacation: 0,
                    sick: 0,
                    doctor: 0,
                    unpaid: 0,
                    workDetails: [],
                };
            }

            const summary = acc[dateKey];
            const hours = log.duration_hours;

            switch (log.entry_type) {
                case TimeLogEntryType.Work:
                    summary.work += hours;
                    if (log.task?.name) {
                        summary.workDetails.push(log.task.name);
                    } else if (log.notes) {
                        summary.workDetails.push(log.notes);
                    }
                    break;
                case TimeLogEntryType.Vacation:
                    summary.vacation += hours;
                    break;
                case TimeLogEntryType.SickDay:
                    summary.sick += hours;
                    break;
                case TimeLogEntryType.Doctor:
                    summary.doctor += hours;
                    break;
                case TimeLogEntryType.UnpaidLeave:
                    summary.unpaid += hours;
                    break;
            }
            return acc;
        }, {} as Record<string, DailySummary>);
        // FIX: Cast Object.values to 'DailySummary[]' to ensure correct typing for sort.
        return (Object.values(grouped) as DailySummary[]).sort((a, b) => a.date.localeCompare(b.date));
    }, [logs]);

    const totals = useMemo(() => {
        const categoryTotals: Record<TimeLogEntryType, number> = {
            [TimeLogEntryType.Work]: 0,
            [TimeLogEntryType.Vacation]: 0,
            [TimeLogEntryType.SickDay]: 0,
            [TimeLogEntryType.Doctor]: 0,
            [TimeLogEntryType.UnpaidLeave]: 0,
        };

        for (const log of logs) {
            categoryTotals[log.entry_type] = (categoryTotals[log.entry_type] || 0) + log.duration_hours;
        }

        const paidHours = 
            categoryTotals[TimeLogEntryType.Work] +
            categoryTotals[TimeLogEntryType.Vacation] +
            categoryTotals[TimeLogEntryType.SickDay] +
            categoryTotals[TimeLogEntryType.Doctor];

        return { categoryTotals, paidHours };
    }, [logs]);
    
    const changeMonth = (offset: number) => {
        setDate(currentDate => {
            const newDate = new Date(currentDate);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="no-print flex justify-between items-center p-4 border-b bg-gray-800 text-white rounded-t-lg">
                    <h2 className="text-xl font-semibold">Měsíční výkaz práce</h2>
                    <div>
                        <button onClick={handlePrint} className="mr-4 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors" disabled={loading || !!error}>
                            <i className="fas fa-print mr-2"></i> Tisk PDF
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <i className="fas fa-times text-2xl"></i>
                        </button>
                    </div>
                </header>
                <main className="p-6 overflow-y-auto bg-slate-100">
                     <div className="no-print flex justify-between items-center mb-4 p-2 bg-white text-black rounded-md shadow">
                        <Button onClick={() => changeMonth(-1)} variant="secondary"><Icon name="fa-arrow-left" className="mr-2" /> Předchozí</Button>
                        <span className="font-bold text-lg">{date.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })}</span>
                        <Button onClick={() => changeMonth(1)} variant="secondary">Následující <Icon name="fa-arrow-right" className="ml-2" /></Button>
                    </div>

                    {loading ? (
                        <div className="text-center py-16"><Icon name="fa-spinner fa-spin" className="text-3xl" /></div>
                    ) : error ? (
                        <ErrorMessage message={error} />
                    ) : (
                        <div id="work-report-print-area" className="bg-white p-8 shadow-lg text-black text-sm mx-auto" style={{width: '210mm'}}>
                            <h1 className="text-2xl font-bold mb-1">Měsíční výkaz práce</h1>
                            <p className="text-lg font-semibold text-slate-700 mb-6">{date.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })}</p>

                            <div className="grid grid-cols-2 gap-4 mb-6 p-4 border rounded-md bg-slate-50">
                                <div><strong>Zaměstnanec:</strong> {userEmail}</div>
                                <div><strong>Firma:</strong> {company?.name}</div>
                            </div>
                            
                            {dailySummaries.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-200">
                                        <tr>
                                            <th className="border p-2 w-28">Datum</th>
                                            <th className="border p-2">Popis práce / Poznámky</th>
                                            <th className="border p-2 w-24 text-right">Práce (hod)</th>
                                            <th className="border p-2 w-24 text-right">Placené volno (hod)</th>
                                            <th className="border p-2 w-24 text-right">Neplacené volno (hod)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailySummaries.map((summary) => {
                                            const otherPaid = summary.vacation + summary.sick + summary.doctor;
                                            const uniqueWorkDetails = [...new Set(summary.workDetails)].join(', ');
                                            
                                            const hasSpecialRate = summary.vacation > 0 || summary.doctor > 0;
                                            
                                            const leaveNotes = [];
                                            if (summary.vacation > 0) leaveNotes.push('Dovolená');
                                            if (summary.sick > 0) leaveNotes.push('Nemoc');
                                            if (summary.doctor > 0) leaveNotes.push('Lékař');
                                            if (summary.unpaid > 0) leaveNotes.push('Neplacené volno');

                                            const allNotes = [uniqueWorkDetails, ...leaveNotes].filter(Boolean);
                                            const note = allNotes.length > 0 ? allNotes.join(', ') : '-';

                                            return(
                                                <tr key={summary.date} className={`border-b text-black ${hasSpecialRate ? 'bg-yellow-100' : ''}`}>
                                                    <td className="p-2 align-top">{new Date(summary.date + 'T00:00:00').toLocaleDateString('cs-CZ')}</td>
                                                    <td className="p-2 text-xs text-slate-600 italic align-top">{note}</td>
                                                    <td className="p-2 text-right font-semibold align-top">{summary.work > 0 ? summary.work.toFixed(2) : '-'}</td>
                                                    <td className="p-2 text-right font-semibold align-top">{otherPaid > 0 ? otherPaid.toFixed(2) : '-'}</td>
                                                    <td className="p-2 text-right font-semibold align-top">{summary.unpaid > 0 ? summary.unpaid.toFixed(2) : '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : <p className="text-slate-500 text-center py-8">Pro tento měsíc nebyly nalezeny žádné záznamy.</p>}
                            
                            <div className="mt-8 pt-4 border-t-2 flex justify-between items-start">
                                <div className="w-1/2">
                                    <h3 className="text-lg font-bold mb-2">Rekapitulace kategorií</h3>
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {Object.entries(totals.categoryTotals).filter(([, hours]) => (hours as number) > 0).map(([type, hours]) => (
                                                <tr key={type}>
                                                    <td className="py-1 pr-4">{entryTypeTranslations[type as TimeLogEntryType] || type}:</td>
                                                    <td className="text-right font-semibold">{(hours as number).toFixed(2)} hod</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="w-1/3 text-right">
                                    <h3 className="text-xl font-bold mb-2">Celkem k proplacení</h3>
                                    <p className="text-3xl font-bold text-red-600">
                                        {totals.paidHours.toFixed(2)} hod
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default WorkReport;
