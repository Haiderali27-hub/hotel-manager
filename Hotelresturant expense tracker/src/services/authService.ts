import { invoke } from '@tauri-apps/api/core';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  session_token?: string;
  admin_id?: number;
}

export interface SessionValidation {
  valid: boolean;
  admin_id?: number;
  message: string;
}

class AuthService {
  private sessionToken: string | null = null;
  private adminId: number | null = null;

  constructor() {
    // Load session from localStorage on initialization
    this.loadSession();
  }

  private saveSession(token: string, adminId: number): void {
    this.sessionToken = token;
    this.adminId = adminId;
    localStorage.setItem('hotel_session_token', token);
    localStorage.setItem('hotel_admin_id', adminId.toString());
  }

  private loadSession(): void {
    this.sessionToken = localStorage.getItem('hotel_session_token');
    const adminIdStr = localStorage.getItem('hotel_admin_id');
    this.adminId = adminIdStr ? parseInt(adminIdStr) : null;
  }

  private clearSession(): void {
    this.sessionToken = null;
    this.adminId = null;
    localStorage.removeItem('hotel_session_token');
    localStorage.removeItem('hotel_admin_id');
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response: LoginResponse = await invoke('login', {
        username,
        password,
      });

      if (response.success && response.session_token && response.admin_id) {
        this.saveSession(response.session_token, response.admin_id);
      }

      return response;
    } catch (error) {
      console.error('Login error:', error);
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
      const validation: SessionValidation = await invoke('validate_session', {
        sessionToken: this.sessionToken,
      });

      if (!validation.valid) {
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

  async logout(): Promise<boolean> {
    if (!this.sessionToken) {
      return true;
    }

    try {
      const success: boolean = await invoke('logout', {
        sessionToken: this.sessionToken,
      });

      this.clearSession();
      return success;
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
