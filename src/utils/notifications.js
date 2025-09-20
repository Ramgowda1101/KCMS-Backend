// Placeholder notification service
// Later we can integrate Redis, Nodemailer, or Socket.io

const sendNotification = async (message, recipients = "all") => {
  try {
    // For now, just log the notification
    console.log(`📢 Notification to [${recipients}]: ${message}`);

    // TODO: Replace this with Redis Queue or Email service
    return true;
  } catch (error) {
    console.error("❌ Failed to send notification:", error.message);
    return false;
  }
};

module.exports = { sendNotification };