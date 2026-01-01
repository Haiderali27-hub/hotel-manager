# 🚀 Complete Onboarding Test Guide

## Database Reset Complete ✅
The database has been deleted and recreated fresh. You should now see the **Setup Wizard** on first launch.

---

## 📋 Step-by-Step Onboarding Test

### **STEP 1: Setup Wizard - Business Information**

When the app opens, you should see the Setup Wizard.

**Fill in Business Details:**
```
Business Name:     Ocean View Restaurant
Address:           456 Beach Boulevard, Miami, FL
Phone:             +1-305-555-9999
Email:             contact@oceanview.com
Currency:          USD ($)
Tax Rate:          8.5
```

Click **"Next"** or **"Continue"**

---

### **STEP 2: Create First Admin Account**

**Admin Credentials:**
```
Username:          admin
Password:          Admin123!
Confirm Password:  Admin123!
Security Question: What is your favorite city?
Security Answer:   Miami
```

**Important:** Remember these credentials! You'll use them to login.

Click **"Complete Setup"** or **"Create Admin"**

---

### **STEP 3: First Login**

After setup completes, you should be redirected to the login page.

**Login with:**
```
Username: admin
Password: Admin123!
```

**Expected Result:** ✅ Login successful, dashboard loads with admin badge (👑 Admin)

---

### **STEP 4: Verify Dashboard**

Once logged in, check:

- [ ] **Header** shows "Ocean View Restaurant" (not "Hotel Manager")
- [ ] **Admin badge** displays "👑 Admin" with gradient styling
- [ ] **Navigation menu** shows all options (Dashboard, Sales, History, Reports, Shifts, Settings)
- [ ] **Stats cards** display (even if zero)
- [ ] **Theme** is dark mode by default

---

### **STEP 5: Settings - Configure Phase 2 & 3**

Navigate to **Settings** (only admin can access)

#### **Business Settings:**
- Verify business info you entered is saved
- Change business name to "Miami Sunset Cafe"
- Click Save
- Check if header updates immediately

#### **Currency Settings:**
- Verify USD ($) is selected
- Tax rate shows 8.5%
- Try changing to EUR (€) just to test
- Change back to USD

#### **Theme Settings (Phase 3):**
- Switch from Dark to Light theme → UI should update instantly
- Change Primary Color to: `#ef4444` (red)
- Change Accent Color to: `#a855f7` (purple)
- Buttons and headers should use new colors
- Switch back to Dark theme

---

### **STEP 6: Create Additional Users (Phase 4 - RBAC)**

Go to **Settings** → **User Management** (or create users via database)

**Create Manager:**
```
Username: manager
Password: Manager123!
Role:     Manager
```

**Create Staff:**
```
Username: staff
Password: Staff123!
Role:     Staff
```

---

### **STEP 7: Test Role-Based Access**

#### **Logout and Login as Manager:**
```
Username: manager
Password: Manager123!
```

**Expected:**
- [ ] Login successful
- [ ] Badge shows "📊 Manager"
- [ ] Can access: Dashboard, Sales, History, Reports, Shifts
- [ ] **CANNOT** access Settings (should be hidden or blocked)

#### **Logout and Login as Staff:**
```
Username: staff
Password: Staff123!
```

**Expected:**
- [ ] Login successful
- [ ] Badge shows "🛒 Staff"
- [ ] Can access: Dashboard, Sales
- [ ] **CANNOT** access: History, Reports, Shifts, Settings

---

### **STEP 8: Inventory Management (Phase 4)**

Login as **admin** again.

#### **Add Products with Stock Tracking:**

Go to **Manage Catalog** (or wherever you add menu items)

**Add Product 1:**
```
Name:        Coca Cola
Category:    Beverages
Price:       2.50
Track Stock: ✓ Yes
Stock:       50
Threshold:   10
```

**Add Product 2:**
```
Name:        Burger
Category:    Food
Price:       12.00
Track Stock: ✓ Yes
Stock:       20
Threshold:   5
```

