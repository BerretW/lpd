
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PickingOrderOut, PickingOrderStatus, LocationOut, InventoryItem, PickingOrderCreateIn, PickingOrderItemIn, PickingOrderFulfillIn, RoleEnum, PickingOrderFulfillItemIn } from '../types';
import * as api from '../api';
import Button from './common/Button';
import Icon from './common/Icon';
import Modal from './common/Modal';
import Card from './common/Card';
import ErrorModal from './common/ErrorModal';
import ErrorMessage from './common/ErrorMessage';
import Input from './common/Input';
import { useI18n } from '../I18nContext';
import { useAuth } from '../AuthContext';

interface PickingOrdersProps {
  companyId: number;
}


// --- Create Order Form ---
interface CreatePickingOrderFormProps {
    companyId: number;
    onClose: () => void;
    onSave: () => void;
}

const CreatePickingOrderForm: React.FC<CreatePickingOrderFormProps> = ({ companyId, onClose, onSave }) => {
    const { t } = useI18n();
    const { role } = useAuth();
    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;

    const [destinationLocations, setDestinationLocations] = useState<LocationOut[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [destinationLocationId, setDestinationLocationId] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<({ id: number } & Partial<PickingOrderItemIn> & { type: 'stock' | 'custom' })[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const locationsPromise = isAdmin
                    ? api.getLocations(companyId) // Admins see all
                    : api.getMyLocations(companyId); // Members see only theirs

                const [destLocs, inv] = await Promise.all([
                    locationsPromise,
                    api.getInventoryItems(companyId),
                ]);

                setDestinationLocations(destLocs);
                setInventory(inv);

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Chyba při načítání dat.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [companyId, isAdmin]);
    
    const handleAddItem = () => {
        setItems([...items, { id: Date.now(), type: 'stock', requested_quantity: 1 }]);
    };

    const handleRemoveItem = (id: number) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: number, field: keyof PickingOrderItemIn | 'type', value: any) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: value };
                if (field === 'type') {
                    delete newItem.inventory_item_id;
                    delete newItem.requested_item_description;
                }
                return newItem;
            }
            return item;
        }));
    };
    
    const handleSubmit = async () => {
        setError(null);
        if (!destinationLocationId) {
            setError('Vyberte prosím cílovou lokaci.');
            return;
        }
        if (items.length === 0) {
            setError('Přidejte alespoň jednu položku.');
            return;
        }

        const payloadItems: PickingOrderItemIn[] = [];
        for (const item of items) {
            if (!item.requested_quantity || item.requested_quantity <= 0) {
                setError('Všechny položky musí mít platné množství.'); return;
            }
            if (item.type === 'stock') {
                if (!item.inventory_item_id) { setError('Vyberte prosím skladovou položku pro všechny řádky typu "Ze skladu".'); return; }
                payloadItems.push({ inventory_item_id: item.inventory_item_id, requested_quantity: item.requested_quantity });
            } else {
                if (!item.requested_item_description?.trim()) { setError('Vyplňte prosím popis pro všechny vlastní položky.'); return; }
                payloadItems.push({ requested_item_description: item.requested_item_description, requested_quantity: item.requested_quantity });
            }
        }
        
        const payload: PickingOrderCreateIn = {
            source_location_id: null,
            destination_location_id: parseInt(destinationLocationId),
            notes,
            items: payloadItems
        };

        try {
            await api.createPickingOrder(companyId, payload);
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení žádanky selhalo.');
        }
    };


    return (
        <div className="space-y-4">
            <ErrorMessage message={error} />
            <Input type="select" label={t('pickingOrders.destinationLocation')} value={destinationLocationId} onChange={e => setDestinationLocationId(e.target.value)} required>
                <option value="">-- Vybrat --</option>
                {destinationLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Input>
            <Input type="textarea" label={t('pickingOrders.notes')} value={notes} onChange={e => setNotes(e.target.value)} />
            
            <div className="space-y-2">
                <h3 className="font-semibold text-slate-700">{t('pickingOrders.items')}</h3>
                {items.map(item => (
                    <div key={item.id} className="p-2 border rounded grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3">
                            <select value={item.type} onChange={e => handleItemChange(item.id, 'type', e.target.value)} className="w-full text-sm p-1.5 border rounded">
                                <option value="stock">{t('pickingOrders.itemFromStock')}</option>
                                <option value="custom">{t('pickingOrders.itemCustom')}</option>
                            </select>
                        </div>
                        <div className="col-span-6">
                             {item.type === 'stock' ? (
                                <select value={item.inventory_item_id || ''} onChange={e => handleItemChange(item.id, 'inventory_item_id', parseInt(e.target.value))} className="w-full text-sm p-1.5 border rounded">
                                    <option value="">{t('pickingOrders.searchItem')}</option>
                                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                                </select>
                             ) : (
                                <Input value={item.requested_item_description || ''} onChange={e => handleItemChange(item.id, 'requested_item_description', e.target.value)} placeholder={t('pickingOrders.itemDescription')} />
                             )}
                        </div>
                        <div className="col-span-2"><Input type="number" value={item.requested_quantity || ''} onChange={e => handleItemChange(item.id, 'requested_quantity', parseInt(e.target.value))} placeholder={t('pickingOrders.quantity')} /></div>
                        <div className="col-span-1"><Button variant="secondary" className="!bg-red-100 !text-red-700 w-full" onClick={() => handleRemoveItem(item.id)}><Icon name="fa-trash" /></Button></div>
                    </div>
                ))}
                <Button variant="secondary" onClick={handleAddItem}><Icon name="fa-plus" className="mr-2" />{t('pickingOrders.addItem')}</Button>
            </div>

            <div className="flex justify-end pt-4 space-x-2">
                <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                <Button onClick={handleSubmit} disabled={loading}>{t('pickingOrders.save')}</Button>
            </div>
        </div>
    );
};


