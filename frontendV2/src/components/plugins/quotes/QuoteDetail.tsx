import React, { useState, useEffect, useCallback } from 'react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Icon from '../../common/Icon';
import * as api from '../../../api';
import * as quotesApi from '../../../api/quotes';
import { Quote } from './types';
import { STATUS_LABELS, printQuotePdf, printInvoicePdf, computeQuoteRef } from './utils';
import { getClients } from '../../../api/clients';
import SummaryBar from './SummaryBar';
import CenotvorbaTab from './CenotvorbaTab';
import SectionTab from './SectionTab';
import AddSectionModal from './AddSectionModal';
import GenerateInvoiceModal from './GenerateInvoiceModal';

const QuoteDetail: React.FC<{
    quoteId: number;
    companyId: number;
    siteTechTypes?: string[];
    onBack: () => void;
    onOpenQuote?: (quoteId: number) => void;
}> = ({ quoteId, companyId, siteTechTypes, onBack, onOpenQuote }) => {
    const [quote, setQuote] = useState<Quote | null>(null);
    const [parentQuote, setParentQuote] = useState<Quote | null>(null);
    const [siblings, setSiblings] = useState<{ id: number; version: number; status: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('cenotvorba');
    const [showAddSection, setShowAddSection] = useState(false);
    const [showAddExtras, setShowAddExtras] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [invoices, setInvoices] = useState<any[]>([]);

    const refreshInvoices = useCallback(async () => {
        try {
            const list = await quotesApi.listQuoteInvoices(companyId, quoteId);
            setInvoices(list);
        } catch { /* plugin nemusí být dostupný */ }
    }, [companyId, quoteId]);

    const refresh = useCallback(async () => {
        try {
            const q = await quotesApi.getQuote(companyId, quoteId);
            setQuote(q);
            if (q.parent_quote_id) {
                const parent = await quotesApi.getQuote(companyId, q.parent_quote_id);
                setParentQuote(parent);
            } else {
                setParentQuote(null);
            }
            // Načti sourozence (stejné jméno + zákazník) pro přepínač verzí
            const all = await quotesApi.listQuotes(companyId, q.site_id ?? undefined);
            const family = all
                .filter((x: any) => x.name === q.name && x.customer_id === q.customer_id)
                .map((x: any) => ({ id: x.id, version: x.version, status: x.status }))
                .sort((a: any, b: any) => b.version - a.version);
            setSiblings(family);
        } catch (err) { console.error(err); }
    }, [companyId, quoteId]);

    useEffect(() => {
        setLoading(true);
        refresh().finally(() => setLoading(false));
    }, [refresh]);

    useEffect(() => { refreshInvoices(); }, [refreshInvoices]);

    const handleAddSection = async (data: any) => {
        try {
            const sec = await quotesApi.createSection(companyId, quoteId, data);
            setShowAddSection(false);
            setShowAddExtras(false);
            await refresh();
            setActiveTab(`sec_${sec.id}`);
        } catch (err) { console.error(err); }
    };

    const handleDeleteSection = async (sectionId: number) => {
        if (!window.confirm('Smazat celou sekci včetně položek?')) return;
        try {
            await quotesApi.deleteSection(companyId, quoteId, sectionId);
            setActiveTab('cenotvorba');
            await refresh();
        } catch (err) { console.error(err); }
    };

    const handleExportPdf = async () => {
        if (!quote) return;
        const ref = computeQuoteRef(quote);
        try {
            const company = await api.getCompany(companyId);
            printQuotePdf(quote, company.name, ref);
        } catch {
            printQuotePdf(quote, '', ref);
        }
    };

    const handleStatusChange = async (status: string) => {
        if (!quote) return;
        try {
            await quotesApi.updateQuote(companyId, quoteId, { status });
            await refresh();
        } catch (err) { console.error(err); }
    };

    const handleNewVersion = async () => {
        if (!quote) return;
        if (!window.confirm(`Vytvořit verzi ${quote.version + 1} nabídky "${quote.name}"?\nStávající verze zůstane zachována.`)) return;
        try {
            const newQ = await quotesApi.newVersionQuote(companyId, quote.id);
            onOpenQuote?.(newQ.id);
        } catch (err) { console.error(err); }
    };

    const handleViewInvoice = async (inv: any) => {
        if (!quote) return;
        try {
            const [comp, clients] = await Promise.all([
                api.getCompany(companyId),
                quote.customer_id ? getClients(companyId) : Promise.resolve([]),
            ]);
            const company = {
                name: comp.name,
                legal_name: comp.legal_name,
                address: comp.address,
                ico: comp.ico,
                dic: comp.dic,
                bank_account: comp.bank_account,
                iban: comp.iban,
            };
            const found = quote.customer_id
                ? (clients as any[]).find((c: any) => c.id === quote.customer_id)
                : null;
            const client = found
                ? { name: found.name, legal_name: found.legal_name, address: found.address, ico: found.ico, dic: found.dic }
                : { name: quote.customer_name || '' };
            printInvoicePdf(quote, company, client, {
                invoice_number: inv.invoice_number,
                issue_date: inv.issue_date,
                duzp: inv.duzp,
                due_date: inv.due_date,
                variable_symbol: inv.variable_symbol,
                payment_method: inv.payment_method,
                note: inv.note,
            });
        } catch (err) { console.error(err); }
    };

    const handleCreateSubQuote = async () => {
        if (!quote) return;
        const name = window.prompt('Název podnabídky:');
        if (!name?.trim()) return;
        try {
            await quotesApi.createQuote(companyId, {
                name: name.trim(),
                parent_quote_id: quote.id,
                site_id: quote.site_id,
                customer_id: quote.customer_id,
                validity_days: quote.validity_days,
                currency: quote.currency,
                vat_rate: quote.vat_rate,
                global_discount: quote.global_discount,
                global_discount_type: quote.global_discount_type,
                global_hourly_rate: quote.global_hourly_rate,
            });
            await refresh();
        } catch (err) { console.error(err); }
    };

    if (loading || !quote) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Icon name="fa-spinner fa-spin" className="mr-3 text-2xl" />Načítám nabídku…
            </div>
        );
    }

    const regularSections = quote.sections.filter(s => !s.is_extras);
    const extrasSections = quote.sections.filter(s => s.is_extras);
    const statusInfo = STATUS_LABELS[quote.status] ?? STATUS_LABELS.draft;

    const tabs = [
        { key: 'cenotvorba', label: 'Cenotvorba', icon: 'fa-cog' },
        ...regularSections.map(s => ({ key: `sec_${s.id}`, label: `${s.prefix ? s.prefix + ' · ' : ''}${s.name}`, icon: 'fa-list', sectionId: s.id, isExtras: false })),
        ...extrasSections.map(s => ({ key: `sec_${s.id}`, label: `+ ${s.name}`, icon: 'fa-plus-circle', sectionId: s.id, isExtras: true })),
    ];

    return (
        <div>
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
                <button onClick={onBack} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors mt-1">
                    <Icon name="fa-arrow-left" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-slate-800">{quote.name}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {quote.customer_name && <><Icon name="fa-user" className="mr-1" />{quote.customer_name} · </>}
                        Platnost: {quote.validity_days} dní
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        <Icon name="fa-hashtag" className="mr-1" />{computeQuoteRef(quote)}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Přepínač verzí */}
                    {siblings.length > 1 && (
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                            {siblings.map(s => {
                                const si = STATUS_LABELS[s.status] ?? STATUS_LABELS.draft;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => onOpenQuote?.(s.id)}
                                        title={si.label}
                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors
                                            ${s.id === quote.id
                                                ? 'bg-white shadow text-slate-800'
                                                : 'text-slate-400 hover:text-slate-600'}`}>
                                        v{s.version}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <select
                        value={quote.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <Button variant="secondary" onClick={handleNewVersion} title="Vytvořit novou verzi nabídky jako kopii">
                        <Icon name="fa-copy" className="mr-1" />Nová verze
                    </Button>
                    <Button variant="secondary" onClick={() => setShowInvoiceModal(true)}>
                        <Icon name="fa-file-invoice" className="mr-2" />Generovat fakturu
                    </Button>
                    <Button onClick={handleExportPdf}>
                        <><Icon name="fa-file-pdf" className="mr-2" />Export PDF</>
                    </Button>
                </div>
            </div>

            {/* Summary */}
            <SummaryBar quote={quote} />

            {/* Tabs */}
            <div className="flex gap-1 flex-wrap mt-4 mb-3 bg-slate-100 p-1 rounded-lg">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5
                            ${activeTab === tab.key ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}
                            ${tab.isExtras ? 'border border-orange-300' : ''}`}>
                        <Icon name={tab.icon} className="text-xs" />
                        {tab.label}
                        {tab.sectionId && (
                            <button
                                onClick={e => { e.stopPropagation(); handleDeleteSection(tab.sectionId!); }}
                                className={`ml-1 opacity-60 hover:opacity-100 transition-opacity ${activeTab === tab.key ? 'text-red-200 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}>
                                <Icon name="fa-times" className="text-xs" />
                            </button>
                        )}
                    </button>
                ))}
                <button
                    onClick={() => setShowAddSection(true)}
                    className="px-3 py-1.5 rounded-md text-sm text-slate-500 hover:bg-slate-200 transition-colors flex items-center gap-1">
                    <Icon name="fa-plus" className="text-xs" /> Sekce
                </button>
                <button
                    onClick={() => setShowAddExtras(true)}
                    className="px-3 py-1.5 rounded-md text-sm text-orange-600 hover:bg-orange-50 border border-orange-200 transition-colors flex items-center gap-1">
                    <Icon name="fa-plus-circle" className="text-xs" /> Vícepráce
                </button>
            </div>

            {/* Tab content */}
            <Card>
                {activeTab === 'cenotvorba' && (
                    <CenotvorbaTab quote={quote} companyId={companyId} onRefresh={refresh} parentQuote={parentQuote ?? undefined} />
                )}
                {tabs.filter(t => t.sectionId).map(tab => {
                    const sec = quote.sections.find(s => s.id === tab.sectionId);
                    if (!sec || activeTab !== tab.key) return null;
                    return (
                        <SectionTab key={sec.id} section={sec} companyId={companyId} quoteId={quoteId}
                            categoryAssemblies={quote.category_assemblies} onRefresh={refresh} />
                    );
                })}
            </Card>

            {/* Sub-quotes */}
            <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-700">
                        <Icon name="fa-sitemap" className="mr-2 text-slate-400" />
                        Podnabídky
                    </h3>
                    <Button variant="secondary" onClick={handleCreateSubQuote}>
                        <Icon name="fa-plus" className="mr-1" />Nová podnabídka
                    </Button>
                </div>
                {quote.sub_quotes?.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Žádné podnabídky. Podnabídka dědí cenové nastavení z hlavní nabídky.</p>
                ) : (
                    <div className="space-y-2">
                        {quote.sub_quotes?.map(sub => (
                            <div key={sub.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                                <div>
                                    <p className="font-medium text-slate-800">{sub.name}</p>
                                    <p className="text-xs text-slate-500">{STATUS_LABELS[sub.status]?.label}</p>
                                </div>
                                <Button variant="secondary" onClick={() => onOpenQuote?.(sub.id)}>
                                    <Icon name="fa-external-link-alt" className="mr-1" />Otevřít
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Faktury */}
            {invoices.length > 0 && (
                <div className="mt-6">
                    <h3 className="font-semibold text-slate-700 mb-3">
                        <Icon name="fa-file-invoice" className="mr-2 text-slate-400" />
                        Vygenerované faktury
                    </h3>
                    <div className="space-y-2">
                        {invoices.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
                                <div>
                                    <span className="font-mono font-bold text-slate-800 text-sm">{inv.invoice_number}</span>
                                    <span className="ml-3 text-xs text-slate-500">
                                        vystaveno {new Date(inv.issue_date).toLocaleDateString('cs-CZ')}
                                        {' · '}splatnost {new Date(inv.due_date).toLocaleDateString('cs-CZ')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-red-600 text-sm">
                                        {inv.total_gross.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
                                    </span>
                                    <button
                                        onClick={() => handleViewInvoice(inv)}
                                        className="text-slate-400 hover:text-red-600 transition-colors"
                                        title="Zobrazit / tisknout fakturu">
                                        <Icon name="fa-eye" className="text-sm" />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!window.confirm(`Smazat fakturu ${inv.invoice_number}?`)) return;
                                            await quotesApi.deleteQuoteInvoice(companyId, quoteId, inv.id);
                                            refreshInvoices();
                                        }}
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                        title="Smazat záznam faktury">
                                        <Icon name="fa-trash" className="text-xs" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showAddSection && <AddSectionModal onSave={handleAddSection} onClose={() => setShowAddSection(false)} suggestedNames={siteTechTypes} />}
            {showAddExtras && <AddSectionModal onSave={handleAddSection} onClose={() => setShowAddExtras(false)} isExtras suggestedNames={siteTechTypes} />}
            {showInvoiceModal && (
                <GenerateInvoiceModal
                    quote={quote}
                    companyId={companyId}
                    onClose={() => setShowInvoiceModal(false)}
                    onSaved={refreshInvoices}
                />
            )}
        </div>
    );
};

export default QuoteDetail;
