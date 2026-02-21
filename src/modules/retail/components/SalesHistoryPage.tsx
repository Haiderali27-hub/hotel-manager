import React, { useEffect, useMemo, useState } from 'react';
import {
    addSalePayment,
    deleteSale,
    getSaleDetails,
    getSalePaymentSummary,
    getSales,
    printOrderReceipt,
    printThermalReceipt,
    type SaleDetails,
    type SalePaymentSummary,
    type SaleSummary
} from '../../../api/client';
import { useCurrency } from '../../../context/CurrencyContext';
import { useLabels } from '../../../context/LabelContext';
import { useNotification } from '../../../context/NotificationContext';
import { useTheme } from '../../../context/ThemeContext';

interface SalesHistoryPageProps {
  onBack: () => void;
  onDuplicateSale: (saleId: number) => void;
}

const SalesHistoryPage: React.FC<SalesHistoryPageProps> = ({ onBack, onDuplicateSale }) => {
  const { colors, theme } = useTheme();
  const { formatMoney } = useCurrency();
  const { current: label } = useLabels();
  const { showError, showSuccess, showWarning } = useNotification();

  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [search, setSearch] = useState('');
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<SaleDetails | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<SalePaymentSummary | null>(null);
  const [salePaymentSummaries, setSalePaymentSummaries] = useState<Record<number, SalePaymentSummary>>({});
  const [paymentsModalSaleId, setPaymentsModalSaleId] = useState<number | null>(null);
  const [paymentsModalLoading, setPaymentsModalLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await getSales();
      setSales(rows);
    } catch (e) {
      showError('History', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales
      .filter((s) => {
        if (!unpaidOnly) return true;
        return !s.paid;
      })
      .filter((s) => {
        if (!q) return true;
        const hay = `${s.id} ${s.guest_name ?? ''} ${s.items ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .filter((s) => {
        const date = new Date(s.created_at);
        if (filterMonth && (date.getMonth() + 1) !== parseInt(filterMonth)) return false;
        if (filterYear && date.getFullYear() !== parseInt(filterYear)) return false;
        return true;
      })
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [sales, search, unpaidOnly, filterMonth, filterYear]);

  useEffect(() => {
    const rows = filtered.slice(0, 200);
    const missingIds = rows
      .map((s) => s.id)
      .filter((id) => typeof id === 'number' && !salePaymentSummaries[id]);

    if (missingIds.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          missingIds.map(async (saleId) => ({ saleId, summary: await getSalePaymentSummary(saleId) }))
        );
        if (cancelled) return;
        setSalePaymentSummaries((prev) => {
          const next = { ...prev };
          for (const r of results) next[r.saleId] = r.summary;
          return next;
        });
      } catch (err) {
        console.warn('Failed to preload payment summaries:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filtered, salePaymentSummaries]);

  const openDetails = async (saleId: number) => {
    setSelectedSaleId(saleId);
    setDetails(null);
    setPaymentSummary(null);
    setDetailsLoading(true);
    try {
      const [d, p] = await Promise.all([getSaleDetails(saleId), getSalePaymentSummary(saleId)]);
      setDetails(d);
      setPaymentSummary(p);
    } catch (e) {
      showError('Sale Details', e instanceof Error ? e.message : String(e));
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedSaleId(null);
    setDetails(null);
    setPaymentSummary(null);
  };

  const openPaymentsModal = async (saleId: number) => {
    setPaymentsModalSaleId(saleId);
    setPaymentsModalLoading(true);
    setPaymentMethod('cash');
    setPaymentNote('');

    try {
      const summary = await getSalePaymentSummary(saleId);
      setSalePaymentSummaries((prev) => ({ ...prev, [saleId]: summary }));
      setPaymentAmount(summary.balance_due);
    } catch (err) {
      console.error('Failed to load sale payment summary:', err);
      showError('Payments', 'Failed to load payment details');
      setPaymentsModalSaleId(null);
    } finally {
      setPaymentsModalLoading(false);
    }
  };

  const closePaymentsModal = () => {
    setPaymentsModalSaleId(null);
    setPaymentsModalLoading(false);
    setPaymentAmount(0);
    setPaymentMethod('cash');
    setPaymentNote('');
  };

  const submitPayment = async () => {
    if (!paymentsModalSaleId) return;
    const summary = salePaymentSummaries[paymentsModalSaleId];
    if (!summary) return;

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      showWarning('Payment', 'Enter a payment amount greater than 0');
      return;
    }
    if (paymentAmount > summary.balance_due + 1e-9) {
      showWarning('Payment', 'Payment cannot exceed the balance due');
      return;
    }

    setPaymentsModalLoading(true);
    try {
      const updated = await addSalePayment(
        paymentsModalSaleId,
        paymentAmount,
        paymentMethod,
        paymentNote.trim() ? paymentNote.trim() : undefined
      );
      setSalePaymentSummaries((prev) => ({ ...prev, [paymentsModalSaleId]: updated }));
      await load();
      showSuccess('Payment Saved', `New balance: ${formatMoney(updated.balance_due)}`);
      if (updated.balance_due <= 0.01) {
        closePaymentsModal();
      } else {
        setPaymentAmount(updated.balance_due);
        setPaymentNote('');
      }
    } catch (err) {
      console.error('Failed to add payment:', err);
      showError('Payment Failed', err instanceof Error ? err.message : 'Failed to save payment');
    } finally {
      setPaymentsModalLoading(false);
    }
  };

  const handleReprint = async (saleId: number) => {
    try {
      await printOrderReceipt(saleId);
      showSuccess('Printed', `Receipt for sale #${saleId} sent to printer`);
    } catch (e) {
      showError('Print', e instanceof Error ? e.message : String(e));
    }
  };

  const handleThermalReprint = async (saleId: number) => {
    try {
      await printThermalReceipt(saleId);
      showSuccess('Printed', `Thermal receipt for sale #${saleId} sent to printer`);
    } catch (e) {
      showError('Print', e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (saleId: number) => {
    setDeleteTargetId(saleId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetId === null) return;
    try {
      await deleteSale(deleteTargetId);
      showSuccess('Deleted', `Sale #${deleteTargetId} deleted`);
      setSelectedSaleId((prev) => (prev === deleteTargetId ? null : prev));
      await load();
    } catch (e) {
      showError('Delete', e instanceof Error ? e.message : String(e));
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
  };

  const modalBg = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  return (
    <div style={{ padding: '24px', backgroundColor: theme === 'dark' ? colors.primary : '#c7e2eb', color: colors.text, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="bc-btn bc-btn-outline" onClick={onBack} style={{ width: 'auto' }}>
          Back
        </button>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: colors.text }}>Sales History</div>
          <div style={{ fontSize: '14px', color: colors.textSecondary }}>Reprint, delete, or duplicate a sale</div>
        </div>
      </div>

      <div
        className="bc-card"
        style={{
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <input
          className="bc-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search by sale #, ${label.client.toLowerCase()} name, or items…`}
          style={{ flex: '1 1 320px', maxWidth: '520px' }}
        />

        <button
          type="button"
          className={unpaidOnly ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'}
          onClick={() => setUnpaidOnly((p) => !p)}
          style={{ width: 'auto' }}
        >
          {unpaidOnly ? 'Unpaid Only' : 'All Sales'}
        </button>

        <select
          className="bc-input"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          style={{ width: 'auto', minWidth: '120px' }}
        >
          <option value="">All Months</option>
          <option value="1">January</option>
          <option value="2">February</option>
          <option value="3">March</option>
          <option value="4">April</option>
          <option value="5">May</option>
          <option value="6">June</option>
          <option value="7">July</option>
          <option value="8">August</option>
          <option value="9">September</option>
          <option value="10">October</option>
          <option value="11">November</option>
          <option value="12">December</option>
        </select>

        <select
          className="bc-input"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          style={{ width: 'auto', minWidth: '100px' }}
        >
          <option value="">All Years</option>
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button
          type="button"
          className="bc-btn bc-btn-outline"
          onClick={() => {
            const csvData = filtered.map(s => ({
              'Sale ID': s.id,
              'Date': new Date(s.created_at).toLocaleString(),
              [label.client]: s.guest_name || 'Walk-in',
              'Items': s.items || '',
              'Total': s.total,
              'Paid': s.paid ? 'Yes' : 'No'
            }));
            const headers = Object.keys(csvData[0] || {});
            const csv = [
              headers.join(','),
              ...csvData.map(row => headers.map(h => JSON.stringify(row[h as keyof typeof row])).join(','))
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales-history-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showSuccess('Export', 'Sales history downloaded as CSV');
          }}
          style={{ width: 'auto' }}
        >
          📥 Export Excel
        </button>

        <button
          type="button"
          className="bc-btn bc-btn-outline"
          onClick={() => void load()}
          disabled={loading}
          style={{ width: 'auto' }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="bc-card" style={{ borderRadius: '10px', padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '16px', color: colors.textSecondary }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '16px', color: colors.textSecondary }}>No sales found.</div>
        ) : (
          <table className="bc-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                <th style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textSecondary }}>Sale</th>
                <th style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textSecondary }}>Date</th>
                <th style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textSecondary }}>{label.client}</th>
                <th style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textSecondary }}>Total</th>
                <th style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textSecondary }}>Status</th>
                <th style={{ textAlign: 'right', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textSecondary }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((s) => {
                const dt = new Date(s.created_at);
                const time = Number.isNaN(dt.getTime()) ? s.created_at : dt.toLocaleString();
                const summary = salePaymentSummaries[s.id];
                const amountPaid = summary?.amount_paid ?? 0;
                const balanceDue = summary?.balance_due ?? (s.paid ? 0 : s.total_amount || 0);
                const isPartial = amountPaid > 0.01 && balanceDue > 0.01;
                const isPaid = summary ? balanceDue < 0.01 : s.paid;
                return (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td>{time}</td>
                    <td>{s.guest_name ?? `Walk-in ${label.client}`}</td>
                    <td>{formatMoney(s.total_amount || 0)}</td>
                    <td>
                      {isPartial ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: '#FF9800', fontWeight: 900 }}>PARTIAL PAY</span>
                          <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                            Paid {formatMoney(amountPaid)} · Left {formatMoney(balanceDue)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: isPaid ? colors.success : colors.error, fontWeight: 800 }}>
                          {isPaid ? 'PAID' : 'UNPAID'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          background: openMenuId === s.id ? colors.border : 'transparent',
                          color: colors.text,
                          cursor: 'pointer',
                          fontSize: '18px',
                          fontWeight: 900,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ⋯
                      </button>
                      
                      {openMenuId === s.id && (
                        <>
                          <div
                            style={{
                              position: 'fixed',
                              inset: 0,
                              zIndex: 999,
                            }}
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '42px',
                              minWidth: '200px',
                              background: theme === 'dark' ? '#1e293b' : '#ffffff',
                              border: `2px solid ${colors.border}`,
                              borderRadius: '12px',
                              boxShadow: theme === 'dark' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.2)',
                              zIndex: 1000,
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                void openDetails(s.id);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                background: 'transparent',
                                color: colors.text,
                                fontSize: '14px',
                                fontWeight: 600,
                                textAlign: 'left',
                                cursor: 'pointer',
                                borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              👁️ View Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                void handleReprint(s.id);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                background: 'transparent',
                                color: colors.text,
                                fontSize: '14px',
                                fontWeight: 600,
                                textAlign: 'left',
                                cursor: 'pointer',
                                borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              🖨️ Reprint Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                void handleThermalReprint(s.id);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                background: 'transparent',
                                color: colors.text,
                                fontSize: '14px',
                                fontWeight: 600,
                                textAlign: 'left',
                                cursor: 'pointer',
                                borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              🧾 Thermal Print
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onDuplicateSale(s.id);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                background: 'transparent',
                                color: colors.text,
                                fontSize: '14px',
                                fontWeight: 600,
                                textAlign: 'left',
                                cursor: 'pointer',
                                borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              📋 Re-edit (Duplicate)
                            </button>
                            {isPartial && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  void openPaymentsModal(s.id);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px 16px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#FF9800',
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                💳 Adjust Payment
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                void handleDelete(s.id);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                background: 'transparent',
                                color: colors.error,
                                fontSize: '14px',
                                fontWeight: 600,
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedSaleId !== null && (
        <div className="bc-modal-overlay" onClick={closeDetails}>
          <div className="bc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '860px', padding: '24px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: colors.text }}>Sale #{selectedSaleId}</div>
                <div style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '4px' }}>Items, totals, and payment status</div>
              </div>
              <button type="button" className="bc-btn bc-btn-outline" onClick={closeDetails} style={{ width: 'auto' }}>
                Close
              </button>
            </div>

            {detailsLoading ? (
              <div style={{ marginTop: '12px', color: colors.textSecondary }}>Loading…</div>
            ) : !details ? (
              <div style={{ marginTop: '12px', color: colors.textSecondary }}>No details.</div>
            ) : (
              <div style={{ marginTop: '12px', display: 'grid', gap: '12px' }}>
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    background: modalBg,
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px' }}>
                    <div>
                      Total: <strong>{formatMoney(details.order.total_amount || 0)}</strong>
                    </div>
                    <div>
                      Status:{' '}
                      <strong style={{ color: details.order.paid ? colors.success : colors.error }}>
                        {details.order.paid ? 'PAID' : 'UNPAID'}
                      </strong>
                    </div>
                    <div>
                      {label.client}: <strong>{details.order.customer_name ?? `Walk-in ${label.client}`}</strong>
                    </div>
                  </div>

                  {paymentSummary && (
                    <div style={{ marginTop: '10px', fontSize: '13px', opacity: 0.9 }}>
                      Paid: <strong>{formatMoney(paymentSummary.amount_paid)}</strong> · Balance:{' '}
                      <strong>{formatMoney(paymentSummary.balance_due)}</strong>
                    </div>
                  )}
                </div>

                <div className="bc-card" style={{ padding: '0', overflow: 'hidden', borderRadius: '12px' }}>
                  <table className="bc-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.item_name}</td>
                          <td>{it.quantity}</td>
                          <td>{formatMoney(it.unit_price)}</td>
                          <td>{formatMoney(it.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="bc-btn bc-btn-outline"
                    onClick={() => void handleReprint(selectedSaleId)}
                    style={{ width: 'auto' }}
                  >
                    Reprint
                  </button>
                  <button
                    type="button"
                    className="bc-btn bc-btn-outline"
                    onClick={() => onDuplicateSale(selectedSaleId)}
                    style={{ width: 'auto' }}
                  >
                    Re-edit (Duplicate)
                  </button>
                  <button
                    type="button"
                    className="bc-btn bc-btn-outline"
                    onClick={() => void handleDelete(selectedSaleId)}
                    style={{ width: 'auto', color: colors.error }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="bc-modal-overlay" onClick={handleCancelDelete}>
          <div className="bc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '24px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: colors.text, marginBottom: '10px' }}>
              Delete Sale
            </div>
            <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '22px', lineHeight: 1.5 }}>
              Are you sure you want to delete sale #{deleteTargetId}? This cannot be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="bc-btn bc-btn-outline" onClick={handleCancelDelete} style={{ width: 'auto' }}>
                Cancel
              </button>
              <button type="button" className="bc-btn bc-btn-primary" onClick={() => void handleConfirmDelete()} style={{ width: 'auto', background: colors.error, borderColor: colors.error }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentsModalSaleId !== null && (
        <div className="bc-modal-overlay" onClick={closePaymentsModal}>
          <div className="bc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '24px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: colors.text }}>Adjust Payment</div>
                <div style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '4px' }}>Record a partial payment</div>
              </div>
              <button type="button" className="bc-btn bc-btn-outline" onClick={closePaymentsModal} style={{ width: 'auto' }}>
                Close
              </button>
            </div>

            <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Amount</div>
                <input
                  className="bc-input"
                  type="number"
                  value={Number.isFinite(paymentAmount) ? paymentAmount : 0}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  disabled={paymentsModalLoading}
                />
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Method</div>
                <select
                  className="bc-input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={paymentsModalLoading}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank</option>
                  <option value="mobile">Mobile</option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Note (optional)</div>
                <input
                  className="bc-input"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  disabled={paymentsModalLoading}
                  placeholder="Add a note"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="bc-btn bc-btn-outline"
                  onClick={closePaymentsModal}
                  style={{ width: 'auto' }}
                  disabled={paymentsModalLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bc-btn bc-btn-primary"
                  onClick={() => void submitPayment()}
                  style={{ width: 'auto' }}
                  disabled={paymentsModalLoading}
                >
                  {paymentsModalLoading ? 'Saving…' : 'Save Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistoryPage;

