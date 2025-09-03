import React, { useEffect, useState } from 'react';
import {
    exportHistoryCsvWithDialog,
    getAllGuests,
    getExpenses,
    getExpensesByDateRange,
    getFoodOrders,
    getRooms,
    type ExpenseRecord,
    type ExportFilters,
    type FoodOrderSummary,
    type Guest,
    type Room
} from '../api/client';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface HistoryProps {
  onBack: () => void;
}

interface FilterState {
  startDate: string;
  endDate: string;
  roomNumber: string;
  guestName: string;
  category: string;
  searchTerm: string;
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
  } catch (error) {
    return 'Invalid Date';
  }
};

const History: React.FC<HistoryProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { showSuccess, showError, showWarning } = useNotification();
  
  // Tab management
  const [activeTab, setActiveTab] = useState<'guests' | 'food-orders' | 'expenses'>('guests');
  
  // Data states
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [foodOrders, setFoodOrders] = useState<FoodOrderSummary[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Helper function to get guest name by ID
  const getGuestName = (guestId: number | null | undefined): string => {
    if (!guestId) return 'Walk-in';
    const guest = guests.find(g => g.id === guestId);
    return guest ? guest.name : `Guest #${guestId}`;
  };

  // Helper function to get room number by room ID
  const getRoomNumber = (roomId: number | null | undefined): string => {
    if (!roomId) return 'Walk-in';
    const room = rooms.find(r => r.id === roomId);
    return room ? room.number : `Room #${roomId}`;
  };
  
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    roomNumber: '',
    guestName: '',
    category: '',
    searchTerm: ''
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load data based on active tab
  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Load guests on component mount for name lookups
  useEffect(() => {
    loadGuestsIfNeeded();
    loadRoomsIfNeeded();
  }, []);

  const loadGuestsIfNeeded = async () => {
    if (guests.length === 0) {
      try {
        const guestData = await getAllGuests();
        setGuests(guestData);
      } catch (error) {
        console.error('Failed to load guests:', error);
      }
    }
  };

  const loadRoomsIfNeeded = async () => {
    if (rooms.length === 0) {
      try {
        const roomData = await getRooms();
        setRooms(roomData);
      } catch (error) {
        console.error('Failed to load rooms:', error);
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Always load guests for name lookup
      if (guests.length === 0) {
        const guestData = await getAllGuests();
        console.log('Loaded guests:', guestData);
        setGuests(guestData);
      }
      
      switch (activeTab) {
        case 'guests':
          if (guests.length === 0) {
            const guestData = await getAllGuests();
            console.log('Loaded guests:', guestData);
            setGuests(guestData);
          }
          break;
        case 'food-orders':
          const foodData = await getFoodOrders();
          console.log('Loaded food orders:', foodData);
          console.log('Sample order:', foodData[0]);
          setFoodOrders(foodData);
          break;
        case 'expenses':
          const expenseData = await getExpenses();
          console.log('Loaded expenses:', expenseData);
          setExpenses(expenseData);
          break;
      }
    } catch (error) {
      console.error(`Failed to load ${activeTab}:`, error);
      showError('Loading Error', `Failed to load ${activeTab} data`);
    } finally {
      setLoading(false);
    }
  };

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
      } catch (error) {
        showError('Filter Error', 'Failed to apply date filter');
      } finally {
        setLoading(false);
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      roomNumber: '',
      guestName: '',
      category: '',
      searchTerm: ''
    });
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
  const getFilteredData = () => {
    let data: any[] = [];
    
    switch (activeTab) {
      case 'guests':
        data = guests.filter(guest => {
          const matchesRoom = !filters.roomNumber || guest.room_id?.toString().includes(filters.roomNumber);
          const matchesName = !filters.guestName || guest.name.toLowerCase().includes(filters.guestName.toLowerCase());
          const matchesSearch = !filters.searchTerm || 
            guest.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            (guest.phone && guest.phone.includes(filters.searchTerm));
          return matchesRoom && matchesName && matchesSearch;
        });
        break;
      case 'food-orders':
        data = foodOrders.filter(order => {
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

  const renderGuestsTable = () => (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Name</th>
          <th style={thStyle}>Phone</th>
          <th style={thStyle}>Room</th>
          <th style={thStyle}>Check-in</th>
          <th style={thStyle}>Check-out</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Daily Rate</th>
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((guest: Guest, index: number) => (
          <tr key={`guest-${guest.id || index}`}>
            <td style={tdStyle}>{guest.name}</td>
            <td style={tdStyle}>{guest.phone || 'N/A'}</td>
            <td style={tdStyle}>{getRoomNumber(guest.room_id)}</td>
            <td style={tdStyle}>{formatDate(guest.check_in)}</td>
            <td style={tdStyle}>{guest.check_out ? formatDate(guest.check_out) : 'Active'}</td>
            <td style={tdStyle}>
              <span style={{
                backgroundColor: guest.status === 'active' ? '#28a745' : '#6c757d',
                color: 'white',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.8rem'
              }}>
                {guest.status === 'active' ? 'Active' : 'Checked Out'}
              </span>
            </td>
            <td style={tdStyle}>Rs {guest.daily_rate.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderFoodOrdersTable = () => (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Order ID</th>
          <th style={thStyle}>Guest ID</th>
          <th style={thStyle}>Date</th>
          <th style={thStyle}>Amount</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Customer Type</th>
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((order: FoodOrderSummary, index: number) => (
          <tr key={`food-order-${order.id || index}`}>
            <td style={tdStyle}>#{order.id}</td>
            <td style={tdStyle}>{order.guest_name || 'Walk-in'}</td>
            <td style={tdStyle}>{formatDate(order.created_at)}</td>
            <td style={tdStyle}>Rs {order.total_amount.toFixed(2)}</td>
            <td style={tdStyle}>
              <span style={{
                backgroundColor: order.paid ? '#28a745' : '#dc3545',
                color: 'white',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.8rem'
              }}>
                {order.paid ? 'Paid' : 'Unpaid'}
              </span>
            </td>
            <td style={tdStyle}>Guest Order</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderExpensesTable = () => (
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
        {paginatedData.map((expense: ExpenseRecord, index: number) => (
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
            <td style={tdStyle}>Rs {expense.amount.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

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
          👥 Guests History
        </button>
        <button
          onClick={() => setActiveTab('food-orders')}
          style={tabStyle(activeTab === 'food-orders')}
        >
          🍽️ Food Orders
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

          {/* Tab-specific filters */}
          {activeTab === 'guests' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Room Number</label>
                <input
                  type="text"
                  value={filters.roomNumber}
                  onChange={(e) => handleFilterChange('roomNumber', e.target.value)}
                  placeholder="Enter room number..."
                  style={filterStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Guest Name</label>
                <input
                  type="text"
                  value={filters.guestName}
                  onChange={(e) => handleFilterChange('guestName', e.target.value)}
                  placeholder="Enter guest name..."
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
                activeTab === 'food-orders' ? 'Search by order ID, guest name, or items...' :
                'Search by description or category...'
              }
              style={filterStyle}
            />
          </div>
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
              backgroundColor: loading ? '#6c757d' : '#28a745',
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
    </div>
  );
};

export default History;
