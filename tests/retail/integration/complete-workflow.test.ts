/**
 * Integration Tests - Complete Retail Workflow
 * End-to-End Testing - Simulates complete user journeys
 */

import { invoke } from '@tauri-apps/api/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Complete Retail Workflow - E2E Integration Tests', () => {
  let testProductIds: number[] = [];
  let testCustomerId: number;
  let testCategoryId: number;

  beforeAll(async () => {
    // Setup: Create test category
    testCategoryId = await invoke('add_product_category_with_style', {
      name: 'Test Category',
      emoji: '📦',
      color: '#FF0000'
    });
  });

  afterAll(async () => {
    // Cleanup: Delete all test data
    for (const id of testProductIds) {
      await invoke('delete_menu_item', { id });
    }
    if (testCustomerId) {
      await invoke('delete_customer', { id: testCustomerId });
    }
    await invoke('delete_product_category', { id: testCategoryId });
  });

  describe('Scenario 1: New Store Setup - Adding Products', () => {
    it('should complete full product setup workflow', async () => {
      // Step 1: Create first product with SKU
      const product1Id = await invoke('add_menu_item', {
        item: {
          name: 'Laptop Computer',
          category: 'Test Category',
          price: 999.99,
          cost_price: 600.00,
          sku: 'LAPTOP-001',
          track_stock: 1,
          stock_quantity: 10,
          low_stock_limit: 2,
          is_available: 1
        }
      }) as number;
      testProductIds.push(product1Id);
      expect(product1Id).toBeGreaterThan(0);

      // Step 2: Create second product with barcode
      const product2Id = await invoke('add_menu_item', {
        item: {
          name: 'Wireless Mouse',
          category: 'Test Category',
          price: 29.99,
          cost_price: 15.00,
          barcode: '1234567890',
          track_stock: 1,
          stock_quantity: 50,
          low_stock_limit: 10,
          is_available: 1
        }
      }) as number;
      testProductIds.push(product2Id);
      expect(product2Id).toBeGreaterThan(0);

      // Step 3: Create non-tracked product
      const product3Id = await invoke('add_menu_item', {
        item: {
          name: 'Extended Warranty',
          category: 'Test Category',
          price: 99.99,
          cost_price: 0,
          track_stock: 0,
          is_available: 1
        }
      }) as number;
      testProductIds.push(product3Id);
      expect(product3Id).toBeGreaterThan(0);

      // Step 4: Verify all products are retrievable
      const products = await invoke('get_menu_items') as any[];
      expect(products.length).toBeGreaterThanOrEqual(3);

      // Step 5: Search by SKU
      const skuResults = await invoke('search_by_sku', { sku: 'LAPTOP-001' }) as any[];
      expect(skuResults.length).toBe(1);
      expect(skuResults[0].name).toBe('Laptop Computer');

      // Step 6: Search by barcode
      const barcodeResults = await invoke('search_by_barcode', { barcode: '1234567890' }) as any[];
      expect(barcodeResults.length).toBe(1);
      expect(barcodeResults[0].name).toBe('Wireless Mouse');
    });
  });

  describe('Scenario 2: Customer Purchase Journey', () => {
    it('should complete full sales workflow with stock deduction', async () => {
      // Step 1: Create customer
      testCustomerId = await invoke('add_customer', {
        customer: {
          name: 'John Doe',
          phone: '1234567890',
          company_name: 'Tech Corp',
          gstin: 'TEST123456',
          credit_limit: 5000
        }
      }) as number;
      expect(testCustomerId).toBeGreaterThan(0);

      // Step 2: Check initial stock
      const productBefore = await invoke('get_menu_item', { id: testProductIds[0] }) as any;
      const initialStock = productBefore.stock_quantity;
      expect(initialStock).toBe(10);

      // Step 3: Create sale with multiple items
      const saleId = await invoke('create_sale', {
        sale: {
          customer_id: testCustomerId,
          items: [
            {
              product_id: testProductIds[0],
              quantity: 2,
              unit_price: 999.99,
              total: 1999.98
            },
            {
              product_id: testProductIds[1],
              quantity: 3,
              unit_price: 29.99,
              total: 89.97
            },
            {
              product_id: testProductIds[2], // Non-tracked item
              quantity: 1,
              unit_price: 99.99,
              total: 99.99
            }
          ],
          subtotal: 2189.94,
          discount: 0,
          tax: 0,
          total: 2189.94,
          payment_status: 'unpaid'
        }
      }) as number;
      expect(saleId).toBeGreaterThan(0);

      // Step 4: Verify stock was deducted
      const product1After = await invoke('get_menu_item', { id: testProductIds[0] }) as any;
      expect(product1After.stock_quantity).toBe(initialStock - 2);

      const product2After = await invoke('get_menu_item', { id: testProductIds[1] }) as any;
      expect(product2After.stock_quantity).toBe(47); // 50 - 3

      const product3After = await invoke('get_menu_item', { id: testProductIds[2] }) as any;
      expect(product3After.stock_quantity).toBe(0); // Not tracked, should remain 0

      // Step 5: Process full payment
      const paymentId = await invoke('add_payment', {
        saleId,
        amount: 2189.94,
        method: 'Cash'
      });
      expect(paymentId).toBeGreaterThan(0);

      // Step 6: Verify sale is now paid
      const saleDetails = await invoke('get_sale_details', { saleId }) as any;
      expect(saleDetails.payment_status).toBe('paid');
      expect(saleDetails.amount_paid).toBe(2189.94);
      expect(saleDetails.amount_due).toBe(0);
    });
  });

  describe('Scenario 3: Return & Refund with Stock Restoration', () => {
    it('should process return and restore stock correctly', async () => {
      // Step 1: Create a new sale
      const saleId = await invoke('create_sale', {
        sale: {
          items: [
            {
              product_id: testProductIds[0],
              quantity: 1,
              unit_price: 999.99,
              total: 999.99
            }
          ],
          subtotal: 999.99,
          total: 999.99,
          payment_status: 'paid'
        }
      }) as number;

      // Step 2: Pay for sale
      await invoke('add_payment', {
        saleId,
        amount: 999.99,
        method: 'Card'
      });

      // Step 3: Check stock before return
      const stockBefore = await invoke('get_menu_item', { id: testProductIds[0] }) as any;
      const stockBeforeReturn = stockBefore.stock_quantity;

      // Step 4: Process return with stock restoration
      const returnId = await invoke('create_return', {
        returnData: {
          original_sale_id: saleId,
          items: [
            {
              product_id: testProductIds[0],
              quantity: 1,
              unit_price: 999.99,
              total: 999.99
            }
          ],
          total: 999.99,
          reason: 'Defective item',
          restore_stock: 1
        }
      }) as number;
      expect(returnId).toBeGreaterThan(0);

      // Step 5: Verify stock was restored
      const stockAfter = await invoke('get_menu_item', { id: testProductIds[0] }) as any;
      expect(stockAfter.stock_quantity).toBe(stockBeforeReturn + 1);

      // Step 6: Verify return is recorded
      const returnDetails = await invoke('get_return_details', { returnId }) as any;
      expect(returnDetails.original_sale_id).toBe(saleId);
      expect(returnDetails.total).toBe(999.99);
    });
  });

  describe('Scenario 4: Partial Payments Over Time', () => {
    it('should handle multiple partial payments correctly', async () => {
      // Step 1: Create sale
      const saleId = await invoke('create_sale', {
        sale: {
          customer_id: testCustomerId,
          items: [
            {
              product_id: testProductIds[0],
              quantity: 1,
              unit_price: 999.99,
              total: 999.99
            }
          ],
          subtotal: 999.99,
          total: 999.99,
          payment_status: 'unpaid'
        }
      }) as number;

      // Step 2: First partial payment (40%)
      await invoke('add_payment', {
        saleId,
        amount: 400.00,
        method: 'Cash'
      });

      let saleDetails = await invoke('get_sale_details', { saleId }) as any;
      expect(saleDetails.payment_status).toBe('partial');
      expect(saleDetails.amount_paid).toBe(400.00);
      expect(saleDetails.amount_due).toBeCloseTo(599.99, 2);

      // Step 3: Second partial payment (30%)
      await invoke('add_payment', {
        saleId,
        amount: 300.00,
        method: 'Card'
      });

      saleDetails = await invoke('get_sale_details', { saleId });
      expect(saleDetails.payment_status).toBe('partial');
      expect(saleDetails.amount_paid).toBe(700.00);
      expect(saleDetails.amount_due).toBeCloseTo(299.99, 2);

      // Step 4: Final payment
      await invoke('add_payment', {
        saleId,
        amount: 299.99,
        method: 'UPI'
      });

      saleDetails = await invoke('get_sale_details', { saleId });
      expect(saleDetails.payment_status).toBe('paid');
      expect(saleDetails.amount_paid).toBeCloseTo(999.99, 2);
      expect(saleDetails.amount_due).toBe(0);
    });
  });

  describe('Scenario 5: Low Stock Alerts', () => {
    it('should trigger low stock alerts and manual adjustment', async () => {
      // Step 1: Create product with low stock limit
      const productId = await invoke('add_menu_item', {
        item: {
          name: 'USB Cable',
          category: 'Test Category',
          price: 9.99,
          cost_price: 3.00,
          track_stock: 1,
          stock_quantity: 15,
          low_stock_limit: 10,
          is_available: 1
        }
      }) as number;
      testProductIds.push(productId as number);

      // Step 2: Make sale to reduce stock below limit
      const saleId = await invoke('create_sale', {
        sale: {
          items: [
            {
              product_id: productId,
              quantity: 8,
              unit_price: 9.99,
              total: 79.92
            }
          ],
          subtotal: 79.92,
          total: 79.92,
          payment_status: 'paid'
        }
      }) as number;

      // Step 3: Verify stock is below limit
      const productAfterSale = await invoke('get_menu_item', { id: productId }) as any;
      expect(productAfterSale.stock_quantity).toBe(7);
      expect(productAfterSale.stock_quantity).toBeLessThan(productAfterSale.low_stock_limit);

      // Step 4: Manual stock adjustment (restock)
      await invoke('adjust_stock', {
        productId,
        quantity: 20,
        mode: 'add',
        reason: 'Restock from supplier'
      });

      // Step 5: Verify stock is restored
      const productAfterRestock = await invoke('get_menu_item', { id: productId }) as any;
      expect(productAfterRestock.stock_quantity).toBe(27); // 7 + 20
    });
  });

  describe('Scenario 6: Sales Reporting', () => {
    it('should generate accurate sales reports', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Step 1: Create multiple sales on the same day
      for (let i = 0; i < 3; i++) {
        const saleId = await invoke('create_sale', {
          sale: {
            items: [
              {
                product_id: testProductIds[1],
                quantity: 2,
                unit_price: 29.99,
                total: 59.98
              }
            ],
            subtotal: 59.98,
            total: 59.98,
            payment_status: 'paid'
          }
        });

        await invoke('add_payment', {
          saleId,
          amount: 59.98,
          method: 'Cash'
        });
      }

      // Step 2: Get sales history for today
      const salesHistory = await invoke('get_sales_history', {
        startDate: today,
        endDate: today
      }) as any[];

      expect(salesHistory.length).toBeGreaterThanOrEqual(3);

      // Step 3: Calculate revenue
      const totalRevenue = salesHistory.reduce((sum: number, sale: any) => 
        sum + sale.total, 0
      );
      expect(totalRevenue).toBeGreaterThanOrEqual(179.94); // 3 * 59.98

      // Step 4: Get unpaid sales (should be empty for this test)
      const unpaidSales = await invoke('get_unpaid_sales') as any[];
      const testUnpaidSales = unpaidSales.filter((sale: any) => 
        sale.customer_id === testCustomerId
      );
      expect(testUnpaidSales.length).toBe(0); // All paid in this scenario
    });
  });

  describe('Scenario 7: Category Management with Products', () => {
    it('should handle category operations without breaking products', async () => {
      // Step 1: Create new category
      const newCategoryId = await invoke('add_product_category_with_style', {
        name: 'New Tech',
        emoji: '💻',
        color: '#00FF00'
      }) as number;

      // Step 2: Create product in new category
      const productId = await invoke('add_menu_item', {
        item: {
          name: 'Keyboard',
          category: 'New Tech',
          price: 79.99,
          cost_price: 40.00,
          track_stock: 1,
          stock_quantity: 30,
          is_available: 1
        }
      }) as number;
      testProductIds.push(productId);

      // Step 3: Update category style
      await invoke('update_product_category', {
        id: newCategoryId,
        name: 'New Tech',
        emoji: '⌨️',
        color: '#0000FF'
      });

      // Step 4: Verify product still accessible
      const product = await invoke('get_menu_item', { id: productId }) as any;
      expect(product.name).toBe('Keyboard');
      expect(product.category).toBe('New Tech');

      // Step 5: Delete category (should reassign products to "Uncategorized")
      await invoke('delete_product_category', { id: newCategoryId });

      // Step 6: Verify product still exists
      const productAfterDelete = await invoke('get_menu_item', { id: productId }) as any;
      expect(productAfterDelete.id).toBe(productId);
      expect(productAfterDelete.category).toBe('Uncategorized');
    });
  });

  describe('Scenario 8: Stock Adjustment Modes', () => {
    it('should handle all stock adjustment modes correctly', async () => {
      const productId = await invoke('add_menu_item', {
        item: {
          name: 'Test Stock Item',
          category: 'Test Category',
          price: 50.00,
          track_stock: 1,
          stock_quantity: 100,
          is_available: 1
        }
      }) as number;
      testProductIds.push(productId);

      // Mode 1: SET - Set stock to exact value
      await invoke('adjust_stock', {
        productId,
        quantity: 50,
        mode: 'set',
        reason: 'Physical count correction'
      });

      let product = await invoke('get_menu_item', { id: productId }) as any;
      expect(product.stock_quantity).toBe(50);

      // Mode 2: ADD - Increase stock
      await invoke('adjust_stock', {
        productId,
        quantity: 25,
        mode: 'add',
        reason: 'Received shipment'
      });

      product = await invoke('get_menu_item', { id: productId });
      expect(product.stock_quantity).toBe(75);

      // Mode 3: REMOVE - Decrease stock
      await invoke('adjust_stock', {
        productId,
        quantity: 10,
        mode: 'remove',
        reason: 'Damaged goods'
      });

      product = await invoke('get_menu_item', { id: productId });
      expect(product.stock_quantity).toBe(65);

      // Mode 4: SET to 0 (edge case)
      await invoke('adjust_stock', {
        productId,
        quantity: 0,
        mode: 'set',
        reason: 'Out of stock'
      });

      product = await invoke('get_menu_item', { id: productId });
      expect(product.stock_quantity).toBe(0);
    });
  });
});


