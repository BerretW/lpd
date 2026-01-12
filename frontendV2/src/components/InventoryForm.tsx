import React, { useState, useEffect } from 'react';
import { InventoryItem, CategoryOut, ManufacturerOut, SupplierOut } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import Icon from './common/Icon';
import * as api from '../api';

interface InventoryFormProps {
    onSave: (item: any) => void;
    onCancel: () => void;
    companyId: number;
    item?: InventoryItem;
    categories: CategoryOut[];
    initialEan?: string;
}

// Malé pomocné modální okno pro přidání záznamu
const SimpleAddModal: React.FC<{ title: string; onClose: () => void; onSave: (val: string) => void }> = ({ title, onClose, onSave }) => {
    const [val, setVal] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex justify-center items-center p-4">
            <div className="bg-white p-4 rounded shadow-xl w-80">
                <h4 className="font-bold mb-2">{title}</h4>
                <Input value={val} onChange={e => setVal(e.target.value)} autoFocus placeholder="Zadejte název..." />
                <div className="flex justify-end space-x-2 mt-3">
                    <Button variant="secondary" onClick={onClose} className="!py-1 !px-2 !text-sm">Zrušit</Button>
                    <Button onClick={() => { if(val) onSave(val); }} className="!py-1 !px-2 !text-sm">Uložit</Button>
                </div>
            </div>
        </div>
    );
};

const CategoryCheckbox: React.FC<{
    category: CategoryOut;
    level: number;
    selectedIds: number[];
    onToggle: (id: number) => void
}> = ({ category, level, selectedIds, onToggle }) => (
    <div key={category.id}>
        <div className="flex items-center py-1" style={{ paddingLeft: `${level * 20}px` }}>
            <input
                type="checkbox"
                id={`cat-${category.id}`}
                checked={selectedIds.includes(category.id)}
                onChange={() => onToggle(category.id)}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <label htmlFor={`cat-${category.id}`} className="ml-2 text-sm text-slate-700 cursor-pointer">
                {category.name}
            </label>
        </div>
        {category.children && category.children.map(child => (
            <CategoryCheckbox
                key={child.id}
                category={child}
                level={level + 1}
                selectedIds={selectedIds}
                onToggle={onToggle}
            />
        ))}
    </div>
);

