

import React, { useState, useEffect } from 'react';
import { Company } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import Icon from './common/Icon';
import ErrorMessage from './common/ErrorMessage';

interface CompanySettingsFormProps {
  company: Company;
  onSave: (companyData: Partial<Company>) => Promise<void>;
}

const CompanySettingsForm: React.FC<CompanySettingsFormProps> = ({ company, onSave }) => {
    const [formData, setFormData] = useState<Partial<Company>>(company);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setFormData(company);
    }, [company]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        try {
            await onSave(formData);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <ErrorMessage message={error} />
            <div className="p-4 border rounded-lg bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-700 mb-4">Základní informace</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Oficiální název firmy" name="legal_name" value={formData.legal_name || ''} onChange={handleChange} />
                    <Input label="Jednatel" name="executive" value={formData.executive || ''} onChange={handleChange} />
                    <Input label="IČO" name="ico" value={formData.ico || ''} onChange={handleChange} />
                    <Input label="DIČ" name="dic" value={formData.dic || ''} onChange={handleChange} />
                </div>
                <div className="mt-4">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Adresa sídla</label>
                     <textarea name="address" value={formData.address || ''} onChange={handleChange} rows={3} className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 bg-white text-slate-900"></textarea>
                </div>
            </div>
             <div className="p-4 border rounded-lg bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-700 mb-4">Bankovní spojení</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Číslo účtu" name="bank_account" value={formData.bank_account || ''} onChange={handleChange} />
                    <Input label="IBAN" name="iban" value={formData.iban || ''} onChange={handleChange} />
                </div>
            </div>
            <div className="flex justify-end items-center pt-4 space-x-4">
                {saved && (
                    <span className="text-sm text-green-600 flex items-center">
                        <Icon name="fa-check-circle" className="mr-2"/> Údaje byly úspěšně uloženy.
                    </span>
                )}
                <Button type="submit">Uložit změny</Button>
            </div>
        </form>
    );
};

export default CompanySettingsForm;