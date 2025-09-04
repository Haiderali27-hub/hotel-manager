import React, { useState } from 'react';
import logoImage from '../assets/Logo/logo.png';
import { useAuth } from '../context/SimpleAuthContext';
import '../styles/LoginPage.css';

interface LoginFormData {
  username: string;
  password: string;
}

interface PasswordResetData {
  username: string;
  securityAnswer: string;
  newPassword: string;
  confirmPassword: string;
}

const OfflineLoginPage: React.FC = () => {
  const { 
    login, 
    getSecurityQuestion, 
    resetPassword 
  } = useAuth();

  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  
  const [resetData, setResetData] = useState<PasswordResetData>({
    username: '',
    securityAnswer: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleResetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setResetData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!formData.username || !formData.password) {
        setError('Please enter both username and password');
        return;
      }

      const result = await login({
        username: formData.username,
        password: formData.password
      });

      if (!result.success) {
        setError(result.message);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.username) {
      setError('Please enter your username first');
      return;
    }

    setIsLoading(true);
    try {
      const result = await getSecurityQuestion(formData.username);
      if (result.success && result.question) {
        setSecurityQuestion(result.question);
        setShowResetPassword(true);
        setError('');
        setResetData(prev => ({ ...prev, username: formData.username }));
      } else {
        setError(result.message || 'Unable to retrieve security question');
      }
    } catch (err) {
      setError('Error retrieving security question');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!resetData.securityAnswer || !resetData.newPassword || !resetData.confirmPassword) {
        setError('Please fill in all fields');
        return;
      }

      if (resetData.newPassword !== resetData.confirmPassword) {
        setError('New passwords do not match');
        return;
      }

      if (resetData.newPassword.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      const result = await resetPassword(
        resetData.username,
        resetData.securityAnswer,
        resetData.newPassword
      );

      if (result.success) {
        setSuccess('Password reset successful! You can now login with your new password.');
        setShowResetPassword(false);
        setResetData({
          username: '',
          securityAnswer: '',
          newPassword: '',
          confirmPassword: '',
        });
        setSecurityQuestion('');
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('An error occurred while resetting password');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToLogin = () => {
    setShowResetPassword(false);
    setError('');
    setSuccess('');
    setSecurityQuestion('');
    setResetData({
      username: '',
      securityAnswer: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-card">
          <div className="login-header">
            <div className="hotel-logo">
              <img src={logoImage} alt="Yasin Heaven Star Hotel" className="logo-image" />
              <h1>Yasin Heaven Star Hotel</h1>
            </div>
            <p className="login-subtitle">
              {showResetPassword ? 'Reset Your Password' : 'Secure Admin Access'}
            </p>
          </div>

          {!showResetPassword ? (
            // Login Form
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username" className="form-label">Username</label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    className="form-input"
                    placeholder="Enter admin username"
                    value={formData.username}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    className="form-input"
                    placeholder="Enter admin password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}

              {success && (
                <div className="success-message">
                  <span className="success-icon">✅</span>
                  {success}
                </div>
              )}

              <button
                type="submit"
                className={`login-button ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="loading-spinner">
                    <div className="spinner"></div>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  'Login to Hotel Manager'
                )}
              </button>

              <div className="login-links">
                <button
                  type="button"
                  className="link-button"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          ) : (
            // Password Reset Form
            <form className="login-form" onSubmit={handlePasswordReset}>
              <div className="security-question">
                <strong>Security Question:</strong>
                <p>{securityQuestion}</p>
              </div>

              <div className="form-group">
                <label htmlFor="securityAnswer" className="form-label">Your Answer</label>
                <div className="input-wrapper">
                  <span className="input-icon">💭</span>
                  <input
                    type="text"
                    id="securityAnswer"
                    name="securityAnswer"
                    className="form-input"
                    placeholder="Enter your answer"
                    value={resetData.securityAnswer}
                    onChange={handleResetInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="newPassword" className="form-label">New Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔑</span>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    className="form-input"
                    placeholder="Enter new password (min 6 characters)"
                    value={resetData.newPassword}
                    onChange={handleResetInputChange}
                    disabled={isLoading}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔑</span>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className="form-input"
                    placeholder="Confirm new password"
                    value={resetData.confirmPassword}
                    onChange={handleResetInputChange}
                    disabled={isLoading}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}

              {success && (
                <div className="success-message">
                  <span className="success-icon">✅</span>
                  {success}
                </div>
              )}

              <button
                type="submit"
                className={`login-button ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="loading-spinner">
                    <div className="spinner"></div>
                    <span>Resetting Password...</span>
                  </div>
                ) : (
                  'Reset Password'
                )}
              </button>

              <div className="login-links">
                <button
                  type="button"
                  className="link-button"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          )}

          <div className="login-footer">
            <div className="security-note">
              <span className="security-icon">🔒</span>
              <span>Offline Secure Authentication</span>
            </div>
            
            <div className="default-credentials">
              <small>Default Admin Credentials:</small>
              <small><strong>Username:</strong> admin</small>
              <small><strong>Password:</strong> admin123</small>
              <small><strong>Security Answer:</strong> Hilton</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineLoginPage;
