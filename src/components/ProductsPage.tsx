import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem, NewMenuItem } from '../api/client';
import {
  addMenuItem,
  addProductCategory,
  addProductCategoryWithStyle,
  deleteMenuItem,
  deleteProductCategory,
  getBarcodeEnabled,
  getMenuItems,
  getProductCategories,
  renameProductCategory,
  updateMenuItem,
  updateProductCategory,
  type ProductCategory,
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { handleNumberInputFocus } from '../utils/inputHelpers';

interface ProductsPageProps {
  onBack: () => void;
}

type ProductDraft = {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  description: string;
  price: string;
  track_stock: boolean;
  stock_quantity: string;
  low_stock_limit: string;
};

const defaultDraft: ProductDraft = {
  name: '',
  sku: '',
  barcode: '',
  category: 'General',
  description: '',
  price: '',
  track_stock: false,
  stock_quantity: '0',
  low_stock_limit: '5',
};

const ProductsPage: React.FC<ProductsPageProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { formatMoney } = useCurrency();
  const { showError, showSuccess } = useNotification();

  const [products, setProducts] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(defaultDraft);
  const [barcodeEnabled, setBarcodeEnabled] = useState(false);

  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('📦');
  const [newCategoryColor, setNewCategoryColor] = useState('#8B5CF6');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const categoryUpdateTimersRef = useRef<Record<number, number>>({});

  const title = useMemo(() => (editingId ? 'Edit Product' : 'Add Product'), [editingId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getMenuItems();
      setProducts(items);
    } catch (e) {
      showError('Load failed', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const rows = await getProductCategories();
      setCategories(rows);
    } catch (e) {
      showError('Categories', e instanceof Error ? e.message : String(e));
    } finally {
      setCategoriesLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void load();
    void loadCategories();
  }, [load, loadCategories]);

  useEffect(() => {
    const loadBarcodeSetting = async () => {
      try {
        const enabled = await getBarcodeEnabled();
        setBarcodeEnabled(!!enabled);
      } catch {
        setBarcodeEnabled(false);
      }
    };
    void loadBarcodeSetting();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setDraft(defaultDraft);
    setIsModalOpen(true);
  };

  const openEdit = (p: MenuItem) => {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      category: p.category || 'General',
      description: p.description ?? '',
      price: String(p.price ?? ''),
      track_stock: (p.track_stock ?? 0) === 1,
      stock_quantity: String(p.stock_quantity ?? 0),
      low_stock_limit: String(p.low_stock_limit ?? 5),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const parsePositiveFloat = (raw: string) => {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  const parseNonNegativeInt = (raw: string) => {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : NaN;
  };

  const save = async () => {
    const name = draft.name.trim();
    const sku = draft.sku.trim();
    const barcode = draft.barcode.trim();
    const category = draft.category.trim();
    const description = draft.description.trim();
    const price = parsePositiveFloat(draft.price);

    if (!name) {
      showError('Validation', 'Name is required');
      return;
    }
    if (!category) {
      showError('Validation', 'Category is required');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showError('Validation', 'Price must be a valid number');
      return;
    }

    const track_stock = draft.track_stock ? 1 : 0;
    const stock_quantity = draft.track_stock ? parseNonNegativeInt(draft.stock_quantity) : 0;
    const low_stock_limit = draft.track_stock ? parseNonNegativeInt(draft.low_stock_limit) : 0;

    if (draft.track_stock) {
      if (!Number.isFinite(stock_quantity) || stock_quantity < 0) {
        showError('Validation', 'Stock quantity must be a non-negative integer');
        return;
      }
      if (!Number.isFinite(low_stock_limit) || low_stock_limit < 0) {
        showError('Validation', 'Low stock limit must be a non-negative integer');
        return;
      }
    }

    const payload: NewMenuItem = {
      name,
      sku: sku || undefined,
      barcode: barcode || undefined,
      category,
      description,
      price,
      is_available: true,
      track_stock,
      stock_quantity,
      low_stock_limit,
    };

    try {
      if (editingId) {
        await updateMenuItem(editingId, payload);
        showSuccess('Saved', 'Product updated');
      } else {
        await addMenuItem(payload);
        showSuccess('Saved', 'Product added');
      }

      // Keep the categories list in sync (ignore duplicate errors).
      try {
        await addProductCategory(category);
      } catch {
        // ignore
      }

      closeModal();
      await load();
      await loadCategories();
    } catch (e) {
      showError('Save failed', e instanceof Error ? e.message : String(e));
    }
  };

  const openCategoriesManager = () => {
    setNewCategoryName('');
    setNewCategoryEmoji('📦');
    setNewCategoryColor('#8B5CF6');
    setIsCategoriesModalOpen(true);
  };

  const closeCategoriesManager = () => {
    setIsCategoriesModalOpen(false);
    setNewCategoryName('');
    setNewCategoryEmoji('📦');
    setNewCategoryColor('#8B5CF6');
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      showError('Validation', 'Category name is required');
      return;
    }
    try {
      await addProductCategoryWithStyle({
        name,
        emoji: (newCategoryEmoji || '').trim() || undefined,
        color: (newCategoryColor || '').trim() || undefined,
      });
      setNewCategoryName('');
      await loadCategories();
      showSuccess('Saved', 'Category added');
    } catch (e) {
      showError('Categories', e instanceof Error ? e.message : String(e));
    }
  };

  const renameCategory = async (c: ProductCategory) => {
    const next = prompt('Rename category', c.name);
    if (next === null) return;
    const name = next.trim();
    if (!name) {
      showError('Validation', 'Category name is required');
      return;
    }
    try {
      await renameProductCategory(c.id, name);
      await loadCategories();
      showSuccess('Saved', 'Category renamed');
    } catch (e) {
      showError('Categories', e instanceof Error ? e.message : String(e));
    }
  };

  const scheduleCategoryUpdate = (categoryId: number, updates: { color?: string; emoji?: string }) => {
    // Optimistic UI update to avoid flicker / dropdown closing.
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, ...updates } : c)));

    const existing = categoryUpdateTimersRef.current[categoryId];
    if (existing) {
      window.clearTimeout(existing);
    }

    categoryUpdateTimersRef.current[categoryId] = window.setTimeout(async () => {
      try {
        await updateProductCategory(categoryId, updates);
      } catch (e) {
        showError('Categories', e instanceof Error ? e.message : String(e));
        // Recover from rejected updates by reloading the canonical state.
        void loadCategories();
      }
    }, 300);
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const clean = (hex || '').replace('#', '').trim();
    if (clean.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return `rgba(0,0,0,${alpha})`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const allCategoryNames = useMemo(() => {
    const fromCategories = categories.map((c) => c.name);
    const fromProducts = Array.from(new Set(products.map((p) => (p.category || 'General').trim()).filter(Boolean)));
    const set = new Set<string>();
    for (const n of [...fromCategories, ...fromProducts]) set.add(n);
    return Array.from(set);
  }, [categories, products]);

  const normalizedSearch = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const productMatchesQuery = useCallback(
    (p: MenuItem) => {
      if (!normalizedSearch) return true;
      const hay = `${p.name} ${p.description ?? ''} ${p.category ?? ''}`.toLowerCase();
      return hay.includes(normalizedSearch);
    },
    [normalizedSearch]
  );

  const categoryMatchesQuery = useCallback(
    (categoryName: string) => {
      if (!normalizedSearch) return true;
      return categoryName.toLowerCase().includes(normalizedSearch);
    },
    [normalizedSearch]
  );

  const visibleCategoryNames = useMemo(() => {
    if (!normalizedSearch) return allCategoryNames;
    return allCategoryNames.filter((categoryName) => {
      if (categoryMatchesQuery(categoryName)) return true;
      return products
        .filter((p) => (p.category || 'General').trim() === categoryName)
        .some((p) => productMatchesQuery(p));
    });
  }, [allCategoryNames, categoryMatchesQuery, normalizedSearch, productMatchesQuery, products]);

  const expandAll = () => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const name of visibleCategoryNames) next[name] = true;
      return next;
    });
  };

  const collapseAll = () => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const name of visibleCategoryNames) next[name] = false;
      return next;
    });
  };

  const categoryStyle = useCallback(
    (name: string) => {
      const c = categories.find((x) => x.name === name);
      const color = (c?.color || '').trim();
      const emoji = (c?.emoji || '').trim();
      return {
        color: color && color.startsWith('#') ? color : undefined,
        emoji: emoji || '📦',
      };
    },
    [categories]
  );

  const toggleExpanded = (categoryName: string) => {
    setExpanded((prev) => ({ ...prev, [categoryName]: !prev[categoryName] }));
  };

  const removeCategory = async (c: ProductCategory) => {
    if (!confirm(`Delete category "${c.name}"? Products will keep their current category text.`)) return;
    try {
      await deleteProductCategory(c.id);
      await loadCategories();
      showSuccess('Deleted', 'Category removed');
    } catch (e) {
      showError('Categories', e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (p: MenuItem) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await deleteMenuItem(p.id);
      showSuccess('Deleted', 'Product removed');
      await load();
    } catch (e) {
      showError('Delete failed', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: colors.primary, color: colors.text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" className="bc-btn bc-btn-outline" onClick={onBack} style={{ width: 'auto' }}>
            Back
          </button>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: colors.text }}>Products</div>
            <div style={{ fontSize: '14px', color: colors.textSecondary }}>Inventory and services</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="bc-btn bc-btn-outline" onClick={openCategoriesManager} style={{ width: 'auto' }}>
            Categories
          </button>
          <button type="button" className="bc-btn bc-btn-primary" onClick={openAdd} style={{ width: 'auto' }}>
            Add Product
          </button>
        </div>
      </div>

      <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: '12px' }}>
          <input
            className="bc-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories or products…"
            style={{ maxWidth: '520px', flex: '1 1 320px' }}
          />

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="bc-btn bc-btn-outline" onClick={expandAll} style={{ width: 'auto' }}>
              Expand All
            </button>
            <button type="button" className="bc-btn bc-btn-outline" onClick={collapseAll} style={{ width: 'auto' }}>
              Collapse All
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Loading…</div>
        ) : products.length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>No products yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {visibleCategoryNames.length === 0 ? (
              <div style={{ color: colors.textSecondary, fontSize: '14px' }}>No matches.</div>
            ) : null}

            {visibleCategoryNames.map((categoryName) => {
              const groupAll = products.filter((p) => (p.category || 'General').trim() === categoryName);
              const showAllProducts = normalizedSearch ? categoryMatchesQuery(categoryName) : true;
              const group = showAllProducts ? groupAll : groupAll.filter((p) => productMatchesQuery(p));
              // Always show categories even if empty (removed: if (group.length === 0) return null;)
              const isOpen = normalizedSearch ? true : (expanded[categoryName] ?? true);
              const style = categoryStyle(categoryName);
              const accent = style.color ?? '#94A3B8';
              const border = hexToRgba(accent, 0.35);
              const bg = hexToRgba(accent, 0.08);
              return (
                <div
                  key={categoryName}
                  className="bc-card"
                  style={{
                    padding: '0',
                    overflow: 'hidden',
                    borderRadius: '12px',
                    border: `1px solid ${border}`,
                    background: bg,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(categoryName)}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      borderLeft: `6px solid ${accent}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '18px' }}>{style.emoji}</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: colors.text }}>{categoryName}</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary }}>{groupAll.length} product(s)</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: 800 }}>{isOpen ? 'Hide' : 'Show'}</div>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 12px 12px 12px' }}>
                      {group.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: colors.textSecondary }}>
                          No products in this category yet.
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="bc-table" style={{ width: '100%', borderCollapse: 'collapse', background: colors.surface, borderRadius: '10px', overflow: 'hidden' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Name</th>
                                <th style={{ textAlign: 'right', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Price</th>
                                <th style={{ textAlign: 'center', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Track Stock</th>
                                <th style={{ textAlign: 'right', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Stock</th>
                                <th style={{ textAlign: 'right', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Low Limit</th>
                                <th style={{ textAlign: 'right', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                            {group.map((p) => {
                              const track = (p.track_stock ?? 0) === 1;
                              const stock = p.stock_quantity ?? 0;
                              const limit = p.low_stock_limit ?? 5;
                              const low = track && stock <= limit;
                              return (
                                <tr key={p.id}>
                                  <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}` }}>
                                    <div style={{ fontWeight: 900, color: colors.text }}>{p.name}</div>
                                    {p.description ? (
                                      <div style={{ marginTop: '2px', fontSize: '12px', color: colors.textSecondary }}>{p.description}</div>
                                    ) : null}
                                  </td>
                                  <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'right', fontWeight: 900 }}>{formatMoney(p.price)}</td>
                                  <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'center', color: colors.textSecondary }}>
                                    {track ? 'Yes' : 'No'}
                                  </td>
                                  <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'right', fontWeight: 900, color: low ? 'var(--app-action)' : colors.text }}>
                                    {track ? stock : '—'}
                                  </td>
                                  <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'right', color: colors.textSecondary }}>
                                    {track ? limit : '—'}
                                  </td>
                                  <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                                      <button type="button" className="bc-btn bc-btn-outline" onClick={() => openEdit(p)} style={{ width: 'auto' }}>
                                        Edit
                                      </button>
                                      <button type="button" className="bc-btn bc-btn-outline" onClick={() => remove(p)} style={{ width: 'auto' }}>
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="bc-modal-overlay">
          <div className="bc-modal" style={{ maxWidth: '640px', padding: '32px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: colors.text, marginBottom: '8px' }}>{title}</div>
            <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '20px' }}>
              {editingId ? 'Update product details' : 'Add a new product to your inventory'}
            </div>

            <div style={{ marginTop: '20px', display: 'grid', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>Name</div>
                <input
                  className="bc-input"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '10px' }}
                />
              </div>

              {barcodeEnabled && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>
                    SKU / Barcode (optional)
                  </div>
                  <input
                    className="bc-input"
                    value={draft.barcode || draft.sku}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft((d) => ({ ...d, barcode: val, sku: val }));
                    }}
                    placeholder="Product code or scan barcode"
                    style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '10px' }}
                  />
                  <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }}>
                    Use this for internal codes (SKU) or scanned barcodes
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>Category</div>
                  {categoriesLoading || categories.length === 0 ? (
                    <input
                      className="bc-input"
                      value={draft.category}
                      onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                      placeholder="e.g. Accessories"
                      style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '10px' }}
                    />
                  ) : (
                    <select
                      className="bc-input"
                      value={draft.category}
                      onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                      style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '10px' }}
                    >
                      {draft.category && !categories.some((c) => c.name === draft.category) && (
                        <option value={draft.category}>{draft.category}</option>
                      )}
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <div style={{ marginTop: '6px' }}>
                    <button
                      type="button"
                      className="bc-btn bc-btn-outline"
                      onClick={openCategoriesManager}
                      style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
                    >
                      Manage categories
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>Price</div>
                <input
                  className="bc-input"
                  type="number"
                  value={draft.price}
                  onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                  onFocus={handleNumberInputFocus}
                  inputMode="decimal"
                  style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '10px' }}
                />
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>Description (optional)</div>
                <textarea
                  className="bc-input"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={3}
                  style={{ resize: 'vertical', padding: '12px 16px', fontSize: '15px', borderRadius: '10px' }}
                  placeholder="e.g. Type-C fast charger 20W"
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={draft.track_stock}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      track_stock: e.target.checked,
                      stock_quantity: e.target.checked ? d.stock_quantity : '0',
                      low_stock_limit: e.target.checked ? d.low_stock_limit : '0',
                    }))
                  }
                />
                <span style={{ fontSize: '13px', fontWeight: 800, color: colors.text }}>Track stock (physical product)</span>
              </label>

              {draft.track_stock && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>Stock quantity</div>
                    <input
                      className="bc-input"
                      type="number"
                      value={draft.stock_quantity}
                      onChange={(e) => setDraft((d) => ({ ...d, stock_quantity: e.target.value }))}
                      onFocus={handleNumberInputFocus}
                      inputMode="numeric"
                      style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '10px' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>Low stock limit</div>
                    <input
                      className="bc-input"
                      type="number"
                      value={draft.low_stock_limit}
                      onChange={(e) => setDraft((d) => ({ ...d, low_stock_limit: e.target.value }))}
                      onFocus={handleNumberInputFocus}
                      inputMode="numeric"
                      style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '10px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="bc-btn bc-btn-outline" onClick={closeModal} style={{ width: 'auto', padding: '12px 24px', fontSize: '15px', fontWeight: 600, borderRadius: '10px' }}>
                Cancel
              </button>
              <button type="button" className="bc-btn bc-btn-primary" onClick={save} style={{ width: 'auto', padding: '12px 24px', fontSize: '15px', fontWeight: 600, borderRadius: '10px' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isCategoriesModalOpen && (
        <div className="bc-modal-overlay">
          <div className="bc-modal" style={{ maxWidth: '640px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: colors.text }}>Categories</div>
            <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '6px' }}>
              Create categories for faster product entry (Accessories, Phones, Repairs, etc.).
            </div>

            <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 110px auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>New category</div>
                  <input
                    className="bc-input"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Accessories"
                  />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Emoji</div>
                  <select className="bc-input" value={newCategoryEmoji} onChange={(e) => setNewCategoryEmoji(e.target.value)}>
                    {['📦', '🔌', '📱', '🧰', '🎧', '⌚', '🖨️', '💳', '🧾', '🛒', '💡', '🔧', '🖥️'].map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Color</div>
                  <input className="bc-input" type="color" value={newCategoryColor} onChange={(e) => setNewCategoryColor(e.target.value)} style={{ padding: '6px' }} />
                </div>
                <button type="button" className="bc-btn bc-btn-primary" onClick={addCategory} style={{ width: 'auto' }}>
                  Add
                </button>
              </div>

              <input
                className="bc-input"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder="Search categories…"
              />

              <div className="bc-card" style={{ padding: '0', overflow: 'hidden', borderRadius: '10px' }}>
                {categoriesLoading ? (
                  <div style={{ padding: '12px', color: colors.textSecondary }}>Loading…</div>
                ) : categories.length === 0 ? (
                  <div style={{ padding: '12px', color: colors.textSecondary }}>No categories yet.</div>
                ) : (
                  <table className="bc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Name</th>
                        <th style={{ textAlign: 'right', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories
                        .filter((c) => {
                          const q = categorySearchQuery.trim().toLowerCase();
                          if (!q) return true;
                          return c.name.toLowerCase().includes(q);
                        })
                        .map((c) => (
                        <tr key={c.id}>
                          <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '16px' }}>{(c.emoji || '📦').trim() || '📦'}</span>
                              <span style={{ fontWeight: 900 }}>{c.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <input
                                type="color"
                                value={(c.color || '#94A3B8').trim() || '#94A3B8'}
                                onChange={(e) => scheduleCategoryUpdate(c.id, { color: e.target.value })}
                                title="Category color"
                                style={{ width: '44px', height: '34px' }}
                              />
                              <select
                                className="bc-input"
                                value={(c.emoji || '📦').trim() || '📦'}
                                onChange={(e) => scheduleCategoryUpdate(c.id, { emoji: e.target.value })}
                                title="Category emoji"
                                style={{ width: '70px' }}
                              >
                                {['📦', '🔌', '📱', '🧰', '🎧', '⌚', '🖨️', '💳', '🧾', '🛒', '💡', '🔧', '🖥️'].map((em) => (
                                  <option key={em} value={em}>
                                    {em}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="bc-btn bc-btn-outline"
                                onClick={() => renameCategory(c)}
                                style={{ width: 'auto' }}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                className="bc-btn bc-btn-outline"
                                onClick={() => removeCategory(c)}
                                style={{ width: 'auto' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="bc-btn bc-btn-outline" onClick={closeCategoriesManager} style={{ width: 'auto' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
