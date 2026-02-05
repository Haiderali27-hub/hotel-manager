import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    addCustomer,
    addSale,
    addSalePayment,
    buildKitchenTicketHtml,
    buildOrderReceiptHtml,
    getActiveCustomers,
    getBarcodeEnabled,
    getMenuItems,
    type ActiveCustomerRow,
    type KitchenTicket,
    type KitchenTicketItem,
    type MenuItem,
    type NewCustomer,
    type NewSale,
    type OrderItem
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface AddSaleProps {
  onBack: () => void;
  onSaleAdded: () => void;
}

interface OrderItemWithDetails extends OrderItem {
  menu_item: MenuItem;
  total_price: number;
}

type PosDraft = {
  sourceSaleId?: number;
  createdAt?: string;
  items: Array<{ menu_item_id: number; quantity: number; unit_price: number; item_name: string }>;
};

const AddSale: React.FC<AddSaleProps> = ({ onBack, onSaleAdded }) => {
  const { colors, theme } = useTheme();
  const { showSuccess, showError, showWarning } = useNotification();
  const { formatMoney } = useCurrency();
  const { flags, current: label } = useLabels();
  const [customerType, setCustomerType] = useState<'active' | 'walkin'>('walkin');
  const [selectedGuestId, setSelectedGuestId] = useState<number>(0);
  const [walkinCustomerName, setWalkinCustomerName] = useState('');
  const [activeGuests, setActiveGuests] = useState<ActiveCustomerRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemWithDetails[]>([]);
  const [kitchenNotes, setKitchenNotes] = useState<Record<number, string>>({});
  const [kitchenSentQty, setKitchenSentQty] = useState<Record<number, number>>({});
  const [retailQuery, setRetailQuery] = useState('');
  const retailSearchRef = useRef<HTMLInputElement | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [showAllBrowse, setShowAllBrowse] = useState(false);
  const [heldCarts, setHeldCarts] = useState<
    Array<{
      id: string;
      createdAt: string;
      orderItems: OrderItemWithDetails[];
      selectedGuestId: number;
      customerType: 'active' | 'walkin';
      walkinCustomerName: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeEnabled, setBarcodeEnabled] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPhone, setQuickAddPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [paymentMode, setPaymentMode] = useState<'pay_now' | 'pay_later' | 'pay_partial'>('pay_now');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | 'bank'>('cash');
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [lastPaymentSummary, setLastPaymentSummary] = useState<{
    total_amount: number;
    amount_paid: number;
    balance_due: number;
  } | null>(null);

  const isRetail = flags.retailQuickScan;
  const isKitchenMode = flags.restaurantKitchen;
  const posTitle = isRetail ? 'POS' : isKitchenMode ? 'Orders' : 'Sales';

  const handleSendToKitchen = async () => {
    if (!isKitchenMode) return;
    if (orderItems.length === 0) return;

    const deltaById: Array<{ id: number; item: KitchenTicketItem }> = [];
    for (const oi of orderItems) {
      const sent = kitchenSentQty[oi.menu_item_id] ?? 0;
      const delta = Math.max(0, oi.quantity - sent);
      if (delta <= 0) continue;
      const notes = (kitchenNotes[oi.menu_item_id] ?? '').trim();
      deltaById.push({
        id: oi.menu_item_id,
        item: {
          name: oi.menu_item.name,
          quantity: delta,
          ...(notes ? { notes } : {}),
        },
      });
    }

    const deltaItems = deltaById.map((x) => x.item);

    if (deltaItems.length === 0) {
      showWarning('Nothing to Send', 'All current items have already been sent to the kitchen.');
      return;
    }

    const ticket: KitchenTicket = {
      created_at: new Date().toLocaleString(),
      items: deltaItems,
    };

    try {
      const html = await buildKitchenTicketHtml(ticket);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showWarning('Print Window Blocked', 'Please allow popups to print kitchen tickets');
        return;
      }

      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      setKitchenSentQty((prev) => {
        const next = { ...prev };
        for (const { id, item } of deltaById) {
          next[id] = (next[id] ?? 0) + item.quantity;
        }
        return next;
      });

      showSuccess('Sent to Kitchen', `Sent ${deltaItems.length} item(s) to the kitchen.`);
    } catch (err) {
      console.error('Failed to send to kitchen:', err);
      showError('Kitchen Ticket Failed', 'Failed to generate kitchen ticket');
    }
  };

  // Load held carts from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bm_held_carts');
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      setHeldCarts(parsed as typeof heldCarts);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('bm_held_carts', JSON.stringify(heldCarts));
    } catch {
      // ignore
    }
  }, [heldCarts]);

  // Retail: keep scanner/search focused
  useEffect(() => {
    if (!isRetail) return;
    const focus = () => retailSearchRef.current?.focus();
    focus();

    const onWindowFocus = () => focus();
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const isTypingField = tag === 'input' || tag === 'textarea' || (t as HTMLElement | null)?.isContentEditable;
      if (!isTypingField) focus();
    };

    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isRetail]);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [guests, menu] = await Promise.all([
          getActiveCustomers(),
          getMenuItems()
        ]);
        setActiveGuests(guests);
        const availableMenu = menu.filter(item => item.is_available);
        setMenuItems(availableMenu);

        // Load draft cart from history duplicate flow (best-effort).
        try {
          const raw = localStorage.getItem('bm_pos_draft');
          if (raw) {
            const draft = JSON.parse(raw) as PosDraft;
            if (draft && Array.isArray(draft.items) && draft.items.length > 0) {
              const toOrder: OrderItemWithDetails[] = draft.items
                .map((it) => {
                  const menuItem = availableMenu.find((m) => m.id === it.menu_item_id);
                  if (!menuItem) return null;
                  const qty = Math.max(1, Number(it.quantity) || 1);
                  const unit = Number.isFinite(it.unit_price) ? it.unit_price : menuItem.price;
                  return {
                    menu_item_id: it.menu_item_id,
                    quantity: qty,
                    unit_price: unit,
                    item_name: it.item_name || menuItem.name,
                    menu_item: menuItem,
                    total_price: qty * unit,
                  };
                })
                .filter(Boolean) as OrderItemWithDetails[];

              if (toOrder.length > 0) {
                setOrderItems(toOrder);
                setCustomerType('walkin');
                setSelectedGuestId(0);
                showSuccess('Draft Loaded', 'Loaded items from previous sale. You can adjust and checkout again.');
              }
            }
            localStorage.removeItem('bm_pos_draft');
          }
        } catch {
          // Ignore malformed drafts.
          try {
            localStorage.removeItem('bm_pos_draft');
          } catch {
            // ignore
          }
        }

        setError(null); // Clear any previous errors
      } catch (err) {
        console.error('Failed to load data:', err);
        const errorMessage = 'Failed to load guests and menu items';
        setError(errorMessage);
        showError('Load Error', errorMessage);
      }
    };

    void loadData();
  }, [showSuccess, showError]);

  const handleQuickAddCustomer = async () => {
    const name = quickAddName.trim();
    const phone = quickAddPhone.trim();

    if (!name) {
      showError('Validation', 'Customer name is required');
      return;
    }

    try {
      const newCustomer: NewCustomer = {
        name,
        phone: phone || undefined,
        check_in: new Date().toISOString().split('T')[0],
        daily_rate: 0,
      };
      const customerId = await addCustomer(newCustomer);
      
      // Reload customers
      const guests = await getActiveCustomers();
      setActiveGuests(guests);
      
      // Auto-select the new customer
      setSelectedGuestId(customerId);
      setCustomerType('active');
      
      // Close modal and reset
      setShowQuickAddCustomer(false);
      setQuickAddName('');
      setQuickAddPhone('');
      
      showSuccess('Customer Added', `${name} has been added`);
    } catch (e) {
      showError('Add Customer Failed', e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    const loadBarcodeSetting = async () => {
      try {
        const enabled = await getBarcodeEnabled();
        setBarcodeEnabled(!!enabled);
      } catch {
        setBarcodeEnabled(false);
      }
    };
    void loadBarcodeSetting();
  }, []);

  const retailMatches = useMemo(() => {
    if (!isRetail) return [] as MenuItem[];
    const q = retailQuery.trim().toLowerCase();
    if (!q) return [];
    return menuItems
      .filter((i) => i.is_available)
      .filter((i) => {
        const extra = barcodeEnabled ? ` ${i.sku ?? ''} ${i.barcode ?? ''}` : '';
        const hay = `${i.name} ${i.category} ${i.description ?? ''}${extra}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 30);
  }, [barcodeEnabled, isRetail, menuItems, retailQuery]);

  const retailHasQuery = isRetail && retailQuery.trim().length > 0;

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of menuItems) {
      const name = (item.category || 'General').trim() || 'General';
      set.add(name);
    }
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [menuItems]);

  const categoryStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of menuItems) {
      if (!item.is_available) continue;
      const name = (item.category || 'General').trim() || 'General';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [menuItems]);

  const browseItems = useMemo(() => {
    let items = menuItems.filter((i) => i.is_available);
    if (categoryFilter !== 'All') {
      items = items.filter((i) => (i.category || '').trim() === categoryFilter);
    }

    if (!isRetail) {
      const q = productSearch.trim().toLowerCase();
      if (q) {
        items = items.filter((i) => {
          const hay = `${i.name} ${i.category} ${i.description ?? ''}`.toLowerCase();
          return hay.includes(q);
        });
      }
    }

    return items;
  }, [menuItems, categoryFilter, isRetail, productSearch]);

  const leftItems = useMemo(() => {
    if (isRetail) {
      if (retailHasQuery) return retailMatches;
      if (categoryFilter === 'All') return [] as MenuItem[]; // category-first
      return browseItems;
    }

    // Non-retail: if no search and All categories, default to category-first.
    const q = productSearch.trim();
    if (!q && categoryFilter === 'All') return [] as MenuItem[];
    return browseItems;
  }, [browseItems, categoryFilter, isRetail, productSearch, retailHasQuery, retailMatches]);

  const cappedLeftItems = useMemo(() => {
    if (showAllBrowse) return leftItems;
    return leftItems.slice(0, 36);
  }, [leftItems, showAllBrowse]);

  useEffect(() => {
    // Reset browse cap when changing filters.
    setShowAllBrowse(false);
  }, [categoryFilter, productSearch]);

  const tryRetailAddByQuery = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return;

    const exact = menuItems.find((i) => {
      if (!i.is_available) return false;
      const name = i.name.trim().toLowerCase();
      if (!barcodeEnabled) return name === q;
      const sku = (i.sku ?? '').trim().toLowerCase();
      const barcode = (i.barcode ?? '').trim().toLowerCase();
      return name === q || (!!sku && sku === q) || (!!barcode && barcode === q);
    });
    const best = exact ?? retailMatches[0];
    if (!best) {
      showWarning('Not Found', `No matching item for "${query.trim()}"`);
      return;
    }
    addItemToOrder(best.id, 1);
    setRetailQuery('');
  };

  const addItemToOrder = (menuItemId: number, qty: number) => {
    if (!menuItemId || qty <= 0) {
      const errorMessage = 'Please select a product and enter valid quantity';
      setError(errorMessage);
      showWarning('Invalid Selection', errorMessage);
      return;
    }

    const menuItem = menuItems.find(item => item.id === menuItemId);
    if (!menuItem) {
      const errorMessage = 'Selected menu item not found';
      setError(errorMessage);
      showError('Item Not Found', errorMessage);
      return;
    }

    // Check if item already exists in order
    const existingItemIndex = orderItems.findIndex(
      item => item.menu_item_id === menuItemId
    );

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += qty;
      updatedItems[existingItemIndex].total_price = 
        updatedItems[existingItemIndex].quantity * menuItem.price;
      setOrderItems(updatedItems);
      showSuccess('Item Updated', `${menuItem.name} quantity updated to ${updatedItems[existingItemIndex].quantity}`);
    } else {
      // Add new item
      const newOrderItem: OrderItemWithDetails = {
          menu_item_id: menuItemId,
          quantity: qty,
          unit_price: menuItem.price,
          menu_item: menuItem,
          total_price: qty * menuItem.price,
          item_name: ''
      };
      setOrderItems([...orderItems, newOrderItem]);
      showSuccess('Item Added', `${qty}x ${menuItem.name} added to order`);
    }
    setError(null);
  };

  const handleIncreaseQty = (index: number) => {
    const updated = [...orderItems];
    updated[index].quantity += 1;
    updated[index].total_price = updated[index].quantity * updated[index].unit_price;
    setOrderItems(updated);
  };

  const handleIncreaseQtyBy = (index: number, amount: number) => {
    const updated = [...orderItems];
    updated[index].quantity = Math.max(1, updated[index].quantity + amount);
    updated[index].total_price = updated[index].quantity * updated[index].unit_price;
    setOrderItems(updated);
  };

  const handleDecreaseQty = (index: number) => {
    const updated = [...orderItems];
    updated[index].quantity = Math.max(1, updated[index].quantity - 1);
    updated[index].total_price = updated[index].quantity * updated[index].unit_price;
    setOrderItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const removed = orderItems[index];
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
    if (removed) {
      setKitchenNotes((prev) => {
        const next = { ...prev };
        delete next[removed.menu_item_id];
        return next;
      });
      setKitchenSentQty((prev) => {
        const next = { ...prev };
        delete next[removed.menu_item_id];
        return next;
      });
    }
  };

  const getTotalAmount = () => {
    return orderItems.reduce((total, item) => total + item.total_price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate
      const effectiveGuestId: number | null = selectedGuestId > 0 ? selectedGuestId : null;
      if (orderItems.length === 0) {
        throw new Error('Please add at least one item to the order');
      }

      // Use null when no customer is selected.
      const guestId: number | null = effectiveGuestId;

      const newOrder: NewSale = {
        guest_id: guestId,
        items: orderItems.map(item => ({
          menu_item_id: item.menu_item_id,
          item_name: item.menu_item.name,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      };

      const totalAmount = getTotalAmount();

      const orderId = await addSale(newOrder);
      console.log('✅ Sale added successfully:', orderId);

      // Apply payment choice (pay-now / pay-later / partial)
      try {
        if (paymentMode === 'pay_now') {
          const summary = await addSalePayment(orderId, totalAmount, paymentMethod, 'Initial payment');
          setPaymentStatus(summary.paid ? 'paid' : 'unpaid');
          setLastPaymentSummary({
            total_amount: summary.total_amount,
            amount_paid: summary.amount_paid,
            balance_due: summary.balance_due,
          });
        } else if (paymentMode === 'pay_partial') {
          if (!Number.isFinite(partialAmount) || partialAmount <= 0) {
            throw new Error('Partial payment must be greater than 0');
          }
          if (partialAmount > totalAmount) {
            throw new Error('Partial payment cannot exceed total amount');
          }
          const summary = await addSalePayment(orderId, partialAmount, paymentMethod, 'Partial payment');
          setPaymentStatus(summary.paid ? 'paid' : 'unpaid');
          setLastPaymentSummary({
            total_amount: summary.total_amount,
            amount_paid: summary.amount_paid,
            balance_due: summary.balance_due,
          });
        } else {
          // pay_later
          setPaymentStatus('unpaid');
          setLastPaymentSummary({
            total_amount: totalAmount,
            amount_paid: 0,
            balance_due: totalAmount,
          });
        }
      } catch (err) {
        // Don't fail sale creation if payment recording fails; surface clear message.
        console.error('❌ Failed to record payment:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to record payment';
        showWarning('Sale Created, Payment Not Saved', errorMessage);
        setPaymentStatus('unpaid');
        setLastPaymentSummary({
          total_amount: totalAmount,
          amount_paid: 0,
          balance_due: totalAmount,
        });
      }
      
      const effectiveCustomerInfo = guestId
        ? activeGuests.find((g) => g.guest_id === guestId)?.name || label.client
        : (walkinCustomerName || `Quick Sale (No ${label.client})`);
      
      showSuccess(
        'Sale Created!',
        `Sale #${orderId} has been created for ${effectiveCustomerInfo} (Total: ${formatMoney(totalAmount)})`
      );
      
      setLastOrderId(orderId);
      setShowSuccessModal(true);
      
      // Reset form
      setOrderItems([]);
      setKitchenNotes({});
      setKitchenSentQty({});
      setSelectedGuestId(0);
      setWalkinCustomerName('');
      setCustomerType('walkin');
      setPaymentMode('pay_now');
      setPaymentMethod('cash');
      setPartialAmount(0);

      onSaleAdded();
    } catch (err) {
      console.error('❌ Failed to add sale:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add sale';
      setError(errorMessage);
      showError('Failed to Create Sale', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!lastOrderId) return;
    
    try {
      const receiptHtml = await buildOrderReceiptHtml(lastOrderId);
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        showSuccess('Receipt Printed', `Receipt for order #${lastOrderId} has been sent to printer`);
      } else {
        showWarning('Print Window Blocked', 'Please allow popups to print receipts');
      }
    } catch (err) {
      console.error('Failed to print receipt:', err);
      const errorMessage = 'Failed to generate receipt';
      setError(errorMessage);
      showError('Print Failed', errorMessage);
    }
  };

  const holdCart = () => {
    if (!isRetail) return;
    if (orderItems.length === 0) return;

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const snapshot = {
      id,
      createdAt: new Date().toISOString(),
      orderItems,
      selectedGuestId,
      customerType,
      walkinCustomerName,
    };
    setHeldCarts((prev) => [snapshot, ...prev].slice(0, 8));

    setOrderItems([]);
    setSelectedGuestId(0);
    setWalkinCustomerName('');
    setCustomerType('walkin');
    showSuccess('Cart Held', 'Order parked. You can resume it later.');
  };

  const resumeHeldCart = (id: string) => {
    const found = heldCarts.find((c) => c.id === id);
    if (!found) return;
    setOrderItems(found.orderItems);
    setSelectedGuestId(found.selectedGuestId);
    setCustomerType(found.customerType);
    setWalkinCustomerName(found.walkinCustomerName);
    setHeldCarts((prev) => prev.filter((c) => c.id !== id));
    showSuccess('Cart Resumed', 'Order restored.');
    if (isRetail) retailSearchRef.current?.focus();
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setLastOrderId(null);
    setPaymentStatus('unpaid'); // Reset payment status for next order
    setLastPaymentSummary(null);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: colors.primary, color: colors.text, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button type="button" className="bc-btn bc-btn-outline" onClick={onBack} style={{ width: 'auto' }}>
          Back
        </button>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: colors.text }}>{posTitle}</div>
          <div style={{ fontSize: '14px', color: colors.textSecondary }}>Create a new sale</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {isRetail && (
          <div
            className="bc-card"
            style={{
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <input
              ref={retailSearchRef}
              value={retailQuery}
              onChange={(e) => setRetailQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  tryRetailAddByQuery(retailQuery);
                }
              }}
              className="bc-input"
              placeholder="Scan barcode or search item…"
              style={{
                fontSize: '18px',
                padding: '14px 16px',
                fontWeight: 700,
                flex: 1,
              }}
            />
            <div style={{ fontSize: '12px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
              {menuItems.length} items
            </div>
          </div>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isRetail ? '1fr 1fr' : '1fr 360px',
            gap: '16px',
            alignItems: 'start',
          }}
        >
          {/* Left: Products grid */}
          <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: colors.text }}>
                {isRetail ? (retailHasQuery ? 'Search Results' : 'Products') : 'Products'}
              </div>
              <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                {isRetail
                  ? retailHasQuery
                    ? `${retailMatches.length} shown`
                    : categoryFilter === 'All'
                      ? `${menuItems.length} items`
                      : `${browseItems.length} items`
                  : (productSearch.trim() || categoryFilter !== 'All')
                    ? `${browseItems.length} items`
                    : `${menuItems.length} items`}
              </div>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {!isRetail && (
                <input
                  className="bc-input"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products…"
                  style={{ flex: '1 1 220px', height: 40 }}
                />
              )}

              <select
                className="bc-input"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ width: 'auto', minWidth: 180, height: 40 }}
                title="Category"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {!isRetail && (productSearch.trim() || categoryFilter !== 'All') && (
                <button
                  type="button"
                  className="bc-btn bc-btn-outline"
                  onClick={() => {
                    setProductSearch('');
                    setCategoryFilter('All');
                  }}
                  style={{ width: 'auto', minHeight: 40 }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category chips */}
            {categoryStats.length > 0 && (
              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                }}
              >
                {categoryStats.slice(0, 14).map((c) => {
                  const active = categoryFilter === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      className={active ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'}
                      onClick={() => setCategoryFilter(c.name)}
                      style={{ width: 'auto', minHeight: 36, padding: '0 10px', whiteSpace: 'nowrap' }}
                      title={c.name}
                    >
                      {c.name} ({c.count})
                    </button>
                  );
                })}

                {categoryFilter !== 'All' && (
                  <button
                    type="button"
                    className="bc-btn bc-btn-outline"
                    onClick={() => setCategoryFilter('All')}
                    style={{ width: 'auto', minHeight: 36, padding: '0 10px', whiteSpace: 'nowrap' }}
                  >
                    All
                  </button>
                )}
              </div>
            )}

            <div
              style={{
                marginTop: '12px',
                display: 'grid',
                gridTemplateColumns: isRetail ? 'repeat(auto-fit, minmax(240px, 1fr))' : 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px',
                maxHeight: isRetail ? '420px' : '560px',
                overflowY: 'auto',
              }}
            >
              {/* Category-first empty state */}
              {leftItems.length === 0 && !retailHasQuery ? (
                <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
                  {isRetail
                    ? 'Pick a category above, or scan/search to add items.'
                    : 'Pick a category above, or search to find products.'}
                </div>
              ) : null}

              {cappedLeftItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="bc-btn bc-btn-outline"
                  onClick={() => addItemToOrder(item.id, 1)}
                  style={{
                    textAlign: 'left',
                    padding: '12px',
                    borderRadius: '10px',
                    display: 'block',
                  }}
                >
                  <div style={{ fontWeight: 800, color: colors.text, fontSize: '14px' }}>{item.name}</div>
                  <div style={{ marginTop: '4px', color: colors.textSecondary, fontSize: '12px' }}>
                    {formatMoney(item.price)}
                  </div>
                </button>
              ))}
            </div>

            {leftItems.length > 36 && !showAllBrowse && (
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="bc-btn bc-btn-outline"
                  onClick={() => setShowAllBrowse(true)}
                  style={{ width: 'auto', minHeight: 40 }}
                >
                  Show more ({leftItems.length - 36} more)
                </button>
              </div>
            )}

            {isRetail && retailHasQuery && retailMatches.length === 0 && (
              <div style={{ marginTop: '12px', fontSize: '12px', color: colors.textSecondary }}>
                No matches. Press Enter to clear and continue scanning.
              </div>
            )}
          </div>

          {/* Right: Cart */}
          <div className="bc-card" style={{ borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: colors.text }}>Cart</div>

            {isRetail && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="bc-btn bc-btn-outline"
                  onClick={holdCart}
                  disabled={orderItems.length === 0}
                  style={{ width: 'auto' }}
                >
                  Hold Cart
                </button>
                {heldCarts.length > 0 ? (
                  <select
                    className="bc-input"
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      resumeHeldCart(id);
                    }}
                    style={{ height: 40 }}
                  >
                    <option value="">Resume held…</option>
                    {heldCarts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {new Date(c.createdAt).toLocaleTimeString()} — {c.orderItems.length} items
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '12px', color: colors.textSecondary }}>No held carts</div>
                )}
              </div>
            )}

            {/* Customer */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{label.client} (Optional)</span>
                <button
                  type="button"
                  onClick={() => setShowQuickAddCustomer(true)}
                  className="bc-btn bc-btn-primary"
                  style={{ width: 'auto', fontSize: '11px', padding: '4px 8px' }}
                >
                  + Quick Add
                </button>
              </div>

              {activeGuests.length > 0 ? (
                <select
                  value={selectedGuestId}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSelectedGuestId(val);
                    if (val === 0) {
                      setCustomerType('walkin');
                    } else {
                      setCustomerType('active');
                    }
                  }}
                  className="bc-input"
                >
                  <option value={0}>Quick Sale (No {label.client})</option>
                  <optgroup label={`Active ${label.client}s`}>
                    {activeGuests.map((guest) => (
                      <option key={guest.guest_id} value={guest.guest_id}>
                        {guest.name} {guest.room_number ? `- ${label.unit} ${guest.room_number}` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
              ) : (
                <input
                  type="text"
                  value={walkinCustomerName}
                  onChange={(e) => setWalkinCustomerName(e.target.value)}
                  placeholder={`${label.client} name (optional)`}
                  className="bc-input"
                />
              )}
            </div>

            {/* Display selected customer name */}
            {(selectedGuestId > 0 || walkinCustomerName.trim()) && (
              <div style={{ 
                marginTop: '12px', 
                padding: '8px 12px', 
                background: colors.surface, 
                border: `1px solid ${colors.border}`,
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: 700 }}>
                  CUSTOMER
                </div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: colors.text, marginTop: '2px' }}>
                  {selectedGuestId > 0 
                    ? activeGuests.find(g => g.guest_id === selectedGuestId)?.name || 'Unknown'
                    : walkinCustomerName.trim()
                  }
                </div>
              </div>
            )}

            {/* Items */}
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '8px' }}>
                Items
              </div>

              {orderItems.length === 0 ? (
                <div style={{ fontSize: '12px', color: colors.textSecondary }}>No items yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {orderItems.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: '10px',
                        padding: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: colors.text }}>
                            {item.menu_item.name}
                          </div>
                          <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                            {formatMoney(item.unit_price)}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: colors.text }}>
                          {formatMoney(item.total_price)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="bc-btn bc-btn-outline"
                            onClick={() => handleDecreaseQty(index)}
                            style={{ width: 'auto', padding: '8px 10px' }}
                          >
                            -
                          </button>
                          <div style={{ minWidth: '28px', textAlign: 'center', fontWeight: 800, color: colors.text }}>
                            {item.quantity}
                          </div>
                          <button
                            type="button"
                            className="bc-btn bc-btn-outline"
                            onClick={() => handleIncreaseQty(index)}
                            style={{ width: 'auto', padding: '8px 10px' }}
                          >
                            +
                          </button>

                          {isRetail && (
                            <>
                              <button
                                type="button"
                                className="bc-btn bc-btn-outline"
                                onClick={() => handleIncreaseQtyBy(index, 5)}
                                style={{ width: 'auto', padding: '8px 10px' }}
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                className="bc-btn bc-btn-outline"
                                onClick={() => handleIncreaseQtyBy(index, 10)}
                                style={{ width: 'auto', padding: '8px 10px' }}
                              >
                                ×10
                              </button>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          className="bc-btn bc-btn-outline"
                          onClick={() => handleRemoveItem(index)}
                          style={{ width: 'auto' }}
                        >
                          Remove
                        </button>
                      </div>

                      {isKitchenMode && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: colors.textSecondary, marginBottom: '6px' }}>
                            Kitchen notes (optional)
                          </div>
                          <textarea
                            className="bc-input"
                            rows={2}
                            value={kitchenNotes[item.menu_item_id] ?? ''}
                            onChange={(e) =>
                              setKitchenNotes((prev) => ({
                                ...prev,
                                [item.menu_item_id]: e.target.value,
                              }))
                            }
                            placeholder="e.g. no onions, extra spicy…"
                            style={{ resize: 'vertical' }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <div style={{ marginTop: '14px', borderTop: `1px solid ${colors.border}`, paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: 700 }}>Total</div>
                <div style={{ fontSize: '16px', color: colors.text, fontWeight: 900 }}>{formatMoney(getTotalAmount())}</div>
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: colors.text,
                  fontSize: '12px',
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 800, color: colors.text }}>Payment</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>Mode</div>
                  <select
                    value={paymentMode}
                    onChange={(e) => {
                      const next = e.target.value as 'pay_now' | 'pay_later' | 'pay_partial';
                      setPaymentMode(next);
                      if (next !== 'pay_partial') setPartialAmount(0);
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${colors.border}` }}
                  >
                    <option value="pay_now">Pay now</option>
                    <option value="pay_later">Pay later (credit)</option>
                    <option value="pay_partial">Partial payment</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>Method</div>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'mobile' | 'bank')}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${colors.border}` }}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile">Mobile money</option>
                    <option value="bank">Bank transfer</option>
                  </select>
                </div>
              </div>

              {paymentMode === 'pay_partial' && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>Amount to pay now</div>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={Number.isFinite(partialAmount) ? partialAmount : 0}
                    onChange={(e) => setPartialAmount(parseFloat(e.target.value || '0'))}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${colors.border}` }}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="bc-btn bc-btn-primary"
              disabled={loading || orderItems.length === 0}
              style={{ marginTop: '14px' }}
            >
              {loading ? 'Processing…' : 'Checkout'}
            </button>

            {isKitchenMode && (
              <button
                type="button"
                className="bc-btn bc-btn-outline"
                onClick={handleSendToKitchen}
                disabled={loading || orderItems.length === 0}
                style={{ marginTop: '10px' }}
              >
                Send to Kitchen
              </button>
            )}
          </div>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media (max-width: 980px) {
                .bc-pos-grid { grid-template-columns: 1fr !important; }
              }
            `,
          }}
        />
      </form>

      {/* Quick Add Customer Modal */}
      {showQuickAddCustomer && (
        <div className="bc-modal-overlay">
          <div className="bc-modal" style={{ maxWidth: '420px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: colors.text }}>Quick Add {label.client}</div>
            
            <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>
                  Name *
                </div>
                <input
                  type="text"
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  placeholder="Customer name"
                  className="bc-input"
                  autoFocus
                />
              </div>
              
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>
                  Phone (Optional)
                </div>
                <input
                  type="text"
                  value={quickAddPhone}
                  onChange={(e) => setQuickAddPhone(e.target.value)}
                  placeholder="Phone number"
                  className="bc-input"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="button" className="bc-btn bc-btn-primary" onClick={handleQuickAddCustomer}>
                Add {label.client}
              </button>
              <button
                type="button"
                className="bc-btn bc-btn-outline"
                onClick={() => {
                  setShowQuickAddCustomer(false);
                  setQuickAddName('');
                  setQuickAddPhone('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="bc-modal-overlay">
          <div className="bc-modal" style={{ maxWidth: '520px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: colors.text }}>Sale created</div>
            <div style={{ marginTop: '8px', fontSize: '13px', color: colors.textSecondary }}>
              Payment status: <strong style={{ color: colors.text }}>{paymentStatus.toUpperCase()}</strong>
            </div>

            {lastPaymentSummary && (
              <div style={{ marginTop: '8px', fontSize: '13px', color: colors.textSecondary }}>
                Total: <strong style={{ color: colors.text }}>{formatMoney(lastPaymentSummary.total_amount)}</strong>
                {'  '}Paid: <strong style={{ color: colors.text }}>{formatMoney(lastPaymentSummary.amount_paid)}</strong>
                {'  '}Balance: <strong style={{ color: colors.text }}>{formatMoney(lastPaymentSummary.balance_due)}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button type="button" className="bc-btn bc-btn-primary" onClick={handlePrintReceipt} style={{ width: 'auto' }}>
                Print Receipt
              </button>
              <button type="button" className="bc-btn bc-btn-outline" onClick={closeSuccessModal} style={{ width: 'auto' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddSale;
