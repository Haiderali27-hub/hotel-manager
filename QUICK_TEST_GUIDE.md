# Quick Test Reference Guide

## 🚀 How to Run Tests

### 1. Prerequisites
```bash
# Ensure application is running
npm run tauri dev
```

### 2. Test Credentials

| Username | Password | Role | Access Level |
|----------|----------|------|--------------|
| `yasinheaven` | `YHSHotel@2025!` | Admin | Full access to everything |
| `manager1` | `manager123` | Manager | Reports + Shifts (no Settings) |
| `staff1` | `staff123` | Staff | Sales only |

### 3. Pre-loaded Test Data

#### Business Info
- **Name**: Sunset Restaurant & Bar
- **Currency**: USD ($)
- **Tax Rate**: 8.5%

#### Menu Items (with stock tracking)
| Item | Category | Price | Stock | Threshold | Status |
|------|----------|-------|-------|-----------|--------|
| Coca Cola 330ml | Beverages | $2.50 | 85 | 20 | ✅ OK |
| Heineken Beer | Beverages | $5.00 | 42 | 10 | ✅ OK |
| Caesar Salad | Food | $12.00 | 25 | 5 | 🟡 LOW |
| French Fries | Food | $6.00 | 45 | 10 | ✅ OK |
| Ice Cream | Desserts | $7.50 | 25 | 8 | 🟡 LOW |

#### Services (no stock tracking)
- Room Service - $15.00
- Laundry - $20.00

#### Completed Shifts
- **Shift 1**: Admin #1, $200 start → $590 actual (overage +$2.50)
- **Shift 2**: Manager #2, $150 start → $450 actual (shortage -$6.75)

---

## 📋 Testing Sequence

### Step 1: Phase 1 - Authentication (5 min)
1. Open application
2. Login as `yasinheaven` / `YHSHotel@2025!`
3. Check dashboard loads
4. Verify **👑 Admin** badge shows in header
5. Logout
6. Login as `manager1` / `manager123`
7. Verify **📊 Manager** badge
8. Logout
9. Login as `staff1` / `staff123`
10. Verify **🛒 Staff** badge

**Expected**: All 3 users login successfully, badges display correctly

---

### Step 2: Phase 2 - Business Branding (3 min)
1. Login as admin
2. Check header shows "Sunset Restaurant & Bar"
3. Navigate to Settings
4. Verify business info displayed correctly
5. Create a test sale
6. Check receipt shows business name

**Expected**: Custom business name everywhere, no "Hotel Manager" text

---

### Step 3: Phase 3 - Theme (3 min)
1. Verify dark theme active
2. Go to Settings → Appearance
3. Switch to light theme
4. Verify UI updates immediately
5. Change primary color to red
6. Check buttons/headers use new color

**Expected**: Theme switches instantly, colors update throughout

---

### Step 4: Phase 4 RBAC - Access Control (10 min)

#### 4A: Admin Access Test
1. Login as `yasinheaven`
2. Try accessing each menu item:
   - Dashboard ✓
   - Add Sale ✓
   - History ✓
   - Financial Report ✓
   - Shift Manager ✓
   - Settings ✓

**Expected**: Admin can access ALL pages

#### 4B: Manager Access Test
1. Login as `manager1`
2. Try accessing:
   - Dashboard ✓
   - Add Sale ✓
   - History ✓
   - Financial Report ✓
   - Shift Manager ✓
   - Settings ✗ (should be blocked)

**Expected**: Manager blocked from Settings only

#### 4C: Staff Access Test
1. Login as `staff1`
2. Try accessing:
   - Dashboard ✓
   - Add Sale ✓
   - History ✗ (blocked)
   - Financial Report ✗ (blocked)
   - Shift Manager ✗ (blocked)
   - Settings ✗ (blocked)

**Expected**: Staff can only access Dashboard + Add Sale

---

### Step 5: Phase 4 Inventory - Stock Management (15 min)

#### 5A: View Low Stock Alerts
1. Login as admin
2. Check dashboard for Low Stock Alert widget
3. Should see:
   - Caesar Salad: 25/5 (🟡 LOW)
   - Ice Cream: 25/8 (🟡 LOW)

**Expected**: Widget shows items below threshold

#### 5B: Stock Decrement Test
1. Go to Manage Catalog
2. Find "Coca Cola 330ml"
3. Note current stock: 85 units
4. Go to Add Sale
5. Create sale: 10x Coca Cola @ $2.50 = $25.00
6. Complete sale
7. Return to Manage Catalog
8. Check stock

**Expected**: Stock reduced to 75 (85 - 10)

#### 5C: Trigger Critical Alert
1. Create large sale: 60x Coca Cola
2. Stock becomes: 15 units (below threshold 20)
3. Check dashboard Low Stock Alert

**Expected**: Coca Cola now shows 🟠 CRITICAL (orange)

#### 5D: Out of Stock Prevention
1. Current stock: 15 units
2. Try to create sale: 20x Coca Cola
3. Submit sale

**Expected**: Error message "Insufficient stock", sale rejected

#### 5E: Service Items (No Tracking)
1. Create sale: 5x Room Service @ $15.00
2. Create sale: 3x Laundry @ $20.00
3. Check catalog

