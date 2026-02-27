import React, { useState, useEffect, useRef } from 'react';
import { registerPlugin, PluginComponentProps } from '../../lib/PluginSystem';
import * as api from '../../api';
import { VehicleOut } from '../../types';
import Input from '../common/Input';
import Icon from '../common/Icon';

const TimeLogFleetPlugin: React.FC<PluginComponentProps> = ({ context }) => {
    const { companyId, workOrder, date, registerPostSaveAction } = context;
    
    const [isEnabled, setIsEnabled] = useState(false);
    const [vehicles, setVehicles] = useState<VehicleOut[]>([]);
    
    // Form state
    const [vehicleId, setVehicleId] = useState<string>('');
    const [startLocation, setStartLocation] = useState('Firma');
    const [endLocation, setEndLocation] = useState('');
    const [distance, setDistance] = useState<number | ''>('');
    const [currentKm, setCurrentKm] = useState<number>(0); // Stav tachometru před jízdou

    const isInitialized = useRef(false);

    // 1. Načtení vozidel při startu
    useEffect(() => {
        api.getVehicles(companyId).then(data => {
            setVehicles(data);
            if (data.length > 0) {
                setVehicleId(String(data[0].id));
                setCurrentKm(data[0].current_km);
            }
        });
    }, [companyId]);

    // 2. Automatické vyplnění "Kam" podle vybrané zakázky
    useEffect(() => {
        if (workOrder && workOrder.client && workOrder.client.address) {
            // Zkusíme extrahovat město z adresy (např. "Ulice 1, České Budějovice")
            // Pro jednoduchost vezmeme celou adresu nebo město, pokud je tam čárka
            const parts = workOrder.client.address.split(',');
            const city = parts.length > 1 ? parts[parts.length - 1].trim() : workOrder.client.address;
            setEndLocation(city);
            
            // Pokud uživatel vybral zakázku, asi tam jel -> zapneme logování
            if (!isInitialized.current) {
                setIsEnabled(true);
                isInitialized.current = true;
            }
        }
    }, [workOrder]);

    // 3. Aktualizace stavu tachometru při změně auta
    useEffect(() => {
        if (vehicleId) {
            const v = vehicles.find(veh => veh.id === parseInt(vehicleId));
            if (v) setCurrentKm(v.current_km);
        }
    }, [vehicleId, vehicles]);

    // 4. Registrace ukládací logiky do rodičovského formuláře
    useEffect(() => {
        // Funkce, která se zavolá, až uživatel klikne na "Uložit" v hlavním okně
        const saveFleetLog = async () => {
            if (!isEnabled) return; // Pokud není zaškrtnuto, nic neděláme

            if (!vehicleId || !endLocation || !distance) {
                // V reálu bychom měli vyhodit chybu, ale jsme v async callbacku.
                // Pro tuto chvíli předpokládáme validaci, nebo to přeskočíme.
                console.warn("Chybí údaje pro knihu jízd, záznam nebude vytvořen.");
                return;
            }

            const distVal = Number(distance);
            const endKmVal = currentKm + distVal;

            const payload = {
                vehicle_id: parseInt(vehicleId),
                travel_date: date.toISOString().split('T')[0],
                start_location: startLocation,
                end_location: endLocation,
                start_km: currentKm,
                end_km: endKmVal,
                notes: workOrder ? `Jízda k zakázce: ${workOrder.name}` : 'Jízda k práci'
            };

            await api.createFleetLog(companyId, payload);
        };

        // Zaregistrujeme tuto funkci do TimeLogModal
        if (registerPostSaveAction) {
            registerPostSaveAction(saveFleetLog);
        }
        
        // Cleanup není nutný, protože registerPostSaveAction v Modalu se resetuje při zavření
    }, [isEnabled, vehicleId, startLocation, endLocation, distance, currentKm, date, companyId, workOrder, registerPostSaveAction]);


    if (vehicles.length === 0) return null;

    return (
        <div className="mt-4 p-3 border-2 border-slate-200 rounded-lg bg-slate-50">
            <div className="flex items-center mb-3 cursor-pointer" onClick={() => setIsEnabled(!isEnabled)}>
                <input 
                    type="checkbox" 
                    checked={isEnabled} 
                    onChange={() => {}} // Handled by div click
                    className="h-5 w-5 text-red-600 rounded mr-2 cursor-pointer"
                />
                <label className="font-bold text-slate-700 cursor-pointer flex items-center">
                    <Icon name="fa-car" className="mr-2"/> Zapsat jízdu do knihy
                </label>
            </div>

            {isEnabled && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Vozidlo</label>
                        <select 
                            value={vehicleId} 
                            onChange={e => setVehicleId(e.target.value)} 
                            className="w-full p-2 border rounded bg-white text-sm"
                        >
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate}) - {v.current_km} km</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                            <Input label="Odkud" value={startLocation} onChange={e => setStartLocation(e.target.value)} className="!text-sm !py-1.5"/>
                        </div>
                        <div className="col-span-1">
                            <Input label="Kam" value={endLocation} onChange={e => setEndLocation(e.target.value)} className="!text-sm !py-1.5"/>
                        </div>
                        <div className="col-span-1">
                            <Input 
                                label="Vzdálenost (km)" 
                                type="number" 
                                value={distance} 
                                onChange={e => setDistance(parseFloat(e.target.value))} 
                                className="!text-sm !py-1.5 font-bold"
                                placeholder="0"
                            />
                        </div>
                    </div>
                    {distance !== '' && (
                        <p className="text-xs text-right text-slate-500">
                            Nový stav tachometru: <strong>{(currentKm + Number(distance)).toLocaleString()} km</strong>
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// Registrace do nového slotu v TimeLogModal
registerPlugin('time-log-form-fields', TimeLogFleetPlugin);

export default TimeLogFleetPlugin;