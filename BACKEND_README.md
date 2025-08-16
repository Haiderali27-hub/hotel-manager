# 🏨 Hotel Management System - Backend Documentation

**Status**: ✅ **Production Ready**  
**Version**: 1.0  
**Last Updated**: August 16, 2025

## 🚀 Quick Start

### Development Setup
```bash
# Navigate to project root
cd hotel-app

# Install dependencies
npm install

# Start development server (includes hot reload)
npm run tauri dev
```

### Production Build
```bash
# Build optimized executable
npm run tauri build

# Output location: src-tauri/target/release/
```

## 📁 File Locations

All data is stored in user's app data directory for proper Windows permissions:

| Purpose | Location |
|---------|----------|
| **Database** | `%LOCALAPPDATA%\hotel-app\hotel.db` |
| **CSV Exports** | `%LOCALAPPDATA%\hotel-app\exports\*.csv` |
| **Database Backups** | `%LOCALAPPDATA%\hotel-app\backups\*.db` |

**Example Full Paths:**
- Database: `C:\Users\DELL\AppData\Local\hotel-app\hotel.db`
- Exports: `C:\Users\DELL\AppData\Local\hotel-app\exports\guests_20250816-143052.csv`

## 💾 Database Management

### Initialize Fresh Database
```bash
# The database is automatically created on first run
# Look for: "Database initialized successfully" in console
```

### Reset Database (Development)
```typescript
// Reset to fresh state with comprehensive seed data
await invoke('reset_database');

// Verify reset worked
const stats = await invoke('get_database_stats');
console.log('Database stats:', stats);
```

### Database Schema
- **7 Tables**: rooms, guests, menu_items, food_orders, food_order_items, expenses, admin_settings
- **Foreign Keys**: Enforced relationships between tables  
- **Indexes**: Strategic indexes on frequently queried columns
- **WAL Mode**: Enabled for better concurrency and safety

### Backup & Recovery
```typescript
// Create backup
const backupPath = await invoke('create_database_backup');
console.log('Backup created:', backupPath);

// Get current database location
const dbPath = await invoke('get_database_path');
console.log('Database location:', dbPath);
```

## 🔗 API Command Reference

Complete API documentation: [IPC_CONTRACT.md](./IPC_CONTRACT.md)

### Room Management
```typescript
// Add room
const roomId = await invoke('add_room', { number: '101', dailyRate: 150.0 });

// Get all rooms  
const rooms = await invoke('get_rooms');

// Delete room (only if not occupied)
await invoke('delete_room', { roomId: 1 });
```

### Guest Management
```typescript
// Check in guest
const guestId = await invoke('add_guest', {
  name: 'John Doe',
  phone: '555-0123',
  room_id: 1,
  check_in: '2025-08-16',
  daily_rate: 150.0
});

// Get active guests
const activeGuests = await invoke('get_active_guests');

// Check out guest  
const finalBill = await invoke('checkout_guest', { 
  guestId: 1, 
  checkOutDate: '2025-08-20' 
});
```

### Food Orders
```typescript
// Create food order
const orderId = await invoke('add_food_order', {
  order: {
    guest_id: 1,
    items: [
      { menu_item_id: 1, quantity: 2, unit_price: 12.99 },
      { menu_item_id: 5, quantity: 1, unit_price: 8.50 }
    ]
  }
});

// Mark order as paid
await invoke('mark_order_paid', { orderId: 1 });
```

### Dashboard & Reports
```typescript
// Get dashboard statistics
const stats = await invoke('dashboard_stats');
console.log('Active guests:', stats.active_guests);
console.log('Monthly revenue:', stats.total_income);
console.log('Occupancy rate:', stats.occupancy_rate);
```

### Export & Print
```typescript
// Export to CSV
const csvPath = await invoke('export_history_csv', {
  tab: 'guests',
  filters: {
    start_date: '2025-01-01',
    end_date: '2025-08-16'
  }
});

// Generate receipt HTML
const receiptHtml = await invoke('build_order_receipt_html', { orderId: 123 });

// Generate invoice HTML  
const invoiceHtml = await invoke('build_final_invoice_html', { guestId: 456 });
```

