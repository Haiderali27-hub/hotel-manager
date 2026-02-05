import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MenuItem,
  StockAdjustmentDetails,
  StockAdjustmentItemInput,
  StockAdjustmentSummary,
} from '../api/client';
import {
  addStockAdjustment,
  getBarcodeEnabled,
  getMenuItems,
  getStockAdjustmentDetails,
  getStockAdjustments,
} from '../api/client';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface StockAdjustmentsPageProps {
  onBack: () => void;
}

type DraftLine = {
  menu_item_id: number | null;
  mode: 'set' | 'add' | 'remove';
  quantity: string;
  note: string;
};

const todayYmd = () => new Date().toISOString().slice(0, 10);

const StockAdjustmentsPage: React.FC<StockAdjustmentsPageProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { showError, showSuccess, showWarning } = useNotification();

  const [loading, setLoading] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [barcodeEnabled, setBarcodeEnabled] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<StockAdjustmentSummary[]>([]);

  const [draftDate, setDraftDate] = useState(todayYmd());
  const [draftReason, setDraftReason] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { menu_item_id: null, mode: 'set', quantity: '0', note: '' },
  ]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<StockAdjustmentDetails | null>(null);

  const trackedItems = useMemo(() => {
    return menuItems
      .filter((m) => (m.track_stock ?? 0) === 1)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [menuItems]);

  const menuById = useMemo(() => {
    const map = new Map<number, MenuItem>();
    for (const m of menuItems) map.set(m.id, m);
    return map;
  }, [menuItems]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getMenuItems();
      setMenuItems(items);
    } catch (e) {
      showError('Load failed', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await getStockAdjustments();
      setHistory(rows);
    } catch (e) {
      showError('History', e instanceof Error ? e.message : String(e));
    } finally {
      setHistoryLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void loadAll();
    void loadHistory();
  }, [loadAll, loadHistory]);

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

  const addLine = () => {
    setLines((prev) => [...prev, { menu_item_id: null, mode: 'set', quantity: '0', note: '' }]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const parsePositiveInt = (raw: string) => {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : NaN;
  };

  const save = async () => {
    const date = draftDate.trim();
    const reason = draftReason.trim();
    const notes = draftNotes.trim();

    if (!date) {
      showError('Validation', 'Date is required');
      return;
    }
    if (!reason) {
      showError('Validation', 'Reason is required');
      return;
    }

    const items: StockAdjustmentItemInput[] = [];
    for (const [idx, l] of lines.entries()) {
      if (!l.menu_item_id) {
        showError('Validation', `Line ${idx + 1}: select a product`);
        return;
      }
      const qty = parsePositiveInt(l.quantity);
      if (!Number.isFinite(qty) || qty < 0) {
        showError('Validation', `Line ${idx + 1}: quantity must be a non-negative integer`);
        return;
      }
      // For 'add' and 'remove' modes, quantity must be > 0
      if ((l.mode === 'add' || l.mode === 'remove') && qty <= 0) {
        showError('Validation', `Line ${idx + 1}: quantity must be greater than 0 for ${l.mode} mode`);
        return;
      }
      items.push({
        menu_item_id: l.menu_item_id,
        mode: l.mode,
        quantity: qty,
        note: l.note.trim() || undefined,
      });
    }

    // Gentle warning (backend enforces this too)
    for (const it of items) {
      const m = menuById.get(it.menu_item_id);
      if (m && (m.track_stock ?? 0) !== 1) {
        showWarning('Not a stock item', `'${m.name}' is not tracked stock`);
        return;
      }
    }

    try {
      await addStockAdjustment({
        adjustment_date: date,
        reason,
        notes: notes || undefined,
        items,
      });
      showSuccess('Saved', 'Stock adjustment recorded');
      setDraftReason('');
      setDraftNotes('');
      setLines([{ menu_item_id: null, mode: 'set', quantity: '0', note: '' }]);
      await loadAll();
      await loadHistory();
    } catch (e) {
      showError('Save failed', e instanceof Error ? e.message : String(e));
    }
  };

  const openDetails = async (adjustmentId: number) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetails(null);
    try {
      const d = await getStockAdjustmentDetails(adjustmentId);
      setDetails(d);
    } catch (e) {
      showError('Details', e instanceof Error ? e.message : String(e));
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetails(null);
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: colors.text }}>Stock Adjustments</h1>
          <div style={{ marginTop: '4px', fontSize: '13px', color: colors.textSecondary }}>
            Audit and correct inventory (set/add/remove) with an audit trail.
          </div>
        </div>
        <button type="button" className="bc-btn bc-btn-outline" onClick={onBack} style={{ width: 'auto' }}>
          Back
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 900, color: colors.text }}>Create adjustment</div>

          <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Date</div>
                <input
                  className="bc-input"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Reason</div>
                <input
                  className="bc-input"
                  value={draftReason}
                  onChange={(e) => setDraftReason(e.target.value)}
                  placeholder="e.g. Stock count, damaged goods, correction"
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Notes (optional)</div>
              <textarea
                className="bc-input"
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 900, color: colors.text }}>Items</div>
                <button type="button" className="bc-btn bc-btn-outline" onClick={addLine} style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}>
                  Add line
                </button>
              </div>

              <div style={{ marginTop: '8px', display: 'grid', gap: '10px' }}>
                {lines.map((l, idx) => {
                  const m = l.menu_item_id ? menuById.get(l.menu_item_id) : undefined;
                  const stock = m ? (m.stock_quantity ?? 0) : null;
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 1fr auto', gap: '10px', alignItems: 'end' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Product</div>
                        <select
                          className="bc-input"
                          value={l.menu_item_id ?? ''}
                          onChange={(e) => {
                            const v = e.target.value ? parseInt(e.target.value, 10) : NaN;
                            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, menu_item_id: Number.isFinite(v) ? v : null } : x)));
                          }}
                          disabled={loading}
                        >
                          <option value="">Select…</option>
                          {trackedItems.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}{barcodeEnabled && p.sku ? ` (${p.sku})` : ''}
                            </option>
                          ))}
                        </select>
                        <div style={{ marginTop: '6px', fontSize: '11px', color: colors.textSecondary }}>
                          Current stock: {stock === null ? '—' : stock}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Mode</div>
                        <select
                          className="bc-input"
                          value={l.mode}
                          onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, mode: e.target.value as DraftLine['mode'] } : x)))}
                        >
                          <option value="set">Set</option>
                          <option value="add">Add</option>
                          <option value="remove">Remove</option>
                        </select>
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Qty</div>
                        <input
                          className="bc-input"
                          value={l.quantity}
                          onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                          inputMode="numeric"
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>Note</div>
                        <input
                          className="bc-input"
                          value={l.note}
                          onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))}
                          placeholder="optional"
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="bc-btn bc-btn-outline"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length <= 1}
                          style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" className="bc-btn bc-btn-primary" onClick={save} style={{ width: 'auto' }}>
                Save adjustment
              </button>
            </div>
          </div>
        </div>

        <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 900, color: colors.text }}>History</div>
            <button
              type="button"
              className="bc-btn bc-btn-outline"
              onClick={() => void loadHistory()}
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
              disabled={historyLoading}
            >
              Refresh
            </button>
          </div>

          {historyLoading ? (
            <div style={{ marginTop: '10px', color: colors.textSecondary }}>Loading…</div>
          ) : history.length === 0 ? (
            <div style={{ marginTop: '10px', color: colors.textSecondary }}>No adjustments yet.</div>
          ) : (
            <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
              {history.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="bc-card"
                  onClick={() => void openDetails(h.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: colors.text }}>{h.adjustment_date}</div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                        {h.reason || '—'}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>{h.item_count} items</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {detailsOpen && (
        <div className="bc-modal-overlay">
          <div className="bc-modal" style={{ maxWidth: '760px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: colors.text }}>Adjustment details</div>
              <button type="button" className="bc-btn bc-btn-outline" onClick={closeDetails} style={{ width: 'auto' }}>
                Close
              </button>
            </div>

            {detailsLoading || !details ? (
              <div style={{ marginTop: '12px', color: colors.textSecondary }}>Loading…</div>
            ) : (
              <div style={{ marginTop: '12px' }}>
                <div className="bc-card" style={{ borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: colors.text }}>{details.adjustment.adjustment_date}</div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: colors.textSecondary }}>
                    {details.adjustment.reason || '—'}
                  </div>
                  {details.adjustment.notes ? (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: colors.textSecondary }}>{details.adjustment.notes}</div>
                  ) : null}
                </div>

                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: colors.text }}>Items</div>
                  <div style={{ marginTop: '8px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>Product</th>
                          <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>Prev</th>
                          <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>Change</th>
                          <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>New</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.items.map((it) => (
                          <tr key={it.id}>
                            <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, color: colors.text, fontWeight: 800 }}>{it.item_name}</td>
                            <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'right', color: colors.textSecondary }}>{it.previous_stock}</td>
                            <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'right', color: it.quantity_change < 0 ? 'var(--app-action)' : colors.textSecondary }}>
                              {it.quantity_change > 0 ? `+${it.quantity_change}` : String(it.quantity_change)}
                            </td>
                            <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, textAlign: 'right', color: colors.textSecondary }}>{it.new_stock}</td>
                            <td style={{ padding: '10px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{it.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockAdjustmentsPage;
