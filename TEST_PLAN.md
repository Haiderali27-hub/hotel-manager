# Complete Test Plan - All Phases (1-4)

## Test Environment Setup

### Prerequisites
1. Fresh database or reset existing database
2. Application built successfully (`npm run build`)
3. Backend compiled successfully

### Initial Setup
```bash
# Run the application
npm run tauri dev
```

---

## PHASE 1: Offline Auth + Setup Wizard

### Test 1.1: Initial Setup Wizard
**Objective**: Verify first-time setup flow

**Steps**:
1. Launch application for the first time
2. Setup wizard should appear automatically
3. Complete business information form:
   - Business name: "Sunset Restaurant"
   - Address, phone, email
   - Currency: USD
4. Create admin account:
   - Username: `admin`
   - Password: `admin123`
   - Security question: "What is your favorite color?"
   - Answer: `blue`
5. Click "Complete Setup"

**Expected Result**:
- ✅ Setup wizard completes without errors
- ✅ Redirected to login page
- ✅ Admin account created in database

### Test 1.2: Login Authentication
**Objective**: Verify offline login works

**Steps**:
1. Login with created admin credentials
2. Verify dashboard loads

**Expected Result**:
- ✅ Login successful without internet
- ✅ Dashboard displays with user info
- ✅ Admin role badge visible

### Test 1.3: Security Question Reset
**Objective**: Test password recovery flow

**Steps**:
1. Click "Forgot Password?" on login page
2. Enter username: `admin`
3. Answer security question correctly
4. Reset password to: `newpassword123`
5. Login with new password

**Expected Result**:
- ✅ Security question appears
- ✅ Password reset successful
- ✅ Can login with new password

---

## PHASE 2: Generic Business Naming

### Test 2.1: Business Settings Display
**Objective**: Verify custom business name appears everywhere

**Steps**:
1. Login to dashboard
2. Check header/title
3. Navigate to Settings
4. Generate a receipt/invoice
5. Check printed output

**Expected Result**:
- ✅ Business name shows in dashboard header
- ✅ Business name in receipts
- ✅ No "Hotel Manager" hardcoded text visible
- ✅ Settings shows configured business info

### Test 2.2: Currency Settings
**Objective**: Verify currency formatting works

**Steps**:
1. Go to Settings → Currency
2. Check current currency: USD ($)
3. Create a sale for $25.50
4. View receipt

**Expected Result**:
- ✅ Prices show with $ symbol
- ✅ Symbol positioned before amount
- ✅ Tax calculated correctly (8.5%)

### Test 2.3: Update Business Info
**Objective**: Test runtime business settings changes

**Steps**:
1. Go to Settings
2. Change business name to "Ocean View Cafe"
3. Change currency to EUR (€)
4. Save settings
5. Refresh dashboard

**Expected Result**:
- ✅ New business name appears immediately
- ✅ Currency symbol updated throughout app
- ✅ All existing prices reformatted

---

## PHASE 3: White-Labeling

### Test 3.1: Theme Customization
**Objective**: Verify theme switching works

