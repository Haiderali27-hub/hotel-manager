// Session validation utilities for secure authentication

const validateSession = (): boolean => {
  try {
    const sessionToken = localStorage.getItem('hotel_session_token');
    const sessionExpiry = localStorage.getItem('hotel_session_expiry');
    const lastActivity = localStorage.getItem('hotel_last_activity');
    
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
    localStorage.setItem('hotel_last_activity', new Date().toISOString());
    return true;
    
  } catch (error) {
    console.error('Error validating session:', error);
    clearAllAuthData();
    return false;
  }
};

const clearAllAuthData = () => {
  try {
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

