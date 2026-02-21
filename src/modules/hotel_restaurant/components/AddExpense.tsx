import React, { useState } from 'react';
import {
    hotelRestaurantService,
    type NewExpense,
} from '../../../api/modules/hotelRestaurantService';
import { useNotification } from '../../../context/NotificationContext';

interface AddExpenseProps {
  onBack: () => void;
  onChanged: () => void;
}

const CATEGORIES = ['Groceries', 'Maintenance', 'Salaries', 'Utility Bills', 'Others'] as const;

const AddExpense: React.FC<AddExpenseProps> = ({ onBack, onChanged }) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'Groceries',
    customCategory: '',
    description: '',
    amount: '',
  });

  const isOther = form.category === 'Others';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const finalCategory = isOther ? form.customCategory.trim() : form.category;
    const amount = Number(form.amount);

    if (!form.date) {
      showError('Validation error', 'Date is required');
      return;
    }
    if (!finalCategory) {
      showError('Validation error', 'Category is required');
      return;
    }
    if (!form.description.trim()) {
      showError('Validation error', 'Description is required');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showError('Validation error', 'Amount must be a positive number');
      return;
    }

    setLoading(true);
    try {
      const payload: NewExpense = {
        date: form.date,
        category: finalCategory,
        description: form.description.trim(),
        amount,
      };

      await hotelRestaurantService.addExpense(payload);
      showSuccess('Expense added', `${finalCategory} expense recorded`);
      onChanged();
      onBack();
    } catch (error) {
      showError('Failed to add expense', String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <button className="bc-btn bc-btn-outline" onClick={onBack}>← Back</button>
      <h2 style={{ marginTop: 12 }}>Add Expense</h2>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
        <input
          className="bc-input"
          type="date"
          value={form.date}
          onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
        />

        <select
          className="bc-input"
          value={form.category}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              category: e.target.value,
              customCategory: e.target.value === 'Others' ? prev.customCategory : '',
            }))
          }
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        {isOther && (
          <input
            className="bc-input"
            placeholder="Custom category"
            value={form.customCategory}
            onChange={(e) => setForm((prev) => ({ ...prev, customCategory: e.target.value }))}
          />
        )}

        <input
          className="bc-input"
          type="number"
          min={0}
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
        />

        <textarea
          className="bc-input"
          rows={4}
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        />

        <button className="bc-btn bc-btn-primary" type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Add Expense'}
        </button>
      </form>
    </div>
  );
};

export default AddExpense;
