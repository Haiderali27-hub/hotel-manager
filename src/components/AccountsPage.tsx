import React, { useEffect, useMemo, useState } from 'react';
import {
    addSalePayment,
    addSupplierPayment,
    getCustomerBalanceSummaries,
    getCustomerSaleBalances,
    getSupplierBalanceSummaries,
    getSupplierPayments,
    type CustomerBalanceSummary,
    type CustomerSaleBalanceRow,
    type SupplierBalanceSummary,
    type SupplierPayment,
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { handleNumberInputFocus } from '../utils/inputHelpers';

interface AccountsPageProps {
  onBack: () => void;
  onNavigateToPOS?: () => void;
}

type AccountsTab = 'customers' | 'suppliers';

type PaymentMethod = 'cash' | 'card' | 'mobile' | 'bank';

const AccountsPage: React.FC<AccountsPageProps> = ({ onBack, onNavigateToPOS }) => {
  const { colors } = useTheme();
  const { formatMoney } = useCurrency();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<AccountsTab>('customers');
  const [loading, setLoading] = useState(false);

  const [customerBalances, setCustomerBalances] = useState<CustomerBalanceSummary[]>([]);
  const [supplierBalances, setSupplierBalances] = useState<SupplierBalanceSummary[]>([]);
  const [includeInactiveSuppliers, setIncludeInactiveSuppliers] = useState(false);

  const [search, setSearch] = useState('');

  // Customer details modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerBalanceSummary | null>(null);
  const [customerSales, setCustomerSales] = useState<CustomerSaleBalanceRow[]>([]);
  const [customerDetailsLoading, setCustomerDetailsLoading] = useState(false);

  const [paymentSaleId, setPaymentSaleId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  // Supplier details modal
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierBalanceSummary | null>(null);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [supplierDetailsLoading, setSupplierDetailsLoading] = useState(false);

  const [supplierPayAmount, setSupplierPayAmount] = useState<number>(0);
  const [supplierPayMethod, setSupplierPayMethod] = useState<PaymentMethod>('cash');
  const [supplierPayNote, setSupplierPayNote] = useState('');
  const [supplierPaySaving, setSupplierPaySaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        getCustomerBalanceSummaries(),
        getSupplierBalanceSummaries(includeInactiveSuppliers),
      ]);
      setCustomerBalances(c);
      setSupplierBalances(s);
    } catch (e) {
      console.error(e);
      showError('Load Failed', 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactiveSuppliers]);

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

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [...customerBalances];
    if (!q) return rows;
    return rows.filter((r) => `${r.customer_name} ${r.customer_id}`.toLowerCase().includes(q));
  }, [customerBalances, search]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [...supplierBalances];
    if (!q) return rows;
    return rows.filter((r) => `${r.supplier_name} ${r.supplier_id}`.toLowerCase().includes(q));
  }, [supplierBalances, search]);

  const openCustomer = async (row: CustomerBalanceSummary) => {
    setSelectedCustomer(row);
    setCustomerSales([]);
    setPaymentSaleId(null);
    setPaymentAmount(0);
    setPaymentNote('');
    setCustomerDetailsLoading(true);
    try {
      const s = await getCustomerSaleBalances(row.customer_id);
      setCustomerSales(s);
    } catch (e) {
      console.error(e);
      showError('Load Failed', 'Failed to load customer statement');
    } finally {
      setCustomerDetailsLoading(false);
    }
  };

  const openSupplier = async (row: SupplierBalanceSummary) => {
    setSelectedSupplier(row);
    setSupplierPayments([]);
    setSupplierPayAmount(0);
    setSupplierPayNote('');
    setSupplierDetailsLoading(true);
    try {
      const p = await getSupplierPayments(row.supplier_id);
      setSupplierPayments(p);
    } catch (e) {
      console.error(e);
      showError('Load Failed', 'Failed to load supplier payments');
    } finally {
      setSupplierDetailsLoading(false);
    }
  };

  const refreshCustomerDetails = async () => {
    if (!selectedCustomer) return;
    setCustomerDetailsLoading(true);
    try {
      const s = await getCustomerSaleBalances(selectedCustomer.customer_id);
      setCustomerSales(s);
      const c = await getCustomerBalanceSummaries();
      setCustomerBalances(c);
      setSelectedCustomer((prev) => (prev ? c.find((x) => x.customer_id === prev.customer_id) ?? prev : prev));
    } catch (e) {
      console.error(e);
    } finally {
      setCustomerDetailsLoading(false);
    }
  };

  const refreshSupplierDetails = async () => {
    if (!selectedSupplier) return;
    setSupplierDetailsLoading(true);
    try {
      const p = await getSupplierPayments(selectedSupplier.supplier_id);
      setSupplierPayments(p);
      const s = await getSupplierBalanceSummaries(includeInactiveSuppliers);
      setSupplierBalances(s);
      setSelectedSupplier((prev) => (prev ? s.find((x) => x.supplier_id === prev.supplier_id) ?? prev : prev));
    } catch (e) {
      console.error(e);
    } finally {
      setSupplierDetailsLoading(false);
    }
  };

  const submitCustomerPayment = async () => {
    if (!paymentSaleId) {
      showError('Validation Error', 'Select a sale to pay');
      return;
    }
    if (!paymentAmount || paymentAmount <= 0) {
      showError('Validation Error', 'Payment amount must be > 0');
      return;
    }
    setPaymentSaving(true);
    try {
      await addSalePayment(paymentSaleId, paymentAmount, paymentMethod, paymentNote.trim() || undefined);
      showSuccess('Saved', 'Payment recorded');
      setPaymentSaleId(null);
      setPaymentAmount(0);
      setPaymentNote('');
      await refreshCustomerDetails();
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : 'Failed to record payment';
      showError('Save Failed', msg);
    } finally {
      setPaymentSaving(false);
    }
  };

  const submitSupplierPayment = async () => {
    if (!selectedSupplier) return;
    if (!supplierPayAmount || supplierPayAmount <= 0) {
      showError('Validation Error', 'Payment amount must be > 0');
      return;
    }
    setSupplierPaySaving(true);
    try {
      await addSupplierPayment({
        supplierId: selectedSupplier.supplier_id,
        purchaseId: null,
        amount: supplierPayAmount,
        method: supplierPayMethod,
        note: supplierPayNote.trim() || undefined,
      });
      showSuccess('Saved', 'Supplier payment recorded');
      setSupplierPayAmount(0);
      setSupplierPayNote('');
      await refreshSupplierDetails();
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : 'Failed to record supplier payment';
      showError('Save Failed', msg);
    } finally {
      setSupplierPaySaving(false);
    }
  };

  const tabBtn = (id: AccountsTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        padding: '10px 12px',
        borderRadius: '10px',
        border: `1px solid ${colors.border}`,
        background: tab === id ? colors.accent : 'transparent',
        color: tab === id ? colors.primary : colors.textSecondary,
        fontWeight: 900,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: colors.primary, color: colors.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
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
            <div style={{ fontSize: '24px', fontWeight: 900 }}>Accounts</div>
            <div style={{ fontSize: '13px', color: colors.textSecondary }}>Customer and supplier balances</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {tabBtn('customers', 'Customers')}
          {tabBtn('suppliers', 'Suppliers')}
          {onNavigateToPOS && (
            <button
              type="button"
              className="bc-btn"
              onClick={onNavigateToPOS}
              style={{
                backgroundColor: colors.accent,
                color: colors.secondary,
                fontSize: '15px',
                fontWeight: 600,
                padding: '10px 18px',
                marginLeft: '8px',
              }}
            >
              ← Back to POS
            </button>
          )}
        </div>
      </div>

      <div className="bc-card" style={{ padding: '16px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" style={inputStyle} />
          </div>
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
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          {tab === 'suppliers' && (
            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}` }}>
              <input type="checkbox" checked={includeInactiveSuppliers} onChange={(e) => setIncludeInactiveSuppliers(e.target.checked)} />
              <span style={{ color: colors.textSecondary, fontSize: '13px' }}>Include inactive</span>
            </label>
          )}
        </div>

        {tab === 'customers' && (
          <div style={{ marginTop: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Customer</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Total sales</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Paid</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Balance</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px 8px', color: colors.textSecondary }}>
                      No customer balances.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((r) => (
                    <tr key={r.customer_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '10px 8px', fontWeight: 900 }}>{r.customer_name}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(r.total_sales || 0)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(r.amount_paid || 0)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney(r.balance_due || 0)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => void openCustomer(r)}
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
                          Statement
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'suppliers' && (
          <div style={{ marginTop: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Supplier</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Total buys</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Paid</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Balance</th>
                  <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px 8px', color: colors.textSecondary }}>
                      No supplier balances.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((r) => (
                    <tr key={r.supplier_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '10px 8px', fontWeight: 900 }}>{r.supplier_name}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(r.total_purchases || 0)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(r.amount_paid || 0)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney(r.balance_due || 0)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => void openSupplier(r)}
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
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer modal */}
      {selectedCustomer && (
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
            if (e.target === e.currentTarget) setSelectedCustomer(null);
          }}
        >
          <div className="bc-card" style={{ width: 'min(1020px, 96vw)', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{selectedCustomer.customer_name}</div>
                <div style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '6px' }}>
                  Balance: <span style={{ color: colors.text, fontWeight: 700 }}>{formatMoney(selectedCustomer.balance_due || 0)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
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

            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Select sale</label>
                  <select value={paymentSaleId ?? ''} onChange={(e) => setPaymentSaleId(e.target.value ? Number(e.target.value) : null)} style={inputStyle}>
                    <option value="">— Choose —</option>
                    {customerSales
                      .filter((x) => (x.balance_due || 0) > 0)
                      .map((x) => (
                        <option key={x.sale_id} value={x.sale_id}>
                          #{x.sale_id} • {x.created_at?.slice(0, 10)} • Balance {formatMoney(x.balance_due || 0)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount ? String(paymentAmount) : ''}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value || '0'))}
                    onFocus={handleNumberInputFocus}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} style={inputStyle}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile">Mobile</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Note</label>
                  <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} style={inputStyle} placeholder="Optional…" />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => void submitCustomerPayment()}
                  disabled={paymentSaving}
                  style={{
                    border: 'none',
                    background: colors.accent,
                    color: colors.primary,
                    borderRadius: '10px',
                    padding: '12px 24px',
                    fontWeight: 600,
                    cursor: paymentSaving ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                  }}
                >
                  {paymentSaving ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '14px', color: colors.textSecondary, fontSize: '12px' }}>
              {customerDetailsLoading ? 'Loading statement…' : 'Statement'}
            </div>

            <div style={{ marginTop: '10px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Sale</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Date</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Paid</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Balance</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customerSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '12px 8px', color: colors.textSecondary }}>
                        No unpaid sales.
                      </td>
                    </tr>
                  ) : (
                    customerSales.map((x) => (
                      <tr key={x.sale_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '10px 8px', fontWeight: 900 }}>#{x.sale_id}</td>
                        <td style={{ padding: '10px 8px' }}>{x.created_at?.slice(0, 10) || '—'}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(x.total_amount || 0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(x.amount_paid || 0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney(x.balance_due || 0)}</td>
                        <td style={{ padding: '10px 8px', color: x.paid ? colors.textSecondary : colors.text }}>{x.paid ? 'Paid' : 'Unpaid'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supplier modal */}
      {selectedSupplier && (
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
            if (e.target === e.currentTarget) setSelectedSupplier(null);
          }}
        >
          <div className="bc-card" style={{ width: 'min(1020px, 96vw)', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{selectedSupplier.supplier_name}</div>
                <div style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '6px' }}>
                  Balance: <span style={{ color: colors.text, fontWeight: 700 }}>{formatMoney(selectedSupplier.balance_due || 0)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupplier(null)}
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

            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={supplierPayAmount ? String(supplierPayAmount) : ''}
                    onChange={(e) => setSupplierPayAmount(parseFloat(e.target.value || '0'))}
                    onFocus={handleNumberInputFocus}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Method</label>
                  <select value={supplierPayMethod} onChange={(e) => setSupplierPayMethod(e.target.value as PaymentMethod)} style={inputStyle}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile">Mobile</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Note</label>
                  <input value={supplierPayNote} onChange={(e) => setSupplierPayNote(e.target.value)} style={inputStyle} placeholder="Optional…" />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => void submitSupplierPayment()}
                    disabled={supplierPaySaving}
                    style={{
                      border: 'none',
                      background: colors.accent,
                      color: colors.primary,
                      borderRadius: '10px',
                      padding: '12px 24px',
                      fontWeight: 600,
                      fontSize: '15px',
                      cursor: supplierPaySaving ? 'not-allowed' : 'pointer',
                      width: '100%',
                      maxWidth: '220px',
                    }}
                  >
                    {supplierPaySaving ? 'Saving…' : 'Record Payment'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '14px', color: colors.textSecondary, fontSize: '12px' }}>
              {supplierDetailsLoading ? 'Loading payments…' : 'Payments'}
            </div>

            <div style={{ marginTop: '10px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Date</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Method</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPayments.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '12px 8px', color: colors.textSecondary }}>
                        No payments.
                      </td>
                    </tr>
                  ) : (
                    supplierPayments.map((p) => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '10px 8px' }}>{p.created_at?.slice(0, 10) || '—'}</td>
                        <td style={{ padding: '10px 8px' }}>{p.method}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney(p.amount)}</td>
                        <td style={{ padding: '10px 8px' }}>{p.note || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPage;
