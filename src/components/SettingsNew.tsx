import { invoke } from '@tauri-apps/api/core';
import React, { useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import '../styles/SettingsNew.css';

interface SecurityQuestion {
  id: string;
  question: string;
  answer: string;
}

const Settings: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [isBackingUp, setIsBackingUp] = useState(false);
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
    <div className="settings-container">
      <div className="settings-header">
        <h1>⚙️ Settings</h1>
        <p>Manage your application data and settings</p>
      </div>

      <div className="settings-content">
        {/* Backup Section */}
        <div className="settings-section">
          <h2>📁 Data Backup</h2>
          <p>Export your hotel data to an external location for safekeeping.</p>
          
          <div className="backup-info">
            <div className="info-item">
              <span className="info-label">Includes:</span>
              <ul>
                <li>Guest records and check-ins</li>
                <li>Room information and availability</li>
                <li>Food orders and menu items</li>
                <li>Financial records and expenses</li>
                <li>User accounts and settings</li>
              </ul>
            </div>
          </div>

          <button
            className="backup-btn"
            onClick={handleBackupData}
            disabled={isBackingUp}
          >
            {isBackingUp ? (
              <>
                <span className="spinner"></span>
                Creating Backup...
              </>
            ) : (
              <>
                💾 Create Backup
              </>
            )}
          </button>
        </div>

        {/* Restore Section */}
        <div className="settings-section">
          <h2>📥 Restore Database</h2>
          <p>Restore your hotel data from a previously created backup file.</p>
          
          <div className="restore-info">
            <div className="info-item">
              <span className="info-label">Restore from:</span>
              <ul>
                <li>Database backup files (.db)</li>
                <li>Automatic backups from resets</li>
                <li>Manual backup files</li>
              </ul>
            </div>
            <div className="info-item">
              <span className="info-label">⚠️ Important:</span>
              <p>Current data will be backed up automatically before restore.</p>
            </div>
          </div>

          <button
            className="restore-btn"
            onClick={handleRestoreDatabase}
          >
            📥 Restore from Backup
          </button>
        </div>

        {/* Reset Section */}
        <div className="settings-section danger-section">
          <h2>🗑️ Reset Application Data</h2>
          <p className="danger-text">
            This will permanently delete ALL data including guests, rooms, orders, and settings.
          </p>
          
          <div className="reset-warning">
            <h3>⚠️ Warning</h3>
            <p>This action cannot be undone. Make sure you have a backup before proceeding.</p>
            <ul>
              <li>All guest records will be deleted</li>
              <li>All room and booking data will be lost</li>
              <li>All financial records will be removed</li>
              <li>Application will return to initial state</li>
            </ul>
          </div>

          <button
            className="reset-btn"
            onClick={startResetProcess}
          >
            🔄 Reset Application Data
          </button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div className="modal-overlay">
          <div className="reset-modal">
            <div className="modal-header">
              <h3>🛡️ Security Verification</h3>
              <button className="close-btn" onClick={cancelReset}>×</button>
            </div>

            <div className="modal-content">
              {resetStep === 1 && (
                <div className="verification-step">
                  <h4>Step 1: Safety Verification</h4>
                  <div className="safety-warning">
                    <p><strong>⚠️ WARNING:</strong> This action will permanently delete ALL data including:</p>
                    <ul>
                      <li>All guest records and history</li>
                      <li>All room bookings and reservations</li>
                      <li>All food orders and menu items</li>
                      <li>All financial records and expenses</li>
                      <li>All application settings</li>
                    </ul>
                    <p><strong>An automatic backup will be created before reset.</strong></p>
                  </div>
                  <p>To continue, please type the safety phrase exactly:</p>
                  <p className="required-phrase"><strong>"I UNDERSTAND THE RISKS"</strong></p>
                  <input
                    type="text"
                    value={safetyPhrase}
                    onChange={(e) => setSafetyPhrase(e.target.value)}
                    placeholder="Type the safety phrase exactly"
                    className="verification-input"
                    onKeyPress={(e) => e.key === 'Enter' && validateSafetyPhrase()}
                  />
                  <div className="step-buttons">
                    <button onClick={cancelReset} className="cancel-btn">Cancel</button>
                    <button onClick={validateSafetyPhrase} className="verify-btn">Continue</button>
                  </div>
                </div>
              )}

              {resetStep === 2 && securityQuestion && (
                <div className="verification-step">
                  <h4>Step 2: Security Question</h4>
                  <p className="security-question">{securityQuestion.question}</p>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Enter your answer"
                    className="verification-input"
                    onKeyPress={(e) => e.key === 'Enter' && validateSecurityQuestion()}
                  />
                  <div className="step-buttons">
                    <button onClick={cancelReset} className="cancel-btn">Cancel</button>
                    <button onClick={validateSecurityQuestion} className="verify-btn">Verify</button>
                  </div>
                </div>
              )}

              {resetStep === 3 && (
                <div className="verification-step">
                  <h4>Step 3: Final Confirmation</h4>
                  <div className="final-warning">
                    <p>⚠️ This is your last chance to cancel!</p>
                    <p>Type <strong>"DELETE ALL DATA"</strong> to confirm:</p>
                  </div>
                  <input
                    type="text"
                    value={finalConfirmation}
                    onChange={(e) => setFinalConfirmation(e.target.value)}
                    placeholder="Type: DELETE ALL DATA"
                    className="verification-input confirmation-input"
                    onKeyPress={(e) => e.key === 'Enter' && performReset()}
                  />
                  <div className="step-buttons">
                    <button onClick={cancelReset} className="cancel-btn">Cancel</button>
                    <button 
                      onClick={performReset} 
                      className="delete-btn"
                      disabled={finalConfirmation !== 'DELETE ALL DATA'}
                    >
                      🗑️ Delete All Data
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
        <div className="modal-overlay">
          <div className="restore-modal">
            <div className="modal-header">
              <h3>📥 Restore Database - Step {restoreStep} of 3</h3>
              <button className="close-btn" onClick={cancelRestore}>×</button>
            </div>

            <div className="modal-content">
              {restoreStep === 1 && (
                <div className="restore-warning-step">
                  <h4>⚠️ Important Safety Warning</h4>
                  <div className="critical-warning">
                    <p><strong>This operation will replace ALL your current data!</strong></p>
                    <ul>
                      <li>✅ Your current database will be automatically backed up first</li>
                      <li>✅ The backup file will be validated before restoration</li>
                      <li>✅ If anything goes wrong, your original data will be restored</li>
                      <li>⚠️ Make sure you have the correct backup file</li>
                      <li>⚠️ Only use backup files created by this application</li>
                    </ul>
                  </div>
                  
                  <div className="safety-checklist">
                    <h4>✅ Safety Features Active:</h4>
                    <ul>
                      <li>Automatic backup before restore</li>
                      <li>File integrity validation</li>
                      <li>Schema compatibility check</li>
                      <li>Functionality testing</li>
                      <li>Automatic rollback on failure</li>
                    </ul>
                  </div>

                  <div className="step-buttons">
                    <button onClick={cancelRestore} className="cancel-btn">
                      Cancel
                    </button>
                    <button 
                      onClick={() => setRestoreStep(2)} 
                      className="continue-btn"
                    >
                      Continue - I Understand the Risks
                    </button>
                  </div>
                </div>
              )}

              {restoreStep === 2 && (
                <div className="file-selection-step">
                  <h4>📁 Select Backup File</h4>
                  
                  <div className="file-info">
                    <p>Backup files are typically located in:</p>
                    <ul>
                      <li>Your Desktop folder</li>
                      <li>Downloads folder</li>
                      <li>The app's backup directory</li>
                    </ul>
                    <p>Look for files named like: <code>hotel_backup_YYYYMMDD_HHMMSS.db</code></p>
                  </div>

                  <div className="restore-path-info">
                    <label htmlFor="restorePathInput">Backup File Path:</label>
                    <div className="file-input-group">
                      <input
                        id="restorePathInput"
                        type="text"
                        value={restoreFilePath}
                        onChange={(e) => setRestoreFilePath(e.target.value)}
                        placeholder="C:\Users\YourName\Desktop\hotel_backup_20250905_143022.db"
                        className="restore-path-input"
                      />
                      <button 
                        onClick={findLatestBackup}
                        className="browse-btn"
                        type="button"
                      >
                        � Find Latest
                      </button>
                    </div>
                    <small>⚠️ File must end with .db extension</small>
                  </div>

                  <div className="step-buttons">
                    <button onClick={() => setRestoreStep(1)} className="back-btn">
                      ← Back
                    </button>
                    <button 
                      onClick={() => {
                        if (validateRestoreFile()) {
                          setRestoreStep(3);
                        }
                      }} 
                      className="continue-btn"
                      disabled={!restoreFilePath.trim()}
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              )}

              {restoreStep === 3 && (
                <div className="final-confirmation-step">
                  <h4>🔍 Final Confirmation</h4>
                  
                  <div className="restore-summary">
                    <h5>Restore Details:</h5>
                    <p><strong>From:</strong> {restoreFilePath}</p>
                    <p><strong>Action:</strong> Replace all current data with backup data</p>
                    <p><strong>Safety:</strong> Current database will be backed up automatically</p>
                  </div>

                  <div className="final-warning">
                    <h5>⚠️ Last Warning:</h5>
                    <p>This will permanently replace all your current hotel data including:</p>
                    <ul>
                      <li>Guest records and check-ins</li>
                      <li>Room information</li>
                      <li>Food orders and menu items</li>
                      <li>Financial records and expenses</li>
                    </ul>
                    <p><strong>Are you absolutely sure you want to proceed?</strong></p>
                  </div>

                  <div className="step-buttons">
                    <button onClick={() => setRestoreStep(2)} className="back-btn">
                      ← Back
                    </button>
                    <button 
                      onClick={performRestore}
                      className="restore-final-btn"
                      disabled={isRestoring}
                    >
                      {isRestoring ? (
                        <>
                          <span className="spinner"></span>
                          Restoring Database...
                        </>
                      ) : (
                        '📥 Yes, Restore Database'
                      )}
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
