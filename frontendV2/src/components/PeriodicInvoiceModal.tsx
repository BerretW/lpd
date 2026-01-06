import React, { useState, useEffect, useMemo } from 'react';
import { Client, Company, ClientBillingReportOut, VatSettings } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Input from './common/Input';
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
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [billingReport, setBillingReport] = useState<ClientBillingReportOut | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(false);
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
    }, [billingReport, vatSettings]);

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
                        <Button variant="secondary" onClick={() => setBillingReport(null)}>Zpět</Button>
                        <Button onClick={handlePrint}>Tisk</Button>
                    </div>
                    <div id="periodic-invoice-print-area" className="p-8 bg-white shadow-lg mx-auto text-slate-900" style={{width: '210mm'}}>
                        <h1 className="text-3xl font-bold mb-6">Faktura</h1>
                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <h3 className="font-bold">Dodavatel:</h3>
                                <p>{company?.legal_name || company?.name}</p><p>{company?.address}</p><p>IČO: {company?.ico}</p><p>DIČ: {company?.dic}</p>
                            </div>
                            <div>
                                <h3 className="font-bold">Odběratel:</h3>
                                <p>{selectedClient?.legal_name || selectedClient?.name}</p><p>{selectedClient?.address}</p>{selectedClient?.ico && <p>IČO: {selectedClient.ico}</p>}{selectedClient?.dic && <p>DIČ: {selectedClient.dic}</p>}
                            </div>
                        </div>
                         <div className="mb-4">
                            <p><strong>Datum vystavení:</strong> {new Date().toLocaleDateString('cs-CZ')}</p>
                            <p><strong>Zdanitelné plnění za období:</strong> {new Date(startDate).toLocaleDateString('cs-CZ')} - {new Date(endDate).toLocaleDateString('cs-CZ')}</p>
                        </div>
                        <h2 className="text-xl font-bold border-b pb-2 mb-4">Položky</h2>
                        <h3 className="text-lg font-semibold mt-6 mb-2">Práce</h3>
                        <table className="w-full text-left text-sm">
                            <thead><tr className="bg-slate-200 text-slate-700"><th className="p-2">Druh práce</th><th className="p-2">Počet hodin</th><th className="p-2">Sazba/hod</th><th className="p-2 text-right">Cena celkem</th></tr></thead>
                            <tbody>{billingReport.time_logs.map((item, i) => (<tr key={`l-${i}`} className="border-b"><td className="p-2">{item.work_type_name} ({item.task_name})</td><td className="p-2">{item.hours.toFixed(2)} hod</td><td className="p-2">{item.rate.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td><td className="p-2 text-right">{item.total_price.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td></tr>))}</tbody>
                        </table>
                        <h3 className="text-lg font-semibold mt-6 mb-2">Materiál</h3>
                        <table className="w-full text-left text-sm">
                            <thead><tr className="bg-slate-200 text-slate-700"><th className="p-2">Název</th><th className="p-2">Množství</th><th className="p-2">Cena/ks</th><th className="p-2 text-right">Cena celkem</th></tr></thead>
                            <tbody>{billingReport.used_items.map((item, i) => (<tr key={`m-${i}`} className="border-b"><td className="p-2">{item.item_name} ({item.task_name})</td><td className="p-2">{item.quantity} ks</td><td className="p-2">{item.price.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td><td className="p-2 text-right">{item.total_price.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td></tr>))}</tbody>
                        </table>
                        <div className="mt-8 pt-4 border-t-2 flex justify-end"><table className="w-1/2 text-sm"><tbody><tr><td className="py-1 pr-4">Základ daně (práce {vatSettings.laborRate}%):</td><td className="text-right font-semibold">{laborTotal.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td></tr><tr><td className="py-1 pr-4">DPH ({vatSettings.laborRate}%):</td><td className="text-right font-semibold">{laborVat.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td></tr><tr><td className="py-1 pr-4">Základ daně (materiál {vatSettings.materialRate}%):</td><td className="text-right font-semibold">{materialTotal.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td></tr><tr><td className="py-1 pr-4">DPH ({vatSettings.materialRate}%):</td><td className="text-right font-semibold">{materialVat.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td></tr><tr className="border-t-2 mt-2 pt-2"><td className="py-1 pr-4 font-bold text-lg">Celkem k úhradě:</td><td className="text-right font-bold text-lg">{grandTotal.toLocaleString('cs-CZ',{style:'currency',currency:'CZK'})}</td></tr></tbody></table></div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default PeriodicInvoiceModal;