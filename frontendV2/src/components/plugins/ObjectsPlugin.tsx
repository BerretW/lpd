import React, { useState, useEffect, useCallback } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Icon from '../common/Icon';
import * as api from '../../api';
import { InventoryItemOut, ClientOut, WorkOrderOut, ServiceReportOut } from '../../types';
import ServiceReportForm from '../ServiceReportForm';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InventoryParam = 'manufacturer' | 'supplier' | 'name' | 'sku' | 'description' | 'ean' | 'price' | 'retail_price';

export const INVENTORY_PARAM_LABELS: Record<InventoryParam, string> = {
    manufacturer: 'Výrobce',
    supplier: 'Dodavatel',
    name: 'Název položky',
    sku: 'SKU',
    description: 'Popis',
    ean: 'EAN',
    price: 'Nákupní cena',
    retail_price: 'MOC',
};

export function getInventoryParamValue(item: InventoryItemOut, param: InventoryParam): string {
    switch (param) {
        case 'manufacturer': return item.manufacturer?.name ?? '';
        case 'supplier': return item.supplier?.name ?? '';
        case 'name': return item.name ?? '';
        case 'sku': return item.sku ?? '';
        case 'description': return item.description ?? '';
        case 'ean': return item.ean ?? '';
        case 'price': return item.price != null ? String(item.price) : '';
        case 'retail_price': return item.retail_price != null ? String(item.retail_price) : '';
    }
}

export interface TechFieldDef {
    id: number;
    name: string;
    type: 'text' | 'number' | 'date' | 'select';
    showInOverview: boolean;
    isMain: boolean;
    options?: string[];
    inventoryParam?: InventoryParam;
}

export interface AccessoryTypeDef {
    id: number;
    name: string;
    unit: string;
}

export interface TechTypeDef {
    id: number;
    name: string;
    color: string;
    fields: TechFieldDef[];
    accessoryTypes: AccessoryTypeDef[];
    elementCount: number;
}

export interface AccessoryInstance {
    typeId: number;
    typeName: string;
    quantity: number;
}

export interface TechElement {
    id: number;
    quantity: number;               // počet kusů tohoto prvku
    fields: Record<string, string>;
    accessories: AccessoryInstance[];
    inventoryItemId?: number;
    inventoryItemName?: string;
    inventoryItemSku?: string;
    inventoryItemManufacturer?: string;
    isMain?: boolean;
}

export interface TechInstance {
    id: number;
    techTypeId: number;
    techTypeName: string;
    color: string;
    elements: TechElement[];
}

export interface ObjectSite {
    id: number;
    name: string;
    address: string;
    city: string;
    zip: string;
    phone: string;
    customerId: number;
    customerName: string;
    contactPerson: string;
    contactEmail: string;
    technologies: TechInstance[];
}

// ─── API transformation helpers ───────────────────────────────────────────────

export function transformTechType(raw: any): TechTypeDef {
    return {
        id: raw.id,
        name: raw.name,
        color: raw.color,
        fields: (raw.fields || []).map((f: any): TechFieldDef => ({
            id: f.id,
            name: f.name,
            type: f.type,
            showInOverview: f.show_in_overview,
            isMain: f.is_main ?? false,
            options: f.options ?? undefined,
            inventoryParam: f.inventory_param ?? undefined,
        })),
        accessoryTypes: (raw.accessory_types || []).map((a: any): AccessoryTypeDef => ({
            id: a.id,
            name: a.name,
            unit: a.unit,
        })),
        elementCount: raw.element_count ?? 0,
    };
}

