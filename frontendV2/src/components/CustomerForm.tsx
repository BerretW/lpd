import React, { useState, useEffect, useCallback } from 'react';
import { Client, CategoryOut, ClientCategoryMargin } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import Icon from './common/Icon';
import * as api from '../api';
import { useAuth } from '../AuthContext';

interface CustomerFormProps {
  onSave: (customerData: Partial<Omit<Client, 'id' | 'company_id'>>) => void;
  onCancel: () => void;
  customer: Client | null;
}

// Helper pro rekurzivní vykreslení možností kategorií
const CategoryOption: React.FC<{ category: CategoryOut; level: number }> = ({ category, level }) => (
    <>
        <option value={category.id}>
            {'\u00A0'.repeat(level * 4)} {category.name} {/* Použití non-breaking space pro odsazení */}
        </option>
        {category.children.map(child => (
            <CategoryOption key={child.id} category={child} level={level + 1} />
        ))}
    </>
);

const CustomerForm: React.FC<CustomerFormProps> = ({ onSave, onCancel, customer }) => {
    const { companyId } = useAuth(); // Získáme companyId z kontextu (pokud ho nepředává Admin)
    
    // Základní údaje
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [legalName, setLegalName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [ico, setIco] = useState('');
    const [dic, setDic] = useState('');
    const [margin, setMargin] = useState<string>('0');

    // Specifické marže
    const [categories, setCategories] = useState<CategoryOut[]>([]);
    const [specialMargins, setSpecialMargins] = useState<ClientCategoryMargin[]>([]);
    
    // Formulář pro přidání marže
    const [selectedCatId, setSelectedCatId] = useState<string>('');
    const [specialMarginInput, setSpecialMarginInput] = useState<string>('');
    const [isLoadingMargins, setIsLoadingMargins] = useState(false);

    useEffect(() => {
        if (customer) {
            setName(customer.name);
            setAddress(customer.address || '');
            setEmail(customer.email || '');
            setPhone(customer.phone || '');
            setLegalName(customer.legal_name || '');
            setContactPerson(customer.contact_person || '');
            setIco(customer.ico || '');
            setDic(customer.dic || '');
            setMargin(customer.margin_percentage?.toString() || '0');

            // Načtení kategorií a existujících marží pouze pokud editujeme existujícího zákazníka
            if (companyId) {
                api.getCategories(companyId).then(setCategories);
                fetchMargins();
            }
        }
    }, [customer, companyId]);

    const fetchMargins = useCallback(async () => {
        if (customer && companyId) {
            setIsLoadingMargins(true);
            try {
                const margins = await api.getClientCategoryMargins(companyId, customer.id);
                setSpecialMargins(margins);
            } catch (e) {
                console.error("Failed to load margins", e);
            } finally {
                setIsLoadingMargins(false);
            }
        }
    }, [customer, companyId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const payload: Partial<Omit<Client, 'id' | 'company_id'>> = { 
            name, 
            address,
            margin_percentage: parseFloat(margin) || 0
        };
        if (email) payload.email = email;
        if (phone) payload.phone = phone;
        if (legalName) payload.legal_name = legalName;
        if (contactPerson) payload.contact_person = contactPerson;
        if (ico) payload.ico = ico;
        if (dic) payload.dic = dic;
        
        onSave(payload);
    };

    const handleAddSpecialMargin = async () => {
        if (!selectedCatId || !specialMarginInput || !companyId || !customer) return;

        const catId = parseInt(selectedCatId);
        const marginVal = parseFloat(specialMarginInput);

        try {
            await api.setClientCategoryMargin(companyId, customer.id, {
                category_id: catId,
                margin_percentage: marginVal
            });
            
            // Reset vstupů a reload
            setSpecialMarginInput('');
            setSelectedCatId('');
            await fetchMargins();
        } catch (e) {
            alert('Nepodařilo se uložit marži.');
        }
    };

    const handleDeleteSpecialMargin = async (catId: number) => {
        if (!companyId || !customer) return;
        try {
            await api.deleteClientCategoryMargin(companyId, customer.id, catId);
            await fetchMargins();
        } catch (e) {
            alert('Nepodařilo se smazat marži.');
        }
    };

    // Pomocná funkce pro získání názvu kategorie (pokud API nevrací name v margin objektu)
    const getCategoryName = (id: number) => {
        const findCat = (cats: CategoryOut[]): string | undefined => {
            for (const cat of cats) {
                if (cat.id === id) return cat.name;
                const found = findCat(cat.children);
                if (found) return found;
            }
            return undefined;
        };
        return findCat(categories) || `ID: ${id}`;
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <h3 className="font-semibold text-slate-800 border-b pb-2">Základní údaje</h3>
                <Input label="Jméno / Název firmy" value={name} onChange={e => setName(e.target.value)} required />
                <Input label="Oficiální název (pokud se liší)" value={legalName} onChange={e => setLegalName(e.target.value)} />
                <Input label="Adresa" value={address} onChange={e => setAddress(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Kontaktní osoba" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                    <Input label="Telefon" value={phone} onChange={e => setPhone(e.target.value)} />
                    <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                    
                    <Input 
                        label="Výchozí marže (%)" 
                        type="number" 
                        step="0.1" 
                        value={margin} 
                        onChange={e => setMargin(e.target.value)} 
                        placeholder="0"
                        title="Tato marže se použije, pokud není nastavena specifická marže pro kategorii."
                    />

                    <div className="grid grid-cols-2 gap-4 col-span-2">
                        <Input label="IČO" value={ico} onChange={e => setIco(e.target.value)} />
                        <Input label="DIČ" value={dic} onChange={e => setDic(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Sekce pro specifické marže - zobrazíme jen u existujícího zákazníka */}
            {customer && (
                <div className="pt-4 border-t border-slate-200">
                    <h3 className="font-semibold text-slate-800 mb-4">Specifické marže podle kategorií</h3>
                    
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Přidat novou výjimku</label>
                        <div className="flex gap-2 items-end">
                            <div className="flex-grow">
                                <select 
                                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                                    value={selectedCatId}
                                    onChange={e => setSelectedCatId(e.target.value)}
                                >
                                    <option value="">-- Vyberte kategorii --</option>
                                    {categories.map(cat => <CategoryOption key={cat.id} category={cat} level={0} />)}
                                </select>
                            </div>
                            <div className="w-32">
                                <Input 
                                    type="number" 
                                    step="0.1" 
                                    placeholder="Marže %" 
                                    value={specialMarginInput}
                                    onChange={e => setSpecialMarginInput(e.target.value)}
                                />
                            </div>
                            <Button type="button" onClick={handleAddSpecialMargin} disabled={!selectedCatId || !specialMarginInput} variant="secondary">
                                <Icon name="fa-plus" /> Přidat
                            </Button>
                        </div>
                    </div>

                    <div className="border rounded-md overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kategorie</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Marže</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Akce</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {isLoadingMargins ? (
                                    <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-slate-500">Načítání...</td></tr>
                                ) : specialMargins.length > 0 ? (
                                    specialMargins.map(m => (
                                        <tr key={m.category_id}>
                                            <td className="px-4 py-2 text-sm text-slate-900">{m.category_name || getCategoryName(m.category_id)}</td>
                                            <td className="px-4 py-2 text-sm text-slate-900 font-bold">{m.margin_percentage} %</td>
                                            <td className="px-4 py-2 text-right">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleDeleteSpecialMargin(m.category_id)}
                                                    className="text-red-600 hover:text-red-900 text-sm"
                                                >
                                                    <Icon name="fa-trash" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-slate-500 italic">Žádné specifické marže nejsou nastaveny.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!customer && (
                <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded border border-blue-200">
                    <Icon name="fa-info-circle" className="mr-2"/>
                    Specifické marže pro kategorie bude možné nastavit až po vytvoření zákazníka.
                </div>
            )}

            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel}>Zrušit</Button>
                <Button type="submit">Uložit zákazníka</Button>
            </div>
        </form>
    );
};

export default CustomerForm;