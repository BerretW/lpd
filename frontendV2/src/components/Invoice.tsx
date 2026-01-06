import React, { useState, useEffect, useMemo } from 'react';
import { InventoryItem, VatSettings, WorkOrderOut, Company, WorkTypeOut, TaskOut, BillingReportOut } from '../types';
import Icon from './common/Icon';
import { useAuth } from '../AuthContext';
import * as api from '../api';
import ErrorMessage from './common/ErrorMessage';

interface InvoiceProps {
    workOrder: WorkOrderOut;
    billingReport: BillingReportOut | null;
    company: Company | null;
    vatSettings: VatSettings;
    onClose: () => void;
    onMarkAsBilled?: () => void;
}

const Invoice: React.FC<InvoiceProps> = ({ workOrder, billingReport, company, vatSettings, onClose, onMarkAsBilled }) => {
    
    const { laborTotal, materialTotal, laborVat, materialVat, grandTotal } = useMemo(() => {
        if (!billingReport) {
            return { laborTotal: 0, materialTotal: 0, laborVat: 0, materialVat: 0, grandTotal: 0 };
        }
        
        const laborTotal = billingReport.total_price_work;
        const materialTotal = billingReport.total_price_inventory;
        const laborVatCalc = laborTotal * (vatSettings.laborRate / 100);
        const materialVatCalc = materialTotal * (vatSettings.materialRate / 100);
        const grandTotalCalc = laborTotal + materialTotal + laborVatCalc + materialVatCalc;

        return {
            laborTotal,
            materialTotal,
            laborVat: laborVatCalc,
            materialVat: materialVatCalc,
            grandTotal: grandTotalCalc
        };
    }, [billingReport, vatSettings]);

    const handlePrint = () => {
        const printContent = document.getElementById('invoice-print-area');
        if (printContent) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write('<html><head><title>Faktura</title>');
            printWindow?.document.write('<script src="https://cdn.tailwindcss.com"></script>');
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
    
    const renderInvoiceBody = () => {
        if(!billingReport) {
             return <div className="text-center p-16 text-slate-700">Pro tuto zakázku neexistují žádná fakturační data.</div>;
        }

        return (
             <div id="invoice-print-area" className="p-8 bg-white shadow-lg mx-auto text-slate-900" style={{width: '210mm'}}>
                <h1 className="text-3xl font-bold mb-6">Faktura</h1>
                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <h3 className="font-bold">Dodavatel:</h3>
                        <p>{company?.legal_name || company?.name}</p>
                        <p>{company?.address}</p>
                        <p>IČO: {company?.ico}</p>
                        <p>DIČ: {company?.dic}</p>
                    </div>
                    <div>
                        <h3 className="font-bold">Odběratel:</h3>
                        <p>{workOrder.client?.legal_name || workOrder.client?.name}</p>
                        <p>{workOrder.client?.address}</p>
                        {workOrder.client?.ico && <p>IČO: {workOrder.client.ico}</p>}
                        {workOrder.client?.dic && <p>DIČ: {workOrder.client.dic}</p>}
                    </div>
                </div>

                <h2 className="text-xl font-bold border-b pb-2 mb-4">Položky</h2>
                
                <h3 className="text-lg font-semibold mt-6 mb-2">Práce</h3>
                <table className="w-full text-left text-sm">
                        <thead><tr className="bg-slate-200 text-slate-700"><th className="p-2">Druh práce</th><th className="p-2">Počet hodin</th><th className="p-2">Sazba/hod (bez DPH)</th><th className="p-2 text-right">Cena celkem (bez DPH)</th></tr></thead>
                    <tbody>
                         {billingReport.time_logs.map((item, i) => (
                            <tr key={`labor-${i}`} className="border-b text-black">
                                <td className="p-2">{item.work_type_name} ({item.task_name})</td>
                                <td className="p-2">{item.hours.toFixed(2)} hod</td>
                                <td className="p-2">{item.rate.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td>
                                <td className="p-2 text-right">{item.total_price.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td>
                            </tr>
                        ))}
                        {billingReport.time_logs.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-4 text-center italic text-slate-500">Nebyla evidována žádná práce.</td>
                            </tr>
                        )}
                    </tbody>
                </table>


                <h3 className="text-lg font-semibold mt-6 mb-2">Materiál</h3>
                <table className="w-full text-left text-sm">
                        <thead><tr className="bg-slate-200 text-slate-700"><th className="p-2">Název</th><th className="p-2">Množství</th><th className="p-2">Cena/ks (bez DPH)</th><th className="p-2 text-right">Cena celkem (bez DPH)</th></tr></thead>
                    <tbody>
                        {billingReport.used_items.map((item, i) => (
                            <tr key={`mat-${i}`} className="border-b text-black">
                                <td className="p-2">{item.item_name}</td>
                                <td className="p-2">{item.quantity} ks</td>
                                <td className="p-2">{item.price ? item.price.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' }) : 'N/A'}</td>
                                <td className="p-2 text-right">{item.total_price ? item.total_price.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' }) : 'N/A'}</td>
                            </tr>
                        ))}
                        {billingReport.used_items.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-4 text-center italic text-slate-500">Nebyl použit žádný materiál.</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="mt-8 pt-4 border-t-2 flex justify-end">
                    <table className="w-1/2 text-sm text-black">
                        <tbody>
                            <tr><td className="py-1 pr-4">Základ daně (práce {vatSettings.laborRate}%):</td><td className="text-right font-semibold">{laborTotal.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td></tr>
                            <tr><td className="py-1 pr-4">DPH (práce {vatSettings.laborRate}%):</td><td className="text-right font-semibold">{laborVat.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td></tr>
                            <tr><td className="py-1 pr-4">Základ daně (materiál {vatSettings.materialRate}%):</td><td className="text-right font-semibold">{materialTotal.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td></tr>
                            <tr><td className="py-1 pr-4">DPH (materiál {vatSettings.materialRate}%):</td><td className="text-right font-semibold">{materialVat.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td></tr>
                            <tr className="border-t-2 mt-2 pt-2"><td className="py-1 pr-4 font-bold text-lg">Celkem k úhradě:</td><td className="text-right font-bold text-lg">{grandTotal.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b bg-gray-800 text-white rounded-t-lg">
                    <h2 className="text-xl font-semibold">Faktura - {workOrder.name}</h2>
                    <div>
                         {onMarkAsBilled && (
                            <button onClick={onMarkAsBilled} className="mr-4 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-md transition-colors">
                                <i className="fas fa-check-circle mr-2"></i> Označit jako fakturované
                            </button>
                        )}
                        <button onClick={handlePrint} className="mr-4 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors" disabled={!billingReport}>
                            <i className="fas fa-print mr-2"></i> Tisk
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <i className="fas fa-times text-2xl"></i>
                        </button>
                    </div>
                </header>
                <main className="p-6 overflow-y-auto bg-slate-100 text-slate-800">
                   {renderInvoiceBody()}
                </main>
            </div>
        </div>
    );
};

export default Invoice;