import { invoke } from '@tauri-apps/api/core';
import React, { useMemo, useState } from 'react';
import '../styles/LoginPage.css';

type Step = 1 | 2 | 3;

interface Props {
  onComplete: () => void;
}

const SetupWizard: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('What is the name of your first school?');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [taxRate, setTaxRate] = useState('5');

  const canContinueStep2 = useMemo(() => {
    return (
      username.trim().length > 0 &&
      password.length >= 8 &&
      password === confirmPassword &&
      securityQuestion.trim().length > 0 &&
      securityAnswer.trim().length > 0
    );
  }, [username, password, confirmPassword, securityQuestion, securityAnswer]);

  const canContinueStep3 = useMemo(() => {
    const parsedTax = Number(taxRate);
    return (
      businessName.trim().length > 0 &&
      currencyCode.trim().length === 3 &&
      Number.isFinite(parsedTax) &&
      parsedTax >= 0 &&
      parsedTax <= 100
    );
  }, [businessName, currencyCode, taxRate]);

  const goNext = () => {
    setError('');
    setSuccess('');
    setStep((s) => (s === 3 ? 3 : ((s + 1) as Step)));
  };

  const goBack = () => {
    setError('');
    setSuccess('');
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  };

  const finishSetup = async () => {
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await invoke('register_initial_admin', {
        request: {
          username: username.trim(),
          password,
          security_question: securityQuestion.trim(),
          security_answer: securityAnswer.trim(),
        },
      });

      // Best-effort: persist Business Basics so the app can be branded immediately.
      // If any of these fail, we still complete setup (admin already exists) and the user can adjust later.
      try {
        await Promise.all([
          invoke('set_business_name', { name: businessName.trim() }),
          invoke('set_currency_code', { code: currencyCode.trim().toUpperCase() }),
          invoke('set_tax_rate', { rate: Number(taxRate) }),
          invoke('set_tax_enabled', { enabled: true }),
        ]);
      } catch (settingsErr) {
        console.warn('Setup completed but failed to persist business settings:', settingsErr);
      }

      setSuccess('Setup completed. You can now log in.');
      setTimeout(() => onComplete(), 800);
    } catch (e) {
      const msg = String(e);
      if (msg.toLowerCase().includes('setup already completed')) {
        setError('Setup is already completed on this device. Please go back and log in, or use the Forgot password option.');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencyOptions: Array<{ code: string; label: string }> = [
    { code: 'USD', label: 'USD ($)' },
    { code: 'EUR', label: 'EUR (€)' },
    { code: 'GBP', label: 'GBP (£)' },
    { code: 'INR', label: 'INR (₹)' },
    { code: 'LKR', label: 'LKR (Rs)' },
    { code: 'PKR', label: 'PKR (Rs)' },
    { code: 'AED', label: 'AED (د.إ)' },
    { code: 'SAR', label: 'SAR (﷼)' },
  ];

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-card">
          <div className="login-header">
            <div className="hotel-logo">
              <h1>Business Manager Setup</h1>
            </div>
            <p className="login-subtitle">First-time setup (offline)</p>
          </div>

          <div className="login-form">
            {step === 1 && (
              <>
                <div className="success-message">
                  <span className="success-icon">👋</span>
                  Welcome to Business Manager.
                </div>

                <div className="success-message">
                  <span className="success-icon">🔐</span>
                  You’ll create the first admin account for this device.
                </div>

                <button
                  type="button"
                  className="login-button"
                  disabled={isSubmitting}
                  onClick={goNext}
                >
                  Get Started
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="form-group">
                  <label className="form-label">Admin Username</label>
                  <div className="input-wrapper">
                    <span className="input-icon">👤</span>
                    <input
                      className="form-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose an admin username"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Admin Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔒</span>
                    <input
                      className="form-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={isSubmitting}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔒</span>
                    <input
                      className="form-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      disabled={isSubmitting}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Security Question</label>
                  <div className="input-wrapper">
                    <span className="input-icon">❓</span>
                    <input
                      className="form-input"
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Security Answer</label>
                  <div className="input-wrapper">
                    <span className="input-icon">💭</span>
                    <input
                      className="form-input"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      placeholder="Answer (kept offline)"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <button type="button" className="secondary-button" disabled={isSubmitting} onClick={goBack}>
                  Back
                </button>

                <button
                  type="button"
                  className={`login-button ${(!canContinueStep2 || isSubmitting) ? 'loading' : ''}`}
                  disabled={!canContinueStep2 || isSubmitting}
                  onClick={goNext}
                >
                  Continue
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="form-group">
                  <label className="form-label">Business Name</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🏷️</span>
                    <input
                      className="form-input"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g., My Store"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <div className="input-wrapper">
                    <span className="input-icon">💱</span>
                    <select
                      className="form-input"
                      value={currencyCode}
                      onChange={(e) => setCurrencyCode(e.target.value)}
                      disabled={isSubmitting}
                    >
                      {currencyOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tax Rate (%)</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🧾</span>
                    <input
                      className="form-input"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      placeholder="e.g., 5"
                      inputMode="decimal"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <button type="button" className="secondary-button" disabled={isSubmitting} onClick={goBack}>
                  Back
                </button>

                <button
                  type="button"
                  className={`login-button ${(!canContinueStep3 || isSubmitting) ? 'loading' : ''}`}
                  disabled={!canContinueStep3 || isSubmitting}
                  onClick={finishSetup}
                >
                  {isSubmitting ? 'Saving...' : 'Finish Setup'}
                </button>
              </>
            )}

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            {error.toLowerCase().includes('setup is already completed') && (
              <button
                type="button"
                className="secondary-button"
                disabled={isSubmitting}
                onClick={onComplete}
              >
                Back to Login
              </button>
            )}

            {success && (
              <div className="success-message">
                <span className="success-icon">✅</span>
                {success}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
