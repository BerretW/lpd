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

/** Sbírá ID všech potomků + samotné kategorie v post-order (listy první). */
function collectIds(category: CategoryOut): number[] {
    const ids: number[] = [];
    for (const child of category.children) {
        ids.push(...collectIds(child));
    }
    ids.push(category.id);
    return ids;
}

const CategoryNode: React.FC<{
    category: CategoryOut;
    onEdit: (category: CategoryOut) => void;
    onDelete: (category: CategoryOut) => void;
    onAddSub: (parentId: number) => void;
    depth?: number;
    collapseSignal?: number;
}> = ({ category, onEdit, onDelete, onAddSub, depth = 0, collapseSignal }) => {
    const [expanded, setExpanded] = useState(depth === 0);
    const hasChildren = category.children.length > 0;

    useEffect(() => {
        if (collapseSignal && collapseSignal > 0) {
            setExpanded(false);
        }
    }, [collapseSignal]);

    return (
        <div className={depth > 0 ? "ml-6 pl-4 border-l border-slate-200" : ""}>
            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-100 rounded-md">
                <div className="flex items-center gap-2 min-w-0">
                    {hasChildren ? (
                        <button
                            onClick={() => setExpanded((e: boolean) => !e)}
                            className="text-slate-400 hover:text-slate-700 w-5 h-5 flex items-center justify-center flex-shrink-0"
                            title={expanded ? 'Sbalit' : 'Rozbalit'}
                        >
                            <Icon name={expanded ? "fa-chevron-down" : "fa-chevron-right"} />
                        </button>
                    ) : (
                        <span className="w-5 flex-shrink-0" />
                    )}
                    <span className="font-medium text-slate-800 truncate">{category.name}</span>
                    {hasChildren && !expanded && (
                        <span className="text-xs text-slate-400 flex-shrink-0">({category.children.length})</span>
                    )}
                </div>
                <div className="space-x-2 flex-shrink-0">
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
            {expanded && hasChildren && (
                <div>
                    {category.children.map((child: CategoryOut) => (
                        <CategoryNode key={child.id} category={child} onEdit={onEdit} onDelete={onDelete} onAddSub={onAddSub} depth={depth + 1} collapseSignal={collapseSignal} />
                    ))}
                </div>
            )}
        </div>
    );
};

const CategoryManager: React.FC<CategoryManagerProps> = ({ companyId }) => {
    const [categories, setCategories] = useState<CategoryOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [collapseSignal, setCollapseSignal] = useState(0);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<CategoryOut | null>(null);
    const [parentForNewCategory, setParentForNewCategory] = useState<number | null>(null);

    const [categoryToDelete, setCategoryToDelete] = useState<CategoryOut | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const executeDelete = async (withChildren: boolean) => {
        if (!categoryToDelete) return;
        setIsDeleting(true);
        try {
            if (withChildren) {
                const ids = collectIds(categoryToDelete);
                for (const id of ids) {
                    await api.deleteCategory(companyId, id);
                }
            } else {
                await api.deleteCategory(companyId, categoryToDelete.id);
            }
            await fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se smazat kategorii.');
        } finally {
            setCategoryToDelete(null);
            setIsDeleting(false);
        }
    };

    const hasChildren = categoryToDelete ? categoryToDelete.children.length > 0 : false;

    if (loading) {
        return <div className="p-4">Načítání kategorií...</div>;
    }

    return (
        <div>
            <div className="flex justify-between mb-4">
                <Button variant="secondary" onClick={() => setCollapseSignal((s: number) => s + 1)} title="Sbalit vše">
                    <Icon name="fa-compress-alt" className="mr-2" /> Sbalit vše
                </Button>
                <Button onClick={handleAddTopLevel}>
                    <Icon name="fa-plus" className="mr-2" /> Nová hlavní kategorie
                </Button>
            </div>
            <div className="space-y-2">
                {categories.length > 0 ? categories.map((cat: CategoryOut) => (
                    <CategoryNode key={cat.id} category={cat} onEdit={handleEdit} onDelete={handleDelete} onAddSub={handleAddSub} collapseSignal={collapseSignal} />
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

            {categoryToDelete && !hasChildren && (
                <ConfirmModal
                    title="Smazat kategorii"
                    message={<>Opravdu chcete smazat kategorii <strong>{categoryToDelete.name}</strong>? Tuto akci nelze vrátit zpět.</>}
                    onConfirm={() => executeDelete(false)}
                    onCancel={() => setCategoryToDelete(null)}
                />
            )}

            {categoryToDelete && hasChildren && (
                <Modal title="Smazat kategorii" onClose={() => setCategoryToDelete(null)}>
                    <div className="text-slate-700">
                        <div className="text-center">
                            <Icon name="fa-exclamation-triangle" className="text-4xl text-yellow-500 mb-4" />
                        </div>
                        <p className="text-center text-lg mb-2">
                            Kategorie <strong>{categoryToDelete.name}</strong> obsahuje podkategorie.
                        </p>
                        <p className="text-center text-sm text-slate-500 mb-8">
                            Chcete smazat pouze tuto kategorii, nebo i všechny podkategorie?
                        </p>
                        <div className="flex justify-center gap-3 flex-wrap">
                            <Button variant="secondary" onClick={() => setCategoryToDelete(null)} disabled={isDeleting}>
                                Zrušit
                            </Button>
                            <Button variant="secondary" className="!bg-red-100 !text-red-700 hover:!bg-red-200" onClick={() => executeDelete(false)} disabled={isDeleting}>
                                Smazat jen tuto
                            </Button>
                            <Button onClick={() => executeDelete(true)} disabled={isDeleting}>
                                {isDeleting ? 'Mazání...' : 'Smazat i podkategorie'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {error && <ErrorModal title="Chyba správy kategorií" message={error} onClose={() => setError(null)} />}
        </div>
    );
};

export default CategoryManager;
