import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    for (const child of category.children) ids.push(...collectIds(child));
    ids.push(category.id);
    return ids;
}

function findCategory(cats: CategoryOut[], id: number): CategoryOut | null {
    for (const cat of cats) {
        if (cat.id === id) return cat;
        const found = findCategory(cat.children, id);
        if (found) return found;
    }
    return null;
}

/** Zploštění viditelného stromu (respektuje stav rozbalení). */
function flattenVisible(
    categories: CategoryOut[],
    expandedIds: Set<number>,
    depth = 0
): Array<{ category: CategoryOut; depth: number }> {
    const result: Array<{ category: CategoryOut; depth: number }> = [];
    for (const cat of categories) {
        result.push({ category: cat, depth });
        if (expandedIds.has(cat.id) && cat.children.length > 0) {
            result.push(...flattenVisible(cat.children, expandedIds, depth + 1));
        }
    }
    return result;
}

/** Odstraní uzel ze stromu, vrátí nový strom a odstraněný uzel. */
function removeFromTree(cats: CategoryOut[], id: number): { tree: CategoryOut[]; removed: CategoryOut | null } {
    let removed: CategoryOut | null = null;
    const tree: CategoryOut[] = [];
    for (const cat of cats) {
        if (cat.id === id) {
            removed = cat;
        } else {
            const result = removeFromTree(cat.children, id);
            if (result.removed) {
                removed = result.removed;
                tree.push({ ...cat, children: result.tree });
            } else {
                tree.push(cat);
            }
        }
    }
    return { tree, removed };
}

/** Vloží uzel do stromu jako dítě zadaného rodiče (nebo na kořenovou úroveň). */
function insertIntoTree(
    cats: CategoryOut[],
    parentId: number | null,
    node: CategoryOut,
    newName: string
): CategoryOut[] {
    const updated: CategoryOut = { ...node, name: newName, parent_id: parentId ?? undefined };
    if (parentId === null) {
        return [...cats, updated];
    }
    return cats.map(cat => {
        if (cat.id === parentId) {
            return { ...cat, children: [...cat.children, updated] };
        }
        return { ...cat, children: insertIntoTree(cat.children, parentId, node, newName) };
    });
}

function getDirectChildren(cats: CategoryOut[], parentId: number | null): CategoryOut[] {
    if (parentId === null) return cats;
    return findCategory(cats, parentId)?.children ?? [];
}

interface DragHandlers {
    draggingId: number | null;
    dragOverTarget: number | 'root' | null;
    onDragStart: (id: number) => void;
    onDragEnd: () => void;
    onDragOver: (target: number | 'root') => void;
    onDrop: (targetId: number | null) => void;
}

const CategoryRow: React.FC<{
    category: CategoryOut;
    depth: number;
    rowIndex: number;
    isExpanded: boolean;
    onToggle: (id: number) => void;
    onEdit: (category: CategoryOut) => void;
    onDelete: (category: CategoryOut) => void;
    onAddSub: (parentId: number) => void;
    drag: DragHandlers;
}> = ({ category, depth, rowIndex, isExpanded, onToggle, onEdit, onDelete, onAddSub, drag }) => {
    const hasChildren = category.children.length > 0;
    const isBeingDragged = drag.draggingId === category.id;
    const isDropTarget = drag.dragOverTarget === category.id && !isBeingDragged;
    const isEven = rowIndex % 2 === 0;

    let bgClass: string;
    if (isDropTarget) {
        bgClass = "bg-blue-50 ring-2 ring-blue-400 ring-inset";
    } else if (isBeingDragged) {
        bgClass = "opacity-40 bg-slate-100";
    } else if (isEven) {
        bgClass = "bg-white hover:bg-slate-50";
    } else {
        bgClass = "bg-slate-50 hover:bg-slate-100";
    }

    return (
        <div
            draggable
            onDragStart={(e) => { e.stopPropagation(); drag.onDragStart(category.id); }}
            onDragEnd={(e) => { e.stopPropagation(); drag.onDragEnd(); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); drag.onDragOver(category.id); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drag.onDrop(category.id); }}
            className={`flex justify-between items-center py-2 pr-3 rounded-md transition-colors ${bgClass}`}
            style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}
        >
            <div className="flex items-center gap-2 min-w-0">
                <span
                    className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0 w-4"
                    title="Přetáhněte pro přesun"
                >
                    <Icon name="fa-grip-vertical" />
                </span>
                {hasChildren ? (
                    <button
                        onClick={() => onToggle(category.id)}
                        className="text-slate-400 hover:text-slate-700 w-5 h-5 flex items-center justify-center flex-shrink-0"
                        title={isExpanded ? 'Sbalit' : 'Rozbalit'}
                    >
                        <Icon name={isExpanded ? "fa-chevron-down" : "fa-chevron-right"} />
                    </button>
                ) : (
                    <span className="w-5 flex-shrink-0" />
                )}
                <span className="font-medium text-slate-800 truncate">{category.name}</span>
                {hasChildren && !isExpanded && (
                    <span className="text-xs text-slate-400 flex-shrink-0">({category.children.length})</span>
                )}
                {isDropTarget && (
                    <span className="text-xs text-blue-500 flex-shrink-0 font-medium">← přesunout sem jako podkategorii</span>
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
    );
};

