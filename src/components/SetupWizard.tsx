import { invoke } from '@tauri-apps/api/core';
import React, { useMemo, useState } from 'react';
import { updateActiveStoreName } from '../api/client';
import { type BusinessMode, useLabels } from '../context/LabelContext';
import '../styles/LoginPage.css';

type Step = 1 | 2 | 3;

interface Props {
  onComplete: () => void;
}

const SetupWizard: React.FC<Props> = ({ onComplete }) => {
  const { setMode: setAppBusinessMode } = useLabels();
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

  const [businessMode, setBusinessMode] = useState<BusinessMode>('hotel');

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
    setStep((s) => (s === 3 ? 3 : ((s + 1) as Step)));
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

      // Persist Business Basics so the app can be branded immediately.
      // Business Mode is required to avoid UI/data conflicts; other settings are best-effort.
      try {
        const currencyCode = toCurrencyCode(currencySymbol);

        // Required: set/lock business mode.
        await invoke('set_business_mode', { mode: businessMode });

        // Update UI terminology immediately (no reload needed).
        setAppBusinessMode(businessMode);

        // Best-effort: other settings.
        await Promise.all([
          invoke('set_business_name', { name: businessName.trim() }),
          invoke('set_currency_code', { code: currencyCode }),
          invoke('set_tax_rate', { rate: Number(taxRate) }),
          invoke('set_tax_enabled', { enabled: true }),
        ]);

        // Also update the store profile name to match business name
        try {
          await updateActiveStoreName(businessName.trim());
        } catch (storeErr) {
          console.warn('[setup] Failed to update store profile name:', storeErr);
          // Not critical - continue anyway
        }
      } catch (settingsErr) {
        // Do not silently continue: business mode must be consistent.
        setError(String(settingsErr));
        setIsSubmitting(false);
        return;
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
              <h1 className="bc-setup-title">Select Your Business Type</h1>
              <p className="bc-setup-subtitle">This will customize the terminology used throughout the app.</p>

              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                {[
                  { mode: 'hotel' as BusinessMode, icon: '🏨', title: 'Hotel/Motel', desc: 'Manage rooms, guests, check-ins and check-outs' },
                  { mode: 'restaurant' as BusinessMode, icon: '🍽️', title: 'Restaurant', desc: 'Manage tables, customers, seating and orders' },
                  { mode: 'retail' as BusinessMode, icon: '🛍️', title: 'Retail/Shop', desc: 'Manage terminals, customers, and sales' },
                  { mode: 'salon' as BusinessMode, icon: '💇', title: 'Salon/Spa/Barbershop', desc: 'Manage stations/chairs, customers, and services' },
                  { mode: 'cafe' as BusinessMode, icon: '☕', title: 'Cafe/Coffee Shop', desc: 'Manage tables, customers, and orders' },
                ].map(({ mode, icon, title, desc }) => (
                  <button
                    key={mode}
                    type="button"
                    className={businessMode === mode ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'}
                    onClick={() => setBusinessMode(mode)}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      justifyContent: 'flex-start',
                      border: businessMode === mode ? '2px solid var(--bm-primary)' : '1px solid var(--app-border)',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{title}</div>
                      <div style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>{desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="bc-btn bc-btn-primary bc-auth-primary"
                onClick={goNext}
              >
                Next Step →
              </button>
            </>
          )}

          {step === 3 && (
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
                  <label className="bc-label">Currency</label>
                  <select
                    className="bc-input bc-auth-input"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    disabled={isSubmitting}
                    style={{ appearance: 'none', paddingRight: '2rem' }}
                  >
                    <option value="">Select Currency</option>
                    <option value="AED">AED - United Arab Emirates Dirham</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="BDT">BDT - Bangladeshi Taka</option>
                    <option value="BHD">BHD - Bahraini Dinar</option>
                    <option value="BRL">BRL - Brazilian Real</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="CHF">CHF - Swiss Franc</option>
                    <option value="CNY">CNY - Chinese Yuan</option>
                    <option value="DKK">DKK - Danish Krone</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="HKD">HKD - Hong Kong Dollar</option>
                    <option value="IDR">IDR - Indonesian Rupiah</option>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="KES">KES - Kenyan Shilling</option>
                    <option value="KWD">KWD - Kuwaiti Dinar</option>
                    <option value="LKR">LKR - Sri Lankan Rupee</option>
                    <option value="MYR">MYR - Malaysian Ringgit</option>
                    <option value="NOK">NOK - Norwegian Krone</option>
                    <option value="NZD">NZD - New Zealand Dollar</option>
                    <option value="OMR">OMR - Omani Rial</option>
                    <option value="PHP">PHP - Philippine Peso</option>
                    <option value="PKR">PKR - Pakistani Rupee</option>
                    <option value="QAR">QAR - Qatari Riyal</option>
                    <option value="SAR">SAR - Saudi Arabian Riyal</option>
                    <option value="SEK">SEK - Swedish Krona</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                    <option value="THB">THB - Thai Baht</option>
                    <option value="TRY">TRY - Turkish Lira</option>
                    <option value="TWD">TWD - Taiwan Dollar</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="ZAR">ZAR - South African Rand</option>
                  </select>
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
