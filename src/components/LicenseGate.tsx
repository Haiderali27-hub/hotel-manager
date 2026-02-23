import { invoke } from '@tauri-apps/api/core';
import React, { useCallback, useEffect, useState } from 'react';
import type { ThemeColors } from '../context/ThemeContext';
import { useTheme } from '../context/ThemeContext';

interface LicenseInfo {
  status: 'trial' | 'expired' | 'licensed';
  trial_days_left: number;
  licensed_to: string;
  key_major_version: number;
  app_major_version: number;
  needs_upgrade: boolean;
}

interface LicenseGateProps {
  children: React.ReactNode;
}

const LicenseGate: React.FC<LicenseGateProps> = ({ children }) => {
  const { colors, theme } = useTheme();
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadLicense = useCallback(async () => {
    try {
      const data = await invoke<LicenseInfo>('get_license_info');
      setInfo(data);
    } catch (e) {
      console.error('License check failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLicense(); }, [loadLicense]);

  const handleActivate = async () => {
    if (!keyInput.trim()) {
      setError('Please enter your license key.');
      return;
    }
    setActivating(true);
    setError('');
    setSuccess('');
    try {
      const result = await invoke<LicenseInfo>('activate_license', { key: keyInput.trim() });
      setInfo(result);
      if (result.status === 'licensed') {
        setSuccess(`✅ Activated for "${result.licensed_to}"! Enjoy INERTIA.`);
      } else if (result.needs_upgrade) {
        setError(`This key is for V${result.key_major_version} — you need a V${result.app_major_version} key for this version.`);
      }
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: colors.primary }}>
        <p style={{ color: colors.textSecondary }}>Checking license…</p>
      </div>
    );
  }

  // Fully licensed for this major version — pass through
  if (info?.status === 'licensed' && !info.needs_upgrade) {
    return <>{children}</>;
  }

  // Still in trial — show banner + pass through
  if (info?.status === 'trial') {
    return (
      <>
        <TrialBanner
          daysLeft={info.trial_days_left}
          keyInput={keyInput}
          setKeyInput={setKeyInput}
          onActivate={handleActivate}
          activating={activating}
          error={error}
          success={success}
          colors={colors}
          theme={theme}
        />
        {children}
      </>
    );
  }

  // Expired or needs upgrade — show full paywall
  return (
    <Paywall
      info={info}
      keyInput={keyInput}
      setKeyInput={setKeyInput}
      onActivate={handleActivate}
      activating={activating}
      error={error}
      success={success}
      colors={colors}
      theme={theme}
    />
  );
};

// ── Trial Banner ─────────────────────────────────────────────────────────────
const TrialBanner: React.FC<{
  daysLeft: number;
  keyInput: string;
  setKeyInput: (v: string) => void;
  onActivate: () => void;
  activating: boolean;
  error: string;
  success: string;
  colors: ThemeColors;
  theme: string;
}> = ({ daysLeft, keyInput, setKeyInput, onActivate, activating, error, success }) => {
  const [expanded, setExpanded] = useState(false);
  const urgent = daysLeft <= 3;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 9999,
      background: urgent ? '#dc2626' : '#d97706',
      color: '#fff',
      padding: expanded ? '12px 20px 16px' : '8px 20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'padding 0.2s',
    }}>
      {/* collapsed row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {urgent ? '🚨' : '⏳'} Free Trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff',
              padding: '4px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13
            }}
          >
            {expanded ? 'Hide' : 'Enter License Key'}
          </button>
        </div>
      </div>

      {/* expanded key entry */}
      {expanded && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.9 }}>
            Purchase a license at <strong>your-website.com</strong> and enter your key below.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="INERTIA-V1-XXXXXXXXXX"
              style={{
                flex: '1 1 300px', padding: '8px 12px', borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                fontSize: 13, outline: 'none',
              }}
              onKeyDown={e => e.key === 'Enter' && onActivate()}
            />
            <button
              onClick={onActivate}
              disabled={activating}
              style={{
                background: '#fff', color: urgent ? '#dc2626' : '#d97706',
                border: 'none', padding: '8px 20px', borderRadius: 6,
                fontWeight: 700, fontSize: 13, cursor: 'pointer'
              }}
            >
              {activating ? 'Activating…' : 'Activate'}
            </button>
          </div>
          {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#fecaca' }}>{error}</p>}
          {success && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#d1fae5' }}>{success}</p>}
        </div>
      )}
    </div>
  );
};

