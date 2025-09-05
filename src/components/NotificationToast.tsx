import React from 'react';
import type { Notification } from '../context/NotificationContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

const NotificationToast: React.FC = () => {
  const { notifications, removeNotification } = useNotification();
  const { colors } = useTheme();

  const getIconForType = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return 'ℹ️';
    }
  };

  const getBorderColorForType = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '#059669'; // green-600
      case 'error':
        return '#dc2626'; // red-600
      case 'warning':
        return '#d97706'; // amber-600
      case 'info':
        return '#2563eb'; // blue-600
      default:
        return colors.primary;
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px',
      }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          style={{
            backgroundColor: colors.surface,
            border: `2px solid ${getBorderColorForType(notification.type)}`,
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            minWidth: '300px',
            animation: 'slideIn 0.3s ease-out',
            cursor: 'pointer',
          }}
          onClick={() => removeNotification(notification.id)}
        >
          <div
            style={{
              fontSize: '20px',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            {getIconForType(notification.type)}
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 'bold',
                color: colors.text,
                fontSize: '14px',
                marginBottom: notification.message ? '4px' : '0',
                wordBreak: 'break-word',
              }}
            >
              {notification.title}
            </div>
            
            {notification.message && (
              <div
                style={{
                  color: colors.textSecondary,
                  fontSize: '13px',
                  lineHeight: '1.4',
                  wordBreak: 'break-word',
                }}
              >
                {notification.message}
              </div>
            )}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeNotification(notification.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0',
              lineHeight: '1',
              flexShrink: 0,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = colors.text;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = colors.textSecondary;
            }}
          >
            ×
          </button>
        </div>
      ))}
      
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default NotificationToast;
