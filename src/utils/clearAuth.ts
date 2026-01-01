// Session validation utilities for secure authentication

const validateSession = (): boolean => {
  try {
    // Prefer new keys, fall back to legacy keys (and migrate if needed)
    let sessionToken = localStorage.getItem('bm_session_token');
    let sessionExpiry = localStorage.getItem('bm_session_expiry');
    let lastActivity = localStorage.getItem('bm_last_activity');

    if (!sessionToken && localStorage.getItem('hotel_session_token')) {
      sessionToken = localStorage.getItem('hotel_session_token');
      sessionExpiry = localStorage.getItem('hotel_session_expiry');
      lastActivity = localStorage.getItem('hotel_last_activity');

      if (sessionToken) localStorage.setItem('bm_session_token', sessionToken);
      if (sessionExpiry) localStorage.setItem('bm_session_expiry', sessionExpiry);
      if (lastActivity) localStorage.setItem('bm_last_activity', lastActivity);

      localStorage.removeItem('hotel_session_token');
      localStorage.removeItem('hotel_session_expiry');
      localStorage.removeItem('hotel_last_activity');
    }
    
    if (!sessionToken || !sessionExpiry || !lastActivity) {
      return false;
    }
    
    const currentTime = new Date().getTime();
    const expiryTime = new Date(sessionExpiry).getTime();
    const lastActivityTime = new Date(lastActivity).getTime();
    
    // Check if session has expired
    if (currentTime >= expiryTime) {
      console.log('Session expired');
      clearAllAuthData();
      return false;
    }
    
    // Check if too much time has passed since last activity (5 minutes)
    const fiveMinutesAgo = currentTime - (5 * 60 * 1000);
    if (lastActivityTime < fiveMinutesAgo) {
      console.log('Session invalid - too much time since last activity');
      clearAllAuthData();
      return false;
    }
    
    // Update last activity if session is valid
    localStorage.setItem('bm_last_activity', new Date().toISOString());
    return true;
    
  } catch (error) {
    console.error('Error validating session:', error);
    clearAllAuthData();
    return false;
  }
};

const clearAllAuthData = () => {
  try {
    localStorage.removeItem('bm_session_token');
    localStorage.removeItem('bm_session_expiry');
    localStorage.removeItem('bm_last_activity');
    // Cleanup legacy keys
    localStorage.removeItem('hotel_session_token');
    localStorage.removeItem('hotel_session_expiry');
    localStorage.removeItem('hotel_last_activity');
    console.log('Authentication data cleared');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};

// For testing: Force clear all auth data on app start
// Comment this out in production
// clearAllAuthData(); // TEMPORARILY DISABLED

console.log('clearAuth.ts loaded - auth clearing disabled for debugging');

export { clearAllAuthData, validateSession };

