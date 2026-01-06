import React, { useState, useEffect } from 'react';
import { ServiceReport, WorkOrderOut, Company } from '../types';
import * as api from '../api';
import { useAuth } from '../AuthContext';

interface ServiceReportPrintProps {
    report: ServiceReport;
    workOrder: WorkOrderOut;
    onClose: () => void;
}

const ServiceReportPrint: React.FC<ServiceReportPrintProps> = ({ report, workOrder, onClose }) => {
    const { companyId } = useAuth();
    const [company, setCompany] = useState<Company | null>(null);

    useEffect(() => {
        if (companyId) {
            api.getCompany(companyId).then(setCompany);
        }
    }, [companyId]);
    
    const handlePrint = () => {
        const printContent = document.getElementById('print-area');
        const modalContent = printContent?.parentElement?.parentElement;
        if (printContent && modalContent) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write('<html><head><title>Servisní List</title>');
            printWindow?.document.write('<script src="https://cdn.tailwindcss.com"></script>');
            printWindow?.document.write('<style>@media print { body { -webkit-print-color-adjust: exact; } .no-print { display: none; } .break-inside-avoid { page-break-inside: avoid; } }</style>');
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="no-print flex justify-between items-center p-4 border-b bg-gray-800 text-white rounded-t-lg">
                    <h2 className="text-xl font-semibold">Náhled servisního listu</h2>
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
                    <div id="print-area" className="bg-white p-4 shadow-lg text-black text-xs mx-auto" style={{width: '210mm', minHeight: '297mm'}}>
                        <div className="border border-black p-2">
                            <header className="grid grid-cols-2 gap-4 border-b border-black pb-2 items-center">
                                <div>
                                    <h1 className="font-bold text-sm">{company?.legal_name || company?.name || 'Vaše Firma'}</h1>
                                    <p>{company?.address || 'Adresa'}</p>
                                    <p>IČO: {company?.ico || ''}, DIČ: {company?.dic || ''}</p>
                                    <p>Tel. 734 465 304, 702 434 804</p>
                                    <p>www.lpdweb.cz, email: info@lpdweb.cz</p>
                                </div>
                                <div className="border border-black p-1 text-center">
                                    <h2 className="text-lg font-bold">SERVISNÍ LIST</h2>
                                    <p style={{fontSize: '0.6rem'}}>Určeno pro servis, drobnou montáž, pravidelné kontroly a revize</p>
                                </div>
                            </header>
                            <section className="grid grid-cols-2 gap-x-4 border-b border-black">
                                <div className="border-r border-black pr-2">
                                    <div className="grid grid-cols-[100px_1fr] border-b border-black"><strong className="py-1">ZÁKAZNÍK</strong><span className="py-1 pl-2">{workOrder.client?.name}</span></div>
                                    <div className="grid grid-cols-[100px_1fr] border-b border-black"><strong className="py-1">ADRESA</strong><span className="py-1 pl-2">{workOrder.client?.address}</span></div>
                                    <div className="grid grid-cols-[100px_1fr]"><strong className="py-1">DATUM</strong><span className="py-1 pl-2">{new Date(report.date).toLocaleDateString()}</span></div>
                                </div>
                                <div>
                                    <div className="grid grid-cols-[110px_1fr] border-b border-black"><strong className="py-1">Jméno technika/ů</strong><span className="py-1 pl-2">{report.technicians.join(', ')}</span></div>
                                    <div className="grid grid-cols-[110px_1fr] border-b border-black"><strong className="py-1">ČAS PŘÍJEZDU</strong><span className="py-1 pl-2">{report.arrivalTime}</span></div>
                                    <div className="grid grid-cols-[110px_1fr]"><strong className="py-1">POČET HODIN</strong><span className="py-1 pl-2">{report.workHours ? `${report.workHours.toFixed(2)} hod` : 'N/A'}</span></div>
                                </div>
                            </section>
                            <section className="border-b border-black p-1">
                                <strong>Počet ujetých km:</strong> {report.kmDriven || 'N/A'} km
                            </section>
                            <section className="border-b border-black p-1">
                                <div className="flex justify-between">
                                    <strong>Popis provedené práce nebo opravy</strong>
                                    <div className="flex">
                                        <strong className="mr-4">Záruční oprava</strong>
                                        <span>{report.isWarrantyRepair ? '[ X ] ANO' : '[  ] ANO'}</span>
                                        <span className="ml-2">{!report.isWarrantyRepair ? '[ X ] NE' : '[  ] NE'}</span>
                                    </div>
                                </div>
                                <p className="col-span-3 min-h-[50px] pt-2">{report.workDescription}</p>
                            </section>
                            
                            <section className="border-b border-black break-inside-avoid">
                                <h3 className="text-center font-bold bg-gray-200 p-1">ZÁZNAMY PRÁCE</h3>
                                <div className="grid grid-cols-[80px_1fr_100px_80px]">
                                    <strong className="p-1 border-r border-t border-black">Datum</strong>
                                    <strong className="p-1 border-r border-t border-black">Technik</strong>
                                    <strong className="p-1 border-r border-t border-black">Čas od-do</strong>
                                    <strong className="p-1 border-t border-black text-center">Doba</strong>
                                </div>
                                {report.timeLogs?.map((log, i) => (
                                    <div key={i} className="grid grid-cols-[80px_1fr_100px_80px] border-t border-black">
                                        <span className="p-1 border-r border-black">{new Date(log.start_time).toLocaleDateString('cs-CZ')}</span>
                                        <span className="p-1 border-r border-black text-xs">{log.user.email}</span>
                                        <span className="p-1 border-r border-black">{new Date(log.start_time).toTimeString().slice(0, 5)} - {new Date(log.end_time).toTimeString().slice(0, 5)}</span>
                                        <span className="p-1 text-center">{log.duration_hours.toFixed(2)} h</span>
                                    </div>
                                ))}
                                {(!report.timeLogs || report.timeLogs.length === 0) && <div className="p-2 text-center italic border-t border-black">Nebyly nalezeny žádné záznamy práce.</div>}
                            </section>

                            <section className="border-b border-black break-inside-avoid">
                                <h3 className="text-center font-bold bg-gray-200 p-1">MATERIÁL</h3>
                                <div className="grid grid-cols-[1fr_120px]">
                                    <strong className="p-1 border-r border-black">NÁZEV</strong>
                                    <strong className="p-1 text-center">Množství</strong>
                                </div>
                                {report.materialsUsed.map((mat, i) => (
                                    <div key={i} className="grid grid-cols-[1fr_120px] border-t border-black">
                                        <span className="p-1 border-r border-black">{mat.name}</span>
                                        <span className="p-1 text-center">{mat.quantity} ks</span>
                                    </div>
                                ))}
                                <div className="min-h-[100px]"></div>
                            </section>
                            <section className="border-b border-black break-inside-avoid">
                                <h3 className="text-center font-bold bg-gray-200 p-1">POZNÁMKY</h3>
                                <p className="p-1 min-h-[50px]">{report.notes}</p>
                            </section>
                            <footer className="grid grid-cols-2 gap-4 pt-2 break-inside-avoid">
                                <div>
                                    <p><strong>Razítko a podpis zákazníka</strong></p>
                                    {report.customerSignature ? <img src={report.customerSignature} alt="Customer Signature" className="h-16 w-auto border mt-1"/> : <div className="h-16 border mt-1"></div>}
                                    <p className="mt-4"><strong>Datum:</strong> {new Date(report.date).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <table className="w-full border-collapse border border-black">
                                        <tbody>
                                            <tr><td className="border border-black p-1"><strong>Kontrolu provedl</strong></td><td className="border border-black p-1">{report.technicians.join(', ')}</td></tr>
                                            <tr><td className="border border-black p-1"><strong>Podpis</strong></td><td className="border border-black p-1 h-16">{report.technicianSignature && <img src={report.technicianSignature} alt="Technician Signature" className="h-12 w-auto"/>}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </footer>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ServiceReportPrint;