const InventoryForm: React.FC<InventoryFormProps> = ({ onSave, onCancel, companyId, item, categories, initialEan }) => {
    // Basic fields
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [price, setPrice] = useState(0);
    const [vatRate, setVatRate] = useState(21);
    const [ean, setEan] = useState(initialEan || '');
    const [description, setDescription] = useState('');
    
    // Relations fields (IDs)
    const [manufacturerId, setManufacturerId] = useState<string>('');
    const [supplierId, setSupplierId] = useState<string>('');
    
    // Settings fields
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [isMonitored, setIsMonitored] = useState(false);
    const [lowStockThreshold, setLowStockThreshold] = useState(0);

    // Lists data
    const [manufacturers, setManufacturers] = useState<ManufacturerOut[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierOut[]>([]);

    // UI States
    const [showAddManufacturer, setShowAddManufacturer] = useState(false);
    const [showAddSupplier, setShowAddSupplier] = useState(false);

    // Load initial data and lists
    useEffect(() => {
        // Load lists
        api.getManufacturers(companyId).then(setManufacturers);
        api.getSuppliers(companyId).then(setSuppliers);

        // Set item data
        if (item) {
            setName(item.name);
            setSku(item.sku);
            setPrice(item.price || 0);
            setVatRate(item.vat_rate || 21);
            setEan(item.ean || '');
            setDescription(item.description || '');
            
            // Mapovani ID - predpokladame, ze item.manufacturer je objekt nebo null
            // Pokud backend vraci objekt: item.manufacturer?.id
            // Pokud backend vraci ID: item.manufacturer_id
            setManufacturerId(item.manufacturer?.id?.toString() || item.manufacturer_id?.toString() || '');
            setSupplierId(item.supplier?.id?.toString() || item.supplier_id?.toString() || '');

            setSelectedCategoryIds(item.category_ids || []);
            setIsMonitored(item.is_monitored_for_stock);
            setLowStockThreshold(item.low_stock_threshold || 0);
        }
    }, [item, companyId]);

    const handleCategoryToggle = (id: number) => {
        setSelectedCategoryIds(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
    };

    const handleCreateManufacturer = async (newName: string) => {
        try {
            const newMan = await api.createManufacturer(companyId, newName);
            setManufacturers(prev => [...prev, newMan]);
            setManufacturerId(newMan.id.toString());
            setShowAddManufacturer(false);
        } catch (e) {
            alert('Chyba při vytváření výrobce');
        }
    };

    const handleCreateSupplier = async (newName: string) => {
        try {
            const newSup = await api.createSupplier(companyId, newName);
            setSuppliers(prev => [...prev, newSup]);
            setSupplierId(newSup.id.toString());
            setShowAddSupplier(false);
        } catch (e) {
            alert('Chyba při vytváření dodavatele');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name, 
            sku, 
            price, 
            vat_rate: vatRate, 
            ean, 
            description,
            manufacturer_id: manufacturerId ? parseInt(manufacturerId) : null,
            supplier_id: supplierId ? parseInt(supplierId) : null,
            category_ids: selectedCategoryIds,
            is_monitored_for_stock: isMonitored,
            low_stock_threshold: isMonitored ? lowStockThreshold : undefined
        });
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4 relative">
                <Input label="Název položky" value={name} onChange={e => setName(e.target.value)} required />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="SKU" value={sku} onChange={e => setSku(e.target.value)} required />
                    <Input label="EAN" value={ean} onChange={e => setEan(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* VÝROBCE SELECT */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Výrobce</label>
                        <div className="flex space-x-2">
                            <select 
                                value={manufacturerId} 
                                onChange={e => setManufacturerId(e.target.value)}
                                className="block w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-slate-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                            >
                                <option value="">-- Vybrat výrobce --</option>
                                {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            <Button type="button" variant="secondary" onClick={() => setShowAddManufacturer(true)} title="Přidat nového výrobce">
                                <Icon name="fa-plus" />
                            </Button>
                        </div>
                    </div>

                    {/* DODAVATEL SELECT */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dodavatel</label>
                        <div className="flex space-x-2">
                            <select 
                                value={supplierId} 
                                onChange={e => setSupplierId(e.target.value)}
                                className="block w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-slate-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                            >
                                <option value="">-- Vybrat dodavatele --</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <Button type="button" variant="secondary" onClick={() => setShowAddSupplier(true)} title="Přidat nového dodavatele">
                                <Icon name="fa-plus" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kategorie (lze vybrat více)</label>
                    <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-md p-2 bg-white shadow-sm">
                        {categories.map(cat => (
                            <CategoryCheckbox
                                key={cat.id}
                                category={cat}
                                level={0}
                                selectedIds={selectedCategoryIds}
                                onToggle={handleCategoryToggle}
                            />
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input label="Cena bez DPH (Kč)" type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required min="0" step="0.01" />
                    <Input label="Sazba DPH (%)" type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))} required min="0" />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700">Popis</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 block w-full p-2 border bg-white text-slate-900 border-slate-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"></textarea>
                </div>
                
                <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                    <div className="flex items-center">
                        <input type="checkbox" id="isMonitored" checked={isMonitored} onChange={e => setIsMonitored(e.target.checked)} className="h-4 w-4 rounded" />
                        <label htmlFor="isMonitored" className="ml-2 font-medium text-slate-800">Hlídat stav zásob</label>
                    </div>
                    {isMonitored && (
                        <Input label="Upozornit při poklesu pod (ks)" type="number" value={lowStockThreshold} onChange={e => setLowStockThreshold(Number(e.target.value))} min="0" required />
                    )}
                </div>
                
                <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="secondary" onClick={onCancel}>Zrušit</Button>
                    <Button type="submit">Uložit položku</Button>
                </div>
            </form>

            {/* Modální okna pro přidání číselníků - renderují se "nad" formulářem */}
            {showAddManufacturer && (
                <SimpleAddModal title="Nový výrobce" onClose={() => setShowAddManufacturer(false)} onSave={handleCreateManufacturer} />
            )}
            {showAddSupplier && (
                <SimpleAddModal title="Nový dodavatel" onClose={() => setShowAddSupplier(false)} onSave={handleCreateSupplier} />
            )}
        </>
    );
};

export default InventoryForm;