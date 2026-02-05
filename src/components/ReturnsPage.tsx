import React, { useEffect, useMemo, useState } from 'react';
import {
  addSaleReturn,
  getSaleReturnDetails,
  getSaleReturnableItems,
  getSaleReturns,
  getSales,
  printSaleReturnReceipt,
  type ReturnableSaleItem,
  type SaleReturnDetails,
  type SaleReturnSummary,
  type SaleSummary,
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { handleNumberInputFocus } from '../utils/inputHelpers';

interface ReturnsPageProps {
  onBack: () => void;
}

type Tab = 'process' | 'history';

const ReturnsPage: React.FC<ReturnsPageProps> = ({ onBack }) => {
  const { colors, theme } = useTheme();
  const { formatMoney } = useCurrency();
  const { showError, showSuccess, showInfo } = useNotification();

  const [tab, setTab] = useState<Tab>('process');

  // Sale picker
  const [salePickerOpen, setSalePickerOpen] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [recentSales, setRecentSales] = useState<SaleSummary[]>([]);
  const [saleSearch, setSaleSearch] = useState('');

  // Process return state
  const [saleIdInput, setSaleIdInput] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refundMethod, setRefundMethod] = useState<string>('Cash');
  const [refundAmountInput, setRefundAmountInput] = useState<string>('');
  const [headerNote, setHeaderNote] = useState<string>('');

  const [returnable, setReturnable] = useState<ReturnableSaleItem[]>([]);
  const [qtyBySaleItemId, setQtyBySaleItemId] = useState<Record<number, number>>({});
  const [noteBySaleItemId, setNoteBySaleItemId] = useState<Record<number, string>>({});
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  // History state
  const [history, setHistory] = useState<SaleReturnSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null);
  const [details, setDetails] = useState<SaleReturnDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '16px',
    boxShadow: `0 4px 12px ${colors.shadow}`,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surface,
    color: colors.text,
    outline: 'none',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: colors.accent,
    color: theme === 'dark' ? 'black' : 'white',
    fontWeight: 800,
    cursor: 'pointer',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: '10px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surface,
    color: colors.text,
    fontWeight: 800,
    cursor: 'pointer',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 50,
  };

  const modalStyle: React.CSSProperties = {
    width: 'min(980px, 100%)',
    maxHeight: '80vh',
    overflow: 'hidden',
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '14px',
    boxShadow: `0 16px 42px ${colors.shadow}`,
  };

  const saleId = useMemo(() => {
    const n = Number.parseInt(saleIdInput, 10);
    return Number.isFinite(n) ? n : null;
  }, [saleIdInput]);

  const computedTotal = useMemo(() => {
    let total = 0;
    for (const it of returnable) {
      const qty = qtyBySaleItemId[it.sale_item_id] ?? 0;
      if (qty > 0) total += qty * (it.unit_price || 0);
    }
    return total;
  }, [qtyBySaleItemId, returnable]);

  const resetProcessForm = () => {
    setSaleIdInput('');
    setReturnable([]);
    setQtyBySaleItemId({});
    setNoteBySaleItemId({});
    setRefundAmountInput('');
    setHeaderNote('');
    setRefundMethod('Cash');
    setReturnDate(new Date().toISOString().slice(0, 10));
  };

  const loadReturnableForSaleId = async (id: number) => {
    setLoadingItems(true);
    try {
      const data = await getSaleReturnableItems(id);
      setReturnable(data);

      // initialize qty/note state
      const qtyInit: Record<number, number> = {};
      const noteInit: Record<number, string> = {};
      for (const it of data) {
        qtyInit[it.sale_item_id] = 0;
        noteInit[it.sale_item_id] = '';
      }
      setQtyBySaleItemId(qtyInit);
      setNoteBySaleItemId(noteInit);

      if (data.length === 0) {
        showInfo('No Items', 'This sale has no items to return');
      }
    } catch (e) {
      console.error(e);
      showError('Load Failed', String(e));
    } finally {
      setLoadingItems(false);
    }
  };

  const loadReturnable = async () => {
    if (!saleId) {
      showError('Invalid Sale ID', 'Enter a valid sale ID (number)');
      return;
    }
    await loadReturnableForSaleId(saleId);
  };

  const openSalePicker = async () => {
    setSalePickerOpen(true);
    if (recentSales.length > 0) return;
    setSalesLoading(true);
    try {
      const data = await getSales();
      // most recent first
      setRecentSales([...data].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 250));
    } catch (e) {
      console.error(e);
      showError('Load Failed', String(e));
    } finally {
      setSalesLoading(false);
    }
  };

  const filteredSales = useMemo(() => {
    const q = saleSearch.trim().toLowerCase();
    if (!q) return recentSales;
    return recentSales.filter((s) => {
      const idMatch = String(s.id).includes(q);
      const itemsMatch = (s.items || '').toLowerCase().includes(q);
      const dateMatch = (s.created_at || '').toLowerCase().includes(q);
      return idMatch || itemsMatch || dateMatch;
    });
  }, [recentSales, saleSearch]);

  const setQty = (saleItemId: number, nextQty: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, nextQty));
    setQtyBySaleItemId((prev) => ({ ...prev, [saleItemId]: clamped }));
  };

  const saveReturn = async () => {
    if (!saleId) {
      showError('Invalid Sale ID', 'Enter a valid sale ID (number)');
      return;
    }

    const items = returnable
      .map((it) => ({
        sale_item_id: it.sale_item_id,
        quantity: qtyBySaleItemId[it.sale_item_id] ?? 0,
        note: (noteBySaleItemId[it.sale_item_id] ?? '').trim() || null,
      }))
      .filter((x) => x.quantity > 0);

    if (items.length === 0) {
      showError('Nothing Selected', 'Choose at least one item to return');
      return;
    }

    const refundAmount = refundAmountInput.trim()
      ? Number.parseFloat(refundAmountInput)
      : null;

    if (refundAmount != null) {
      if (!Number.isFinite(refundAmount) || refundAmount < 0) {
        showError('Invalid Refund Amount', 'Refund amount must be a valid non-negative number');
        return;
      }
      if (refundAmount > computedTotal + 1e-9) {
        showError('Invalid Refund Amount', `Refund cannot exceed ${formatMoney(computedTotal)}`);
        return;
      }
    }

    setSaving(true);
    try {
      const returnId = await addSaleReturn({
        saleId,
        returnDate,
        refundMethod: refundMethod.trim() ? refundMethod.trim() : null,
        refundAmount,
        note: headerNote.trim() ? headerNote.trim() : null,
        items,
      });

      showSuccess('Return Saved', `Return #${returnId} recorded. Restocked items where applicable.`);
      resetProcessForm();
      setTab('history');
    } catch (e) {
      console.error(e);
      showError('Save Failed', String(e));
    } finally {
      setSaving(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getSaleReturns(200);
      setHistory(data);
    } catch (e) {
      console.error(e);
      showError('Load Failed', String(e));
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadDetails = async (returnId: number) => {
    setSelectedReturnId(returnId);
    setLoadingDetails(true);
    setDetails(null);
    try {
      const d = await getSaleReturnDetails(returnId);
      setDetails(d);
    } catch (e) {
      console.error(e);
      showError('Load Failed', String(e));
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (tab === 'history') {
      void loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tabButton = (id: Tab, label: string) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          padding: '10px 12px',
          borderRadius: '999px',
          border: `1px solid ${active ? colors.accent : colors.border}`,
          backgroundColor: active ? colors.accent : colors.surface,
          color: active ? (theme === 'dark' ? 'black' : 'white') : colors.text,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ padding: '24px', backgroundColor: colors.primary, minHeight: '100vh', color: colors.text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: colors.text }}>Returns & Refunds</h1>
          <div style={{ marginTop: '4px', fontSize: '13px', color: colors.textSecondary }}>
            Process a return from an existing sale and automatically restock tracked items.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onBack} style={secondaryButtonStyle}>
            Back
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        {tabButton('process', 'Process Return')}
        {tabButton('history', 'History')}
      </div>

      {tab === 'process' && (
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          <div style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 200px 220px 1fr', gap: '12px', alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>Sale ID</div>
                <input
                  value={saleIdInput}
                  onChange={(e) => setSaleIdInput(e.target.value)}
                  placeholder="e.g. 123"
                  style={inputStyle}
                />
                <div style={{ marginTop: '8px' }}>
                  <button onClick={() => void openSalePicker()} style={secondaryButtonStyle}>
                    Select from Sales History
                  </button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>Return date</div>
                <input value={returnDate} onChange={(e) => setReturnDate(e.target.value)} type="date" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>Refund method</div>
                <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} style={inputStyle}>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Store Credit">Store Credit</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={loadReturnable} style={buttonStyle} disabled={loadingItems}>
                  {loadingItems ? 'Loading…' : 'Load Items'}
                </button>
                <button onClick={resetProcessForm} style={secondaryButtonStyle}>
                  Reset
                </button>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>Note (optional)</div>
              <input
                value={headerNote}
                onChange={(e) => setHeaderNote(e.target.value)}
                placeholder="Reason for return, condition, etc."
                style={inputStyle}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ fontWeight: 900 }}>Items</div>
              <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                Return total: <span style={{ color: colors.text, fontWeight: 900 }}>{formatMoney(computedTotal)}</span>
              </div>
            </div>

            {returnable.length === 0 ? (
              <div style={{ padding: '12px 0', color: colors.textSecondary }}>Load a sale to see returnable items.</div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                      <th style={{ padding: '10px 8px' }}>Item</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Unit</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Sold</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Returned</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Remaining</th>
                      <th style={{ padding: '10px 8px', width: '120px' }}>Return qty</th>
                      <th style={{ padding: '10px 8px' }}>Line note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnable.map((it) => {
                      const max = it.remaining_qty || 0;
                      const qty = qtyBySaleItemId[it.sale_item_id] ?? 0;
                      const disabled = max <= 0;
                      return (
                        <tr key={it.sale_item_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td style={{ padding: '10px 8px', fontWeight: 800, color: colors.text }}>{it.item_name}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(it.unit_price || 0)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>{it.sold_qty}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>{it.returned_qty}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{max}</td>
                          <td style={{ padding: '10px 8px' }}>
                            <input
                              type="number"
                              min={0}
                              max={max}
                              value={qty}
                              disabled={disabled}
                              onChange={(e) => setQty(it.sale_item_id, Number.parseInt(e.target.value || '0', 10), max)}
                              onFocus={handleNumberInputFocus}
                              style={{
                                ...inputStyle,
                                padding: '8px 10px',
                                opacity: disabled ? 0.6 : 1,
                              }}
                            />
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <input
                              value={noteBySaleItemId[it.sale_item_id] ?? ''}
                              disabled={disabled}
                              onChange={(e) =>
                                setNoteBySaleItemId((prev) => ({ ...prev, [it.sale_item_id]: e.target.value }))
                              }
                              placeholder="Optional"
                              style={{
                                ...inputStyle,
                                padding: '8px 10px',
                                opacity: disabled ? 0.6 : 1,
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '320px' }}>
                <div style={{ fontSize: '12px', color: colors.textSecondary, width: '120px' }}>Refund amount</div>
                <input
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(e.target.value)}
                  placeholder={`Max ${formatMoney(computedTotal)}`}
                  style={{ ...inputStyle, maxWidth: '220px' }}
                />
                <div style={{ fontSize: '12px', color: colors.textSecondary }}>(leave blank = full refund)</div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={saveReturn} style={buttonStyle} disabled={saving || loadingItems || returnable.length === 0}>
                  {saving ? 'Saving…' : 'Save Return'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: selectedReturnId ? '1fr 1fr' : '1fr', gap: '12px' }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 900 }}>Recent returns</div>
              <button onClick={() => void loadHistory()} style={secondaryButtonStyle} disabled={loadingHistory}>
                {loadingHistory ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: '12px 0', color: colors.textSecondary }}>Loading…</div>
            ) : history.length === 0 ? (
              <div style={{ padding: '12px 0', color: colors.textSecondary }}>No returns found.</div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                      <th style={{ padding: '10px 8px' }}>Return</th>
                      <th style={{ padding: '10px 8px' }}>Sale</th>
                      <th style={{ padding: '10px 8px' }}>Date</th>
                      <th style={{ padding: '10px 8px' }}>Method</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Refund</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Items</th>
                      <th style={{ padding: '10px 8px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '10px 8px', fontWeight: 900 }}>#{r.id}</td>
                        <td style={{ padding: '10px 8px' }}>#{r.sale_id}</td>
                        <td style={{ padding: '10px 8px' }}>{r.return_date}</td>
                        <td style={{ padding: '10px 8px' }}>{r.refund_method || '—'}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney(r.refund_amount || 0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{r.item_count}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                          <button onClick={() => void loadDetails(r.id)} style={secondaryButtonStyle}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedReturnId && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 900 }}>Return details</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={async () => {
                      if (!details) return;
                      try {
                        await printSaleReturnReceipt(details.ret.id);
                        showSuccess('Printing', 'Return receipt opened for printing');
                      } catch (e) {
                        console.error(e);
                        showError('Print Failed', String(e));
                      }
                    }}
                    style={secondaryButtonStyle}
                    disabled={!details}
                  >
                    Print Receipt
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReturnId(null);
                      setDetails(null);
                    }}
                    style={secondaryButtonStyle}
                  >
                    Close
                  </button>
                </div>
              </div>

              {loadingDetails ? (
                <div style={{ padding: '12px 0', color: colors.textSecondary }}>Loading…</div>
              ) : !details ? (
                <div style={{ padding: '12px 0', color: colors.textSecondary }}>Select a return to view details.</div>
              ) : (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
                      Return #{details.ret.id} • Sale #{details.ret.sale_id} • {details.ret.return_date}
                    </div>
                    <div style={{ fontWeight: 900 }}>{formatMoney(details.ret.refund_amount || 0)}</div>
                  </div>

                  <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                          <th style={{ padding: '10px 8px' }}>Item</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>Unit</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>Qty</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.items.map((it) => (
                          <tr key={it.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <td style={{ padding: '10px 8px', fontWeight: 800 }}>{it.item_name}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(it.unit_price || 0)}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{it.quantity}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney(it.line_total || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {salePickerOpen && (
        <div
          style={overlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSalePickerOpen(false);
          }}
        >
          <div style={modalStyle}>
            <div
              style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: 900 }}>Select a sale</div>
                <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                  Search by ID, date, or items.
                </div>
              </div>
              <button onClick={() => setSalePickerOpen(false)} style={secondaryButtonStyle}>
                Close
              </button>
            </div>

            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <input
                value={saleSearch}
                onChange={(e) => setSaleSearch(e.target.value)}
                placeholder="Search…"
                style={inputStyle}
              />
            </div>

            <div style={{ maxHeight: '60vh', overflow: 'auto', padding: '0 16px 14px' }}>
              {salesLoading ? (
                <div style={{ padding: '12px 0', color: colors.textSecondary }}>Loading sales…</div>
              ) : filteredSales.length === 0 ? (
                <div style={{ padding: '12px 0', color: colors.textSecondary }}>No sales found.</div>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                        <th style={{ padding: '10px 8px' }}>Sale</th>
                        <th style={{ padding: '10px 8px' }}>Date</th>
                        <th style={{ padding: '10px 8px' }}>Items</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '10px 8px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((s) => {
                        const dt = new Date(s.created_at);
                        const dateText = Number.isNaN(dt.getTime()) ? s.created_at : dt.toLocaleString();
                        return (
                          <tr key={s.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <td style={{ padding: '10px 8px', fontWeight: 900 }}>#{s.id}</td>
                            <td style={{ padding: '10px 8px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>{dateText}</td>
                            <td style={{ padding: '10px 8px', maxWidth: '520px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.items}>
                              {s.items || '—'}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900 }}>{formatMoney(s.total_amount || 0)}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                              <button
                                onClick={() => {
                                  setSaleIdInput(String(s.id));
                                  setSalePickerOpen(false);
                                  void loadReturnableForSaleId(s.id);
                                }}
                                style={secondaryButtonStyle}
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnsPage;
