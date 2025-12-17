import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import logoImage from '../assets/Logo/logo.png';
import { useAuth } from '../context/SimpleAuthContext';
import '../styles/LoginPage.css';
import SetupWizard from './SetupWizard';

interface LoginFormData {
  username: string;
  password: string;
}

interface SecurityQuestionData {
  username: string;
  securityAnswer: string;
  newPassword: string;
  confirmNewPassword: string;
}

const OfflineLoginPage: React.FC = () => {
  const { 
    login,
    getSecurityQuestion,
    resetPassword
  } = useAuth();

  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  
  const [securityData, setSecurityData] = useState<SecurityQuestionData>({
    username: '',
    securityAnswer: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    async function loadSetupStatus() {
      try {
        const setup = await invoke<boolean>('check_is_setup');
        if (isMounted) setIsSetupComplete(setup);
      } catch (e) {
        console.error('Failed to check setup status (login page):', e);
        // If we can't determine setup status, keep login usable.
        if (isMounted) setIsSetupComplete(null);
      }
    }
    loadSetupStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSecurityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSecurityData(prev => ({
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

  const handleFetchSecurityQuestion = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!securityData.username.trim()) {
        setError('Please enter your username');
        return;
      }

      const result = await getSecurityQuestion(securityData.username.trim());
      if (!result.success || !result.question) {
        setError(result.message || 'Failed to retrieve security question');
        return;
      }

      setSecurityQuestion(result.question);
      setSuccess('Security question loaded.');
    } catch (err) {
      console.error('Get security question error:', err);
      setError('Failed to retrieve security question');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!securityData.username.trim()) {
        setError('Please enter your username');
        return;
      }

      if (!securityQuestion) {
        setError('Please load your security question first');
        return;
      }

      if (!securityData.securityAnswer.trim()) {
        setError('Please enter your security answer');
        return;
      }

      if (securityData.newPassword.length < 8) {
        setError('New password must be at least 8 characters');
        return;
      }

      if (securityData.newPassword !== securityData.confirmNewPassword) {
        setError('Passwords do not match');
        return;
      }

      const result = await resetPassword(
        securityData.username.trim(),
        securityData.securityAnswer.trim(),
        securityData.newPassword
      );

      if (!result.success) {
        setError(result.message || 'Password reset failed');
        return;
      }

      setSuccess('Password reset successfully. You can now log in.');
    } catch (err) {
      console.error('Reset password error:', err);
      setError('An error occurred while resetting your password');
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
    setSecurityData({
      username: '',
      securityAnswer: '',
      newPassword: '',
      confirmNewPassword: '',
    });
  };

  if (showSetupWizard) {
    return (
      <SetupWizard
        onComplete={() => {
          setShowSetupWizard(false);
          setShowResetPassword(false);
          setError('');
          setSuccess('Setup completed. You can now log in.');
          setIsSetupComplete(true);
        }}
      />
    );
  }

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-card">
          <div className="login-header">
            <div className="hotel-logo">
              <img src={logoImage} alt="Business Manager" className="logo-image" />
              <h1>Business Manager</h1>
            </div>
            <p className="login-subtitle">
              {showResetPassword ? 'Reset Your Password' : 'Secure Admin Access'}
            </p>
          </div>

          {!showResetPassword ? (
            // Login Form
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="success-message" style={{ marginBottom: '14px' }}>
                <span className="success-icon">ℹ️</span>
                {isSetupComplete === false
                  ? 'First time using this app on this device? Click First-time setup to create the admin account.'
                  : isSetupComplete === true
                    ? 'An admin account already exists on this device. Please log in, or use Forgot password if needed.'
                    : 'Log in with your admin account. If this is the first time and setup is required, use First-time setup.'}
              </div>

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
                  'Login'
                )}
              </button>

              <button
                type="button"
                className="secondary-button"
                disabled={isLoading}
                onClick={() => {
                  setShowResetPassword(true);
                  setError('');
                  setSuccess('');
                }}
              >
                Forgot password?
              </button>

              {isSetupComplete !== true && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isLoading}
                  onClick={() => {
                    setShowSetupWizard(true);
                    setError('');
                    setSuccess('');
                  }}
                >
                  First-time setup
                </button>
              )}
            </form>
          ) : (
            // Security Question Form
            <form className="login-form" onSubmit={handleResetPassword}>
              <div className="success-message" style={{ marginBottom: '14px' }}>
                <span className="success-icon">ℹ️</span>
                Use this only if you already created an admin account and forgot the password.
              </div>

              <div className="security-question">
                <strong>Security Question:</strong>
                <p>{securityQuestion || 'Load your security question first.'}</p>
              </div>

              <div className="form-group">
                <label htmlFor="resetUsername" className="form-label">Username</label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    id="resetUsername"
                    name="username"
                    className="form-input"
                    placeholder="Enter your username"
                    value={securityData.username}
                    onChange={handleSecurityInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                className={`login-button ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
                onClick={handleFetchSecurityQuestion}
              >
                {isLoading ? 'Loading...' : 'Load Security Question'}
              </button>

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
                    value={securityData.securityAnswer}
                    onChange={handleSecurityInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="newPassword" className="form-label">New Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    className="form-input"
                    placeholder="Minimum 8 characters"
                    value={securityData.newPassword}
                    onChange={handleSecurityInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmNewPassword" className="form-label">Confirm New Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    type="password"
                    id="confirmNewPassword"
                    name="confirmNewPassword"
                    className="form-input"
                    placeholder="Re-enter new password"
                    value={securityData.confirmNewPassword}
                    onChange={handleSecurityInputChange}
                    disabled={isLoading}
                    required
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
                    <span>Resetting...</span>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineLoginPage;
