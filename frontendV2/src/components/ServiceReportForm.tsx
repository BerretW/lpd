import React, { useState, useEffect } from 'react';
import { WorkOrderOut, TaskOut, TimeLogOut, ServiceReport, Photo, InventoryItem, WorkTypeName, RoleEnum, LocationOut } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import Icon from './common/Icon';
import SignaturePad from './SignaturePad';
import CameraModal from './CameraModal';
import MaterialSelectorModal from './MaterialSelectorModal';
import * as api from '../api';
import { useAuth } from '../AuthContext';


interface ServiceReportFormProps {
    workOrder: WorkOrderOut;
    task: TaskOut;
    totalHours?: number;
    timeLogs?: TimeLogOut[] | null;
    onSave: (report: ServiceReport) => void;
}

const ServiceReportForm: React.FC<ServiceReportFormProps> = ({ workOrder, task, totalHours, timeLogs, onSave }) => {
    const { user, companyId, role } = useAuth();
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [accessibleLocations, setAccessibleLocations] = useState<LocationOut[]>([]);
    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;
    
    // Form state
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [arrivalTime, setArrivalTime] = useState('');
    const [workHours, setWorkHours] = useState(totalHours || 0);
    const [technicians, setTechnicians] = useState<string[]>([]);
    const [kmDriven, setKmDriven] = useState(0);
    const [workDescription, setWorkDescription] = useState(task.description || '');
    const [isWarrantyRepair, setIsWarrantyRepair] = useState(false);
    const [materialsUsed, setMaterialsUsed] = useState<{ id: string; name: string; quantity: number }[]>([]);
    const [notes, setNotes] = useState('');
    const [workType, setWorkType] = useState<WorkTypeName[]>([]);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [technicianSignature, setTechnicianSignature] = useState<string | null>(null);
    const [customerSignature, setCustomerSignature] = useState<string | null>(null);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);

    useEffect(() => {
        // Pre-populate technicians from task assignee or logged-in user
        const tech = task.assignee?.email || user?.email;
        if (tech) {
            setTechnicians([tech]);
        }
        
        // Pre-populate materials from task used_items
        if (task.used_items) {
            const initialMaterials = task.used_items.map(item => ({
                id: String(item.inventory_item.id),
                name: item.inventory_item.name,
                quantity: item.quantity,
            }));
            setMaterialsUsed(initialMaterials);
        }

        // Fetch company inventory and user-specific locations for material selector
        if (companyId) {
            api.getInventoryItems(companyId).then(setInventory);
            if (!isAdmin) {
                api.getMyLocations(companyId)
                    .then(setAccessibleLocations)
                    .catch(console.error);
            }
        }

    }, [task, user, companyId, isAdmin]);
    
    const handlePhotoTaken = (dataUrl: string) => {
        const newPhoto: Photo = { id: `photo-${Date.now()}`, dataUrl };
        setPhotos(prev => [...prev, newPhoto]);
        setIsCameraOpen(false);
    };
    
    const handleRemovePhoto = (id: string) => {
        setPhotos(prev => prev.filter(p => p.id !== id));
    };

    const handleSaveMaterials = (selection: { id: string; name: string; quantity: number }[]) => {
        setMaterialsUsed(selection);
        setIsMaterialSelectorOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const report: ServiceReport = {
            id: `report-${Date.now()}`,
            jobId: workOrder.id,
            taskId: task.id,
            date,
            technicians,
            arrivalTime,
            kmDriven,
            workDescription,
            isWarrantyRepair,
            materialsUsed,
            notes,
            workType,
            photos,
            workHours,
            technicianSignature,
            customerSignature,
            timeLogs: timeLogs || [],
        };

        onSave(report);
    };

    const workTypeTranslations: Record<WorkTypeName, string> = {
      [WorkTypeName.Installation]: "Montáž",
      [WorkTypeName.Service]: "Servis",
      [WorkTypeName.Revision]: "Revize",
      [WorkTypeName.Repair]: "Oprava"
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Datum" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                <Input label="Čas příjezdu" type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} />
                <Input label="Počet hodin" type="number" step="0.1" value={workHours} onChange={e => setWorkHours(Number(e.target.value))} />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input label="Jména techniků (oddělit čárkou)" value={technicians.join(', ')} onChange={e => setTechnicians(e.target.value.split(',').map(s => s.trim()))} required />
                 <Input label="Počet ujetých km" type="number" value={kmDriven} onChange={e => setKmDriven(Number(e.target.value))} />
             </div>

             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Popis provedené práce</label>
                <textarea value={workDescription} onChange={e => setWorkDescription(e.target.value)} rows={4} className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-slate-900" required></textarea>
            </div>
            
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <input type="checkbox" id="isWarranty" checked={isWarrantyRepair} onChange={e => setIsWarrantyRepair(e.target.checked)} className="h-4 w-4 rounded" />
                    <label htmlFor="isWarranty" className="font-medium text-slate-800">Záruční oprava</label>
                </div>
                <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Druh práce</label>
                     <select value={workType[0] || ''} onChange={e => setWorkType([e.target.value as WorkTypeName])} className="p-2 border rounded-md bg-white text-slate-900">
                        <option value="">-- Vybrat --</option>
                        {Object.values(WorkTypeName).map(wt => <option key={wt} value={wt}>{workTypeTranslations[wt]}</option>)}
                     </select>
                </div>
            </div>

            <div>
                 <div className="flex justify-between items-center mb-2">
                     <h3 className="font-medium text-slate-800">Použitý materiál</h3>
                     <Button type="button" variant="secondary" onClick={() => setIsMaterialSelectorOpen(true)}>
                         <Icon name="fa-edit" className="mr-2"/> Upravit materiál
                     </Button>
                 </div>
                 <ul className="text-sm border rounded-md p-2 min-h-[50px] bg-slate-50 text-slate-700">
                     {materialsUsed.length > 0 ? materialsUsed.map(mat => (
                         <li key={mat.id}>{mat.name} - {mat.quantity} ks</li>
                     )) : <li className="italic text-slate-500">Žádný materiál</li>}
                 </ul>
            </div>
            
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Poznámky</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-slate-900"></textarea>
            </div>

            <div>
                 <div className="flex justify-between items-center mb-2">
                     <h3 className="font-medium text-slate-800">Fotodokumentace</h3>
                     <Button type="button" variant="secondary" onClick={() => setIsCameraOpen(true)}>
                         <Icon name="fa-camera" className="mr-2"/> Přidat foto
                     </Button>
                 </div>
                 <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[60px] bg-slate-50">
                    {photos.map(photo => (
                        <div key={photo.id} className="relative">
                            <img src={photo.dataUrl} alt="Documentation" className="h-20 w-20 object-cover rounded"/>
                            <button type="button" onClick={() => handleRemovePhoto(photo.id)} className="absolute top-0 right-0 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">&times;</button>
                        </div>
                    ))}
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-medium mb-2 text-slate-800">Podpis technika</h3>
                    <SignaturePad onSave={setTechnicianSignature} />
                </div>
                <div>
                    <h3 className="font-medium mb-2 text-slate-800">Podpis zákazníka</h3>
                    <SignaturePad onSave={setCustomerSignature} />
                </div>
            </div>
            
            <div className="flex justify-end pt-4">
                <Button type="submit">
                    <Icon name="fa-save" className="mr-2"/> Uložit a vygenerovat list
                </Button>
            </div>

            {isCameraOpen && <CameraModal onClose={() => setIsCameraOpen(false)} onPhotoTaken={handlePhotoTaken} />}
            {isMaterialSelectorOpen && (
                <MaterialSelectorModal
                    inventory={inventory}
                    initialSelection={materialsUsed}
                    onClose={() => setIsMaterialSelectorOpen(false)}
                    onSave={handleSaveMaterials}
                    accessibleLocations={accessibleLocations}
                />
            )}
        </form>
    );
};

export default ServiceReportForm;
