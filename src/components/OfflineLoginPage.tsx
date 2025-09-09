import React, { useState } from 'react';
import logoImage from '../assets/Logo/logo.png';
import { useAuth } from '../context/SimpleAuthContext';
import '../styles/LoginPage.css';

interface LoginFormData {
  username: string;
  password: string;
}

interface SecurityQuestionData {
  username: string;
  securityAnswer: string;
}

const OfflineLoginPage: React.FC = () => {
  const { 
    login
  } = useAuth();

  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  
  const [securityData, setSecurityData] = useState<SecurityQuestionData>({
    username: '',
    securityAnswer: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState<string>('');
  const [showHardcodedPassword, setShowHardcodedPassword] = useState(false);
  const [passwordTimer, setPasswordTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSecurityAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!securityData.securityAnswer) {
        setError('Please enter your security answer');
        return;
      }

      // Simple hardcoded check for the security answer
      if (securityData.securityAnswer.toLowerCase().trim() === 'center yasin') {
        setShowHardcodedPassword(true);
        setSuccess('Correct! Your password is: YHSHotel@2025!');
        
        // Hide the password after 10 seconds
        const timer = setTimeout(() => {
          setShowHardcodedPassword(false);
          setSuccess('');
          handleBackToLogin();
        }, 10000);
        
        setPasswordTimer(timer);
      } else {
        setError('Incorrect security answer. Please try again.');
      }
    } catch (err) {
      setError('An error occurred while verifying your answer');
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
    setShowHardcodedPassword(false);
    setSecurityData({
      username: '',
      securityAnswer: '',
    });
    
    // Clear any existing timer
    if (passwordTimer) {
      clearTimeout(passwordTimer);
      setPasswordTimer(null);
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

              {/* Forgot Password button removed as requested */}
            </form>
          ) : (
            // Security Question Form
            <form className="login-form" onSubmit={handleSecurityAnswer}>
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
                    value={securityData.securityAnswer}
                    onChange={handleSecurityInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {showHardcodedPassword && (
                <div className="password-display">
                  <div className="password-box">
                    <strong>Your Password:</strong>
                    <div className="password-text">YHSHotel@2025!</div>
                    <small>This message will disappear in 10 seconds</small>
                  </div>
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
                disabled={isLoading || showHardcodedPassword}
              >
                {isLoading ? (
                  <div className="loading-spinner">
                    <div className="spinner"></div>
                    <span>Verifying Answer...</span>
                  </div>
                ) : showHardcodedPassword ? (
                  'Password Shown Above'
                ) : (
                  'Verify Answer'
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
