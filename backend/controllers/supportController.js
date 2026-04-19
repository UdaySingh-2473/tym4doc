const emailService = require("../services/emailService");

exports.submitSupport = async (req, res) => {
  try {
    const { subject, message } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    const { user, role } = req;
    
    // Determine the user's name and email based on their role
    let fromName = user.name || (user.firstName ? `${user.firstName} ${user.lastName}` : "User");
    let fromEmail = user.email;
    let userId = user._id;

    await emailService.sendSupportTicket({
      fromName,
      fromEmail,
      fromRole: role,
      subject,
      message,
      userId
    });

    res.status(200).json({ message: "Support request sent successfully" });
  } catch (err) {
    console.error("Support submission error:", err);
    res.status(500).json({ error: "Failed to send support request" });
  }
};
