/**
 * Utility functions for input field handling
 */

/**
 * Handles focus event on number inputs to select all text if value is 0
 * Usage: <input type="number" onFocus={handleNumberInputFocus} ... />
 */
export const handleNumberInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  const input = e.target;
  const value = parseFloat(input.value);
  
  // If value is 0 or empty, select all text for easy replacement
  if (value === 0 || input.value === '' || input.value === '0') {
    input.select();
  }
};

/**
 * Prevents negative values in number inputs
 * Usage: <input type="number" onKeyDown={preventNegativeInput} ... />
 */
export const preventNegativeInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === '-' || e.key === 'e' || e.key === 'E') {
    e.preventDefault();
  }
};

/**
 * Formats number input on blur to ensure proper decimal places
 * Usage: <input type="number" onBlur={(e) => formatNumberOnBlur(e, 2)} ... />
 */
export const formatNumberOnBlur = (
  e: React.FocusEvent<HTMLInputElement>, 
  decimalPlaces: number = 2
) => {
  const input = e.target;
  const value = parseFloat(input.value);
  
  if (!isNaN(value)) {
    input.value = value.toFixed(decimalPlaces);
  }
};