**Add Service (no stock tracking):**
```
Name:        Delivery
Category:    Services
Price:       5.00
Track Stock: ✗ No
```

---

### **STEP 9: Test Stock Decrement**

#### **Create Sales:**

Go to **Add Sale**

**Sale 1:**
- Item: Coca Cola
- Quantity: 5
- Price: $2.50 × 5 = $12.50
- Complete sale

**Verify:**
- [ ] Sale recorded
- [ ] Stock decreased: 50 → 45

**Sale 2:**
- Item: Burger
- Quantity: 3
- Price: $12.00 × 3 = $36.00
- Complete sale

**Verify:**
- [ ] Stock decreased: 20 → 17

---

### **STEP 10: Trigger Low Stock Alert**

Create a large sale to trigger alert:

**Large Sale:**
- Item: Coca Cola
- Quantity: 40
- Complete sale

**Verify:**
- [ ] Stock becomes: 5 (below threshold of 10)
- [ ] Dashboard shows **Low Stock Alert** widget
- [ ] Coca Cola appears with 🟠 CRITICAL or 🟡 LOW indicator

---

### **STEP 11: Test Out of Stock Prevention**

Try to oversell:

**Oversell Attempt:**
- Item: Coca Cola
- Quantity: 20 (but only 5 available)
- Try to complete sale

**Expected:**
- [ ] ❌ Error: "Insufficient stock"
- [ ] Sale rejected
- [ ] Stock remains at 5

---

### **STEP 12: Shift Management (Phase 4)**

Login as **manager** or **admin**

#### **Open Shift:**

Go to **Shift Manager**

1. Click "Open New Shift"
2. Enter starting cash: **$500.00**
3. Confirm

**Verify:**
- [ ] Shift opens
- [ ] Badge shows "Shift Open" or similar
- [ ] Start time recorded

---

### **STEP 13: Process Sales During Shift**

Create several sales:

**Sale 1:** 2x Coca Cola = $5.00  
**Sale 2:** 1x Burger = $12.00  
**Sale 3:** 1x Delivery = $5.00  
**Sale 4:** 3x Coca Cola = $7.50  
**Sale 5:** 2x Burger = $24.00  

**Total Sales:** $53.50  
**Expected Cash:** $500.00 + $53.50 = **$553.50**

---

### **STEP 14: Close Shift - Balanced**

1. Go to **Shift Manager**
2. Click "Close Shift"
3. System shows expected: **$553.50**
4. Enter actual cash: **$553.50**
5. Difference: **$0.00**
6. Add note: "Perfect balance - test shift"
7. Confirm

**Verify:**
- [ ] Shift closes successfully
- [ ] ✅ Status: Balanced
- [ ] Difference: $0.00
- [ ] Green indicator or success message

---

### **STEP 15: Test Shift with Overage**

1. Open new shift: $300.00
2. Create sales: $50.00
3. Close shift with actual: $352.00 (overage +$2.00)

**Verify:**
- [ ] Overage detected
- [ ] Yellow/blue warning shown
- [ ] Shift history shows +$2.00

---

### **STEP 16: Test Shift with Shortage**

1. Open new shift: $200.00
2. Create sales: $75.00
3. Close shift with actual: $270.00 (shortage -$5.00)

**Verify:**
- [ ] Shortage detected
- [ ] Red alert shown
- [ ] Shift history shows -$5.00

---

### **STEP 17: View Reports**

Login as **admin** or **manager**

#### **Financial Report:**
- [ ] Shows all sales from today
- [ ] Total revenue calculated correctly
- [ ] Can filter by date/category

#### **History:**
- [ ] All transactions listed
- [ ] Shows date, item, quantity, price
- [ ] Can search/filter

#### **Shift History:**
- [ ] All 3 shifts listed
- [ ] Color-coded by status (balanced/overage/shortage)
- [ ] Shows cash amounts, differences, notes

