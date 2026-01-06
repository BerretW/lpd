
import React from 'react';
import { Job, TimeEntry, Employee, Customer } from '../types';

interface JobHistoryPrintProps {
    job: Job;
    customer: Customer;
    timeEntries: TimeEntry[];
    employees: Employee[];
    onClose: () => void;
}

const JobHistoryPrint: React.FC<JobHistoryPrintProps> = ({ job, customer, timeEntries, employees, onClose }) => {
    
    const handlePrint = () => {
        const printContent = document.getElementById('history-print-area');
        if (printContent) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write('<html><head><title>Historie zakázky</title>');
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

    const calculateDuration = (start: string, end: string): string => {
        if (!start || !end) return '0:00';
        try {
            // Fix: derive time from ISO strings
            const startTimeStr = start.substring(11, 16);
            const endTimeStr = end.substring(11, 16);
            const [startH, startM] = startTimeStr.split(':').map(Number);
            const [endH, endM] = endTimeStr.split(':').map(Number);
            const startDate = new Date(0, 0, 0, startH, startM, 0);
            const endDate = new Date(0, 0, 0, endH, endM, 0);
            let diff = endDate.getTime() - startDate.getTime();
            if (diff < 0) return '0:00';
            const hours = Math.floor(diff / 1000 / 60 / 60);
            diff -= hours * 1000 * 60 * 60;
            const minutes = Math.floor(diff / 1000 / 60);
            return `${hours}:${minutes.toString().padStart(2, '0')}`;
        } catch (e) {
            return '0:00';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b bg-gray-800 text-white rounded-t-lg">
                    <h2 className="text-xl font-semibold">Historie zakázky</h2>
                    <div>
                        <button onClick={handlePrint} className="mr-4 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                            <i className="fas fa-print mr-2"></i> Tisk
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <i className="fas fa-times text-2xl"></i>
                        </button>
                    </div>
                </header>
                <main className="p-6 overflow-y-auto bg-slate-100">
                    <div id="history-print-area" className="bg-white p-8 shadow-lg text-black text-sm mx-auto" style={{width: '210mm'}}>
                        <h1 className="text-3xl font-bold mb-2">Historie zakázky</h1>
                        {/* Fix: WorkOrderOut has 'name' instead of 'title' */}
                        <h2 className="text-xl text-slate-700 mb-6">{job.name}</h2>

                        <div className="grid grid-cols-2 gap-4 mb-6 p-4 border rounded-md">
                            <div><strong>Zákazník:</strong> {customer.name}</div>
                            <div><strong>Adresa:</strong> {customer.address}</div>
                            <div className="col-span-2"><strong>Popis:</strong> {job.description}</div>
                        </div>

                        <h3 className="text-2xl font-semibold border-b pb-2 mb-4">Servisní listy</h3>
                        {/* Fix: Use serviceReports which was added to WorkOrderOut in types.ts */}
                        {job.serviceReports && job.serviceReports.length > 0 ? (
                            job.serviceReports.map(report => (
                                <div key={report.id} className="mb-4 p-3 border rounded-md break-inside-avoid">
                                    <p><strong>Datum:</strong> {new Date(report.date).toLocaleDateString()}</p>
                                    <p><strong>Technici:</strong> {report.technicians.join(', ')}</p>
                                    <p><strong>Popis práce:</strong> {report.workDescription}</p>
                                    {report.materialsUsed.length > 0 && (
                                        <>
                                            <p className="mt-2 font-semibold">Použitý materiál:</p>
                                            <ul className="list-disc list-inside">
                                                {report.materialsUsed.map((mat, i) => <li key={i}>{mat.name} ({mat.quantity} ks)</li>)}
                                            </ul>
                                        </>
                                    )}
                                </div>
                            ))
                        ) : <p className="text-slate-500">Nebyly nalezeny žádné servisní listy.</p>}

                        <h3 className="text-2xl font-semibold border-b pb-2 mb-4 mt-8">Záznamy docházky</h3>
                        {timeEntries.length > 0 ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-200">
                                        <th className="border p-2">Datum</th>
                                        <th className="border p-2">Pracovník</th>
                                        <th className="border p-2">Čas</th>
                                        <th className="border p-2">Popis</th>
                                        <th className="border p-2 text-right">Doba</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeEntries.map(entry => (
                                        <tr key={entry.id} className="break-inside-avoid-page">
                                            {/* Fix: use start_time for date */}
                                            <td className="border p-2">{new Date(entry.start_time).toLocaleDateString()}</td>
                                            {/* Fix: Membership has user.email, and entry has user.id */}
                                            <td className="border p-2">{employees.find(e => e.user.id === entry.user.id)?.user.email || 'N/A'}</td>
                                            {/* Fix: derive time from ISO strings */}
                                            <td className="border p-2">{entry.start_time.substring(11, 16)} - {entry.end_time.substring(11, 16)}</td>
                                            {/* Fix: TimeLogOut has 'notes' instead of 'description' */}
                                            <td className="border p-2">{entry.notes || ''}</td>
                                            {/* Fix: calculateDuration uses start_time and end_time strings */}
                                            <td className="border p-2 text-right font-semibold">{calculateDuration(entry.start_time, entry.end_time)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p className="text-slate-500">Nebyly nalezeny žádné záznamy docházky.</p>}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default JobHistoryPrint;
