import React, { useState, useEffect } from 'react';
import Button from '../../common/Button';
import Icon from '../../common/Icon';
import * as api from '../../../api';
import { getClients } from '../../../api/clients';
import { Quote } from './types';
import { InvoiceConfig, InvoiceCompany, InvoiceClient, printInvoicePdf, computeVatBreakdown } from './utils';

interface Props {
    quote: Quote;
    companyId: number;
    onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
};

const GenerateInvoiceModal: React.FC<Props> = ({ quote, companyId, onClose }) => {
    const [company, setCompany] = useState<InvoiceCompany | null>(null);
    const [client, setClient] = useState<InvoiceClient | null>(null);
    const [loading, setLoading] = useState(true);

    const issueToday = today();
    const [cfg, setCfg] = useState<InvoiceConfig>({
        invoice_number: '',
        issue_date: issueToday,
        duzp: issueToday,
        due_date: addDays(issueToday, 14),
        variable_symbol: '',
        payment_method: 'převodem',
        note: '',
    });

    useEffect(() => {
        const load = async () => {
            try {
                const [comp, clients] = await Promise.all([
                    api.getCompany(companyId),
                    quote.customer_id ? getClients(companyId) : Promise.resolve([]),
                ]);
                setCompany({
                    name: comp.name,
                    legal_name: comp.legal_name,
                    address: comp.address,
                    ico: comp.ico,
                    dic: comp.dic,
                    bank_account: comp.bank_account,
                    iban: comp.iban,
                });
                const found = quote.customer_id
                    ? (clients as any[]).find((c: any) => c.id === quote.customer_id)
                    : null;
                setClient(found
                    ? { name: found.name, legal_name: found.legal_name, address: found.address, ico: found.ico, dic: found.dic }
                    : { name: quote.customer_name || '' }
                );
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId, quote.customer_id]);

    // sync due_date when issue_date changes
    const handleIssueDate = (v: string) => {
        setCfg(c => ({ ...c, issue_date: v, duzp: v, due_date: addDays(v, 14) }));
    };

    const handleGenerate = () => {
        if (!cfg.invoice_number.trim()) {
            alert('Zadejte číslo faktury.');
            return;
        }
        const effectiveClient = client ?? { name: quote.customer_name || '' };
        const effectiveCompany = company ?? { name: '' };
        printInvoicePdf(quote, effectiveCompany, effectiveClient, {
            ...cfg,
            variable_symbol: cfg.variable_symbol || cfg.invoice_number,
        });
    };

    const vatBreakdown = computeVatBreakdown(quote);
    const net = vatBreakdown.reduce((s, g) => s + g.base, 0);
    const totalVat = vatBreakdown.reduce((s, g) => s + g.vat, 0);
    const gross = net + totalVat;

    const fmtP = (v: number) =>
        v.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kč';

    const field = (label: string, children: React.ReactNode) => (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">{label}</label>
            {children}
        </div>
    );

    const inp = (key: keyof InvoiceConfig, type = 'text', placeholder = '') => (
        <input
            type={type}
            value={cfg[key] as string}
            onChange={e => setCfg(c => ({ ...c, [key]: e.target.value }))}
            placeholder={placeholder}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800">
                        <Icon name="fa-file-invoice" className="mr-2 text-red-600" />
                        Generovat fakturu
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <Icon name="fa-times" />
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-400">
                        <Icon name="fa-spinner fa-spin" className="text-2xl" />
                    </div>
                ) : (
                    <div className="p-5 space-y-4">
                        {/* Partial info */}
                        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-0.5">
                            <div><b>Zakázka:</b> {quote.name}</div>
                            <div><b>Zákazník:</b> {client?.legal_name || client?.name || quote.customer_name || '—'}</div>
                            <div className="pt-1 space-x-4">
                                <span>Základ: <b>{fmtP(net)}</b></span>
                                <span>DPH: <b>{fmtP(totalVat)}</b></span>
                                <span className="text-red-600 font-bold">K úhradě: {fmtP(gross)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {field('Číslo faktury *', inp('invoice_number', 'text', 'např. 2025001'))}
                            {field('Variabilní symbol', inp('variable_symbol', 'text', '= číslo faktury'))}
                            {field('Datum vystavení', (
                                <input type="date" value={cfg.issue_date}
                                    onChange={e => handleIssueDate(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                            ))}
                            {field('DUZP', (
                                <input type="date" value={cfg.duzp}
                                    onChange={e => setCfg(c => ({ ...c, duzp: e.target.value }))}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                            ))}
                            {field('Datum splatnosti', (
                                <input type="date" value={cfg.due_date}
                                    onChange={e => setCfg(c => ({ ...c, due_date: e.target.value }))}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                            ))}
                            {field('Způsob úhrady', (
                                <select value={cfg.payment_method}
                                    onChange={e => setCfg(c => ({ ...c, payment_method: e.target.value }))}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                                    <option>převodem</option>
                                    <option>hotovost</option>
                                    <option>kartou</option>
                                </select>
                            ))}
                        </div>

                        {field('Poznámka (volitelné)', (
                            <textarea
                                value={cfg.note}
                                onChange={e => setCfg(c => ({ ...c, note: e.target.value }))}
                                rows={2}
                                placeholder="Např. Fakturujeme dle smlouvy č. ..."
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
                    <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                    <Button onClick={handleGenerate} disabled={loading}>
                        <Icon name="fa-file-pdf" className="mr-2" />Generovat PDF
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default GenerateInvoiceModal;
