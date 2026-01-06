import React, { useState, useEffect, useCallback } from 'react';
import { CategoryOut } from '../types';
import Button from './common/Button';
import Icon from './common/Icon';
import Modal from './common/Modal';
import * as api from '../api';
import ErrorModal from './common/ErrorModal';
import ConfirmModal from './common/ConfirmModal';
import CategoryForm from './CategoryForm';

interface CategoryManagerProps {
    companyId: number;
}

const CategoryNode: React.FC<{
    category: CategoryOut;
    onEdit: (category: CategoryOut) => void;
    onDelete: (category: CategoryOut) => void;
    onAddSub: (parentId: number) => void;
}> = ({ category, onEdit, onDelete, onAddSub }) => {
    return (
        <div className="ml-6 pl-4 border-l border-slate-200">
            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-100 rounded-md">
                <span className="font-medium text-slate-800">{category.name}</span>
                <div className="space-x-2">
                    <Button variant="secondary" className="!text-xs !py-1 !px-2" onClick={() => onAddSub(category.id)} title="Přidat podkategorii">
                        <Icon name="fa-plus" />
                    </Button>
                    <Button variant="secondary" className="!text-xs !py-1 !px-2" onClick={() => onEdit(category)} title="Upravit">
                        <Icon name="fa-pencil-alt" />
                    </Button>
                    <Button variant="secondary" className="!text-xs !py-1 !px-2 !bg-red-100 !text-red-700 hover:!bg-red-200" onClick={() => onDelete(category)} title="Smazat">
                        <Icon name="fa-trash" />
                    </Button>
                </div>
            </div>
            {category.children.map(child => (
                <CategoryNode key={child.id} category={child} onEdit={onEdit} onDelete={onDelete} onAddSub={onAddSub} />
            ))}
        </div>
    );
};

const CategoryManager: React.FC<CategoryManagerProps> = ({ companyId }) => {
    const [categories, setCategories] = useState<CategoryOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<CategoryOut | null>(null);
    const [parentForNewCategory, setParentForNewCategory] = useState<number | null>(null);
    
    const [categoryToDelete, setCategoryToDelete] = useState<CategoryOut | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getCategories(companyId);
            setCategories(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se načíst kategorie.');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const closeModal = () => {
        setIsFormOpen(false);
        setEditingCategory(null);
        setParentForNewCategory(null);
    };

    const handleAddTopLevel = () => {
        setEditingCategory(null);
        setParentForNewCategory(null);
        setIsFormOpen(true);
    };
    
    const handleAddSub = (parentId: number) => {
        setEditingCategory(null);
        setParentForNewCategory(parentId);
        setIsFormOpen(true);
    };

    const handleEdit = (category: CategoryOut) => {
        setEditingCategory(category);
        setParentForNewCategory(null);
        setIsFormOpen(true);
    };
    
    const handleDelete = (category: CategoryOut) => {
        setCategoryToDelete(category);
    };

    const handleSave = async (categoryData: { name: string, parent_id?: number | null }) => {
        if (editingCategory) {
            await api.updateCategory(companyId, editingCategory.id, categoryData);
        } else {
            await api.createCategory(companyId, { ...categoryData, parent_id: categoryData.parent_id ?? undefined });
        }
        closeModal();
        await fetchData();
    };

    const executeDelete = async () => {
        if (!categoryToDelete) return;
        try {
            await api.deleteCategory(companyId, categoryToDelete.id);
            await fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se smazat kategorii. Ujistěte se, že neobsahuje žádné položky.');
        } finally {
            setCategoryToDelete(null);
        }
    };

    if (loading) {
        return <div className="p-4">Načítání kategorií...</div>;
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Button onClick={handleAddTopLevel}>
                    <Icon name="fa-plus" className="mr-2" /> Nová hlavní kategorie
                </Button>
            </div>
            <div className="space-y-2">
                {categories.length > 0 ? categories.map(cat => (
                    <CategoryNode key={cat.id} category={cat} onEdit={handleEdit} onDelete={handleDelete} onAddSub={handleAddSub} />
                )) : (
                    <p className="text-slate-500 text-center p-8">Zatím nebyly vytvořeny žádné kategorie.</p>
                )}
            </div>

            {isFormOpen && (
                <Modal title={editingCategory ? 'Upravit kategorii' : 'Nová kategorie'} onClose={closeModal}>
                    <CategoryForm 
                        onSave={handleSave}
                        onCancel={closeModal}
                        allCategories={categories}
                        category={editingCategory}
                        parentId={parentForNewCategory}
                    />
                </Modal>
            )}
            
            {categoryToDelete && (
                <ConfirmModal 
                    title="Smazat kategorii"
                    message={<>Opravdu chcete smazat kategorii <strong>{categoryToDelete.name}</strong>? Tuto akci nelze vrátit zpět.</>}
                    onConfirm={executeDelete}
                    onCancel={() => setCategoryToDelete(null)}
                />
            )}

            {error && <ErrorModal title="Chyba správy kategorií" message={error} onClose={() => setError(null)} />}
        </div>
    );
};

export default CategoryManager;
