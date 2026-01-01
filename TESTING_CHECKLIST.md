# Testing Checklist - All Phases

## ✅ Setup Complete
- [x] Database created with all tables
- [x] Test data loaded successfully
- [x] Application started in dev mode
- [x] 3 users created: admin, manager1, staff1

---

## 🧪 PHASE 1: Offline Auth

### Login Tests
- [ ] **Test 1.1**: Login with `yasinheaven` / `YHSHotel@2025!` → Should succeed
- [ ] **Test 1.2**: Login with `manager1` / `manager123` → Should succeed  
- [ ] **Test 1.3**: Login with `staff1` / `staff123` → Should succeed
- [ ] **Test 1.4**: Login with wrong password → Should show error
- [ ] **Test 1.5**: Verify works without internet connection

### Role Display
- [ ] **Test 1.6**: Check admin sees **👑 Admin** badge in header
- [ ] **Test 1.7**: Check manager sees **📊 Manager** badge
- [ ] **Test 1.8**: Check staff sees **🛒 Staff** badge

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed

---

## 🏢 PHASE 2: Generic Business

### Business Name
- [ ] **Test 2.1**: Dashboard shows "Sunset Restaurant & Bar" (not "Hotel Manager")
- [ ] **Test 2.2**: Receipt shows business name
- [ ] **Test 2.3**: Settings shows business info

### Currency
- [ ] **Test 2.4**: Prices show with $ symbol before amount
- [ ] **Test 2.5**: Tax calculated at 8.5%
- [ ] **Test 2.6**: Change currency to EUR → Updates throughout app

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed

---

## 🎨 PHASE 3: White-Labeling

### Theme
- [ ] **Test 3.1**: Dark theme active by default
- [ ] **Test 3.2**: Switch to Light theme → UI updates immediately
- [ ] **Test 3.3**: Change primary color → Buttons/headers update
- [ ] **Test 3.4**: Change accent color → Badges/highlights update
- [ ] **Test 3.5**: Theme persists after logout/login

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed

---

## 🔒 PHASE 4: RBAC (Role-Based Access)

### Admin Access (login as yasinheaven)
- [ ] **Test 4.1**: Can access Dashboard ✓
- [ ] **Test 4.2**: Can access Add Sale ✓
- [ ] **Test 4.3**: Can access History ✓
- [ ] **Test 4.4**: Can access Financial Reports ✓
- [ ] **Test 4.5**: Can access Shift Manager ✓
- [ ] **Test 4.6**: Can access Settings ✓

### Manager Access (login as manager1)
- [ ] **Test 4.7**: Can access Dashboard ✓
- [ ] **Test 4.8**: Can access Add Sale ✓
- [ ] **Test 4.9**: Can access History ✓
- [ ] **Test 4.10**: Can access Financial Reports ✓
- [ ] **Test 4.11**: Can access Shift Manager ✓
- [ ] **Test 4.12**: **CANNOT** access Settings ✗

### Staff Access (login as staff1)
- [ ] **Test 4.13**: Can access Dashboard ✓
- [ ] **Test 4.14**: Can access Add Sale ✓
- [ ] **Test 4.15**: **CANNOT** access History ✗
- [ ] **Test 4.16**: **CANNOT** access Financial Reports ✗
- [ ] **Test 4.17**: **CANNOT** access Shift Manager ✗
- [ ] **Test 4.18**: **CANNOT** access Settings ✗

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed

---

## 📦 PHASE 4: Inventory Management

### Low Stock Alerts (already loaded)
- [ ] **Test 4.19**: Dashboard shows Low Stock Alert widget
- [ ] **Test 4.20**: See items below threshold:
  - Caesar Salad: 25/5 (🟡 LOW)
  - Coca Cola: 85/20 (OK)
  - Heineken: 42/10 (OK)

### Stock Decrement
- [ ] **Test 4.21**: Check Coca Cola current stock (should be 85)
- [ ] **Test 4.22**: Create sale: 10x Coca Cola
- [ ] **Test 4.23**: Verify stock reduced to 75
- [ ] **Test 4.24**: Sale recorded in history

### Critical Stock
- [ ] **Test 4.25**: Create large sale: 70x Coca Cola
- [ ] **Test 4.26**: Stock becomes 5 (below threshold 20)
- [ ] **Test 4.27**: Low Stock Alert shows 🟠 CRITICAL or 🔴 OUT

### Out of Stock Prevention
- [ ] **Test 4.28**: Try to sell 20x when only 5 available
- [ ] **Test 4.29**: Error: "Insufficient stock"
- [ ] **Test 4.30**: Sale rejected, stock unchanged

### Services (No Tracking)
- [ ] **Test 4.31**: Create sale: Room Service (unlimited)
- [ ] **Test 4.32**: No stock decrease
- [ ] **Test 4.33**: No alerts for services

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed

---

## 💰 PHASE 4: Shift Management

