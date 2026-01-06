import React, { useState } from 'react';
import { RoleEnum } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import ErrorMessage from './common/ErrorMessage';
import * as api from '../api';
import Icon from './common/Icon';

interface InviteMemberFormProps {
  companyId: number;
  onSave: () => void;
  onCancel: () => void;
}

const generatePassword = (length = 12) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * n));
    }
    return password;
};

const InviteMemberForm: React.FC<InviteMemberFormProps> = ({ companyId, onSave, onCancel }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [role, setRole] = useState<RoleEnum>(RoleEnum.Member);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            await api.createMember(companyId, { email, password, role });
            onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Pozvání selhalo.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePassword = () => {
        const newPassword = generatePassword();
        setPassword(newPassword);
        setIsPasswordVisible(true);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <ErrorMessage message={error} />
            <Input
                label="Emailová adresa"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={isSaving}
                autoComplete="off"
            />
            <div>
                 <div className="flex justify-between items-baseline mb-1">
                    <label htmlFor="password-invite" className="block text-sm font-medium text-slate-700">
                        Počáteční heslo
                    </label>
                    <Button type="button" variant="secondary" className="!text-xs !py-1 !px-2" onClick={handleGeneratePassword}>
                        Generovat heslo
                    </Button>
                </div>
                <div className="relative">
                    <Input
                        id="password-invite"
                        type={isPasswordVisible ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={8}
                        disabled={isSaving}
                        autoComplete="new-password"
                        className="pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-700"
                        aria-label={isPasswordVisible ? "Skrýt heslo" : "Zobrazit heslo"}
                    >
                        <Icon name={isPasswordVisible ? 'fa-eye-slash' : 'fa-eye'} />
                    </button>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                    value={role}
                    onChange={e => setRole(e.target.value as RoleEnum)}
                    className="w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white text-slate-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    disabled={isSaving}
                >
                    <option value={RoleEnum.Member}>Člen (Member)</option>
                    <option value={RoleEnum.Admin}>Administrátor (Admin)</option>
                </select>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
                    Zrušit
                </Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Vytváření...' : 'Vytvořit účet'}
                </Button>
            </div>
        </form>
    );
};

export default InviteMemberForm;
