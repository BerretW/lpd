import React, { useState, useEffect, useCallback } from 'react';
import { VehicleOut, VehicleLogOut, UserOut, RoleEnum } from '../../types';
import * as api from '../../api';
import Button from '../common/Button';
import Input from '../common/Input';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import Card from '../common/Card';
import ErrorMessage from '../common/ErrorMessage';
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
    const [users, setUsers] = useState<UserOut[]>([]); // Pro přiřazení řidiče
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modals state
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<VehicleOut | null>(null);

    // Form states
    const [formData, setFormData] = useState<any>({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [vData, lData, uData] = await Promise.all([
                api.getVehicles(companyId),
                api.getFleetLogs(companyId),
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

    const handleSaveLog = async () => {
        try {
            // Najdeme auto pro validaci km
            const vehicle = vehicles.find(v => v.id === parseInt(formData.vehicle_id));
            const startKm = vehicle ? vehicle.current_km : 0;
            
            await api.createFleetLog(companyId, {
                ...formData,
                start_km: startKm, // Start km se bere automaticky z aktuálního stavu auta
                end_km: parseFloat(formData.end_km)
            });
            setIsLogModalOpen(false);
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

    const openLogModal = () => {
        setFormData({ 
            travel_date: new Date().toISOString().split('T')[0],
            vehicle_id: vehicles.length > 0 ? vehicles[0].id : '',
            end_km: '' 
        });
        setIsLogModalOpen(true);
    };

    const getDriverName = (id: number) => {
        // V reálné aplikaci bychom potřebovali seznam všech userů, nebo to tahat z API joinem
        // Zde pro jednoduchost zobrazíme ID nebo "Já" pokud sedí s přihlášeným
        return `Řidič ID: ${id}`; 
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
                            </div>
                        </Card>
                    ))}
                    {vehicles.length === 0 && <p className="text-slate-500 italic">Žádná vozidla.</p>}
                </div>
            )}

            {activeTab === 'logs' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Datum</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vozidlo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trasa</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Vzdálenost</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Stav tachometru</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200 text-sm">
                            {logs.map(log => {
                                const vehicle = vehicles.find(v => v.id === log.vehicle_id);
                                return (
                                    <tr key={log.id}>
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(log.travel_date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 font-medium">{vehicle ? vehicle.license_plate : 'Neznámé'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center">
                                                <span>{log.start_location}</span>
                                                <Icon name="fa-arrow-right" className="mx-2 text-slate-400 text-xs"/>
                                                <span>{log.end_location}</span>
                                            </div>
                                            {log.notes && <p className="text-xs text-slate-500 mt-1">{log.notes}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold">{(log.end_km - log.start_km).toFixed(1)} km</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{log.end_km.toLocaleString()} km</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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
                <Modal title="Zapsat jízdu" onClose={() => setIsLogModalOpen(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vozidlo</label>
                            <select 
                                className="w-full p-2 border rounded"
                                value={formData.vehicle_id}
                                onChange={e => setFormData({...formData, vehicle_id: parseInt(e.target.value)})}
                            >
                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate}) - {v.current_km} km</option>)}
                            </select>
                        </div>
                        
                        <Input label="Datum jízdy" type="date" value={formData.travel_date} onChange={e => setFormData({...formData, travel_date: e.target.value})} required />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Odkud" value={formData.start_location || ''} onChange={e => setFormData({...formData, start_location: e.target.value})} required placeholder="Město / Adresa" />
                            <Input label="Kam" value={formData.end_location || ''} onChange={e => setFormData({...formData, end_location: e.target.value})} required placeholder="Město / Adresa" />
                        </div>

                        <Input 
                            label="Stav tachometru po dojezdu (km)" 
                            type="number" 
                            value={formData.end_km} 
                            onChange={e => setFormData({...formData, end_km: e.target.value})} 
                            required 
                            placeholder="Např. 150200"
                        />
                        <p className="text-xs text-slate-500">Počáteční stav bude automaticky načten z karty vozidla.</p>

                        <Input label="Poznámka" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleSaveLog}>Zapsat</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FleetPlugin;