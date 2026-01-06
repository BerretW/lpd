
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
        // Fix: derive time from ISO strings
        const startTimeStr = start.substring(11, 16);
        const endTimeStr = end.substring(11, 16);
        const [startH, startM] = startTimeStr.split(':').map(Number);
        const [endH, endM] = endTimeStr.split(':').map(Number);
        const minutes = (endH * 60 + endM) - (startH * 60 + startM);
        return minutes > 0 ? minutes / 60 : 0;
    } catch (e) {
        return 0;
    }
};

const AttendanceReport: React.FC<AttendanceReportProps> = ({ employees, timeEntries }) => {
    // Fix: Membership doesn't have 'id', using user.id
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.user.id.toString() || '');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const filteredEntries = useMemo(() => {
        return timeEntries
            .filter(entry => 
                // Fix: TimeLogOut has user.id, and start_time instead of date
                entry.user.id.toString() === selectedEmployeeId &&
                new Date(entry.start_time).getMonth() === selectedMonth &&
                new Date(entry.start_time).getFullYear() === selectedYear
            )
            .sort((a, b) => {
                // Fix: Use start_time for sorting
                const dateA = a.start_time;
                const dateB = b.start_time;
                return dateA.localeCompare(dateB);
            });
    }, [timeEntries, selectedEmployeeId, selectedMonth, selectedYear]);
    
    // TimeLogOut has duration_hours
    const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.duration_hours, 0);

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
                        {/* Fix: Membership has user.id and user.email */}
                        {employees.map(emp => <option key={emp.user.id} value={emp.user.id}>{emp.user.email}</option>)}
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
                                {/* Fix: extract date from start_time */}
                                <td className="p-3 whitespace-nowrap">{new Date(entry.start_time).toLocaleDateString('cs-CZ')}</td>
                                {/* Fix: extract time from start_time and end_time */}
                                <td className="p-3 whitespace-nowrap">{entry.start_time.substring(11, 16)} - {entry.end_time.substring(11, 16)}</td>
                                {/* Fix: Use entry_type and notes */}
                                <td className="p-3">{entry.entry_type}</td>
                                <td className="p-3">{entry.notes || ''}</td>
                                <td className="p-3 text-right font-semibold">{entry.duration_hours.toFixed(2)} h</td>
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