**Expected**: Services don't show stock, can sell unlimited

---

### Step 6: Phase 4 Shifts - Z-Reports (20 min)

#### 6A: Open Shift
1. Login as manager1
2. Navigate to Shift Manager
3. Click "Open New Shift"
4. Enter starting cash: **$300.00**
5. Confirm

**Expected**: Shift opens, badge shows "Shift Open"

#### 6B: Process Sales
1. Create sale 1: 5x Caesar Salad @ $12.00 = $60.00
2. Create sale 2: 10x French Fries @ $6.00 = $60.00
3. Create sale 3: 8x Ice Cream @ $7.50 = $60.00
4. Total sales: **$180.00**
5. Expected cash: $300 + $180 = **$480.00**

**Expected**: All sales recorded successfully

#### 6C: Close Shift - Balanced
1. Go to Shift Manager
2. Click "Close Shift"
3. System shows expected: **$480.00**
4. Enter actual cash counted: **$480.00**
5. Difference: **$0.00**
6. Add note: "Perfect balance - no issues"
7. Confirm close

**Expected**: Green indicator, "Balanced" status, $0.00 difference

#### 6D: Open and Close - Overage
1. Open new shift: $200.00
2. Create sales totaling: $95.00
3. Expected: $295.00
4. Close with actual: $298.00
5. Difference: **+$3.00** (overage)

**Expected**: Yellow/blue indicator, warning shown, overage recorded

#### 6E: Open and Close - Shortage
1. Open shift: $150.00
2. Create sales: $120.00
3. Expected: $270.00
4. Close with actual: $265.00
5. Difference: **-$5.00** (shortage)

**Expected**: Red indicator, alert shown, shortage recorded

#### 6F: View Shift History
1. Go to Shift Manager
2. View history table
3. Check details of all shifts

**Expected**: 
- All 5+ shifts listed
- Color-coded by status
- Shows dates, times, amounts, differences
- Notes visible

---

### Step 7: Integration - Real World Scenario (15 min)

#### Complete Business Day Simulation

**Morning - Manager Opens**
1. Login as `manager1`
2. Open shift with $500.00 starting cash
3. Logout

**Lunch Rush - Staff Processes Sales**
1. Login as `staff1`
2. Create 10 different sales (mix products + services)
3. Watch stock decrease in real-time
4. Try to view reports → Should be blocked
5. Logout

**Evening - Manager Closes**
1. Login as `manager1`
2. View Financial Report → Should show all sales
3. Go to Shift Manager
4. Count drawer: Enter actual cash
5. Review difference (if any)
6. Close shift
7. Check shift appears in history

**Night - Admin Reviews**
1. Login as `yasinheaven`
2. Check Low Stock Alerts
3. View Shift History
4. Review Financial Reports
5. Update business settings if needed

**Expected**: 
- Each role functions correctly
- Data persists across logins
- Inventory tracking accurate
- Shift reconciliation correct

---

## ✅ Quick Validation

### Must Pass (Critical)
- [ ] All 3 roles can login
- [ ] Role-based access works (staff blocked from reports)
- [ ] Stock decreases on sales
- [ ] Low stock alerts appear
- [ ] Shifts open/close correctly
- [ ] Cash reconciliation accurate

### Should Pass (Important)
- [ ] Custom business name everywhere
- [ ] Theme switching works
- [ ] Out of stock prevention
- [ ] Shift history displays
- [ ] Multi-user workflow seamless

### Nice to Have (Enhancement)
- [ ] Color-coded alerts
- [ ] Smooth UI transitions
- [ ] Error messages clear
- [ ] Performance smooth

---

## 🐛 Common Issues to Check

### Authentication
- ❌ Wrong password doesn't crash app
- ❌ Logout clears session properly
- ❌ Role badge shows correct icon

### Inventory
- ❌ Stock can't go negative
- ❌ Alerts update in real-time
- ❌ Services don't trigger alerts

### Shifts
- ❌ Can't open multiple shifts
- ❌ Can't close without actual cash
- ❌ Difference calculates correctly

### UI/UX
- ❌ No hardcoded "Hotel Manager" text
- ❌ Theme persists after refresh
- ❌ Responsive on different sizes

---

## 📊 Expected Final State

After completing all tests:

**Database**:
- 3 admin users
- 7+ menu items
- 20+ sales
- 5+ completed shifts
- Business settings configured

**Inventory**:
- Some items at low stock
- Stock accurately decremented
- Alerts showing correctly

**Shifts**:
- Mix of balanced/overage/shortage shifts
- Total variance tracked
- History complete

**UI**:
- Custom business name
- Theme customized
- All features accessible by correct roles

---

## 📝 Report Template

### Test Execution Summary

**Date**: _______________  
**Tester**: _______________  
**Duration**: ___ minutes

**Results**:
- Total Tests: ___
- Passed: ___
- Failed: ___
- Blocked: ___

**Critical Issues**: _______________________________________________

**Recommendation**: [ ] Approve [ ] Reject [ ] Needs Fixes

**Notes**: ________________________________________________________
________________________________________________________________
________________________________________________________________
