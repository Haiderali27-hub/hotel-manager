import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

interface LowStockItem {
  id: number;
  name: string;
  stock_quantity: number;
  low_stock_limit: number;
}

const LowStockAlert: React.FC = () => {
  const { theme, colors } = useTheme();
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLowStockItems = async () => {
    try {
      const items: LowStockItem[] = await invoke('get_low_stock_items');
      setLowStockItems(items);
    } catch (error) {
      console.error('Failed to fetch low stock items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStockItems();
    // Refresh every 5 minutes
    const interval = setInterval(fetchLowStockItems, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return null; // Don't show while loading
  }

  if (lowStockItems.length === 0) {
    return null; // No low stock items to display
  }

  const isDark = theme === 'dark';

  return (
    <div
      style={{
        background: isDark ? colors.surface : '#fff3cd',
        border: `2px solid ${isDark ? '#ffc107' : '#ffeaa7'}`,
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem',
        boxShadow: isDark 
          ? '0 4px 6px rgba(255, 193, 7, 0.1)' 
          : '0 4px 6px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>⚠️</span>
        <h3
          style={{
            margin: 0,
            fontSize: '1.1rem',
            color: isDark ? '#ffc107' : '#856404',
            fontWeight: '600',
          }}
        >
          Low Stock Alert
        </h3>
        <span
          style={{
            marginLeft: 'auto',
            background: isDark ? '#dc3545' : '#e74c3c',
            color: '#fff',
            padding: '0.25rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
          }}
        >
          {lowStockItems.length}
        </span>
      </div>

      <div style={{ fontSize: '0.95rem', color: isDark ? colors.text : '#856404' }}>
        The following items are running low on stock:
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        {lowStockItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: isDark ? 'rgba(255, 193, 7, 0.1)' : '#fffaed',
              border: `1px solid ${isDark ? 'rgba(255, 193, 7, 0.3)' : '#ffe8a1'}`,
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: '600',
                  color: isDark ? colors.text : '#333',
                  marginBottom: '0.25rem',
                }}
              >
                {item.name}
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#666',
                }}
              >
                Minimum required: {item.low_stock_limit}
              </div>
            </div>
            <div
              style={{
                background:
                  item.stock_quantity === 0
                    ? '#dc3545'
                    : item.stock_quantity <= item.low_stock_limit / 2
                    ? '#fd7e14'
                    : '#ffc107',
                color: '#fff',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                fontWeight: 'bold',
                minWidth: '60px',
                textAlign: 'center',
              }}
            >
              {item.stock_quantity === 0 ? 'OUT' : `${item.stock_quantity} left`}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: `1px solid ${isDark ? 'rgba(255, 193, 7, 0.3)' : '#ffe8a1'}`,
          fontSize: '0.85rem',
          color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#856404',
          fontStyle: 'italic',
        }}
      >
        💡 Tip: Restock these items soon to avoid running out during sales.
      </div>
    </div>
  );
};

export default LowStockAlert;