export function transformSite(raw: any): ObjectSite {
    return {
        id: raw.id,
        name: raw.name,
        address: raw.address || '',
        city: raw.city || '',
        zip: raw.zip || '',
        phone: raw.phone || '',
        customerId: raw.customer_id || 0,
        customerName: raw.customer_name || '',
        contactPerson: raw.contact_person || '',
        contactEmail: raw.contact_email || '',
        technologies: (raw.technologies || []).map((t: any): TechInstance => ({
            id: t.id,
            techTypeId: t.tech_type_id,
            techTypeName: t.tech_type?.name || '',
            color: t.tech_type?.color || 'bg-slate-600',
            elements: (t.elements || []).map((e: any): TechElement => ({
                id: e.id,
                quantity: e.quantity,
                fields: e.fields || {},
                accessories: e.accessories || [],
                inventoryItemId: e.inventory_item_id ?? undefined,
                inventoryItemName: e.inventory_item_name ?? undefined,
                inventoryItemSku: e.inventory_item_sku ?? undefined,
                inventoryItemManufacturer: e.inventory_item_manufacturer ?? undefined,
                isMain: e.is_main ?? false,
            })),
        })),
    };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _MOCK_TECH_TYPES_UNUSED: any[] = [
    {
        id: 1, name: 'CCTV', color: 'bg-blue-600',
        fields: [
            { id: 1, name: 'Výrobce', type: 'text', showInOverview: true },
            { id: 3, name: 'Instalace', type: 'date', showInOverview: true },
            { id: 4, name: 'Poslední revize', type: 'date', showInOverview: true },
            { id: 5, name: 'Plánovaná revize', type: 'text', showInOverview: true },
            { id: 6, name: 'Oživovatel', type: 'text', showInOverview: true },
            { id: 7, name: 'Model NVR', type: 'text', showInOverview: false },
            { id: 8, name: 'Napájení', type: 'select', showInOverview: false, options: ['PoE', '12V DC', '230V'] },
            { id: 9, name: 'Záznam', type: 'select', showInOverview: false, options: ['NVR', 'DVR', 'Cloud'] },
        ],
        accessoryTypes: [
            { id: 1, name: 'Baterie záložní', unit: 'ks' },
            { id: 2, name: 'Kryt', unit: 'ks' },
            { id: 3, name: 'Podstavec', unit: 'ks' },
        ],
    },
    {
        id: 2, name: 'PZTS', color: 'bg-red-600',
        fields: [
            { id: 10, name: 'Výrobce', type: 'text', showInOverview: true },
            { id: 12, name: 'Instalace', type: 'date', showInOverview: true },
            { id: 13, name: 'Poslední revize', type: 'date', showInOverview: true },
            { id: 14, name: 'Plánovaná revize', type: 'text', showInOverview: true },
            { id: 15, name: 'Oživovatel', type: 'text', showInOverview: true },
            { id: 16, name: 'Model ústředny', type: 'text', showInOverview: false },
            { id: 17, name: 'Počet zón', type: 'number', showInOverview: false },
        ],
        accessoryTypes: [
            { id: 4, name: 'Baterie záložní', unit: 'ks' },
            { id: 5, name: 'Kryt ústředny', unit: 'ks' },
            { id: 6, name: 'Napáječ', unit: 'ks' },
        ],
    },
    {
        id: 3, name: 'EKV', color: 'bg-emerald-600',
        fields: [
            { id: 18, name: 'Výrobce', type: 'text', showInOverview: true },
            { id: 20, name: 'Instalace', type: 'date', showInOverview: true },
            { id: 21, name: 'Poslední revize', type: 'date', showInOverview: true },
            { id: 22, name: 'Plánovaná revize', type: 'text', showInOverview: true },
            { id: 23, name: 'Oživovatel', type: 'text', showInOverview: true },
            { id: 24, name: 'Typ', type: 'select', showInOverview: false, options: ['Karta', 'PIN', 'Biometrie', 'Kombinovaný'] },
        ],
        accessoryTypes: [
            { id: 7, name: 'Baterie', unit: 'ks' },
            { id: 8, name: 'Montážní lišta', unit: 'ks' },
        ],
    },
    {
        id: 4, name: 'MZS', color: 'bg-orange-600',
        fields: [
            { id: 25, name: 'Výrobce', type: 'text', showInOverview: true },
            { id: 27, name: 'Instalace', type: 'date', showInOverview: true },
            { id: 28, name: 'Poslední revize', type: 'date', showInOverview: true },
            { id: 29, name: 'Plánovaná revize', type: 'text', showInOverview: true },
            { id: 30, name: 'Oživovatel', type: 'text', showInOverview: true },
            { id: 31, name: 'Model ústředny', type: 'text', showInOverview: false },
        ],
        accessoryTypes: [
            { id: 9, name: 'Baterie záložní', unit: 'ks' },
            { id: 10, name: 'Izolační patice', unit: 'ks' },
        ],
    },
    {
        id: 5, name: 'DT', color: 'bg-purple-600',
        fields: [
            { id: 32, name: 'Výrobce', type: 'text', showInOverview: true },
            { id: 34, name: 'Instalace', type: 'date', showInOverview: true },
            { id: 35, name: 'Poslední revize', type: 'date', showInOverview: true },
            { id: 36, name: 'Plánovaná revize', type: 'text', showInOverview: true },
            { id: 37, name: 'Oživovatel', type: 'text', showInOverview: true },
            { id: 38, name: 'Poznámka', type: 'text', showInOverview: false },
        ],
        accessoryTypes: [
            { id: 11, name: 'Baterie', unit: 'ks' },
            { id: 12, name: 'Podstavec', unit: 'ks' },
            { id: 13, name: 'Kryt', unit: 'ks' },
        ],
    },
    {
        id: 6, name: 'EPS', color: 'bg-yellow-500',
        fields: [
            { id: 39, name: 'Výrobce', type: 'text', showInOverview: true },
            { id: 41, name: 'Instalace', type: 'date', showInOverview: true },
            { id: 42, name: 'Poslední revize', type: 'date', showInOverview: true },
            { id: 43, name: 'Plánovaná revize', type: 'text', showInOverview: true },
            { id: 44, name: 'Oživovatel', type: 'text', showInOverview: true },
        ],
        accessoryTypes: [
            { id: 14, name: 'Baterie záložní', unit: 'ks' },
            { id: 15, name: 'Hlásič', unit: 'ks' },
        ],
    },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MOCK_OBJECTS_UNUSED: any[] = [
    {
        id: 1, name: 'ČSOB - Hroznova',
        address: 'Hroznova 13', city: 'České Budějovice', zip: '370 01',
        phone: '380 554 564', customerId: 1, customerName: 'ČSOB a.s',
        contactPerson: 'V.Ciboch', contactEmail: 'vciboch@csob.cz',
        technologies: [
            {
                id: 1, techTypeId: 1, techTypeName: 'CCTV', color: 'bg-blue-600',
                elements: [
                    {
                        id: 1, quantity: 16,
                        fields: { 'Výrobce': 'Hikvision', 'Instalace': '2020-01-16', 'Poslední revize': '2022-01-10', 'Plánovaná revize': '1/2025', 'Oživovatel': 'Franta Vopršálek', 'Model NVR': 'DS-7616NI-K2/16P', 'Napájení': 'PoE', 'Záznam': 'NVR' },
                        accessories: [{ typeId: 1, typeName: 'Baterie záložní', quantity: 2 }],
                    },
                ],
            },
            {
                id: 2, techTypeId: 2, techTypeName: 'PZTS', color: 'bg-red-600',
                elements: [
                    {
                        id: 2, quantity: 1,
                        fields: { 'Výrobce': 'Paradox', 'Instalace': '2020-01-16', 'Poslední revize': '2022-01-10', 'Plánovaná revize': '1/2025', 'Oživovatel': 'Franta Vopršálek', 'Model ústředny': 'GD264', 'Počet zón': '32' },
                        accessories: [{ typeId: 4, typeName: 'Baterie záložní', quantity: 1 }, { typeId: 5, typeName: 'Kryt ústředny', quantity: 1 }],
                    },
                    {
                        id: 3, quantity: 8,
                        fields: { 'Výrobce': 'Optex', 'Instalace': '2020-01-16', 'Poslední revize': '2022-01-10', 'Plánovaná revize': '1/2025', 'Oživovatel': 'Franta Vopršálek' },
                        accessories: [],
                    },
                ],
            },
        ],
    },
    {
        id: 2, name: 'Kaufland - Mánesova',
        address: 'Mánesova 49', city: 'České Budějovice', zip: '370 01',
        phone: '387 001 122', customerId: 2, customerName: 'Kaufland ČR v.o.s.',
        contactPerson: 'J.Novák', contactEmail: 'j.novak@kaufland.cz',
        technologies: [
            {
                id: 3, techTypeId: 1, techTypeName: 'CCTV', color: 'bg-blue-600',
                elements: [
                    { id: 4, quantity: 24, fields: { 'Výrobce': 'Hikvision', 'Instalace': '2021-06-01', 'Poslední revize': '2023-06-01', 'Plánovaná revize': '6/2025', 'Oživovatel': 'Pavel Novotný', 'Záznam': 'NVR' }, accessories: [] },
                    { id: 5, quantity: 8,  fields: { 'Výrobce': 'Hikvision', 'Instalace': '2021-06-01', 'Poslední revize': '2023-06-01', 'Plánovaná revize': '6/2025', 'Oživovatel': 'Pavel Novotný', 'Záznam': 'NVR' }, accessories: [] },
                ],
            },
        ],
    },
    {
        id: 3, name: 'Globus - Rudolfovská',
        address: 'Rudolfovská 134', city: 'České Budějovice', zip: '370 01',
        phone: '387 211 300', customerId: 3, customerName: 'Globus ČR k.s.',
        contactPerson: 'M.Procházka', contactEmail: 'm.prochazka@globus.cz',
        technologies: [],
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('cs-CZ'); } catch { return dateStr; }
};

const displayValue = (val: string, type: TechFieldDef['type']) =>
    type === 'date' ? formatDate(val) : val;

const emptyElement = (typeDef: TechTypeDef): TechElement => ({
    id: 0, // 0 = nový prvek (API přidělí ID)
    quantity: 1,
    fields: {},
    accessories: typeDef.accessoryTypes.map(at => ({ typeId: at.id, typeName: at.name, quantity: 0 })),
});

// ─── Inventory Picker Modal (real API) ────────────────────────────────────────

const InventoryPickerModal: React.FC<{
    companyId: number;
    currentId?: number;
    onClose: () => void;
    onSelect: (item: InventoryItemOut | null) => void;
}> = ({ companyId, currentId, onClose, onSelect }) => {
    const [items, setItems] = useState<InventoryItemOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const loadItems = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getInventoryItems(companyId);
            setItems(data);
        } catch {
            // ignore, show empty
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => { loadItems(); }, [loadItems]);

    const filtered = items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.sku.toLowerCase().includes(search.toLowerCase()) ||
        (i.manufacturer?.name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal title="Vybrat položku ze skladu" onClose={onClose}>
            <div className="mb-3 relative">
                <Icon name="fa-search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input
                    type="text"
                    autoFocus
                    placeholder="Hledat název, SKU, výrobce..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {loading && (
                    <div className="flex items-center justify-center py-10 text-slate-400">
                        <Icon name="fa-spinner fa-spin" className="mr-2" />
                        Načítám sklad...
                    </div>
                )}
                {!loading && filtered.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onSelect(item)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-3 ${currentId === item.id ? 'bg-blue-50' : ''}`}
                    >
                        <Icon name="fa-boxes-stacked" className="text-slate-400 text-sm flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                            <p className="text-xs text-slate-400">
                                {item.sku}
                                {item.manufacturer && <span> · {item.manufacturer.name}</span>}
                                <span className="ml-2 text-slate-300">|</span>
                                <span className="ml-2">Sklad: {item.total_quantity} ks</span>
                            </p>
                        </div>
                        {currentId === item.id && <Icon name="fa-check" className="text-blue-500 text-sm flex-shrink-0" />}
                    </button>
                ))}
                {!loading && filtered.length === 0 && (
                    <p className="text-center py-6 text-slate-400 text-sm">Nic nenalezeno</p>
                )}
            </div>

            <div className="flex justify-between mt-4">
                {currentId && (
                    <button onClick={() => onSelect(null)} className="text-sm text-red-500 hover:underline">
                        Odebrat propojení
                    </button>
                )}
                <Button variant="secondary" onClick={onClose} className="ml-auto">Zrušit</Button>
            </div>
        </Modal>
    );
};

// ─── Element Edit Modal ───────────────────────────────────────────────────────

const ElementEditModal: React.FC<{
    element: TechElement;
    typeDef: TechTypeDef;
    companyId: number;
    onClose: () => void;
    onSave: (updated: TechElement) => void;
}> = ({ element, typeDef, companyId, onClose, onSave }) => {
    const [quantity, setQuantity] = useState(element.quantity || 1);
    const [fields, setFields] = useState<Record<string, string>>({ ...element.fields });
    const [accessories, setAccessories] = useState<AccessoryInstance[]>(
        typeDef.accessoryTypes.map(at => {
            const ex = element.accessories.find(a => a.typeId === at.id);
            return { typeId: at.id, typeName: at.name, quantity: ex?.quantity ?? 0 };
        })
    );
    const [invItemId, setInvItemId] = useState<number | undefined>(element.inventoryItemId);
    const [invItemName, setInvItemName] = useState<string | undefined>(element.inventoryItemName);
    const [invItemSku, setInvItemSku] = useState<string | undefined>(element.inventoryItemSku);
    const [invItemManufacturer, setInvItemManufacturer] = useState<string | undefined>(element.inventoryItemManufacturer);
    const [isMain, setIsMain] = useState<boolean>(element.isMain ?? false);
    const [showPicker, setShowPicker] = useState(false);

    const handleSelectInventory = (item: InventoryItemOut | null) => {
        if (item) {
            setInvItemId(item.id);
            setInvItemName(item.name);
            setInvItemSku(item.sku);
            setInvItemManufacturer(item.manufacturer?.name);
            // auto-fill fields with inventoryParam mapping
            const autoFills: Record<string, string> = {};
            for (const field of typeDef.fields) {
                if (field.inventoryParam) {
                    const val = getInventoryParamValue(item, field.inventoryParam);
                    if (val) autoFills[field.name] = val;
                }
            }
            if (Object.keys(autoFills).length > 0) {
                setFields(prev => ({ ...prev, ...autoFills }));
            }
        } else {
            setInvItemId(undefined);
            setInvItemName(undefined);
            setInvItemSku(undefined);
            setInvItemManufacturer(undefined);
        }
        setShowPicker(false);
    };

    const handleSave = () => {
        onSave({ ...element, quantity, fields, accessories, inventoryItemId: invItemId, inventoryItemName: invItemName, inventoryItemSku: invItemSku, inventoryItemManufacturer: invItemManufacturer, isMain });
    };

    return (
        <>
            <Modal title="Upravit prvek" onClose={onClose}>
                <div className="space-y-5 mb-4">
                    {/* Quantity + Inventory link - top row */}
                    <div className="flex gap-4 items-start">
                        <div className="flex flex-col gap-1 w-32">
                            <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Počet (ks)</label>
                            <input
                                type="number"
                                min={1}
                                value={quantity}
                                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-slate-500 font-medium uppercase tracking-wide block mb-1">
                                <Icon name="fa-warehouse" className="mr-1 text-slate-400" />
                                Propojení se skladem
                            </label>
                            {invItemId ? (
                                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                    <Icon name="fa-boxes-stacked" className="text-blue-500 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{invItemName}</p>
                                        <p className="text-xs text-slate-400">{invItemSku}{invItemManufacturer && ` · ${invItemManufacturer}`}</p>
                                    </div>
                                    <button onClick={() => setShowPicker(true)} className="text-xs text-blue-600 hover:underline flex-shrink-0">Změnit</button>
                                    <button onClick={() => handleSelectInventory(null)} className="text-xs text-red-500 hover:underline flex-shrink-0">×</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowPicker(true)}
                                    className="w-full flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
                                >
                                    <Icon name="fa-link" />
                                    Propojit se skladovou položkou
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Hlavní prvek */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isMain}
                            onChange={e => setIsMain(e.target.checked)}
                            className="w-4 h-4 accent-red-600"
                        />
                        <span className="text-sm text-slate-700 font-medium">Hlavní prvek</span>
                        <span className="text-xs text-slate-400">(zobrazí se jako název v přehledu)</span>
                    </label>

                    {/* Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {typeDef.fields.map(field => (
                            <div key={field.id} className="flex flex-col gap-1">
                                <label className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">
                                    {field.name}
                                    {field.showInOverview && <Icon name="fa-eye" className="text-blue-400 text-xs" />}
                                </label>
                                {field.type === 'select' ? (
                                    <select
                                        value={fields[field.name] || ''}
                                        onChange={e => setFields(prev => ({ ...prev, [field.name]: e.target.value }))}
                                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    >
                                        <option value="">— vyberte —</option>
                                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                                        value={fields[field.name] || ''}
                                        onChange={e => setFields(prev => ({ ...prev, [field.name]: e.target.value }))}
                                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Accessories */}
                    {typeDef.accessoryTypes.length > 0 && (
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">
                                <Icon name="fa-puzzle-piece" className="mr-1 text-slate-400" />
                                Příslušenství
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {accessories.map((acc, i) => (
                                    <div key={acc.typeId} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                        <span className="text-sm text-slate-600">{acc.typeName}</span>
                                        <input
                                            type="number" min={0} value={acc.quantity}
                                            onChange={e => setAccessories(prev => prev.map((a, idx) => idx === i ? { ...a, quantity: parseInt(e.target.value) || 0 } : a))}
                                            className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                                        />
                                        <span className="text-xs text-slate-400">ks</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                    <Button onClick={handleSave}>Uložit</Button>
                </div>
            </Modal>

            {showPicker && (
                <InventoryPickerModal
                    companyId={companyId}
                    currentId={invItemId}
                    onClose={() => setShowPicker(false)}
                    onSelect={handleSelectInventory}
                />
            )}
        </>
    );
};

// ─── Overview table ───────────────────────────────────────────────────────────

// Fixed columns — "Počet" comes from element.quantity, others from fields
const OverviewTable: React.FC<{ obj: ObjectSite; techTypeDefs: TechTypeDef[] }> = ({ obj, techTypeDefs }) => {
    const hasAnyElements = obj.technologies.some(t => t.elements.length > 0);

    if (!hasAnyElements) {
        return <p className="text-slate-400 text-sm">Zatím žádné prvky. Přejděte na záložku technologie a přidejte prvek.</p>;
    }

    // Collect all unique showInOverview field names across tech types used in this object
    const overviewCols: string[] = [];
    obj.technologies.filter((t: TechInstance) => t.elements.length > 0).forEach((tech: TechInstance) => {
        const def = techTypeDefs.find((d: TechTypeDef) => d.id === tech.techTypeId);
        def?.fields.filter((f: TechFieldDef) => f.showInOverview).forEach((f: TechFieldDef) => {
            if (!overviewCols.includes(f.name)) overviewCols.push(f.name);
        });
    });

    const grandTotal = obj.technologies.reduce((sum, t) => sum + t.elements.reduce((s, e) => s + e.quantity, 0), 0);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="border-b-2 border-slate-200">
                        {['Technologie', ...overviewCols, 'Výrobce', 'Počet'].map(col => (
                            <th key={col} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {obj.technologies.filter(t => t.elements.length > 0).map(tech => {
                        const def = techTypeDefs.find(d => d.id === tech.techTypeId);
                        const mainEl = tech.elements.find(e => e.isMain) ?? null;
                        const totalQty = tech.elements.reduce((s, e) => s + e.quantity, 0);

                        return (
                            <tr key={tech.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                {/* Technologie */}
                                <td className="px-3 py-2">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-white text-xs font-semibold ${tech.color}`}>
                                        {tech.techTypeName}
                                    </span>
                                </td>
                                {/* Dynamické overview fields – z hlavního prvku */}
                                {overviewCols.map(col => {
                                    const fd = def?.fields.find((f: TechFieldDef) => f.name === col);
                                    const val = mainEl?.fields[col] || '';
                                    return (
                                        <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                                            {fd ? displayValue(val, fd.type) : (val || <span className="text-slate-300 text-xs">—</span>)}
                                        </td>
                                    );
                                })}
                                {/* Výrobce – z hlavního prvku */}
                                <td className="px-3 py-2 text-slate-700">
                                    {mainEl ? (mainEl.inventoryItemManufacturer || mainEl.fields['Výrobce'] || '') : ''}
                                </td>
                                {/* Celkový počet */}
                                <td className="px-3 py-2">
                                    <span className="font-semibold text-slate-800">{totalQty}</span>
                                    <span className="text-slate-400 text-xs ml-1">ks</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase" colSpan={overviewCols.length + 2}>Celkem prvků</td>
                        <td className="px-3 py-2">
                            <span className="font-bold text-slate-800">{grandTotal}</span>
                            <span className="text-slate-400 text-xs ml-1">ks</span>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

// ─── Tech Detail Tab ──────────────────────────────────────────────────────────

const TechDetailTab: React.FC<{
    tech: TechInstance;
    typeDef: TechTypeDef | undefined;
    companyId: number;
    siteId: number;
    onRefresh: () => Promise<void>;
}> = ({ tech, typeDef, companyId, siteId, onRefresh }) => {
    const [editingElement, setEditingElement] = useState<TechElement | null>(null);
    const [saving, setSaving] = useState(false);

    if (!typeDef) return <p className="text-slate-500">Definice technologie nenalezena.</p>;

    const toApiPayload = (el: TechElement) => ({
        quantity: el.quantity,
        fields: el.fields,
        accessories: el.accessories,
        inventory_item_id: el.inventoryItemId ?? null,
        inventory_item_name: el.inventoryItemName ?? null,
        inventory_item_sku: el.inventoryItemSku ?? null,
        inventory_item_manufacturer: el.inventoryItemManufacturer ?? null,
        is_main: el.isMain ?? false,
    });

    const handleSaveElement = async (updated: TechElement) => {
        setSaving(true);
        try {
            if (updated.id === 0) {
                await api.createObjectElement(companyId, siteId, tech.id, toApiPayload(updated));
            } else {
                await api.updateObjectElement(companyId, siteId, tech.id, updated.id, toApiPayload(updated));
            }
            await onRefresh();
            setEditingElement(null);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteElement = async (elementId: number) => {
        if (!confirm('Smazat tento prvek?')) return;
        setSaving(true);
        try {
            await api.deleteObjectElement(companyId, siteId, tech.id, elementId);
            await onRefresh();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const totalQty = tech.elements.reduce((s, e) => s + e.quantity, 0);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">
                    Celkem: <span className="font-semibold text-slate-800">{totalQty} ks</span> v {tech.elements.length} prvcích
                </p>
                <Button onClick={() => setEditingElement(emptyElement(typeDef))} disabled={saving}>
                    <Icon name="fa-plus" className="mr-2" />
                    Přidat prvek
                </Button>
            </div>

            <div className="space-y-4">
                {tech.elements.map((el, idx) => (
                    <div key={el.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Header */}
                        <div className={`px-4 py-2 flex items-center justify-between ${tech.color} text-white`}>
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Quantity badge */}
                                <span className="flex items-center gap-1.5 bg-white/20 px-2.5 py-0.5 rounded-full text-sm font-bold whitespace-nowrap">
                                    {el.quantity}×
                                </span>
                                {el.inventoryItemId ? (
                                    <span className="flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded text-xs truncate">
                                        <Icon name="fa-warehouse" className="text-xs flex-shrink-0" />
                                        <span className="truncate">{el.inventoryItemName}</span>
                                        <span className="opacity-70 whitespace-nowrap">({el.inventoryItemSku})</span>
                                    </span>
                                ) : (
                                    <span className="text-white/60 text-xs">Prvek {idx + 1}</span>
                                )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0 ml-2">
                                <button
                                    onClick={() => setEditingElement(el)}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm transition-colors"
                                >
                                    <Icon name="fa-edit" className="text-xs" />
                                    Upravit
                                </button>
                                <button
                                    onClick={() => handleDeleteElement(el.id)}
                                    disabled={saving}
                                    className="px-2 py-1 bg-white/10 hover:bg-red-500/40 rounded-md text-sm transition-colors"
                                    title="Smazat prvek"
                                >
                                    <Icon name="fa-trash" className="text-xs" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            {/* Overview fields */}
                            <div className="mb-3">
                                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2 flex items-center gap-1">
                                    <Icon name="fa-eye" className="text-blue-400" />
                                    V přehledu
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-2">
                                    {typeDef.fields.filter(f => f.showInOverview).map(field => (
                                        <div key={field.id} className="flex flex-col">
                                            <span className="text-xs text-slate-400">{field.name}</span>
                                            <span className="text-slate-800 font-medium text-sm">
                                                {displayValue(el.fields[field.name] || '', field.type) || <span className="text-slate-300">—</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Other fields */}
                            {typeDef.fields.some(f => !f.showInOverview) && (
                                <div className="pt-3 border-t border-slate-100">
                                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Ostatní údaje</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-2">
                                        {typeDef.fields.filter(f => !f.showInOverview).map(field => (
                                            <div key={field.id} className="flex flex-col">
                                                <span className="text-xs text-slate-400">{field.name}</span>
                                                <span className="text-slate-700 text-sm">
                                                    {displayValue(el.fields[field.name] || '', field.type) || <span className="text-slate-300">—</span>}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Accessories */}
                            {el.accessories.some(a => a.quantity > 0) && (
                                <div className="pt-3 border-t border-slate-100 mt-3">
                                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Příslušenství</p>
                                    <div className="flex flex-wrap gap-2">
                                        {el.accessories.filter(a => a.quantity > 0).map(acc => (
                                            <div key={acc.typeId} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                                                <Icon name="fa-puzzle-piece" className="text-slate-400 text-xs" />
                                                <span className="text-slate-600 text-sm">{acc.typeName}</span>
                                                <span className="font-bold text-sm text-slate-800">{acc.quantity}×</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {tech.elements.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                        <Icon name="fa-layer-group" className="text-3xl mb-2" />
                        <p className="text-sm">Žádné prvky. Klikněte na "Přidat prvek".</p>
                    </div>
                )}
            </div>

            {editingElement && (
                <ElementEditModal
                    element={editingElement}
                    typeDef={typeDef}
                    companyId={companyId}
                    onClose={() => setEditingElement(null)}
                    onSave={handleSaveElement}
                />
            )}
        </div>
    );
};

// ─── Edit Object Modal ────────────────────────────────────────────────────────

const EditObjectModal: React.FC<{
    obj: ObjectSite;
    clients: ClientOut[];
    techTypeDefs: TechTypeDef[];
    onClose: () => void;
    onSave: (updated: ObjectSite) => void;
}> = ({ obj, clients, techTypeDefs, onClose, onSave }) => {
    const [form, setForm] = useState({ ...obj });
    const [tab, setTab] = useState<'info' | 'tech'>('info');

    const hasTech = (typeId: number) => form.technologies.some(t => t.techTypeId === typeId);

    const toggleTech = (typeDef: TechTypeDef) => {
        if (hasTech(typeDef.id)) {
            setForm(prev => ({ ...prev, technologies: prev.technologies.filter(t => t.techTypeId !== typeDef.id) }));
        } else {
            const newTech: TechInstance = { id: Date.now(), techTypeId: typeDef.id, techTypeName: typeDef.name, color: typeDef.color, elements: [] };
            setForm(prev => ({ ...prev, technologies: [...prev.technologies, newTech] }));
        }
    };

    const tf = (label: string, key: keyof ObjectSite, type = 'text') => (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</label>
            <input type={type} value={(form[key] as string) || ''}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
    );

    return (
        <Modal title="Upravit objekt" onClose={onClose}>
            <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setTab('info')} className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === 'info' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}>
                    <Icon name="fa-info-circle" className="mr-1.5" />Základní info
                </button>
                <button onClick={() => setTab('tech')} className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === 'tech' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}>
                    <Icon name="fa-layer-group" className="mr-1.5" />Technologie
                </button>
            </div>

            {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {tf('Název objektu', 'name')}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Zákazník</label>
                        <select value={form.customerId || ''}
                            onChange={e => { const c = clients.find(x => x.id === parseInt(e.target.value)); setForm(prev => ({ ...prev, customerId: c?.id ?? 0, customerName: c?.name ?? '' })); }}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                            <option value="">— vyberte zákazníka —</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    {tf('Ulice a čp.', 'address')}
                    {tf('Město', 'city')}
                    {tf('PSČ', 'zip')}
                    {tf('Telefon', 'phone', 'tel')}
                    {tf('Kontaktní osoba', 'contactPerson')}
                    {tf('E-mail kontaktu', 'contactEmail', 'email')}
                </div>
            )}

            {tab === 'tech' && (
                <div className="mb-6">
                    <p className="text-sm text-slate-500 mb-4">Zaškrtněte technologie instalované na objektu.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {techTypeDefs.map(tt => {
                            const active = hasTech(tt.id);
                            return (
                                <label key={tt.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${active ? 'border-slate-300' : 'border-slate-200 hover:border-slate-300'}`}>
                                    <input type="checkbox" className="sr-only" checked={active} onChange={() => toggleTech(tt)} />
                                    <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${active ? tt.color : 'bg-slate-200'}`}>
                                        {active && <Icon name="fa-check" className="text-white text-xs" />}
                                    </span>
                                    <span className={`font-semibold text-sm ${active ? 'text-slate-800' : 'text-slate-500'}`}>{tt.name}</span>
                                    {active && (
                                        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded text-white ${tt.color}`}>
                                            {form.technologies.find(t => t.techTypeId === tt.id)?.elements.length ?? 0} prvků
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                <Button onClick={() => onSave(form)}>Uložit</Button>
            </div>
        </Modal>
    );
};

// ─── New Object Modal ─────────────────────────────────────────────────────────

const NewObjectModal: React.FC<{
    clients: ClientOut[];
    onClose: () => void;
    onSave: (data: Partial<ObjectSite>) => void;
}> = ({ clients, onClose, onSave }) => {
    const [form, setForm] = useState<Partial<ObjectSite>>({});

    const tf = (label: string, key: keyof ObjectSite, type = 'text') => (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</label>
            <input type={type} value={(form[key] as string) || ''}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
    );

    return (
        <Modal title="Nový objekt" onClose={onClose}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {tf('Název objektu', 'name')}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Zákazník</label>
                    <select value={form.customerId || ''}
                        onChange={e => { const c = clients.find(x => x.id === parseInt(e.target.value)); setForm(prev => ({ ...prev, customerId: c?.id ?? 0, customerName: c?.name ?? '' })); }}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">— vyberte zákazníka —</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                {tf('Ulice a čp.', 'address')}
                {tf('Město', 'city')}
                {tf('PSČ', 'zip')}
                {tf('Telefon', 'phone', 'tel')}
                {tf('Kontaktní osoba', 'contactPerson')}
                {tf('E-mail kontaktu', 'contactEmail', 'email')}
            </div>
            <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                <Button onClick={() => onSave(form)}>Vytvořit objekt</Button>
            </div>
        </Modal>
    );
};

// ─── Work Orders Modal ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    new: 'Nová',
    in_progress: 'Probíhá',
    completed: 'Dokončena',
    billed: 'Fakturována',
};

const STATUS_COLOR: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
    billed: 'bg-purple-100 text-purple-800',
};

const WorkOrdersModal: React.FC<{
    companyId: number;
    siteId: number;
    onClose: () => void;
    onOpenWorkOrder?: (workOrderId: number) => void;
}> = ({ companyId, siteId, onClose, onOpenWorkOrder }) => {
    const [workOrders, setWorkOrders] = useState<WorkOrderOut[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getWorkOrders(companyId)
            .then(all => setWorkOrders(all.filter(wo => wo.object_id === siteId)))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [companyId, siteId]);

    return (
        <Modal title="Zakázky objektu" onClose={onClose}>
            {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                    <Icon name="fa-spinner fa-spin" className="mr-2" />
                    Načítám zakázky...
                </div>
            ) : workOrders.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <Icon name="fa-briefcase" className="text-3xl mb-2" />
                    <p className="text-sm">Žádné zakázky pro tento objekt</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {workOrders.map(wo => (
                        <button
                            key={wo.id}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
                            onClick={() => { onOpenWorkOrder?.(wo.id); onClose(); }}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{wo.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {wo.tasks.length} {wo.tasks.length === 1 ? 'úkol' : wo.tasks.length < 5 ? 'úkoly' : 'úkolů'}
                                    {wo.client && <span> · {wo.client.name}</span>}
                                </p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLOR[wo.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                {STATUS_LABEL[wo.status] ?? wo.status}
                            </span>
                            <Icon name="fa-chevron-right" className="text-slate-400 text-xs flex-shrink-0" />
                        </button>
                    ))}
                </div>
            )}
            <div className="flex justify-end mt-4">
                <Button variant="secondary" onClick={onClose}>Zavřít</Button>
            </div>
        </Modal>
    );
};

// ─── Service Sheets Modal ─────────────────────────────────────────────────────

const ServiceSheetsModal: React.FC<{
    companyId: number;
    siteId: number;
    onClose: () => void;
    onOpenWorkOrder?: (workOrderId: number) => void;
}> = ({ companyId, siteId, onClose, onOpenWorkOrder }) => {
    const [reports, setReports] = useState<ServiceReportOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingReport, setEditingReport] = useState<ServiceReportOut | null>(null);

    const loadReports = useCallback(() => {
        setLoading(true);
        api.getServiceReports(companyId, { object_id: siteId })
            .then(setReports)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [companyId, siteId]);

    useEffect(() => { loadReports(); }, [loadReports]);

    if (editingReport) {
        return (
            <Modal
                title={`Servisní list #${editingReport.id} – ${editingReport.task_name ?? ''}`}
                onClose={() => setEditingReport(null)}
            >
                <ServiceReportForm
                    existingReport={editingReport}
                    onSave={(_report, _saved) => {
                        setEditingReport(null);
                        loadReports();
                    }}
                />
            </Modal>
        );
    }

    return (
        <Modal title="Servisní listy objektu" onClose={onClose}>
            {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                    <Icon name="fa-spinner fa-spin" className="mr-2" />
                    Načítám servisní listy...
                </div>
            ) : reports.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <Icon name="fa-file-alt" className="text-3xl mb-2" />
                    <p className="text-sm">Žádné servisní listy pro tento objekt</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {reports.map(sr => (
                        <div key={sr.id} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition-colors">
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 truncate">
                                    {sr.task_name ?? `Servisní list #${sr.id}`}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {new Date(sr.date).toLocaleDateString('cs-CZ')}
                                    {sr.work_order_name && <span> · {sr.work_order_name}</span>}
                                    {sr.technicians.length > 0 && <span> · {sr.technicians.join(', ')}</span>}
                                </p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-slate-100 text-slate-600 flex-shrink-0">
                                {sr.work_hours} h
                            </span>
                            <button
                                onClick={() => setEditingReport(sr)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
                                title="Upravit servisní list"
                            >
                                <Icon name="fa-edit" className="text-sm" />
                            </button>
                            {onOpenWorkOrder && (
                                <button
                                    onClick={() => { onOpenWorkOrder(sr.work_order_id); onClose(); }}
                                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
                                    title="Otevřít zakázku"
                                >
                                    <Icon name="fa-external-link-alt" className="text-sm" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <div className="flex justify-end mt-4">
                <Button variant="secondary" onClick={onClose}>Zavřít</Button>
            </div>
        </Modal>
    );
};

// ─── Object Detail ────────────────────────────────────────────────────────────

const ObjectDetail: React.FC<{
    siteId: number;
    techTypeDefs: TechTypeDef[];
    clients: ClientOut[];
    companyId: number;
    onBack: () => void;
    onSiteUpdated: (site: ObjectSite) => void;
    onOpenWorkOrder?: (workOrderId: number) => void;
}> = ({ siteId, techTypeDefs, clients, companyId, onBack, onSiteUpdated, onOpenWorkOrder }) => {
    const [site, setSite] = useState<ObjectSite | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('overview');
    const [editOpen, setEditOpen] = useState(false);
    const [workOrdersOpen, setWorkOrdersOpen] = useState(false);
    const [serviceSheetsOpen, setServiceSheetsOpen] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const raw = await api.getObjectSite(companyId, siteId);
            const s = transformSite(raw);
            setSite(s);
            onSiteUpdated(s);
        } catch (err) {
            console.error(err);
        }
    }, [companyId, siteId, onSiteUpdated]);

    useEffect(() => {
        setLoading(true);
        refresh().finally(() => setLoading(false));
    }, [refresh]);

    if (loading || !site) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Icon name="fa-spinner fa-spin" className="mr-3 text-2xl" />
                Načítám kartu objektu...
            </div>
        );
    }

    const handleEditSave = async (updated: ObjectSite) => {
        try {
            await api.updateObjectSite(companyId, site.id, {
                name: updated.name,
                address: updated.address,
                city: updated.city,
                zip: updated.zip,
                phone: updated.phone,
                customer_id: updated.customerId || null,
                contact_person: updated.contactPerson,
                contact_email: updated.contactEmail,
            });
            // Add newly toggled technologies
            const existingTypeIds = new Set(site.technologies.map(t => t.techTypeId));
            for (const tech of updated.technologies) {
                if (!existingTypeIds.has(tech.techTypeId)) {
                    await api.addObjectTechnology(companyId, site.id, tech.techTypeId);
                }
            }
            // Remove unchecked technologies
            const updatedTypeIds = new Set(updated.technologies.map(t => t.techTypeId));
            for (const tech of site.technologies) {
                if (!updatedTypeIds.has(tech.techTypeId)) {
                    await api.removeObjectTechnology(companyId, site.id, tech.id);
                }
            }
            await refresh();
            setEditOpen(false);
        } catch (err) {
            console.error(err);
        }
    };

    const tabs = [
        { key: 'overview', label: 'Přehled' },
        ...site.technologies.map(t => ({ key: `tech_${t.id}`, label: t.techTypeName, color: t.color })),
    ];

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors">
                    <Icon name="fa-arrow-left" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">{site.name}</h1>
                    <p className="text-sm text-slate-500">Karta objektu</p>
                </div>
                <Button variant="secondary" onClick={() => setServiceSheetsOpen(true)}>
                    <Icon name="fa-file-alt" className="mr-2" />
                    Servisní listy
                </Button>
                <Button variant="secondary" onClick={() => setWorkOrdersOpen(true)}>
                    <Icon name="fa-briefcase" className="mr-2" />
                    Zakázky
                </Button>
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    <Icon name="fa-edit" className="mr-2" />
                    Upravit objekt
                </Button>
            </div>

            <Card className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Adresa</p>
                        <p className="text-slate-700 font-medium">{site.address}, {site.city}, {site.zip}</p>
                        <p className="text-slate-600 mt-1"><Icon name="fa-phone" className="mr-1 text-slate-400" />{site.phone}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Zákazník</p>
                        <p className="text-slate-700 font-semibold">{site.customerName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Kontaktní osoba</p>
                        <p className="text-slate-700 font-medium">{site.contactPerson}</p>
                        <a href={`mailto:${site.contactEmail}`} className="text-blue-500 hover:underline text-sm">{site.contactEmail}</a>
                    </div>
                </div>
            </Card>

            <div className="flex gap-1 flex-wrap mb-4 bg-slate-200 p-1 rounded-lg">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${activeTab === tab.key ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            <Card>
                {activeTab === 'overview' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-700">Přehled instalovaných technologií</h3>
                            <div className="flex gap-1 flex-wrap">
                                {site.technologies.map(t => (
                                    <span key={t.id} className={`text-xs px-2 py-0.5 rounded text-white ${t.color}`}>{t.techTypeName}</span>
                                ))}
                            </div>
                        </div>
                        <OverviewTable obj={site} techTypeDefs={techTypeDefs} />
                    </div>
                )}
                {site.technologies.map(tech => {
                    const def = techTypeDefs.find(d => d.id === tech.techTypeId);
                    return activeTab === `tech_${tech.id}` ? (
                        <TechDetailTab key={tech.id} tech={tech} typeDef={def} companyId={companyId} siteId={site.id} onRefresh={refresh} />
                    ) : null;
                })}
            </Card>

            {editOpen && (
                <EditObjectModal obj={site} clients={clients} techTypeDefs={techTypeDefs}
                    onClose={() => setEditOpen(false)}
                    onSave={handleEditSave} />
            )}
            {workOrdersOpen && (
                <WorkOrdersModal
                    companyId={companyId}
                    siteId={site.id}
                    onClose={() => setWorkOrdersOpen(false)}
                    onOpenWorkOrder={onOpenWorkOrder}
                />
            )}
            {serviceSheetsOpen && (
                <ServiceSheetsModal
                    companyId={companyId}
                    siteId={site.id}
                    onClose={() => setServiceSheetsOpen(false)}
                    onOpenWorkOrder={onOpenWorkOrder}
                />
            )}
        </div>
    );
};

// ─── Main Plugin ──────────────────────────────────────────────────────────────

interface ObjectsPluginProps {
    companyId: number;
    onOpenWorkOrder?: (workOrderId: number) => void;
}

const ObjectsPlugin: React.FC<ObjectsPluginProps> = ({ companyId, onOpenWorkOrder }) => {
    const [sites, setSites] = useState<ObjectSite[]>([]);
    const [techTypeDefs, setTechTypeDefs] = useState<TechTypeDef[]>([]);
    const [clients, setClients] = useState<ClientOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
    const [isNewOpen, setIsNewOpen] = useState(false);
    const [search, setSearch] = useState('');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [rawSites, rawTypes, clientsData] = await Promise.all([
                api.getObjectSites(companyId),
                api.getObjectTechTypes(companyId),
                api.getClients(companyId),
            ]);
            setSites(rawSites.map(transformSite));
            setTechTypeDefs(rawTypes.map(transformTechType));
            setClients(clientsData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCreate = async (data: Partial<ObjectSite>) => {
        try {
            const raw = await api.createObjectSite(companyId, {
                name: data.name,
                address: data.address,
                city: data.city,
                zip: data.zip,
                phone: data.phone,
                customer_id: data.customerId || null,
                contact_person: data.contactPerson,
                contact_email: data.contactEmail,
            });
            const newSite = transformSite(raw);
            setSites(prev => [...prev, newSite]);
            setIsNewOpen(false);
            setSelectedSiteId(newSite.id);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSiteUpdated = useCallback((updated: ObjectSite) => {
        setSites(prev => prev.map(s => s.id === updated.id ? updated : s));
    }, []);

    const handleDelete = async (id: number) => {
        if (!window.confirm('Opravdu smazat tento objekt? Tato akce je nevratná.')) return;
        try {
            await api.deleteObjectSite(companyId, id);
            setSites(prev => prev.filter(s => s.id !== id));
        } catch (err) { console.error(err); }
    };

    const filtered = sites.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.customerName.toLowerCase().includes(search.toLowerCase()) ||
        o.city.toLowerCase().includes(search.toLowerCase())
    );

    if (selectedSiteId !== null) {
        return (
            <div className="p-8">
                <ObjectDetail
                    siteId={selectedSiteId}
                    techTypeDefs={techTypeDefs}
                    clients={clients}
                    companyId={companyId}
                    onBack={() => setSelectedSiteId(null)}
                    onSiteUpdated={handleSiteUpdated}
                    onOpenWorkOrder={onOpenWorkOrder}
                />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center py-20 text-slate-400">
                <Icon name="fa-spinner fa-spin" className="mr-3 text-2xl" />
                Načítám objekty...
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Objekty</h1>
                    <p className="text-slate-500 mt-1">Správa objektů a instalovaných technologií</p>
                </div>
                <Button onClick={() => setIsNewOpen(true)}>
                    <Icon name="fa-plus" className="mr-2" />
                    Přidat objekt
                </Button>
            </div>

            <div className="mb-4 relative">
                <Icon name="fa-search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input type="text" placeholder="Hledat objekt, zákazníka, město..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(obj => (
                    <div key={obj.id}
                        className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-red-200 transition-all duration-200 cursor-pointer group"
                        onClick={() => setSelectedSiteId(obj.id)}>
                        <div className="p-4 border-b border-slate-100 flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-slate-800 group-hover:text-red-600 transition-colors">{obj.name}</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{obj.customerName}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(obj.id); }}
                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                    title="Smazat objekt"
                                >
                                    <Icon name="fa-trash" className="text-sm" />
                                </button>
                                <Icon name="fa-building" className="text-slate-300 group-hover:text-red-300 transition-colors text-xl mt-1" />
                            </div>
                        </div>
                        <div className="p-4 space-y-1.5 text-sm text-slate-600">
                            <p><Icon name="fa-map-marker-alt" className="mr-2 text-slate-400 w-4" />{obj.address}, {obj.city}</p>
                            <p><Icon name="fa-phone" className="mr-2 text-slate-400 w-4" />{obj.phone}</p>
                            <p><Icon name="fa-user" className="mr-2 text-slate-400 w-4" />{obj.contactPerson}</p>
                        </div>
                        <div className="px-4 pb-4 flex flex-wrap gap-1">
                            {obj.technologies.length > 0
                                ? obj.technologies.map(t => (
                                    <span key={t.id} className={`text-xs px-2 py-0.5 rounded text-white font-medium ${t.color}`}>
                                        {t.techTypeName} ({t.elements.reduce((s, e) => s + e.quantity, 0)})
                                    </span>
                                ))
                                : <span className="text-xs text-slate-400">Bez technologií</span>
                            }
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && !loading && (
                <div className="text-center py-16 text-slate-400">
                    <Icon name="fa-building" className="text-4xl mb-3" />
                    <p>{search ? 'Žádné objekty nenalezeny' : 'Žádné objekty. Přidejte první objekt.'}</p>
                </div>
            )}

            {isNewOpen && (
                <NewObjectModal clients={clients} onClose={() => setIsNewOpen(false)} onSave={handleCreate} />
            )}
        </div>
    );
};

export default ObjectsPlugin;
