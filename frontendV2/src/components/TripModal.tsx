import React, { useState, useEffect } from 'react';
import { VehicleOut } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Input from './common/Input';
import ErrorMessage from './common/ErrorMessage';
import Icon from './common/Icon';
import * as api from '../api';

interface TripModalProps {
    companyId: number;
    date: Date;
    onClose: () => void;
    onSave: () => void;
}

const TripModal: React.FC<TripModalProps> = ({ companyId, date, onClose, onSave }) => {
    const [vehicles, setVehicles] = useState<VehicleOut[]>([]);
    const [vehicleId, setVehicleId] = useState('');
    const [startLocation, setStartLocation] = useState('Firma');
    const [endLocation, setEndLocation] = useState('');
    const [startKm, setStartKm] = useState<number | ''>('');
    const [distance, setDistance] = useState<number | ''>('');
    const [endKm, setEndKm] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Which odometer mode: 'distance' (start + vzdálenost = end) or 'manual' (start + end ručně)
    const [odometerMode, setOdometerMode] = useState<'distance' | 'manual'>('distance');

    useEffect(() => {
        api.getVehicles(companyId).then(data => {
            setVehicles(data);
            if (data.length > 0) {
                setVehicleId(String(data[0].id));
                setStartKm(data[0].current_km);
            }
        }).catch(err => setError(err.message)).finally(() => setLoading(false));
    }, [companyId]);

    // Update startKm when vehicle changes
    const handleVehicleChange = (id: string) => {
        setVehicleId(id);
        const v = vehicles.find(veh => veh.id === parseInt(id));
        if (v) setStartKm(v.current_km);
    };

    // Compute endKm from distance
    const computedEndKm = odometerMode === 'distance' && startKm !== '' && distance !== ''
        ? startKm + distance
        : endKm;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const finalEndKm = odometerMode === 'distance'
            ? (startKm !== '' && distance !== '' ? startKm + distance : null)
            : endKm;

        if (!vehicleId || !endLocation || startKm === '' || finalEndKm === null || finalEndKm === '') {
            setError('Vyplňte všechna povinná pole.');
            return;
        }
        if (finalEndKm <= startKm) {
            setError('Konečný stav tachometru musí být větší než počáteční.');
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

            await api.createFleetLog(companyId, {
                vehicle_id: parseInt(vehicleId),
                travel_date: toYYYYMMDD(date),
                start_location: startLocation,
                end_location: endLocation,
                start_km: startKm,
                end_km: finalEndKm,
                notes: notes || null,
            });
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title="Přesun / Jízda" onClose={onClose}>
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

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Odkud"
                                value={startLocation}
                                onChange={e => setStartLocation(e.target.value)}
                                required
                            />
                            <Input
                                label="Kam"
                                value={endLocation}
                                onChange={e => setEndLocation(e.target.value)}
                                placeholder="Cílové místo"
                                required
                            />
                        </div>

                        {/* Tachometr sekce */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-700 flex items-center">
                                    <Icon name="fa-tachometer-alt" className="mr-2" /> Tachometr
                                </span>
                                <div className="flex text-xs rounded overflow-hidden border border-slate-300">
                                    <button
                                        type="button"
                                        onClick={() => setOdometerMode('distance')}
                                        className={`px-3 py-1 transition-colors ${odometerMode === 'distance' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        Vzdálenost
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOdometerMode('manual')}
                                        className={`px-3 py-1 transition-colors ${odometerMode === 'manual' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        Ručně
                                    </button>
                                </div>
                            </div>

                            <div className={`grid gap-3 ${odometerMode === 'distance' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                <Input
                                    label="Počáteční stav (km)"
                                    type="number"
                                    value={startKm}
                                    onChange={e => setStartKm(parseFloat(e.target.value) || '')}
                                    required
                                />
                                {odometerMode === 'distance' ? (
                                    <Input
                                        label="Vzdálenost (km)"
                                        type="number"
                                        value={distance}
                                        onChange={e => setDistance(parseFloat(e.target.value) || '')}
                                        placeholder="0"
                                        required
                                    />
                                ) : (
                                    <Input
                                        label="Konečný stav (km)"
                                        type="number"
                                        value={endKm}
                                        onChange={e => setEndKm(parseFloat(e.target.value) || '')}
                                        required
                                    />
                                )}
                            </div>

                            {/* Výsledek */}
                            {odometerMode === 'distance' && startKm !== '' && distance !== '' && (
                                <p className="text-xs text-right text-slate-500">
                                    Konečný stav tachometru:{' '}
                                    <strong className="text-slate-800">{(Number(startKm) + Number(distance)).toLocaleString()} km</strong>
                                </p>
                            )}
                            {odometerMode === 'manual' && startKm !== '' && endKm !== '' && (
                                <p className="text-xs text-right text-slate-500">
                                    Vzdálenost:{' '}
                                    <strong className="text-slate-800">{(Number(endKm) - Number(startKm)).toLocaleString()} km</strong>
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Poznámky</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-slate-900"
                            />
                        </div>
                    </>
                )}

                <div className="flex justify-end pt-2 space-x-2">
                    <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
                    <Button type="submit" disabled={saving || loading || vehicles.length === 0}>
                        {saving ? 'Ukládám...' : 'Uložit jízdu'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default TripModal;
