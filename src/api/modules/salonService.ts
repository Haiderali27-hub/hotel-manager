import {
    addCustomer,
    addExpense,
    checkoutCustomer,
    getActiveCustomers,
    getCustomer,
    getCustomers,
    getExpenses,
    getExpensesByDateRange,
    updateCustomer,
    type ActiveCustomerRow,
    type Customer,
    type ExpenseRecord,
    type NewCustomer,
    type NewExpense,
} from '../client';

export type {
    ActiveCustomerRow, Customer, ExpenseRecord, NewCustomer, NewExpense
};

export const salonService = {
  addCustomer,
  getActiveCustomers,
  getAllCustomers: getCustomers,
  getCustomer,
  updateCustomer,
  checkoutCustomer,
  addExpense,
  getExpenses,
  getExpensesByDateRange,
};