**Steps**:
1. Login to dashboard
2. Go to Settings → Appearance
3. Switch theme: Light → Dark → Light
4. Change primary color to red (#ef4444)
5. Change accent color to purple (#a855f7)

**Expected Result**:
- ✅ Theme switches immediately
- ✅ All UI elements update with new colors
- ✅ Primary color affects buttons, headers
- ✅ Accent color affects highlights, badges

### Test 3.2: Logo Upload
**Objective**: Test custom logo functionality

**Steps**:
1. Go to Settings → Branding
2. Upload custom logo image
3. Check dashboard header
4. Generate receipt

**Expected Result**:
- ✅ Logo appears in dashboard
- ✅ Logo shows on printed receipts
- ✅ Replaces default logo

### Test 3.3: Theme Persistence
**Objective**: Verify theme saves across sessions

**Steps**:
1. Set dark theme with custom colors
2. Logout
3. Login again

**Expected Result**:
- ✅ Dark theme still active
- ✅ Custom colors preserved
- ✅ Logo still displayed

---

## PHASE 4: RBAC + Inventory + Shifts

### Test 4.1: Role-Based Access Control

#### Test 4.1.1: Admin Role
**Objective**: Verify admin has full access

**Steps**:
1. Login as `admin` / `admin123`
2. Check dashboard header shows "👑 Admin"
3. Try accessing:
   - Dashboard ✓
   - Add Sale ✓
   - History ✓
   - Financial Report ✓
   - Shift Manager ✓
   - Settings ✓

**Expected Result**:
- ✅ All pages accessible
- ✅ No access denied messages
- ✅ Admin badge displayed

#### Test 4.1.2: Manager Role
**Objective**: Verify manager restrictions

**Steps**:
1. Create manager user:
   - Username: `manager1`
   - Password: `manager123`
   - Role: `manager`
2. Login as manager
3. Check dashboard shows "📊 Manager"
4. Try accessing:
   - Dashboard ✓
   - Add Sale ✓
   - History ✓
   - Financial Report ✓
   - Shift Manager ✓
   - Settings ✗ (should be blocked)

**Expected Result**:
- ✅ Manager can view reports and shifts
- ✅ Manager CANNOT access Settings
- ✅ Proper error/redirect when accessing Settings

#### Test 4.1.3: Staff Role
**Objective**: Verify staff restrictions

**Steps**:
1. Create staff user:
   - Username: `staff1`
   - Password: `staff123`
   - Role: `staff`
2. Login as staff
3. Check dashboard shows "🛒 Staff"
4. Try accessing:
   - Dashboard ✓
   - Add Sale ✓
   - History ✗ (blocked)
   - Financial Report ✗ (blocked)
   - Shift Manager ✗ (blocked)
   - Settings ✗ (blocked)

**Expected Result**:
- ✅ Staff can only process sales
- ✅ Staff CANNOT view reports or shifts
- ✅ Navigation menu hides restricted items

### Test 4.2: Inventory Management

#### Test 4.2.1: Add Product with Stock Tracking
**Objective**: Create tracked inventory items

**Steps**:
1. Login as admin
2. Go to Manage Catalog
3. Add new item:
   - Name: "Coca Cola 330ml"
   - Category: "Beverages"
   - Price: $2.50
   - **Enable Stock Tracking**: ✓
   - Initial Stock: 100
   - Low Stock Threshold: 20
4. Save item

**Expected Result**:
- ✅ Item created with stock tracking enabled
- ✅ Stock quantity shows in catalog
- ✅ Threshold configured

#### Test 4.2.2: Stock Decrement on Sale
**Objective**: Verify automatic stock reduction

**Steps**:
1. Check current stock: 100 units
2. Create sale:
   - Item: "Coca Cola 330ml"
   - Quantity: 15
   - Complete sale
3. Return to catalog
4. Check stock quantity

**Expected Result**:
- ✅ Stock reduced to 85 (100 - 15)
- ✅ Sale recorded in history
- ✅ Decrement happened automatically

#### Test 4.2.3: Low Stock Alerts
**Objective**: Trigger inventory warnings

**Steps**:
1. Current stock: 85 units (threshold: 20)
2. Create large sale: 70 units
3. Stock becomes: 15 units (below threshold)
4. Check dashboard

**Expected Result**:
- ✅ Low Stock Alert widget appears on dashboard
- ✅ "Coca Cola 330ml" listed with yellow/orange warning
- ✅ Shows current stock: 15, threshold: 20
- ✅ Color-coded: Orange (critical) or Red (out of stock)

#### Test 4.2.4: Out of Stock Prevention
**Objective**: Cannot sell more than available

**Steps**:
1. Current stock: 15 units
2. Try to create sale: 20 units
3. Submit sale

**Expected Result**:
- ✅ Error message: "Insufficient stock"
- ✅ Sale rejected
- ✅ Stock remains at 15

#### Test 4.2.5: Service Items (No Tracking)
**Objective**: Services don't affect inventory

**Steps**:
1. Add service item:
   - Name: "Room Service"
   - **Stock Tracking**: ✗ (disabled)
2. Create multiple sales of this service
3. Check catalog

**Expected Result**:
- ✅ Service created without stock fields
- ✅ Can sell unlimited quantities
- ✅ No stock alerts for services

### Test 4.3: Shift Management (Z-Reports)

#### Test 4.3.1: Open Shift
**Objective**: Start a new shift

**Steps**:
1. Login as admin or manager
2. Navigate to Shift Manager
3. Click "Open New Shift"
4. Enter starting cash: $200.00
5. Confirm

**Expected Result**:
- ✅ Shift opened successfully
- ✅ Start time recorded
- ✅ Starting cash: $200.00
- ✅ Badge shows "Shift Open"

#### Test 4.3.2: Process Sales During Shift
**Objective**: Record transactions

**Steps**:
1. With shift open, create sales:
   - Sale 1: $25.50
   - Sale 2: $42.75
   - Sale 3: $18.00
2. Total sales: $86.25
3. Expected cash: $200 + $86.25 = $286.25

**Expected Result**:
- ✅ All sales recorded
- ✅ Running total visible (if tracking)

#### Test 4.3.3: Close Shift - Balanced
**Objective**: End shift with exact cash match

**Steps**:
1. Click "Close Shift"
2. System shows expected cash: $286.25
3. Enter actual cash counted: $286.25
4. Add notes: "Perfect shift - no issues"
5. Confirm close

**Expected Result**:
- ✅ Shift closed successfully
- ✅ Difference: $0.00 (balanced)
- ✅ Green indicator for balanced shift
- ✅ Shift appears in history

#### Test 4.3.4: Close Shift - Overage
**Objective**: End shift with extra cash

**Steps**:
1. Open new shift: $150.00
2. Create sales totaling: $95.50
3. Expected: $245.50
4. Close shift with actual: $248.00
5. Difference: +$2.50 (overage)

**Expected Result**:
- ✅ Overage detected: +$2.50
- ✅ Yellow/blue indicator for overage
- ✅ Warning message shown
- ✅ Shift recorded with positive difference

#### Test 4.3.5: Close Shift - Shortage
**Objective**: End shift with missing cash

**Steps**:
1. Open shift: $200.00
2. Create sales: $120.00
3. Expected: $320.00
4. Close with actual: $315.00
5. Difference: -$5.00 (shortage)

**Expected Result**:
- ✅ Shortage detected: -$5.00
- ✅ Red indicator for shortage
- ✅ Alert/warning displayed
- ✅ Shift recorded with negative difference

#### Test 4.3.6: Shift History
**Objective**: Review past shifts

**Steps**:
1. Go to Shift Manager
2. View shift history table
3. Check details of each closed shift

**Expected Result**:
- ✅ All shifts listed chronologically
- ✅ Each shows: start/end time, cash amounts, difference
- ✅ Color-coded by status (balanced/overage/shortage)
- ✅ Notes displayed if added
- ✅ Admin ID shown for each shift

#### Test 4.3.7: Prevent Multiple Open Shifts
**Objective**: Only one shift can be open

**Steps**:
1. Open shift as Admin #1
2. Try to open another shift

**Expected Result**:
- ✅ Error: "A shift is already open"
- ✅ Must close current shift first
- ✅ System enforces single active shift

---

## INTEGRATION TESTS

### Integration Test 1: Complete Order Flow
**Objective**: End-to-end sale with all features

**Steps**:
1. Login as `staff1` (staff role)
2. Check inventory for "Heineken Beer" (50 units, threshold 10)
3. Create sale: 8 units @ $5.00 each = $40.00
4. Verify:
   - Stock reduced to 42 units
   - Sale recorded in history
   - No low stock alert yet (above threshold)
5. Create another sale: 35 units
6. Stock now: 7 units (below threshold)
7. Check dashboard

**Expected Result**:
- ✅ Both sales processed successfully
- ✅ Stock accurately decremented (50→42→7)
- ✅ Low stock alert now shows "Heineken Beer"
- ✅ Alert is RED (critical - below 50% of threshold)

### Integration Test 2: Multi-Role Workflow
**Objective**: Simulate real restaurant operations

**Steps**:
1. **Morning - Manager opens shift**:
   - Login as `manager1`
   - Open shift with $300 starting cash
   - Logout

2. **Day - Staff processes sales**:
   - Login as `staff1`
   - Create 10 different sales (mixed products/services)
   - Check inventory depleting
   - See low stock alerts appear
   - Cannot access reports (verify restriction)
   - Logout

3. **Evening - Manager reviews & closes**:
   - Login as `manager1`
   - View financial report
   - Check shift summary
   - Count cash drawer: $842.50
   - Close shift with actual amount
   - Review difference

4. **Admin reviews system**:
   - Login as `admin`
   - View shift history
   - Check low stock items
   - Add inventory to restock items
   - Review financial reports
   - Update business settings if needed

**Expected Result**:
- ✅ Each role can perform only allowed actions
- ✅ Inventory updates persist across sessions
- ✅ Shift accurately tracks all sales
- ✅ Reports show complete data
- ✅ Low stock alerts functional
- ✅ Multi-user scenario works seamlessly

### Integration Test 3: Theme + Business Branding
**Objective**: Verify white-labeling works across all features

**Steps**:
1. Login as admin
2. Change business name to "Miami Bistro"
3. Set theme to dark mode
4. Set primary color to teal (#14b8a6)
5. Generate receipt
6. Open shift manager
7. View financial report

**Expected Result**:
- ✅ "Miami Bistro" appears on all pages
- ✅ Dark theme active everywhere
- ✅ Teal color used in buttons, badges, charts
- ✅ Receipt shows custom business name
- ✅ Consistent branding across all modules

---

## Database Validation Tests

### Run SQL Test Script
**Objective**: Validate database structure and data

**Steps**:
1. Stop application
2. Open database with SQLite browser or CLI
3. Run `scripts/test_all_phases.sql`
4. Review all test results

**Expected Results**:
- ✅ All tables exist with correct schema
- ✅ Role column in admin_auth
- ✅ Inventory columns in menu_catalog
- ✅ Shifts table created and functional
- ✅ Business settings complete
- ✅ Test data inserted successfully

---

## Performance Tests

### Test P.1: Large Inventory
**Objective**: System handles many items

**Steps**:
1. Add 100+ products with stock tracking
2. Navigate catalog
3. Search/filter items
4. Check low stock alerts performance

**Expected Result**:
- ✅ UI remains responsive
- ✅ Search works quickly
- ✅ Alerts calculate efficiently

### Test P.2: Long Shift History
**Objective**: Many shifts don't slow down system

**Steps**:
1. Create 50+ shifts over time
2. View shift history
3. Filter/sort shifts

**Expected Result**:
- ✅ History loads quickly
- ✅ Pagination works (if implemented)
- ✅ No lag in UI

---

## Error Handling Tests

### Test E.1: Invalid Login
**Steps**:
1. Enter wrong password
2. Enter non-existent username

**Expected Result**:
- ✅ Clear error messages
- ✅ No system crash

### Test E.2: Negative Stock
**Steps**:
1. Try to set negative stock quantity
2. Try to sell negative quantity

**Expected Result**:
- ✅ Validation prevents negative values
- ✅ User-friendly error message

### Test E.3: Close Shift Without Sales
**Steps**:
1. Open shift
2. Create no sales
3. Close shift immediately

**Expected Result**:
- ✅ Shift closes successfully
- ✅ Expected cash = starting cash
- ✅ No errors

---

## Test Results Summary

### Phase 1: Offline Auth ✓
- [ ] Setup wizard completes
- [ ] Login works offline
- [ ] Security questions functional
- [ ] Multi-user support working

### Phase 2: Generic Business ✓
- [ ] Custom business name displays everywhere
- [ ] Currency formatting correct
- [ ] Settings update dynamically
- [ ] No hardcoded "Hotel Manager" text

### Phase 3: White-Labeling ✓
- [ ] Theme switching works
- [ ] Custom colors applied
- [ ] Logo upload functional
- [ ] Branding persists

### Phase 4: RBAC + Inventory + Shifts ✓
- [ ] Three roles (admin/manager/staff) enforced
- [ ] ProtectedRoute blocks unauthorized access
- [ ] Stock tracking enabled for products
- [ ] Automatic stock decrement on sales
- [ ] Low stock alerts appear correctly
- [ ] Shift open/close workflow complete
- [ ] Cash reconciliation accurate
- [ ] Z-report history displayed

### Integration ✓
- [ ] All phases work together
- [ ] Multi-role workflow seamless
- [ ] Performance acceptable
- [ ] Error handling robust

---

## Sign-Off

**Tester**: _________________  
**Date**: _________________  
**All Tests Passed**: [ ] Yes  [ ] No  
**Notes**: _______________________________________________
