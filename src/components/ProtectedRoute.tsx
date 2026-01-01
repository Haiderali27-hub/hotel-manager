import React from 'react';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'staff';
  fallback?: React.ReactNode;
}

/**
 * ProtectedRoute - Role-based access control component
 * 
 * Roles hierarchy:
 * - admin: Full access to everything
 * - manager: Access to most features except critical settings
 * - staff: Limited access, mainly POS operations
 * 
 * Usage:
 * <ProtectedRoute requiredRole="admin">
 *   <AdminOnlyComponent />
 * </ProtectedRoute>
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole = 'staff',
  fallback 
}) => {
  const { userRole } = useAuth();

  // Role hierarchy - admin has access to everything
  const hasAccess = (): boolean => {
    if (!userRole) return false;
    
    // Admin has access to everything
    if (userRole === 'admin') return true;
    
    // Manager has access to manager and staff level features
    if (userRole === 'manager' && (requiredRole === 'manager' || requiredRole === 'staff')) {
      return true;
    }
    
    // Staff only has access to staff level features
    if (userRole === 'staff' && requiredRole === 'staff') {
      return true;
    }
    
    return false;
  };

  if (!hasAccess()) {
    return fallback ? <>{fallback}</> : (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#e74c3c',
        background: '#ffe6e6',
        borderRadius: '8px',
        margin: '1rem'
      }}>
        <h3>🔒 Access Denied</h3>
        <p>You don't have permission to view this content.</p>
        <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
          Required role: {requiredRole} | Your role: {userRole || 'unknown'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