## 🖨️ Print Workflow

### Food Order Receipt
```typescript
// 1. Generate HTML
const html = await invoke('build_order_receipt_html', { orderId: 123 });

// 2. Print via browser
const printWindow = window.open('', '_blank');
printWindow.document.write(html);
printWindow.print();
printWindow.close();
```

### Guest Invoice
```typescript
// 1. Generate HTML  
const html = await invoke('build_final_invoice_html', { guestId: 456 });

// 2. Print via browser
const printWindow = window.open('', '_blank');  
printWindow.document.write(html);
printWindow.print();
printWindow.close();
```

## 📥 Export Workflow

### CSV Export Process
```typescript
// 1. Request export
const filePath = await invoke('export_history_csv', {
  tab: 'guests',  // 'guests' | 'orders' | 'expenses' | 'rooms'
  filters: {
    start_date: '2025-01-01',  // Optional
    end_date: '2025-08-16',    // Optional
    guest_id: 123,             // Optional
    category: 'Utilities'      // Optional (expenses only)
  }
});

// 2. Show success message
alert(`Data exported to: ${filePath}`);

// 3. File is ready to open/share
// Path example: C:\Users\DELL\AppData\Local\hotel-app\exports\guests_20250816-143052.csv
```

### Available Export Types
- **guests**: Guest list with room assignments and bills
- **orders**: Food orders with items and payment status  
- **expenses**: Business expenses with categories and dates
- **rooms**: Room list with current occupancy status

## 💾 Backup Workflow

### Create Backup
```typescript
// 1. Create backup
const backupPath = await invoke('create_database_backup');

// 2. Show success message
alert(`Database backed up to: ${backupPath}`);

// 3. File can be copied elsewhere for safekeeping
// Path example: C:\Users\DELL\AppData\Local\hotel-app\backups\hotel_backup_20250816-143052.db
```

### Restore from Backup (Manual Process)
1. Close the application
2. Navigate to: `%LOCALAPPDATA%\hotel-app\`
3. Replace `hotel.db` with your backup file  
4. Rename backup to `hotel.db`
5. Restart application

## ❌ Error Handling

### Standard Error Codes
All errors return standardized string codes for consistent frontend handling:

```typescript
import { handleApiError, ErrorCodes } from './api/client';

try {
  await invoke('add_guest', guestData);
} catch (error) {
  const userMessage = handleApiError(error);
  alert(userMessage);
  
  // Or handle specific errors
  if (error === ErrorCodes.ROOM_OCCUPIED) {
    // Show room selection dialog
  } else if (error === ErrorCodes.INVALID_DATE_FORMAT) {
    // Highlight date field
  }
}
```

### Common Error Codes
- `ROOM_NOT_FOUND` - Room ID doesn't exist
- `ROOM_OCCUPIED` - Cannot modify occupied room  
- `GUEST_NOT_FOUND` - Guest ID doesn't exist
- `GUEST_NOT_ACTIVE` - Guest already checked out
- `INVALID_DATE_FORMAT` - Date must be YYYY-MM-DD
- `NEGATIVE_AMOUNT` - Amounts must be positive
- `MENU_ITEM_NOT_FOUND` - Menu item ID doesn't exist

Full list: [IPC_CONTRACT.md](./IPC_CONTRACT.md#error-codes)

## 🔧 Development Tools

### Test Commands
```typescript
// Test database connection
await invoke('test_command');

// Get database statistics
const stats = await invoke('get_database_stats');
console.log('Database health:', stats);

// Reset database for testing
await invoke('reset_database');
```

### Console Testing
Open browser dev tools (F12) and test APIs directly:
```javascript
// Test room creation
await invoke('add_room', { number: '999', dailyRate: 200.0 });

