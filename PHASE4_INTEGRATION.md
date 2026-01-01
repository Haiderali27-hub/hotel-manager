# Phase 4 Integration Guide

## Quick Start: Integrating Phase 4 Features

### 1. Add Low Stock Alerts to Dashboard

In your `Dashboard.tsx`, add the LowStockAlert component:

```tsx
import LowStockAlert from './LowStockAlert';

// Inside your Dashboard render, add right after the stats section:
const renderDashboard = () => (
  <div>
    {/* Existing stats grid */}
    <div className="stats-grid">
      {/* ... existing stats ... */}
    </div>

    {/* NEW: Low Stock Alerts */}
    <LowStockAlert />

    {/* Rest of dashboard content */}
  </div>
);
```

### 2. Add Shift Management Navigation

In your `Dashboard.tsx` navigation menu:

```tsx
// Add to your menu items:
const menuItems = [
  // ... existing items ...
  { id: 'shifts', label: '💼 Shift Management', icon: '💼' },
];

// Add to your page rendering switch:
const renderPage = () => {
  switch (currentPage) {
    case 'dashboard':
      return renderDashboard();
    case 'shifts':
      return <ShiftManager />;
    // ... other cases ...
  }
};
```

### 3. Protect Admin-Only Features

Wrap sensitive components with ProtectedRoute:

```tsx
import { ProtectedRoute } from './ProtectedRoute';

// In Dashboard.tsx, wrap Settings:
case 'settings':
  return (
    <ProtectedRoute requiredRole="admin">
      <SettingsNew onGoBack={goBackToDashboard} onRefresh={refreshData} />
    </ProtectedRoute>
  );

// Protect History/Financial Reports for managers+:
case 'history':
  return (
    <ProtectedRoute requiredRole="manager">
      <History onGoBack={goBackToDashboard} />
    </ProtectedRoute>
  );

// Everyone can access POS:
case 'add-sale':
  return (
    <ProtectedRoute requiredRole="staff">
      <AddSale onGoBack={goBackToDashboard} onRefresh={refreshData} />
    </ProtectedRoute>
  );
```

### 4. Update Menu Items to Support Inventory

When adding/editing menu items, include the new inventory fields:

```tsx
interface MenuItem {
  id?: number;
  name: string;
  price: number;
  category: string;
  // NEW Phase 4 fields:
  track_stock?: number;      // 0 = service (default), 1 = physical product
  stock_quantity?: number;    // Current stock (only for tracked items)
  low_stock_limit?: number;   // Alert threshold (default: 5)
}

// Example: Add product with stock tracking
await invoke('add_menu_item', {
  name: 'Coca Cola',
  price: 2.50,
  category: 'Beverages',
  track_stock: 1,           // Enable tracking
  stock_quantity: 50,       // Initial stock
  low_stock_limit: 10       // Alert when <= 10
});

// Example: Add service (no tracking)
await invoke('add_menu_item', {
  name: 'Massage Service',
  price: 75.00,
  category: 'Services',
  track_stock: 0,           // Disable tracking
  stock_quantity: 0,        // N/A for services
  low_stock_limit: 0        // N/A for services
});
```

### 5. Show User Role in Header

Display the current user's role:

```tsx
import { useAuth } from './context/AuthContext';

const DashboardHeader = () => {
  const { userRole, adminId } = useAuth();
  
  return (
    <div className="header">
      <div className="user-info">
        <span>Admin #{adminId}</span>
        <span className={`role-badge role-${userRole}`}>
          {userRole === 'admin' ? '👑 Admin' : 
           userRole === 'manager' ? '📊 Manager' : 
           '🛒 Staff'}
        </span>
      </div>
    </div>
  );
};

// Add CSS for role badges:
.role-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-left: 0.5rem;
}

.role-admin {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.role-manager {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.role-staff {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}
```

### 6. Handle Insufficient Stock Errors

When creating sales, handle stock validation errors:

```tsx
const handleCreateSale = async (items: OrderItem[]) => {
  try {
    const orderId = await invoke('add_sale', {
      guestId: null,
      customerType: 'walk-in',
      customerName: customerName,
      items: items
    });
    
    showNotification('Sale created successfully!', 'success');
    navigate('/dashboard');
    
  } catch (error: any) {
    // Phase 4: Handle stock validation errors
    if (error.includes('Insufficient stock')) {
      showNotification(error, 'error');
      // Optionally highlight the out-of-stock item
    } else {
      showNotification('Failed to create sale: ' + error, 'error');
    }
  }
};
```

### 7. Create Admin User Management (Optional)

For managing user roles, create a simple admin panel:

```tsx
// AdminPanel.tsx
const AdminPanel = () => {
  const { userRole } = useAuth();
  
  // Only accessible to admins
  if (userRole !== 'admin') {
    return <div>Access Denied</div>;
  }
  
  return (
    <ProtectedRoute requiredRole="admin">
      <div>
        <h2>User Management</h2>
        {/* List all admin users from admin_auth table */}
        {/* Provide UI to edit roles */}
        {/* Add new users */}
      </div>
    </ProtectedRoute>
  );
};
```

---

## Testing Your Phase 4 Integration

### Test RBAC:
1. Open SQLite database and update a user's role:
   ```sql
   UPDATE admin_auth SET role = 'staff' WHERE username = 'test';
   ```
2. Login as that user
3. Verify restricted access to admin features

### Test Inventory:
1. Add a product with `track_stock = 1` and `stock_quantity = 5`
2. Create a sale with 3 units → stock should become 2
3. Try to sell 3 more units → should fail with "Insufficient stock"
4. Set `low_stock_limit = 10` → should appear in Low Stock Alert

### Test Shifts:
1. Open a shift with $100 starting cash
2. Create some sales (e.g., $50 in revenue)
3. Add an expense (e.g., $10)
4. Close shift with actual cash = $140
5. Expected cash = $100 + $50 - $10 = $140
6. Difference should be $0 (perfect match!)

---

## Common Issues & Solutions

### Issue: "Role is null after login"
**Solution**: Clear localStorage and re-login. The role migration should handle it automatically.

### Issue: "Stock not decrementing"
**Solution**: Ensure `track_stock = 1` for the menu item. Services should have `track_stock = 0`.

### Issue: "Can't close shift - not found"
**Solution**: Make sure you're using the correct `shift_id` from `get_current_shift()`.

### Issue: "ProtectedRoute not working"
**Solution**: Make sure you're importing from `AuthContext` (not `SimpleAuthContext`) which has the role support.

---

## Performance Tips

1. **Low Stock Alerts**: The component auto-refreshes every 5 minutes. Adjust the interval based on your needs:
   ```tsx
   // In LowStockAlert.tsx, change 300000 to your desired interval
   const interval = setInterval(fetchLowStockItems, 300000); // 5 minutes
   ```

2. **Shift History Limit**: Default is 50 shifts. Adjust based on your display needs:
   ```tsx
   const history = await invoke('get_shift_history', { limit: 10 }); // Show only last 10
   ```

3. **Stock Validation**: Happens before transaction, so no performance impact on successful sales.

---

**You're all set! 🚀**

Phase 4 features are now fully integrated. Start by testing RBAC, then add inventory tracking to a few products, and finally practice the shift opening/closing workflow.
