/**
 * Frontend Component Tests - Products Page
 * Black Box Testing - Testing user interactions and UI behavior
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '../../../src/api/client';
import ProductsPage from '../../../src/components/ProductsPage';
import { CurrencyProvider } from '../../../src/context/CurrencyContext';
import { NotificationProvider } from '../../../src/context/NotificationContext';
import { ThemeProvider } from '../../../src/context/ThemeContext';

// Mock API calls
vi.mock('../../../src/api/client');

const mockProducts = [
  {
    id: 1,
    name: 'Test Product 1',
    category: 'Electronics',
    price: 99.99,
    cost_price: 50.00,
    sku: 'TEST-001',
    barcode: '1234567890',
    track_stock: 1,
    stock_quantity: 50,
    low_stock_limit: 10,
    is_available: true
  },
  {
    id: 2,
    name: 'Test Product 2',
    category: 'Electronics',
    price: 149.99,
    cost_price: 75.00,
    stock_quantity: 3,
    low_stock_limit: 5,
    track_stock: 1,
    is_available: true
  }
];

const mockCategories = [
  { id: 1, name: 'Electronics', emoji: '📱', color: '#FF0000', created_at: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'Clothing', emoji: '👕', color: '#00FF00', created_at: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'Empty Category', emoji: '📦', color: '#0000FF', created_at: '2024-01-01T00:00:00Z' }
];

// Custom render function with all required providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <CurrencyProvider>
        <NotificationProvider>
          {ui}
        </NotificationProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
};

describe('ProductsPage Component - Black Box Tests', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getMenuItems).mockResolvedValue(mockProducts);
    vi.mocked(apiClient.getProductCategories).mockResolvedValue(mockCategories);
    vi.mocked(apiClient.getBarcodeEnabled).mockResolvedValue(true);
  });

  describe('Product Display', () => {
    it('should render products list on load', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
        expect(screen.getByText('Test Product 2')).toBeInTheDocument();
      });
    });

    it('should display product prices correctly', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText(/99\.99/)).toBeInTheDocument();
        expect(screen.getByText(/149\.99/)).toBeInTheDocument();
      });
    });

    it('should show low stock warning', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        // Product 2 has stock 3, limit 5 - should be flagged
        const lowStockItems = screen.getAllByText(/3/);
        expect(lowStockItems.length).toBeGreaterThan(0);
      });
    });

    it('should display SKU and barcode', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('TEST-001')).toBeInTheDocument();
        expect(screen.getByText('1234567890')).toBeInTheDocument();
      });
    });
  });

  describe('Empty Categories Display', () => {
    it('should show empty categories (Fix #7)', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('Empty Category')).toBeInTheDocument();
      });
    });

    it('should display message for categories with no products', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        const emptyCategory = screen.getByText('Empty Category');
        fireEvent.click(emptyCategory);
      });

      await waitFor(() => {
        expect(screen.getByText(/No products in this category yet/)).toBeInTheDocument();
      });
    });
  });

  describe('Product Search & Filter', () => {
    it('should filter products by name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search/i);
      await user.type(searchInput, 'Product 1');

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
        expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument();
      });
    });

    it('should filter products by category', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        const electronicsCategory = screen.getByText('Electronics');
        expect(electronicsCategory).toBeInTheDocument();
      });
    });

    it('should show no results message when search has no matches', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      const searchInput = screen.getByPlaceholderText(/Search/i);
      await user.type(searchInput, 'NonExistentProduct');

      await waitFor(() => {
        expect(screen.getByText(/No matches/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Product Form', () => {
    it('should open add product modal', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      const addButton = screen.getByText('Add Product');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/Add Product/i)).toBeInTheDocument();
      });
    });

    it('should show both cost and selling price fields (Fix #2)', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      fireEvent.click(screen.getByText('Add Product'));

      await waitFor(() => {
        expect(screen.getByText(/Cost.*what you paid/i)).toBeInTheDocument();
        expect(screen.getByText(/Price.*selling price/i)).toBeInTheDocument();
      });
    });

    it('should show combined SKU/Barcode field (Fix #6)', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      fireEvent.click(screen.getByText('Add Product'));

      await waitFor(() => {
        const skuField = screen.getByLabelText(/SKU.*Barcode.*optional/i);
        expect(skuField).toBeInTheDocument();
        // Should be a single field, not two separate ones
        const skuFields = screen.queryAllByLabelText(/SKU/i);
        expect(skuFields.length).toBe(1);
      });
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.addMenuItem).mockRejectedValue(new Error('Name is required'));
      
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      fireEvent.click(screen.getByText('Add Product'));

      const saveButton = await screen.findByText('Save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument();
      });
    });

    it('should successfully add a product', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.addMenuItem).mockResolvedValue(3);
      
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      fireEvent.click(screen.getByText('Add Product'));

      await user.type(screen.getByPlaceholderText(/Product name/i), 'New Product');
      await user.type(screen.getByPlaceholderText(/Price/i), '29.99');
      await user.type(screen.getByPlaceholderText(/Cost/i), '15.00');

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(apiClient.addMenuItem).toHaveBeenCalled();
      });
    });
  });

  describe('Edit Product', () => {
    it('should open edit modal with pre-filled data', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const editButton = screen.getAllByText('Edit')[0];
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Product 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('99.99')).toBeInTheDocument();
        expect(screen.getByDisplayValue('50.00')).toBeInTheDocument();
      });
    });

    it('should update product successfully', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.updateMenuItem).mockResolvedValue(true);
      
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const editButton = screen.getAllByText('Edit')[0];
      fireEvent.click(editButton);

      const priceInput = await screen.findByDisplayValue('99.99');
      await user.clear(priceInput);
      await user.type(priceInput, '89.99');

      const saveButton = screen.getByText('Update');
      await user.click(saveButton);

      await waitFor(() => {
        expect(apiClient.updateMenuItem).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ price: 89.99 })
        );
      });
    });
  });

  describe('Delete Product', () => {
    it('should delete product with confirmation', async () => {
      vi.mocked(apiClient.deleteMenuItem).mockResolvedValue(true);
      window.confirm = vi.fn(() => true);
      
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByText('Delete')[0];
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(apiClient.deleteMenuItem).toHaveBeenCalledWith(1);
      });
    });

    it('should cancel delete on confirmation reject', async () => {
      window.confirm = vi.fn(() => false);
      
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByText('Delete')[0];
      fireEvent.click(deleteButton);

      expect(apiClient.deleteMenuItem).not.toHaveBeenCalled();
    });
  });

  describe('Category Management', () => {
    it('should open categories manager', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      const categoryButton = screen.getByText('Categories');
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByText('Categories')).toBeInTheDocument();
      });
    });

    it('should add new category', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.addProductCategoryWithStyle).mockResolvedValue(4);
      
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      fireEvent.click(screen.getByText('Categories'));

      await user.type(screen.getByPlaceholderText(/e\.g\. Accessories/i), 'Books');
      
      const addButton = screen.getByText('Add');
      await user.click(addButton);

      await waitFor(() => {
        expect(apiClient.addProductCategoryWithStyle).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Books' })
        );
      });
    });
  });

  describe('Stock Display', () => {
    it('should show stock quantity for tracked items', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument(); // Product 1 stock
        expect(screen.getByText('3')).toBeInTheDocument(); // Product 2 stock
      });
    });

    it('should indicate track stock status', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        const trackStockIndicators = screen.getAllByText('Yes');
        expect(trackStockIndicators.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Expand/Collapse Categories', () => {
    it('should expand all categories', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('Electronics')).toBeInTheDocument();
      });

      const expandAllButton = screen.getByText('Expand All');
      fireEvent.click(expandAllButton);

      // All categories should show their products
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeVisible();
      });
    });

    it('should collapse all categories', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      await waitFor(() => {
        expect(screen.getByText('Electronics')).toBeInTheDocument();
      });

      const collapseAllButton = screen.getByText('Collapse All');
      fireEvent.click(collapseAllButton);

      // Products should be hidden
      await waitFor(() => {
        const products = screen.queryAllByText('Test Product 1');
        // Should not be visible or have length 0
        expect(products.length).toBe(0);
      });
    });
  });

  describe('Back Navigation', () => {
    it('should call onBack when clicking back button', async () => {
      renderWithProviders(<ProductsPage onBack={mockOnBack} />);

      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      expect(mockOnBack).toHaveBeenCalled();
    });
  });
});
