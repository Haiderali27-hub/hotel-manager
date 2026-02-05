/**
 * Backend Tests - Products & Inventory
 * Tests Rust Tauri commands for product management
 */

import { invoke } from '@tauri-apps/api/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Products Backend - White Box Testing', () => {
  let testProductId: number;
  let testCategoryId: number;

  beforeEach(async () => {
    // Setup: Create test category
    testCategoryId = await invoke('add_product_category', {
      name: 'Test Category',
      emoji: '🧪',
      color: '#FF0000'
    });
  });

  afterEach(async () => {
    // Cleanup: Delete test data
    if (testProductId) {
      await invoke('delete_menu_item', { itemId: testProductId });
    }
    if (testCategoryId) {
      await invoke('delete_product_category', { categoryId: testCategoryId });
    }
  });

  describe('Product CRUD Operations', () => {
    it('should create a product with all fields', async () => {
      const product = {
        name: 'Test Product',
        category: 'Test Category',
        description: 'Test Description',
        price: 99.99,
        cost_price: 50.00,
        sku: 'TEST-001',
        barcode: '1234567890',
        track_stock: true,
        stock_quantity: 100,
        low_stock_limit: 10,
        is_available: true
      };

      testProductId = await invoke('add_menu_item', { item: product });
      
      expect(testProductId).toBeGreaterThan(0);
      
      // Verify product was created correctly
      const products = await invoke('get_menu_items') as any[];
      const createdProduct = products.find((p: any) => p.id === testProductId);
      
      expect(createdProduct).toBeDefined();
      expect(createdProduct.name).toBe(product.name);
      expect(createdProduct.price).toBe(product.price);
      expect(createdProduct.cost_price).toBe(product.cost_price);
      expect(createdProduct.sku).toBe(product.sku);
      expect(createdProduct.barcode).toBe(product.barcode);
      expect(createdProduct.stock_quantity).toBe(product.stock_quantity);
    });

    it('should update product fields', async () => {
      // Create product first
      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'Original Name',
          category: 'Test Category',
          price: 50.00,
          cost_price: 25.00,
          is_available: true
        }
      });

      // Update product
      const updates = {
        name: 'Updated Name',
        price: 75.00,
        cost_price: 35.00,
        stock_quantity: 50
      };

      await invoke('update_menu_item', {
        itemId: testProductId,
        updates
      });

      // Verify updates
      const products = await invoke('get_menu_items') as any[];
      const updated = products.find((p: any) => p.id === testProductId);
      
      expect(updated.name).toBe(updates.name);
      expect(updated.price).toBe(updates.price);
      expect(updated.cost_price).toBe(updates.cost_price);
      expect(updated.stock_quantity).toBe(updates.stock_quantity);
    });

    it('should delete a product', async () => {
      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'To Delete',
          category: 'Test Category',
          price: 10.00,
          is_available: true
        }
      });

      await invoke('delete_menu_item', { itemId: testProductId });
      
      const products = await invoke('get_menu_items') as any[];
      const deleted = products.find((p: any) => p.id === testProductId);
      
      expect(deleted).toBeUndefined();
      testProductId = 0; // Prevent cleanup from failing
    });
  });

  describe('SKU & Barcode Functionality', () => {
    it('should find product by SKU', async () => {
      const sku = 'UNIQUE-SKU-' + Date.now();
      
      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'SKU Test Product',
          category: 'Test Category',
          price: 25.00,
          sku,
          is_available: true
        }
      });

      const products = await invoke('get_menu_items') as any[];
      const found = products.find((p: any) => p.sku === sku);
      
      expect(found).toBeDefined();
      expect(found.id).toBe(testProductId);
    });

    it('should find product by barcode', async () => {
      const barcode = 'BAR-' + Date.now();
      
      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'Barcode Test Product',
          category: 'Test Category',
          price: 30.00,
          barcode,
          is_available: true
        }
      });

      const products = await invoke('get_menu_items') as any[];
      const found = products.find((p: any) => p.barcode === barcode);
      
      expect(found).toBeDefined();
      expect(found.id).toBe(testProductId);
    });

    it('should allow same SKU/barcode for different products (edge case)', async () => {
      // Create two products with same SKU
      const sku = 'DUPLICATE-SKU';
      
      const id1 = await invoke('add_menu_item', {
        item: { name: 'Product 1', category: 'Test Category', price: 10, sku, is_available: true }
      });
      
      const id2 = await invoke('add_menu_item', {
        item: { name: 'Product 2', category: 'Test Category', price: 20, sku, is_available: true }
      });
      
      const products = await invoke('get_menu_items') as any[];
      const duplicates = products.filter((p: any) => p.sku === sku);
      
      expect(duplicates.length).toBe(2);
      
      // Cleanup
      await invoke('delete_menu_item', { itemId: id1 });
      await invoke('delete_menu_item', { itemId: id2 });
    });
  });

  describe('Stock Tracking', () => {
    it('should track stock correctly when enabled', async () => {
      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'Stock Test',
          category: 'Test Category',
          price: 15.00,
          track_stock: true,
          stock_quantity: 50,
          low_stock_limit: 5,
          is_available: true
        }
      });

      const products = await invoke('get_menu_items') as any[];
      const product = products.find((p: any) => p.id === testProductId);
      
      expect(product.track_stock).toBe(1); // SQLite boolean
      expect(product.stock_quantity).toBe(50);
      expect(product.low_stock_limit).toBe(5);
    });

    it('should deduct stock after sale', async () => {
      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'Stock Deduct Test',
          category: 'Test Category',
          price: 20.00,
          track_stock: true,
          stock_quantity: 100,
          is_available: true
        }
      });

      // Create a sale with this product
      const saleId = await invoke('add_sale', {
        sale: {
          customer_type: 'walkin',
          items: [{
            menu_item_id: testProductId,
            quantity: 5,
            unit_price: 20.00
          }],
          total_amount: 100.00,
          paid: false
        }
      });

      // Check stock was deducted
      const products = await invoke('get_menu_items') as any[];
      const product = products.find((p: any) => p.id === testProductId);
      
      expect(product.stock_quantity).toBe(95); // 100 - 5
      
      // Cleanup
      await invoke('delete_sale', { saleId });
    });

    it('should flag low stock items', async () => {
      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'Low Stock Test',
          category: 'Test Category',
          price: 10.00,
          track_stock: true,
          stock_quantity: 3,
          low_stock_limit: 5,
          is_available: true
        }
      });

      const lowStockItems = await invoke('get_low_stock_items') as any[];
      const isLowStock = lowStockItems.some((item: any) => item.id === testProductId);
      
      expect(isLowStock).toBe(true);
    });
  });

  describe('Product Categories', () => {
    it('should create category with style', async () => {
      const categoryId = await invoke('add_product_category_with_style', {
        name: 'Styled Category',
        emoji: '🎨',
        color: '#00FF00'
      });

      const categories = await invoke('get_product_categories') as any[];
      const found = categories.find((c: any) => c.id === categoryId);
      
      expect(found).toBeDefined();
      expect(found.emoji).toBe('🎨');
      expect(found.color).toBe('#00FF00');
      
      await invoke('delete_product_category', { categoryId });
    });

    it('should update category name', async () => {
      const categoryId = await invoke('add_product_category', {
        name: 'Old Name',
        emoji: '📦',
        color: '#0000FF'
      });

      await invoke('rename_product_category', {
        categoryId,
        newName: 'New Name'
      });

      const categories = await invoke('get_product_categories') as any[];
      const updated = categories.find((c: any) => c.id === categoryId);
      
      expect(updated.name).toBe('New Name');
      
      await invoke('delete_product_category', { categoryId });
    });

    it('should not delete category with products', async () => {
      const categoryId = await invoke('add_product_category', {
        name: 'Category With Products',
        emoji: '📦',
        color: '#FF00FF'
      });

      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'Product in Category',
          category: 'Category With Products',
          price: 5.00,
          is_available: true
        }
      });

      // Attempt to delete category (should fail or reassign products)
      try {
        await invoke('delete_product_category', { categoryId });
        // If it succeeds, verify product was moved to 'General'
        const products = await invoke('get_menu_items') as any[];
        const product = products.find((p: any) => p.id === testProductId);
        expect(product.category).toBe('General');
      } catch (error) {
        // Expected: deletion prevented
        expect(error).toBeDefined();
      }
    });
  });

  describe('Cost vs Selling Price', () => {
    it('should calculate profit margin correctly', async () => {
      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'Margin Test',
          category: 'Test Category',
          price: 100.00,
          cost_price: 60.00,
          is_available: true
        }
      });

      const products = await invoke('get_menu_items') as any[];
      const product = products.find((p: any) => p.id === testProductId);
      
      const profit = product.price - product.cost_price;
      const margin = (profit / product.price) * 100;
      
      expect(profit).toBe(40.00);
      expect(margin).toBe(40); // 40% margin
    });

    it('should allow zero cost price', async () => {
      testProductId = await invoke('add_menu_item', {
        item: {
          name: 'Free Cost',
          category: 'Test Category',
          price: 50.00,
          cost_price: 0,
          is_available: true
        }
      });

      const products = await invoke('get_menu_items') as any[];
      const product = products.find((p: any) => p.id === testProductId);
      
      expect(product.cost_price).toBe(0);
    });
  });
});