// --- Fulfill Order Form ---
interface FulfillOrderFormProps {
    companyId: number;
    order: PickingOrderOut;
    onClose: () => void;
    onSave: () => void;
}

interface FulfillFormItem {
    picking_order_item_id: number;
    picked_quantity: number;
    inventory_item_id?: number;
    isCustom: boolean;
    description: string | null;
    source_location_id: string;
}

const FulfillOrderForm: React.FC<FulfillOrderFormProps> = ({ companyId, order, onClose, onSave }) => {
    const { t } = useI18n();
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [items, setItems] = useState<FulfillFormItem[]>([]);
    const [error, setError] = useState<string | null>(null);

     useEffect(() => {
        api.getInventoryItems(companyId).then(setInventory);
        setItems(order.items.map(item => ({
            picking_order_item_id: item.id,
            picked_quantity: item.requested_quantity,
            inventory_item_id: item.inventory_item?.id,
            isCustom: !item.inventory_item,
            description: item.requested_item_description || item.inventory_item?.name,
            source_location_id: '',
        })));
    }, [companyId, order]);

    const handleItemChange = (id: number, field: string, value: any) => {
        setItems(items.map(item => item.picking_order_item_id === id ? { ...item, [field]: value } : item));
    };
    
    const handleSubmit = async () => {
        setError(null);
        const payloadItems: PickingOrderFulfillItemIn[] = [];

        for (const item of items) {
            const pickedQty = Number(item.picked_quantity || 0);

            if (pickedQty > 0 && !item.source_location_id) {
                setError('Pro všechny vychystávané položky musíte vybrat zdrojovou lokaci.');
                return;
            }

            const payload: any = {
                picking_order_item_id: item.picking_order_item_id,
                picked_quantity: pickedQty,
                source_location_id: Number(item.source_location_id)
            };

            if (item.isCustom) {
                if (!item.inventory_item_id) {
                     setError('Musíte přiřadit skladovou kartu ke všem vlastním položkám.');
                     return;
                }
                payload.inventory_item_id = Number(item.inventory_item_id);
            }
            payloadItems.push(payload);
        }

        try {
            await api.fulfillPickingOrder(companyId, order.id, { items: payloadItems });
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Splnění žádanky selhalo.');
        }
    }

    return (
        <div className="space-y-4">
            <ErrorMessage message={error} />
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {items.map(item => {
                    const orderItem = order.items.find(i => i.id === item.picking_order_item_id);
                    const currentInventoryItemDetails = inventory.find(i => i.id === item.inventory_item_id);
                    const availableLocations = currentInventoryItemDetails?.locations.filter(l => l.quantity > 0) || [];
                    const maxQuantity = item.source_location_id 
                        ? (currentInventoryItemDetails?.locations.find(l => l.location.id === Number(item.source_location_id))?.quantity ?? 0) 
                        : 0;

                    return (
                        <div key={item.picking_order_item_id} className="p-3 border rounded-lg bg-slate-50 space-y-3">
                            <div>
                                <p className="font-semibold">{item.description}</p>
                                <p className="text-sm text-slate-600">{t('pickingOrders.requested')}: {orderItem?.requested_quantity} ks</p>
                            </div>

                            {item.isCustom && (
                                <Input type="select" label={t('pickingOrders.linkToInventoryItem')} value={item.inventory_item_id || ''} onChange={e => handleItemChange(item.picking_order_item_id, 'inventory_item_id', e.target.value)}>
                                    <option value="">-- Vybrat --</option>
                                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                                </Input>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Zdrojová lokace" type="select" value={item.source_location_id} onChange={e => handleItemChange(item.picking_order_item_id, 'source_location_id', e.target.value)} disabled={!currentInventoryItemDetails}>
                                    <option value="">-- Vybrat zdroj --</option>
                                    {availableLocations.map(loc => (
                                        <option key={loc.location.id} value={loc.location.id}>
                                            {loc.location.name} ({loc.quantity} ks)
                                        </option>
                                    ))}
                                </Input>
                                <Input 
                                    label={t('pickingOrders.pickedQuantity')} 
                                    type="number" 
                                    value={item.picked_quantity} 
                                    onChange={e => handleItemChange(item.picking_order_item_id, 'picked_quantity', e.target.value)} 
                                    max={maxQuantity}
                                    min="0"
                                    disabled={!item.source_location_id}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
             <div className="flex justify-end pt-4 space-x-2">
                <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                <Button onClick={handleSubmit}>{t('pickingOrders.saveFulfillment')}</Button>
            </div>
        </div>
    );
}

const statusColors: { [key in PickingOrderStatus]: string } = {
    [PickingOrderStatus.New]: 'bg-blue-100 text-blue-800',
    [PickingOrderStatus.InProgress]: 'bg-orange-100 text-orange-800',
    [PickingOrderStatus.Completed]: 'bg-green-100 text-green-800',
    [PickingOrderStatus.Cancelled]: 'bg-slate-100 text-slate-800',
};


// --- Main Component ---
const PickingOrders: React.FC<PickingOrdersProps> = ({ companyId }) => {
    const { user, role } = useAuth();
    const { t } = useI18n();
    const [orders, setOrders] = useState<PickingOrderOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<'NONE' | 'CREATE' | 'DETAIL' | 'FULFILL'>('NONE');
    const [selectedOrder, setSelectedOrder] = useState<PickingOrderOut | null>(null);
    const [viewMode, setViewMode] = useState<'my' | 'all'>('my');

    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getPickingOrders(companyId);
            setOrders(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se načíst žádanky.');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenModal = (type: 'DETAIL' | 'FULFILL', order: PickingOrderOut) => {
        setSelectedOrder(order);
        setModal(type);
    };

    const handleCloseModal = () => {
        setModal('NONE');
        setSelectedOrder(null);
    }
    
    const handleSave = () => {
        handleCloseModal();
        fetchData();
    };

    const groupedOrders = useMemo(() => {
        const filtered = (viewMode === 'my' || !isAdmin) && user
            ? orders.filter(o => o.requester.id === user.id || o.picker?.id === user.id)
            : orders;

        return filtered.reduce((acc, order) => {
            const group: 'uncompleted' | 'completed' = (order.status === PickingOrderStatus.Completed || order.status === PickingOrderStatus.Cancelled)
                ? 'completed'
                : 'uncompleted';
            (acc[group] = acc[group] || []).push(order);
            return acc;
        }, {} as Record<'uncompleted' | 'completed', PickingOrderOut[]>);

    }, [orders, viewMode, user, isAdmin]);

    const renderModals = () => {
        if (modal === 'CREATE') {
            return <Modal title={t('pickingOrders.createModalTitle')} onClose={handleCloseModal}><CreatePickingOrderForm companyId={companyId} onClose={handleCloseModal} onSave={handleSave} /></Modal>;
        }
        if (modal === 'FULFILL' && selectedOrder) {
            return <Modal title={t('pickingOrders.fulfillModalTitle', {id: selectedOrder.id})} onClose={handleCloseModal}><FulfillOrderForm companyId={companyId} order={selectedOrder} onClose={handleCloseModal} onSave={handleSave} /></Modal>;
        }
        if (modal === 'DETAIL' && selectedOrder) {
             return (
                <Modal title={`Detail žádanky #${selectedOrder.id}`} onClose={handleCloseModal}>
                    <div className="space-y-3 text-slate-800">
                        <p><strong>Stav:</strong> <span className={`px-2 py-1 rounded-full font-semibold text-xs ${statusColors[selectedOrder.status]}`}>{t(`pickingOrders.status.${selectedOrder.status}`)}</span></p>
                        <p><strong>{t('pickingOrders.from')}:</strong> {selectedOrder.source_location?.name || t('pickingOrders.mainWarehouse')}</p>
                        <p><strong>{t('pickingOrders.to')}:</strong> {selectedOrder.destination_location.name}</p>
                        <p><strong>{t('pickingOrders.requestedBy')}:</strong> {selectedOrder.requester.email}</p>
                        {selectedOrder.picker && <p><strong>{t('pickingOrders.pickedBy')}:</strong> {selectedOrder.picker.email}</p>}
                        <h3 className="font-bold pt-2 border-t">{t('pickingOrders.items')}:</h3>
                        <ul className="list-disc list-inside space-y-1">
                            {selectedOrder.items.map(item => (
                                <li key={item.id}>
                                    {item.inventory_item ? `${item.inventory_item.name} (${item.inventory_item.sku})` : <em>{item.requested_item_description}</em>}
                                    - {t('pickingOrders.requested')}: {item.requested_quantity} ks
                                    {item.picked_quantity !== null && `, ${t('pickingOrders.picked')}: ${item.picked_quantity} ks`}
                                </li>
                            ))}
                        </ul>
                         <div className="flex justify-end pt-4"><Button onClick={handleCloseModal}>Zavřít</Button></div>
                    </div>
                </Modal>
            );
        }
        return null;
    }

    return (
        <div className="p-8 bg-slate-50 min-h-full">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">{t('pickingOrders.title')}</h1>
                <Button onClick={() => setModal('CREATE')}>
                    <Icon name="fa-plus" className="mr-2" /> {t('pickingOrders.newOrder')}
                </Button>
            </div>

            {isAdmin && (
                <div className="mb-6 flex space-x-1 bg-slate-200 p-1 rounded-lg">
                    <button onClick={() => setViewMode('my')} className={`w-full p-2 rounded-md font-semibold transition-colors ${viewMode === 'my' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>{t('pickingOrders.myOrders')}</button>
                    <button onClick={() => setViewMode('all')} className={`w-full p-2 rounded-md font-semibold transition-colors ${viewMode === 'all' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>{t('pickingOrders.allOrders')}</button>
                </div>
            )}

            {loading ? <p>{t('pickingOrders.loading')}</p> : (
                <div className="space-y-6">
                    {[
                        { key: 'uncompleted', label: t('pickingOrders.uncompleted') },
                        { key: 'completed', label: t('pickingOrders.completed') }
                    ].map(({ key, label }) => {
                        const ordersInGroup = (groupedOrders[key as 'uncompleted' | 'completed'] || []) as PickingOrderOut[];
                        if (ordersInGroup.length === 0) return null;

                        return (
                            <div key={key}>
                                <h2 className="text-xl font-semibold text-slate-700 mb-3">{label}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {ordersInGroup.map(order => (
                                        <Card key={order.id}>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-slate-900">{t('pickingOrders.title')} #{order.id}</h3>
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[order.status]}`}>
                                                    {t(`pickingOrders.status.${order.status}`)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                {t('pickingOrders.from')}: {order.source_location?.name || t('pickingOrders.mainWarehouse')} <Icon name="fa-arrow-right" className="mx-2"/> {t('pickingOrders.to')}: {order.destination_location.name}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-2">{t('pickingOrders.createdBy')}: {new Date(order.created_at).toLocaleString('cs-CZ')}</p>
                                            <p className="text-xs text-slate-500">{t('pickingOrders.requestedBy')}: {order.requester.email}</p>
                                            <div className="flex justify-end mt-4 space-x-2">
                                                <Button variant="secondary" onClick={() => handleOpenModal('DETAIL', order)}>{t('pickingOrders.detail')}</Button>
                                                {isAdmin && (order.status === PickingOrderStatus.New || order.status === PickingOrderStatus.InProgress) && <Button onClick={() => handleOpenModal('FULFILL', order)}>{t('pickingOrders.fulfill')}</Button>}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                     {/* FIX: Cast Object.values to 'PickingOrderOut[][]' to ensure correctly calling length. */}
                     {(Object.values(groupedOrders) as PickingOrderOut[][]).every(group => group.length === 0) && (
                        <div className="text-center p-16 text-slate-500">
                            <Icon name="fa-box-open" className="text-4xl mb-4" />
                            <p>{viewMode === 'my' ? 'Nemáte žádné žádanky.' : 'Nebyly nalezeny žádné žádanky.'}</p>
                        </div>
                    )}
                </div>
            )}
            {renderModals()}
            {error && <ErrorModal title="Chyba v žádankách" message={error} onClose={() => setError(null)} />}
        </div>
    );
};

export default PickingOrders;
