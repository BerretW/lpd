import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import Input from './common/Input';
import Button from './common/Button';

interface CustomerFormProps {
  onSave: (customerData: Partial<Omit<Client, 'id' | 'company_id'>>) => void;
  onCancel: () => void;
  customer: Client | null;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ onSave, onCancel, customer }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [legalName, setLegalName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [ico, setIco] = useState('');
    const [dic, setDic] = useState('');
    // PŘIDÁNO: Stav pro marži (jako string, aby šlo snadno psát mínus)
    const [margin, setMargin] = useState<string>('0'); 

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
            // PŘIDÁNO: Načtení existující marže
            setMargin(customer.margin_percentage?.toString() || '0');
        }
    }, [customer]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const payload: Partial<Omit<Client, 'id' | 'company_id'>> = { 
            name, 
            address,
            // PŘIDÁNO: Odeslání marže jako číslo
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

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Jméno / Název firmy" value={name} onChange={e => setName(e.target.value)} required />
            <Input label="Oficiální název (pokud se liší)" value={legalName} onChange={e => setLegalName(e.target.value)} />
            <Input label="Adresa" value={address} onChange={e => setAddress(e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Kontaktní osoba" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
              <Input label="Telefon" value={phone} onChange={e => setPhone(e.target.value)} />
              <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              
              {/* PŘIDÁNO: Input pro marži */}
              <Input 
                label="Marže (%)" 
                type="number" 
                step="0.1" // Povoluje desetinná čísla
                value={margin} 
                onChange={e => setMargin(e.target.value)} 
                placeholder="0"
              />

              <div className="grid grid-cols-2 gap-4 col-span-2">
                <Input label="IČO" value={ico} onChange={e => setIco(e.target.value)} />
                <Input label="DIČ" value={dic} onChange={e => setDic(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel}>Zrušit</Button>
                <Button type="submit">Uložit zákazníka</Button>
            </div>
        </form>
    );
};

export default CustomerForm;