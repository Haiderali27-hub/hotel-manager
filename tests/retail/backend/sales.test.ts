/**
 * Backend Tests - Sales & POS
 * Tests order creation, payment processing, and sales history
 */

import { invoke } from '@tauri-apps/api/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Sales Backend - White Box Testing', () => {
  let testProductId: number;
  let testCustomerId: number;
  let testSaleId: number;

  beforeEach(async () => {
    // Setup: Create test product
    testProductId = await invoke('add_menu_item', {
      item: {
        name: 'Test Product',
        category: 'Test',
        price: 25.00,
        cost_price: 10.00,
        track_stock: true,
        stock_quantity: 100,
        is_available: true
      }
    }) as number;

    // Setup: Create test customer
    testCustomerId = await invoke('add_guest', {
      guest: {
        name: 'Test Customer',
        phone: '1234567890',
        check_in: new Date().toISOString().split('T')[0],
        daily_rate: 0
      }
    }) as number;
  });

  afterEach(async () => {
    // Cleanup
    if (testSaleId) {
      await invoke('delete_sale', { saleId: testSaleId });
    }
    if (testCustomerId) {
      await invoke('delete_guest', { guestId: testCustomerId });
    }
    if (testProductId) {
      await invoke('delete_menu_item', { itemId: testProductId });
    }
  });

  describe('Sale Creation', () => {
    it('should create a basic sale', async () => {
      testSaleId = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          customer_name: 'Walk-in Customer',
          items: [{
            menu_item_id: testProductId,
            quantity: 2,
            unit_price: 25.00,
            item_name: 'Test Product'
          }],
          total_amount: 50.00,
          paid: false
        }
      }) as number;

      expect(testSaleId).toBeGreaterThan(0);

      const sales = await invoke('get_sales') as any[];
      const sale = sales.find((s: any) => s.id === testSaleId);
      
      expect(sale).toBeDefined();
      expect(sale.total_amount).toBe(50.00);
      expect(sale.paid).toBe(0); // SQLite boolean
    });

    it('should create sale with active customer', async () => {
      testSaleId = await invoke('add_sale', {
        sale: {
          customer_type: 'active',
          guest_id: testCustomerId,
          items: [{
            menu_item_id: testProductId,
            quantity: 3,
            unit_price: 25.00,
            item_name: 'Test Product'
          }],
          total_amount: 75.00,
          paid: false
        }
      }) as number;

      const sales = await invoke('get_sales') as any[];
      const sale = sales.find((s: any) => s.id === testSaleId);
      
      expect(sale.guest_id).toBe(testCustomerId);
      expect(sale.guestname || sale.guest_name).toBe('Test Customer');
    });

    it('should calculate correct total from items', async () => {
      const items = [
        { menu_item_id: testProductId, quantity: 2, unit_price: 25.00, item_name: 'Product' },
        { menu_item_id: testProductId, quantity: 3, unit_price: 25.00, item_name: 'Product' }
      ];
      
      const expectedTotal = (2 * 25.00) + (3 * 25.00); // 125.00

      testSaleId = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          items,
          total_amount: expectedTotal,
          paid: false
        }
      }) as number;

      const sales = await invoke('get_sales') as any[];
      const sale = sales.find((s: any) => s.id === testSaleId);
      
      expect(sale.total_amount).toBe(expectedTotal);
    });

    it('should save sale items with order details', async () => {
      testSaleId = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          items: [
            { menu_item_id: testProductId, quantity: 5, unit_price: 25.00, item_name: 'Test Product' }
          ],
          total_amount: 125.00,
          paid: false
        }
      }) as number;

      const details = await invoke('get_sale_details', { saleId: testSaleId }) as any;
      
      expect(details.items).toBeDefined();
      expect(details.items.length).toBe(1);
      expect(details.items[0].quantity).toBe(5);
      expect(details.items[0].unit_price).toBe(25.00);
    });
  });

  describe('Payment Processing', () => {
    beforeEach(async () => {
      testSaleId = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          items: [{ menu_item_id: testProductId, quantity: 4, unit_price: 25.00, item_name: 'Product' }],
          total_amount: 100.00,
          paid: false
        }
      }) as number;
    });

    it('should process full payment', async () => {
      await invoke('add_sale_payment', {
        payment: {
          sale_id: testSaleId,
          amount: 100.00,
          payment_method: 'cash',
          payment_date: new Date().toISOString()
        }
      });

      const summary = await invoke('get_sale_payment_summary', { saleId: testSaleId }) as any;
      
      expect(summary.total_amount).toBe(100.00);
      expect(summary.amount_paid).toBe(100.00);
      expect(summary.balance_due).toBe(0);
    });

    it('should process partial payment', async () => {
      await invoke('add_sale_payment', {
        payment: {
          sale_id: testSaleId,
          amount: 40.00,
          payment_method: 'cash',
          payment_date: new Date().toISOString()
        }
      });

      const summary = await invoke('get_sale_payment_summary', { saleId: testSaleId }) as any;
      
      expect(summary.amount_paid).toBe(40.00);
      expect(summary.balance_due).toBe(60.00);
    });

    it('should process multiple payments', async () => {
      await invoke('add_sale_payment', {
        payment: {
          sale_id: testSaleId,
          amount: 30.00,
          payment_method: 'cash',
          payment_date: new Date().toISOString()
        }
      });

      await invoke('add_sale_payment', {
        payment: {
          sale_id: testSaleId,
          amount: 70.00,
          payment_method: 'card',
          payment_date: new Date().toISOString()
        }
      });

      const summary = await invoke('get_sale_payment_summary', { saleId: testSaleId }) as any;
      
      expect(summary.amount_paid).toBe(100.00);
      expect(summary.balance_due).toBe(0);
    });

    it('should track payment methods', async () => {
      const methods = ['cash', 'card', 'mobile', 'bank'];
      
      for (const method of methods) {
        const saleId = await invoke('add_sale', {
          sale: {
            customer_type: 'walkin',
            items: [{ menu_item_id: testProductId, quantity: 1, unit_price: 25.00, item_name: 'Product' }],
            total_amount: 25.00,
            paid: false
          }
        });

        await invoke('add_sale_payment', {
          payment: {
            sale_id: saleId,
            amount: 25.00,
            payment_method: method,
            payment_date: new Date().toISOString()
          }
        });

        const payments = await invoke('get_sale_payments', { saleId }) as any[];
        expect(payments[0].payment_method).toBe(method);
        
        await invoke('delete_sale', { saleId });
      }
    });
  });

  describe('Returns & Refunds', () => {
    beforeEach(async () => {
      testSaleId = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          items: [{ menu_item_id: testProductId, quantity: 10, unit_price: 25.00, item_name: 'Product' }],
          total_amount: 250.00,
          paid: true
        }
      }) as number;
    });

    it('should create a return with stock restoration', async () => {
      const initialStock = await getProductStock(testProductId);

      const returnId = await invoke('add_return', {
        returnData: {
          original_sale_id: testSaleId,
          items: [{
            menu_item_id: testProductId,
            quantity: 3,
            unit_price: 25.00,
            item_name: 'Product'
          }],
          total_amount: 75.00,
          reason: 'Customer changed mind',
          restore_stock: true
        }
      }) as number;

      expect(returnId).toBeGreaterThan(0);

      const finalStock = await getProductStock(testProductId);
      expect(finalStock).toBe(initialStock + 3);

      await invoke('delete_return', { returnId });
    });

    it('should create return without restoring stock', async () => {
      const initialStock = await getProductStock(testProductId);

      const returnId = await invoke('add_return', {
        returnData: {
          original_sale_id: testSaleId,
          items: [{
            menu_item_id: testProductId,
            quantity: 2,
            unit_price: 25.00,
            item_name: 'Product'
          }],
          total_amount: 50.00,
          reason: 'Damaged item',
          restore_stock: false
        }
      }) as number;

      const finalStock = await getProductStock(testProductId);
      expect(finalStock).toBe(initialStock); // No change

      await invoke('delete_return', { returnId });
    });

    it('should track return history', async () => {
      const returnId = await invoke('add_return', {
        returnData: {
          original_sale_id: testSaleId,
          items: [{ menu_item_id: testProductId, quantity: 1, unit_price: 25.00, item_name: 'Product' }],
          total_amount: 25.00,
          reason: 'Test return',
          restore_stock: true
        }
      }) as number;

      const returns = await invoke('get_returns') as any[];
      const found = returns.find((r: any) => r.id === returnId);
      
      expect(found).toBeDefined();
      expect(found.original_sale_id).toBe(testSaleId);
      expect(found.reason).toBe('Test return');

      await invoke('delete_return', { returnId });
    });
  });

  describe('Stock Adjustments', () => {
    it('should set stock to specific value', async () => {
      await invoke('add_stock_adjustment', {
        adjustment: {
          adjustment_date: new Date().toISOString().split('T')[0],
          reason: 'Stock count',
          items: [{
            menu_item_id: testProductId,
            mode: 'set',
            quantity: 75
          }]
        }
      });

      const stock = await getProductStock(testProductId);
      expect(stock).toBe(75);
    });

    it('should add to existing stock', async () => {
      const initialStock = await getProductStock(testProductId);

      await invoke('add_stock_adjustment', {
        adjustment: {
          adjustment_date: new Date().toISOString().split('T')[0],
          reason: 'New delivery',
          items: [{
            menu_item_id: testProductId,
            mode: 'add',
            quantity: 25
          }]
        }
      });

      const finalStock = await getProductStock(testProductId);
      expect(finalStock).toBe(initialStock + 25);
    });

    it('should remove from stock', async () => {
      const initialStock = await getProductStock(testProductId);

      await invoke('add_stock_adjustment', {
        adjustment: {
          adjustment_date: new Date().toISOString().split('T')[0],
          reason: 'Damaged items',
          items: [{
            menu_item_id: testProductId,
            mode: 'remove',
            quantity: 15
          }]
        }
      });

      const finalStock = await getProductStock(testProductId);
      expect(finalStock).toBe(initialStock - 15);
    });

    it('should allow setting stock to zero', async () => {
      await invoke('add_stock_adjustment', {
        adjustment: {
          adjustment_date: new Date().toISOString().split('T')[0],
          reason: 'Out of stock',
          items: [{
            menu_item_id: testProductId,
            mode: 'set',
            quantity: 0
          }]
        }
      });

      const stock = await getProductStock(testProductId);
      expect(stock).toBe(0);
    });

    it('should track adjustment history with audit trail', async () => {
      const adjustmentId = await invoke('add_stock_adjustment', {
        adjustment: {
          adjustment_date: new Date().toISOString().split('T')[0],
          reason: 'Monthly count',
          notes: 'Physical inventory',
          items: [{
            menu_item_id: testProductId,
            mode: 'set',
            quantity: 50,
            note: 'Shelf A'
          }]
        }
      }) as number;

      const adjustments = await invoke('get_stock_adjustments') as any[];
      const found = adjustments.find((a: any) => a.id === adjustmentId);
      
      expect(found).toBeDefined();
      expect(found.reason).toBe('Monthly count');
      expect(found.notes).toBe('Physical inventory');

      const details = await invoke('get_stock_adjustment_details', {
        adjustmentId
      }) as any;
      
      expect(details.items[0].note).toBe('Shelf A');
    });
  });

  describe('Sales History & Reporting', () => {
    it('should filter sales by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Create sale today
      testSaleId = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          items: [{ menu_item_id: testProductId, quantity: 1, unit_price: 25.00, item_name: 'Product' }],
          total_amount: 25.00,
          paid: true,
          order_date: today
        }
      }) as number;

      const sales = await invoke('get_sales_by_date_range', {
        startDate: today,
        endDate: today
      }) as any[];

      const found = sales.find((s: any) => s.id === testSaleId);
      expect(found).toBeDefined();
    });

    it('should calculate daily revenue', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Create multiple sales
      const sale1 = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          items: [{ menu_item_id: testProductId, quantity: 2, unit_price: 25.00, item_name: 'Product' }],
          total_amount: 50.00,
          paid: true,
          order_date: today
        }
      }) as number;

      const sale2 = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          items: [{ menu_item_id: testProductId, quantity: 3, unit_price: 25.00, item_name: 'Product' }],
          total_amount: 75.00,
          paid: true,
          order_date: today
        }
      }) as number;

      const revenue = await invoke('get_daily_revenue', { date: today });
      
      expect(revenue).toBeGreaterThanOrEqual(125.00);

      await invoke('delete_sale', { saleId: sale1 });
      await invoke('delete_sale', { saleId: sale2 });
    });

    it('should identify unpaid sales', async () => {
      testSaleId = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          items: [{ menu_item_id: testProductId, quantity: 1, unit_price: 25.00, item_name: 'Product' }],
          total_amount: 25.00,
          paid: false
        }
      }) as number;

      const sales = await invoke('get_sales') as any[];
      const unpaid = sales.filter((s: any) => !s.paid && s.id === testSaleId);
      
      expect(unpaid.length).toBeGreaterThan(0);
    });
  });

  // Helper function
  async function getProductStock(productId: number): Promise<number> {
    const products = await invoke('get_menu_items') as any[];
    const product = products.find((p: any) => p.id === productId);
    return product ? product.stock_quantity : 0;
  }
});

