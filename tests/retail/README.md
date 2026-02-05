# Retail Features Testing Suite

## Overview

This comprehensive testing suite covers all retail functionality in the hotel management system, including:
- Product management (CRUD, SKU/Barcode, Stock tracking)
- Sales & POS operations
- Payment processing (full, partial, multiple)
- Returns & refunds
- Stock adjustments
- Category management
- Customer integration
- Reporting & history

## Test Structure

```
tests/
├── setup.ts                          # Global test configuration
├── retail/
│   ├── backend/                      # White-box backend tests
│   │   ├── products.test.ts         # Product CRUD, SKU, stock tracking
│   │   └── sales.test.ts            # Sales, payments, returns, stock adjustments
│   ├── frontend/                     # Black-box UI tests
│   │   └── ProductsPage.test.tsx    # ProductsPage component testing
│   └── integration/                  # End-to-end tests
│       └── complete-workflow.test.ts # Full user journey testing
```

## Test Coverage

### Backend Tests (White Box)

#### products.test.ts
- ✅ Product CRUD Operations
  - Create products with all fields
  - Update existing products
  - Delete products
  - Retrieve product details

- ✅ SKU & Barcode Functionality (**Fix #6**)
  - Combined SKU/Barcode field
  - Uniqueness validation
  - Search by SKU
  - Search by Barcode

- ✅ Stock Tracking
  - Enable/disable stock tracking
  - Stock deduction after sale
  - Low stock alerts
  - Out of stock prevention

- ✅ Product Categories (**Fix #7**)
  - Create categories with style (emoji & color)
  - Update category properties
  - Delete categories (reassign products to "Uncategorized")
  - Empty categories display

- ✅ Cost vs Selling Price (**Fix #2**)
  - Both cost_price and price fields
  - Profit margin calculations
  - Pricing validations

#### sales.test.ts
- ✅ Sale Creation
  - Basic sale creation
  - Sale with customer
  - Multiple items in a sale
  - Item calculations (quantity × price)

- ✅ Payment Processing
  - Full payment
  - Partial payment
  - Multiple payments
  - Payment by method (Cash, Card, UPI)

- ✅ Returns & Refunds
  - Return without stock restoration
  - Return with stock restoration
  - Return history tracking
  - Refund amount validation

- ✅ Stock Adjustments
  - SET mode (set to exact value)
  - ADD mode (increase stock)
  - REMOVE mode (decrease stock)
  - Zero support in SET mode
  - Audit trail creation

- ✅ Sales History & Reporting
  - Date-based filtering
  - Revenue calculations
  - Unpaid sales identification

### Frontend Tests (Black Box)

#### ProductsPage.test.tsx
- ✅ Product Display
  - List all products
  - Display prices, SKU, barcode
  - Low stock warnings
  - Empty categories display (**Fix #7**)

- ✅ Search & Filter
  - Search by name
  - Filter by category
  - No results handling

- ✅ Add Product Form
  - Modal opening
  - Cost and selling price fields (**Fix #2**)
  - Combined SKU/Barcode field (**Fix #6**)
  - Form validation
  - Successful submission

- ✅ Edit Product
  - Pre-filled data
  - Update operations
  - Save confirmation

- ✅ Delete Product
  - Confirmation dialog
  - Successful deletion
  - Cancellation handling

- ✅ Category Management
  - Categories manager modal
  - Add new category
  - Edit categories
  - Delete categories

- ✅ UI Interactions
  - Expand/collapse categories
  - Back navigation
  - Stock indicators

### Integration Tests (End-to-End)

#### complete-workflow.test.ts

**Scenario 1: New Store Setup**
- Add multiple products with different configurations
- Create tracked and non-tracked items
- Verify SKU and barcode search

**Scenario 2: Customer Purchase Journey**
- Create customer
- Create multi-item sale
- Verify stock deduction
- Process full payment
- Verify payment status

**Scenario 3: Return & Refund**
- Create and pay for sale
- Process return
- Verify stock restoration
- Check return history

**Scenario 4: Partial Payments**
- Create sale
- Make multiple partial payments
- Track payment progression
- Verify final payment status

**Scenario 5: Low Stock Alerts**
- Create product with low stock limit
- Reduce stock below limit
- Manual stock adjustment
- Verify restock

**Scenario 6: Sales Reporting**
- Create multiple sales
- Generate date-based reports
- Calculate revenue
- Identify unpaid sales

**Scenario 7: Category Management**
- Create category
- Add products to category
- Update category style
- Delete category (products remain)

**Scenario 8: Stock Adjustment Modes**
- Test SET mode
- Test ADD mode
- Test REMOVE mode
- Edge cases (zero stock)

## Running Tests

### Prerequisites

1. Install dependencies:
```bash
npm install
```

### Test Commands

Run all tests (watch mode):
```bash
npm test
```

Run all tests once:
```bash
npm run test:run
```

Run with UI interface:
```bash
npm run test:ui
```

Generate coverage report:
```bash
npm run test:coverage
```

Run retail tests only:
```bash
npm run test:retail
```

Run backend tests only:
```bash
npm run test:retail:backend
```

Run frontend tests only:
```bash
npm run test:retail:frontend
```

Run integration tests only:
```bash
npm run test:retail:integration
```

Watch mode for development:
```bash
npm run test:watch
```

### Test Environment

Tests run in the following environment:
- **Test Runner**: Vitest
- **DOM Environment**: jsdom
- **React Testing**: @testing-library/react
- **Backend Mocking**: Tauri invoke() mocked via vitest

## Interpreting Results

### Success Criteria

All tests should pass with:
- ✅ All assertions passing
- ✅ No console errors
- ✅ Coverage > 80% (lines, functions, branches, statements)

### Common Issues

**"Cannot find module" errors:**
- Run `npm install` to ensure all dependencies are installed

**"invoke is not a function" errors:**
- Check that Tauri is properly mocked in tests/setup.ts

**Frontend rendering errors:**
- Verify that @testing-library/react is installed
- Check that jsdom is configured in vitest.config.ts

**Database errors in integration tests:**
- Ensure database is properly initialized
- Check that cleanup runs after each test

### Coverage Report

After running `npm run test:coverage`, open:
```
test-results/index.html
```

This shows detailed coverage information:
- Lines covered
- Branches covered
- Functions covered
- Uncovered code locations

## Test Development Guidelines

### Writing New Tests

1. **Backend Tests**
   - Use `invoke()` to call Tauri commands
   - Always cleanup in `afterEach` or `afterAll`
   - Test edge cases (zero, negative, null)
   - Verify audit trails

2. **Frontend Tests**
   - Use `render()` from @testing-library/react
   - Use `screen` for queries
   - Use `userEvent` for interactions
   - Mock API calls with vi.mock()

3. **Integration Tests**
   - Test complete workflows
   - Verify data consistency
   - Test across multiple operations
   - Clean up all test data

### Best Practices

- ✅ Test one thing per test
- ✅ Use descriptive test names
- ✅ Clean up after tests
- ✅ Mock external dependencies
- ✅ Test error cases
- ✅ Avoid test interdependence
- ✅ Use constants for test data

## Retail Fixes Validated

This test suite validates all 10 retail fixes:

1. ✅ **Fix #1**: Audit trail creation (tested in all operations)
2. ✅ **Fix #2**: Cost price field (products.test.ts, ProductsPage.test.tsx)
3. ✅ **Fix #3**: Partial payments (sales.test.ts, complete-workflow.test.ts)
4. ✅ **Fix #4**: Stock deduction (sales.test.ts, complete-workflow.test.ts)
5. ✅ **Fix #5**: Stock restoration on return (sales.test.ts, complete-workflow.test.ts)
6. ✅ **Fix #6**: Combined SKU/Barcode (products.test.ts, ProductsPage.test.tsx)
7. ✅ **Fix #7**: Empty categories display (products.test.ts, ProductsPage.test.tsx)
8. ✅ **Fix #8**: Stock adjustment modes (sales.test.ts, complete-workflow.test.ts)
9. ✅ **Fix #9**: Multiple payment methods (sales.test.ts, complete-workflow.test.ts)
10. ✅ **Fix #10**: Low stock alerts (products.test.ts, complete-workflow.test.ts)

## Continuous Integration

To integrate with CI/CD:

1. Add to GitHub Actions workflow:
```yaml
- name: Run tests
  run: npm run test:run

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

2. Set up pre-commit hooks:
```bash
npm run test:run
```

## Troubleshooting

### Tests Pass Locally but Fail in CI
- Check Node.js version compatibility
- Verify all dependencies are in package.json
- Ensure database files are not committed

### Slow Test Execution
- Use `test:run` instead of watch mode
- Reduce timeout values in vitest.config.ts
- Run specific test suites only

### Flaky Tests
- Add proper `await` for async operations
- Use `waitFor` for UI updates
- Increase timeout for slow operations

## Contributing

When adding retail features:
1. Write tests first (TDD approach)
2. Run existing tests to ensure no regressions
3. Add both unit and integration tests
4. Update this README with new test coverage

## Support

For issues or questions:
1. Check test output for specific error messages
2. Review this README for common issues
3. Check vitest.config.ts for configuration
4. Verify all dependencies are installed
