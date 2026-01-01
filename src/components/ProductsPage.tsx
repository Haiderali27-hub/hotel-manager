import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { MenuItem, NewMenuItem } from '../api/client';
import { addMenuItem, deleteMenuItem, getMenuItems, updateMenuItem } from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface ProductsPageProps {
  onBack: () => void;
}

type ProductDraft = {
  name: string;
  category: string;
  price: string;
  track_stock: boolean;
  stock_quantity: string;
  low_stock_limit: string;
};

const defaultDraft: ProductDraft = {
  name: '',
  category: 'General',
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(defaultDraft);

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

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setDraft(defaultDraft);
    setIsModalOpen(true);
  };

  const openEdit = (p: MenuItem) => {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      category: p.category || 'General',
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
    const category = draft.category.trim();
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
      category,
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
      closeModal();
      await load();
    } catch (e) {
      showError('Save failed', e instanceof Error ? e.message : String(e));
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

        <button type="button" className="bc-btn bc-btn-primary" onClick={openAdd} style={{ width: 'auto' }}>
          Add Product
        </button>
      </div>

      <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
        {loading ? (
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Loading…</div>
        ) : products.length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>No products yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="bc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Category</th>
                  <th style={{ textAlign: 'right', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Price</th>
                  <th style={{ textAlign: 'center', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Track Stock</th>
                  <th style={{ textAlign: 'right', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Stock</th>
                  <th style={{ textAlign: 'right', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Low Limit</th>
                  <th style={{ textAlign: 'right', padding: '10px', borderBottom: `1px solid ${colors.border}` }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const track = (p.track_stock ?? 0) === 1;
                  const stock = p.stock_quantity ?? 0;
                  const limit = p.low_stock_limit ?? 5;
                  const low = track && stock <= limit;
                  return (
                    <tr key={p.id}>
                      <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}` }}>
                        <div style={{ fontWeight: 800, color: colors.text }}>{p.name}</div>
                      </td>
                      <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{p.category}</td>
                      <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'right', fontWeight: 800 }}>{formatMoney(p.price)}</td>
                      <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'center', color: colors.textSecondary }}>
                        {track ? 'Yes' : 'No'}
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          borderBottom: `1px solid ${colors.border}`,
                          textAlign: 'right',
                          fontWeight: 800,
                          color: low ? 'var(--app-action)' : colors.text,
                        }}
                      >
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

      {isModalOpen && (
        <div className="bc-modal-overlay">
          <div className="bc-modal" style={{ maxWidth: '640px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: colors.text }}>{title}</div>

            <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Name</div>
                <input
                  className="bc-input"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Category</div>
                  <input
                    className="bc-input"
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Price</div>
                  <input
                    className="bc-input"
                    value={draft.price}
                    onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                    inputMode="decimal"
                  />
                </div>
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
                    <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Stock quantity</div>
                    <input
                      className="bc-input"
                      value={draft.stock_quantity}
                      onChange={(e) => setDraft((d) => ({ ...d, stock_quantity: e.target.value }))}
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Low stock limit</div>
                    <input
                      className="bc-input"
                      value={draft.low_stock_limit}
                      onChange={(e) => setDraft((d) => ({ ...d, low_stock_limit: e.target.value }))}
                      inputMode="numeric"
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="bc-btn bc-btn-outline" onClick={closeModal} style={{ width: 'auto' }}>
                Cancel
              </button>
              <button type="button" className="bc-btn bc-btn-primary" onClick={save} style={{ width: 'auto' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
