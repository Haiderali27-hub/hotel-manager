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

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('What is the name of your first school?');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const canContinueStep1 = useMemo(() => {
    return username.trim().length > 0 && password.length >= 8 && password === confirmPassword;
  }, [username, password, confirmPassword]);

  const canContinueStep2 = useMemo(() => {
    return securityQuestion.trim().length > 0 && securityAnswer.trim().length > 0;
  }, [securityQuestion, securityAnswer]);

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
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔒</span>
                    <input
                      className="form-input"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className={`login-button ${!canContinueStep1 ? 'loading' : ''}`}
                  disabled={!canContinueStep1 || isSubmitting}
                  onClick={goNext}
                >
                  Continue
                </button>
              </>
            )}

            {step === 2 && (
              <>
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

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="login-button" disabled={isSubmitting} onClick={goBack}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="login-button"
                    disabled={!canContinueStep2 || isSubmitting}
                    onClick={goNext}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="success-message">
                  <span className="success-icon">ℹ️</span>
                  You’re about to create the first admin account on this device.
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="login-button" disabled={isSubmitting} onClick={goBack}>
                    Back
                  </button>
                  <button
                    type="button"
                    className={`login-button ${isSubmitting ? 'loading' : ''}`}
                    disabled={isSubmitting}
                    onClick={finishSetup}
                  >
                    {isSubmitting ? 'Creating...' : 'Finish Setup'}
                  </button>
                </div>
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
