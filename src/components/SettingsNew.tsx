import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import React, { useEffect, useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { labels, useLabels, type BusinessMode } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import UserManagement from './UserManagement';

interface SecurityQuestion {
  id: string;
  question: string;
  answer: string;
}

type SettingsTab = 'general' | 'branding' | 'database' | 'users' | 'support';

const Settings: React.FC = () => {
  const { colors } = useTheme();
  const { showSuccess, showError } = useNotification();
  const { currencyCode, locale, supportedCurrencies, setCurrencyCode, setLocale, formatMoney } = useCurrency();
  const { current: label, mode: businessMode, setMode: setBusinessMode } = useLabels();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [barcodeEnabled, setBarcodeEnabled] = useState(false);
  const [businessModeLocked, setBusinessModeLocked] = useState<boolean>(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [pendingLocale, setPendingLocale] = useState(locale);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Safety Phrase, 2: Security Question, 3: Final Confirmation
  const [safetyPhrase, setSafetyPhrase] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [finalConfirmation, setFinalConfirmation] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState<SecurityQuestion | null>(null);
  const [resetQuestionInput, setResetQuestionInput] = useState('');
  const [resetAnswerInput, setResetAnswerInput] = useState('');
  const [isSavingResetQuestion, setIsSavingResetQuestion] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreStep, setRestoreStep] = useState(1); // 1: Warning, 2: File Selection, 3: Confirmation
  const [restoreFilePath, setRestoreFilePath] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [recentBackups, setRecentBackups] = useState<string[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);

  const [businessLogoPath, setBusinessLogoPath] = useState<string>('');
  const [businessLogoDataUrl, setBusinessLogoDataUrl] = useState<string>('');
  const [receiptHeader, setReceiptHeader] = useState<string>('');
  const [receiptFooter, setReceiptFooter] = useState<string>('');
  const [isSavingReceiptHeader, setIsSavingReceiptHeader] = useState(false);
  const [isSavingReceiptFooter, setIsSavingReceiptFooter] = useState(false);
  const [receiptType, setReceiptType] = useState<string>('both');
  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false);

  useEffect(() => {
    setPendingLocale(locale);
  }, [locale]);

  const [tipState, setTipState] = useState<{ id: string | null; pinned: boolean }>({ id: null, pinned: false });

  useEffect(() => {
    const clearTip = () => setTipState({ id: null, pinned: false });
    window.addEventListener('click', clearTip);
    return () => window.removeEventListener('click', clearTip);
  }, []);

  useEffect(() => {
    setTipState({ id: null, pinned: false });
  }, [activeTab]);

  const loadRecentBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const backups = await invoke<string[]>('list_recent_backups', { limit: 5 });
      setRecentBackups(backups);
    } catch {
      setRecentBackups([]);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'database') {
      loadRecentBackups();
    }
  }, [activeTab]);

  useEffect(() => {
    const loadResetQuestion = async () => {
      try {
        const question = await invoke<SecurityQuestion>('get_reset_security_question');
        setResetQuestionInput(question.question || '');
      } catch {
        setResetQuestionInput('');
      }
    };

    loadResetQuestion();
  }, []);

  const getBackupFileName = (path: string) => {
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  };

  const getBackupTimestamp = (fileName: string) => {
    const match = fileName.match(/(\d{8})_(\d{6})/);
    if (!match) return '';
    const datePart = match[1];
    const timePart = match[2];
    const year = datePart.slice(0, 4);
    const month = datePart.slice(4, 6);
    const day = datePart.slice(6, 8);
    const hour = timePart.slice(0, 2);
    const minute = timePart.slice(2, 4);
    const second = timePart.slice(4, 6);
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  };

  const formatBackupLabel = (path: string) => {
    const fileName = getBackupFileName(path);
    const timestamp = getBackupTimestamp(fileName);
    const isAuto = fileName.includes('before_reset');
    if (timestamp) {
      return `${isAuto ? 'Auto (Before Reset)' : 'Manual'} - ${timestamp}`;
    }
    return isAuto ? 'Auto (Before Reset)' : 'Manual Backup';
  };

  const InfoTip = ({ id, text }: { id: string; text: string }) => (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => {
        if (!tipState.pinned) setTipState({ id, pinned: false });
      }}
      onMouseLeave={() => {
        if (!tipState.pinned) setTipState({ id: null, pinned: false });
      }}
      onClick={(e) => {
        e.stopPropagation();
        setTipState((prev) => (prev.id === id && prev.pinned ? { id: null, pinned: false } : { id, pinned: true }));
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '999px',
          border: `1px solid ${colors.border}`,
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: 800,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        i
      </span>
      {tipState.id === id && (
        <span
          style={{
            position: 'absolute',
            top: '120%',
            left: 0,
            background: colors.surface,
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            width: 220,
            maxWidth: '80vw',
            wordBreak: 'break-word',
            boxShadow: `0 8px 24px ${colors.shadow}`,
            zIndex: 5,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );

  useEffect(() => {
    (async () => {
      try {
        const status = await invoke<{ mode: string; locked: boolean }>('get_business_mode_status');
        setBusinessModeLocked(Boolean(status?.locked));
      } catch {
        // If command not available (older backend / web mode), default to unlocked.
        setBusinessModeLocked(false);
      }
    })();
  }, []);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const [logoPath, logoDataUrl, savedHeader, savedFooter, savedReceiptType, savedAutoPrint] = await Promise.all([
          invoke<string | null>('get_business_logo_path'),
          invoke<string | null>('get_business_logo_data_url'),
          invoke<string | null>('get_receipt_header'),
          invoke<string | null>('get_receipt_footer'),
          invoke<string | null>('get_receipt_type').catch(() => 'both'),
          invoke<boolean>('get_receipt_auto_print').catch(() => false),
        ]);

        if (logoPath) setBusinessLogoPath(logoPath);
        if (logoDataUrl) setBusinessLogoDataUrl(logoDataUrl);
        setReceiptHeader(savedHeader ?? '');
        setReceiptFooter(savedFooter ?? '');
        setReceiptType(savedReceiptType ?? 'both');
        setReceiptAutoPrint(!!savedAutoPrint);
      } catch (error) {
        // Branding is optional; don't block Settings if unavailable.
        console.warn('Branding settings not available:', error);
      }
    };

    loadBranding();
  }, []);

  useEffect(() => {
    const loadBarcodeSetting = async () => {
      try {
        const enabled = await invoke<boolean>('get_barcode_enabled');
        setBarcodeEnabled(!!enabled);
      } catch {
        // Optional feature; default off.
        setBarcodeEnabled(false);
      }
    };
    loadBarcodeSetting();
  }, []);

  const handleUploadLogo = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: 'Select Business Logo',
        filters: [
          { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] },
        ],
      });

      if (!selected || Array.isArray(selected)) return;

      const fileStats = await invoke<{ size: number }>('get_file_size', { path: selected });
      const MAX_SIZE = 1024 * 1024; // 1MB
      if (fileStats.size > MAX_SIZE) {
        showError('Logo Too Large', 'Max logo size is 1 MB. Please compress or resize your image.');
        return;
      }

      const savedPath = await invoke<string>('store_business_logo', { source_path: selected });
      const dataUrl = await invoke<string | null>('get_business_logo_data_url');

      setBusinessLogoPath(savedPath ?? '');
      setBusinessLogoDataUrl(dataUrl ?? '');
      showSuccess('Logo Updated', 'Business logo saved successfully.');
    } catch (error) {
      showError('Logo Upload Failed', String(error));
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await invoke<string>('remove_business_logo');
      setBusinessLogoPath('');
      setBusinessLogoDataUrl('');
      showSuccess('Logo Removed', 'Business logo removed.');
    } catch (error) {
      showError('Remove Failed', String(error));
    }
  };

  const saveReceiptHeader = async () => {
    try {
      setIsSavingReceiptHeader(true);
      await invoke('set_receipt_header', { value: receiptHeader });
      showSuccess('Saved', 'Receipt header updated.');
    } catch (error) {
      showError('Save Failed', String(error));
    } finally {
      setIsSavingReceiptHeader(false);
    }
  };

  const saveReceiptFooter = async () => {
    try {
      setIsSavingReceiptFooter(true);
      await invoke('set_receipt_footer', { value: receiptFooter });
      showSuccess('Saved', 'Receipt footer updated.');
    } catch (error) {
      showError('Save Failed', String(error));
    } finally {
      setIsSavingReceiptFooter(false);
    }
  };

  const handleBackupData = async () => {
    try {
      setIsBackingUp(true);
      const destination = await open({
        multiple: false,
        directory: true,
        title: 'Select Backup Folder',
      });

      if (!destination || Array.isArray(destination)) {
        setIsBackingUp(false);
        return;
      }

      await invoke<string>('backup_database', { backupPath: destination });
      showSuccess('Backup Created', 'Backup folder saved successfully.');
      loadRecentBackups();
    } catch (error) {
      showError('Backup Failed', String(error));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleQuickBackup = async () => {
    try {
      setIsBackingUp(true);
      await invoke<string>('backup_database_default');
      showSuccess('Backup Created', 'Backup folder saved successfully.');
      loadRecentBackups();
    } catch (error) {
      showError('Backup Failed', String(error));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreDatabase = () => {
    setRestoreStep(1);
    setRestoreFilePath('');
    setIsRestoring(false);
    setShowRestoreDialog(true);
  };

  const useBackupForRestore = (path: string) => {
    setRestoreFilePath(path);
    setRestoreStep(2);
    setShowRestoreDialog(true);
  };

  const startResetProcess = () => {
    setResetStep(1);
    setSafetyPhrase('');
    setSecurityAnswer('');
    setFinalConfirmation('');
    setSecurityQuestion(null);
    setShowResetDialog(true);
  };

  const validateSafetyPhrase = async () => {
    if (safetyPhrase.trim() !== 'I UNDERSTAND THE RISKS') {
      showError('Safety Phrase Incorrect', 'Please type the exact safety phrase to continue.');
      return;
    }

    try {
      const question = await invoke<SecurityQuestion>('get_reset_security_question');
      setSecurityQuestion(question);
      setResetStep(2);
    } catch (error) {
      showError('Security Check Failed', String(error));
    }
  };

  const validateSecurityQuestion = async () => {
    if (!securityQuestion) return;

    try {
      const isValid = await invoke<boolean>('validate_security_answer', {
        questionId: securityQuestion.id,
        answer: securityAnswer,
      });

      if (!isValid) {
        showError('Incorrect Answer', 'Please try again.');
        return;
      }

      setResetStep(3);
    } catch (error) {
      showError('Validation Failed', String(error));
    }
  };

  const performReset = async () => {
    if (finalConfirmation !== 'DELETE ALL DATA') {
      showError('Confirmation Required', 'Please type DELETE ALL DATA to confirm.');
      return;
    }

    try {
      const result = await invoke<string>('reset_application_data');
      showSuccess('Reset Complete', result);
      cancelReset();
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      showError('Reset Failed', String(error));
    }
  };

  const saveResetQuestion = async () => {
    if (!resetQuestionInput.trim() || !resetAnswerInput.trim()) {
      showError('Missing Info', 'Please enter both a question and an answer.');
      return;
    }

    try {
      setIsSavingResetQuestion(true);
      await invoke('set_reset_security_question', {
        question: resetQuestionInput,
        answer: resetAnswerInput,
      });
      setResetAnswerInput('');
      showSuccess('Saved', 'Reset security question updated.');
    } catch (error) {
      showError('Save Failed', String(error));
    } finally {
      setIsSavingResetQuestion(false);
    }
  };

  const cancelReset = () => {
    setShowResetDialog(false);
    setResetStep(1);
    setSafetyPhrase('');
    setSecurityAnswer('');
    setFinalConfirmation('');
    setSecurityQuestion(null);
  };

  const cancelRestore = () => {
    setShowRestoreDialog(false);
    setRestoreStep(1);
    setRestoreFilePath('');
    setIsRestoring(false);
  };

  const validateRestoreFile = () => {
    if (!restoreFilePath.trim()) {
      showError('Missing File', 'Please enter a backup file path.');
      return false;
    }
    if (!restoreFilePath.toLowerCase().endsWith('.db')) {
      showError('Invalid File', 'Backup file must end with .db');
      return false;
    }
    return true;
  };

  const findLatestBackup = async () => {
    try {
      const latest = await invoke<string>('select_backup_file');
      setRestoreFilePath(latest);
    } catch (error) {
      showError('Find Latest Failed', String(error));
    }
  };

  const browseBackupFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: 'Select Backup File',
        filters: [
          { name: 'Database Backup', extensions: ['db'] },
        ],
      });

      if (!selected || Array.isArray(selected)) return;

      setRestoreFilePath(selected);
    } catch (error) {
      showError('Browse Backup', String(error));
    }
  };

  const performRestore = async () => {
    if (!validateRestoreFile()) return;

    try {
      setIsRestoring(true);
      await invoke<string>('restore_database_from_backup', { backupFilePath: restoreFilePath });
      showSuccess('Restore Complete', 'Database restored successfully.');
      cancelRestore();
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      showError('Restore Failed', String(error));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div style={{ padding: 24, display: 'grid', gap: 14 }}>
      <div className="bc-card" style={{ borderRadius: 10, padding: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className={activeTab === 'general' ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'} onClick={() => setActiveTab('general')}>
            General
          </button>
          <button type="button" className={activeTab === 'branding' ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'} onClick={() => setActiveTab('branding')}>
            Branding
          </button>
          <button type="button" className={activeTab === 'database' ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'} onClick={() => setActiveTab('database')}>
            Database
          </button>
          <button type="button" className={activeTab === 'users' ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'} onClick={() => setActiveTab('users')}>
            Users
          </button>
          <button type="button" className={activeTab === 'support' ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'} onClick={() => setActiveTab('support')}>
            Support
          </button>
        </div>
      </div>

      <div>
        {activeTab === 'general' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                General
                <InfoTip id="general" text="Core app defaults like currency, locale, and business type." />
              </div>
              <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text-secondary)' }}>Currency</div>
                  <select
                    className="bc-input"
                    value={currencyCode}
                    onChange={async (e) => {
                      try {
                        await setCurrencyCode(e.target.value);
                        showSuccess('Currency Updated', `Currency set to ${e.target.value}`);
                      } catch (error) {
                        showError('Currency Update Failed', String(error));
                      }
                    }}
                  >
                    {supportedCurrencies.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: 6, color: 'var(--app-text-secondary)', fontSize: 12 }}>
                    Preview: {formatMoney(1234.56)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text-secondary)' }}>Locale (Language & Region)</div>
                  <select
                    className="bc-input"
                    value={pendingLocale}
                    onChange={(e) => {
                      setPendingLocale(e.target.value);
                      setLocale(e.target.value).catch((error) => {
                        showError('Locale Update Failed', String(error));
                      });
                    }}
                  >
                    <option value="en-US">English (United States)</option>
                    <option value="en-GB">English (United Kingdom)</option>
                    <option value="en-AU">English (Australia)</option>
                    <option value="fr-FR">Français (France)</option>
                    <option value="de-DE">Deutsch (Germany)</option>
                    <option value="es-ES">Español (Spain)</option>
                    <option value="it-IT">Italiano (Italy)</option>
                    <option value="pt-BR">Português (Brazil)</option>
                    <option value="pt-PT">Português (Portugal)</option>
                    <option value="ja-JP">日本語 (Japan)</option>
                    <option value="zh-CN">中文 (Simplified)</option>
                    <option value="zh-TW">中文 (Traditional)</option>
                    <option value="ko-KR">한국어 (Korea)</option>
                    <option value="ar-SA">العربية (Saudi Arabia)</option>
                    <option value="hi-IN">हिन्दी (India)</option>
                    <option value="ur-PK">اردو (Pakistan)</option>
                    <option value="th-TH">ไทย (Thailand)</option>
                    <option value="vi-VN">Tiếng Việt (Vietnam)</option>
                    <option value="id-ID">Bahasa Indonesia (Indonesia)</option>
                    <option value="ms-MY">Bahasa Melayu (Malaysia)</option>
                    <option value="tl-PH">Tagalog (Philippines)</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text-secondary)' }}>Business Type</div>
                  <select
                    className="bc-input"
                    value={businessMode}
                    onChange={async (e) => {
                      const newMode = e.target.value as BusinessMode;
                      if (businessModeLocked) {
                        showError(
                          'Business Type Locked',
                          'Business type is locked after first-time setup. Use Reset Application Data to change it.'
                        );
                        return;
                      }

                      try {
                        await invoke('set_business_mode', { mode: newMode });
                        setBusinessMode(newMode);
                        setBusinessModeLocked(true);
                        showSuccess('Business Type Set', `Set to ${newMode}. This is now locked to prevent conflicts.`);
                      } catch (error) {
                        showError('Business Type Update Failed', String(error));
                      }
                    }}
                    disabled={businessModeLocked}
                  >
                    {Object.entries(labels).map(([mode, modeLabels]) => (
                      <option key={mode} value={mode}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1)} ({modeLabels.unit}, {modeLabels.client})
                      </option>
                    ))}
                  </select>
                  {businessModeLocked ? (
                    <div style={{ marginTop: 6, color: 'var(--app-text-secondary)', fontSize: 12 }}>
                      Locked after first setup. Use Reset Application Data to change.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Receipts
                <InfoTip id="receipts" text="Receipt buttons and auto-print behavior." />
              </div>
              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text-secondary)' }}>Default Receipt Type</div>
                  <select
                    className="bc-input"
                    value={receiptType}
                    onChange={async (e) => {
                      const newType = e.target.value;
                      setReceiptType(newType);
                      try {
                        await invoke('set_receipt_type', { value: newType });
                        showSuccess('Receipt Type Updated', `Default print type set to: ${newType === 'both' ? 'Both' : newType === 'thermal' ? 'Thermal Only' : 'Standard Only'}`);
                      } catch (error) {
                        showError('Update Failed', String(error));
                      }
                    }}
                  >
                    <option value="both">Both (Standard + Thermal)</option>
                    <option value="standard">Standard Receipt Only</option>
                    <option value="thermal">Thermal Receipt Only</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={receiptAutoPrint}
                    onChange={async (e) => {
                      const next = e.target.checked;
                      setReceiptAutoPrint(next);
                      try {
                        await invoke('set_receipt_auto_print', { enabled: next });
                        showSuccess('Saved', next ? 'Auto-print enabled' : 'Auto-print disabled');
                      } catch (error) {
                        setReceiptAutoPrint(!next);
                        showError('Save Failed', String(error));
                      }
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--app-text)' }}>
                    Auto-print after checkout
                  </span>
                </label>
              </div>
            </div>

            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Retail Options
                <InfoTip id="retail" text="Barcode/SKU tools for fast scanning in POS." />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={barcodeEnabled}
                    onChange={async (e) => {
                      const next = e.target.checked;
                      setBarcodeEnabled(next);
                      try {
                        await invoke<string>('set_barcode_enabled', { enabled: next });
                        showSuccess('Saved', next ? 'Barcode/SKU enabled' : 'Barcode/SKU disabled');
                      } catch (error) {
                        setBarcodeEnabled(!next);
                        showError('Save Failed', String(error));
                      }
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--app-text)' }}>
                    Enable barcode/SKU fields and scanner search
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branding' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Business Logo
                <InfoTip id="branding-logo" text="Logo shown on receipts. Max size 1 MB." />
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="bc-btn bc-btn-primary" onClick={handleUploadLogo} type="button">
                  Upload Logo
                </button>
                {businessLogoPath && (
                  <button className="bc-btn" onClick={handleRemoveLogo} type="button" style={{ background: '#ef4444', color: 'white' }}>
                    Remove Logo
                  </button>
                )}
                {businessLogoDataUrl ? (
                  <img src={businessLogoDataUrl} alt="Logo preview" style={{ height: 48, maxWidth: 140, objectFit: 'contain' }} />
                ) : null}
                <div style={{ color: 'var(--app-text-secondary)', fontSize: 12, maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {businessLogoPath || 'No logo set'}
                </div>
              </div>
            </div>

            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Receipt Header
              </div>
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  placeholder="Receipt header (optional)"
                  className="bc-input"
                  style={{ minHeight: 90, resize: 'vertical' }}
                />
                <div style={{ marginTop: 10 }}>
                  <button className="bc-btn bc-btn-primary" onClick={saveReceiptHeader} type="button" disabled={isSavingReceiptHeader}>
                    {isSavingReceiptHeader ? 'Saving…' : 'Save Header'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Receipt Footer
              </div>
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="Receipt footer (optional)"
                  className="bc-input"
                  style={{ minHeight: 90, resize: 'vertical' }}
                />
                <div style={{ marginTop: 10 }}>
                  <button className="bc-btn bc-btn-primary" onClick={saveReceiptFooter} type="button" disabled={isSavingReceiptFooter}>
                    {isSavingReceiptFooter ? 'Saving…' : 'Save Footer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Backup
                <InfoTip id="db-backup" text="Export your data to an external location for safekeeping." />
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="bc-btn bc-btn-primary" onClick={handleBackupData} disabled={isBackingUp}>
                  {isBackingUp ? 'Creating Backup…' : 'Create Backup'}
                </button>
                <button className="bc-btn bc-btn-outline" onClick={handleQuickBackup} disabled={isBackingUp} style={{ marginLeft: 10 }}>
                  Quick Backup (Default Folder)
                </button>
                <div style={{ marginTop: 10, color: 'var(--app-text-secondary)', fontSize: 12 }}>
                  Tip: Each backup creates a folder with both the .db and JSON export.
                </div>
              </div>
            </div>

            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Backup and Restore Steps
              </div>
              <div style={{ marginTop: 10, color: 'var(--app-text-secondary)', fontSize: 13 }}>
                <div>1) Click Create Backup and choose a safe folder.</div>
                <div>2) A backup folder is created with a .db file and JSON export.</div>
                <div>3) To restore, open Restore and select the .db file inside that folder.</div>
                <div>4) Confirm the restore steps and wait for completion.</div>
              </div>
            </div>

            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Recent Backups
              </div>
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {isLoadingBackups ? (
                  <div style={{ color: 'var(--app-text-secondary)', fontSize: 12 }}>Loading backups...</div>
                ) : recentBackups.length === 0 ? (
                  <div style={{ color: 'var(--app-text-secondary)', fontSize: 12 }}>No backups found yet.</div>
                ) : (
                  recentBackups.map((path) => (
                    <div key={path} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 360px', minWidth: 240 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)' }}>
                          {formatBackupLabel(path)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--app-text-secondary)', wordBreak: 'break-word' }}>
                          {getBackupFileName(path)}
                        </div>
                      </div>
                      <button className="bc-btn bc-btn-outline" onClick={() => useBackupForRestore(path)} type="button">
                        Use for Restore
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Restore
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="bc-btn bc-btn-primary" onClick={handleRestoreDatabase}>
                  Restore from Backup
                </button>
              </div>
            </div>

            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Reset
                <InfoTip id="db-reset" text="Permanently delete all data. Use with caution." />
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="bc-btn bc-btn-primary" onClick={startResetProcess}>
                  Reset Application Data
                </button>
              </div>
            </div>

            <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
                Reset Security Question
              </div>
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--app-text-secondary)' }}>
                    Question
                  </div>
                  <input
                    className="bc-input"
                    value={resetQuestionInput}
                    onChange={(e) => setResetQuestionInput(e.target.value)}
                    placeholder="e.g., What city is your business located in?"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--app-text-secondary)' }}>
                    Answer
                  </div>
                  <input
                    className="bc-input"
                    value={resetAnswerInput}
                    onChange={(e) => setResetAnswerInput(e.target.value)}
                    placeholder="Type the answer"
                  />
                </div>
                <div>
                  <button className="bc-btn bc-btn-primary" onClick={saveResetQuestion} disabled={isSavingResetQuestion}>
                    {isSavingResetQuestion ? 'Saving...' : 'Save Security Question'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--app-text)' }}>
              Users
              <InfoTip id="users" text="Manage staff access and roles." />
            </div>
            <UserManagement embedded />
          </div>
        )}

        {activeTab === 'support' && (
          <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>
              Support
              <InfoTip id="support" text="Contact support for help or questions." />
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>Email:</span>
              <a
                href="mailto:anomly80@gmail.com"
                style={{ color: colors.accent, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                anomly80@gmail.com
              </a>
            </div>
          </div>
        )}
      </div>

      {showResetDialog && (
        <div className="bc-modal-overlay" role="dialog" aria-modal="true">
          <div className="bc-modal" style={{ maxWidth: '640px', padding: '24px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '20px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--app-text)' }}>Security Verification</div>
              <button className="bc-btn bc-btn-outline" onClick={cancelReset} type="button" style={{ width: 'auto' }}>
                Close
              </button>
            </div>

            <div>
              {resetStep === 1 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: 'var(--app-text)' }}>Step 1: Safety Verification</div>
                  <div className="bc-card" style={{ borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text)' }}>
                      Warning
                    </div>
                    <div style={{ color: 'var(--app-text-secondary)', fontSize: 13 }}>
                      This action will permanently delete ALL data including {label.client.toLowerCase()} records, {label.unit.toLowerCase()} records, sales, financial records, and settings.
                      <div style={{ marginTop: 8 }}>
                        An automatic backup will be created before reset.
                      </div>
                    </div>
                  </div>
                  <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, marginBottom: 8 }}>
                    To continue, please type the safety phrase exactly:
                  </div>
                  <div style={{ color: 'var(--app-text)', fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                    "I UNDERSTAND THE RISKS"
                  </div>
                  <input
                    type="text"
                    value={safetyPhrase}
                    onChange={(e) => setSafetyPhrase(e.target.value)}
                    placeholder="Type the safety phrase exactly"
                    className="bc-input"
                    onKeyDown={(e) => e.key === 'Enter' && validateSafetyPhrase()}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                    <button onClick={cancelReset} className="bc-btn bc-btn-outline" type="button">Cancel</button>
                    <button onClick={validateSafetyPhrase} className="bc-btn bc-btn-primary" type="button">Continue</button>
                  </div>
                </div>
              )}

              {resetStep === 2 && securityQuestion && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: 'var(--app-text)' }}>Step 2: Security Question</div>
                  <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, marginBottom: 10 }}>{securityQuestion.question}</div>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Enter your answer"
                    className="bc-input"
                    onKeyDown={(e) => e.key === 'Enter' && validateSecurityQuestion()}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                    <button onClick={cancelReset} className="bc-btn bc-btn-outline" type="button">Cancel</button>
                    <button onClick={validateSecurityQuestion} className="bc-btn bc-btn-primary" type="button">Verify</button>
                  </div>
                </div>
              )}

              {resetStep === 3 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: 'var(--app-text)' }}>Step 3: Final Confirmation</div>
                  <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, marginBottom: 10 }}>
                    This is your last chance to cancel. Type <strong>"DELETE ALL DATA"</strong> to confirm.
                  </div>
                  <input
                    type="text"
                    value={finalConfirmation}
                    onChange={(e) => setFinalConfirmation(e.target.value)}
                    placeholder="Type: DELETE ALL DATA"
                    className="bc-input"
                    onKeyDown={(e) => e.key === 'Enter' && performReset()}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                    <button onClick={cancelReset} className="bc-btn bc-btn-outline" type="button">Cancel</button>
                    <button
                      onClick={performReset}
                      className="bc-btn bc-btn-primary"
                      disabled={finalConfirmation !== 'DELETE ALL DATA'}
                      type="button"
                    >
                      Delete All Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRestoreDialog && (
        <div className="bc-modal-overlay" role="dialog" aria-modal="true">
          <div className="bc-modal">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderBottom: '1px solid var(--app-border)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>Restore Database (Step {restoreStep} of 3)</div>
              <button className="bc-btn bc-btn-outline" onClick={cancelRestore} type="button">
                Close
              </button>
            </div>

            <div style={{ padding: 16 }}>
              {restoreStep === 1 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: 'var(--app-text)' }}>Important Safety Warning</div>
                  <div className="bc-card" style={{ borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ color: 'var(--app-text-secondary)', fontSize: 13 }}>
                      This operation will replace ALL your current data.
                      <ul style={{ margin: '10px 0 0 18px', color: 'var(--app-text-secondary)', fontSize: 13 }}>
                        <li>Your current database will be automatically backed up first</li>
                        <li>The backup file will be validated before restoration</li>
                        <li>If anything goes wrong, your original data will be restored</li>
                        <li>Only use backup files created by this application</li>
                      </ul>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={cancelRestore} className="bc-btn bc-btn-outline" type="button">Cancel</button>
                    <button onClick={() => setRestoreStep(2)} className="bc-btn bc-btn-primary" type="button">
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {restoreStep === 2 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: 'var(--app-text)' }}>Select Backup File</div>
                  <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, marginBottom: 10 }}>
                    Backup files are typically in your Desktop, Downloads, or the app's backup directory.
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text-secondary)' }}>Backup File Path</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input
                        id="restorePathInput"
                        type="text"
                        value={restoreFilePath}
                        onChange={(e) => setRestoreFilePath(e.target.value)}
                        placeholder="C:\\Backups\\backup_20250905_143022\\business_backup_20250905_143022.db"
                        className="bc-input"
                        style={{ flex: '1 1 360px' }}
                      />
                      <button onClick={findLatestBackup} className="bc-btn bc-btn-outline" type="button">
                        Find Latest
                      </button>
                      <button onClick={browseBackupFile} className="bc-btn bc-btn-outline" type="button">
                        Browse
                      </button>
                    </div>
                    <div style={{ marginTop: 6, color: 'var(--app-text-secondary)', fontSize: 12 }}>File must end with .db</div>
                  </div>

                  <div className="bc-card" style={{ borderRadius: 8, padding: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--app-text)' }}>Restore steps</div>
                    <div style={{ color: 'var(--app-text-secondary)', fontSize: 12 }}>
                      1) Choose the .db file created by Create Backup.
                    </div>
                    <div style={{ color: 'var(--app-text-secondary)', fontSize: 12 }}>
                      2) Click Continue and review the confirmation details.
                    </div>
                    <div style={{ color: 'var(--app-text-secondary)', fontSize: 12 }}>
                      3) Confirm to replace current data with the backup.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setRestoreStep(1)} className="bc-btn bc-btn-outline" type="button">
                      Back
                    </button>
                    <button
                      onClick={() => {
                        if (validateRestoreFile()) {
                          setRestoreStep(3);
                        }
                      }}
                      className="bc-btn bc-btn-primary"
                      disabled={!restoreFilePath.trim()}
                      type="button"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {restoreStep === 3 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: 'var(--app-text)' }}>Final Confirmation</div>

                  <div className="bc-card" style={{ borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ color: 'var(--app-text-secondary)', fontSize: 13 }}>
                      <div><strong>From:</strong> {restoreFilePath}</div>
                      <div><strong>Action:</strong> Replace all current data with backup data</div>
                      <div><strong>Safety:</strong> Current database will be backed up automatically</div>
                    </div>
                  </div>

                  <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, marginBottom: 12 }}>
                    This will replace {label.client} records, {label.unit} data, sales, catalog items, and financial records.
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setRestoreStep(2)} className="bc-btn bc-btn-outline" type="button">
                      Back
                    </button>
                    <button onClick={performRestore} className="bc-btn bc-btn-primary" disabled={isRestoring} type="button">
                      {isRestoring ? 'Restoring Database…' : 'Yes, Restore Database'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;