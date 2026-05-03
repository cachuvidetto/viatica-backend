/**
 * SmsProvider Bridge Utility
 * This handles the abstraction of sending SMS/OTP.
 * In development, it logs to console. 
 * In production, it will connect to a real SMS API (like Twilio, Vonage, or a local provider).
 */
class SmsProvider {
  /**
   * Sends an OTP or message to a phone number.
   * @param {string} phone - Target phone number
   * @param {string} message - Message content
   * @returns {Promise<boolean>}
   */
  static async send(phone, message) {
    // 1) Logic for Development / Sandbox
    if (process.env.NODE_ENV !== 'production' || phone.endsWith('0000')) {
      console.log('------------------------------------------');
      console.log(`📡 [SMS PROVISIONER]`);
      console.log(`TO: ${phone}`);
      console.log(`MESSAGE: ${message}`);
      console.log('------------------------------------------');
      
      // OPTIONAL: Send to Telegram if configured
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        try {
          const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
          const text = `🔐 *OTP جديد*\n\nالرقم: \`${phone}\`\nالكود: *${message}*`;
          
          await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: process.env.TELEGRAM_CHAT_ID,
              text: text,
              parse_mode: 'Markdown'
            })
          });
          console.log(`✅ Sent to Telegram`);
        } catch (error) {
          console.error(`❌ Failed to send to Telegram:`, error.message);
        }
      }
      
      return true;
    }

    // 2) Logic for Production (Placeholder)
    // Here you would integrate with your SMS provider API
    // If Telegram is configured for Prod as a temporary measure:
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const text = `🔐 *OTP جديد*\n\nالرقم: \`${phone}\`\nالكود: *${message}*`;
        
        await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'Markdown'
          })
        });
        return true;
      } catch (error) {
        console.error(`❌ Failed to send to Telegram:`, error.message);
      }
    }
    
    console.warn(`⚠️ SMS sending not fully configured for production. Logged to console instead.`);
    console.log(`[PROD MOCK] To ${phone}: ${message}`);
    return true;
  }
}

module.exports = SmsProvider;
