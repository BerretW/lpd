import React, { useState, useEffect, useCallback } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Icon from '../common/Icon';
import { TechTypeDef, TechFieldDef, AccessoryTypeDef, InventoryParam, INVENTORY_PARAM_LABELS, transformTechType } from './ObjectsPlugin';
import * as api from '../../api';

// ─── Field form ───────────────────────────────────────────────────────────────

const FieldForm: React.FC<{
    field: Partial<TechFieldDef> | null;
    onClose: () => void;
    onSave: (data: Partial<TechFieldDef>) => void;
}> = ({ field, onClose, onSave }) => {
    const [form, setForm] = useState<Partial<TechFieldDef>>(field || { type: 'text', showInOverview: false });
    const [optionInput, setOptionInput] = useState('');

    return (
        <Modal title={field?.id ? 'Upravit pole' : 'Nové pole'} onClose={onClose}>
            <div className="space-y-4 mb-6">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Název pole</label>
                    <input
                        type="text"
                        value={form.name || ''}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="např. Model, Datum instalace..."
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Typ hodnoty</label>
                    <select
                        value={form.type || 'text'}
                        onChange={e => setForm(prev => ({ ...prev, type: e.target.value as TechFieldDef['type'] }))}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        <option value="text">Text</option>
                        <option value="number">Číslo</option>
                        <option value="date">Datum</option>
                        <option value="select">Výběr z možností</option>
                    </select>
                </div>
                {form.type === 'select' && (
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Možnosti</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={optionInput}
                                onChange={e => setOptionInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && optionInput.trim()) {
                                        setForm(prev => ({ ...prev, options: [...(prev.options || []), optionInput.trim()] }));
                                        setOptionInput('');
                                    }
                                }}
                                placeholder="Přidat možnost a stisknout Enter"
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {(form.options || []).map((opt, i) => (
                                <span key={i} className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded text-sm">
                                    {opt}
                                    <button
                                        onClick={() => setForm(prev => ({ ...prev, options: prev.options?.filter((_, idx) => idx !== i) }))}
                                        className="text-slate-400 hover:text-red-500"
                                    >
                                        <Icon name="fa-times" className="text-xs" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Automatické vyplnění ze skladu</label>
                    <select
                        value={form.inventoryParam || ''}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: Partial<TechFieldDef>) => ({ ...prev, inventoryParam: (e.target.value as InventoryParam) || undefined }))}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        <option value="">— nevyplňovat —</option>
                        {(Object.entries(INVENTORY_PARAM_LABELS) as [InventoryParam, string][]).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    <p className="text-xs text-slate-400">Při výběru položky ze skladu se toto pole automaticky vyplní zvolenou hodnotou.</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                    <div
                        onClick={() => setForm(prev => ({ ...prev, showInOverview: !prev.showInOverview }))}
                        className={`w-10 h-6 rounded-full transition-colors relative ${form.showInOverview ? 'bg-red-600' : 'bg-slate-300'}`}
                    >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.showInOverview ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                    <span className="text-sm text-slate-700">Zobrazovat v přehledu objektu</span>
                </label>
            </div>
            <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                <Button onClick={() => onSave(form)} disabled={!form.name}>Uložit</Button>
            </div>
        </Modal>
    );
};

// ─── Accessory type form ──────────────────────────────────────────────────────

const AccessoryForm: React.FC<{
    acc: Partial<AccessoryTypeDef> | null;
    onClose: () => void;
    onSave: (data: Partial<AccessoryTypeDef>) => void;
}> = ({ acc, onClose, onSave }) => {
    const [form, setForm] = useState<Partial<AccessoryTypeDef>>(acc || { unit: 'ks' });

    return (
        <Modal title={acc?.id ? 'Upravit typ příslušenství' : 'Nový typ příslušenství'} onClose={onClose}>
            <div className="space-y-4 mb-6">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Název</label>
                    <input
                        type="text"
                        value={form.name || ''}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="např. Baterie záložní, Kryt, Podstavec..."
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Jednotka</label>
                    <input
                        type="text"
                        value={form.unit || ''}
                        onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                        placeholder="ks"
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                </div>
            </div>
            <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                <Button onClick={() => onSave(form)} disabled={!form.name}>Uložit</Button>
            </div>
        </Modal>
    );
};

// ─── Tech type form ───────────────────────────────────────────────────────────

const TechTypeForm: React.FC<{
    techType: Partial<TechTypeDef> | null;
    onClose: () => void;
    onSave: (data: Partial<TechTypeDef>) => void;
}> = ({ techType, onClose, onSave }) => {
    const [form, setForm] = useState<Partial<TechTypeDef>>(techType || { color: 'bg-blue-600', fields: [], accessoryTypes: [] });

    const COLORS = [
        { label: 'Modrá', value: 'bg-blue-600' },
        { label: 'Červená', value: 'bg-red-600' },
        { label: 'Zelená', value: 'bg-emerald-600' },
        { label: 'Oranžová', value: 'bg-orange-600' },
        { label: 'Fialová', value: 'bg-purple-600' },
        { label: 'Šedá', value: 'bg-slate-600' },
        { label: 'Žlutá', value: 'bg-yellow-500' },
        { label: 'Tyrkysová', value: 'bg-teal-600' },
    ];

    return (
        <Modal title={techType?.id ? 'Upravit technologii' : 'Nová technologie'} onClose={onClose}>
            <div className="space-y-4 mb-6">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Název technologie</label>
                    <input
                        type="text"
                        value={form.name || ''}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="např. CCTV, PZTS, EKV..."
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide">Barva štítku</label>
                    <div className="flex flex-wrap gap-2">
                        {COLORS.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setForm(prev => ({ ...prev, color: c.value }))}
                                className={`w-8 h-8 rounded-lg ${c.value} transition-transform ${form.color === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                                title={c.label}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                <Button onClick={() => onSave(form)} disabled={!form.name}>Vytvořit</Button>
            </div>
        </Modal>
    );
};

// ─── Tech type detail / editor ────────────────────────────────────────────────

const TechTypeEditor: React.FC<{
    techType: TechTypeDef;
    companyId: number;
    onRefresh: () => Promise<void>;
    onBack: () => void;
}> = ({ techType, companyId, onRefresh, onBack }) => {
    const [fieldModal, setFieldModal] = useState<{ open: boolean; editing: Partial<TechFieldDef> | null }>({ open: false, editing: null });
    const [accModal, setAccModal] = useState<{ open: boolean; editing: Partial<AccessoryTypeDef> | null }>({ open: false, editing: null });

    const toFieldPayload = (data: Partial<TechFieldDef>) => ({
        name: data.name,
        type: data.type,
        show_in_overview: data.showInOverview ?? false,
        options: data.options ?? null,
        inventory_param: data.inventoryParam ?? null,
        sort_order: 0,
    });

    const saveField = async (data: Partial<TechFieldDef>) => {
        try {
            if (data.id) {
                await api.updateObjectTechField(companyId, techType.id, data.id, toFieldPayload(data));
            } else {
                await api.createObjectTechField(companyId, techType.id, toFieldPayload(data));
            }
            await onRefresh();
            setFieldModal({ open: false, editing: null });
        } catch (err) { console.error(err); }
    };

    const deleteField = async (id: number) => {
        try {
            await api.deleteObjectTechField(companyId, techType.id, id);
            await onRefresh();
        } catch (err) { console.error(err); }
    };

    const saveAcc = async (data: Partial<AccessoryTypeDef>) => {
        try {
            if (data.id) {
                await api.updateObjectAccessoryType(companyId, techType.id, data.id, { name: data.name, unit: data.unit });
            } else {
                await api.createObjectAccessoryType(companyId, techType.id, { name: data.name, unit: data.unit });
            }
            await onRefresh();
            setAccModal({ open: false, editing: null });
        } catch (err) { console.error(err); }
    };

    const deleteAcc = async (id: number) => {
        try {
            await api.deleteObjectAccessoryType(companyId, techType.id, id);
            await onRefresh();
        } catch (err) { console.error(err); }
    };

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors">
                    <Icon name="fa-arrow-left" />
                </button>
                <span className={`px-3 py-1 rounded-lg text-white font-bold ${techType.color}`}>{techType.name}</span>
                <span className="text-slate-500 text-sm">Definice karty technologie</span>
            </div>

            {/* Fields */}
            <Card className="mb-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-700">Pole karty</h3>
                    <Button onClick={() => setFieldModal({ open: true, editing: null })}>
                        <Icon name="fa-plus" className="mr-2" />
                        Přidat pole
                    </Button>
                </div>
                {techType.fields.length === 0 && (
                    <p className="text-slate-400 text-sm">Žádná pole. Přidejte první pole.</p>
                )}
                <div className="space-y-2">
                    {techType.fields.map(field => (
                        <div key={field.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex-1">
                                <span className="font-medium text-slate-700">{field.name}</span>
                                <span className="ml-2 text-xs text-slate-400 capitalize">({field.type})</span>
                                {field.type === 'select' && field.options && (
                                    <span className="ml-2 text-xs text-slate-400">[{field.options.join(', ')}]</span>
                                )}
                            </div>
                            {field.showInOverview ? (
                                <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                                    <Icon name="fa-eye" className="text-xs" />
                                    Přehled
                                </span>
                            ) : (
                                <span className="text-xs text-slate-300">skryto</span>
                            )}
                            <button onClick={() => setFieldModal({ open: true, editing: field })} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors">
                                <Icon name="fa-edit" />
                            </button>
                            <button onClick={() => deleteField(field.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                <Icon name="fa-trash" />
                            </button>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Accessory types */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-700">Typy příslušenství</h3>
                    <Button onClick={() => setAccModal({ open: true, editing: null })}>
                        <Icon name="fa-plus" className="mr-2" />
                        Přidat typ
                    </Button>
                </div>
                <p className="text-xs text-slate-400 mb-3">Příslušenství ke každému prvku technologie — baterie, kryty, podstavce, montážní lišty apod.</p>
                {techType.accessoryTypes.length === 0 && (
                    <p className="text-slate-400 text-sm">Žádné typy příslušenství.</p>
                )}
                <div className="flex flex-wrap gap-2">
                    {techType.accessoryTypes.map(acc => (
                        <div key={acc.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <Icon name="fa-puzzle-piece" className="text-slate-400 text-xs" />
                            <span className="text-slate-700 text-sm font-medium">{acc.name}</span>
                            <span className="text-slate-400 text-xs">/ {acc.unit}</span>
                            <button onClick={() => setAccModal({ open: true, editing: acc })} className="text-slate-400 hover:text-blue-500">
                                <Icon name="fa-edit" className="text-xs" />
                            </button>
                            <button onClick={() => deleteAcc(acc.id)} className="text-slate-400 hover:text-red-500">
                                <Icon name="fa-times" className="text-xs" />
                            </button>
                        </div>
                    ))}
                </div>
            </Card>

            {fieldModal.open && (
                <FieldForm
                    field={fieldModal.editing}
                    onClose={() => setFieldModal({ open: false, editing: null })}
                    onSave={saveField}
                />
            )}
            {accModal.open && (
                <AccessoryForm
                    acc={accModal.editing}
                    onClose={() => setAccModal({ open: false, editing: null })}
                    onSave={saveAcc}
                />
            )}
        </div>
    );
};

// ─── Main Admin Plugin ────────────────────────────────────────────────────────

const ObjectsAdminPlugin: React.FC<{ companyId: number }> = ({ companyId }) => {
    const [techTypes, setTechTypes] = useState<TechTypeDef[]>([]);
    const [selectedType, setSelectedType] = useState<TechTypeDef | null>(null);
    const [createModal, setCreateModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadTechTypes = useCallback(async () => {
        try {
            const data = await api.getObjectTechTypes(companyId);
            const types = data.map(transformTechType);
            setTechTypes(types);
            if (selectedType) {
                const refreshed = types.find(t => t.id === selectedType.id);
                setSelectedType(refreshed ?? null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [companyId, selectedType]);

    useEffect(() => { loadTechTypes(); }, [companyId]);

    const handleCreateTechType = async (data: Partial<TechTypeDef>) => {
        try {
            const created = await api.createObjectTechType(companyId, { name: data.name, color: data.color || 'bg-blue-600' });
            const newType = transformTechType(created);
            setTechTypes((prev: TechTypeDef[]) => [...prev, newType]);
            setCreateModal(false);
            setSelectedType(newType);
        } catch (err) { console.error(err); }
    };

    const handleDeleteTechType = async (id: number) => {
        try {
            await api.deleteObjectTechType(companyId, id);
            setTechTypes((prev: TechTypeDef[]) => prev.filter((t: TechTypeDef) => t.id !== id));
        } catch (err) { console.error(err); }
    };

    if (loading) return <p className="text-slate-400 text-sm p-4">Načítání...</p>;

    if (selectedType) {
        return (
            <TechTypeEditor
                techType={selectedType}
                companyId={companyId}
                onRefresh={loadTechTypes}
                onBack={() => setSelectedType(null)}
            />
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-700">Typy technologií</h3>
                    <p className="text-sm text-slate-500">Definujte technologie a jejich karty pro objekty.</p>
                </div>
                <Button onClick={() => setCreateModal(true)}>
                    <Icon name="fa-plus" className="mr-2" />
                    Přidat technologii
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {techTypes.map(tt => (
                    <div
                        key={tt.id}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => setSelectedType(tt)}
                    >
                        <div className={`${tt.color} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                            <span className="text-white font-bold text-lg">{tt.name}</span>
                            <button
                                onClick={e => { e.stopPropagation(); handleDeleteTechType(tt.id); }}
                                className="text-white/60 hover:text-white/100 transition-colors p-1"
                            >
                                <Icon name="fa-trash" className="text-sm" />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Icon name="fa-microchip" className="text-slate-400 w-4" />
                                <span className="font-semibold text-slate-800">{tt.elementCount}</span>
                                <span>prvků celkem</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Icon name="fa-list" className="text-slate-400 w-4" />
                                <span>{tt.fields.length} polí na kartě</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-blue-500">{tt.fields.filter(f => f.showInOverview).length} v přehledu</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Icon name="fa-puzzle-piece" className="text-slate-400 w-4" />
                                <span>{tt.accessoryTypes.length} typů příslušenství</span>
                            </div>
                        </div>
                        <div className="px-4 pb-4">
                            <span className="text-xs text-red-500 font-medium group-hover:underline">
                                Upravit definici →
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {techTypes.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="fa-layer-group" className="text-3xl mb-2" />
                    <p>Žádné technologie. Přidejte první.</p>
                </div>
            )}

            {createModal && (
                <TechTypeForm
                    techType={null}
                    onClose={() => setCreateModal(false)}
                    onSave={handleCreateTechType}
                />
            )}
        </div>
    );
};

export default ObjectsAdminPlugin;
