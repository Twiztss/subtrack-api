// generateEmailTemplate.jsx
export const generateEmailTemplate = ({
    userName,
    subscriptionName,
    renewalDate,
    planName,
    price,
    paymentStatus,
    accountSettingsLink,
    supportLink,
    daysLeft,
  }) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0;">
        <h2 style="color: #333;">Hello ${userName},</h2>
        <p>This is a reminder about your upcoming subscription renewal.</p>
  
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Subscription:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${subscriptionName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Plan:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${planName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Renewal Date:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${renewalDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Price:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${price}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Payment Status:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${paymentStatus}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Left:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${daysLeft} day(s)</td>
          </tr>
        </table>
  
        <p style="margin-top: 20px;">You can manage your subscription in your <a href="${accountSettingsLink}" style="color: #1a73e8;">Account Settings</a>.</p>
  
        <p>If you have any questions, please <a href="${supportLink}" style="color: #1a73e8;">Contact Support</a>.</p>
  
        <p>Thank you for choosing us!</p>
  
        <hr style="margin-top: 30px;">
        <p style="font-size: 12px; color: #777;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    `;
};

export function generateReminderSubject({ subscriptionName, daysLeft, customLabel }) {
  if (customLabel) return customLabel;
  if (daysLeft === 0) {
    return `✅ Your ${subscriptionName} Subscription Renews Today!`;
  } else if (daysLeft === 1) {
    return `⏰ Reminder: Your ${subscriptionName} Subscription Renews Tomorrow!`;
  } else {
    return `📅 Reminder: Your ${subscriptionName} Subscription Renews in ${daysLeft} Days!`;
  }
}
  
  