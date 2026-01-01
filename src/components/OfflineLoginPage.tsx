import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import logoImage from '../assets/Logo/logo.png';
import { useAuth } from '../context/AuthContext';
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
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    async function loadSetupStatus() {
      try {
        const setup = await invoke<boolean>('check_is_setup');
        if (isMounted) setIsSetupComplete(setup);
      } catch (e) {
        console.error('[auth] check_is_setup failed', e);
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
      const username = formData.username.trim();
      const password = formData.password;
      
      if (!username || !password) {
        setError('Please enter both username and password');
        return;
      }

      const result = await login(username, password);

      if (!result.success) {
        setError(result.message);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('[auth] login submit error', err);
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
      console.error('[auth] get security question error', err);
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
      console.error('[auth] reset password error', err);
      setError('An error occurred while resetting your password');
    } finally {
      setIsLoading(false);
    }
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
    <div className="bc-auth-root">
      <div className="bc-login-split">
        <div className="bc-login-left bc-card">
          <div className="bc-login-left-inner">
            <div className="bc-login-brand">
              <img src={logoImage} alt="BizCore" className="bc-login-logo" />
              <div>
                <div className="bc-login-brandname">BizCore</div>
                <div className="bc-login-tagline">Offline business suite</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bc-login-right">
          <div className="bc-login-right-inner">
            <h2 className="bc-login-title">{showResetPassword ? 'Reset Password' : 'Sign In'}</h2>

            {!showResetPassword ? (
              <form className="bc-form" onSubmit={handleSubmit}>
                <div className="bc-alert bc-alert-info">
                  {isSetupComplete === false
                    ? 'First time using this app on this device? Use First-time setup to create the owner account.'
                    : isSetupComplete === true
                      ? 'An owner account already exists on this device. Please sign in, or use Forgot password if needed.'
                      : 'Sign in with your owner account. If setup is required, use First-time setup.'}
                </div>

                <div className="bc-field">
                  <label className="bc-label">Username</label>
                  <input
                    type="text"
                    name="username"
                    className="bc-input bc-auth-input"
                    placeholder="e.g., owner"
                    value={formData.username}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="bc-field">
                  <label className="bc-label">Password</label>
                  <input
                    type="password"
                    name="password"
                    className="bc-input bc-auth-input"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                {error && <div className="bc-alert bc-alert-error">{error}</div>}
                {success && <div className="bc-alert bc-alert-success">{success}</div>}

                <button
                  type="submit"
                  className="bc-btn bc-btn-primary bc-auth-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Authenticating…' : 'Login'}
                </button>

                <button
                  type="button"
                  className="bc-btn bc-btn-outline"
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
                    className="bc-btn bc-btn-outline"
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
              <form className="bc-form" onSubmit={handleResetPassword}>
                <div className="bc-alert bc-alert-info">
                  Use this only if you already created an owner account and forgot the password.
                </div>

                <div className="bc-card bc-reset-question">
                  <div className="bc-reset-question-label">Security Question</div>
                  <div className="bc-reset-question-text">
                    {securityQuestion || 'Load your security question first.'}
                  </div>
                </div>

                <div className="bc-field">
                  <label className="bc-label">Username</label>
                  <input
                    type="text"
                    name="username"
                    className="bc-input bc-auth-input"
                    placeholder="Enter your username"
                    value={securityData.username}
                    onChange={handleSecurityInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <button
                  type="button"
                  className="bc-btn bc-btn-outline"
                  disabled={isLoading}
                  onClick={handleFetchSecurityQuestion}
                >
                  {isLoading ? 'Loading…' : 'Load Security Question'}
                </button>

                <div className="bc-field">
                  <label className="bc-label">Your Answer</label>
                  <input
                    type="text"
                    name="securityAnswer"
                    className="bc-input bc-auth-input"
                    placeholder="Enter your answer"
                    value={securityData.securityAnswer}
                    onChange={handleSecurityInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="bc-field">
                  <label className="bc-label">New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    className="bc-input bc-auth-input"
                    placeholder="Minimum 8 characters"
                    value={securityData.newPassword}
                    onChange={handleSecurityInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="bc-field">
                  <label className="bc-label">Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmNewPassword"
                    className="bc-input bc-auth-input"
                    placeholder="Re-enter new password"
                    value={securityData.confirmNewPassword}
                    onChange={handleSecurityInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                {error && <div className="bc-alert bc-alert-error">{error}</div>}
                {success && <div className="bc-alert bc-alert-success">{success}</div>}

                <button
                  type="submit"
                  className="bc-btn bc-btn-primary bc-auth-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Resetting…' : 'Reset Password'}
                </button>

                <button
                  type="button"
                  className="bc-btn bc-btn-outline"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                >
                  ← Back to Login
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineLoginPage;
