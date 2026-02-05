import React, { useEffect, useMemo, useState } from 'react';
import {
    addPurchase,
    deletePurchase,
    getMenuItems,
    getPurchaseDetails,
    getPurchases,
    getSuppliers,
    type MenuItem,
    type PurchaseDetails,
    type PurchaseItemInput,
    type PurchaseSummary,
    type Supplier,
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface PurchasesPageProps {
  onBack: () => void;
}

type TabId = 'new' | 'history';

type PaymentMode = 'pay_now' | 'pay_later' | 'pay_partial';

type DraftItem = PurchaseItemInput & { key: string };

const PurchasesPage: React.FC<PurchasesPageProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { formatMoney } = useCurrency();
  const { showError, showSuccess, showWarning } = useNotification();

  const [activeTab, setActiveTab] = useState<TabId>('new');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [updateStock, setUpdateStock] = useState(true);

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('pay_later');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | 'bank'>('cash');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const [details, setDetails] = useState<PurchaseDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadCore = async () => {
    try {
      const [s, m] = await Promise.all([getSuppliers(false), getMenuItems()]);
      setSuppliers(s);
      setMenuItems(m);
    } catch (e) {
      console.error(e);
      showError('Load Failed', 'Failed to load suppliers/products');
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const rows = await getPurchases();
      setPurchases(rows);
    } catch (e) {
      console.error(e);
      showError('Load Failed', 'Failed to load purchases');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadCore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'history') void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    const rows = menuItems
      .filter((m) => m.is_available)
      .filter((m) => (m.name || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q))
      .slice(0, 30);
    return rows;
  }, [menuItems, productSearch]);

  const total = useMemo(() => {
    return draftItems.reduce((sum, it) => sum + (it.quantity || 0) * (it.unit_cost || 0), 0);
  }, [draftItems]);

  const addProductToDraft = (m: MenuItem) => {
    const existing = draftItems.find((d) => d.menu_item_id === m.id);
    if (existing) {
      setDraftItems((prev) =>
        prev.map((x) => (x.menu_item_id === m.id ? { ...x, quantity: (x.quantity || 0) + 1 } : x))
      );
    } else {
      setDraftItems((prev) => [
        ...prev,
        {
          key: `${m.id}-${Date.now()}`,
          menu_item_id: m.id,
          item_name: m.name,
          quantity: 1,
          unit_cost: Number(m.price || 0),
        },
      ]);
    }
    setProductSearch('');
  };

  const addManualItem = () => {
    setDraftItems((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}`,
        menu_item_id: null,
        item_name: 'New item',
        quantity: 1,
        unit_cost: 0,
      },
    ]);
  };

  const removeDraftItem = (key: string) => {
    setDraftItems((prev) => prev.filter((x) => x.key !== key));
  };

  const submitPurchase = async () => {
    if (!purchaseDate.trim()) {
      showError('Validation Error', 'Purchase date is required');
      return;
    }
    if (draftItems.length === 0) {
      showError('Validation Error', 'Add at least one item');
      return;
    }

    for (const it of draftItems) {
      if (!it.item_name?.trim()) {
        showError('Validation Error', 'Item name is required');
        return;
      }
      if (!it.quantity || it.quantity <= 0) {
        showError('Validation Error', 'Quantity must be > 0');
        return;
      }
      if (it.unit_cost === undefined || it.unit_cost === null || Number.isNaN(it.unit_cost) || it.unit_cost <= 0) {
        showError('Validation Error', 'Unit cost must be > 0');
        return;
      }
    }

    if (paymentMode === 'pay_partial') {
      if (!paymentAmount || paymentAmount <= 0) {
        showError('Validation Error', 'Enter a partial payment amount');
        return;
      }
      if (paymentAmount > total) {
        showError('Validation Error', 'Partial payment cannot exceed total');
        return;
      }
    }

    if ((paymentMode === 'pay_now' || paymentMode === 'pay_partial') && !supplierId) {
      showWarning('Note', 'No supplier selected: payment won\'t be recorded to any supplier account');
    }

    setSaving(true);
    try {
      const id = await addPurchase({
        supplierId,
        purchaseDate,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        items: draftItems.map(({ key, ...rest }) => rest),
        paymentMode,
        paymentAmount: paymentMode === 'pay_now' ? total : paymentMode === 'pay_partial' ? paymentAmount : undefined,
        paymentMethod: paymentMode === 'pay_later' ? undefined : paymentMethod,
        paymentNote: paymentNote.trim() || undefined,
        updateStock,
      });

      showSuccess('Saved', `Purchase recorded (#${id})`);

      setSupplierId(null);
      setReference('');
      setNotes('');
      setDraftItems([]);
      setPaymentMode('pay_later');
      setPaymentAmount(0);
      setPaymentNote('');
      setUpdateStock(true);

      setActiveTab('history');
      await loadHistory();
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : 'Failed to add purchase';
      showError('Save Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (purchaseId: number) => {
    setDetails(null);
    setDetailsLoading(true);
    try {
      const d = await getPurchaseDetails(purchaseId);
      setDetails(d);
    } catch (e) {
      console.error(e);
      showError('Load Failed', 'Failed to load purchase details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const removePurchase = async (purchaseId: number) => {
    const ok = window.confirm('Delete this purchase?\n\nThis will also rollback stock quantities (default).');
    if (!ok) return;
    try {
      await deletePurchase(purchaseId, true);
      showSuccess('Deleted', 'Purchase removed');
      setDetails(null);
      await loadHistory();
    } catch (e) {
      console.error(e);
      showError('Delete Failed', e instanceof Error ? e.message : 'Failed to delete purchase');
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const rows = [...purchases];
    if (!q) return rows;
    return rows.filter((p) => {
      const hay = `${p.purchase_date} ${p.supplier_name || ''} ${p.reference || ''} ${p.notes || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [historySearch, purchases]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: `1px solid ${colors.border}`,
    background: colors.primary,
    color: colors.text,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 800,
    color: colors.textSecondary,
    marginBottom: '6px',
    display: 'block',
  };

  const tabBtn = (tab: TabId, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      style={{
        padding: '10px 12px',
        borderRadius: '10px',
        border: `1px solid ${colors.border}`,
        background: activeTab === tab ? colors.accent : 'transparent',
        color: activeTab === tab ? colors.primary : colors.textSecondary,
        fontWeight: 900,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: colors.primary, color: colors.text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              background: 'transparent',
              color: colors.text,
              cursor: 'pointer',
              fontSize: '18px',
            }}
            title="Back"
          >
            ←
          </button>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>Purchases (Stock-In)</div>
            <div style={{ fontSize: '13px', color: colors.textSecondary }}>
              Record purchases from suppliers and automatically update your stock levels
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {tabBtn('new', 'New Purchase')}
          {tabBtn('history', 'History')}
        </div>
      </div>

      {activeTab === 'new' && (
        <div className="bc-card" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '12px' }}>New Purchase</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Supplier (optional)</label>
              <select
                value={supplierId ?? ''}
                onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}
                style={inputStyle}
              >
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Reference</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice # / bill #" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Update Stock</label>
              <label style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}` }}>
                <input type="checkbox" checked={updateStock} onChange={(e) => setUpdateStock(e.target.checked)} />
                <span style={{ color: colors.textSecondary, fontSize: '13px' }}>Increase stock for tracked products</span>
              </label>
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <label style={labelStyle}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 900 }}>Items</div>
                <button
                  type="button"
                  onClick={addManualItem}
                  style={{
                    border: `1px solid ${colors.border}`,
                    background: 'transparent',
                    color: colors.text,
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  + Manual item
                </button>
              </div>

              <div style={{ marginTop: '10px' }}>
                <label style={labelStyle}>Add product</label>
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search product name…"
                  style={inputStyle}
                />
                {filteredProducts.length > 0 && (
                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '10px', marginTop: '8px', overflow: 'hidden' }}>
                    {filteredProducts.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => addProductToDraft(m)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '10px 12px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: colors.text,
                          textAlign: 'left',
                          borderBottom: `1px solid ${colors.border}`,
                        }}
                      >
                        <span style={{ fontWeight: 900 }}>{m.name}</span>
                        <span style={{ color: colors.textSecondary, fontSize: '12px' }}>{m.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                      <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Item</th>
                      <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Qty</th>
                      <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Unit cost</th>
                      <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Line total</th>
                      <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '12px 8px', color: colors.textSecondary }}>
                          No items yet.
                        </td>
                      </tr>
                    ) : (
                      draftItems.map((it) => (
                        <tr key={it.key} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td style={{ padding: '10px 8px', fontWeight: 900 }}>
                            <input
                              value={it.item_name}
                              onChange={(e) =>
                                setDraftItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, item_name: e.target.value } : x)))
                              }
                              style={inputStyle}
                            />
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <input
                              type="number"
                              value={String(it.quantity)}
                              min="1"
                              step="1"
                              onChange={(e) =>
                                setDraftItems((prev) =>
                                  prev.map((x) => (x.key === it.key ? { ...x, quantity: parseInt(e.target.value || '0', 10) } : x))
                                )
                              }
                              style={inputStyle}
                            />
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <input
                              type="number"
                              value={String(it.unit_cost)}
                              min="0"
                              step="0.01"
                              onChange={(e) =>
                                setDraftItems((prev) =>
                                  prev.map((x) => (x.key === it.key ? { ...x, unit_cost: parseFloat(e.target.value || '0') } : x))
                                )
                              }
                              style={inputStyle}
                            />
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney((it.quantity || 0) * (it.unit_cost || 0))}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => removeDraftItem(it.key)}
                              style={{
                                border: `1px solid ${colors.border}`,
                                background: 'transparent',
                                color: colors.text,
                                borderRadius: '10px',
                                padding: '8px 10px',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div className="bc-card" style={{ padding: '14px', borderRadius: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '8px' }}>Payment (optional)</div>
                <div>
                  <label style={labelStyle}>Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => {
                      const next = e.target.value as PaymentMode;
                      setPaymentMode(next);
                      if (next === 'pay_later') setPaymentAmount(0);
                      if (next === 'pay_now') setPaymentAmount(0);
                    }}
                    style={inputStyle}
                  >
                    <option value="pay_later">Pay later</option>
                    <option value="pay_now">Pay now (full)</option>
                    <option value="pay_partial">Pay partial</option>
                  </select>
                </div>

                {(paymentMode === 'pay_now' || paymentMode === 'pay_partial') && (
                  <>
                    <div style={{ marginTop: '10px' }}>
                      <label style={labelStyle}>Method</label>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} style={inputStyle}>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="mobile">Mobile</option>
                        <option value="bank">Bank</option>
                      </select>
                    </div>

                    {paymentMode === 'pay_partial' && (
                      <div style={{ marginTop: '10px' }}>
                        <label style={labelStyle}>Amount</label>
                        <input
                          type="number"
                          value={paymentAmount ? String(paymentAmount) : ''}
                          min="0"
                          step="0.01"
                          onChange={(e) => setPaymentAmount(parseFloat(e.target.value || '0'))}
                          style={inputStyle}
                        />
                        <div style={{ marginTop: '6px', fontSize: '12px', color: colors.textSecondary }}>
                          Max: {formatMoney(total)}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '10px' }}>
                      <label style={labelStyle}>Note</label>
                      <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} style={inputStyle} placeholder="Optional…" />
                    </div>
                  </>
                )}
              </div>

              <div className="bc-card" style={{ padding: '14px', borderRadius: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '8px' }}>Summary</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.textSecondary, fontSize: '13px' }}>
                  <span>Total</span>
                  <span style={{ color: colors.text, fontWeight: 900 }}>{formatMoney(total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => void submitPurchase()}
                    disabled={saving}
                    style={{
                      border: 'none',
                      background: colors.accent,
                      color: colors.primary,
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontWeight: 900,
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saving ? 'Saving…' : 'Save Purchase'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bc-card" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 900 }}>Purchase History</div>
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>
                Recent purchases and stock-ins
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadHistory()}
              style={{
                border: `1px solid ${colors.border}`,
                background: 'transparent',
                color: colors.text,
                borderRadius: '10px',
                padding: '10px 12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {historyLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          <div style={{ marginTop: '12px' }}>
            <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search…" style={inputStyle} />
          </div>

          <div style={{ marginTop: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Date</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Supplier</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Reference</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Notes</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '12px 8px', color: colors.textSecondary }}>
                      No purchases.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((p) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '10px 8px', color: colors.text }}>{p.purchase_date}</td>
                      <td style={{ padding: '10px 8px', color: colors.text, fontWeight: 900 }}>{p.supplier_name || '—'}</td>
                      <td style={{ padding: '10px 8px', color: colors.text }}>{p.reference || '—'}</td>
                      <td style={{ padding: '10px 8px', color: colors.text }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '360px' }} title={p.notes || ''}>
                          {p.notes || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney(p.total_amount || 0)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => void openDetails(p.id)}
                          style={{
                            border: `1px solid ${colors.border}`,
                            background: 'transparent',
                            color: colors.text,
                            borderRadius: '10px',
                            padding: '8px 10px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            marginRight: '8px',
                          }}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => void removePurchase(p.id)}
                          style={{
                            border: `1px solid ${colors.border}`,
                            background: 'transparent',
                            color: colors.text,
                            borderRadius: '10px',
                            padding: '8px 10px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailsLoading && (
        <div style={{ marginTop: '12px', color: colors.textSecondary }}>Loading details…</div>
      )}

      {details && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetails(null);
          }}
        >
          <div className="bc-card" style={{ width: 'min(980px, 96vw)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 900 }}>Purchase #{details.purchase.id}</div>
                <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>
                  {details.purchase.purchase_date} • {details.purchase.supplier_name || 'No supplier'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetails(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.text,
                  cursor: 'pointer',
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: '12px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Item</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Qty</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Unit cost</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {details.items.map((it) => (
                    <tr key={it.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '10px 8px', fontWeight: 900 }}>{it.item_name}</td>
                      <td style={{ padding: '10px 8px' }}>{it.quantity}</td>
                      <td style={{ padding: '10px 8px' }}>{formatMoney(it.unit_cost)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <div style={{ color: colors.textSecondary, fontSize: '12px' }}>
                {details.purchase.reference ? `Ref: ${details.purchase.reference}` : ''}
              </div>
              <div style={{ fontWeight: 900 }}>Total: {formatMoney(details.purchase.total_amount || 0)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;
