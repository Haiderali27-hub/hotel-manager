import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import React, { useEffect, useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { labels, useLabels, type BusinessMode } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import UserManagement from './UserManagement';

interface SecurityQuestion {
  id: string;
  question: string;
  answer: string;
}

type SettingsTab = 'general' | 'users' | 'branding' | 'database';

const Settings: React.FC = () => {
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
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreStep, setRestoreStep] = useState(1); // 1: Warning, 2: File Selection, 3: Confirmation
  const [restoreFilePath, setRestoreFilePath] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  const [businessLogoPath, setBusinessLogoPath] = useState<string>('');
  const [businessLogoDataUrl, setBusinessLogoDataUrl] = useState<string>('');
  const [receiptHeader, setReceiptHeader] = useState<string>('');
  const [receiptFooter, setReceiptFooter] = useState<string>('');
  const [isSavingReceiptHeader, setIsSavingReceiptHeader] = useState(false);
  const [isSavingReceiptFooter, setIsSavingReceiptFooter] = useState(false);

  useEffect(() => {
    setPendingLocale(locale);
  }, [locale]);

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
        const [logoPath, logoDataUrl, savedHeader, savedFooter] = await Promise.all([
          invoke<string | null>('get_business_logo_path'),
          invoke<string | null>('get_business_logo_data_url'),
          invoke<string | null>('get_receipt_header'),
          invoke<string | null>('get_receipt_footer')
        ]);

        if (logoPath) setBusinessLogoPath(logoPath);
        if (logoDataUrl) setBusinessLogoDataUrl(logoDataUrl);
        setReceiptHeader(savedHeader ?? '');
        setReceiptFooter(savedFooter ?? '');
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
          { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }
        ]
      });

      if (!selected || Array.isArray(selected)) return;

      const storedPath = await invoke<string>('store_business_logo', {
        sourcePath: selected
      });

      setBusinessLogoPath(storedPath);
      try {
        const logoDataUrl = await invoke<string | null>('get_business_logo_data_url');
        setBusinessLogoDataUrl(logoDataUrl ?? '');
      } catch {
        // optional
      }
      showSuccess('Logo Updated', 'Business logo saved successfully');
    } catch (error) {
      console.error('Logo upload failed:', error);
      showError('Logo Upload Failed', `${error}`);
    }
  };

  const saveReceiptHeader = async () => {
    setIsSavingReceiptHeader(true);
    try {
      await invoke('set_receipt_header', { value: receiptHeader });
      showSuccess('Saved', 'Receipt header saved successfully');
    } catch (error) {
      console.error('Failed to save receipt header:', error);
      showError('Save Failed', `${error}`);
    } finally {
      setIsSavingReceiptHeader(false);
    }
  };

  const saveReceiptFooter = async () => {
    setIsSavingReceiptFooter(true);
    try {
      await invoke('set_receipt_footer', { value: receiptFooter });
      showSuccess('Saved', 'Receipt footer saved successfully');
    } catch (error) {
      console.error('Failed to save receipt footer:', error);
      showError('Save Failed', `${error}`);
    } finally {
      setIsSavingReceiptFooter(false);
    }
  };

  // Handle restore database with safety steps
  const handleRestoreDatabase = async () => {
    setShowRestoreDialog(true);
    setRestoreStep(1);
  };

  // Validate restore file path
  const validateRestoreFile = () => {
    if (!restoreFilePath.trim()) {
      showError('No File Path', 'Please provide the path to your backup file');
      return false;
    }

    if (!restoreFilePath.toLowerCase().endsWith('.db')) {
      showError('Invalid File Type', 'Backup file must have .db extension');
      return false;
    }

    return true;
  };

  // Perform the actual restore
  const performRestore = async () => {
    if (!validateRestoreFile()) return;

    setIsRestoring(true);
    try {
      const result = await invoke<string>('restore_database_from_backup', {
        backupFilePath: restoreFilePath.trim()
      });
      
      showSuccess('Restore Complete', result);
      setShowRestoreDialog(false);
      
      // Reset state
      setRestoreStep(1);
      setRestoreFilePath('');
      
      // Reload app after successful restore
      setTimeout(() => {
        window.location.reload();
      }, 4000); // Give user time to read the success message
      
    } catch (error) {
      console.error('Restore failed:', error);
      showError('Restore Failed', `Failed to restore database: ${error}. Your current database is safe and unchanged.`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Cancel restore process
  const cancelRestore = () => {
    setShowRestoreDialog(false);
    setRestoreStep(1);
    setRestoreFilePath('');
    setIsRestoring(false);
  };

  // Find latest backup file
  const findLatestBackup = async () => {
    try {
      const latestBackup = await invoke<string>('select_backup_file');
      setRestoreFilePath(latestBackup);
      showSuccess('Latest Backup Found', 'Most recent backup file has been selected automatically.');
    } catch (error) {
      console.error('Failed to find backup:', error);
      showError('No Backups Found', `${error}`);
    }
  };

  // Browse for backup file
  const browseBackupFile = async () => {
    try {
      const selectedFile = await invoke<string>('browse_backup_file');
      setRestoreFilePath(selectedFile);
      showSuccess('Backup File Selected', 'Backup file has been selected successfully.');
    } catch (error) {
      console.error('Browse backup result:', error);
      // The "error" actually contains helpful information about available files
      showSuccess('Available Backup Files', `${error}`);
    }
  };

  // Handle database backup
  const handleBackupDB = async () => {
    try {
      await invoke('backup_database', {
        backupPath: `C:\\Users\\DELL\\Desktop`
      });
      showSuccess('Database Backup', 'Database backup saved successfully');
    } catch (error) {
      console.error('Backup failed:', error);
      showError('Backup Failed', 'Failed to create database backup');
    }
  };

  // Handle JSON backup
  const handleBackupJSON = async () => {
    try {
      await invoke('export_json_backup', {
        backupPath: `C:\\Users\\DELL\\Desktop`
      });
      showSuccess('JSON Backup', 'JSON backup saved successfully');
    } catch (error) {
      console.error('JSON backup failed:', error);
      showError('Backup Failed', 'Failed to create JSON backup');
    }
  };

  // Handle combined backup (both DB and JSON)
  const handleBackupData = async () => {
    setIsBackingUp(true);
    try {
      await handleBackupDB();
      await handleBackupJSON();
      showSuccess('Backup Complete', 'Both database and JSON backups created successfully');
    } catch (error) {
      console.error('Backup failed:', error);
      showError('Backup Failed', 'Failed to create backups');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Start reset process
  const startResetProcess = async () => {
    try {
      // Get security question from backend
      const question = await invoke('get_reset_security_question') as SecurityQuestion;
      setSecurityQuestion(question);
      setShowResetDialog(true);
      setResetStep(1);
    } catch (error) {
      console.error('Failed to get security question:', error);
      showError('Failed to initialize reset process', 'Failed to get security question');
    }
  };

  // Validate safety phrase
  const validateSafetyPhrase = () => {
    const requiredPhrase = "I UNDERSTAND THE RISKS";
    
    if (safetyPhrase.trim().toUpperCase() === requiredPhrase) {
      setResetStep(2);
      setSafetyPhrase('');
    } else {
      showError('Incorrect safety phrase', `Please type "${requiredPhrase}" exactly to proceed`);
    }
  };

  // Validate security question
  const validateSecurityQuestion = async () => {
    try {
      const isValid = await invoke('validate_security_answer', {
        questionId: securityQuestion?.id,
        answer: securityAnswer
      });

      if (isValid) {
        setResetStep(3);
        setSecurityAnswer('');
      } else {
        showError('Incorrect security answer', 'Please provide the correct answer');
      }
    } catch (error) {
      console.error('Security validation failed:', error);
      showError('Security validation failed', 'An error occurred during validation');
    }
  };

  // Final reset confirmation
  const performReset = async () => {
    if (finalConfirmation !== 'DELETE ALL DATA') {
      showError('Invalid confirmation', 'Please type "DELETE ALL DATA" exactly to confirm');
      return;
    }

    try {
      // Show processing message
      showSuccess('Processing', 'Creating backup and resetting data...');
      
      // Call the enhanced reset function (it will create backup automatically)
      const result = await invoke<string>('reset_application_data');
      
      showSuccess('Reset Complete', `${result} You can find the automatic backup in the app's backup folder.`);
      
      // Close dialog and refresh app
      setShowResetDialog(false);
      setTimeout(() => {
        window.location.reload();
      }, 3000); // Give user time to read the backup message
    } catch (error) {
      console.error('Reset failed:', error);
      showError('Reset Failed', `Reset failed: ${error}. Your data is safe - no changes were made.`);
    }
  };

  // Cancel reset process
  const cancelReset = () => {
    setShowResetDialog(false);
    setResetStep(1);
    setSafetyPhrase('');
    setSecurityAnswer('');
    setFinalConfirmation('');
    setSecurityQuestion(null);
  };

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div className="bc-card" style={{ borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--app-text)' }}>Settings</h1>
            <div style={{ marginTop: 4, fontSize: 14, color: 'var(--app-text-secondary)' }}>
              Manage your application settings
            </div>
          </div>
        </div>
      </div>

      <div className="bc-card" style={{ borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={activeTab === 'general' ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            type="button"
            className={activeTab === 'users' ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            type="button"
            className={activeTab === 'branding' ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'}
            onClick={() => setActiveTab('branding')}
          >
            Branding
          </button>
          <button
            type="button"
            className={activeTab === 'database' ? 'bc-btn bc-btn-primary' : 'bc-btn bc-btn-outline'}
            onClick={() => setActiveTab('database')}
          >
            Database
          </button>
        </div>
      </div>

      {activeTab === 'general' && (
        <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--app-text)' }}>General</div>

          <div style={{ display: 'grid', gap: 14 }}>
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
              <div style={{ marginTop: 6, color: 'var(--app-text-secondary)', fontSize: 12 }}>
                This sets the language and regional format for dates, numbers, and currency display throughout the app.
              </div>
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
                      'Business type is locked after first-time setup to avoid conflicts. Use Reset Application Data to change it.'
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
              <div style={{ marginTop: 6, color: 'var(--app-text-secondary)', fontSize: 12 }}>
                This changes terminology throughout the app: {label.unit}, {label.client}, {label.action}, {label.actionOut}
              </div>
              {businessModeLocked ? (
                <div style={{ marginTop: 6, color: 'var(--app-text-secondary)', fontSize: 12 }}>
                  Business type is locked to prevent UI/data conflicts. To change it, use <strong>Reset Application Data</strong>.
                </div>
              ) : null}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text-secondary)' }}>Retail Options</div>
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
              <div style={{ marginTop: 6, color: 'var(--app-text-secondary)', fontSize: 12 }}>
                Turn this off if your shop does not use barcodes. Product SKU/barcode fields will be hidden and POS will stop matching on barcode.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--app-text)' }}>Users</div>
          <UserManagement embedded />
        </div>
      )}

      {activeTab === 'branding' && (
        <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--app-text)' }}>Branding</div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text-secondary)' }}>Business Logo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="bc-btn bc-btn-primary" onClick={handleUploadLogo} type="button">
                  Upload Logo
                </button>
                {businessLogoDataUrl ? (
                  <img src={businessLogoDataUrl} alt="Logo preview" style={{ height: 48, maxWidth: 140, objectFit: 'contain' }} />
                ) : null}
                <div style={{ color: 'var(--app-text-secondary)', fontSize: 12, maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {businessLogoPath || 'No logo set'}
                </div>
              </div>
              <div style={{ marginTop: 8, color: 'var(--app-text-secondary)', fontSize: 12 }}>
                This logo will appear on receipts and can be used in your business materials. It does not replace the Inertia branding.
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text-secondary)' }}>Receipt Header</div>
              <textarea
                value={receiptHeader}
                onChange={(e) => setReceiptHeader(e.target.value)}
                placeholder="Shown near the top of receipts (optional)"
                className="bc-input"
                style={{ minHeight: 90, resize: 'vertical' }}
              />
              <div style={{ marginTop: 10 }}>
                <button className="bc-btn bc-btn-primary" onClick={saveReceiptHeader} type="button" disabled={isSavingReceiptHeader}>
                  {isSavingReceiptHeader ? 'Saving…' : 'Save Header'}
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--app-text-secondary)' }}>Receipt Footer</div>
              <textarea
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="Shown at the bottom of receipts (optional)"
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
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: 'var(--app-text)' }}>Backup</div>
            <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, marginBottom: 12 }}>
              Export your data to an external location for safekeeping.
            </div>
            <div style={{ color: 'var(--app-text-secondary)', fontSize: 12, marginBottom: 12 }}>
              Includes: {label.client} records, {label.unit} data, sales, catalog items, financial records, users, and settings.
            </div>
            <button className="bc-btn bc-btn-primary" onClick={handleBackupData} disabled={isBackingUp}>
              {isBackingUp ? 'Creating Backup…' : 'Create Backup'}
            </button>
          </div>

          <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: 'var(--app-text)' }}>Restore</div>
            <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, marginBottom: 12 }}>
              Restore your data from a previously created backup file. Your current data will be backed up automatically before restore.
            </div>
            <button className="bc-btn bc-btn-primary" onClick={handleRestoreDatabase}>
              Restore from Backup
            </button>
          </div>

          <div className="bc-card" style={{ borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: 'var(--app-text)' }}>Reset</div>
            <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, marginBottom: 12 }}>
              This will permanently delete ALL data including {label.client.toLowerCase()} records, {label.unit.toLowerCase()} records, sales, and settings.
            </div>
            <button className="bc-btn bc-btn-primary" onClick={startResetProcess}>
              Reset Application Data
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div className="bc-modal-overlay" role="dialog" aria-modal="true">
          <div className="bc-modal">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderBottom: '1px solid var(--app-border)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text)' }}>Security Verification</div>
              <button className="bc-btn bc-btn-outline" onClick={cancelReset} type="button">
                Close
              </button>
            </div>

            <div style={{ padding: 16 }}>
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

      {/* Restore Dialog */}
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
                        placeholder="C:\\Users\\YourName\\Desktop\\business_backup_20250905_143022.db"
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
