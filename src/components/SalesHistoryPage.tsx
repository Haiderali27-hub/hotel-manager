import React, { useEffect, useMemo, useState } from 'react';
import {
    buildOrderReceiptHtml,
    deleteSale,
    getSaleDetails,
    getSalePaymentSummary,
    getSales,
    type SaleDetails,
    type SalePaymentSummary,
    type SaleSummary,
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

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

  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<SaleDetails | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<SalePaymentSummary | null>(null);

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
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [sales, search, unpaidOnly]);

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

  const handleReprint = async (saleId: number) => {
    try {
      const html = await buildOrderReceiptHtml(saleId);
      const w = window.open('', '_blank');
      if (!w) {
        showWarning('Print Window Blocked', 'Please allow popups to print receipts');
        return;
      }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      w.close();
      showSuccess('Printed', `Receipt for sale #${saleId} sent to printer`);
    } catch (e) {
      showError('Print', e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (saleId: number) => {
    const ok = window.confirm(`Delete sale #${saleId}? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteSale(saleId);
      showSuccess('Deleted', `Sale #${saleId} deleted`);
      setSelectedSaleId((prev) => (prev === saleId ? null : prev));
      await load();
    } catch (e) {
      showError('Delete', e instanceof Error ? e.message : String(e));
    }
  };

  const modalBg = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  return (
    <div style={{ padding: '24px', backgroundColor: colors.primary, color: colors.text, minHeight: '100vh' }}>
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
              <tr>
                <th>Sale</th>
                <th>Date</th>
                <th>{label.client}</th>
                <th>Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((s) => {
                const dt = new Date(s.created_at);
                const time = Number.isNaN(dt.getTime()) ? s.created_at : dt.toLocaleString();
                return (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td>{time}</td>
                    <td>{s.guest_name ?? `Walk-in ${label.client}`}</td>
                    <td>{formatMoney(s.total_amount || 0)}</td>
                    <td>
                      <span style={{ color: s.paid ? colors.success : colors.error, fontWeight: 800 }}>
                        {s.paid ? 'PAID' : 'UNPAID'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="bc-btn bc-btn-outline"
                          onClick={() => void openDetails(s.id)}
                          style={{ width: 'auto', minHeight: 40 }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="bc-btn bc-btn-outline"
                          onClick={() => void handleReprint(s.id)}
                          style={{ width: 'auto', minHeight: 40 }}
                        >
                          Reprint
                        </button>
                        <button
                          type="button"
                          className="bc-btn bc-btn-outline"
                          onClick={() => onDuplicateSale(s.id)}
                          style={{ width: 'auto', minHeight: 40 }}
                        >
                          Re-edit (Duplicate)
                        </button>
                        <button
                          type="button"
                          className="bc-btn bc-btn-outline"
                          onClick={() => void handleDelete(s.id)}
                          style={{ width: 'auto', minHeight: 40, color: colors.error }}
                        >
                          Delete
                        </button>
                      </div>
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
          <div className="bc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '860px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: colors.text }}>Sale #{selectedSaleId}</div>
                <div style={{ fontSize: '13px', color: colors.textSecondary }}>Items, totals, and payment status</div>
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
                      {label.client}: <strong>{details.order.customer_name ?? details.order.guest_id ?? `Walk-in ${label.client}`}</strong>
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
    </div>
  );
};

export default SalesHistoryPage;
