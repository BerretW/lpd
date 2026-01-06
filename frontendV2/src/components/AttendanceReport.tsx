import React, { useState, useMemo } from 'react';
import { Employee, TimeEntry } from '../types';
import Icon from './common/Icon';

interface AttendanceReportProps {
    employees: Employee[];
    timeEntries: TimeEntry[];
}

const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    try {
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        const minutes = (endH * 60 + endM) - (startH * 60 + startM);
        return minutes > 0 ? minutes / 60 : 0;
    } catch (e) {
        return 0;
    }
};

const AttendanceReport: React.FC<AttendanceReportProps> = ({ employees, timeEntries }) => {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.id || '');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const filteredEntries = useMemo(() => {
        return timeEntries
            .filter(entry => 
                entry.employeeId === selectedEmployeeId &&
                new Date(entry.date).getMonth() === selectedMonth &&
                new Date(entry.date).getFullYear() === selectedYear
            )
            .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    }, [timeEntries, selectedEmployeeId, selectedMonth, selectedYear]);
    
    const totalHours = filteredEntries.reduce((sum, entry) => sum + calculateDuration(entry.startTime, entry.endTime), 0);

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i,
        label: new Date(0, i).toLocaleString('cs-CZ', { month: 'long' })
    }));

    const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    return (
        <div>
            <h2 className="text-2xl font-semibold text-slate-700 mb-4">Přehled docházky zaměstnanců</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-100 rounded-lg">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Zaměstnanec</label>
                    <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="mt-1 block w-full p-2 border-slate-300 rounded-md">
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Měsíc</label>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="mt-1 block w-full p-2 border-slate-300 rounded-md">
                        {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Rok</label>
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="mt-1 block w-full p-2 border-slate-300 rounded-md">
                        {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-slate-200">
                        <tr>
                            <th className="p-3 text-left">Datum</th>
                            <th className="p-3 text-left">Čas od - do</th>
                            <th className="p-3 text-left">Činnost</th>
                            <th className="p-3 text-left">Popis</th>
                            <th className="p-3 text-right">Doba trvání</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEntries.map(entry => (
                             <tr key={entry.id} className="border-b hover:bg-slate-50">
                                <td className="p-3 whitespace-nowrap">{new Date(entry.date).toLocaleDateString('cs-CZ')}</td>
                                <td className="p-3 whitespace-nowrap">{entry.startTime} - {entry.endTime}</td>
                                <td className="p-3">{entry.activity}</td>
                                <td className="p-3">{entry.description}</td>
                                <td className="p-3 text-right font-semibold">{calculateDuration(entry.startTime, entry.endTime).toFixed(2)} h</td>
                            </tr>
                        ))}
                         <tr className="bg-slate-200 font-bold">
                            <td colSpan={4} className="p-3 text-right">Celkem hodin:</td>
                            <td className="p-3 text-right">{totalHours.toFixed(2)} h</td>
                        </tr>
                    </tbody>
                </table>
                 {filteredEntries.length === 0 && (
                    <div className="text-center p-8 text-slate-500">
                        <Icon name="fa-calendar-times" className="text-4xl mb-3"/>
                        <p>Pro vybrané období nebyly nalezeny žádné záznamy docházky.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceReport;
