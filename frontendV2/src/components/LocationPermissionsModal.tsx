import React, { useState, useEffect, useCallback } from 'react';
import { LocationOut, MemberOut, UserOut, RoleEnum } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Icon from './common/Icon';
import ErrorMessage from './common/ErrorMessage';
import * as api from '../api';

interface LocationPermissionsModalProps {
    companyId: number;
    location: LocationOut;
    onClose: () => void;
}

const LocationPermissionsModal: React.FC<LocationPermissionsModalProps> = ({ companyId, location, onClose }) => {
    const [authorizedUsers, setAuthorizedUsers] = useState<UserOut[]>([]);
    const [allMembers, setAllMembers] = useState<MemberOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [users, members] = await Promise.all([
                api.getLocationPermissions(companyId, location.id),
                api.getMembers(companyId)
            ]);
            setAuthorizedUsers(users);
            // Filter out admins and owners as they have implicit access
            setAllMembers(members.filter(m => m.role === RoleEnum.Member));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se načíst data oprávnění.');
        } finally {
            setLoading(false);
        }
    }, [companyId, location.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddPermission = async () => {
        const memberToAdd = allMembers.find(m => m.user.id.toString() === selectedMemberId);
        if (!memberToAdd) {
            setError('Vyberte prosím platného zaměstnance.');
            return;
        }
        setError(null);
        try {
            const updatedUsers = await api.addLocationPermission(companyId, location.id, memberToAdd.user.email);
            setAuthorizedUsers(updatedUsers);
            setSelectedMemberId(''); // Reset dropdown
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se přidat oprávnění.');
        }
    };

    const handleRemovePermission = async (userId: number) => {
        setError(null);
        try {
            await api.removeLocationPermission(companyId, location.id, userId);
            setAuthorizedUsers(prev => prev.filter(u => u.id !== userId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se odebrat oprávnění.');
        }
    };

    const unassignedMembers = allMembers.filter(member =>
        !authorizedUsers.some(authUser => authUser.id === member.user.id)
    );

    return (
        <Modal title={`Oprávnění pro lokaci: ${location.name}`} onClose={onClose}>
            <div className="space-y-6">
                <ErrorMessage message={error} />
                {loading ? (
                    <p>Načítání...</p>
                ) : (
                    <>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">Oprávnění uživatelé</h3>
                            {authorizedUsers.length > 0 ? (
                                <ul className="max-h-60 overflow-y-auto border rounded-md divide-y divide-slate-200">
                                    {authorizedUsers.map(user => (
                                        <li key={user.id} className="p-2 flex justify-between items-center">
                                            <span>{user.email}</span>
                                            <Button variant="secondary" className="!text-xs !py-1 !px-2 !bg-red-100 !text-red-700 hover:!bg-red-200" onClick={() => handleRemovePermission(user.id)}>
                                                <Icon name="fa-trash" /> Odebrat
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-500 italic">K této lokaci nemá přístup žádný běžný uživatel.</p>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">Přidat oprávnění</h3>
                             <div className="flex items-center space-x-2">
                                <select
                                    value={selectedMemberId}
                                    onChange={e => setSelectedMemberId(e.target.value)}
                                    className="flex-grow p-2 border rounded bg-white text-slate-900"
                                >
                                    <option value="">-- Vybrat zaměstnance --</option>
                                    {unassignedMembers.map(member => (
                                        <option key={member.user.id} value={member.user.id}>{member.user.email}</option>
                                    ))}
                                </select>
                                <Button onClick={handleAddPermission} disabled={!selectedMemberId}>
                                    Přidat
                                </Button>
                            </div>
                        </div>
                    </>
                )}
                <div className="flex justify-end pt-4">
                    <Button onClick={onClose}>Hotovo</Button>
                </div>
            </div>
        </Modal>
    );
};

export default LocationPermissionsModal;
