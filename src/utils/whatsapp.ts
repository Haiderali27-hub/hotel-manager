/**
 * WhatsApp Messaging Utilities (Phase 5: Offline Messaging)
 * 
 * This module provides functions to generate WhatsApp deep links for sending
 * receipts and messages without requiring an internet connection or SMS API.
 * It uses the wa.me URL scheme to open WhatsApp Desktop/Mobile app.
 */

export interface CartItem {
  name: string;
  quantity: number;
  price: number;
}

/**
 * Clean and format phone number for WhatsApp
 * Removes all non-numeric characters and ensures proper format
 */
export const cleanPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  return phone.replace(/[^0-9]/g, '');
};

/**
 * Generate WhatsApp link for sending a receipt
 * 
 * @param phone Customer's phone number (will be cleaned automatically)
 * @param customerName Customer's name
 * @param items Array of cart items
 * @param total Total amount
 * @param businessName Name of the business (from settings)
 * @param currencySymbol Currency symbol (e.g., "$", "€", "₹")
 * @returns WhatsApp deep link URL
 */
export const generateReceiptLink = (
  phone: string,
  customerName: string,
  items: CartItem[],
  total: number,
  businessName: string = 'Our Business',
  currencySymbol: string = '$'
): string => {
  // Clean phone number
  const cleanPhone = cleanPhoneNumber(phone);

  if (!cleanPhone) {
    throw new Error('Invalid phone number provided');
  }

  // Build message text
  let text = `Hi ${customerName}, thanks for visiting ${businessName}!\n\n`;
  text += `📄 *Your Receipt*\n`;
  text += `${'='.repeat(30)}\n`;
  
  items.forEach(item => {
    const lineTotal = item.price * item.quantity;
    text += `${item.name}\n`;
    text += `  ${item.quantity} × ${currencySymbol}${item.price.toFixed(2)} = ${currencySymbol}${lineTotal.toFixed(2)}\n`;
  });
  
  text += `${'='.repeat(30)}\n`;
  text += `*TOTAL: ${currencySymbol}${total.toFixed(2)}*\n\n`;
  text += `Thank you for your business! 🙏\n`;
  text += `See you soon! 👋`;

  // Encode message for URL
  const encodedMessage = encodeURIComponent(text);

  // Return WhatsApp deep link
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};

/**
 * Generate WhatsApp link for loyalty points notification
 * 
 * @param phone Customer's phone number
 * @param customerName Customer's name
 * @param pointsEarned Points earned from this transaction
 * @param totalPoints Total points balance after transaction
 * @param businessName Name of the business
 * @returns WhatsApp deep link URL
 */
export const generateLoyaltyPointsLink = (
  phone: string,
  customerName: string,
  pointsEarned: number,
  totalPoints: number,
  businessName: string = 'Our Business'
): string => {
  const cleanPhone = cleanPhoneNumber(phone);

  if (!cleanPhone) {
    throw new Error('Invalid phone number provided');
  }

  // Build message text
  let text = `Hi ${customerName}! 🎉\n\n`;
  text += `You just earned *${pointsEarned} points* at ${businessName}!\n\n`;
  text += `💎 *Your Total Points: ${totalPoints}*\n\n`;
  text += `Keep collecting points for amazing rewards! 🎁\n`;
  text += `See you again soon! 👋`;

  // Encode message for URL
  const encodedMessage = encodeURIComponent(text);

  // Return WhatsApp deep link
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};

/**
 * Generate WhatsApp link for a promotional message
 * 
 * @param phone Customer's phone number
 * @param customerName Customer's name
 * @param promoMessage Custom promotional message
 * @param businessName Name of the business
 * @returns WhatsApp deep link URL
 */
export const generatePromoLink = (
  phone: string,
  customerName: string,
  promoMessage: string,
  businessName: string = 'Our Business'
): string => {
  const cleanPhone = cleanPhoneNumber(phone);

  if (!cleanPhone) {
    throw new Error('Invalid phone number provided');
  }

  // Build message text
  let text = `Hi ${customerName}! 🌟\n\n`;
  text += `${promoMessage}\n\n`;
  text += `- ${businessName}\n`;
  text += `We hope to see you soon! 💙`;

  // Encode message for URL
  const encodedMessage = encodeURIComponent(text);

  // Return WhatsApp deep link
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};

/**
 * Open WhatsApp link in a new window/tab
 * This will trigger the WhatsApp Desktop app to open if installed,
 * or open WhatsApp Web in the browser
 * 
 * @param whatsappUrl The WhatsApp deep link URL
 */
export const openWhatsApp = (whatsappUrl: string): void => {
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
};
