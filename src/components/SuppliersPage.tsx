import React, { useEffect, useMemo, useState } from 'react';
import {
  addSupplier,
  addSupplierPayment,
  deleteSupplier,
  getSupplierBalanceSummaries,
  getSupplierPayments,
  getSuppliers,
  updateSupplier,
  type NewSupplier,
  type Supplier,
  type SupplierBalanceSummary,
  type SupplierPayment,
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { handleNumberInputFocus } from '../utils/inputHelpers';

interface SuppliersPageProps {
  onBack: () => void;
}

const SuppliersPage: React.FC<SuppliersPageProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { formatMoney } = useCurrency();
  const { showError, showSuccess } = useNotification();

  const [loading, setLoading] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [balances, setBalances] = useState<SupplierBalanceSummary[]>([]);
  const [search, setSearch] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<NewSupplier>({ name: '', phone: '', email: '', address: '', notes: '' });

  const [selected, setSelected] = useState<Supplier | null>(null);
  const [selectedBalance, setSelectedBalance] = useState<SupplierBalanceSummary | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<SupplierPayment[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | 'bank'>('cash');
  const [paymentNote, setPaymentNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([
        getSuppliers(includeInactive),
        getSupplierBalanceSummaries(includeInactive),
      ]);
      setSuppliers(s);
      setBalances(b);
    } catch (e) {
      console.error(e);
      showError('Load Failed', 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  const balanceBySupplier = useMemo(() => {
    const m = new Map<number, SupplierBalanceSummary>();
    for (const b of balances) m.set(b.supplier_id, b);
    return m;
  }, [balances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = suppliers
      .map((s) => ({ s, b: balanceBySupplier.get(s.id) }))
      .filter(({ s }) => {
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          (s.phone || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.s.name.localeCompare(b.s.name));
    return rows;
  }, [balanceBySupplier, search, suppliers]);

  const openDetails = async (supplier: Supplier) => {
    setSelected(supplier);
    setSelectedPayments([]);
    setSelectedBalance(balanceBySupplier.get(supplier.id) ?? null);
    setPaymentAmount(0);
    setPaymentMethod('cash');
    setPaymentNote('');

    setDetailsLoading(true);
    try {
      const payments = await getSupplierPayments(supplier.id);
      setSelectedPayments(payments);
    } catch (e) {
      console.error(e);
      showError('Load Failed', 'Failed to load supplier payments');
    } finally {
      setDetailsLoading(false);
    }
  };

  const addNewSupplier = async () => {
    if (!addDraft.name.trim()) {
      showError('Validation Error', 'Supplier name is required');
      return;
    }
    try {
      await addSupplier({
        name: addDraft.name.trim(),
        phone: addDraft.phone?.trim() || undefined,
        email: addDraft.email?.trim() || undefined,
        address: addDraft.address?.trim() || undefined,
        notes: addDraft.notes?.trim() || undefined,
      });
      showSuccess('Saved', 'Supplier added');
      setShowAdd(false);
      setAddDraft({ name: '', phone: '', email: '', address: '', notes: '' });
      await load();
    } catch (e) {
      console.error(e);
      showError('Add Failed', e instanceof Error ? e.message : 'Failed to add supplier');
    }
  };

  const toggleActive = async (supplier: Supplier, isActive: boolean) => {
    try {
      await updateSupplier(supplier.id, { is_active: isActive });
      showSuccess('Updated', isActive ? 'Supplier activated' : 'Supplier deactivated');
      await load();
      if (selected?.id === supplier.id) {
        setSelected({ ...supplier, is_active: isActive });
      }
    } catch (e) {
      console.error(e);
      showError('Update Failed', 'Failed to update supplier');
    }
  };

  const removeSupplier = async (supplier: Supplier) => {
    const ok = window.confirm(`Delete supplier?\n\n${supplier.name}\n\nIf it has purchase/payment history it will be deactivated instead.`);
    if (!ok) return;
    try {
      const msg = await deleteSupplier(supplier.id);
      showSuccess('Done', msg);
      if (selected?.id === supplier.id) {
        setSelected(null);
        setSelectedPayments([]);
        setSelectedBalance(null);
      }
      await load();
    } catch (e) {
      console.error(e);
      showError('Delete Failed', 'Failed to delete supplier');
    }
  };

  const recordPayment = async () => {
    if (!selected) return;
    if (paymentAmount <= 0) {
      showError('Validation Error', 'Payment amount must be > 0');
      return;
    }
    try {
      const summary = await addSupplierPayment({
        supplierId: selected.id,
        purchaseId: null,
        amount: paymentAmount,
        method: paymentMethod,
        note: paymentNote?.trim() || undefined,
      });
      showSuccess('Recorded', 'Payment added');
      setSelectedBalance(summary);
      setPaymentAmount(0);
      setPaymentNote('');
      const payments = await getSupplierPayments(selected.id);
      setSelectedPayments(payments);
      await load();
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : 'Failed to record payment';
      showError('Payment Failed', msg);
    }
  };

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
            <div style={{ fontSize: '24px', fontWeight: 900 }}>Suppliers</div>
            <div style={{ fontSize: '13px', color: colors.textSecondary }}>Vendors you buy stock from (optional)</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textSecondary, fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
      </div>

      {/* Info banner for recording purchases */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '14px 16px', 
        background: colors.surface,
        border: `2px solid ${colors.accent}`,
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 900, color: colors.text }}>
            💡 To record a purchase from a supplier
          </div>
          <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>
            Go to <strong>Dashboard → Purchases (Stock-In)</strong> to record supplier purchases and update stock levels.
          </div>
        </div>
        <button 
          type="button" 
          onClick={onBack}
          className="bc-btn bc-btn-primary"
          style={{ width: 'auto', whiteSpace: 'nowrap' }}
        >
          Go to Dashboard
        </button>
      </div>

      <div className="bc-card" style={{ padding: '16px', borderRadius: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers…" style={inputStyle} />
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            style={{
              border: 'none',
              background: colors.accent,
              color: colors.primary,
              borderRadius: '10px',
              padding: '10px 12px',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            + Add Supplier
          </button>
        </div>
        
        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            onClick={() => void load()}
            style={{
              border: `1px solid ${colors.border}`,
              background: 'transparent',
              color: colors.text,
              borderRadius: '10px',
              padding: '10px 12px',
              fontWeight: 800,
              cursor: 'pointer',
              height: '42px',
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div style={{ marginTop: '14px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Name</th>
                <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Phone</th>
                <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Email</th>
                <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Balance</th>
                <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '14px 8px', color: colors.textSecondary }}>
                    No suppliers.
                  </td>
                </tr>
              ) : (
                filtered.map(({ s, b }) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '10px 8px', fontWeight: 900, color: colors.text }}>
                      {s.name}
                      {!s.is_active && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: colors.textSecondary }}>(inactive)</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', color: colors.text }}>{s.phone || '—'}</td>
                    <td style={{ padding: '10px 8px', color: colors.text }}>{s.email || '—'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900, color: colors.text }}>
                      {formatMoney(b?.balance_due || 0)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => void openDetails(s)}
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
                        onClick={() => void toggleActive(s, !s.is_active)}
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
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeSupplier(s)}
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

      {showAdd && (
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
            if (e.target === e.currentTarget) setShowAdd(false);
          }}
        >
          <div className="bc-card" style={{ width: 'min(820px, 96vw)', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>Add Supplier</div>
                <div style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '6px' }}>
                  Optional: only if you buy from multiple places
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.text,
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 600,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '20px' }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input value={addDraft.name} onChange={(e) => setAddDraft((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input value={addDraft.phone || ''} onChange={(e) => setAddDraft((p) => ({ ...p, phone: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input value={addDraft.email || ''} onChange={(e) => setAddDraft((p) => ({ ...p, email: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input value={addDraft.address || ''} onChange={(e) => setAddDraft((p) => ({ ...p, address: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={addDraft.notes || ''}
                onChange={(e) => setAddDraft((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                style={{
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.text,
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '15px',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void addNewSupplier()}
                style={{
                  border: 'none',
                  background: colors.accent,
                  color: colors.primary,
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '15px',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
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
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="bc-card" style={{ width: 'min(980px, 96vw)', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{selected.name}</div>
                <div style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '6px' }}>
                  Balance due: {formatMoney(selectedBalance?.balance_due || 0)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.text,
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 600,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '8px' }}>Record Payment</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Amount</label>
                    <input
                      type="number"
                      value={paymentAmount ? String(paymentAmount) : ''}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value || '0'))}
                      onFocus={handleNumberInputFocus}
                      min="0"
                      step="0.01"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Method</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} style={inputStyle}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="mobile">Mobile</option>
                      <option value="bank">Bank</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label style={labelStyle}>Note</label>
                  <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} style={inputStyle} placeholder="Optional…" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => void recordPayment()}
                    style={{
                      border: 'none',
                      background: colors.accent,
                      color: colors.primary,
                      borderRadius: '10px',
                      padding: '12px 24px',
                      fontWeight: 600,
                      fontSize: '15px',
                      cursor: 'pointer',
                    }}
                  >
                    Add Payment
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '8px' }}>Payments</div>
                <div style={{ maxHeight: '260px', overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: '10px' }}>
                  {detailsLoading ? (
                    <div style={{ padding: '12px', color: colors.textSecondary }}>Loading…</div>
                  ) : selectedPayments.length === 0 ? (
                    <div style={{ padding: '12px', color: colors.textSecondary }}>No payments yet.</div>
                  ) : (
                    selectedPayments.map((p) => (
                      <div key={p.id} style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ fontWeight: 900 }}>{formatMoney(p.amount)}</div>
                          <div style={{ color: colors.textSecondary, fontSize: '12px' }}>{p.method}</div>
                        </div>
                        <div style={{ color: colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>
                          {p.created_at}
                          {p.note ? ` • ${p.note}` : ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Supplier id: {selected.id}</div>
              <button
                type="button"
                onClick={() => void removeSupplier(selected)}
                style={{
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.text,
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '15px',
                }}
              >
                Delete / Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
