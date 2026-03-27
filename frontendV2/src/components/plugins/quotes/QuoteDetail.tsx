import React, { useState, useEffect, useCallback } from 'react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Icon from '../../common/Icon';
import * as api from '../../../api';
import * as quotesApi from '../../../api/quotes';
import { Quote } from './types';
import { STATUS_LABELS, printQuotePdf, computeQuoteRef } from './utils';
import SummaryBar from './SummaryBar';
import CenotvorbaTab from './CenotvorbaTab';
import SectionTab from './SectionTab';
import AddSectionModal from './AddSectionModal';

const QuoteDetail: React.FC<{
    quoteId: number;
    companyId: number;
    siteTechTypes?: string[];
    onBack: () => void;
    onOpenQuote?: (quoteId: number) => void;
}> = ({ quoteId, companyId, siteTechTypes, onBack, onOpenQuote }) => {
    const [quote, setQuote] = useState<Quote | null>(null);
    const [parentQuote, setParentQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('cenotvorba');
    const [showAddSection, setShowAddSection] = useState(false);
    const [showAddExtras, setShowAddExtras] = useState(false);

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
        } catch (err) { console.error(err); }
    }, [companyId, quoteId]);

    useEffect(() => {
        setLoading(true);
        refresh().finally(() => setLoading(false));
    }, [refresh]);

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
        try {
            const company = await api.getCompany(companyId);
            printQuotePdf(quote, company.name);
        } catch {
            printQuotePdf(quote, '');
        }
    };

    const handleStatusChange = async (status: string) => {
        if (!quote) return;
        try {
            await quotesApi.updateQuote(companyId, quoteId, { status });
            await refresh();
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
                    <select
                        value={quote.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
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

            {showAddSection && <AddSectionModal onSave={handleAddSection} onClose={() => setShowAddSection(false)} suggestedNames={siteTechTypes} />}
            {showAddExtras && <AddSectionModal onSave={handleAddSection} onClose={() => setShowAddExtras(false)} isExtras suggestedNames={siteTechTypes} />}
        </div>
    );
};

export default QuoteDetail;
