import React, { useState, useEffect, useCallback } from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';
import * as api from '../../api';
import * as quotesApi from '../../api/quotes';
import { STATUS_LABELS } from './quotes/utils';
import QuoteDetail from './quotes/QuoteDetail';
import NewQuoteModal from './quotes/NewQuoteModal';

// ─── Seskupený seznam verzí ───────────────────────────────────────────────────

const QuoteGroupedList: React.FC<{
    quotes: any[];
    onOpen: (id: number) => void;
    onDelete: (id: number) => void;
}> = ({ quotes, onOpen, onDelete }) => {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Seskup podle (customer_id + name) — klíč rodiny
    const groups = React.useMemo(() => {
        const map = new Map<string, any[]>();
        for (const q of quotes) {
            const key = `${q.customer_id ?? 'x'}__${q.name}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(q);
        }
        // Uvnitř skupiny seřaď od nejvyšší verze
        for (const g of map.values()) g.sort((a, b) => b.version - a.version);
        // Skupiny seřaď podle updatedAt nejnovější karty
        return Array.from(map.values()).sort(
            (a, b) => new Date(b[0].updated_at).getTime() - new Date(a[0].updated_at).getTime()
        );
    }, [quotes]);

    return (
        <div className="space-y-3">
            {groups.map(group => {
                const latest = group[0];
                const hasOlder = group.length > 1;
                const key = `${latest.customer_id ?? 'x'}__${latest.name}`;
                const isExpanded = expanded.has(key);
                const statusInfo = STATUS_LABELS[latest.status] ?? STATUS_LABELS.draft;
                const date = new Date(latest.updated_at).toLocaleDateString('cs-CZ');

                return (
                    <div key={key} className="bg-white rounded-xl border border-slate-200 hover:border-red-200 hover:shadow-md transition-all">
                        {/* Hlavní (nejnovější) verze */}
                        <div className="flex items-center px-5 py-4 gap-4 cursor-pointer group" onClick={() => onOpen(latest.id)}>
                            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                <Icon name="fa-file-invoice-dollar" className="text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-slate-800 group-hover:text-red-700 truncate">{latest.name}</p>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                        v{latest.version}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {latest.customer_name && <><Icon name="fa-user" className="mr-1" />{latest.customer_name} · </>}
                                    Upraveno: {date}
                                </p>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${statusInfo.color}`}>
                                {statusInfo.label}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                                {hasOlder && (
                                    <button
                                        onClick={e => { e.stopPropagation(); setExpanded(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; }); }}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                                        title="Zobrazit starší verze">
                                        <Icon name={isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} className="text-xs" />
                                        {group.length - 1} {group.length - 1 === 1 ? 'starší verze' : 'starší verze'}
                                    </button>
                                )}
                                <button
                                    onClick={e => { e.stopPropagation(); onDelete(latest.id); }}
                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded"
                                    title="Smazat nabídku">
                                    <Icon name="fa-trash" className="text-sm" />
                                </button>
                                <Icon name="fa-chevron-right" className="text-slate-300 group-hover:text-red-400 transition-colors" />
                            </div>
                        </div>

                        {/* Starší verze (rozbalitelné) */}
                        {hasOlder && isExpanded && (
                            <div className="border-t border-slate-100 divide-y divide-slate-50">
                                {group.slice(1).map(old => {
                                    const si = STATUS_LABELS[old.status] ?? STATUS_LABELS.draft;
                                    return (
                                        <div key={old.id}
                                            className="flex items-center px-5 py-2.5 gap-3 cursor-pointer hover:bg-slate-50 transition-colors group/old"
                                            onClick={() => onOpen(old.id)}>
                                            <span className="text-xs font-bold text-slate-300 w-6 shrink-0">v{old.version}</span>
                                            <p className="flex-1 text-sm text-slate-500 group-hover/old:text-slate-700 truncate">{old.name}</p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${si.color}`}>{si.label}</span>
                                            <span className="text-xs text-slate-300 shrink-0">
                                                {new Date(old.updated_at).toLocaleDateString('cs-CZ')}
                                            </span>
                                            <button
                                                onClick={e => { e.stopPropagation(); onDelete(old.id); }}
                                                className="p-1 text-slate-200 hover:text-red-400 transition-colors rounded"
                                                title="Smazat verzi">
                                                <Icon name="fa-trash" className="text-xs" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

interface QuotesPluginProps {
    companyId: number;
    siteId?: number;
    siteName?: string;
    siteCustomerId?: number;
    siteTechTypes?: string[];
}

const QuotesPlugin: React.FC<QuotesPluginProps> = ({ companyId, siteId, siteName, siteCustomerId, siteTechTypes }) => {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
    const [showNew, setShowNew] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [qs, cs] = await Promise.all([
                quotesApi.listQuotes(companyId, siteId),
                api.getClients(companyId),
            ]);
            setQuotes(qs);
            setClients(cs);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [companyId, siteId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCreate = async (data: any) => {
        try {
            const q = await quotesApi.createQuote(companyId, data);
            setShowNew(false);
            await loadData();
            setSelectedQuoteId(q.id);
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Smazat nabídku? Tato akce je nevratná.')) return;
        try {
            await quotesApi.deleteQuote(companyId, id);
            setQuotes(prev => prev.filter(q => q.id !== id));
        } catch (err) { console.error(err); }
    };

    if (selectedQuoteId !== null) {
        return (
            <QuoteDetail
                quoteId={selectedQuoteId}
                companyId={companyId}
                siteTechTypes={siteTechTypes}
                onBack={() => { setSelectedQuoteId(null); loadData(); }}
                onOpenQuote={setSelectedQuoteId}
            />
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Cenové nabídky</h2>
                    {siteName && <p className="text-sm text-slate-500">{siteName}</p>}
                </div>
                <Button onClick={() => setShowNew(true)}>
                    <Icon name="fa-plus" className="mr-2" />Nová nabídka
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="fa-spinner fa-spin" className="text-2xl mb-2" /><p>Načítám nabídky…</p>
                </div>
            ) : quotes.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <Icon name="fa-file-invoice-dollar" className="text-4xl mb-3" />
                    <p className="text-lg font-medium">Žádné nabídky</p>
                    <p className="text-sm mt-1">Vytvořte první cenovou nabídku pro {siteName || 'tento objekt'}.</p>
                    <Button className="mt-4" onClick={() => setShowNew(true)}>
                        <Icon name="fa-plus" className="mr-2" />Vytvořit nabídku
                    </Button>
                </div>
            ) : (
                <QuoteGroupedList
                    quotes={quotes}
                    onOpen={setSelectedQuoteId}
                    onDelete={handleDelete}
                />
            )}

            {showNew && (
                <NewQuoteModal clients={clients} siteId={siteId} siteName={siteName}
                    initialCustomerId={siteCustomerId}
                    onSave={handleCreate} onClose={() => setShowNew(false)} />
            )}
        </div>
    );
};

export default QuotesPlugin;
