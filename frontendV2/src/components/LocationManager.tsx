import React, { useState, useEffect, useCallback } from 'react';
import { LocationOut } from '../types';
import Button from './common/Button';
import Icon from './common/Icon';
import Modal from './common/Modal';
import * as api from '../api';
import ErrorModal from './common/ErrorModal';
import ConfirmModal from './common/ConfirmModal';
import Input from './common/Input';
import LocationPermissionsModal from './LocationPermissionsModal';
import LocationContentsModal from './LocationContentsModal';

interface LocationManagerProps {
    companyId: number;
}

// Form component inside the modal
const LocationForm: React.FC<{
    onSave: (data: { name: string, description?: string }) => void;
    onCancel: () => void;
    location: LocationOut | null;
}> = ({ onSave, onCancel, location }) => {
    const [name, setName] = useState(location?.name || '');
    const [description, setDescription] = useState(location?.description || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, description });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Název lokace" value={name} onChange={e => setName(e.target.value)} required />
            <Input label="Popis" value={description} onChange={e => setDescription(e.target.value)} />
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel}>Zrušit</Button>
                <Button type="submit">Uložit</Button>
            </div>
        </form>
    );
};

const LocationManager: React.FC<LocationManagerProps> = ({ companyId }) => {
    const [locations, setLocations] = useState<LocationOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<LocationOut | null>(null);
    const [locationToDelete, setLocationToDelete] = useState<LocationOut | null>(null);
    const [locationForPerms, setLocationForPerms] = useState<LocationOut | null>(null);
    const [locationForContents, setLocationForContents] = useState<LocationOut | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getLocations(companyId);
            setLocations(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se načíst lokace.');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const closeModal = () => {
        setIsFormOpen(false);
        setEditingLocation(null);
    };

    const handleAdd = () => {
        setEditingLocation(null);
        setIsFormOpen(true);
    };

    const handleEdit = (location: LocationOut) => {
        setEditingLocation(location);
        setIsFormOpen(true);
    };

    const handleDelete = (location: LocationOut) => {
        setLocationToDelete(location);
    };

    const handleSave = async (data: { name: string, description?: string }) => {
        try {
            if (editingLocation) {
                await api.updateLocation(companyId, editingLocation.id, data);
            } else {
                await api.createLocation(companyId, data);
            }
            closeModal();
            await fetchData();
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
        }
    };

    const executeDelete = async () => {
        if (!locationToDelete) return;
        try {
            await api.deleteLocation(companyId, locationToDelete.id);
            await fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se smazat lokaci. Ujistěte se, že je prázdná.');
        } finally {
            setLocationToDelete(null);
        }
    };

    if (loading) {
        return <div className="p-4">Načítání lokací...</div>;
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Button onClick={handleAdd}>
                    <Icon name="fa-plus" className="mr-2" /> Nová lokace
                </Button>
            </div>
            <div className="space-y-2">
                {locations.length > 0 ? (
                    <ul className="divide-y divide-slate-200">
                        {locations.map(loc => (
                            <li key={loc.id} className="py-3 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-slate-900">{loc.name}</p>
                                    <p className="text-sm text-slate-500">{loc.description}</p>
                                </div>
                                <div className="space-x-2">
                                    <Button variant="secondary" className="!text-xs !py-1 !px-2" onClick={() => setLocationForContents(loc)} title="Obsah lokace">
                                        <Icon name="fa-boxes" />
                                    </Button>
                                    <Button variant="secondary" className="!text-xs !py-1 !px-2" onClick={() => setLocationForPerms(loc)} title="Oprávnění">
                                        <Icon name="fa-users" />
                                    </Button>
                                    <Button variant="secondary" className="!text-xs !py-1 !px-2" onClick={() => handleEdit(loc)} title="Upravit">
                                        <Icon name="fa-pencil-alt" />
                                    </Button>
                                    <Button variant="secondary" className="!text-xs !py-1 !px-2 !bg-red-100 !text-red-700 hover:!bg-red-200" onClick={() => handleDelete(loc)} title="Smazat">
                                        <Icon name="fa-trash" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-slate-500 text-center p-8">Zatím nebyly vytvořeny žádné skladové lokace.</p>
                )}
            </div>

            {isFormOpen && (
                <Modal title={editingLocation ? 'Upravit lokaci' : 'Nová lokace'} onClose={closeModal}>
                    <LocationForm 
                        onSave={handleSave}
                        onCancel={closeModal}
                        location={editingLocation}
                    />
                </Modal>
            )}

            {locationToDelete && (
                <ConfirmModal 
                    title="Smazat lokaci"
                    message={<>Opravdu chcete smazat lokaci <strong>{locationToDelete.name}</strong>? Tuto akci nelze vrátit zpět.</>}
                    onConfirm={executeDelete}
                    onCancel={() => setLocationToDelete(null)}
                />
            )}

            {locationForPerms && (
                <LocationPermissionsModal
                    companyId={companyId}
                    location={locationForPerms}
                    onClose={() => setLocationForPerms(null)}
                />
            )}

            {locationForContents && (
                <LocationContentsModal
                    companyId={companyId}
                    location={locationForContents}
                    onClose={() => setLocationForContents(null)}
                />
            )}

            {error && <ErrorModal title="Chyba správy lokací" message={error} onClose={() => setError(null)} />}
        </div>
    );
};

export default LocationManager;
