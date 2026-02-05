import React, { useState } from 'react';
import { addExpense, type NewExpense } from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { handleNumberInputFocus } from '../utils/inputHelpers';

interface AddExpenseProps {
  onBack: () => void;
  onExpenseAdded: () => void;
}

const AddExpense: React.FC<AddExpenseProps> = ({ onBack, onExpenseAdded }) => {
  const { colors } = useTheme();
  const { showSuccess, showError } = useNotification();
  const { formatMoney } = useCurrency();
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Default to today
    category: 'Groceries',
    customCategory: '',
    description: '',
    amount: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  // Predefined categories as per requirements
  const categories = [
    'Groceries',
    'Maintenance',
    'Salaries',
    'Utility Bills',
    'Others'
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Show custom category input when "Others" is selected
    if (field === 'category') {
      setShowCustomCategory(value === 'Others');
      if (value !== 'Others') {
        setFormData(prev => ({ ...prev, customCategory: '' }));
      }
    }
  };

  const validateForm = (): string | null => {
    if (!formData.date.trim()) {
      return 'Date is required';
    }
    
    if (!formData.category.trim()) {
      return 'Category is required';
    }
    
    if (formData.category === 'Others' && !formData.customCategory.trim()) {
      return 'Custom category is required when "Others" is selected';
    }
    
    if (!formData.description.trim()) {
      return 'Description is required';
    }
    
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      return 'Amount must be a valid positive number';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      showError('Validation Error', validationError);
      return;
    }
    
    setLoading(true);
    
    try {
      const finalCategory = formData.category === 'Others' 
        ? formData.customCategory 
        : formData.category;
      
      const expenseData: NewExpense = {
        date: formData.date,
        category: finalCategory,
        description: formData.description,
        amount: parseFloat(formData.amount)
      };
      
      await addExpense(expenseData);
      
      showSuccess(
        'Expense Added',
        `${finalCategory} expense of ${formatMoney(parseFloat(formData.amount))} has been recorded`
      );
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        category: 'Groceries',
        customCategory: '',
        description: '',
        amount: ''
      });
      setShowCustomCategory(false);
      
      onExpenseAdded();
      
    } catch (err) {
      console.error('Failed to add expense:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add expense';
      showError('Add Expense Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1rem'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    fontSize: '1rem',
    backgroundColor: colors.primary,
    color: colors.text
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '600',
    color: colors.text
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: colors.accent,
    color: colors.primary,
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    marginRight: '1rem'
  };

  return (
    <div style={{ 
      padding: '2rem', 
      color: colors.text,
      minHeight: '100vh',
      backgroundColor: colors.primary
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '2rem',
        borderBottom: `1px solid ${colors.border}`,
        paddingBottom: '1rem'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: colors.text,
            fontSize: '1.5rem',
            cursor: 'pointer',
            marginRight: '1rem'
          }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Add Expense</h1>
      </div>

      {/* Add Expense Form */}
      <div style={formStyle}>
        <h2 style={{ 
          marginBottom: '1.5rem', 
          color: colors.text,
          fontSize: '1.3rem'
        }}>
          Record New Business Expense
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            {/* Date Field */}
            <div>
              <label style={labelStyle}>Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            {/* Category Dropdown */}
            <div>
              <label style={labelStyle}>Category *</label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                style={inputStyle}
                required
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Category Input (shown when "Others" is selected) */}
            {showCustomCategory && (
              <div>
                <label style={labelStyle}>Custom Category *</label>
                <input
                  type="text"
                  value={formData.customCategory}
                  onChange={(e) => handleInputChange('customCategory', e.target.value)}
                  placeholder="Enter custom category..."
                  style={inputStyle}
                  required
                />
              </div>
            )}

            {/* Amount Field */}
            <div>
              <label style={labelStyle}>Amount *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                onFocus={handleNumberInputFocus}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={inputStyle}
                required
              />
            </div>
          </div>

          {/* Description Field */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={labelStyle}>Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter expense description..."
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              required
            />
          </div>

          {/* Submit Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-start' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                ...buttonStyle,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Adding...' : '💾 Add Expense'}
            </button>
            
            <button
              type="button"
              onClick={onBack}
              style={{
                ...buttonStyle,
                backgroundColor: colors.border,
                color: colors.text
              }}
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: colors.primary,
          border: `1px solid ${colors.border}`,
          borderRadius: '4px',
          fontSize: '0.9rem',
          color: colors.textSecondary
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: colors.text }}>💡 Category Guidelines:</h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            <li><strong>Groceries:</strong> Food supplies, kitchen items, consumables</li>
            <li><strong>Maintenance:</strong> Repairs, cleaning, facility upkeep</li>
            <li><strong>Salaries:</strong> Staff wages, employee payments</li>
            <li><strong>Utility Bills:</strong> Electricity, water, internet, gas</li>
            <li><strong>Others:</strong> Miscellaneous expenses (specify custom category)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AddExpense;
