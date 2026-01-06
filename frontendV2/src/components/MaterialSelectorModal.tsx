import React, { useState, useMemo, useCallback } from 'react';
import { InventoryItem, LocationOut } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Input from './common/Input';
import { useAuth } from '../AuthContext';

interface MaterialSelectorModalProps {
    inventory: InventoryItem[];
    initialSelection: { id: string; name: string; quantity: number }[];
    onClose: () => void;
    onSave: (selection: { id: string; name: string; quantity: number }[]) => void;
    accessibleLocations: LocationOut[];
}

const MaterialSelectorModal: React.FC<MaterialSelectorModalProps> = ({ inventory, initialSelection, onClose, onSave, accessibleLocations }) => {
    const { role } = useAuth();
    const isAdmin = role === 'admin' || role === 'owner';

    const [selection, setSelection] = useState<{ [key: string]: number }>(
        initialSelection.reduce((acc, item) => {
            acc[item.id] = item.quantity;
            return acc;
        }, {} as { [key: string]: number })
    );
    const [searchTerm, setSearchTerm] = useState('');

    const accessibleLocationIds = useMemo(() => {
        if (isAdmin) return null;
        return new Set(accessibleLocations.map(l => l.id));
    }, [accessibleLocations, isAdmin]);

    const getAccessibleStock = useCallback((item: InventoryItem) => {
        if (isAdmin || !accessibleLocationIds) {
            return item.total_quantity;
        }
        return item.locations.reduce((sum, loc) => {
            if (accessibleLocationIds.has(loc.location.id)) {
                return sum + loc.quantity;
            }
            return sum;
        }, 0);
    }, [isAdmin, accessibleLocationIds]);

    const handleQuantityChange = (itemId: string, quantity: number) => {
        setSelection(prev => ({
            ...prev,
            [itemId]: Math.max(0, quantity) // Ensure quantity is not negative
        }));
    };

    const handleSave = () => {
        const result = Object.entries(selection)
            .map(([id, quantity]) => {
                const item = inventory.find(i => String(i.id) === id);
                return { id, name: item?.name || 'N/A', quantity };
            })
            .filter(item => (item.quantity as number) > 0);
        onSave(result);
    };

    const filteredInventory = useMemo(() => {
        let itemsToFilter = inventory;
        if (!isAdmin) {
            itemsToFilter = inventory.filter(item => getAccessibleStock(item) > 0);
        }

        if (!searchTerm) {
            return itemsToFilter;
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return itemsToFilter.filter(item => 
            item.name.toLowerCase().includes(lowercasedTerm) || 
            item.sku.toLowerCase().includes(lowercasedTerm)
        );
    }, [inventory, searchTerm, isAdmin, getAccessibleStock]);

    return (
        <Modal title="Vybrat použitý materiál" onClose={onClose}>
            <div className="space-y-4">
                <Input
                    placeholder="Hledat podle názvu nebo SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="max-h-96 overflow-y-auto border rounded-md">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-100 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600">Název</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 w-28">{isAdmin ? 'Skladem' : 'Dostupné'}</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 w-32">Použito</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredInventory.map(item => {
                                const accessibleStock = getAccessibleStock(item);
                                return (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-900">{item.name}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500">{accessibleStock} ks</td>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        <input
                                            type="number"
                                            min="0"
                                            max={accessibleStock}
                                            value={selection[item.id] || 0}
                                            onChange={e => handleQuantityChange(String(item.id), parseInt(e.target.value, 10) || 0)}
                                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-sm"
                                        />
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                 <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
                    <Button type="button" onClick={handleSave}>Potvrdit výběr</Button>
                </div>
            </div>
        </Modal>
    );
};

export default MaterialSelectorModal;
