import React, { useState, useEffect } from 'react';
import { CategoryOut } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import ErrorMessage from './common/ErrorMessage';

interface CategoryFormProps {
  onSave: (categoryData: { name: string, parent_id?: number | null }) => Promise<void>;
  onCancel: () => void;
  allCategories: CategoryOut[];
  category?: CategoryOut | null;
  parentId?: number | null;
}

const CategoryOption: React.FC<{ category: CategoryOut; level: number }> = ({ category, level }) => (
    <>
        <option value={category.id}>
            {'--'.repeat(level)} {category.name}
        </option>
        {category.children.map(child => (
            <CategoryOption key={child.id} category={child} level={level + 1} />
        ))}
    </>
);

const CategoryForm: React.FC<CategoryFormProps> = ({ onSave, onCancel, allCategories, category, parentId: initialParentId }) => {
    const [name, setName] = useState(category?.name || '');
    const [parentId, setParentId] = useState<string>((category?.parent_id ?? initialParentId ?? '').toString());
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            await onSave({
                name,
                parent_id: parentId ? parseInt(parentId, 10) : null,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <ErrorMessage message={error} />
            <Input
                label="Název kategorie"
                value={name}
                onChange={e => setName(e.target.value)}
                required
            />
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nadřazená kategorie</label>
                <select 
                    value={parentId}
                    onChange={e => setParentId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    disabled={category?.id !== undefined && allCategories.some(c => c.id === category.id && c.children.length > 0)}
                >
                    <option value="">-- Žádná (kořenová) --</option>
                    {allCategories.filter(c => c.id !== category?.id).map(cat => (
                        <CategoryOption key={cat.id} category={cat} level={0} />
                    ))}
                </select>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>Zrušit</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Ukládání...' : 'Uložit kategorii'}
                </Button>
            </div>
        </form>
    );
};

export default CategoryForm;