// ── Full Paywall ──────────────────────────────────────────────────────────────
const Paywall: React.FC<{
  info: LicenseInfo | null;
  keyInput: string;
  setKeyInput: (v: string) => void;
  onActivate: () => void;
  activating: boolean;
  error: string;
  success: string;
  colors: ThemeColors;
  theme: string;
}> = ({ info, keyInput, setKeyInput, onActivate, activating, error, success, colors }) => {
  const needsUpgrade = info?.needs_upgrade;

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: colors.primary, flexDirection: 'column', gap: 0,
    }}>
      {/* Logo / brand */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: colors.text, letterSpacing: -0.5 }}>
          INERTIA
        </h1>
        <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: 14 }}>
          Universal Business Manager
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 440,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: '32px 36px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        {needsUpgrade ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔄</div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: colors.text }}>
                Upgrade Required
              </h2>
              <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 14, lineHeight: 1.5 }}>
                Your current key is for <strong>V{info?.key_major_version}</strong>.
                This is <strong>V{info?.app_major_version}</strong> — a major upgrade.
                Purchase a V{info?.app_major_version} license to continue (existing data is preserved).
              </p>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: colors.text }}>
                Trial Expired
              </h2>
              <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 14, lineHeight: 1.5 }}>
                Your 14-day free trial has ended. Activate a license to continue using INERTIA.
                Your data is safe and will be fully accessible once activated.
              </p>
            </div>
          </>
        )}

        {/* Key entry */}
        <div style={{ marginTop: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            License Key
          </label>
          <input
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="INERTIA-V1-XXXXXXXXXX"
            style={{
              width: '100%', marginTop: 6, padding: '10px 14px',
              border: `1px solid ${error ? '#ef4444' : colors.border}`,
              borderRadius: 8, fontSize: 14, background: colors.surface,
              color: colors.text, outline: 'none', boxSizing: 'border-box',
              fontFamily: 'monospace',
            }}
            onKeyDown={e => e.key === 'Enter' && onActivate()}
          />
          {error && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#ef4444' }}>{error}</p>
          )}
          {success && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#22c55e' }}>{success}</p>
          )}
        </div>

        <button
          onClick={onActivate}
          disabled={activating}
          style={{
            width: '100%', marginTop: 16,
            padding: '12px 0',
            background: activating ? colors.border : 'var(--bm-primary, #2563eb)',
            color: '#fff',
            border: 'none', borderRadius: 10,
            fontWeight: 800, fontSize: 16,
            cursor: activating ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {activating ? 'Activating…' : 'Activate License'}
        </button>

        {/* Purchase CTA */}
        <div style={{
          marginTop: 20, padding: '14px 16px',
          background: `${colors.primary}`,
          border: `1px solid ${colors.border}`,
          borderRadius: 10, textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
            Don't have a license?
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: colors.text }}>
            Contact us to purchase →{' '}
            <span style={{ color: 'var(--bm-primary, #2563eb)' }}>your-website.com</span>
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: colors.textSecondary }}>
            One-time payment · Lifetime license · Free minor updates · Major upgrades at a discount
          </p>
        </div>
      </div>

      {/* Footer note */}
      <p style={{ marginTop: 20, fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
        INERTIA V{info?.app_major_version ?? 1} · Your data is always safe on your device
      </p>
    </div>
  );
};

export default LicenseGate;
