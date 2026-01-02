import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';

interface User {
  id: number;
  username: string;
  role: string;
}

interface UserManagementProps {
  onBack?: () => void;
  embedded?: boolean;
}

const UserManagement: React.FC<UserManagementProps> = ({ onBack, embedded = false }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    securityQuestion: '',
    securityAnswer: ''
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const userList = await invoke<User[]>('list_users');
      setUsers(userList);
    } catch (err) {
      setError('Failed to load users: ' + err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await invoke('register_user', {
        request: {
          username: formData.username.trim(),
          password: formData.password,
          role: formData.role,
          security_question: formData.securityQuestion,
          security_answer: formData.securityAnswer
        }
      });

      setSuccess(`User ${formData.username} created successfully!`);
      setShowCreateModal(false);
      setFormData({
        username: '',
        password: '',
        confirmPassword: '',
        role: 'staff',
        securityQuestion: '',
        securityAnswer: ''
      });
      loadUsers();
    } catch (err) {
      setError('Failed to create user: ' + err);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await invoke('delete_user', { userId });
      setSuccess(`User ${username} deleted successfully`);
      loadUsers();
    } catch (err) {
      setError('Failed to delete user: ' + err);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'manager':
        return 'Manager';
      case 'staff':
        return 'Staff';
      default:
        return role;
    }
  };

  return (
    <div style={{ padding: embedded ? 0 : 24 }}>
      {embedded ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button type="button" className="bc-btn bc-btn-primary" onClick={() => setShowCreateModal(true)}>
            Add User
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--app-text)' }}>User Management</h1>
            <div style={{ marginTop: 4, fontSize: 14, color: 'var(--app-text-secondary)' }}>
              Manage users and their access levels
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {onBack ? (
              <button type="button" className="bc-btn bc-btn-outline" onClick={onBack}>
                Back
              </button>
            ) : null}
            <button type="button" className="bc-btn bc-btn-primary" onClick={() => setShowCreateModal(true)}>
              Add User
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="bc-card" style={{ borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ color: 'var(--app-text)', fontWeight: 700, marginBottom: 4 }}>Error</div>
          <div style={{ color: 'var(--app-text-secondary)', fontSize: 13 }}>{error}</div>
        </div>
      ) : null}

      {success ? (
        <div className="bc-card" style={{ borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ color: 'var(--app-text)', fontWeight: 700, marginBottom: 4 }}>Success</div>
          <div style={{ color: 'var(--app-text-secondary)', fontSize: 13 }}>{success}</div>
        </div>
      ) : null}

      <div className="bc-card" style={{ borderRadius: 10, overflow: 'hidden' }}>
        <table className="bc-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Username</th>
              <th style={{ width: 160 }}>Role</th>
              <th style={{ width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ color: 'var(--app-text-secondary)' }}>
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: 'var(--app-text-secondary)' }}>
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isLastAdmin = user.role === 'admin' && users.filter((u) => u.role === 'admin').length === 1;
                return (
                  <tr key={user.id}>
                    <td style={{ color: 'var(--app-text-secondary)', fontWeight: 700 }}>#{user.id}</td>
                    <td style={{ fontWeight: 700 }}>{user.username}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--app-border)',
                          color: 'var(--app-text-secondary)',
                          fontWeight: 800,
                          fontSize: 12,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="bc-btn bc-btn-outline"
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        disabled={isLastAdmin}
                        title={isLastAdmin ? 'Cannot delete last admin' : 'Delete user'}
                        style={{ padding: '8px 10px' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div
          className="bc-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: 16,
                borderBottom: '1px solid var(--app-border)',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>Create New User</div>
              <button type="button" className="bc-btn bc-btn-outline" onClick={() => setShowCreateModal(false)}>
                Close
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 800, fontSize: 13, color: 'var(--app-text-secondary)' }}>
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="bc-input"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 800, fontSize: 13, color: 'var(--app-text-secondary)' }}>
                  Password * (min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bc-input"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 800, fontSize: 13, color: 'var(--app-text-secondary)' }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="bc-input"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 800, fontSize: 13, color: 'var(--app-text-secondary)' }}>
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="bc-input"
                >
                  <option value="staff">Staff - Basic POS access</option>
                  <option value="manager">Manager - Reports & inventory</option>
                  <option value="admin">Admin - Full access</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 800, fontSize: 13, color: 'var(--app-text-secondary)' }}>
                  Security Question *
                </label>
                <input
                  type="text"
                  required
                  value={formData.securityQuestion}
                  onChange={(e) => setFormData({ ...formData, securityQuestion: e.target.value })}
                  placeholder="e.g., What is your favorite color?"
                  className="bc-input"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 800, fontSize: 13, color: 'var(--app-text-secondary)' }}>
                  Security Answer *
                </label>
                <input
                  type="text"
                  required
                  value={formData.securityAnswer}
                  onChange={(e) => setFormData({ ...formData, securityAnswer: e.target.value })}
                  className="bc-input"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="bc-btn bc-btn-outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="bc-btn bc-btn-primary">
                  Create User
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
