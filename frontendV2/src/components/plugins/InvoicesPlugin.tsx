import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../common/Icon';
import ErrorMessage from '../common/ErrorMessage';
import {
    listInvoices,
    updateInvoiceStatus,
    InvoiceOut,
    INVOICE_STATUS_LABELS,
    INVOICE_STATUS_COLORS,
} from '../../api/invoices';
import { getQuote } from '../../api/quotes';
import { getCompany } from '../../api/company';
import { getClients } from '../../api/clients';
import {
    printInvoicePdf,
    computeVatBreakdown,
    InvoiceCompany,
    InvoiceClient,
    InvoiceConfig,
} from './quotes/utils';
import { getBillingReport, exportInvoiceXml } from '../../api/billing';
import { BillingReportOut, BillingReportItem } from '../../types';

interface InvoicesPluginProps {
    companyId: number;
}

const ALL_STATUSES = Object.keys(INVOICE_STATUS_LABELS);

const InvoicesPlugin: React.FC<InvoicesPluginProps> = ({ companyId }) => {
    const [invoices, setInvoices] = useState<InvoiceOut[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterText, setFilterText] = useState('');
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceOut | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listInvoices(companyId);
            setInvoices(data);
        } catch (e: any) {
            setError(e.message ?? 'Nepodařilo se načíst faktury.');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleStatusChange = async (invoice: InvoiceOut, newStatus: string) => {
        setUpdatingId(invoice.id);
        try {
            const updated = await updateInvoiceStatus(companyId, invoice.id, newStatus);
            setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv));
        } catch (e: any) {
            setError(e.message ?? 'Nepodařilo se aktualizovat stav.');
        } finally {
            setUpdatingId(null);
        }
    };

    const filtered = invoices.filter(inv => {
        if (filterStatus && inv.status !== filterStatus) return false;
        if (filterText) {
            const q = filterText.toLowerCase();
            return (
                inv.invoice_number.toLowerCase().includes(q) ||
                (inv.quote_name ?? '').toLowerCase().includes(q) ||
                (inv.work_order_name ?? '').toLowerCase().includes(q) ||
                (inv.customer_name ?? '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    const totalGross = filtered.reduce((sum, inv) => sum + inv.total_gross, 0);
    const totalNet = filtered.reduce((sum, inv) => sum + inv.total_net, 0);

    const fmt = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Icon name="fa-file-invoice" />
                    Faktury
                </h1>
                <button
                    onClick={fetchData}
                    className="text-slate-500 hover:text-slate-700 p-2 rounded-md hover:bg-slate-100"
                    title="Obnovit"
                >
                    <Icon name="fa-sync-alt" />
                </button>
            </div>

            {error && <ErrorMessage message={error} />}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <input
                    type="text"
                    placeholder="Hledat číslo, nabídku, zákazníka..."
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Všechny stavy</option>
                    {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>
                    ))}
                </select>
                <span className="text-sm text-slate-500 ml-auto">
                    {filtered.length} faktur / {fmt(totalNet)} Kč bez DPH / {fmt(totalGross)} Kč s DPH
                </span>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Icon name="fa-spinner fa-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="fa-file-invoice" />
                    <p className="mt-2">Žádné faktury nenalezeny.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 text-left">Číslo faktury</th>
                                <th className="px-4 py-3 text-left">Zdroj</th>
                                <th className="px-4 py-3 text-left">Zákazník</th>
                                <th className="px-4 py-3 text-left">Vystaveno</th>
                                <th className="px-4 py-3 text-left">Splatnost</th>
                                <th className="px-4 py-3 text-right">Bez DPH</th>
                                <th className="px-4 py-3 text-right">S DPH</th>
                                <th className="px-4 py-3 text-left">Stav</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filtered.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                                    <td className="px-4 py-3 font-mono font-medium text-slate-800">
                                        {inv.invoice_number}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                                        {inv.quote_name
                                            ? <span title="Nabídka">📄 {inv.quote_name}</span>
                                            : inv.work_order_name
                                            ? <span title="Zakázka">🔧 {inv.work_order_name}</span>
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {inv.customer_name ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                        {inv.issue_date}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={new Date(inv.due_date) < new Date() && inv.status !== 'paid' && inv.status !== 'cancelled' ? 'text-red-600 font-medium' : 'text-slate-600'}>
                                            {inv.due_date}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                                        {fmt(inv.total_net)} Kč
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                                        {fmt(inv.total_gross)} Kč
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={inv.status}
                                            disabled={updatingId === inv.id}
                                            onChange={e => { e.stopPropagation(); handleStatusChange(inv, e.target.value); }}
                                            onClick={e => e.stopPropagation()}
                                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${INVOICE_STATUS_COLORS[inv.status] ?? 'bg-slate-100 text-slate-600'} ${updatingId === inv.id ? 'opacity-50' : ''}`}
                                        >
                                            {ALL_STATUSES.map(s => (
                                                <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedInvoice && (
                <InvoiceDetailModal
                    invoice={selectedInvoice}
                    companyId={companyId}
                    onClose={() => setSelectedInvoice(null)}
                />
            )}
        </div>
    );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
    invoice: InvoiceOut;
    companyId: number;
    onClose: () => void;
}

const InvoiceDetailModal: React.FC<DetailModalProps> = ({ invoice, companyId, onClose }) => {
    const [quote, setQuote] = useState<any | null>(null);
    const [billingReport, setBillingReport] = useState<BillingReportOut | null>(null);
    const [company, setCompany] = useState<InvoiceCompany | null>(null);
    const [client, setClient] = useState<InvoiceClient | null>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleExportPohoda = async () => {
        setIsExporting(true);
        try {
            await exportInvoiceXml(companyId, invoice.id);
        } catch (e: any) {
            alert(e.message ?? 'Export do Pohody selhal.');
        } finally {
            setIsExporting(false);
        }
    };

    const fmtP = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kč';
    const fmtDate = (d: string) => {
        try { return new Date(d).toLocaleDateString('cs-CZ'); } catch { return d; }
    };

    useEffect(() => {
        if (!invoice.quote_id && !invoice.work_order_id) return;
        setLoadingData(true);

        const companyAndClients = Promise.all([getCompany(companyId), getClients(companyId)]);

        if (invoice.quote_id) {
            Promise.all([
                getQuote(companyId, invoice.quote_id),
                companyAndClients,
            ]).then(([q, [comp, clients]]) => {
                setQuote(q);
                setCompany({
                    name: comp.name, legal_name: comp.legal_name, address: comp.address,
                    ico: comp.ico, dic: comp.dic, bank_account: comp.bank_account, iban: comp.iban,
                });
                const effectiveCustomerId = q.customer_id ?? invoice.customer_id;
                const found = effectiveCustomerId
                    ? (clients as any[]).find((c: any) => c.id === effectiveCustomerId)
                    : null;
                setClient(found
                    ? { name: found.name, legal_name: found.legal_name, address: found.address, ico: found.ico, dic: found.dic }
                    : { name: invoice.customer_name ?? '' }
                );
            }).catch(console.error)
              .finally(() => setLoadingData(false));
        } else if (invoice.work_order_id) {
            Promise.all([
                getBillingReport(companyId, invoice.work_order_id),
                companyAndClients,
            ]).then(([br, [comp, clients]]) => {
                setBillingReport(br);
                setCompany({
                    name: comp.name, legal_name: comp.legal_name, address: comp.address,
                    ico: comp.ico, dic: comp.dic, bank_account: comp.bank_account, iban: comp.iban,
                });
                const found = invoice.customer_id
                    ? (clients as any[]).find((c: any) => c.id === invoice.customer_id)
                    : null;
                setClient(found
                    ? { name: found.name, legal_name: found.legal_name, address: found.address, ico: found.ico, dic: found.dic }
                    : { name: invoice.customer_name ?? '' }
                );
            }).catch(console.error)
              .finally(() => setLoadingData(false));
        }
    }, [invoice.quote_id, invoice.work_order_id, invoice.customer_id, invoice.customer_name, companyId]);

    const cfg: InvoiceConfig = {
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        duzp: invoice.duzp,
        due_date: invoice.due_date,
        variable_symbol: invoice.variable_symbol,
        payment_method: invoice.payment_method,
        note: invoice.note,
    };

    const handlePrint = () => {
        if (quote && company && client) {
            printInvoicePdf(quote, company, client, cfg);
        } else {
            // Záložní tisk pro zakázky bez dat nabídky
            const area = document.getElementById('invoice-detail-print-area');
            if (!area) return;
            const win = window.open('', '_blank');
            win?.document.write(`<html><head><meta charset="utf-8"><title>Faktura ${invoice.invoice_number}</title>`);
            win?.document.write('<style>body{font-family:Arial,sans-serif;padding:20mm;font-size:11px;color:#333}table{width:100%;border-collapse:collapse}.recap td{padding:4px 8px}.lbl{text-align:right}@media print{@page{margin:12mm;size:A4}}</style>');
            win?.document.write('</head><body>');
            win?.document.write(area.innerHTML);
            win?.document.write('</body></html>');
            win?.document.close();
            setTimeout(() => { win?.print(); win?.close(); }, 400);
        }
    };

    const regularSections = quote?.sections?.filter((s: any) => !s.is_extras) ?? [];
    const extrasSections = quote?.sections?.filter((s: any) => s.is_extras) ?? [];
    const vatBreakdown = quote ? computeVatBreakdown(quote) : [];

    const subtotal = regularSections.flatMap((s: any) => s.items).filter((i: any) => !i.is_reduced_work)
        .reduce((s: number, i: any) => s + i.quantity * (i.material_price + i.assembly_price), 0);
    const reducedTotal = regularSections.flatMap((s: any) => s.items).filter((i: any) => i.is_reduced_work)
        .reduce((s: number, i: any) => s + i.quantity * (i.material_price + i.assembly_price), 0);
    const extrasTotal = extrasSections.flatMap((s: any) => s.items)
        .reduce((s: number, i: any) => s + i.quantity * (i.material_price + i.assembly_price), 0);

    let discountAmount = 0;
    if (quote && quote.global_discount > 0) {
        discountAmount = quote.global_discount_type === 'percent'
            ? subtotal * quote.global_discount / 100
            : quote.global_discount;
    }

    const catRateMap = new Map<string, number>(
        (quote?.category_assemblies ?? []).map((ca: any) => [ca.category_name, ca.vat_rate])
    );
    const itemVatRate = (item: any): number =>
        item.inventory_category_name
            ? (catRateMap.get(item.inventory_category_name) ?? quote?.vat_rate ?? 21)
            : (quote?.vat_rate ?? 21);

    const renderSections = (sections: any[], isExtras: boolean) =>
        sections.map((sec: any) => (
            <React.Fragment key={sec.id}>
                <tr className="bg-slate-100">
                    <td className="px-3 py-1.5 text-xs font-bold text-slate-600">{sec.prefix || ''}</td>
                    <td colSpan={5} className="px-3 py-1.5 text-xs font-bold text-slate-700">
                        {isExtras ? '[VÍCEPRÁCE] ' : ''}{sec.name}
                    </td>
                </tr>
                {sec.items.filter((i: any) => !i.is_reduced_work).map((item: any, idx: number) => {
                    const unitPrice = item.material_price + item.assembly_price;
                    const total = item.quantity * unitPrice;
                    return (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-1 text-xs text-slate-400">{isExtras ? '+' : (sec.prefix || '')}</td>
                            <td className="px-3 py-1 text-xs">{item.name}</td>
                            <td className="px-3 py-1 text-xs text-center">{item.unit}</td>
                            <td className="px-3 py-1 text-xs text-right">{item.quantity}</td>
                            <td className="px-3 py-1 text-xs text-center text-slate-500">{itemVatRate(item)}%</td>
                            <td className="px-3 py-1 text-xs text-right font-medium">{fmtP(total)}</td>
                        </tr>
                    );
                })}
            </React.Fragment>
        ));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <header className="flex justify-between items-center px-6 py-4 border-b bg-slate-800 text-white rounded-t-xl">
                    <div>
                        <h2 className="text-lg font-bold">Faktura {invoice.invoice_number}</h2>
                        <p className="text-slate-400 text-xs mt-0.5">
                            {invoice.quote_name
                                ? `Nabídka: ${invoice.quote_name}`
                                : invoice.work_order_name
                                ? `Zakázka: ${invoice.work_order_name}`
                                : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {loadingData && <Icon name="fa-spinner fa-spin" className="text-slate-400" />}
                        <button
                            onClick={handleExportPohoda}
                            disabled={isExporting}
                            className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors flex items-center gap-2"
                            title="Export do Pohody (XML)"
                        >
                            <Icon name={isExporting ? 'fa-spinner fa-spin' : 'fa-file-code'} />
                            {isExporting ? 'Exportuji…' : 'Pohoda XML'}
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={loadingData}
                            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors flex items-center gap-2"
                        >
                            <Icon name="fa-print" /> Tisk / PDF
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-white ml-2">
                            <Icon name="fa-times" className="text-xl" />
                        </button>
                    </div>
                </header>

                {/* Body */}
                <main className="overflow-y-auto bg-slate-100 p-6">
                    <div id="invoice-detail-print-area" className="bg-white rounded-lg shadow p-8 space-y-6 text-slate-800 text-sm">

                        {/* Nadpis */}
                        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                            <div>
                                {company && (
                                    <div className="text-lg font-bold">{company.name}</div>
                                )}
                                <div className="text-2xl font-black text-red-700 mt-1 tracking-wide">FAKTURA</div>
                                <div className="text-xs text-slate-500">daňový doklad</div>
                            </div>
                            <div className="text-right">
                                <div className="text-base font-bold font-mono">{invoice.invoice_number}</div>
                                {invoice.quote_name && <div className="text-xs text-slate-500 mt-1">{invoice.quote_name}</div>}
                            </div>
                        </div>

                        {/* Dodavatel / Odběratel */}
                        {(company || client) && (
                            <div className="grid grid-cols-2 gap-8">
                                {company && (
                                    <div>
                                        <p className="text-xs font-bold uppercase text-red-700 mb-2">Dodavatel</p>
                                        <p className="font-bold">{company.legal_name || company.name}</p>
                                        {company.address && <p className="text-slate-500 text-xs mt-1 whitespace-pre-line">{company.address}</p>}
                                        {company.ico && <p className="text-xs mt-2">IČO: <span className="font-semibold">{company.ico}</span></p>}
                                        {company.dic && <p className="text-xs">DIČ: <span className="font-semibold">{company.dic}</span></p>}
                                        {company.bank_account && <p className="text-xs mt-2">Č. účtu: <span className="font-semibold">{company.bank_account}</span></p>}
                                        {company.iban && <p className="text-xs">IBAN: <span className="font-semibold">{company.iban}</span></p>}
                                    </div>
                                )}
                                {client && (
                                    <div>
                                        <p className="text-xs font-bold uppercase text-red-700 mb-2">Odběratel</p>
                                        <p className="font-bold">{client.legal_name || client.name}</p>
                                        {client.address && <p className="text-slate-500 text-xs mt-1 whitespace-pre-line">{client.address}</p>}
                                        {client.ico && <p className="text-xs mt-2">IČO: <span className="font-semibold">{client.ico}</span></p>}
                                        {client.dic && <p className="text-xs">DIČ: <span className="font-semibold">{client.dic}</span></p>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Platební údaje */}
                        <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4 text-xs">
                            <div>
                                <p className="font-bold text-slate-500 uppercase mb-1">Datum vystavení</p>
                                <p className="font-semibold">{fmtDate(invoice.issue_date)}</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-500 uppercase mb-1">DUZP</p>
                                <p className="font-semibold">{fmtDate(invoice.duzp)}</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-500 uppercase mb-1">Datum splatnosti</p>
                                <p className={`font-semibold ${new Date(invoice.due_date) < new Date() && invoice.status !== 'paid' && invoice.status !== 'cancelled' ? 'text-red-600' : ''}`}>
                                    {fmtDate(invoice.due_date)}
                                </p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-500 uppercase mb-1">Variabilní symbol</p>
                                <p className="font-semibold font-mono">{invoice.variable_symbol}</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-500 uppercase mb-1">Způsob úhrady</p>
                                <p className="font-semibold">{invoice.payment_method}</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-500 uppercase mb-1">Stav</p>
                                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${INVOICE_STATUS_COLORS[invoice.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                    {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
                                </span>
                            </div>
                        </div>

                        {/* Načítání dat */}
                        {loadingData && (
                            <div className="text-center py-6 text-slate-400 text-xs">
                                <Icon name="fa-spinner fa-spin" /> Načítám položky…
                            </div>
                        )}

                        {/* Položky ze zakázky (billing report) */}
                        {billingReport && (
                            <div className="space-y-4">
                                {billingReport.time_logs && billingReport.time_logs.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold uppercase text-slate-600 mb-2">Práce</p>
                                        <div className="overflow-x-auto rounded border border-slate-200">
                                            <table className="min-w-full">
                                                <thead>
                                                    <tr className="bg-slate-800 text-white text-xs">
                                                        <th className="px-3 py-2 text-left">Typ práce</th>
                                                        <th className="px-3 py-2 text-left">Úkol</th>
                                                        <th className="px-3 py-2 text-right w-20">Hod.</th>
                                                        <th className="px-3 py-2 text-right w-28">Sazba/hod</th>
                                                        <th className="px-3 py-2 text-right w-28">Celkem</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {billingReport.time_logs.map((item: any, i: number) => (
                                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                            <td className="px-3 py-1.5 text-xs">{item.work_type_name}</td>
                                                            <td className="px-3 py-1.5 text-xs text-slate-500">{item.task_name}</td>
                                                            <td className="px-3 py-1.5 text-xs text-right">{item.hours.toFixed(2)}</td>
                                                            <td className="px-3 py-1.5 text-xs text-right">{fmtP(item.rate)}</td>
                                                            <td className="px-3 py-1.5 text-xs text-right font-medium">{fmtP(item.total_price)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {billingReport.used_items && billingReport.used_items.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold uppercase text-slate-600 mb-2">Materiál</p>
                                        <div className="overflow-x-auto rounded border border-slate-200">
                                            <table className="min-w-full">
                                                <thead>
                                                    <tr className="bg-slate-800 text-white text-xs">
                                                        <th className="px-3 py-2 text-left">Název</th>
                                                        <th className="px-3 py-2 text-right w-20">Množství</th>
                                                        <th className="px-3 py-2 text-right w-28">Cena/ks</th>
                                                        <th className="px-3 py-2 text-right w-28">Celkem</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {billingReport.used_items.map((item: BillingReportItem, i: number) => (
                                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                            <td className="px-3 py-1.5 text-xs">{item.item_name}</td>
                                                            <td className="px-3 py-1.5 text-xs text-right">{item.quantity} ks</td>
                                                            <td className="px-3 py-1.5 text-xs text-right">{fmtP(item.unit_price_sold ?? 0)}</td>
                                                            <td className="px-3 py-1.5 text-xs text-right font-medium">{fmtP(item.total_price)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Položky z nabídky */}
                        {quote && (regularSections.length > 0 || extrasSections.length > 0) && (
                            <div>
                                <p className="text-xs font-bold uppercase text-slate-600 mb-2">Položky faktury</p>
                                <div className="overflow-x-auto rounded border border-slate-200">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className="bg-slate-800 text-white text-xs">
                                                <th className="px-3 py-2 text-left w-10"></th>
                                                <th className="px-3 py-2 text-left">Popis</th>
                                                <th className="px-3 py-2 text-center w-16">M.j.</th>
                                                <th className="px-3 py-2 text-right w-16">Počet</th>
                                                <th className="px-3 py-2 text-center w-14">DPH</th>
                                                <th className="px-3 py-2 text-right w-28">Celkem bez DPH</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {renderSections(regularSections, false)}
                                            {extrasSections.length > 0 && renderSections(extrasSections, true)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Rekapitulace */}
                        <div className="flex justify-end">
                            <table className="w-72 text-sm">
                                <tbody>
                                    {quote && subtotal > 0 && (
                                        <tr>
                                            <td className="py-1 text-right text-slate-500">Základ bez DPH:</td>
                                            <td className="py-1 pl-4 text-right">{fmtP(subtotal)}</td>
                                        </tr>
                                    )}
                                    {reducedTotal > 0 && (
                                        <tr className="text-amber-700">
                                            <td className="py-1 text-right">Méněpráce (odečteno):</td>
                                            <td className="py-1 pl-4 text-right">− {fmtP(reducedTotal)}</td>
                                        </tr>
                                    )}
                                    {discountAmount > 0 && (
                                        <tr className="text-green-700">
                                            <td className="py-1 text-right">
                                                Sleva ({quote.global_discount}{quote.global_discount_type === 'percent' ? '%' : ' Kč'}):
                                            </td>
                                            <td className="py-1 pl-4 text-right">− {fmtP(discountAmount)}</td>
                                        </tr>
                                    )}
                                    {extrasTotal > 0 && (
                                        <tr className="text-red-700 font-bold">
                                            <td className="py-1 text-right">Vícepráce:</td>
                                            <td className="py-1 pl-4 text-right">+ {fmtP(extrasTotal)}</td>
                                        </tr>
                                    )}
                                    <tr className="border-t border-slate-300 font-semibold">
                                        <td className="py-1 text-right text-slate-600">Základ DPH celkem:</td>
                                        <td className="py-1 pl-4 text-right">{fmtP(invoice.total_net)}</td>
                                    </tr>
                                    {vatBreakdown.length > 0
                                        ? vatBreakdown.map(g => (
                                            <tr key={g.rate}>
                                                <td className="py-1 text-right text-slate-500">DPH {g.rate}%:</td>
                                                <td className="py-1 pl-4 text-right">{fmtP(g.vat)}</td>
                                            </tr>
                                        ))
                                        : (
                                            <tr>
                                                <td className="py-1 text-right text-slate-500">DPH:</td>
                                                <td className="py-1 pl-4 text-right">{fmtP(invoice.total_vat)}</td>
                                            </tr>
                                        )
                                    }
                                    <tr className="border-t-2 border-red-600 text-base font-bold text-red-700">
                                        <td className="pt-3 pb-1 text-right">CELKEM K ÚHRADĚ:</td>
                                        <td className="pt-3 pb-1 pl-4 text-right">{fmtP(invoice.total_gross)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Poznámka */}
                        {invoice.note && (
                            <div className="border-t border-slate-200 pt-4 text-xs text-slate-600">
                                <span className="font-bold">Poznámka: </span>{invoice.note}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default InvoicesPlugin;
