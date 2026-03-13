import React, { useState, useEffect } from 'react';
import { VehicleOut } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Input from './common/Input';
import ErrorMessage from './common/ErrorMessage';
import * as api from '../api';

const FUEL_TYPES = ['Benzín', 'Nafta', 'LPG', 'Elektřina', 'AdBlue', 'Jiné'];

interface FuelModalProps {
    companyId: number;
    date: Date;
    onClose: () => void;
    onSave: () => void;
}

const FuelModal: React.FC<FuelModalProps> = ({ companyId, date, onClose, onSave }) => {
    const [vehicles, setVehicles] = useState<VehicleOut[]>([]);
    const [vehicleId, setVehicleId] = useState('');
    const [fuelType, setFuelType] = useState('Nafta');
    const [liters, setLiters] = useState<number | ''>('');
    const [totalPrice, setTotalPrice] = useState<number | ''>('');
    const [location, setLocation] = useState('');
    const [odometerKm, setOdometerKm] = useState<number | ''>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.getVehicles(companyId).then(data => {
            setVehicles(data);
            if (data.length > 0) {
                setVehicleId(String(data[0].id));
                setOdometerKm(data[0].current_km);
            }
        }).catch(err => setError(err.message)).finally(() => setLoading(false));
    }, [companyId]);

    const handleVehicleChange = (id: string) => {
        setVehicleId(id);
        const v = vehicles.find(veh => veh.id === parseInt(id));
        if (v) setOdometerKm(v.current_km);
    };

    const pricePerLiter = liters && totalPrice ? (Number(totalPrice) / Number(liters)).toFixed(2) : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!vehicleId || !liters || !totalPrice || odometerKm === '') {
            setError('Vyplňte všechna povinná pole.');
            return;
        }

        setSaving(true);
        try {
            const toYYYYMMDD = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            await api.createFuelLog(companyId, {
                vehicle_id: parseInt(vehicleId),
                fuel_date: toYYYYMMDD(date),
                fuel_type: fuelType,
                liters: Number(liters),
                total_price: Number(totalPrice),
                location: location || null,
                odometer_km: Number(odometerKm),
            });
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title="Tankování" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <ErrorMessage message={error} />

                {loading ? (
                    <p className="text-slate-500">Načítání vozidel...</p>
                ) : vehicles.length === 0 ? (
                    <p className="text-slate-500">Žádná vozidla nejsou evidována.</p>
                ) : (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vozidlo</label>
                            <select
                                value={vehicleId}
                                onChange={e => handleVehicleChange(e.target.value)}
                                className="w-full p-2 border rounded bg-white text-slate-900"
                            >
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.brand} {v.model} ({v.license_plate}) — {v.current_km.toLocaleString()} km
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Druh paliva</label>
                            <div className="flex flex-wrap gap-2">
                                {FUEL_TYPES.map(ft => (
                                    <button
                                        key={ft}
                                        type="button"
                                        onClick={() => setFuelType(ft)}
                                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${fuelType === ft ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                                    >
                                        {ft}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Množství (litry)"
                                type="number"
                                value={liters}
                                onChange={e => setLiters(parseFloat(e.target.value) || '')}
                                placeholder="0.00"
                                required
                            />
                            <Input
                                label="Celková cena (Kč)"
                                type="number"
                                value={totalPrice}
                                onChange={e => setTotalPrice(parseFloat(e.target.value) || '')}
                                placeholder="0.00"
                                required
                            />
                        </div>

                        {pricePerLiter && (
                            <p className="text-xs text-right text-slate-500">
                                Cena za litr: <strong className="text-slate-800">{pricePerLiter} Kč/l</strong>
                            </p>
                        )}

                        <Input
                            label="Čerpací stanice / místo"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            placeholder="Název nebo adresa čerpací stanice"
                        />

                        <Input
                            label="Stav tachometru (km)"
                            type="number"
                            value={odometerKm}
                            onChange={e => setOdometerKm(parseFloat(e.target.value) || '')}
                            required
                        />
                    </>
                )}

                <div className="flex justify-end pt-2 space-x-2">
                    <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
                    <Button type="submit" disabled={saving || loading || vehicles.length === 0}>
                        {saving ? 'Ukládám...' : 'Uložit tankování'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default FuelModal;
