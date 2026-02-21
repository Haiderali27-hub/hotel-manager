import React, { useState } from 'react';
import logoImage from '../assets/Logo/logo.png';
import { useAuth } from '../context/AuthContextTemp';
import '../styles/LoginPage.css';

interface LoginFormData {
  username: string;
  password: string;
  otp: string;
}

interface PasswordResetData {
  username: string;
  securityAnswer: string;
  newPassword: string;
  confirmPassword: string;
}

const EnhancedLoginPage: React.FC = () => {
  const { 
    login, 
    requiresOTP, 
    otpSent, 
    generateOTP, 
    getSecurityQuestion, 
    resetPassword 
  } = useAuth();

  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
    otp: '',
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
  const [generatedOTP, setGeneratedOTP] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleResetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setResetData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleGenerateOTP = async () => {
    if (!formData.username.trim()) {
      setError('Please enter username first');
      return;
    }

    setIsLoading(true);
    try {
      const result = await generateOTP(formData.username.trim());
      if (result.success) {
        setSuccess(result.message);
        if (result.otp) {
          setGeneratedOTP(result.otp);
          setSuccess(`OTP Generated: ${result.otp} (Valid for 5 minutes)`);
        }
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to generate OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Please fill in username and password');
      return;
    }

    if (requiresOTP && !formData.otp.trim()) {
      setError('Please enter the OTP');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await login({
        username: formData.username.trim(),
        password: formData.password,
        otp: formData.otp.trim() || undefined,
      });
      
      if (!result.success) {
        setError(result.message);
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    // Remove username requirement - use hardcoded username for this admin system
    const adminUsername = 'yasinheaven';

    setIsLoading(true);
    try {
      const result = await getSecurityQuestion(adminUsername);
      if (result.success && result.question) {
        setSecurityQuestion(result.question);
        setSuccess('Security question loaded');
        // Set the username in resetData for password reset
        setResetData(prev => ({ ...prev, username: adminUsername }));
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to load security question');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetData.username.trim() || !resetData.securityAnswer.trim() || 
        !resetData.newPassword.trim() || !resetData.confirmPassword.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (resetData.newPassword !== resetData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (resetData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword(
        resetData.username.trim(),
        resetData.securityAnswer.trim(),
        resetData.newPassword
      );
      
      if (result.success) {
        setSuccess(result.message);
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
    } catch (error) {
      setError('Failed to reset password');
    } finally {
      setIsLoading(false);
    }
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
              {showResetPassword ? 'Password Reset' : 'Admin Access Portal'}
            </p>
          </div>

          {!showResetPassword ? (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Enter your username"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Enter your password"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              {requiresOTP && (
                <div className="form-group">
                  <label htmlFor="otp" className="form-label">
                    One-Time Password (OTP)
                  </label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔐</span>
                    <input
                      type="text"
                      id="otp"
                      name="otp"
                      value={formData.otp}
                      onChange={handleInputChange}
                      className="form-input"
                      placeholder="Enter 6-digit OTP"
                      disabled={isLoading}
                      maxLength={6}
                    />
                    <button
                      type="button"
                      className="otp-button"
                      onClick={handleGenerateOTP}
                      disabled={isLoading || !formData.username.trim()}
                    >
                      {otpSent ? 'Resend' : 'Get OTP'}
                    </button>
                  </div>
                  {generatedOTP && (
                    <div className="otp-display">
                      <strong>Your OTP: {generatedOTP}</strong>
                      <small>(In production, this would be sent via SMS/Email)</small>
                    </div>
                  )}
                </div>
              )}

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
                    <span>Signing In...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="login-links">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowResetPassword(true)}
                  disabled={isLoading}
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset} className="login-form">
              <div className="form-group">
                <label htmlFor="reset-username" className="form-label">
                  Username
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    id="reset-username"
                    name="username"
                    value={resetData.username}
                    onChange={handleResetInputChange}
                    className="form-input"
                    placeholder="Enter your username"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="otp-button"
                    onClick={handleForgotPassword}
                    disabled={isLoading || !resetData.username.trim()}
                  >
                    Load Question
                  </button>
                </div>
              </div>

              {securityQuestion && (
                <>
                  <div className="security-question">
                    <strong>Security Question:</strong>
                    <p>{securityQuestion}</p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="security-answer" className="form-label">
                      Your Answer
                    </label>
                    <div className="input-wrapper">
                      <span className="input-icon">💡</span>
                      <input
                        type="text"
                        id="security-answer"
                        name="securityAnswer"
                        value={resetData.securityAnswer}
                        onChange={handleResetInputChange}
                        className="form-input"
                        placeholder="Enter your answer"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="new-password" className="form-label">
                      New Password
                    </label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔒</span>
                      <input
                        type="password"
                        id="new-password"
                        name="newPassword"
                        value={resetData.newPassword}
                        onChange={handleResetInputChange}
                        className="form-input"
                        placeholder="Enter new password"
                        disabled={isLoading}
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirm-password" className="form-label">
                      Confirm Password
                    </label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔒</span>
                      <input
                        type="password"
                        id="confirm-password"
                        name="confirmPassword"
                        value={resetData.confirmPassword}
                        onChange={handleResetInputChange}
                        className="form-input"
                        placeholder="Confirm new password"
                        disabled={isLoading}
                        minLength={6}
                      />
                    </div>
                  </div>
                </>
              )}

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
                disabled={isLoading || !securityQuestion}
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
                  onClick={() => {
                    setShowResetPassword(false);
                    setSecurityQuestion('');
                    setError('');
                    setSuccess('');
                  }}
                  disabled={isLoading}
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}

          <div className="login-footer">
            <div className="security-note">
              <span className="security-icon">🔐</span>
              <span>Offline Secure Access</span>
            </div>
            <div className="default-credentials">
              <small>Default: yasinheaven / YHSHotel@2025!</small>
              <small>Security Answer: Center Yasin</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedLoginPage;
