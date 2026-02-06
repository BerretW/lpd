import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InventoryItem, CategoryOut, ManufacturerOut, SupplierOut } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import Icon from './common/Icon';
import * as api from '../api';

interface InventoryFormProps {
    onSave: (data: { itemData: any; imageFile: File | null }) => void;
    onCancel: () => void;
    companyId: number;
    item?: InventoryItem;
    categories: CategoryOut[];
    initialEan?: string;
}

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
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [price, setPrice] = useState(0); // Nákupní cena
    const [vatRate, setVatRate] = useState(21);
    const [ean, setEan] = useState(initialEan || '');
    const [description, setDescription] = useState('');
    
    // Nové stavy
    const [alternativeSku, setAlternativeSku] = useState('');
    const [retailPrice, setRetailPrice] = useState(0); // Koncová cena (MOC)
    
    const [manufacturerId, setManufacturerId] = useState<string>('');
    const [supplierId, setSupplierId] = useState<string>('');
    
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [isMonitored, setIsMonitored] = useState(false);
    const [lowStockThreshold, setLowStockThreshold] = useState(0);

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [manufacturers, setManufacturers] = useState<ManufacturerOut[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierOut[]>([]);

    const [showAddManufacturer, setShowAddManufacturer] = useState(false);
    const [showAddSupplier, setShowAddSupplier] = useState(false);

    useEffect(() => {
        api.getManufacturers(companyId).then(setManufacturers);
        api.getSuppliers(companyId).then(setSuppliers);

        if (item) {
            setName(item.name);
            setSku(item.sku);
            setPrice(item.price || 0);
            setVatRate(item.vat_rate || 21);
            setEan(item.ean || '');
            setDescription(item.description || '');
            
            // Načtení nových polí
            setAlternativeSku(item.alternative_sku || '');
            setRetailPrice(item.retail_price || 0);
            
            setManufacturerId(item.manufacturer?.id?.toString() || item.manufacturer_id?.toString() || '');
            setSupplierId(item.supplier?.id?.toString() || item.supplier_id?.toString() || '');

            const loadedCategoryIds = item.category_ids && item.category_ids.length > 0
                ? item.category_ids
                : item.categories?.map(c => c.id) || [];
            
            setSelectedCategoryIds(loadedCategoryIds);
            
            setIsMonitored(item.is_monitored_for_stock);
            setLowStockThreshold(item.low_stock_threshold || 0);

            if (item.image_url) {
                setImagePreview(item.image_url);
            }
        }
    }, [item, companyId]);

    // Automatický výpočet slevy
    const calculatedDiscount = useMemo(() => {
        if (!retailPrice || retailPrice <= 0 || !price) return 0;
        // (1 - (nákupní / koncová)) * 100
        const discount = (1 - (price / retailPrice)) * 100;
        return discount;
    }, [price, retailPrice]);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(item?.image_url || null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const itemData = {
            name, 
            sku, 
            price, 
            vat_rate: vatRate, 
            ean, 
            description,
            // Nová pole
            alternative_sku: alternativeSku,
            retail_price: retailPrice,
            
            manufacturer_id: manufacturerId ? parseInt(manufacturerId) : null,
            supplier_id: supplierId ? parseInt(supplierId) : null,
            category_ids: selectedCategoryIds,
            is_monitored_for_stock: isMonitored,
            low_stock_threshold: isMonitored ? lowStockThreshold : undefined
        };

        onSave({ itemData, imageFile });
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4 relative">
                <div className="flex gap-4">
                    <div className="flex-grow space-y-4">
                        <Input label="Název položky" value={name} onChange={e => setName(e.target.value)} required />
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="SKU (Interní)" value={sku} onChange={e => setSku(e.target.value)} required />
                            <Input label="Alt. SKU (Dodavatel)" value={alternativeSku} onChange={e => setAlternativeSku(e.target.value)} placeholder="Např. obj. kód" />
                            <Input label="EAN" value={ean} onChange={e => setEan(e.target.value)} />
                        </div>
                    </div>

                    <div className="w-32 flex flex-col items-center space-y-2 pt-1">
                        <label className="block text-sm font-medium text-slate-700">Obrázek</label>
                        <div 
                            className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors relative"
                            onClick={() => fileInputRef.current?.click()}
                            title="Klikněte pro nahrání obrázku"
                        >
                            {imagePreview ? (
                                <img src={imagePreview} alt="Náhled" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-slate-400 text-center">
                                    <Icon name="fa-image" className="text-2xl mb-1" />
                                    <span className="text-xs block">Nahrát</span>
                                </div>
                            )}
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="hidden" 
                            accept="image/*"
                        />
                        {imageFile && (
                            <button type="button" onClick={handleRemoveImage} className="text-xs text-red-500 hover:text-red-700 underline">
                                Zrušit změnu
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* Sekce Ceny */}
                <div className="p-4 border rounded-lg bg-slate-50">
                    <h4 className="font-semibold text-slate-700 mb-3">Ceny a Slevy</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <Input 
                            label="Koncová cena (MOC)" 
                            type="number" 
                            value={retailPrice} 
                            onChange={e => setRetailPrice(Number(e.target.value))} 
                            min="0" 
                            step="0.01" 
                            placeholder="Ceníková cena"
                        />
                        <Input 
                            label="Vaše nákupní cena" 
                            type="number" 
                            value={price} 
                            onChange={e => setPrice(Number(e.target.value))} 
                            required 
                            min="0" 
                            step="0.01" 
                        />
                        
                        <div className="mb-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vypočtená sleva</label>
                            <div className={`p-2 border rounded font-bold text-center ${calculatedDiscount > 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-200 text-slate-600'}`}>
                                {retailPrice > 0 ? `${calculatedDiscount.toFixed(2)} %` : '-'}
                            </div>
                        </div>

                        <Input 
                            label="DPH (%)" 
                            type="number" 
                            value={vatRate} 
                            onChange={e => setVatRate(Number(e.target.value))} 
                            required 
                            min="0" 
                        />
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Popis</label>
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