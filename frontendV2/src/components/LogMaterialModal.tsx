
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { InventoryItem, UsedItemOut, LocationOut, RoleEnum, DirectAssignItemIn } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Input from './common/Input';
import Icon from './common/Icon';
import * as api from '../api';
import ErrorMessage from './common/ErrorMessage';
import { useAuth } from '../AuthContext';

interface LogMaterialModalProps {
    companyId: number;
    workOrderId: number;
    taskId: number;
    existingMaterials: UsedItemOut[];
    onClose: () => void;
    onSaveSuccess: () => void;
    initialMode?: 'stock' | 'direct';
}

const LogMaterialModal: React.FC<LogMaterialModalProps> = ({ companyId, workOrderId, taskId, existingMaterials, onClose, onSaveSuccess, initialMode }) => {
    const { role } = useAuth();
    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [locations, setLocations] = useState<LocationOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [mode, setMode] = useState<'stock' | 'direct'>(initialMode || 'stock');

    // State for "from stock" mode
    const [selection, setSelection] = useState<Map<number, { quantity: number; locationId: string }>>(new Map());

    // State for "direct purchase" mode
    const [directItemId, setDirectItemId] = useState<string>('');
    const [directQuantity, setDirectQuantity] = useState<number>(1);
    const [directDetails, setDirectDetails] = useState<string>('');
    const [directSearch, setDirectSearch] = useState('');


    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const locationsPromise = isAdmin
                    ? api.getLocations(companyId)
                    : api.getMyLocations(companyId);

                const [items, locs] = await Promise.all([
                    api.getInventoryItems(companyId),
                    locationsPromise,
                ]);
                setInventory(items);
                setLocations(locs);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nepodařilo se načíst skladové zásoby.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [companyId, isAdmin]);
    
    const accessibleLocationIds = useMemo(() => new Set(locations.map(l => l.id)), [locations]);
    
    const getAccessibleStock = useCallback((item: InventoryItem) => {
        if (isAdmin) {
            return item.total_quantity;
        }
        return item.locations.reduce((sum, loc) => {
            if (accessibleLocationIds.has(loc.location.id)) {
                return sum + loc.quantity;
            }
            return sum;
        }, 0);
    }, [isAdmin, accessibleLocationIds]);


    const handleQuantityChange = (itemId: number, quantityStr: string) => {
        const quantity = parseInt(quantityStr, 10);
        const newSelection = new Map(selection);
        const current = newSelection.get(itemId);

        if (!isNaN(quantity) && quantity > 0) {
            const item = inventory.find(i => i.id === itemId);
            const firstAccessibleLocation = item?.locations.find(l => accessibleLocationIds.has(l.location.id));
            const defaultLocationId = firstAccessibleLocation?.location.id.toString() || '';
            newSelection.set(itemId, { quantity, locationId: (current as { locationId: string })?.locationId || defaultLocationId });
        } else {
            newSelection.delete(itemId);
        }
        setSelection(newSelection);
    };

    const handleLocationChange = (itemId: number, locationId: string) => {
        const newSelection = new Map(selection);
        const current = newSelection.get(itemId);
        if (current) {
            // FIX: Ensure 'current' is spread as an object to satisfy TypeScript.
            const updated = { ...current, locationId };
            newSelection.set(itemId, updated);
            setSelection(newSelection);
        }
    };

    const handleSaveFromStock = async () => {
        if (selection.size === 0) {
            setError('Nebyly vybrány žádné položky.');
            return;
        }
        for (const [itemId, { quantity, locationId }] of selection.entries()) {
            if (!locationId) {
                setError(`Pro jednu z položek nebyla vybrána lokace.`);
                return;
            }
            const itemInStock = inventory.find(i => i.id === itemId);
            const stockAtLocation = itemInStock?.locations.find(l => l.location.id === parseInt(locationId))?.quantity || 0;
            if (quantity > stockAtLocation) {
                setError(`Nedostatek zboží na vybrané lokaci pro "${itemInStock?.name}". K dispozici: ${stockAtLocation}, požadováno: ${quantity}.`);
                return;
            }
        }
        setSaving(true);
        setError(null);
        const savePromises = Array.from(selection.entries()).map(([itemId, { quantity, locationId }]) => {
            return api.useInventoryForTask(companyId, workOrderId, taskId, itemId, quantity, parseInt(locationId));
        });
        try {
            await Promise.all(savePromises);
            onSaveSuccess();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Došlo k neznámé chybě.';
            setError(`Uložení selhalo: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDirect = async () => {
        if (!directItemId || directQuantity <= 0) {
            setError('Vyberte prosím položku a zadejte platné množství.');
            return;
        }
        setSaving(true);
        setError(null);

        const payload: DirectAssignItemIn = {
            inventory_item_id: parseInt(directItemId),
            quantity: directQuantity,
            details: directDetails || undefined,
        };

        try {
            await api.directAssignInventoryToTask(companyId, workOrderId, taskId, payload);
            onSaveSuccess();
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Uložení selhalo.');
        } finally {
            setSaving(false);
        }
    };

    const filteredInventoryForStock = useMemo(() => {
        const accessibleInventory = isAdmin 
            ? inventory 
            : inventory.filter(item => item.locations.some(l => accessibleLocationIds.has(l.location.id) && l.quantity > 0));
        return accessibleInventory.filter(item =>
            (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [inventory, searchTerm, isAdmin, accessibleLocationIds]);
    
    const filteredInventoryForDirect = useMemo(() => {
        if (!directSearch) return inventory;
        const lowercasedTerm = directSearch.toLowerCase();
        return inventory.filter(item => 
             item.name.toLowerCase().includes(lowercasedTerm) || 
             item.sku.toLowerCase().includes(lowercasedTerm)
        );
    }, [inventory, directSearch]);

    return (
        <Modal title="Přidat použitý materiál k úkolu" onClose={onClose}>
            <div className="space-y-4">
                 <div className="flex space-x-1 bg-slate-200 p-1 rounded-lg">
                    <button type="button" onClick={() => setMode('stock')} className={`w-full p-2 rounded-md font-semibold transition-colors ${mode === 'stock' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Ze skladu</button>
                    <button type="button" onClick={() => setMode('direct')} className={`w-full p-2 rounded-md font-semibold transition-colors ${mode === 'direct' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Přímý nákup na zakázku</button>
                </div>
                
                <ErrorMessage message={error} />
                
                {loading ? (
                    <div className="text-center p-8"><Icon name="fa-spinner fa-spin" className="mr-2" /> Načítání skladu...</div>
                ) : mode === 'stock' ? (
                    <>
                        <Input placeholder="Hledat materiál podle názvu nebo SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        <div className="max-h-96 overflow-y-auto border rounded-md">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600">Název</th>
                                        <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 w-28">{isAdmin ? 'Celkem ks' : 'Dostupné ks'}</th>
                                        <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 w-24">Množství</th>
                                        <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 w-48">Z lokace</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {filteredInventoryForStock.map(item => {
                                        const currentSelection = selection.get(item.id);
                                        const availableLocations = item.locations.filter(l => accessibleLocationIds.has(l.location.id) && l.quantity > 0);
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-900">{item.name} <span className="text-slate-500">({item.sku})</span></td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500">{getAccessibleStock(item)} ks</td>
                                                <td className="px-4 py-2 whitespace-nowrap"><Input type="number" min="0" value={currentSelection?.quantity || ''} onChange={e => handleQuantityChange(item.id, e.target.value)} className="w-full !py-1" placeholder="0"/></td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    {currentSelection && currentSelection.quantity > 0 && (
                                                         <select value={currentSelection.locationId} onChange={(e) => handleLocationChange(item.id, e.target.value)} className="w-full p-1.5 border border-slate-300 bg-white text-slate-900 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm">
                                                            <option value="">-- Vybrat --</option>
                                                            {availableLocations.map(l => <option key={l.location.id} value={l.location.id}>{l.location.name} ({l.quantity} ks)</option>)}
                                                        </select>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredInventoryForStock.length === 0 && (<tr><td colSpan={4} className="text-center p-4 text-slate-500">Nebyly nalezeny žádné položky.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                         <div className="flex justify-end pt-4 space-x-2">
                            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Zrušit</Button>
                            <Button type="button" onClick={handleSaveFromStock} disabled={loading || saving}>{saving ? <><Icon name="fa-spinner fa-spin" className="mr-2" /> Ukládání...</> : 'Potvrdit a uložit'}</Button>
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Položka</label>
                            <Input placeholder="Hledat položku..." value={directSearch} onChange={e => setDirectSearch(e.target.value)} className="mb-2"/>
                            <select value={directItemId} onChange={e => setDirectItemId(e.target.value)} className="w-full p-2 border rounded bg-white text-slate-900" required>
                                <option value="">-- Vyberte položku --</option>
                                {filteredInventoryForDirect.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                            </select>
                        </div>
                        <Input label="Množství" type="number" value={directQuantity} onChange={e => setDirectQuantity(Number(e.target.value))} min="1" required />
                        <Input label="Poznámka (např. č. faktury dodavatele)" value={directDetails} onChange={e => setDirectDetails(e.target.value)} />

                        <div className="flex justify-end pt-4 space-x-2">
                            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Zrušit</Button>
                            <Button type="button" onClick={handleSaveDirect} disabled={loading || saving}>{saving ? <><Icon name="fa-spinner fa-spin" className="mr-2" /> Ukládání...</> : 'Přidat k úkolu'}</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default LogMaterialModal;
