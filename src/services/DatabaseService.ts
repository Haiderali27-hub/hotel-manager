import { invoke } from '@tauri-apps/api/core';

// Type definitions
export interface DashboardStats {
  totalGuests: number;
  activeGuests: number;
  totalIncome: number;
  totalExpenses: number;
  profitLoss: number;
  totalFoodOrders: number;
  currency: string;
}

export interface Guest {
  id?: number;
  name: string;
  email?: string;
  phone?: string;
  room: number;
  checkin_date: string;
  checkout_date?: string;
  total_amount?: number;
  paid_amount?: number;
  status: string;
}

export interface FoodOrder {
  id?: number;
  guest_id?: number;
  room_number: number;
  items: string;
  total_amount: number;
  status: string;
  order_date: string;
}

export interface Revenue {
  id?: number;
  source: string;
  description: string;
  amount: number;
  revenue_date: string;
  guest_id?: number;
}

export interface Expense {
  id?: number;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_method?: string;
}

export interface AuthResult {
  success: boolean;
  requiresOTP?: boolean;
  currentOTP?: string;
  message?: string;
}

// Database service for local SQLite operations
class DatabaseService {
  // Get dashboard statistics
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      const stats = await invoke('get_dashboard_stats');
      return stats as DashboardStats;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw new Error('Failed to fetch dashboard statistics');
    }
  }

  // Guest management
  static async getAllGuests(): Promise<Guest[]> {
    try {
      const guests = await invoke('get_all_guests');
      return guests as Guest[];
    } catch (error) {
      console.error('Error fetching guests:', error);
      throw new Error('Failed to fetch guests');
    }
  }

  static async addGuest(guestData: Guest): Promise<string> {
    try {
      const result = await invoke('add_guest', { guestData });
      return result as string;
    } catch (error) {
      console.error('Error adding guest:', error);
      throw new Error('Failed to add guest');
    }
  }

  static async updateGuest(id: number, guestData: Guest): Promise<string> {
    try {
      const result = await invoke('update_guest', { id, guestData });
      return result as string;
    } catch (error) {
      console.error('Error updating guest:', error);
      throw new Error('Failed to update guest');
    }
  }

  static async deleteGuest(id: number): Promise<string> {
    try {
      const result = await invoke('delete_guest', { id });
      return result as string;
    } catch (error) {
      console.error('Error deleting guest:', error);
      throw new Error('Failed to delete guest');
    }
  }

  // Food orders management
  static async getAllOrders(): Promise<FoodOrder[]> {
    try {
      const orders = await invoke('get_all_orders');
      return orders as FoodOrder[];
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw new Error('Failed to fetch orders');
    }
  }

  static async addOrder(orderData: FoodOrder): Promise<string> {
    try {
      const result = await invoke('add_order', { orderData });
      return result as string;
    } catch (error) {
      console.error('Error adding order:', error);
      throw new Error('Failed to add order');
    }
  }

  // Financial management
  static async addRevenue(revenueData: Revenue): Promise<string> {
    try {
      const result = await invoke('add_revenue', { revenueData });
      return result as string;
    } catch (error) {
      console.error('Error adding revenue:', error);
      throw new Error('Failed to add revenue');
    }
  }

  static async addExpense(expenseData: Expense): Promise<string> {
    try {
      const result = await invoke('add_expense', { expenseData });
      return result as string;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw new Error('Failed to add expense');
    }
  }

  static async getFinancialSummary(): Promise<any> {
    try {
      const summary = await invoke('get_financial_summary');
      return summary;
    } catch (error) {
      console.error('Error fetching financial summary:', error);
      throw new Error('Failed to fetch financial summary');
    }
  }

  // Authentication
  static async authenticate(username: string, password: string): Promise<AuthResult> {
    try {
      const result = await invoke('authenticate_admin', { username, password });
      return result as AuthResult;
    } catch (error) {
      console.error('Error authenticating:', error);
      throw new Error('Authentication failed');
    }
  }

  static async verifyOTP(username: string, otp: string): Promise<AuthResult> {
    try {
      const result = await invoke('verify_otp', { username, otp });
      return result as AuthResult;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw new Error('OTP verification failed');
    }
  }
}

export default DatabaseService;
