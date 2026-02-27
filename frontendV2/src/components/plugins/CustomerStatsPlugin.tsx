import React, { useEffect, useState } from 'react';
import { registerPlugin, PluginComponentProps } from '../../lib/PluginSystem';
import * as api from '../../api'; // Předpokládá se existence fetchApi
import { useAuth } from '../../AuthContext';

// 1. Definice komponenty
const CustomerStatsGraph: React.FC<PluginComponentProps> = ({ context }) => {
    const { clientId } = context || {};
    const { companyId } = useAuth();
    const [data, setData] = useState<{ date: string; count: number }[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!clientId || !companyId) return;

        const loadStats = async () => {
            setLoading(true);
            try {
                // Přímé volání fetchApi, protože toto není v core api.ts
                const token = localStorage.getItem('authToken');
                const response = await fetch(`/api/plugins/customer-stats/${clientId}/frequency?company_id=${companyId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                }
            } catch (e) {
                console.error("Failed to load plugin stats", e);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, [clientId, companyId]);

    if (!clientId) return null;
    if (loading) return <div className="text-xs text-slate-400">Načítám statistiky...</div>;
    if (data.length === 0) return null;

    const maxCount = Math.max(...data.map(d => d.count), 1);

    return (
        <div className="mt-4 p-4 border rounded-lg bg-white shadow-sm">
            <h4 className="font-bold text-slate-700 mb-4 text-sm uppercase">Četnost výjezdů (poslední rok)</h4>
            <div className="flex items-end space-x-2 h-32">
                {data.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center group">
                        <div className="relative w-full flex justify-center">
                            {/* Sloupec grafu */}
                            <div 
                                className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-all"
                                style={{ height: `${(item.count / maxCount) * 100}px` }}
                            ></div>
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-black text-white text-xs p-1 rounded">
                                {item.count} výjezdů
                            </div>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1">{item.date}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 2. Registrace do slotu 'customer-form-bottom'
// Tento kód se spustí při importu souboru
registerPlugin('customer-form-bottom', CustomerStatsGraph);

export default CustomerStatsGraph;