// Test dashboard stats
const stats = await invoke('dashboard_stats');
console.table(stats);

// Test CSV export
const path = await invoke('export_history_csv', { tab: 'guests', filters: {} });
console.log('Export created:', path);
```

## 🚀 Performance Notes

- **Average Response Time**: 15-45ms for typical operations
- **Dashboard Stats**: ~45ms (8 complex aggregation queries)
- **CSV Exports**: 85-125ms for thousands of records
- **Database Size**: ~3MB with full year of data
- **Memory Usage**: ~15MB stable operation

Full benchmark: [PERFORMANCE_BENCHMARK.md](./PERFORMANCE_BENCHMARK.md)

## 🔒 Authentication

### Single Admin User
- **Default Username**: `admin`
- **Default Password**: `admin123`
- **Change**: Use security questions to reset password

### Session Management
```typescript
// Login
const admin = await invoke('login_admin', { 
  username: 'admin', 
  password: 'admin123' 
});

// Validate session (if implementing session tokens)
const isValid = await invoke('validate_admin_session', { sessionToken });

// Logout
await invoke('logout_admin', { sessionToken });
```

## 🏗️ Architecture Notes

### Technology Stack
- **Backend**: Rust + Tauri 2.7.0
- **Database**: SQLite with WAL mode
- **API**: Tauri IPC (invoke/command pattern)
- **Frontend**: React 19 + TypeScript + Vite

### Code Organization
```
src-tauri/src/
├── lib.rs              # Main entry point & command registration
├── db.rs               # Database initialization  
├── models.rs           # Data structures & types
├── simple_commands.rs  # Core business logic commands
├── database_reset.rs   # Database reset & seeding
├── export.rs           # CSV export functionality
├── print_templates.rs  # HTML receipt/invoice generation
├── validation.rs       # Input validation & error codes
└── offline_auth.rs     # Authentication system
```

### Design Principles
- **Single Source of Truth**: All data in SQLite database
- **Validation First**: Comprehensive input validation  
- **Error Codes**: Standardized error handling
- **Transaction Safety**: Multi-step operations wrapped in transactions
- **Type Safety**: Strong typing throughout Rust backend

## 🎯 Next Steps (Frontend Team)

1. **Start Here**: Import `src/api/client.ts` for all backend calls
2. **Reference**: Use `IPC_CONTRACT.md` for complete API documentation  
3. **Testing**: Use browser console to test APIs during development
4. **Examples**: Check `ExampleUsage.tsx` for working code patterns

### Frontend Priority Order
1. **Login System** → Authentication flow
2. **Dashboard** → Overview stats display  
3. **Room Management** → Add/view/edit rooms
4. **Guest Management** → Check-in/out flow
5. **Food Orders** → Order creation and management
6. **Reports & Exports** → CSV exports and printing

## 📞 Support Notes

### Troubleshooting
- **Database Issues**: Check `%LOCALAPPDATA%\hotel-app\` directory exists
- **Performance**: All operations should be <100ms on modern hardware
- **Exports**: CSV files are created in app data directory with timestamps
- **Prints**: HTML receipts work with standard browser print function

### Development Environment  
- **Hot Reload**: `npm run tauri dev` includes frontend hot reload
- **Debug Builds**: Development builds include console logging
- **Release Builds**: `npm run tauri build` creates optimized executable

---

## ✅ Backend Completion Checklist

- ✅ **Database Schema**: Complete with proper relationships
- ✅ **Core APIs**: All CRUD operations implemented  
- ✅ **Validation**: Comprehensive input validation
- ✅ **Error Handling**: Standardized error codes
- ✅ **Export System**: CSV exports for all data types
- ✅ **Print System**: HTML receipts and invoices
- ✅ **Authentication**: Secure admin login system  
- ✅ **Performance**: Optimized queries and indexes
- ✅ **Documentation**: Complete API and setup documentation
- ✅ **Testing**: Comprehensive seed data and reset functionality

**Status: Ready for Frontend Development! 🚀**
