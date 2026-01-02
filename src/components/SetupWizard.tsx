import { invoke } from '@tauri-apps/api/core';
import React, { useMemo, useState } from 'react';
import '../styles/LoginPage.css';

type Step = 1 | 2;

interface Props {
  onComplete: () => void;
}

const SetupWizard: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const securityQuestions = useMemo(
    () => [
      'What is the name of your first school?',
      'What was the name of your first pet?',
      'In what city were you born?',
      'What is your favorite food?',
      'What is your favorite color?',
    ],
    []
  );

  const [securityQuestion, setSecurityQuestion] = useState(securityQuestions[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [taxRate, setTaxRate] = useState('0');

  const canContinueAdminStep = useMemo(() => {
    return (
      username.trim().length > 0 &&
      password.length >= 8 &&
      password === confirmPassword &&
      securityQuestion.trim().length > 0 &&
      securityAnswer.trim().length > 0
    );
  }, [username, password, confirmPassword, securityQuestion, securityAnswer]);

  const canContinueBusinessStep = useMemo(() => {
    const parsedTax = Number(taxRate);
    return (
      businessName.trim().length > 0 &&
      currencySymbol.trim().length > 0 &&
      Number.isFinite(parsedTax) &&
      parsedTax >= 0 &&
      parsedTax <= 100
    );
  }, [businessName, currencySymbol, taxRate]);

  const goNext = () => {
    setError('');
    setSuccess('');
    setStep((s) => (s === 2 ? 2 : ((s + 1) as Step)));
  };

  const toCurrencyCode = (raw: string): string => {
    const v = raw.trim();
    if (!v) return 'USD';

    const upper = v.toUpperCase();
    if (/^[A-Z]{3}$/.test(upper)) return upper;

    const normalized = v.replace(/\s+/g, '').toLowerCase();
    if (normalized === '$') return 'USD';
    if (normalized === '€') return 'EUR';
    if (normalized === '£') return 'GBP';
    if (normalized === '₹') return 'INR';
    if (normalized === 'rs' || normalized === 'lkr') return 'LKR';
    if (normalized === 'pkr') return 'PKR';
    if (normalized === 'د.إ' || normalized === 'aed') return 'AED';
    if (normalized === '﷼' || normalized === 'sar') return 'SAR';

    // Fallback: keep app functional without blocking setup.
    return 'USD';
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
        const currencyCode = toCurrencyCode(currencySymbol);
        await Promise.all([
          invoke('set_business_name', { name: businessName.trim() }),
          invoke('set_currency_code', { code: currencyCode }),
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

  return (
    <div className="bc-auth-root">
      <div className="bc-setup-center">
        <div className="bc-setup-card bc-card">
          {step === 1 && (
            <>
              <h1 className="bc-setup-title">Welcome to BizCore</h1>
              <p className="bc-setup-subtitle">Create your owner account to get started.</p>

              <div className="bc-field">
                <label className="bc-label">Admin Username</label>
                <input
                  className="bc-input bc-auth-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., owner"
                  disabled={isSubmitting}
                />
              </div>

              <div className="bc-field">
                <label className="bc-label">Password</label>
                <input
                  className="bc-input bc-auth-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  disabled={isSubmitting}
                />
              </div>

              <div className="bc-field">
                <label className="bc-label">Confirm Password</label>
                <input
                  className="bc-input bc-auth-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  disabled={isSubmitting}
                />
              </div>

              <div className="bc-field">
                <label className="bc-label">Security Question</label>
                <select
                  className="bc-input bc-auth-input"
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  disabled={isSubmitting}
                >
                  {securityQuestions.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bc-field">
                <label className="bc-label">Security Answer</label>
                <input
                  className="bc-input bc-auth-input"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="Answer"
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="button"
                className="bc-btn bc-btn-primary bc-auth-primary"
                disabled={!canContinueAdminStep || isSubmitting}
                onClick={goNext}
              >
                Next Step →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="bc-setup-title">Business Profile</h1>
              <p className="bc-setup-subtitle">Set up your basics. You can change these later.</p>

              <div className="bc-field">
                <label className="bc-label">Business Name</label>
                <input
                  className="bc-input bc-auth-input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="My Awesome Shop"
                  disabled={isSubmitting}
                />
              </div>

              <div className="bc-grid-2">
                <div className="bc-field">
                  <label className="bc-label">Currency Symbol</label>
                  <input
                    className="bc-input bc-auth-input"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    placeholder="$"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="bc-field">
                  <label className="bc-label">Tax Rate (%)</label>
                  <input
                    className="bc-input bc-auth-input"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <button
                type="button"
                className="bc-btn bc-btn-primary bc-auth-primary"
                disabled={!canContinueBusinessStep || isSubmitting}
                onClick={finishSetup}
              >
                {isSubmitting ? 'Saving…' : 'Finish Setup'}
              </button>
            </>
          )}

            {error && (
              <div className="bc-alert bc-alert-error">
                {error}
              </div>
            )}

            {error.toLowerCase().includes('setup is already completed') && (
              <button
                type="button"
                className="bc-btn bc-btn-outline"
                disabled={isSubmitting}
                onClick={onComplete}
              >
                Back to Login
              </button>
            )}

            {success && (
              <div className="bc-alert bc-alert-success">
                {success}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
