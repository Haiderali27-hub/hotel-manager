import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface ShiftSummary {
  id: number;
  opened_at: string;
  closed_at: string | null;
  opened_by: number;
  closed_by: number | null;
  start_cash: number;
  end_cash_expected: number;
  end_cash_actual: number;
  difference: number;
  total_sales: number;
  total_expenses: number;
  status: 'open' | 'closed';
  notes: string | null;
}

const ShiftManager: React.FC = () => {
  const { theme, colors } = useTheme();
  const { formatMoney } = useCurrency();
  const { adminId } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();
  const [currentShift, setCurrentShift] = useState<ShiftSummary | null>(null);
  const [shiftHistory, setShiftHistory] = useState<ShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [startCash, setStartCash] = useState('0');
  const [endCashActual, setEndCashActual] = useState('0');
  const [notes, setNotes] = useState('');

  const isDark = theme === 'dark';

  const fetchCurrentShift = async () => {
    try {
      const shift: ShiftSummary | null = await invoke('get_current_shift');
      setCurrentShift(shift);
    } catch (error) {
      console.error('Failed to fetch current shift:', error);
    }
  };

  const fetchShiftHistory = async () => {
    try {
      const history: ShiftSummary[] = await invoke('get_shift_history', { limit: 10 });
      setShiftHistory(history);
    } catch (error) {
      console.error('Failed to fetch shift history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentShift();
    fetchShiftHistory();
  }, []);

  const handleOpenShift = async () => {
    try {
      await invoke('open_shift', {
        adminId: adminId || 1,
        startCash: parseFloat(startCash),
      });
      showSuccess('Shift opened successfully');
      setShowOpenModal(false);
      setStartCash('0');
      await fetchCurrentShift();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;

    try {
      const result: ShiftSummary = await invoke('close_shift', {
        shiftId: currentShift.id,
        adminId: adminId || 1,
        endCashActual: parseFloat(endCashActual),
        notes: notes.trim() || null,
      });

      if (result.difference === 0) {
        showSuccess(`Shift closed. Difference: ${formatMoney(result.difference)}`);
      } else {
        showWarning(`Shift closed. Difference: ${formatMoney(result.difference)}`);
      }
      setShowCloseModal(false);
      setEndCashActual('0');
      setNotes('');
      await fetchCurrentShift();
      await fetchShiftHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (loading) {
    return <div style={{ color: colors.text }}>Loading shift information...</div>;
  }

  return (
    <div style={{ padding: '1.5rem', color: colors.text }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>
        💼 Shift Management (Z-Report)
      </h2>

      {/* Current Shift Status */}
      <div
        style={{
          background: colors.surface,
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: isDark
            ? '0 4px 6px rgba(0, 0, 0, 0.3)'
            : '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>Current Shift</h3>

        {currentShift ? (
          <div>
            <div
              style={{
                display: 'inline-block',
                background: '#28a745',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontWeight: '600',
              }}
            >
              ✅ Shift is OPEN
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Opened At:</strong>
                <div>{formatDateTime(currentShift.opened_at)}</div>
              </div>
              <div>
                <strong>Starting Cash:</strong>
                <div>{formatMoney(currentShift.start_cash)}</div>
              </div>
            </div>

            <button
              onClick={() => setShowCloseModal(true)}
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                background: '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
              }}
            >
              Close Shift & Generate Z-Report
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: 'inline-block',
                background: '#6c757d',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
              }}
            >
              No shift is currently open
            </div>

            <button
              onClick={() => setShowOpenModal(true)}
              style={{
                display: 'block',
                padding: '0.75rem 1.5rem',
                background: colors.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
              }}
            >
              Open New Shift
            </button>
          </div>
        )}
      </div>

      {/* Shift History */}
      <div
        style={{
          background: colors.surface,
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: isDark
            ? '0 4px 6px rgba(0, 0, 0, 0.3)'
            : '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>Recent Shifts</h3>

        {shiftHistory.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No shift history available</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Sales</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Expenses</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Expected</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actual</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Difference</th>
                </tr>
              </thead>
              <tbody>
                {shiftHistory.map((shift) => (
                  <tr
                    key={shift.id}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      opacity: shift.status === 'open' ? 0.6 : 1,
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}>
                      {shift.closed_at
                        ? new Date(shift.closed_at).toLocaleDateString()
                        : 'Open'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {formatMoney(shift.total_sales)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {formatMoney(shift.total_expenses)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {formatMoney(shift.end_cash_expected)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {shift.status === 'closed'
                        ? formatMoney(shift.end_cash_actual)
                        : '-'}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'right',
                        color:
                          shift.difference > 0
                            ? '#28a745'
                            : shift.difference < 0
                            ? '#dc3545'
                            : colors.text,
                        fontWeight: '600',
                      }}
                    >
                      {shift.status === 'closed' ? formatMoney(shift.difference) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Shift Modal */}
      {showOpenModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowOpenModal(false)}
        >
          <div
            style={{
              background: colors.surface,
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1.5rem' }}>Open New Shift</h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Starting Cash Amount:
              </label>
              <input
                type="number"
                step="0.01"
                value={startCash}
                onChange={(e) => setStartCash(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  fontSize: '1rem',
                }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowOpenModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: colors.border,
                  color: colors.text,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleOpenShift}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                }}
              >
                Open Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseModal && currentShift && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCloseModal(false)}
        >
          <div
            style={{
              background: colors.surface,
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1.5rem' }}>Close Shift & Generate Z-Report</h3>

            <div
              style={{
                background: isDark ? 'rgba(255, 193, 7, 0.1)' : '#fff3cd',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                }}
              >
                <div>
                  <strong>Start Cash:</strong>
                </div>
                <div>{formatMoney(currentShift.start_cash)}</div>
                <div>
                  <strong>Total Sales:</strong>
                </div>
                <div style={{ color: '#28a745', fontWeight: '600' }}>
                  +{formatMoney(currentShift.total_sales)}
                </div>
                <div>
                  <strong>Total Expenses:</strong>
                </div>
                <div style={{ color: '#dc3545', fontWeight: '600' }}>
                  -{formatMoney(currentShift.total_expenses)}
                </div>
                <div style={{ fontWeight: '600', fontSize: '1.1rem', paddingTop: '0.5rem' }}>
                  Expected Cash:
                </div>
                <div style={{ fontWeight: '600', fontSize: '1.1rem', paddingTop: '0.5rem' }}>
                  {formatMoney(
                    currentShift.start_cash +
                      currentShift.total_sales -
                      currentShift.total_expenses
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Actual Cash in Drawer:
              </label>
              <input
                type="number"
                step="0.01"
                value={endCashActual}
                onChange={(e) => setEndCashActual(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  fontSize: '1rem',
                }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Notes (optional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any discrepancies or notes about this shift..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  fontSize: '1rem',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowCloseModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: colors.border,
                  color: colors.text,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCloseShift}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                }}
              >
                Close Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftManager;