const CategoryManager: React.FC<CategoryManagerProps> = ({ companyId }) => {
    const [categories, setCategories] = useState<CategoryOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<CategoryOut | null>(null);
    const [parentForNewCategory, setParentForNewCategory] = useState<number | null>(null);

    const [categoryToDelete, setCategoryToDelete] = useState<CategoryOut | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dragOverTarget, setDragOverTarget] = useState<number | 'root' | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getCategories(companyId);
            setCategories(data);
            // Při prvním načtení rozbal kořenové kategorie
            setExpandedIds(prev => prev.size === 0 ? new Set(data.map((c: CategoryOut) => c.id)) : prev);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se načíst kategorie.');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleExpanded = useCallback((id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const flatNodes = useMemo(() => flattenVisible(categories, expandedIds), [categories, expandedIds]);

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

    const handleDrop = async (targetId: number | null) => {
        if (draggingId === null) return;
        if (targetId === draggingId) { setDraggingId(null); setDragOverTarget(null); return; }

        // Zabraň cyklu – nelze přesunout na vlastního potomka
        if (targetId !== null) {
            const dragged = findCategory(categories, draggingId);
            if (dragged && collectIds(dragged).includes(targetId)) {
                setDraggingId(null); setDragOverTarget(null); return;
            }
        }

        const dragged = findCategory(categories, draggingId);
        const currentParent = dragged?.parent_id ?? null;
        if (currentParent === targetId) { setDraggingId(null); setDragOverTarget(null); return; }

        // Detekce konfliktu názvu na cílovém místě
        const siblings = getDirectChildren(categories, targetId);
        const existingNames = new Set(siblings.map(s => s.name));
        const newName = dragged && existingNames.has(dragged.name) ? `${dragged.name} - 2` : (dragged?.name ?? '');

        const localDraggingId = draggingId;
        setDraggingId(null);
        setDragOverTarget(null);

        try {
            const updatePayload: { parent_id: number | null; name?: string } = { parent_id: targetId };
            if (dragged && newName !== dragged.name) updatePayload.name = newName;
            await api.updateCategory(companyId, localDraggingId, updatePayload);

            // Lokální aktualizace stavu – bez fetchData, stránka se nepřekreslí
            setCategories(prev => {
                if (!dragged) return prev;
                const { tree, removed } = removeFromTree(prev, localDraggingId);
                if (!removed) return prev;
                return insertIntoTree(tree, targetId, removed, newName);
            });

            // Rozbal cílovou kategorii, aby byl přesunutý uzel viditelný
            if (targetId !== null) {
                setExpandedIds(prev => new Set([...prev, targetId]));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se přesunout kategorii.');
        }
    };

    const drag: DragHandlers = {
        draggingId,
        dragOverTarget,
        onDragStart: (id) => setDraggingId(id),
        onDragEnd: () => { setDraggingId(null); setDragOverTarget(null); },
        onDragOver: (target) => setDragOverTarget(target),
        onDrop: handleDrop,
    };

    const hasChildren = categoryToDelete ? categoryToDelete.children.length > 0 : false;

    if (loading) {
        return <div className="p-4">Načítání kategorií...</div>;
    }

    return (
        <div>
            <div className="flex justify-between mb-4">
                <Button variant="secondary" onClick={() => setExpandedIds(new Set())} title="Sbalit vše">
                    <Icon name="fa-compress-alt" className="mr-2" /> Sbalit vše
                </Button>
                <Button onClick={handleAddTopLevel}>
                    <Icon name="fa-plus" className="mr-2" /> Nová hlavní kategorie
                </Button>
            </div>

            {/* Drop zóna pro přesun do hlavní úrovně */}
            <div
                onDragOver={(e) => { e.preventDefault(); drag.onDragOver('root'); }}
                onDrop={(e) => { e.preventDefault(); handleDrop(null); }}
                className={[
                    "mb-3 rounded-lg border-2 border-dashed text-center text-sm transition-all duration-150",
                    draggingId !== null
                        ? dragOverTarget === 'root'
                            ? "py-3 border-blue-400 bg-blue-50 text-blue-600 font-medium"
                            : "py-3 border-slate-300 text-slate-400"
                        : "py-0 border-transparent text-transparent select-none pointer-events-none",
                ].join(" ")}
            >
                <Icon name="fa-level-up-alt" className="mr-2" />
                Přetáhněte sem pro přesun do hlavní úrovně
            </div>

            <div className="rounded-md overflow-hidden border border-slate-200">
                {categories.length > 0 ? flatNodes.map(({ category, depth }, rowIndex) => (
                    <CategoryRow
                        key={category.id}
                        category={category}
                        depth={depth}
                        rowIndex={rowIndex}
                        isExpanded={expandedIds.has(category.id)}
                        onToggle={toggleExpanded}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onAddSub={handleAddSub}
                        drag={drag}
                    />
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