---

### **STEP 18: Receipt Generation**

Create a sale and generate receipt:

**Verify Receipt Shows:**
- [ ] Business name: "Miami Sunset Cafe" (or whatever you set)
- [ ] Business contact info
- [ ] Date and time
- [ ] Items with quantities and prices
- [ ] Subtotal
- [ ] Tax (8.5%)
- [ ] Total
- [ ] Custom footer message (if set)

---

### **STEP 19: Multi-User Workflow Test**

Simulate real business day:

1. **Morning - Manager opens:**
   - Login as manager
   - Open shift: $500
   - Logout

2. **Day - Staff processes sales:**
   - Login as staff
   - Create 10 different sales
   - Try to view reports → Should be blocked ✗
   - Logout

3. **Evening - Manager closes:**
   - Login as manager
   - View reports (should work ✓)
   - Close shift with actual cash
   - Review variance

4. **Admin reviews:**
   - Login as admin
   - Check low stock alerts
   - Review shift history
   - Update settings

**Verify:**
- [ ] Each role can only access allowed features
- [ ] Data persists across sessions
- [ ] No errors or crashes

---

### **STEP 20: Theme Persistence Test**

1. Login as admin
2. Change theme to Light + custom colors
3. Logout
4. Login again

**Verify:**
- [ ] Theme still Light mode
- [ ] Custom colors preserved
- [ ] Settings saved correctly

---

## ✅ Onboarding Complete Checklist

### Phase 1: Offline Auth
- [ ] Setup wizard appears on first launch
- [ ] Can create admin account
- [ ] Can login with created credentials
- [ ] Security questions work
- [ ] No internet required

### Phase 2: Generic Business
- [ ] Business name configurable
- [ ] Shows everywhere (header, receipts)
- [ ] Currency settings work
- [ ] Tax calculation correct
- [ ] No hardcoded "Hotel Manager"

### Phase 3: White-Labeling
- [ ] Theme switching works
- [ ] Custom colors applied
- [ ] Changes persist
- [ ] All UI elements updated

### Phase 4: RBAC
- [ ] Three roles created
- [ ] Admin: Full access
- [ ] Manager: Limited (no Settings)
- [ ] Staff: Minimal (sales only)
- [ ] Access restrictions enforced

### Phase 4: Inventory
- [ ] Products track stock
- [ ] Services don't track stock
- [ ] Auto-decrement works
- [ ] Low stock alerts appear
- [ ] Out of stock prevention works

### Phase 4: Shifts
- [ ] Can open shift
- [ ] Can close shift
- [ ] Cash reconciliation accurate
- [ ] Overage/shortage detection
- [ ] History complete

---

## 🎯 Expected Final State

After completing all tests:

**Users Created:**
- admin (Admin role)
- manager (Manager role)
- staff (Staff role)

**Catalog:**
- 2+ products with stock tracking
- 1+ service without tracking
- Some items at low stock

**Shifts:**
- 3+ completed shifts
- Mix of balanced/overage/shortage
- Complete history

**Business:**
- Custom name set
- Currency configured
- Theme customized
- All settings saved

---

## 🐛 Issues to Watch For

- [ ] Setup wizard doesn't appear
- [ ] Login fails with correct password
- [ ] Role restrictions not working
- [ ] Stock doesn't decrease
- [ ] Alerts don't appear
- [ ] Shift calculations wrong
- [ ] Theme doesn't persist
- [ ] Reports show errors

---

## 📝 Notes

**Current Status:**
- Database: ✅ Fresh/Empty
- Application: ✅ Running
- Setup Wizard: ⏳ Should appear on launch

**Next Action:**
**Look at the application window - you should see the Setup Wizard!**

Start with Step 1 above and work through the complete onboarding process. 🚀

---

**Test Date:** December 30, 2025  
**Tester:** ________________  
**Result:** [ ] Pass [ ] Fail  
**Notes:** ________________________________________________
