import React, { useState, useEffect, useMemo } from 'react';
import { Client, Company, ClientBillingReportOut, VatSettings } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Input from './common/Input';
import Icon from './common/Icon';
import * as api from '../api';
import { useAuth } from '../AuthContext';
import ErrorMessage from './common/ErrorMessage';

interface PeriodicInvoiceModalProps {
    onClose: () => void;
}

const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];

const PeriodicInvoiceModal: React.FC<PeriodicInvoiceModalProps> = ({ onClose }) => {
    const { companyId } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const[startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const[billingReport, setBillingReport] = useState<ClientBillingReportOut | null>(null);
    const[company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Hardcoded for now, a real app would fetch this.
    const vatSettings: VatSettings = { laborRate: 21, materialRate: 21 };

    useEffect(() => {
        if (!companyId) return;

        handleSetLastMonth();

        const fetchData = async () => {
            try {
                const [clientData, companyData] = await Promise.all([
                    api.getClients(companyId),
                    api.getCompany(companyId)
                ]);
                setClients(clientData);
                setCompany(companyData);
            } catch (err) {
                setError('Nepodařilo se načíst potřebná data.');
            }
        };
        fetchData();
    }, [companyId]);
    
    const handleGenerateReport = async () => {
        if (!companyId || !selectedClientId || !startDate || !endDate) {
            setError('Vyberte prosím klienta a časové období.');
            return;
        }
        setLoading(true);
        setError(null);
        setBillingReport(null);
        try {
            const report = await api.getBillingReportForClient(companyId, parseInt(selectedClientId), startDate, endDate);
            setBillingReport(report);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Generování reportu selhalo.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportPohoda = async () => {
        if (!selectedClientId) return;
        setIsExporting(true);
        try {
            await api.exportPeriodicInvoiceToPohoda(companyId, parseInt(selectedClientId), startDate, endDate);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Chyba při exportu do Pohody.");
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById('periodic-invoice-print-area');
        if (printContent) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write('<html><head><title>Faktura</title><script src="https://cdn.tailwindcss.com"></script></head><body>');
            printWindow?.document.write(printContent.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            setTimeout(() => {
                printWindow?.print();
                printWindow?.close();
            }, 250);
        }
    };

    const { laborTotal, materialTotal, laborVat, materialVat, grandTotal } = useMemo(() => {
        if (!billingReport) return { laborTotal: 0, materialTotal: 0, laborVat: 0, materialVat: 0, grandTotal: 0 };
        const laborTotal = billingReport.total_price_work;
        const materialTotal = billingReport.total_price_inventory;
        const laborVatCalc = laborTotal * (vatSettings.laborRate / 100);
        const materialVatCalc = materialTotal * (vatSettings.materialRate / 100);
        const grandTotalCalc = laborTotal + materialTotal + laborVatCalc + materialVatCalc;
        return { laborTotal, materialTotal, laborVat: laborVatCalc, materialVat: materialVatCalc, grandTotal: grandTotalCalc };
    },[billingReport, vatSettings]);

    const selectedClient = clients.find(c => c.id === parseInt(selectedClientId));

    const setDateRange = (start: Date, end: Date) => {
        setStartDate(toYYYYMMDD(start));
        setEndDate(toYYYYMMDD(end));
    };

    const handleSetLastMonth = () => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        setDateRange(firstDay, lastDay);
    };

    const handleSetThisMonth = () => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setDateRange(firstDay, lastDay);
    };

    return (
        <Modal title="Periodická fakturace" onClose={onClose}>
            {!billingReport ? (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">Vygenerujte souhrnnou fakturu pro klienta za vybrané časové období.</p>
                    <ErrorMessage message={error} />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Klient</label>
                        <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full p-2 border rounded">
                            <option value="">-- Vyberte klienta --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Rychlý výběr období</label>
                        <div className="flex space-x-2">
                            <Button type="button" variant="secondary" className="!text-xs !py-1 !px-2" onClick={handleSetLastMonth}>
                                Minulý měsíc
                            </Button>
                            <Button type="button" variant="secondary" className="!text-xs !py-1 !px-2" onClick={handleSetThisMonth}>
                                Tento měsíc
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Od data" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <Input label="Do data" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button onClick={handleGenerateReport} disabled={loading || !selectedClientId}>
                            {loading ? 'Generuji...' : 'Vygenerovat náhled'}
                        </Button>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <Button variant="secondary" onClick={() => setBillingReport(null)}>
                            <Icon name="fa-arrow-left" className="mr-2"/> Zpět
                        </Button>
                        <div>
                            {/* NOVÉ TLAČÍTKO PRO EXPORT DO POHODY */}
                            <button 
                                onClick={handleExportPohoda} 
                                disabled={isExporting}
                                className="mr-4 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors text-white font-semibold"
                            >
                                <Icon name={isExporting ? "fa-spinner fa-spin" : "fa-file-code"} className="mr-2"/> 
                                {isExporting ? "Exportuji..." : "Export Pohoda (XML)"}
                            </button>

                            <Button onClick={handlePrint}>
                                <Icon name="fa-print" className="mr-2"/> Tisk
                            </Button>
                        </div>
                    </div>
                    <div id="periodic-invoice-print-area" className="p-8 bg-white shadow-lg mx-auto text-slate-900" style={{width: '210mm'}}>
                        <h1 className="text-3xl font-bold mb-6">Faktura</h1>
                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <h3 className="font-bold text-gray-500 uppercase text-xs mb-2">Dodavatel:</h3>
                                <p className="font-semibold text-lg">{company?.legal_name || company?.name}</p>
                                <p>{company?.address}</p>
                                <p className="mt-2">IČO: {company?.ico}</p>
                                <p>DIČ: {company?.dic}</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-500 uppercase text-xs mb-2">Odběratel:</h3>
                                <p className="font-semibold text-lg">{selectedClient?.legal_name || selectedClient?.name}</p>
                                <p>{selectedClient?.address}</p>
                                {selectedClient?.ico && <p className="mt-2">IČO: {selectedClient.ico}</p>}
                                {selectedClient?.dic && <p>DIČ: {selectedClient.dic}</p>}
                            </div>
                        </div>
                         <div className="mb-4">
                            <p><strong>Datum vystavení:</strong> {new Date().toLocaleDateString('cs-CZ')}</p>
                            <p><strong>Zdanitelné plnění za období:</strong> {new Date(startDate).toLocaleDateString('cs-CZ')} - {new Date(endDate).toLocaleDateString('cs-CZ')}</p>
                        </div>
                        <h2 className="text-xl font-bold border-b pb-2 mb-4 mt-6">Položky faktury</h2>
                        
                        <h3 className="text-sm font-bold uppercase text-slate-500 mt-4 mb-2">Práce</h3>
                        <table className="w-full text-left text-sm mb-4">
                            <thead className="border-b-2 border-slate-200">
                                <tr className="text-slate-500">
                                    <th className="py-2">Druh práce</th>
                                    <th className="py-2 text-right">Počet hodin</th>
                                    <th className="py-2 text-right">Sazba/hod</th>
                                    <th className="py-2 text-right">Cena celkem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {billingReport.time_logs.map((item, i) => (
                                    <tr key={`l-${i}`} className="border-b border-slate-100">
                                        <td className="py-2">{item.work_type_name} ({item.task_name})</td>
                                        <td className="py-2 text-right">{item.hours.toFixed(2)} hod</td>
                                        <td className="py-2 text-right">{item.rate.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td>
                                        <td className="py-2 text-right font-medium">{item.total_price.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        <h3 className="text-sm font-bold uppercase text-slate-500 mt-6 mb-2">Materiál</h3>
                        <table className="w-full text-left text-sm">
                            <thead className="border-b-2 border-slate-200">
                                <tr className="text-slate-500">
                                    <th className="py-2">Název</th>
                                    <th className="py-2 text-right">Množství</th>
                                    <th className="py-2 text-right">Cena/ks</th>
                                    <th className="py-2 text-right">Cena celkem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {billingReport.used_items.map((item, i) => (
                                    <tr key={`m-${i}`} className="border-b border-slate-100">
                                        <td className="py-2">{item.item_name} ({item.task_name})</td>
                                        <td className="py-2 text-right">{item.quantity} ks</td>
                                        <td className="py-2 text-right">{item.unit_price_sold.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td>
                                        <td className="py-2 text-right font-medium">{item.total_price.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-8 pt-4 border-t-2 flex justify-end">
                            <div className="w-1/2 bg-slate-50 p-4 rounded-lg">
                                <table className="w-full text-sm">
                                    <tbody>
                                        <tr>
                                            <td className="py-1 text-slate-500">Základ daně (práce {vatSettings.laborRate}%):</td>
                                            <td className="text-right">{laborTotal.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1 text-slate-500">DPH ({vatSettings.laborRate}%):</td>
                                            <td className="text-right">{laborVat.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1 text-slate-500">Základ daně (materiál {vatSettings.materialRate}%):</td>
                                            <td className="text-right">{materialTotal.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1 text-slate-500 pb-4 border-b border-slate-200">DPH ({vatSettings.materialRate}%):</td>
                                            <td className="text-right pb-4 border-b border-slate-200">{materialVat.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td>
                                        </tr>
                                        <tr className="text-lg font-bold">
                                            <td className="py-4">Celkem k úhradě:</td>
                                            <td className="text-right py-4 text-slate-900">{grandTotal.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
                            <p>Faktura vygenerována systémem LPD Worker OS</p>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default PeriodicInvoiceModal;