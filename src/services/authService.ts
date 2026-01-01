import { invoke } from '@tauri-apps/api/core';

const authDebugEnabled = (): boolean => {
  return Boolean(import.meta.env.DEV) && String(import.meta.env.VITE_AUTH_DEBUG) === '1';
};

const authDebug = (event: string, details?: Record<string, unknown>): void => {
  if (!authDebugEnabled()) return;
  if (details) {
    console.debug(`[auth] ${event}`, details);
  } else {
    console.debug(`[auth] ${event}`);
  }
};

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  session_token?: string;
  admin_id?: number;
  role?: string;
}

export interface SessionValidation {
  valid: boolean;
  admin_id?: number;
  message: string;
}

export interface SecurityQuestionResponse {
  success: boolean;
  question?: string;
  message: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

class AuthService {
  private sessionToken: string | null = null;
  private adminId: number | null = null;
  private userRole: string | null = null;

  constructor() {
    // Load session from localStorage on initialization
    this.loadSession();
  }

  private saveSession(token: string, adminId: number, role?: string): void {
    this.sessionToken = token;
    this.adminId = adminId;
    this.userRole = role || 'admin';
    localStorage.setItem('bm_session_token', token);
    localStorage.setItem('bm_admin_id', adminId.toString());
    localStorage.setItem('bm_user_role', this.userRole);
    // Cleanup legacy keys
    localStorage.removeItem('hotel_session_token');
    localStorage.removeItem('hotel_admin_id');
  }

  private loadSession(): void {
    const token = localStorage.getItem('bm_session_token');
    const adminIdStr = localStorage.getItem('bm_admin_id');
    const role = localStorage.getItem('bm_user_role');

    if (token) {
      this.sessionToken = token;
      this.adminId = adminIdStr ? parseInt(adminIdStr) : null;
      this.userRole = role || 'admin';
      return;
    }

    // Migrate legacy session keys if present
    const legacyToken = localStorage.getItem('hotel_session_token');
    const legacyAdminIdStr = localStorage.getItem('hotel_admin_id');
    if (legacyToken) {
      localStorage.setItem('bm_session_token', legacyToken);
      if (legacyAdminIdStr) {
        localStorage.setItem('bm_admin_id', legacyAdminIdStr);
      }
      // Default to admin for legacy sessions
      localStorage.setItem('bm_user_role', 'admin');
      localStorage.removeItem('hotel_session_token');
      localStorage.removeItem('hotel_admin_id');

      this.sessionToken = legacyToken;
      this.adminId = legacyAdminIdStr ? parseInt(legacyAdminIdStr) : null;
      this.userRole = 'admin';
      return;
    }

    this.sessionToken = null;
    this.adminId = null;
    this.userRole = null;
  }

  private clearSession(): void {
    this.sessionToken = null;
    this.adminId = null;
    this.userRole = null;
    localStorage.removeItem('bm_session_token');
    localStorage.removeItem('bm_admin_id');
    localStorage.removeItem('bm_user_role');
    // Cleanup legacy keys
    localStorage.removeItem('hotel_session_token');
    localStorage.removeItem('hotel_admin_id');
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const normalizedUsername = username.trim();
      const requestPayload = {
        request: {
          username: normalizedUsername,
          password,
        },
      };

      authDebug('login.invoke', {
        username: normalizedUsername,
        usernameLength: normalizedUsername.length,
      });

      const response: LoginResponse = await invoke('login_admin', requestPayload);

      authDebug('login.response', {
        success: response.success,
        message: response.message,
        hasSessionToken: Boolean(response.session_token),
        adminId: response.admin_id ?? null,
        role: response.role ?? null,
      });

      if (response.success && response.session_token && response.admin_id) {
        authDebug('session.save', {
          adminId: response.admin_id,
          role: response.role ?? 'admin',
        });
        this.saveSession(response.session_token, response.admin_id, response.role);
      }

      return response;
    } catch (error) {
      authDebug('login.error');
      console.error('[auth] login.error', error);
      return {
        success: false,
        message: 'Network error occurred during login',
      };
    }
  }

  async validateSession(): Promise<boolean> {
    if (!this.sessionToken) {
      return false;
    }

    try {
      const isValid: boolean = await invoke('validate_admin_session', {
        sessionToken: this.sessionToken,
      });

      if (!isValid) {
        this.clearSession();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      this.clearSession();
      return false;
    }
  }

  async getSecurityQuestion(username: string): Promise<SecurityQuestionResponse> {
    try {
      const normalizedUsername = username.trim();
      authDebug('securityQuestion.invoke', { username: normalizedUsername });
      const response: SecurityQuestionResponse = await invoke('get_security_question', {
        username: normalizedUsername,
      });
      authDebug('securityQuestion.response', {
        success: response.success,
        hasQuestion: Boolean(response.question),
      });
      return response;
    } catch (error) {
      console.error('[auth] get_security_question error', error);
      return {
        success: false,
        message: 'Error retrieving security question',
      };
    }
  }

  async resetPassword(
    username: string,
    securityAnswer: string,
    newPassword: string
  ): Promise<PasswordResetResponse> {
    try {
      const normalizedUsername = username.trim();
      authDebug('resetPassword.invoke', { username: normalizedUsername });
      const response: PasswordResetResponse = await invoke('reset_admin_password', {
        request: {
          username: normalizedUsername,
          security_answer: securityAnswer,
          new_password: newPassword,
        },
      });
      authDebug('resetPassword.response', { success: response.success });
      return response;
    } catch (error) {
      console.error('[auth] reset_admin_password error', error);
      return {
        success: false,
        message: 'Error resetting password',
      };
    }
  }

  async logout(): Promise<boolean> {
    if (!this.sessionToken) {
      return true;
    }

    try {
      await invoke('logout_admin', {
        sessionToken: this.sessionToken,
      });

      this.clearSession();
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      this.clearSession();
      return false;
    }
  }

  isLoggedIn(): boolean {
    return this.sessionToken !== null && this.adminId !== null;
  }

  getAdminId(): number | null {
    return this.adminId;
  }

  getUserRole(): string | null {
    return this.userRole;
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  async cleanupSessions(): Promise<void> {
    try {
      await invoke('cleanup_sessions');
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }
}

export const authService = new AuthService();
