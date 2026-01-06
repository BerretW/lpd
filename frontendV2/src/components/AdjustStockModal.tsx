import React, { useState, useEffect, useMemo } from 'react';
import { InventoryItem, LocationOut, RoleEnum } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Input from './common/Input';
import * as api from '../api';
import ErrorMessage from './common/ErrorMessage';
import { useAuth } from '../AuthContext';

interface AdjustStockModalProps {
    item: InventoryItem;
    companyId: number;
    onClose: () => void;
    onSave: () => void;
}

type Mode = 'place' | 'transfer' | 'write-off';

const AdjustStockModal: React.FC<AdjustStockModalProps> = ({ item, companyId, onClose, onSave }) => {
    const { role } = useAuth();
    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;
    const [mode, setMode] = useState<Mode>('place');
    const [locations, setLocations] = useState<LocationOut[]>([]);
    const [quantity, setQuantity] = useState(1);
    const [details, setDetails] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form state for different modes
    const [toLocationId, setToLocationId] = useState<string>('');
    const [fromLocationId, setFromLocationId] = useState<string>('');
    
    useEffect(() => {
        const locationsPromise = isAdmin
            ? api.getLocations(companyId)
            : api.getMyLocations(companyId);

        locationsPromise
            .then(data => {
                setLocations(data);
                if (data.length > 0) {
                    setToLocationId(String(data[0].id));
                }
                const firstStockedLocation = item.locations[0]?.location.id;
                if(firstStockedLocation) {
                    setFromLocationId(String(firstStockedLocation));
                } else if (data.length > 0) {
                     setFromLocationId(String(data[0].id));
                }
            })
            .catch(() => setError('Nepodařilo se načíst skladové lokace.'));
    }, [companyId, item.locations, isAdmin]);

    const accessibleTotal = useMemo(() => {
        if (isAdmin) {
            return item.total_quantity;
        }
        const accessibleIds = new Set(locations.map(l => l.id));
        return item.locations.reduce((sum, loc) => {
            if (accessibleIds.has(loc.location.id)) {
                return sum + loc.quantity;
            }
            return sum;
        }, 0);
    }, [item, locations, isAdmin]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (quantity <= 0) {
            setError('Množství musí být kladné číslo.');
            return;
        }
        setIsSaving(true);
        setError(null);
        
        try {
            if (mode === 'place') {
                if (!toLocationId) {
                    setError('Musíte vybrat cílovou lokaci.');
                    setIsSaving(false);
                    return;
                }
                await api.placeStock(companyId, {
                    inventory_item_id: item.id,
                    location_id: parseInt(toLocationId, 10),
                    quantity,
                    details
                });
            } else if (mode === 'transfer') {
                if (!fromLocationId || !toLocationId) {
                    setError('Musíte vybrat zdrojovou i cílovou lokaci.');
                    setIsSaving(false);
                    return;
                }
                if (fromLocationId === toLocationId) {
                    setError('Zdrojová a cílová lokace nemohou být stejné.');
                    setIsSaving(false);
                    return;
                }
                const fromLocationStock = item.locations.find(l => l.location.id === parseInt(fromLocationId, 10))?.quantity || 0;
                if (quantity > fromLocationStock) {
                    setError(`Na zdrojové lokaci není dostatek kusů (k dispozici: ${fromLocationStock}).`);
                    setIsSaving(false);
                    return;
                }
                await api.transferStock(companyId, {
                    inventory_item_id: item.id,
                    from_location_id: parseInt(fromLocationId, 10),
                    to_location_id: parseInt(toLocationId, 10),
                    quantity,
                    details
                });
            } else { // write-off
                if (!fromLocationId) {
                     setError('Musíte vybrat lokaci, ze které chcete odepsat.');
                     setIsSaving(false);
                     return;
                }
                if (!details.trim()) {
                    setError('Musíte zadat důvod odpisu.');
                    setIsSaving(false);
                    return;
                }
                 const fromLocationStock = item.locations.find(l => l.location.id === parseInt(fromLocationId, 10))?.quantity || 0;
                if (quantity > fromLocationStock) {
                    setError(`Na zdrojové lokaci není dostatek kusů k odpisu (k dispozici: ${fromLocationStock}).`);
                    setIsSaving(false);
                    return;
                }
                await api.writeOffStock(companyId, {
                    inventory_item_id: item.id,
                    location_id: parseInt(fromLocationId, 10),
                    quantity,
                    details
                });
            }
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Operace se nezdařila.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const buttonText = mode === 'place' ? 'Provést naskladnění'
        : mode === 'transfer' ? 'Provést přesun'
        : 'Provést odpis';

    return (
        <Modal title={`Naskladnění / Přesun / Odpis: ${item.name}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <ErrorMessage message={error} />

                <div className="flex space-x-1 bg-slate-200 p-1 rounded-lg">
                    <button type="button" onClick={() => setMode('place')} className={`w-full p-2 rounded-md font-semibold transition-colors ${mode === 'place' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Naskladnit</button>
                    <button type="button" onClick={() => setMode('transfer')} className={`w-full p-2 rounded-md font-semibold transition-colors ${mode === 'transfer' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Přesunout</button>
                    {isAdmin && <button type="button" onClick={() => setMode('write-off')} className={`w-full p-2 rounded-md font-semibold transition-colors ${mode === 'write-off' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Odpis</button>}
                </div>

                <div className="p-4 border rounded-md bg-slate-50">
                    <h4 className="font-semibold mb-2">Aktuální stavy na lokacích:</h4>
                    {item.locations.length > 0 ? (
                        <ul className="text-sm list-disc list-inside">
                            {item.locations.map(l => (
                                <li key={l.location.id}><strong>{l.quantity} ks</strong> - {l.location.name}</li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-slate-500 italic">Položka není nikde naskladněna.</p>}
                    <p className="font-bold mt-2">Celkem {isAdmin ? '' : '(dostupné)'}: {accessibleTotal} ks</p>
                </div>

                {mode === 'place' && (
                    <div className="space-y-4">
                        <Input label="Množství k naskladnění" type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" required />
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cílová lokace</label>
                            <select value={toLocationId} onChange={e => setToLocationId(e.target.value)} className="w-full p-2 border rounded bg-white text-slate-900" required>
                                <option value="" disabled>-- Vyberte lokaci --</option>
                                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        </div>
                         <Input label="Poznámka (např. číslo příjemky)" value={details} onChange={e => setDetails(e.target.value)} />
                    </div>
                )}
                
                {mode === 'transfer' && (
                    <div className="space-y-4">
                        <Input label="Množství k přesunu" type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" required />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Z lokace</label>
                                <select value={fromLocationId} onChange={e => setFromLocationId(e.target.value)} className="w-full p-2 border rounded bg-white text-slate-900" required>
                                    <option value="" disabled>-- Vyberte lokaci --</option>
                                    {item.locations.map(l => <option key={l.location.id} value={l.location.id}>{l.location.name} ({l.quantity} ks)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Na lokaci</label>
                                <select value={toLocationId} onChange={e => setToLocationId(e.target.value)} className="w-full p-2 border rounded bg-white text-slate-900" required>
                                    <option value="" disabled>-- Vyberte lokaci --</option>
                                    {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <Input label="Poznámka (např. číslo převodky)" value={details} onChange={e => setDetails(e.target.value)} />
                    </div>
                )}

                {mode === 'write-off' && (
                     <div className="space-y-4">
                        <Input label="Množství k odpisu" type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" required />
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Z lokace</label>
                            <select value={fromLocationId} onChange={e => setFromLocationId(e.target.value)} className="w-full p-2 border rounded bg-white text-slate-900" required>
                                <option value="" disabled>-- Vyberte lokaci --</option>
                                {item.locations.map(l => <option key={l.location.id} value={l.location.id}>{l.location.name} ({l.quantity} ks)</option>)}
                            </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Důvod odpisu</label>
                             <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-slate-900" required></textarea>
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Zrušit</Button>
                    <Button type="submit" disabled={isSaving || locations.length === 0}>
                        {isSaving ? 'Ukládání...' : buttonText}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default AdjustStockModal;