const nodemailer = require("nodemailer");
const fs = require("fs");

function log(msg) {
  const line = new Date().toISOString() + " " + msg + "\n";
  process.stdout.write(line);
  fs.appendFileSync("server.log", line);
}

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// Email to YOU when a new business registers
async function sendNewBusinessAlert(business, ownerEmail) {
  if (!process.env.EMAIL_USER || !process.env.ADMIN_EMAIL) return;
  try {
    await getTransporter().sendMail({
      from: `"WA Automation" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `🎉 New business registered: ${business.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <h2 style="color:#1A9268;">New Business Registered!</h2>
          <p style="color:#666;">A new business just signed up on WA Automation.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <tr><td style="padding:8px 0;color:#999;font-size:13px;">Business</td><td style="padding:8px 0;font-weight:500;">${business.name}</td></tr>
            <tr><td style="padding:8px 0;color:#999;font-size:13px;">Owner email</td><td style="padding:8px 0;">${ownerEmail}</td></tr>
            <tr><td style="padding:8px 0;color:#999;font-size:13px;">WhatsApp</td><td style="padding:8px 0;font-family:monospace;">+${business.whatsapp_number || "Not set"}</td></tr>
            <tr><td style="padding:8px 0;color:#999;font-size:13px;">Registered</td><td style="padding:8px 0;">${new Date().toLocaleString()}</td></tr>
          </table>
          <a href="${process.env.APP_URL || "https://whatsapp-automation-engine-production.up.railway.app"}/admin" style="display:inline-block;margin-top:20px;background:#1A9268;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;">View in Admin Panel</a>
        </div>
      `,
    });
    log("📧 New business alert sent to admin");
  } catch (err) {
    log("❌ Email error: " + err.message);
  }
}

// Welcome email to the business owner after registration
async function sendWelcomeEmail(ownerName, ownerEmail, businessName) {
  if (!process.env.EMAIL_USER) return;
  try {
    await getTransporter().sendMail({
      from: `"WA Automation" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: `Welcome to WA Automation, ${ownerName}! 🎉`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:48px;height:48px;background:#1A9268;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
              <span style="color:white;font-size:24px;">💬</span>
            </div>
            <h1 style="color:#141414;font-size:22px;margin:0;">Welcome, ${ownerName}!</h1>
          </div>
          <p style="color:#666;line-height:1.6;">Your <strong>${businessName}</strong> account has been created successfully. You're one step away from automating your WhatsApp customer service.</p>
          <div style="background:#F0EFE9;border-radius:12px;padding:20px;margin:20px 0;">
            <h3 style="margin:0 0 12px;font-size:15px;">Next steps:</h3>
            <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
              <span style="background:#1A9268;color:white;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;flex-shrink:0;">1</span>
              <span style="color:#444;font-size:14px;">Complete your onboarding — add prices, hours and FAQs</span>
            </div>
            <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
              <span style="background:#1A9268;color:white;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;flex-shrink:0;">2</span>
              <span style="color:#444;font-size:14px;">Scan the QR code to connect your WhatsApp number</span>
            </div>
            <div style="display:flex;gap:10px;align-items:flex-start;">
              <span style="background:#1A9268;color:white;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;flex-shrink:0;">3</span>
              <span style="color:#444;font-size:14px;">Share your WhatsApp number with customers — your bot is live!</span>
            </div>
          </div>
          <a href="${process.env.APP_URL || "https://whatsapp-automation-engine-production.up.railway.app"}/onboarding" style="display:block;text-align:center;background:#1A9268;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:500;">Complete Setup →</a>
          <p style="color:#999;font-size:12px;text-align:center;margin-top:20px;">WA Automation — Built in Nigeria 🇳🇬</p>
        </div>
      `,
    });
    log("📧 Welcome email sent to " + ownerEmail);
  } catch (err) {
    log("❌ Welcome email error: " + err.message);
  }
}

// Bot activated email
async function sendBotActivatedEmail(ownerEmail, businessName, whatsappNumber) {
  if (!process.env.EMAIL_USER) return;
  try {
    await getTransporter().sendMail({
      from: `"WA Automation" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: `✅ Your bot is LIVE on WhatsApp!`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:48px;">🎉</div>
            <h1 style="color:#141414;font-size:22px;">Your bot is live!</h1>
          </div>
          <p style="color:#666;line-height:1.6;">Congratulations! Your <strong>${businessName}</strong> WhatsApp bot is now active on <strong style="font-family:monospace;">+${whatsappNumber}</strong>.</p>
          <div style="background:#E3F5EE;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #1A9268;">
            <p style="color:#0D6147;font-size:14px;margin:0;font-weight:500;">Your bot will now automatically reply to customers 24/7. Share your WhatsApp number with your customers and watch the magic happen! ✨</p>
          </div>
          <p style="color:#666;font-size:14px;">Your bot can answer:</p>
          <ul style="color:#666;font-size:14px;line-height:1.8;padding-left:20px;">
            <li>Price enquiries</li>
            <li>Opening hours</li>
            <li>Location & directions</li>
            <li>FAQs you've set up</li>
            <li>Delivery & payment questions</li>
          </ul>
          <a href="${process.env.APP_URL || "https://whatsapp-automation-engine-production.up.railway.app"}/dashboard" style="display:block;text-align:center;background:#1A9268;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:500;margin-top:20px;">View Dashboard →</a>
        </div>
      `,
    });
    log("📧 Bot activated email sent to " + ownerEmail);
  } catch (err) {
    log("❌ Bot activated email error: " + err.message);
  }
}

module.exports = { sendNewBusinessAlert, sendWelcomeEmail, sendBotActivatedEmail };