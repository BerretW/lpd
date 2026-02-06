import React, { useState, useEffect, useMemo } from 'react';
import { VatSettings, WorkOrderOut, Company, BillingReportOut, BillingReportItem } from '../types';
import Icon from './common/Icon';
import Button from './common/Button';

interface InvoiceProps {
    workOrder: WorkOrderOut;
    billingReport: BillingReportOut | null;
    company: Company | null;
    vatSettings: VatSettings;
    onClose: () => void;
    onMarkAsBilled?: () => void;
}

interface EditableTimeLog {
    id?: number;
    work_type_name: string;
    task_name: string;
    hours: number;
    rate: number;
    total_price: number;
}

const Invoice: React.FC<InvoiceProps> = ({ workOrder, billingReport, company, vatSettings, onClose, onMarkAsBilled }) => {
    
    // Lokální stav pro editovatelné položky
    const [editableLabor, setEditableLabor] = useState<EditableTimeLog[]>([]);
    const [editableMaterial, setEditableMaterial] = useState<BillingReportItem[]>([]);
    
    // NOVÉ: Stav pro globální úpravu v %
    const [globalModifier, setGlobalModifier] = useState<number>(0);

    // Inicializace stavu
    useEffect(() => {
        if (billingReport) {
            setEditableLabor(billingReport.time_logs || []);
            setEditableMaterial(billingReport.used_items || []);
        }
    }, [billingReport]);

    // Přepočet všech součtů
    const { 
        laborSubtotal, 
        materialSubtotal, 
        rawTotal, 
        adjustmentAmount, 
        laborTotalAdjusted,
        materialTotalAdjusted,
        laborVat, 
        materialVat, 
        grandTotal 
    } = useMemo(() => {
        // 1. Hrubé součty z řádků
        const lTotal = editableLabor.reduce((sum, item) => sum + (item.total_price || 0), 0);
        const mTotal = editableMaterial.reduce((sum, item) => sum + (item.total_price || 0), 0);
        const rawSum = lTotal + mTotal;

        // 2. Výpočet úpravy (slevy/přirážky)
        // Multiplikátor: např. pro slevu -10% to bude 0.9, pro přirážku +10% to bude 1.1
        const multiplier = 1 + (globalModifier / 100);
        
        // 3. Aplikace úpravy na základy daně (aby sedělo DPH)
        const lTotalAdj = lTotal * multiplier;
        const mTotalAdj = mTotal * multiplier;
        
        // Hodnota úpravy v korunách (pro zobrazení na faktuře)
        const adjAmount = rawSum * (globalModifier / 100);

        // 4. Výpočet DPH z UPRAVENÝCH základů
        const lVat = lTotalAdj * (vatSettings.laborRate / 100);
        const mVat = mTotalAdj * (vatSettings.materialRate / 100);
        
        // 5. Celkový součet
        const gTotal = lTotalAdj + mTotalAdj + lVat + mVat;

        return {
            laborSubtotal: lTotal,
            materialSubtotal: mTotal,
            rawTotal: rawSum,
            adjustmentAmount: adjAmount,
            laborTotalAdjusted: lTotalAdj,
            materialTotalAdjusted: mTotalAdj,
            laborVat: lVat,
            materialVat: mVat,
            grandTotal: gTotal
        };
    }, [editableLabor, editableMaterial, vatSettings, globalModifier]);

    // Handlery pro změny řádků (beze změn)
    const handleMaterialChange = (index: number, field: 'unit_price_sold' | 'total_price', value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        const newItems = [...editableMaterial];
        const item = newItems[index];
        if (field === 'unit_price_sold') {
            item.unit_price_sold = numValue;
            item.total_price = numValue * item.quantity;
        } else {
            item.total_price = numValue;
            if (item.quantity > 0) item.unit_price_sold = numValue / item.quantity;
        }
        setEditableMaterial(newItems);
    };

    const handleLaborChange = (index: number, field: 'rate' | 'total_price', value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        const newLogs = [...editableLabor];
        const log = newLogs[index];
        if (field === 'rate') {
            log.rate = numValue;
            log.total_price = numValue * log.hours;
        } else {
            log.total_price = numValue;
            if (log.hours > 0) log.rate = numValue / log.hours;
        }
        setEditableLabor(newLogs);
    };

    const handlePrint = () => {
        const printContent = document.getElementById('invoice-print-area');
        if (printContent) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write('<html><head><title>Faktura</title>');
            printWindow?.document.write('<script src="https://cdn.tailwindcss.com"></script>');
            printWindow?.document.write(`
                <style>
                    @media print { 
                        body { -webkit-print-color-adjust: exact; } 
                        .no-print { display: none !important; } 
                        .print-only { display: block !important; }
                        input { display: none !important; }
                    }
                    .print-only { display: none; }
                </style>
            `);
            printWindow?.document.write('</head><body>');
            // Pro přenos hodnot z inputů do HTML pro tisk
            const container = document.createElement('div');
            container.innerHTML = printContent.innerHTML;
            // Ručně přeneseme hodnoty, pokud by se nepřenesly (u React inputů to bývá nutné)
            // Ale zde používáme span .print-only pro hodnoty, takže to bude fungovat OK.
            
            printWindow?.document.write(printContent.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            setTimeout(() => {
                printWindow?.print();
                printWindow?.close();
            }, 500);
        }
    };
    
    const renderInvoiceBody = () => {
        if(!billingReport) return <div className="text-center p-16">Chybí data.</div>;

        return (
             <div id="invoice-print-area" className="p-8 bg-white shadow-lg mx-auto text-slate-900" style={{width: '210mm', minHeight: '297mm'}}>
                
                {/* Hlavička */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-800">Faktura</h1>
                        {/* Zobrazení pro "debil" přirážku nebo slevu jen pokud je aktivní */}
                        {globalModifier !== 0 && (
                            <p className="text-sm mt-1 font-semibold text-slate-500">
                                {globalModifier > 0 ? 'Obsahuje expresní příplatek' : 'Obsahuje zákaznickou slevu'}
                            </p>
                        )}
                    </div>
                    <div className="text-right text-sm">
                        <p className="font-bold">Variabilní symbol: {workOrder.id}2024</p>
                        <p>Datum vystavení: {new Date().toLocaleDateString('cs-CZ')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-12">
                    <div>
                        <h3 className="font-bold text-gray-500 uppercase text-xs mb-2">Dodavatel</h3>
                        <div className="font-semibold text-lg">{company?.legal_name || company?.name}</div>
                        <p>{company?.address}</p>
                        <p className="mt-2">IČO: {company?.ico}</p>
                        <p>DIČ: {company?.dic}</p>
                        <p className="mt-2">Banka: {company?.bank_account} / {company?.iban}</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-500 uppercase text-xs mb-2">Odběratel</h3>
                        <div className="font-semibold text-lg">{workOrder.client?.legal_name || workOrder.client?.name}</div>
                        <p>{workOrder.client?.address}</p>
                        {workOrder.client?.ico && <p className="mt-2">IČO: {workOrder.client.ico}</p>}
                        {workOrder.client?.dic && <p>DIČ: {workOrder.client.dic}</p>}
                    </div>
                </div>

                <h2 className="text-xl font-bold border-b-2 border-slate-800 pb-2 mb-4">Položky faktury</h2>
                
                {/* Práce */}
                <h3 className="text-sm font-bold uppercase text-slate-500 mt-6 mb-2">Práce</h3>
                <table className="w-full text-left text-sm mb-4">
                        <thead className="border-b-2 border-slate-200">
                            <tr className="text-slate-500">
                                <th className="py-2 w-1/2">Popis</th>
                                <th className="py-2 text-right">Hodiny</th>
                                <th className="py-2 text-right w-32">Sazba/hod</th>
                                <th className="py-2 text-right w-32">Celkem</th>
                            </tr>
                        </thead>
                    <tbody>
                         {editableLabor.map((item, i) => (
                            <tr key={`labor-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-2">{item.work_type_name} ({item.task_name})</td>
                                <td className="py-2 text-right">{item.hours.toFixed(2)}</td>
                                <td className="py-2 text-right">
                                    <input type="number" className="text-right w-24 p-1 border-transparent hover:border-slate-300 rounded bg-transparent focus:bg-white focus:border-red-500 outline-none no-print"
                                        value={item.rate || 0} onChange={(e) => handleLaborChange(i, 'rate', e.target.value)}/>
                                    <span className="print-only">{item.rate.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span>
                                </td>
                                <td className="py-2 text-right font-medium">
                                    <input type="number" className="text-right w-24 p-1 border-transparent hover:border-slate-300 rounded bg-transparent focus:bg-white focus:border-red-500 outline-none no-print font-bold"
                                        value={item.total_price || 0} onChange={(e) => handleLaborChange(i, 'total_price', e.target.value)}/>
                                    <span className="print-only">{item.total_price.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Materiál */}
                <h3 className="text-sm font-bold uppercase text-slate-500 mt-6 mb-2">Materiál</h3>
                <table className="w-full text-left text-sm">
                    <thead className="border-b-2 border-slate-200">
                        <tr className="text-slate-500">
                            <th className="py-2 w-1/2">Název položky</th>
                            <th className="py-2 text-right">Množství</th>
                            <th className="py-2 text-right w-32">Cena/ks</th>
                            <th className="py-2 text-right w-32">Celkem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {editableMaterial.map((item, i) => (
                            <tr key={`mat-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-2">{item.item_name}</td>
                                <td className="py-2 text-right">{item.quantity} ks</td>
                                <td className="py-2 text-right">
                                    <input type="number" className="text-right w-24 p-1 border-transparent hover:border-slate-300 rounded bg-transparent focus:bg-white focus:border-red-500 outline-none no-print"
                                        value={item.unit_price_sold ? Math.round(item.unit_price_sold * 100) / 100 : 0} onChange={(e) => handleMaterialChange(i, 'unit_price_sold', e.target.value)}/>
                                    <span className="print-only">{(item.unit_price_sold || 0).toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span>
                                </td>
                                <td className="py-2 text-right font-medium">
                                    <input type="number" className="text-right w-24 p-1 border-transparent hover:border-slate-300 rounded bg-transparent focus:bg-white focus:border-red-500 outline-none no-print font-bold"
                                        value={item.total_price ? Math.round(item.total_price * 100) / 100 : 0} onChange={(e) => handleMaterialChange(i, 'total_price', e.target.value)}/>
                                    <span className="print-only">{(item.total_price || 0).toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Sekce Součty */}
                <div className="mt-8 flex flex-col items-end">
                    
                    {/* NOVÉ: Ovládání globální úpravy (jen na obrazovce) */}
                    <div className="no-print bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4 w-1/2">
                        <label className="block text-sm font-bold text-yellow-800 mb-1">
                            Globální úprava ceny (Sleva / Přirážka)
                        </label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                value={globalModifier}
                                onChange={(e) => setGlobalModifier(Number(e.target.value))}
                                className="w-20 p-1 border border-yellow-400 rounded text-right font-bold"
                                placeholder="0"
                            />
                            <span className="text-yellow-800 font-bold">%</span>
                            <span className="text-xs text-yellow-700 ml-2">
                                (Záporné číslo = Sleva, Kladné = Přirážka)
                            </span>
                        </div>
                    </div>

                    <div className="w-1/2 bg-slate-50 p-4 rounded-lg">
                        <table className="w-full text-sm">
                            <tbody>
                                {/* Mezisoučet (jen pokud je aktivní úprava) */}
                                {globalModifier !== 0 && (
                                    <>
                                        <tr>
                                            <td className="py-1 text-slate-500">Mezisoučet:</td>
                                            <td className="text-right">{rawTotal.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td>
                                        </tr>
                                        <tr className="border-b border-slate-300">
                                            <td className="py-1 text-slate-800 font-medium">
                                                {globalModifier > 0 ? 'Přirážka' : 'Sleva'} ({globalModifier}%):
                                            </td>
                                            <td className={`text-right font-medium ${globalModifier > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {adjustmentAmount.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}
                                            </td>
                                        </tr>
                                        <tr><td colSpan={2} className="py-2"></td></tr>
                                    </>
                                )}

                                <tr>
                                    <td className="py-1 text-slate-500">Základ daně (práce {vatSettings.laborRate}%):</td>
                                    <td className="text-right">{laborTotalAdjusted.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 text-slate-500">DPH (práce {vatSettings.laborRate}%):</td>
                                    <td className="text-right">{laborVat.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 text-slate-500">Základ daně (materiál {vatSettings.materialRate}%):</td>
                                    <td className="text-right">{materialTotalAdjusted.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 text-slate-500 pb-4 border-b border-slate-200">DPH (materiál {vatSettings.materialRate}%):</td>
                                    <td className="text-right pb-4 border-b border-slate-200">{materialVat.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td>
                                </tr>
                                <tr className="text-lg font-bold">
                                    <td className="py-4">Celkem k úhradě:</td>
                                    <td className="text-right py-4 text-slate-900">{grandTotal.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div className="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
                    <p>Faktura vygenerována systémem ProfiTechnik OS</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b bg-gray-800 text-white rounded-t-lg no-print">
                    <div className="flex items-center">
                        <h2 className="text-xl font-semibold mr-4">Faktura - {workOrder.name}</h2>
                        <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded font-bold">
                            <Icon name="fa-pen" className="mr-1"/> Režim úprav
                        </span>
                    </div>
                    <div>
                         {onMarkAsBilled && (
                            <button onClick={onMarkAsBilled} className="mr-4 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-md transition-colors">
                                <Icon name="fa-check-circle" className="mr-2"/> Označit jako fakturované
                            </button>
                        )}
                        <button onClick={handlePrint} className="mr-4 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors" disabled={!billingReport}>
                            <Icon name="fa-print" className="mr-2"/> Tisk
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <Icon name="fa-times" className="text-2xl"/>
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