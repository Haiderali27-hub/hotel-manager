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
  const [resetStep, setResetStep] = useState(1); // 1: Password, 2: Security Question, 3: Final Confirmation
  const [resetPassword, setResetPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [finalConfirmation, setFinalConfirmation] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState<SecurityQuestion | null>(null);

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

  // Validate password
  const validatePassword = async () => {
    try {
      const isValid = await invoke('validate_admin_password', {
        password: resetPassword
      });

      if (isValid) {
        setResetStep(2);
        setResetPassword('');
      } else {
        showError('Invalid password', 'Please enter the correct admin password');
      }
    } catch (error) {
      console.error('Password validation failed:', error);
      showError('Password validation failed', 'An error occurred while validating password');
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
      await invoke('reset_application_data');
      showSuccess('Reset Complete', 'Application data has been reset successfully');
      
      // Close dialog and refresh app
      setShowResetDialog(false);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Reset failed:', error);
      showError('Reset Failed', `Reset failed: ${error}`);
    }
  };

  // Cancel reset process
  const cancelReset = () => {
    setShowResetDialog(false);
    setResetStep(1);
    setResetPassword('');
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
                  <h4>Step 1: Admin Password</h4>
                  <p>Enter the admin password to continue:</p>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="verification-input"
                    onKeyPress={(e) => e.key === 'Enter' && validatePassword()}
                  />
                  <div className="step-buttons">
                    <button onClick={cancelReset} className="cancel-btn">Cancel</button>
                    <button onClick={validatePassword} className="verify-btn">Verify</button>
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
    </div>
  );
};

export default Settings;
