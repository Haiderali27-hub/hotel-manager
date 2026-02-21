import {
  addResource,
  getResources,
  addCustomer,
  getActiveCustomers,
  addSale,
  getSales,
  markOrderPaid,
  type NewResource,
  type Resource,
  type NewCustomer,
  type ActiveCustomerRow,
  type NewSale,
  type SaleSummary,
} from '../client';

export type {
  NewResource,
  Resource,
  NewCustomer,
  ActiveCustomerRow,
  NewSale,
  SaleSummary,
};

export const cafeService = {
  addResource,
  getResources,
  addCustomer,
  getActiveCustomers,
  addSale,
  getSales,
  markSalePaid: markOrderPaid,
};
