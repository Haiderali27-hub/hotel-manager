/**
 * UpdateChecker - runs silently in the background on app start.
 * If a new version is found and the dialog option is true in tauri.conf.json,
 * Tauri shows the native OS prompt automatically.
 * This component just triggers the check; no visible UI unless an update exists.
 *
 * Minor updates (same major, e.g. 1.0.0 → 1.1.0) → download + install automatically (free).
 * Major updates (e.g. 1.x → 2.x) → user is prompted, directed to purchase a new license key.
 */
import { check } from '@tauri-apps/plugin-updater';
import React, { useEffect } from 'react';

const UpdateChecker: React.FC = () => {
  useEffect(() => {
    const runCheck = async () => {
      try {
        const update = await check();
        if (!update) return;

        // Parse major versions
        const currentMajor = parseInt((update.currentVersion ?? '1').split('.')[0], 10);
        const newMajor = parseInt(update.version.split('.')[0], 10);

        if (newMajor > currentMajor) {
          // Major version — don't auto-install, just log.
          // The native dialog (configured in tauri.conf.json) will prompt the user.
          console.info(`[INERTIA] Major update available: ${update.version}. A new license key will be required.`);
        } else {
          // Minor / patch — download and install silently
          console.info(`[INERTIA] Update available: ${update.version}. Installing...`);
          await update.downloadAndInstall();
        }
      } catch (e) {
        // Silently ignore — update check should never crash the app
        console.warn('[INERTIA] Update check failed (offline?)', e);
      }
    };

    // Delay 5 s so the UI loads first
    const timer = setTimeout(runCheck, 5000);
    return () => clearTimeout(timer);
  }, []);

  return null;
};

export default UpdateChecker;
