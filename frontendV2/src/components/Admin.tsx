import React, { useState, useEffect, useCallback } from 'react';
import { Client, Membership, WorkType, RoleEnum, Company } from '../types';
import Button from './common/Button';
import Card from './common/Card';
import Icon from './common/Icon';
import Modal from './common/Modal';
import CustomerForm from './CustomerForm';
import WorkRateForm from './WorkRateForm';
import CompanySettingsForm from './CompanySettingsForm';
import * as api from '../api';
import ErrorModal from './common/ErrorModal';
import AttendanceSettingsForm from './AttendanceSettingsForm';
import ConfirmModal from './common/ConfirmModal';
import InviteMemberForm from './InviteMemberForm';
import SmtpSettingsForm from './SmtpSettingsForm';
import TriggerManager from './TriggerManager';

type AdminView = 'clients' | 'members' | 'rates' | 'settings' | 'attendance' | 'smtp' | 'triggers';

interface AdminProps {
  companyId: number;
}

const Admin: React.FC<AdminProps> = ({ companyId }) => {
    const [view, setView] = useState<AdminView>('clients');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [clients, setClients] = useState<Client[]>([]);
    const [members, setMembers] = useState<Membership[]>([]);
    const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
    const [company, setCompany] = useState<Company | null>(null);
    
    const [editingItem, setEditingItem] = useState<Client | WorkType | null>(null);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    const fetchData = useCallback(async () => {
        try {
            if (view === 'clients') setClients(await api.getClients(companyId));
            if (view === 'members') setMembers(await api.getMembers(companyId));
            if (view === 'rates') setWorkTypes(await api.getWorkTypes(companyId));
            if (view === 'settings') setCompany(await api.getCompany(companyId));
        } catch (err) {
            setError(err instanceof Error ? err.message : `Nepodařilo se načíst data pro sekci: ${view}`);
        }
    }, [companyId, view]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openModal = (item: Client | WorkType | null = null) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingItem(null);
        setIsModalOpen(false);
    };

    const handleSaveClient = async (clientData: any) => {
        try {
            const action = editingItem ? api.updateClient(companyId, editingItem.id, clientData) : api.createClient(companyId, clientData);
            await action;
            fetchData();
            closeModal();
        } catch(error) {
            setError(error instanceof Error ? error.message : `Chyba při ukládání zákazníka`);
        }
    };
    
    const executeDeleteClient = async () => {
        if (!clientToDelete) return;
        try {
            await api.deleteClient(companyId, clientToDelete.id);
            fetchData();
        } catch (error) {
            setError(error instanceof Error ? error.message : `Chyba při mazání zákazníka`);
        } finally {
            setClientToDelete(null);
        }
    };

    const handleSaveWorkType = async (rateData: any) => {
        try {
            const action = editingItem ? Promise.resolve() : api.createWorkType(companyId, rateData); // Update not implemented in API file
            await action;
            fetchData();
            closeModal();
        } catch (error) {
            setError(error instanceof Error ? error.message : `Chyba při ukládání sazby.`);
        }
    };
    
    const handleSaveCompanySettings = async (companyData: Partial<Company>) => {
        try {
            const updatedCompany = await api.updateCompanyBillingInfo(companyId, companyData);
            setCompany(updatedCompany);
        } catch (error) {
            setError(error instanceof Error ? error.message : `Chyba při ukládání nastavení`);
        }
    };

    const handleRoleChange = async (userId: number, role: RoleEnum) => {
        try {
            await api.updateMemberRole(companyId, userId, role);
            fetchData();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Nepodařilo se změnit roli uživatele.');
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-6">Správa systému</h1>

            <nav className="mb-6 grid grid-cols-2 md:grid-cols-7 gap-1 bg-slate-200 p-1 rounded-lg">
                <button onClick={() => setView('clients')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'clients' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Zákazníci</button>
                <button onClick={() => setView('members')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'members' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Zaměstnanci</button>
                <button onClick={() => setView('rates')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'rates' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Sazby práce</button>
                <button onClick={() => setView('attendance')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'attendance' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Docházka</button>
                <button onClick={() => setView('settings')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'settings' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Nastavení</button>
                <button onClick={() => setView('smtp')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'smtp' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>SMTP</button>
                <button onClick={() => setView('triggers')} className={`w-full p-2 rounded-md font-semibold transition-colors ${view === 'triggers' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>Notifikace</button>
            </nav>
            
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-slate-700">
                        {view === 'clients' && 'Správa zákazníků'}
                        {view === 'members' && 'Správa zaměstnanců'}
                        {view === 'rates' && 'Správa sazeb práce'}
                        {view === 'attendance' && 'Nastavení docházky'}
                        {view === 'settings' && 'Fakturační údaje firmy'}
                        {view === 'smtp' && 'Nastavení odchozí pošty (SMTP)'}
                        {view === 'triggers' && 'Nastavení automatických notifikací'}
                    </h2>
                     {view === 'clients' && <Button onClick={() => openModal()}><Icon name="fa-plus" className="mr-2" /> Přidat zákazníka</Button>}
                     {view === 'members' && <Button onClick={() => setIsInviteModalOpen(true)}><Icon name="fa-user-plus" className="mr-2" /> Pozvat zaměstnance</Button>}
                     {view === 'rates' && <Button onClick={() => openModal()}><Icon name="fa-plus" className="mr-2" /> Přidat sazbu</Button>}
                </div>

                {view === 'clients' && (
                    <ul className="divide-y divide-slate-200">
                        {clients.map(c => (
                            <li key={c.id} className="py-3 flex justify-between items-center">
                                <div><p className="font-semibold text-black">{c.name}</p><p className="text-sm text-slate-500">{c.address}</p></div>
                                <div className="space-x-2">
                                    <Button variant="secondary" onClick={() => openModal(c)}>Upravit</Button>
                                    <Button variant="secondary" className="!bg-red-100 !text-red-700 hover:!bg-red-200" onClick={() => setClientToDelete(c)}>
                                        <Icon name="fa-trash" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                {view === 'members' && (
                    <ul className="divide-y divide-slate-200">
                        {members.map(m => (
                            <li key={m.user.id} className="py-3 flex justify-between items-center">
                                <div><p className="font-semibold text-black">{m.user.email}</p></div>
                                <select value={m.role} onChange={e => handleRoleChange(m.user.id, e.target.value as RoleEnum)} className="p-2 border rounded">
                                    <option value={RoleEnum.Member}>Member</option>
                                    <option value={RoleEnum.Admin}>Admin</option>
                                    <option value={RoleEnum.Owner}>Owner</option>
                                </select>
                            </li>
                        ))}
                    </ul>
                )}
                 {view === 'rates' && (
                    <ul className="divide-y divide-slate-200">
                        {workTypes.map(rate => (
                            <li key={rate.id} className="py-3 flex justify-between items-center">
                                <div><p className="font-semibold text-black">{rate.name}</p><p className="text-sm text-slate-500">{rate.rate} Kč/hod</p></div>
                            </li>
                        ))}
                    </ul>
                )}
                {view === 'attendance' && (
                    <AttendanceSettingsForm companyId={companyId} />
                )}
                {view === 'settings' && company && (
                    <CompanySettingsForm company={company} onSave={handleSaveCompanySettings} />
                )}
                {view === 'smtp' && (
                    <SmtpSettingsForm companyId={companyId} />
                )}
                {view === 'triggers' && (
                    <TriggerManager companyId={companyId} />
                )}
            </Card>

            {isModalOpen && (
                <Modal title={editingItem ? "Upravit" : "Přidat"} onClose={closeModal}>
                    {view === 'clients' && <CustomerForm customer={editingItem as Client | null} onSave={handleSaveClient} onCancel={closeModal} />}
                    {view === 'rates' && <WorkRateForm workRate={editingItem as WorkType | null} onSave={handleSaveWorkType} onCancel={closeModal} />}
                </Modal>
            )}
            {isInviteModalOpen && (
                <Modal title="Pozvat nového zaměstnance" onClose={() => setIsInviteModalOpen(false)}>
                    <InviteMemberForm
                        companyId={companyId}
                        onSave={() => {
                            setIsInviteModalOpen(false);
                            fetchData();
                        }}
                        onCancel={() => setIsInviteModalOpen(false)}
                    />
                </Modal>
            )}
            {clientToDelete && (
                <ConfirmModal
                    title="Smazat zákazníka"
                    message={<>Opravdu chcete smazat zákazníka <strong>{clientToDelete.name}</strong>? <br/> Všechny jeho zakázky zůstanou, ale budou bez přiřazeného klienta.</>}
                    onConfirm={executeDeleteClient}
                    onCancel={() => setClientToDelete(null)}
                />
            )}
            {error && <ErrorModal title="Chyba ve správě systému" message={error} onClose={() => setError(null)} />}
        </div>
    );
};

export default Admin;