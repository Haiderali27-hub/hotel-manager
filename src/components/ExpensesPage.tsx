import React, { useEffect, useMemo, useState } from 'react';
import {
    addExpense,
    deleteExpense,
    getExpenses,
    getExpensesByDateRange,
    updateExpense,
    type ExpenseRecord,
    type NewExpense,
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { handleNumberInputFocus } from '../utils/inputHelpers';

interface ExpensesPageProps {
  onBack: () => void;
  onExpenseChanged?: () => void;
}

type TabId = 'add' | 'history';

const ExpensesPage: React.FC<ExpensesPageProps> = ({ onBack, onExpenseChanged }) => {
  const { colors } = useTheme();
  const { formatMoney } = useCurrency();
  const { showError, showSuccess, showWarning } = useNotification();

  const [activeTab, setActiveTab] = useState<TabId>('add');

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Groceries',
    customCategory: '',
    description: '',
    amount: '',
  });
  const [saving, setSaving] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const [editExpense, setEditExpense] = useState<ExpenseRecord | null>(null);
  const [editDraft, setEditDraft] = useState<NewExpense | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const categories = ['Groceries', 'Maintenance', 'Salaries', 'Utility Bills', 'Others'];

  const loadExpenses = async (opts?: { from?: string; to?: string }) => {
    setLoading(true);
    try {
      const from = opts?.from ?? '';
      const to = opts?.to ?? '';
      if (from && to) {
        const rows = await getExpensesByDateRange(from, to);
        setExpenses(rows);
      } else {
        const rows = await getExpenses();
        setExpenses(rows);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
      showError('Loading Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const normalizedCategory = categoryFilter.trim().toLowerCase();

  const filteredExpenses = useMemo(() => {
    let rows = expenses;
    if (normalizedCategory) {
      rows = rows.filter((e) => (e.category || '').toLowerCase().includes(normalizedCategory));
    }
    if (normalizedSearch) {
      rows = rows.filter((e) => {
        const hay = `${e.category} ${e.description} ${e.date}`.toLowerCase();
        return hay.includes(normalizedSearch);
      });
    }

    // Most recent first (best-effort based on YYYY-MM-DD string)
    return [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [expenses, normalizedCategory, normalizedSearch]);

  const totalFiltered = useMemo(() => filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0), [filteredExpenses]);

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'category') {
      setShowCustomCategory(value === 'Others');
      if (value !== 'Others') {
        setFormData((prev) => ({ ...prev, customCategory: '' }));
      }
    }
  };

  const validateNewExpense = (): string | null => {
    if (!formData.date.trim()) return 'Date is required';
    if (!formData.category.trim()) return 'Category is required';
    if (formData.category === 'Others' && !formData.customCategory.trim()) {
      return 'Custom category is required when "Others" is selected';
    }
    if (!formData.description.trim()) return 'Description is required';
    const amount = parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) return 'Amount must be a valid positive number';
    return null;
  };

  const submitNewExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateNewExpense();
    if (error) {
      showError('Validation Error', error);
      return;
    }

    setSaving(true);
    try {
      const finalCategory = formData.category === 'Others' ? formData.customCategory : formData.category;
      const payload: NewExpense = {
        date: formData.date,
        category: finalCategory,
        description: formData.description,
        amount: parseFloat(formData.amount),
      };

      await addExpense(payload);
      showSuccess('Expense Added', `${finalCategory} expense of ${formatMoney(payload.amount)} recorded`);

      setFormData({
        date: new Date().toISOString().split('T')[0],
        category: 'Groceries',
        customCategory: '',
        description: '',
        amount: '',
      });
      setShowCustomCategory(false);

      onExpenseChanged?.();
      await loadExpenses({ from: dateFrom, to: dateTo });
      setActiveTab('history');
    } catch (err) {
      console.error('Failed to add expense:', err);
      showError('Add Expense Failed', err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const applyDateRange = async () => {
    if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
      showWarning('Filter Warning', 'Select both start and end date');
      return;
    }
    await loadExpenses({ from: dateFrom, to: dateTo });
  };

  const clearDateRange = async () => {
    setDateFrom('');
    setDateTo('');
    await loadExpenses({ from: '', to: '' });
  };

  const openEdit = (exp: ExpenseRecord) => {
    setEditExpense(exp);
    setEditDraft({
      date: exp.date,
      category: exp.category,
      description: exp.description,
      amount: exp.amount,
    });
  };

  const closeEdit = () => {
    setEditExpense(null);
    setEditDraft(null);
    setEditSaving(false);
  };

  const saveEdit = async () => {
    if (!editExpense || !editDraft) return;
    if (!editDraft.date.trim()) {
      showError('Validation Error', 'Date is required');
      return;
    }
    if (!editDraft.category.trim()) {
      showError('Validation Error', 'Category is required');
      return;
    }
    if (!editDraft.description.trim()) {
      showError('Validation Error', 'Description is required');
      return;
    }
    if (Number.isNaN(editDraft.amount) || editDraft.amount <= 0) {
      showError('Validation Error', 'Amount must be a valid positive number');
      return;
    }

    setEditSaving(true);
    try {
      await updateExpense(editExpense.id, editDraft);
      showSuccess('Expense Updated', 'Expense saved');
      closeEdit();
      await loadExpenses({ from: dateFrom, to: dateTo });
      onExpenseChanged?.();
    } catch (err) {
      console.error('Failed to update expense:', err);
      showError('Update Failed', err instanceof Error ? err.message : 'Failed to update expense');
      setEditSaving(false);
    }
  };

  const removeExpense = async (exp: ExpenseRecord) => {
    const ok = window.confirm(`Delete this expense?\n\n${exp.category}: ${exp.description}`);
    if (!ok) return;

    try {
      await deleteExpense(exp.id);
      setExpenses((prev) => prev.filter((x) => x.id !== exp.id));
      showSuccess('Deleted', 'Expense removed');
      onExpenseChanged?.();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      showError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete expense');
    }
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
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    fontSize: '1rem',
    backgroundColor: colors.primary,
    color: colors.text,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '700',
    color: colors.text,
    fontSize: '13px',
  };

  return (
    <div
      style={{
        padding: '24px',
        color: colors.text,
        minHeight: '100vh',
        backgroundColor: colors.primary,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onBack}
            title="Back"
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
          >
            ←
          </button>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>Expenses</div>
            <div style={{ fontSize: '13px', color: colors.textSecondary }}>Record and review business spending</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {tabBtn('add', 'Add')}
          {tabBtn('history', 'History')}
        </div>
      </div>

      {activeTab === 'add' && (
        <div className="bc-card" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '12px' }}>Add Expense</div>

          <form onSubmit={submitNewExpense}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
                marginBottom: '14px',
              }}
            >
              <div>
                <label style={labelStyle}>Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  style={inputStyle}
                  required
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {showCustomCategory && (
                <div>
                  <label style={labelStyle}>Custom Category *</label>
                  <input
                    type="text"
                    value={formData.customCategory}
                    onChange={(e) => handleFormChange('customCategory', e.target.value)}
                    placeholder="Enter custom category..."
                    style={inputStyle}
                    required
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Amount *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                  onFocus={handleNumberInputFocus}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="Enter expense description..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={saving}
                className="bc-btn"
                style={{
                  background: colors.accent,
                  color: colors.primary,
                  borderRadius: '10px',
                  border: 'none',
                  padding: '10px 14px',
                  fontWeight: 900,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Add Expense'}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="bc-btn"
                style={{
                  background: 'transparent',
                  color: colors.text,
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  padding: '10px 14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                View History
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          <div className="bc-card" style={{ padding: '16px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 900 }}>Expenses History</div>
                <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>
                  Total (filtered): {formatMoney(totalFiltered)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void loadExpenses({ from: dateFrom, to: dateTo })}
                  className="bc-btn"
                  style={{
                    background: 'transparent',
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '12px',
                marginTop: '14px',
              }}
            >
              <div>
                <label style={labelStyle}>From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <input
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  placeholder="Filter by category…"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Search</label>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search description…"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void applyDateRange()}
                className="bc-btn"
                style={{
                  background: colors.accent,
                  color: colors.primary,
                  borderRadius: '10px',
                  border: 'none',
                  padding: '10px 12px',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Apply Date Range
              </button>
              <button
                type="button"
                onClick={() => void clearDateRange()}
                className="bc-btn"
                style={{
                  background: 'transparent',
                  color: colors.text,
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  padding: '10px 12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Clear Date Range
              </button>
            </div>

            <div style={{ marginTop: '14px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Date</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Category</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary }}>Description</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '10px 8px', fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '14px 8px', color: colors.textSecondary }}>
                        Loading…
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '14px 8px', color: colors.textSecondary }}>
                        No expenses found.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '10px 8px', fontSize: '13px', color: colors.text }}>{exp.date}</td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', color: colors.text }}>{exp.category}</td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', color: colors.text, maxWidth: '520px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={exp.description}>
                            {exp.description}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', color: colors.text, textAlign: 'right', fontWeight: 800 }}>
                          {formatMoney(exp.amount || 0)}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => openEdit(exp)}
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
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeExpense(exp)}
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
        </div>
      )}

      {editExpense && editDraft && (
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
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div className="bc-card" style={{ width: 'min(720px, 96vw)', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>Edit Expense</div>
                <div style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '6px' }}>Modify expense details</div>
              </div>
              <button
                type="button"
                onClick={closeEdit}
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

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginTop: '20px',
              }}
            >
              <div>
                <label style={labelStyle}>Date *</label>
                <input
                  type="date"
                  value={editDraft.date}
                  onChange={(e) => setEditDraft((p) => (p ? { ...p, date: e.target.value } : p))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Category *</label>
                <input
                  value={editDraft.category}
                  onChange={(e) => setEditDraft((p) => (p ? { ...p, category: e.target.value } : p))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Amount *</label>
                <input
                  type="number"
                  value={String(editDraft.amount)}
                  min="0"
                  step="0.01"
                  onChange={(e) => setEditDraft((p) => (p ? { ...p, amount: parseFloat(e.target.value) } : p))}
                  onFocus={handleNumberInputFocus}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Description *</label>
              <textarea
                value={editDraft.description}
                onChange={(e) => setEditDraft((p) => (p ? { ...p, description: e.target.value } : p))}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={closeEdit}
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
                disabled={editSaving}
                onClick={() => void saveEdit()}
                style={{
                  border: 'none',
                  background: colors.accent,
                  color: colors.primary,
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                }}
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
