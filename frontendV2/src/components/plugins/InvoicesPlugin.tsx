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
                                <th className="px-4 py-3 text-left">Nabídka</th>
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
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-mono font-medium text-slate-800">
                                        {inv.invoice_number}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                                        {inv.quote_name ?? '—'}
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
                                            onChange={e => handleStatusChange(inv, e.target.value)}
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
        </div>
    );
};

export default InvoicesPlugin;
