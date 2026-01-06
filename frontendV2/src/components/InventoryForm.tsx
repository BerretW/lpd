
import React, { useState, useEffect } from 'react';
import { InventoryItem, CategoryOut } from '../types';
import Input from './common/Input';
import Button from './common/Button';

interface InventoryFormProps {
  onSave: (item: any) => void;
  onCancel: () => void;
  companyId: number;
  item?: InventoryItem;
  categories: CategoryOut[];
  initialEan?: string;
}

const CategoryOption: React.FC<{ category: CategoryOut; level: number }> = ({ category, level }) => (
    <>
        <option value={category.id}>
            {'--'.repeat(level)} {category.name}
        </option>
        {category.children.map(child => (
            <CategoryOption key={child.id} category={child} level={level + 1} />
        ))}
    </>
);

const InventoryForm: React.FC<InventoryFormProps> = ({ onSave, onCancel, companyId, item, categories, initialEan }) => {
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [price, setPrice] = useState(0);
    const [vatRate, setVatRate] = useState(21);
    const [ean, setEan] = useState(initialEan || '');
    const [description, setDescription] = useState('');
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [isMonitored, setIsMonitored] = useState(false);
    const [lowStockThreshold, setLowStockThreshold] = useState(0);

    useEffect(() => {
        if (item) {
            setName(item.name);
            setSku(item.sku);
            setPrice(item.price || 0);
            setVatRate(item.vat_rate || 21);
            setEan(item.ean || '');
            setDescription(item.description || '');
            setSelectedCategoryIds(item.category_ids || []);
            setIsMonitored(item.is_monitored_for_stock);
            setLowStockThreshold(item.low_stock_threshold || 0);
        }
    }, [item]);

    const handleCategoryToggle = (id: number) => {
        setSelectedCategoryIds(prev => 
            prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ 
            name, sku, price, vat_rate: vatRate, ean, description,
            category_ids: selectedCategoryIds,
            is_monitored_for_stock: isMonitored,
            low_stock_threshold: isMonitored ? lowStockThreshold : undefined
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Název položky" value={name} onChange={e => setName(e.target.value)} required />
            <div className="grid grid-cols-2 gap-4">
              <Input label="SKU" value={sku} onChange={e => setSku(e.target.value)} required />
              <Input label="EAN" value={ean} onChange={e => setEan(e.target.value)} />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kategorie (lze vybrat více)</label>
                <div className="max-h-32 overflow-y-auto border border-slate-300 rounded-md p-2 bg-white space-y-1">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex items-center">
                            <input
                                type="checkbox"
                                id={`cat-${cat.id}`}
                                checked={selectedCategoryIds.includes(cat.id)}
                                onChange={() => handleCategoryToggle(cat.id)}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            <label htmlFor={`cat-${cat.id}`} className="ml-2 text-sm text-slate-700">{cat.name}</label>
                        </div>
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
    );
};

export default InventoryForm;
