# Unified Platform Implementation

## Phase 1 (Started)

### Completed in this iteration
- Created modular API boundaries under `src/api/modules`:
  - `retailService.ts`
  - `hotelRestaurantService.ts`
  - `salonService.ts`
  - `cafeService.ts`
- Added module service adapters:
  - `src/modules/hotel_restaurant/services/hotelRestaurantModuleService.ts`
  - `src/modules/salon/services/salonModuleService.ts`
  - `src/modules/cafe/services/cafeModuleService.ts`
- Added backend migration baseline:
  - `src-tauri/src/db_migrations.rs`
  - Wired in startup call from `src-tauri/src/db.rs`
- Added SQL migration reference:
  - `scripts/migrations/001_unified_schema.sql`

### Hotel/Restaurant parity status
- Ported and wired module screens in `src/modules/hotel_restaurant/components`:
  - `AddGuest.tsx`
  - `AddFoodOrder.tsx`
  - `ActiveGuests.tsx`
  - `CheckoutScreen.tsx`
  - `History.tsx`
  - `AddExpense.tsx`
  - `MonthlyReport.tsx`
  - `ManageMenuRooms.tsx`
- `HotelRestaurantDashboard.tsx` now routes all legacy hotel/restaurant operational pages.

### Schema strategy now active
- Shared tables remain shared (`admin_auth`, `settings`, etc.).
- New module-prefixed tables are now provisioned by migration:
  - Retail: `retail_*`
  - Hotel: `hotel_*`
  - Restaurant: `restaurant_*`
  - Salon: `salon_*`
  - Cafe: `cafe_*`
- Migration ledger table: `schema_migrations`.

## Next implementation steps
1. Move Tauri command handlers out of `simple_commands.rs` into `src-tauri/src/modules/*`.
2. Replace old `scripts/*.cjs` schema assumptions with migration-driven setup.
3. Continue backend modularization and cleanup after legacy removal.

## Legacy folder deletion policy
Do **not** delete until:
- hotel/restaurant feature parity is confirmed,
- migration from old DB is verified,
- smoke tests pass for retail + hotel/restaurant flows.

## Legacy folder deletion checklist (execution order)
1. ✅ Confirm no imports in root app reference `Hotelresturant expense tracker/*`.
2. ✅ Confirm hotel/restaurant operations are reachable from unified `src/App.tsx` business mode flow.
3. ✅ Validate module diagnostics for all `src/modules/hotel_restaurant/components/*` files.
4. ✅ Run migration/bootstrap on a fresh profile and verify module tables exist.
5. ✅ Run smoke tests: add guest, add order, add expense, checkout with invoice, history export, monthly report.
6. ✅ Delete `Hotelresturant expense tracker` folder.
7. ✅ Re-run typecheck/build and fix only issues caused by the folder removal.

## Latest execution notes
- Legacy folder `Hotelresturant expense tracker` has been removed from workspace.
- Post-delete diagnostics sweep currently reports no errors.
- Fresh-profile bootstrap verified via `scripts/bootstrap_unified_core.cjs` + `scripts/migrations/001_unified_schema.sql` (module table assertions passed).
- Hotel smoke path validated via `scripts/smoke_hotel_unified.cjs` (guest/add-order/add-expense/checkout/history data flow at DB level passed).