### Open Shift
- [ ] **Test 4.34**: Navigate to Shift Manager
- [ ] **Test 4.35**: Click "Open New Shift"
- [ ] **Test 4.36**: Enter starting cash: $300.00
- [ ] **Test 4.37**: Shift opens, badge shows "Shift Open"

### Process Sales
- [ ] **Test 4.38**: Create sale 1: $25.00
- [ ] **Test 4.39**: Create sale 2: $42.50
- [ ] **Test 4.40**: Create sale 3: $18.75
- [ ] **Test 4.41**: Total sales: $86.25
- [ ] **Test 4.42**: Expected cash: $386.25

### Close Shift - Balanced
- [ ] **Test 4.43**: Click "Close Shift"
- [ ] **Test 4.44**: Expected shows: $386.25
- [ ] **Test 4.45**: Enter actual: $386.25
- [ ] **Test 4.46**: Difference: $0.00 (✅ Balanced)
- [ ] **Test 4.47**: Green/success indicator

### Close Shift - Overage
- [ ] **Test 4.48**: Open new shift: $200
- [ ] **Test 4.49**: Sales: $50
- [ ] **Test 4.50**: Close with actual: $252 (overage +$2)
- [ ] **Test 4.51**: Yellow/blue indicator shown

### Close Shift - Shortage
- [ ] **Test 4.52**: Open shift: $150
- [ ] **Test 4.53**: Sales: $75
- [ ] **Test 4.54**: Close with actual: $220 (shortage -$5)
- [ ] **Test 4.55**: Red indicator shown

### Shift History
- [ ] **Test 4.56**: View shift history (should see 4+ shifts)
- [ ] **Test 4.57**: Each shows start/end times
- [ ] **Test 4.58**: Cash amounts visible
- [ ] **Test 4.59**: Differences color-coded
- [ ] **Test 4.60**: Notes displayed

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed

---

## 🔗 Integration Tests

### Complete Workflow
- [ ] **Test I.1**: Manager opens shift ($300)
- [ ] **Test I.2**: Logout → Login as staff
- [ ] **Test I.3**: Staff creates 5 sales
- [ ] **Test I.4**: Stock decreases correctly
- [ ] **Test I.5**: Staff CANNOT view reports
- [ ] **Test I.6**: Logout → Login as manager
- [ ] **Test I.7**: Manager views financial report
- [ ] **Test I.8**: Manager closes shift
- [ ] **Test I.9**: Cash reconciliation accurate

### Low Stock Workflow
- [ ] **Test I.10**: Product at 100 units, threshold 20
- [ ] **Test I.11**: Create sales to reduce to 85
- [ ] **Test I.12**: No alert yet (above threshold)
- [ ] **Test I.13**: Create sale to reduce to 15
- [ ] **Test I.14**: Low Stock Alert appears
- [ ] **Test I.15**: Alert is 🟠 CRITICAL (below 50%)

### Theme + Branding
- [ ] **Test I.16**: Change business name to "Ocean Cafe"
- [ ] **Test I.17**: Name updates everywhere immediately
- [ ] **Test I.18**: Change theme to light + teal
- [ ] **Test I.19**: All pages use new theme
- [ ] **Test I.20**: Receipt shows new branding

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed

---

## 📊 Test Summary

### Overall Results
- **Total Tests**: 60+
- **Passed**: ___
- **Failed**: ___
- **Skipped**: ___

### Phase Results
| Phase | Status | Tests | Passed | Failed | Notes |
|-------|--------|-------|--------|--------|-------|
| Phase 1: Auth | ⬜ | 7 | 0 | 0 | |
| Phase 2: Business | ⬜ | 6 | 0 | 0 | |
| Phase 3: Theme | ⬜ | 5 | 0 | 0 | |
| Phase 4: RBAC | ⬜ | 18 | 0 | 0 | |
| Phase 4: Inventory | ⬜ | 15 | 0 | 0 | |
| Phase 4: Shifts | ⬜ | 27 | 0 | 0 | |
| Integration | ⬜ | 11 | 0 | 0 | |

---

## 🐛 Issues Found

### Critical Issues
- [ ] Issue #1: _________________________________
- [ ] Issue #2: _________________________________

### Major Issues
- [ ] Issue #3: _________________________________
- [ ] Issue #4: _________________________________

### Minor Issues
- [ ] Issue #5: _________________________________
- [ ] Issue #6: _________________________________

---

## 📝 Test Notes

**Tester**: ___________________  
**Date**: December 30, 2025  
**Environment**: Development (npm run tauri dev)  
**Database**: c:\Users\DELL\Desktop\hotel-manager\db\hotel.db

**General Observations**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Performance Notes**:
_________________________________________________________________
_________________________________________________________________

**User Experience**:
_________________________________________________________________
_________________________________________________________________

---

## ✅ Sign-Off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Performance acceptable
- [ ] Ready for production

**Approved by**: ___________________  
**Date**: ___________________  
**Signature**: ___________________
