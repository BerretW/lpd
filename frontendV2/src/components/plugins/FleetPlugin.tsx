import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VehicleOut, VehicleLogOut, UserOut, RoleEnum } from '../../types';
import * as api from '../../api';
import Button from '../common/Button';
import Input from '../common/Input';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import Card from '../common/Card';
import ErrorMessage from '../common/ErrorMessage';
import ConfirmModal from '../common/ConfirmModal';
import { useAuth } from '../../AuthContext';

interface FleetPluginProps {
    companyId: number;
}

const FleetPlugin: React.FC<FleetPluginProps> = ({ companyId }) => {
    const { role } = useAuth();
    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;
    
    const [activeTab, setActiveTab] = useState<'vehicles' | 'logs'>('vehicles');
    const [vehicles, setVehicles] = useState<VehicleOut[]>([]);
    const [logs, setLogs] = useState<VehicleLogOut[]>([]);
    const [users, setUsers] = useState<UserOut[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [filterVehicleId, setFilterVehicleId] = useState<string>('');

    // Modals state
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<VehicleOut | null>(null);
    const [editingLog, setEditingLog] = useState<VehicleLogOut | null>(null);
    const [logToDelete, setLogToDelete] = useState<VehicleLogOut | null>(null);

    // Form states
    const [formData, setFormData] = useState<any>({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [vData, lData, uData] = await Promise.all([
                api.getVehicles(companyId),
                api.getFleetLogs(companyId), // Načteme vše, filtrujeme na klientovi pro rychlost
                isAdmin ? api.getMembers(companyId) : Promise.resolve([])
            ]);
            setVehicles(vData);
            setLogs(lData);
            if (isAdmin) setUsers(uData.map(m => m.user));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Chyba při načítání dat.");
        } finally {
            setLoading(false);
        }
    }, [companyId, isAdmin]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- VEHICLE ACTIONS ---

    const handleSaveVehicle = async () => {
        try {
            if (editingVehicle) {
                await api.updateVehicle(companyId, editingVehicle.id, formData);
            } else {
                await api.createVehicle(companyId, formData);
            }
            setIsVehicleModalOpen(false);
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const openVehicleModal = (v?: VehicleOut) => {
        setEditingVehicle(v || null);
        setFormData(v ? { ...v } : { current_km: 0 });
        setIsVehicleModalOpen(true);
    };

    // --- LOG ACTIONS ---

    const handleSaveLog = async () => {
        try {
            if (editingLog) {
                // Update existujícího záznamu
                await api.updateFleetLog(companyId, editingLog.id, {
                    ...formData,
                    vehicle_id: parseInt(formData.vehicle_id),
                    start_km: parseFloat(formData.start_km),
                    end_km: parseFloat(formData.end_km)
                });
            } else {
                // Vytvoření nového
                const vehicle = vehicles.find(v => v.id === parseInt(formData.vehicle_id));
                const startKm = vehicle ? vehicle.current_km : 0;
                
                await api.createFleetLog(companyId, {
                    ...formData,
                    start_km: startKm,
                    end_km: parseFloat(formData.end_km)
                });
            }
            setIsLogModalOpen(false);
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDeleteLog = async () => {
        if (!logToDelete) return;
        try {
            await api.deleteFleetLog(companyId, logToDelete.id);
            setLogToDelete(null);
            fetchData();
        } catch (e: any) {
            alert("Smazání se nezdařilo: " + e.message);
        }
    };

    const openLogModal = (log?: VehicleLogOut) => {
        setEditingLog(log || null);
        if (log) {
            // Editace
            setFormData({
                vehicle_id: log.vehicle_id,
                travel_date: log.travel_date.split('T')[0], // Ořezat čas
                start_location: log.start_location,
                end_location: log.end_location,
                start_km: log.start_km,
                end_km: log.end_km,
                notes: log.notes || ''
            });
        } else {
            // Nový
            setFormData({ 
                travel_date: new Date().toISOString().split('T')[0],
                vehicle_id: vehicles.length > 0 ? vehicles[0].id : '',
                end_km: '' 
            });
        }
        setIsLogModalOpen(true);
    };

    // --- FILTERING ---
    const filteredLogs = useMemo(() => {
        if (!filterVehicleId) return logs;
        return logs.filter(l => l.vehicle_id === parseInt(filterVehicleId));
    }, [logs, filterVehicleId]);

    const getDriverLabel = (id: number) => {
        const u = users.find(user => user.id === id);
        return u ? u.email : `ID: ${id}`;
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">Správa vozového parku</h1>
                <div className="space-x-2">
                    <Button onClick={() => openLogModal()} variant="primary">
                        <Icon name="fa-road" className="mr-2"/> Zapsat jízdu
                    </Button>
                    {isAdmin && (
                        <Button onClick={() => openVehicleModal()} variant="secondary">
                            <Icon name="fa-car" className="mr-2"/> Přidat vozidlo
                        </Button>
                    )}
                </div>
            </div>

            <div className="bg-slate-200 p-1 rounded-lg inline-flex mb-6">
                <button onClick={() => setActiveTab('vehicles')} className={`px-4 py-2 rounded-md font-semibold text-sm ${activeTab === 'vehicles' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-900'}`}>Vozidla</button>
                <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 rounded-md font-semibold text-sm ${activeTab === 'logs' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-900'}`}>Kniha jízd</button>
            </div>

            <ErrorMessage message={error} />
            {loading && <p>Načítání...</p>}

            {/* --- ZÁLOŽKA VOZIDLA --- */}
            {activeTab === 'vehicles' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vehicles.map(v => (
                        <Card key={v.id} className="relative hover:shadow-lg transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{v.brand} {v.model}</h3>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono font-bold border border-slate-300">
                                        {v.license_plate}
                                    </span>
                                </div>
                                {isAdmin && (
                                    <button onClick={() => openVehicleModal(v)} className="text-slate-400 hover:text-blue-600">
                                        <Icon name="fa-pencil-alt" />
                                    </button>
                                )}
                            </div>
                            
                            <div className="text-sm space-y-1 text-slate-600 mt-4">
                                <p><Icon name="fa-tachometer-alt" className="w-5 text-center"/> {v.current_km.toLocaleString()} km</p>
                                <p><Icon name="fa-calendar-check" className="w-5 text-center"/> STK: {v.next_stk_date ? new Date(v.next_stk_date).toLocaleDateString() : 'Nenastaveno'}</p>
                                <p><Icon name="fa-wrench" className="w-5 text-center"/> Servis při: {v.next_service_km ? v.next_service_km.toLocaleString() + ' km' : 'Nenastaveno'}</p>
                                {v.assigned_user_id && <p className="text-xs text-blue-600 mt-2 font-semibold">Přiděleno: {getDriverLabel(v.assigned_user_id)}</p>}
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                                <button onClick={() => { setActiveTab('logs'); setFilterVehicleId(v.id.toString()); }} className="text-xs text-blue-600 hover:underline">
                                    Zobrazit historii jízd
                                </button>
                            </div>
                        </Card>
                    ))}
                    {vehicles.length === 0 && <p className="text-slate-500 italic">Žádná vozidla.</p>}
                </div>
            )}

            {/* --- ZÁLOŽKA KNIHA JÍZD --- */}
            {activeTab === 'logs' && (
                <div className="space-y-4">
                    {/* Filtrovací lišta */}
                    <div className="flex items-center space-x-4 bg-white p-3 rounded-lg border border-slate-200">
                        <span className="text-sm font-semibold text-slate-700">Filtr:</span>
                        <select 
                            value={filterVehicleId} 
                            onChange={(e) => setFilterVehicleId(e.target.value)}
                            className="p-2 border rounded text-sm bg-slate-50"
                        >
                            <option value="">Všechna vozidla</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>
                            ))}
                        </select>
                        {filterVehicleId && (
                            <button onClick={() => setFilterVehicleId('')} className="text-xs text-red-500 hover:underline">Zrušit filtr</button>
                        )}
                    </div>

                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Datum</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vozidlo</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Řidič</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trasa</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Vzdálenost</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Tachometr</th>
                                    {isAdmin && <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Akce</th>}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200 text-sm">
                                {filteredLogs.map(log => {
                                    const vehicle = vehicles.find(v => v.id === log.vehicle_id);
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 whitespace-nowrap">{new Date(log.travel_date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 font-medium">
                                                {vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Neznámé'}
                                                <div className="text-xs text-slate-400 font-mono">{vehicle?.license_plate}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {isAdmin ? getDriverLabel(log.driver_id) : (log.driver_id === users.find(u => u.email === getDriverLabel(log.driver_id))?.id ? 'Já' : 'Kolega')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center">
                                                    <span>{log.start_location}</span>
                                                    <Icon name="fa-arrow-right" className="mx-2 text-slate-400 text-xs"/>
                                                    <span>{log.end_location}</span>
                                                </div>
                                                {log.notes && <p className="text-xs text-slate-500 mt-1 italic">{log.notes}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">{(log.end_km - log.start_km).toFixed(1)} km</td>
                                            <td className="px-4 py-3 text-right text-slate-500">{log.end_km.toLocaleString()} km</td>
                                            {isAdmin && (
                                                <td className="px-4 py-3 text-right space-x-2">
                                                    <button onClick={() => openLogModal(log)} className="text-blue-600 hover:text-blue-800" title="Upravit">
                                                        <Icon name="fa-pencil-alt" />
                                                    </button>
                                                    <button onClick={() => setLogToDelete(log)} className="text-red-600 hover:text-red-800" title="Smazat">
                                                        <Icon name="fa-trash" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {filteredLogs.length === 0 && (
                                    <tr><td colSpan={7} className="text-center p-8 text-slate-500">Žádné záznamy k zobrazení.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL: Edit/Create Vehicle */}
            {isVehicleModalOpen && (
                <Modal title={editingVehicle ? "Upravit vozidlo" : "Nové vozidlo"} onClose={() => setIsVehicleModalOpen(false)}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="SPZ" value={formData.license_plate || ''} onChange={e => setFormData({...formData, license_plate: e.target.value})} required />
                            <Input label="Značka" value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} required />
                            <Input label="Model" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} required />
                            <Input label="VIN" value={formData.vin || ''} onChange={e => setFormData({...formData, vin: e.target.value})} />
                        </div>
                        <Input label="Aktuální stav tachometru (km)" type="number" value={formData.current_km || ''} onChange={e => setFormData({...formData, current_km: parseFloat(e.target.value)})} required />
                        
                        <div className="p-4 bg-slate-50 border rounded-md">
                            <h4 className="font-bold text-sm mb-3">Servisní údaje</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Datum příští STK" type="date" value={formData.next_stk_date || ''} onChange={e => setFormData({...formData, next_stk_date: e.target.value})} />
                                <Input label="Příští servis při (km)" type="number" value={formData.next_service_km || ''} onChange={e => setFormData({...formData, next_service_km: parseFloat(e.target.value)})} />
                            </div>
                        </div>

                        {isAdmin && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Přidělený řidič</label>
                                <select 
                                    className="w-full p-2 border rounded"
                                    value={formData.assigned_user_id || ''}
                                    onChange={e => setFormData({...formData, assigned_user_id: e.target.value ? parseInt(e.target.value) : null})}
                                >
                                    <option value="">-- Nikdo --</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleSaveVehicle}>Uložit</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* MODAL: Log Trip */}
            {isLogModalOpen && (
                <Modal title={editingLog ? "Upravit záznam jízdy" : "Zapsat jízdu"} onClose={() => setIsLogModalOpen(false)}>
                    <div className="space-y-4">
                        {editingLog && (
                            <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-200 mb-2">
                                <Icon name="fa-info-circle" className="mr-2"/>
                                Upravujete historický záznam. Změna kilometrů zde <strong>neaktualizuje</strong> automaticky tachometr vozidla ani navazující jízdy.
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vozidlo</label>
                            <select 
                                className="w-full p-2 border rounded"
                                value={formData.vehicle_id}
                                onChange={e => setFormData({...formData, vehicle_id: parseInt(e.target.value)})}
                                disabled={!!editingLog} // Při editaci neměníme auto
                            >
                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>)}
                            </select>
                        </div>
                        
                        <Input label="Datum jízdy" type="date" value={formData.travel_date} onChange={e => setFormData({...formData, travel_date: e.target.value})} required />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Odkud" value={formData.start_location || ''} onChange={e => setFormData({...formData, start_location: e.target.value})} required placeholder="Město / Adresa" />
                            <Input label="Kam" value={formData.end_location || ''} onChange={e => setFormData({...formData, end_location: e.target.value})} required placeholder="Město / Adresa" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Počáteční stav (km)" 
                                type="number" 
                                value={formData.start_km} 
                                onChange={e => setFormData({...formData, start_km: e.target.value})} 
                                required 
                                disabled={!editingLog && !isAdmin} // Při novém záznamu se bere automaticky, ale admin může editovat
                            />
                            <Input 
                                label="Konečný stav (km)" 
                                type="number" 
                                value={formData.end_km} 
                                onChange={e => setFormData({...formData, end_km: e.target.value})} 
                                required 
                            />
                        </div>
                        {!editingLog && <p className="text-xs text-slate-500">Počáteční stav je předvyplněn z karty vozidla.</p>}

                        <Input label="Poznámka" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />

                        <div className="flex justify-end pt-4 space-x-2">
                            <Button variant="secondary" onClick={() => setIsLogModalOpen(false)}>Zrušit</Button>
                            <Button onClick={handleSaveLog}>Uložit</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* DELETE CONFIRMATION */}
            {logToDelete && (
                <ConfirmModal 
                    title="Smazat jízdu"
                    message="Opravdu chcete smazat tento záznam z knihy jízd? Tato akce je nevratná."
                    onConfirm={handleDeleteLog}
                    onCancel={() => setLogToDelete(null)}
                />
            )}
        </div>
    );
};

export default FleetPlugin;