import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { InventoryItem, RoleEnum, CategoryOut, LocationOut } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import InventoryForm from './InventoryForm';
import AdjustStockModal from './AdjustStockModal';
import CategoryManager from './CategoryManager';
import Icon from './common/Icon';
import * as api from '../api';
import ErrorModal from './common/ErrorModal';
import { useAuth } from '../AuthContext';
import { useI18n } from '../I18nContext';
import Input from './common/Input';
import LocationManager from './LocationManager';
import EanTerminal from './EanTerminal';
import InventoryHistoryModal from './InventoryHistoryModal'; // Už tam asi je, ale ujistěte se
import { ExtensionPoint } from '../lib/PluginSystem';

interface InventoryProps {
  companyId: number;
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

const Inventory: React.FC<InventoryProps> = ({ companyId }) => {
  const { role } = useAuth();
  const { t } = useI18n();
  const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;

  const [view, setView] = useState<'items' | 'locations' | 'categories'>('items');
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [accessibleLocations, setAccessibleLocations] = useState<LocationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEanTerminalOpen, setIsEanTerminalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  
  const accessibleLocationIds = useMemo(() => {
    if (isAdmin) return null;
    return new Set(accessibleLocations.map(l => l.id));
  }, [accessibleLocations, isAdmin]);

  const getAccessibleStock = useCallback((item: InventoryItem) => {
    if (isAdmin || !accessibleLocationIds) return item.total_quantity;
    return item.locations.reduce((sum, loc) => accessibleLocationIds.has(loc.location.id) ? sum + loc.quantity : sum, 0);
  }, [isAdmin, accessibleLocationIds]);
  
  const fetchData = useCallback(async (isInitial = false) => {
    try {
        setLoading(true);
        const categoryToFilter = selectedCategoryId ? parseInt(selectedCategoryId) : undefined;
        const [itemData, categoryData, accessibleLocsData] = await Promise.all([
            api.getInventoryItems(companyId, categoryToFilter),
            isInitial ? api.getCategories(companyId) : Promise.resolve(undefined),
            (isInitial && !isAdmin) ? api.getMyLocations(companyId) : Promise.resolve(undefined)
        ]);

        setItems(itemData);
        if (categoryData) setCategories(categoryData);
        if (accessibleLocsData) setAccessibleLocations(accessibleLocsData);
        setError(null);
    } catch(err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch inventory data');
    } finally {
        setLoading(false);
    }
  }, [companyId, selectedCategoryId, isAdmin]);

  useEffect(() => { fetchData(true); }, [companyId, isAdmin]);
  useEffect(() => { if (selectedCategoryId !== undefined) fetchData(false); }, [selectedCategoryId, fetchData]);
  
  const filteredItems = useMemo(() => {
    let itemsToFilter = isAdmin ? items : items.filter(item => item.locations.some(loc => accessibleLocationIds?.has(loc.location.id)));
    if (!searchTerm) return itemsToFilter;
    const lowercasedTerm = searchTerm.toLowerCase();
    
    return itemsToFilter.filter(item => 
        item.name.toLowerCase().includes(lowercasedTerm) || 
        item.sku.toLowerCase().includes(lowercasedTerm) ||
        (item.alternative_sku && item.alternative_sku.toLowerCase().includes(lowercasedTerm)) ||
        (item.manufacturer?.name && item.manufacturer.name.toLowerCase().includes(lowercasedTerm)) ||
        (item.supplier?.name && item.supplier.name.toLowerCase().includes(lowercasedTerm))
    );
  }, [items, searchTerm, isAdmin, accessibleLocationIds]);

  const handleSave = async (data: { itemData: any, imageFile: File | null }) => {
      const { itemData, imageFile } = data;
      try {
          let savedItem;
          
          if (editingItem) {
              savedItem = await api.updateInventoryItem(companyId, editingItem.id, itemData);
          } else {
              savedItem = await api.createInventoryItem(companyId, itemData);
          }

          if (imageFile && savedItem) {
              await api.uploadInventoryItemImage(companyId, savedItem.id, imageFile);
          }

          setIsFormModalOpen(false);
          setEditingItem(null);
          await fetchData(false); 
      } catch (error) {
          setError(error instanceof Error ? error.message : "Uložení selhalo.");
      }
  };
  
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">{t('inventory.title')}</h1>
        <div className="flex space-x-2">
            <Button onClick={() => setIsEanTerminalOpen(true)} variant="secondary" className="!bg-gray-800 !text-white">
              <i className="fas fa-barcode mr-2"></i> Skladový automat
            </Button>
                {/* ZDE VLOŽIT EXTENSION POINT */}
    <ExtensionPoint name="inventory-header-actions" context={{ companyId, refresh: () => fetchData(false) }} />
    {/* ========================== */}
            {isAdmin && view === 'items' && (
                <Button onClick={() => { setEditingItem(null); setIsFormModalOpen(true); }}>
                  <i className="fas fa-plus mr-2"></i> {t('inventory.newItem')}
                </Button>
            )}
            
        </div>
      </div>

       {view === 'items' && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-100 rounded-lg">
                <Input placeholder={t('inventory.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm">
                    <option value="">{t('inventory.allCategories')}</option>
                    {categories.map(cat => <CategoryOption key={cat.id} category={cat} level={0} />)}
                </select>
            </div>
       )}

      <nav className="mb-6 flex space-x-1 bg-slate-200 p-1 rounded-lg">
          <button onClick={() => setView('items')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'items' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>{t('inventory.items')}</button>
          {isAdmin && <button onClick={() => setView('locations')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'locations' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>{t('inventory.locations')}</button>}
          {isAdmin && <button onClick={() => setView('categories')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'categories' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>{t('inventory.categories')}</button>}
      </nav>

      {view === 'items' ? (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="min-w-full leading-normal">
              <thead>
                <tr className="bg-slate-200 text-left text-slate-600 uppercase text-sm">
                  <th className="px-5 py-3 border-b-2 border-slate-300 w-16">Foto</th>
                  <th className="px-5 py-3 border-b-2 border-slate-300">{t('inventory.colItemName')}</th>
                  <th className="px-5 py-3 border-b-2 border-slate-300">Výrobce</th>
                  <th className="px-5 py-3 border-b-2 border-slate-300">{t('inventory.colSku')} / Alt.</th>
                  <th className="px-5 py-3 border-b-2 border-slate-300">{isAdmin ? t('inventory.colTotal') : 'Dostupné ks'}</th>
                  <th className="px-5 py-3 border-b-2 border-slate-300">{t('inventory.colPrice')} / Sleva</th>
                  <th className="px-5 py-3 border-b-2 border-slate-300">{t('inventory.colCategory')}</th>
                  <th className="px-5 py-3 border-b-2 border-slate-300">{t('inventory.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                    const accessibleQuantity = getAccessibleStock(item);
                    const isLowStock = isAdmin && item.is_monitored_for_stock && item.low_stock_threshold != null && item.total_quantity <= item.low_stock_threshold;
                    
                    // Výpočet slevy
                    const discount = (item.price && item.retail_price && item.retail_price > 0) 
                        ? ((1 - (item.price / item.retail_price)) * 100).toFixed(0) 
                        : null;
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        {/* ZOBRAZENÍ OBRÁZKU */}
                        <td className="px-5 py-4 border-b border-slate-200">
                            {item.image_url ? (
                                <img 
                                    src={item.image_url} 
                                    alt={item.name} 
                                    className="w-10 h-10 object-cover rounded-md border border-slate-200"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center text-slate-300">
                                    <Icon name="fa-image" />
                                </div>
                            )}
                        </td>

                        <td className="px-5 py-4 border-b border-slate-200 text-sm">
                          <p className="text-slate-900 whitespace-no-wrap flex items-center font-medium">{item.name}{isAdmin && item.is_monitored_for_stock && <Icon name="fa-bell" className="ml-2 text-blue-500" title={t('inventory.monitored', { threshold: item.low_stock_threshold || 0 })} />}</p>
                          {item.ean && <p className="text-xs text-slate-400">EAN: {item.ean}</p>}
                        </td>
                        
                        <td className="px-5 py-4 border-b border-slate-200 text-sm">
                            <p className="text-slate-700 whitespace-no-wrap font-medium">{item.manufacturer?.name || '-'}</p>
                            {item.supplier && <p className="text-xs text-slate-400 mt-0.5">Dod: {item.supplier.name}</p>}
                        </td>

                        <td className="px-5 py-4 border-b border-slate-200 text-sm">
                            <p className="text-slate-900 font-medium whitespace-no-wrap">{item.sku}</p>
                            {item.alternative_sku && <p className="text-xs text-slate-500 mt-1" title="Alternativní SKU">{item.alternative_sku}</p>}
                        </td>
                        
                        <td className="px-5 py-4 border-b border-slate-200 text-sm">
                          <span className={`relative inline-block px-3 py-1 font-semibold leading-tight ${isLowStock ? 'text-red-900' : 'text-green-900'}`}>
                            <span aria-hidden className={`absolute inset-0 ${isLowStock ? 'bg-red-200' : accessibleQuantity > 0 ? 'bg-green-200' : 'bg-slate-200'} opacity-50 rounded-full`}></span>
                            <span className="relative">{accessibleQuantity} ks</span>
                          </span>
                        </td>

                        <td className="px-5 py-4 border-b border-slate-200 text-sm">
                            <p className="text-slate-900 font-bold whitespace-no-wrap">
                                {item.price ? item.price.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' }) : 'N/A'}
                            </p>
                            {discount && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                    -{discount}%
                                </span>
                            )}
                        </td>

                        <td className="px-5 py-4 border-b border-slate-200 text-sm"><p className="text-slate-900 whitespace-no-wrap">{item.categories?.map(c => c.name).join(', ') || '-'}</p></td>
                        <td className="px-5 py-4 border-b border-slate-200 text-sm">
                           {isAdmin && (
                                <div className="flex space-x-2">
                                    <Button variant="secondary" onClick={() => { setEditingItem(item); setIsFormModalOpen(true); }} title={t('inventory.edit')}>
                                        <Icon name="fa-pencil-alt" />
                                    </Button>
                                    <Button variant="secondary" onClick={() => setAdjustingItem(item)} title={t('inventory.stockOperations')}>
                                        <Icon name="fa-box-open" />
                                    </Button>
                                    {/* NOVÉ TLAČÍTKO PRO HISTORII */}
                                    <Button variant="secondary" onClick={() => setHistoryItem(item)} title="Historie pohybů">
                                        <Icon name="fa-history" />
                                    </Button>
                                </div>
                            )}
                        </td>
                      </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
      ) : view === 'locations' ? <LocationManager companyId={companyId} /> : <CategoryManager companyId={companyId} /> }

      {isFormModalOpen && (
        <Modal title={editingItem ? "Upravit položku" : "Nová skladová položka"} onClose={() => setIsFormModalOpen(false)}>
            <InventoryForm 
                onSave={handleSave} 
                onCancel={() => setIsFormModalOpen(false)} 
                companyId={companyId} 
                item={editingItem || undefined} 
                categories={categories} 
            />
        </Modal>
      )}
      {isEanTerminalOpen && (
        <EanTerminal companyId={companyId} onClose={() => { setIsEanTerminalOpen(false); fetchData(false); }} categories={categories} />
      )}
      {adjustingItem && (
        <AdjustStockModal item={adjustingItem} companyId={companyId} onClose={() => setAdjustingItem(null)} onSave={() => { setAdjustingItem(null); fetchData(false); }} />
      )}
      {historyItem && (
    <InventoryHistoryModal 
        companyId={companyId} 
        item={historyItem} 
        onClose={() => setHistoryItem(null)} 
    />
)}
      {error && <ErrorModal title="Chyba skladu" message={error} onClose={() => setError(null)} />}
    </div>
  );
};

export default Inventory;