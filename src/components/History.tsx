import React, { useCallback, useEffect, useState } from 'react';
import {
    addSalePayment,
    exportHistoryCsvWithDialog,
    getCustomers,
    getExpenses,
    getExpensesByDateRange,
    getSalePaymentSummary,
    getSales,
    getUnits,
    type Customer,
    type ExpenseRecord,
    type ExportFilters,
    type SalePaymentSummary,
    type SaleSummary,
    type Unit
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface HistoryProps {
  onBack: () => void;
}

interface FilterState {
  startDate: string;
  endDate: string;
  unitNumber: string;
  customerName: string;
  category: string;
  searchTerm: string;
  month: string; // format: 'YYYY-MM'
  year: string; // format: 'YYYY'
  paymentStatus: string; // 'all' | 'paid' | 'unpaid' | 'partial'
}

// Helper function to safely format dates
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'No Date';
  
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString();
  } catch {
    return 'Invalid Date';
  }
};

const History: React.FC<HistoryProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { showSuccess, showError, showWarning } = useNotification();
  const { formatMoney } = useCurrency();
  const { current: label } = useLabels();
  
  // Tab management
  const [activeTab, setActiveTab] = useState<'guests' | 'food-orders' | 'expenses'>('guests');
  
  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Payments UI state (supports pay-later / partial payments)
  const [salePaymentSummaries, setSalePaymentSummaries] = useState<Record<number, SalePaymentSummary>>({});
  const [paymentsModalSaleId, setPaymentsModalSaleId] = useState<number | null>(null);
  const [paymentsModalLoading, setPaymentsModalLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | 'bank'>('cash');
  const [paymentNote, setPaymentNote] = useState('');

  // Helper function to get room number by room ID
  const getUnitNumber = (unitId: number | null | undefined): string => {
    if (!unitId) return `Walk-in ${label.client}`;
    const unit = units.find(r => r.id === unitId);
    return unit ? unit.number : `${label.unit} #${unitId}`;
  };
  
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    unitNumber: '',
    customerName: '',
    category: '',
    searchTerm: '',
    month: '',
    year: '',
    paymentStatus: 'all',
  });

  // Sales-only quick filter
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  type HistoryRow = Customer | SaleSummary | ExpenseRecord;

  const loadGuestsIfNeeded = useCallback(async () => {
    if (customers.length === 0) {
      try {
        const customerData = await getCustomers();
        setCustomers(customerData);
      } catch (error) {
        console.error('Failed to load guests:', error);
      }
    }
  }, [customers.length]);

  const loadRoomsIfNeeded = useCallback(async () => {
    if (units.length === 0) {
      try {
        const unitData = await getUnits();
        setUnits(unitData);
      } catch (error) {
        console.error('Failed to load rooms:', error);
      }
    }
  }, [units.length]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Always load guests for name lookup
      if (customers.length === 0) {
        const customerData = await getCustomers();
        console.log('Loaded customers:', customerData);
        setCustomers(customerData);
      }
      
      switch (activeTab) {
        case 'guests':
          if (customers.length === 0) {
            const customerData = await getCustomers();
            console.log('Loaded customers:', customerData);
            setCustomers(customerData);
          }
          break;
        case 'food-orders': {
          const saleData = await getSales();
          console.log('Loaded sales:', saleData);
          console.log('Sample sale:', saleData[0]);
          setSales(saleData);
          break;
        }
        case 'expenses': {
          const expenseData = await getExpenses();
          console.log('Loaded expenses:', expenseData);
          setExpenses(expenseData);
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to load ${activeTab}:`, error);
      showError('Loading Error', `Failed to load ${activeTab} data`);
    } finally {
      setLoading(false);
    }
  }, [activeTab, customers.length, showError]);

  // Load data based on active tab
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load guests/rooms on mount for name lookups
  useEffect(() => {
    void loadGuestsIfNeeded();
    void loadRoomsIfNeeded();
  }, [loadGuestsIfNeeded, loadRoomsIfNeeded]);

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const applyDateFilter = async () => {
    if (!filters.startDate || !filters.endDate) {
      showWarning('Filter Warning', 'Please select both start and end dates');
      return;
    }
    
    if (activeTab === 'expenses') {
      setLoading(true);
      try {
        const filteredExpenses = await getExpensesByDateRange(filters.startDate, filters.endDate);
        setExpenses(filteredExpenses);
        showSuccess('Filter Applied', `Found ${filteredExpenses.length} expenses in date range`);
      } catch (err) {
        showError('Filter Error', err instanceof Error ? err.message : 'Failed to apply date filter');
      } finally {
        setLoading(false);
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      unitNumber: '',
      customerName: '',
      category: '',
      searchTerm: '',
      month: '',
      year: '',
      paymentStatus: 'all',
    });
    setShowUnpaidOnly(false);
    setCurrentPage(1);
    loadData(); // Reload all data
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const exportFilters: ExportFilters = {};
      
      if (filters.startDate) exportFilters.date_from = filters.startDate;
      if (filters.endDate) exportFilters.date_to = filters.endDate;
      if (filters.category) exportFilters.category = filters.category;
      
      // Map frontend tab names to backend expected values
      const tabMapping = {
        'guests': 'guests',
        'food-orders': 'orders',
        'expenses': 'expenses'
      };
      
      const backendTab = tabMapping[activeTab];
      const filePath = await exportHistoryCsvWithDialog(backendTab, exportFilters);
      showSuccess('Export Complete', `Data exported to: ${filePath}`);
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = String(error);
      if (errorMessage.includes('cancelled by user')) {
        // User cancelled the dialog, don't show error
        return;
      }
      showError('Export Failed', 'Failed to export data to Excel');
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on current filters
  const getFilteredData = (): HistoryRow[] => {
    let data: HistoryRow[] = [];
    
    switch (activeTab) {
      case 'guests':
        data = customers.filter(customer => {
          const matchesRoom = !filters.unitNumber || customer.room_id?.toString().includes(filters.unitNumber);
          const matchesName = !filters.customerName || customer.name.toLowerCase().includes(filters.customerName.toLowerCase());
          const matchesSearch = !filters.searchTerm || 
            customer.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            (customer.phone && customer.phone.includes(filters.searchTerm));
          return matchesRoom && matchesName && matchesSearch;
        });
        break;
      case 'food-orders':
        data = sales.filter(order => {
          // Legacy unpaid filter (kept for compatibility)
          if (showUnpaidOnly) {
            const summary = salePaymentSummaries[order.id];
            const hasBalance = summary ? summary.balance_due > 0 : !order.paid;
            if (!hasBalance) return false;
          }

          // New payment status filter (takes precedence)
          if (filters.paymentStatus && filters.paymentStatus !== 'all') {
            const summary = salePaymentSummaries[order.id];

            // When we don't yet have a payment summary for this row,
            // fall back to the coarse `order.paid` flag instead of guessing.
            if (filters.paymentStatus === 'paid') {
              if (summary) {
                if (summary.balance_due > 0.01) return false;
              } else {
                if (!order.paid) return false;
              }
            }

            // Unpaid includes partial payments (anything with balance remaining).
            if (filters.paymentStatus === 'unpaid') {
              if (summary) {
                if (summary.balance_due < 0.01) return false;
              } else {
                if (order.paid) return false;
              }
            }

            // For partial we need the summary; if it's missing, keep the row so the
            // UI can load the summary and then filter accurately.
            if (filters.paymentStatus === 'partial') {
              if (summary) {
                const amountPaid = summary.amount_paid ?? 0;
                const balanceDue = summary.balance_due ?? 0;
                if (amountPaid < 0.01 || balanceDue < 0.01) return false;
              }
            }
          }

          // Month filter (YYYY-MM format)
          if (filters.month) {
            const orderDate = order.created_at || '';
            const orderYearMonth = orderDate.substring(0, 7); // Extract YYYY-MM
            if (orderYearMonth !== filters.month) return false;
          }

          // Year filter
          if (filters.year) {
            const orderDate = order.created_at || '';
            const orderYear = orderDate.substring(0, 4); // Extract YYYY
            if (orderYear !== filters.year) return false;
          }

          // Customer name filter
          if (filters.customerName) {
            const customerName = order.guest_name || '';
            if (!customerName.toLowerCase().includes(filters.customerName.toLowerCase())) return false;
          }

          // Search filter
          const matchesSearch = !filters.searchTerm || 
            order.id.toString().includes(filters.searchTerm) ||
            (order.guest_name && order.guest_name.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
            (order.items && order.items.toLowerCase().includes(filters.searchTerm.toLowerCase()));
          
          return matchesSearch;
        });
        break;
      case 'expenses':
        data = expenses.filter(expense => {
          let matchesCategory = true;
          
          if (filters.category) {
            if (filters.category === 'Others') {
              // Define the main predefined categories
              const mainCategories = ['Groceries', 'Maintenance', 'Salaries', 'Utility Bills'];
              // Show expenses that don't belong to any of the main categories
              matchesCategory = !mainCategories.some(category => 
                expense.category.toLowerCase() === category.toLowerCase()
              );
            } else {
              // Regular category filtering
              matchesCategory = expense.category.toLowerCase().includes(filters.category.toLowerCase());
            }
          }
          
          const matchesSearch = !filters.searchTerm || 
            expense.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            expense.category.toLowerCase().includes(filters.searchTerm.toLowerCase());
          return matchesCategory && matchesSearch;
        });
        break;
    }
    
    return data;
  };

  // Pagination logic
  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Preload payment summaries for visible sales rows (only 10 per page)
  useEffect(() => {
    if (activeTab !== 'food-orders') return;
    const rows = paginatedData as SaleSummary[];
    if (!rows || rows.length === 0) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, paginatedData]);

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

      // Refresh sales list so the Paid/Unpaid badge updates correctly
      const refreshed = await getSales();
      setSales(refreshed);

      showSuccess('Payment Saved', `New balance: ${formatMoney(updated.balance_due)}`);
      setPaymentAmount(updated.balance_due);
      setPaymentNote('');
    } catch (err) {
      console.error('Failed to add payment:', err);
      showError('Payment Failed', err instanceof Error ? err.message : 'Failed to save payment');
    } finally {
      setPaymentsModalLoading(false);
    }
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.75rem 1.5rem',
    border: 'none',
    backgroundColor: isActive ? colors.accent : colors.surface,
    color: isActive ? colors.primary : colors.text,
    cursor: 'pointer',
    borderRadius: '8px 8px 0 0',
    fontWeight: isActive ? '600' : '400',
    fontSize: '1rem'
  });

  const filterStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    backgroundColor: colors.primary,
    color: colors.text,
    fontSize: '0.9rem'
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: colors.surface,
    borderRadius: '8px',
    overflow: 'hidden'
  };

  const thStyle: React.CSSProperties = {
    backgroundColor: colors.primary,
    color: colors.text,
    padding: '0.75rem',
    textAlign: 'left',
    fontWeight: '600',
    borderBottom: `1px solid ${colors.border}`
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.text
  };

  const renderGuestsTable = () => {
    const rows = paginatedData as Customer[];
    return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Name</th>
          <th style={thStyle}>Phone</th>
          <th style={thStyle}>{label.unit}</th>
          <th style={thStyle}>{label.action}</th>
          <th style={thStyle}>{label.actionOut}</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Daily Rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((customer, index: number) => (
          <tr key={`customer-${customer.id || index}`}>
            <td style={tdStyle}>{customer.name}</td>
            <td style={tdStyle}>{customer.phone || 'N/A'}</td>
            <td style={tdStyle}>{getUnitNumber(customer.room_id)}</td>
            <td style={tdStyle}>{formatDate(customer.check_in)}</td>
            <td style={tdStyle}>{customer.check_out ? formatDate(customer.check_out) : 'Active'}</td>
            <td style={tdStyle}>
              <span style={{
                backgroundColor: customer.status === 'active' ? colors.success : colors.textMuted,
                color: 'white',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.8rem'
              }}>
                {customer.status === 'active' ? 'Active' : label.actionOut}
              </span>
            </td>
            <td style={tdStyle}>{formatMoney(customer.daily_rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    );
  };

  const renderFoodOrdersTable = () => {
    const rows = paginatedData as SaleSummary[];
    return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Order ID</th>
          <th style={thStyle}>{label.client}</th>
          <th style={thStyle}>Date</th>
          <th style={thStyle}>Amount</th>
          <th style={thStyle}>Balance</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Customer Type</th>
          <th style={thStyle}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((sale, index: number) => (
          <tr key={`sale-${sale.id || index}`}>
            <td style={tdStyle}>#{sale.id}</td>
            <td style={tdStyle}>{sale.guest_name || `Walk-in ${label.client}`}</td>
            <td style={tdStyle}>{formatDate(sale.created_at)}</td>
            <td style={tdStyle}>{formatMoney(sale.total_amount)}</td>
            <td style={tdStyle}>
              {salePaymentSummaries[sale.id]
                ? formatMoney(salePaymentSummaries[sale.id].balance_due)
                : sale.paid
                  ? formatMoney(0)
                  : '—'}
            </td>
            <td style={tdStyle}>
              {(() => {
                const summary = salePaymentSummaries[sale.id];

                // If we haven't loaded the payment summary yet, do not guess.
                if (!summary) {
                  if (sale.paid) {
                    return (
                      <span style={{
                        backgroundColor: colors.success,
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        Paid
                      </span>
                    );
                  }
                  return (
                    <span style={{
                      backgroundColor: colors.error,
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      Unpaid
                    </span>
                  );
                }

                const amountPaid = summary.amount_paid ?? 0;
                const balanceDue = summary.balance_due ?? 0;
                
                // Partial payment: has some payment but balance remaining
                if (amountPaid > 0.01 && balanceDue > 0.01) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{
                        backgroundColor: '#FF9800',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold'
                      }}>
                        PARTIAL PAY
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        color: colors.textSecondary
                      }}>
                        {formatMoney(amountPaid)} of {formatMoney(sale.total_amount)}
                      </span>
                    </div>
                  );
                }
                // Fully paid
                if (balanceDue < 0.01) {
                  return (
                    <span style={{
                      backgroundColor: colors.success,
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      Paid
                    </span>
                  );
                }
                // Unpaid
                return (
                  <span style={{
                    backgroundColor: colors.error,
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}>
                    Unpaid
                  </span>
                );
              })()}
            </td>
            <td style={tdStyle}>{sale.guest_name ? `${label.unit} ${label.client}` : `Walk-in ${label.client}`}</td>
            <td style={tdStyle}>
              {(() => {
                const summary = salePaymentSummaries[sale.id];
                const isFullyPaid = summary ? summary.balance_due < 0.01 : sale.paid;
                return (
              <button
                onClick={() => openPaymentsModal(sale.id)}
                style={{
                  padding: '0.4rem 0.75rem',
                  backgroundColor: colors.accent,
                  color: colors.primary,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginRight: '0.5rem'
                }}
              >
                {isFullyPaid ? 'View Payments' : 'Record Payment'}
              </button>
                );
              })()}
              {(() => {
                const summary = salePaymentSummaries[sale.id];
                if (!summary) return null;
                const amountPaid = summary.amount_paid ?? 0;
                const balanceDue = summary.balance_due ?? 0;
                if (amountPaid > 0.01 && balanceDue > 0.01) {
                  return (
                    <button
                      onClick={() => openPaymentsModal(sale.id)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        backgroundColor: '#FF9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                    >
                      Adjust Payment
                    </button>
                  );
                }
                return null;
              })()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    );
  };

  const renderExpensesTable = () => {
    const rows = paginatedData as ExpenseRecord[];
    return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Date</th>
          <th style={thStyle}>Category</th>
          <th style={thStyle}>Description</th>
          <th style={thStyle}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((expense, index: number) => (
          <tr key={`expense-${expense.id || index}`}>
            <td style={tdStyle}>{formatDate(expense.date)}</td>
            <td style={tdStyle}>
              <span style={{
                backgroundColor: colors.accent,
                color: colors.primary,
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.8rem'
              }}>
                {expense.category}
              </span>
            </td>
            <td style={tdStyle}>{expense.description}</td>
            <td style={tdStyle}>{formatMoney(expense.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    );
  };

  const renderPagination = () => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '1rem',
      padding: '1rem',
      backgroundColor: colors.surface,
      borderRadius: '8px'
    }}>
      <div style={{ color: colors.text }}>
        Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} entries
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: colors.accent,
            color: colors.primary,
            border: 'none',
            borderRadius: '4px',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 1 ? 0.5 : 1
          }}
        >
          Previous
        </button>
        <span style={{ 
          padding: '0.5rem 1rem', 
          color: colors.text,
          display: 'flex',
          alignItems: 'center'
        }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: colors.accent,
            color: colors.primary,
            border: 'none',
            borderRadius: '4px',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages ? 0.5 : 1
          }}
        >
          Next
        </button>
      </div>
    </div>
  );

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
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>History & Records</h1>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        marginBottom: '2rem',
        borderBottom: `1px solid ${colors.border}`
      }}>
        <button
          onClick={() => setActiveTab('guests')}
          style={tabStyle(activeTab === 'guests')}
        >
          👥 {label.client}s History
        </button>
        <button
          onClick={() => setActiveTab('food-orders')}
          style={tabStyle(activeTab === 'food-orders')}
        >
          🍽️ Sales
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          style={tabStyle(activeTab === 'expenses')}
        >
          💰 Expenses
        </button>
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: colors.surface,
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        border: `1px solid ${colors.border}`
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: colors.text }}>Filters & Search</h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          {/* Date Range */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              style={filterStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              style={filterStyle}
            />
          </div>

          {/* Month Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Month</label>
            <input
              type="month"
              value={filters.month}
              onChange={(e) => handleFilterChange('month', e.target.value)}
              style={filterStyle}
            />
          </div>

          {/* Year Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Year</label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              style={filterStyle}
            >
              <option value="">All Years</option>
              {Array.from({ length: 51 }, (_, i) => 2020 + i).map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              ))}
            </select>
          </div>

          {/* Tab-specific filters */}
          {activeTab === 'guests' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{label.unit} Number</label>
                <input
                  type="text"
                  value={filters.unitNumber}
                  onChange={(e) => handleFilterChange('unitNumber', e.target.value)}
                  placeholder={`Enter ${label.unit.toLowerCase()} number...`}
                  style={filterStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{label.client} Name</label>
                <input
                  type="text"
                  value={filters.customerName}
                  onChange={(e) => handleFilterChange('customerName', e.target.value)}
                  placeholder={`Enter ${label.client.toLowerCase()} name...`}
                  style={filterStyle}
                />
              </div>
            </>
          )}

          {activeTab === 'expenses' && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                style={filterStyle}
              >
                <option value="">All Categories</option>
                <option value="Groceries">Groceries</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Salaries">Salaries</option>
                <option value="Utility Bills">Utility Bills</option>
                <option value="Others">Others</option>
              </select>
            </div>
          )}

          {/* Search */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Search</label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              placeholder={
                activeTab === 'guests' ? 'Search by name or phone...' :
                activeTab === 'food-orders' ? `Search by order ID, ${label.client.toLowerCase()} name, or items...` :
                'Search by description or category...'
              }
              style={filterStyle}
            />
          </div>

          {/* Sales quick filter */}
          {activeTab === 'food-orders' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Month</label>
                <input
                  type="month"
                  value={filters.month}
                  onChange={(e) => handleFilterChange('month', e.target.value)}
                  style={filterStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Year</label>
                <select
                  value={filters.year}
                  onChange={(e) => handleFilterChange('year', e.target.value)}
                  style={filterStyle}
                >
                  <option value="">All Years</option>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Payment Status</label>
                <select
                  value={filters.paymentStatus}
                  onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                  style={filterStyle}
                >
                  <option value="all">All Orders</option>
                  <option value="paid">Fully Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partially Paid</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>{label.client} Name</label>
                <input
                  type="text"
                  value={filters.customerName}
                  onChange={(e) => handleFilterChange('customerName', e.target.value)}
                  placeholder={`Filter by ${label.client.toLowerCase()} name...`}
                  style={filterStyle}
                />
              </div>
            </>
          )}

          {/* Legacy sales toggle (kept for compatibility) */}
          {activeTab === 'food-orders' && false && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Sales Filter</label>
              <button
                type="button"
                onClick={() => {
                  setShowUnpaidOnly((prev) => !prev);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: showUnpaidOnly ? colors.success : colors.border,
                  color: showUnpaidOnly ? 'white' : colors.text,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {showUnpaidOnly ? 'Showing: Unpaid Only' : 'Showing: All Sales'}
              </button>
              <div style={{ marginTop: '6px', fontSize: '0.8rem', color: colors.textSecondary }}>
                Unpaid includes partial payments (balance &gt; 0).
              </div>
            </div>
          )}
        </div>

        {/* Filter Actions */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={applyDateFilter}
            disabled={!filters.startDate || !filters.endDate}
            style={{
              backgroundColor: colors.accent,
              color: colors.primary,
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🔍 Apply Date Filter
          </button>
          <button
            onClick={clearFilters}
            style={{
              backgroundColor: colors.border,
              color: colors.text,
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🗑️ Clear Filters
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            style={{
              backgroundColor: loading ? colors.textMuted : colors.success,
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? '⏳ Exporting...' : '📊 Export to Excel'}
          </button>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: colors.textSecondary
        }}>
          Loading {activeTab}...
        </div>
      ) : (
        <>
          {activeTab === 'guests' && renderGuestsTable()}
          {activeTab === 'food-orders' && renderFoodOrdersTable()}
          {activeTab === 'expenses' && renderExpensesTable()}
          
          {paginatedData.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              color: colors.textSecondary
            }}>
              No {activeTab} found matching the current filters.
            </div>
          )}
          
          {paginatedData.length > 0 && renderPagination()}
        </>
      )}

      {/* Payments Modal */}
      {paymentsModalSaleId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={closePaymentsModal}
        >
          <div
            style={{
              width: 'min(720px, 95vw)',
              background: colors.surface,
              borderRadius: '16px',
              border: `1px solid ${colors.border}`,
              padding: '32px',
              color: colors.text,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>Payments for Order #{paymentsModalSaleId}</div>
                <div style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '4px' }}>View and record payments</div>
              </div>
              <button
                onClick={closePaymentsModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>

            {paymentsModalLoading ? (
              <div style={{ marginTop: '12px', opacity: 0.8 }}>Loading…</div>
            ) : (
              (() => {
                const summary = paymentsModalSaleId ? salePaymentSummaries[paymentsModalSaleId] : undefined;
                if (!summary) {
                  return <div style={{ marginTop: '12px', opacity: 0.8 }}>No payment data.</div>;
                }

                return (
                  <>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
                      <div style={{ opacity: 0.85 }}>
                        Total: <strong style={{ color: colors.text }}>{formatMoney(summary.total_amount)}</strong>
                      </div>
                      <div style={{ opacity: 0.85 }}>
                        Paid: <strong style={{ color: colors.text }}>{formatMoney(summary.amount_paid)}</strong>
                      </div>
                      <div style={{ opacity: 0.85 }}>
                        Balance: <strong style={{ color: colors.text }}>{formatMoney(summary.balance_due)}</strong>
                      </div>
                      <div style={{ opacity: 0.85 }}>
                        Status:{' '}
                        <strong style={{ color: summary.paid ? colors.success : colors.error }}>
                          {summary.paid ? 'PAID' : 'UNPAID'}
                        </strong>
                      </div>
                    </div>

                    <div style={{ marginTop: '14px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '8px' }}>Payments</div>
                      {summary.payments.length === 0 ? (
                        <div style={{ opacity: 0.8 }}>No payments yet.</div>
                      ) : (
                        <div style={{ maxHeight: '220px', overflow: 'auto', border: `1px solid ${colors.border}`, borderRadius: '10px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ ...thStyle, position: 'sticky', top: 0 }}>Date</th>
                                <th style={{ ...thStyle, position: 'sticky', top: 0 }}>Method</th>
                                <th style={{ ...thStyle, position: 'sticky', top: 0 }}>Amount</th>
                                <th style={{ ...thStyle, position: 'sticky', top: 0 }}>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summary.payments.map((p) => (
                                <tr key={p.id}>
                                  <td style={tdStyle}>{formatDate(p.created_at)}</td>
                                  <td style={tdStyle}>{p.method}</td>
                                  <td style={tdStyle}>{formatMoney(p.amount)}</td>
                                  <td style={tdStyle}>{p.note || ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {summary.balance_due > 0 && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '12px',
                          borderRadius: '12px',
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.primary,
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: '10px' }}>Record a payment</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Amount</div>
                            <input
                              type="number"
                              step={0.01}
                              min={0}
                              value={Number.isFinite(paymentAmount) ? paymentAmount : 0}
                              onChange={(e) => setPaymentAmount(parseFloat(e.target.value || '0'))}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${colors.border}`, fontSize: '15px' }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Method</div>
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'mobile' | 'bank')}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${colors.border}`, fontSize: '15px' }}
                            >
                              <option value="cash">Cash</option>
                              <option value="card">Card</option>
                              <option value="mobile">Mobile money</option>
                              <option value="bank">Bank transfer</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ marginTop: '12px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Note (optional)</div>
                          <input
                            type="text"
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            placeholder="e.g. paid after 2 days"
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${colors.border}`, fontSize: '15px' }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                          <button
                            onClick={submitPayment}
                            disabled={paymentsModalLoading}
                            style={{
                              padding: '12px 24px',
                              backgroundColor: colors.accent,
                              color: colors.primary,
                              border: 'none',
                              borderRadius: '10px',
                              cursor: paymentsModalLoading ? 'not-allowed' : 'pointer',
                              opacity: paymentsModalLoading ? 0.7 : 1,
                              fontWeight: 600,
                              fontSize: '15px',
                            }}
                          >
                            Save Payment
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
