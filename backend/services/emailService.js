const nodemailer = require("nodemailer");

const LOGO_HTML = '<span style="color:#0d9488;">Tym</span><span style="color:#ef4444;">4</span><span style="color:#0d9488;">DOC</span>';
const FROM = () => `"Tym4DOC" <${process.env.SMTP_USER}>`;

// Common extra headers to suppress Gmail auto-formatting (calendar cards, event icons)
const HEADERS = {
  "X-Entity-Ref-ID": "notspecified",
  "X-Auto-Response-Suppress": "All",
};

let _transporter;
function transporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || "smtp.gmail.com",
      port:   parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return _transporter;
}

// Format YYYY-MM-DD as "15 Apr 2026" to prevent Gmail from auto-rendering calendar icons
function formatDate(d) {
  if (!d) return d;
  // If it's an object like { date: "2026-04-15" }, extract the date string
  const ds = typeof d === "object" ? (d.date || String(d)) : String(d);
  const parts = ds.split("-");
  if (parts.length !== 3) return ds;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = months[parseInt(parts[1], 10) - 1] || parts[1];
  return `${parseInt(parts[2], 10)} ${month} ${parts[0]}`;
}

function wrap(content) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;"><div style="background:#f1f5f9;padding:20px 28px;"><h2 style="color:#0f172a;margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:1px;">${LOGO_HTML}</h2></div><div style="padding:28px;color:#334155;">${content}</div><div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">Tym4DOC. Automated email — do not reply.</div></div>`;
}
function renderDataRow(l,v){ return v ? `<tr><td style="padding:7px 12px;color:#64748b;font-size:13px;">${l}</td><td style="padding:7px 12px;font-weight:600;font-size:13px;">${v}</td></tr>` : ""; }
function renderTemplateTable(...r){ return `<table style="width:100%;border-collapse:collapse;background:#f0fdfa;border-radius:8px;margin:16px 0;">${r.join("")}</table>`; }

exports.sendBookingConfirm = async (to, {patientName,doctorName,specialty,date,time}) => {
  await transporter().sendMail({ from:FROM(), to, subject:`Tym4DOC — Appointment Confirmed with ${doctorName}`,
    headers: HEADERS,
    html: wrap(`<h3 style="color:#10b981;margin-top:0;">Appointment Confirmed</h3><p>Hi <strong>${patientName}</strong>, your appointment has been confirmed.</p>${renderTemplateTable(renderDataRow("Doctor",doctorName),renderDataRow("Specialty",specialty),renderDataRow("Date",formatDate(date)),renderDataRow("Time",time),renderDataRow("Status","Confirmed"))}<p style="font-size:13px;color:#64748b;">Please arrive 10 minutes early.</p>`) });
};


exports.sendCancellationNotice = async (to, {patientName,doctorName,date,time,rescheduleSuggest,refundInitiated}) => {
  const suggestDisplay = rescheduleSuggest
    ? formatDate(typeof rescheduleSuggest === "object" ? rescheduleSuggest.date : rescheduleSuggest)
    : null;
  await transporter().sendMail({ from:FROM(), to, subject:`Tym4DOC — Appointment Cancelled`,
    headers: HEADERS,
    html: wrap(`<h3 style="color:#dc2626;margin-top:0;">Appointment Cancelled</h3><p>Hi <strong>${patientName}</strong>, your appointment with <strong>${doctorName}</strong> on ${formatDate(date)} at ${time} has been cancelled.</p>${suggestDisplay?`<div style="background:#f0fdfa;border-radius:8px;padding:12px 16px;margin:12px 0;"><strong>Suggested Reschedule:</strong> ${suggestDisplay}</div>`:""}${refundInitiated?`<div style="background:#ecfdf5;border-radius:8px;padding:12px 16px;margin:12px 0;color:#0d9488;"><strong>Refund Initiated</strong> — Credit within 5-7 business days.</div>`:""}<p style="font-size:13px;color:#64748b;">Book a new appointment anytime from your dashboard.</p>`) });
};

exports.sendRescheduleNotice = async (to, {patientName, doctorName, oldDate, oldTime, newDate, newTime}) => {
  await transporter().sendMail({ from:FROM(), to, subject:`Tym4DOC — Appointment Rescheduled`,
    headers: HEADERS,
    html: wrap(`<h3 style="color:#0284c7;margin-top:0;">Appointment Rescheduled</h3><p>Hi <strong>${patientName}</strong>, your appointment has been rescheduled.</p>${renderTemplateTable(renderDataRow("Doctor",doctorName),renderDataRow("Previous",`${formatDate(oldDate)} at ${oldTime}`),renderDataRow("New Slot",`${formatDate(newDate)} at ${newTime}`),renderDataRow("Status","Confirmed"))}<p style="font-size:13px;color:#64748b;">Please arrive 10 minutes before your new slot time.</p>`) });
};

exports.sendClinicBookingNotice = async (to, {clinicName, patientName, doctorName, specialty, date, time}) => {
  await transporter().sendMail({ from:FROM(), to, subject:`Tym4DOC — New Appointment for ${doctorName}`,
    headers: HEADERS,
    html: wrap(`<h3 style="color:#10b981;margin-top:0;">New Appointment Booked</h3><p>Hi <strong>${clinicName || 'Clinic Team'}</strong>, a new appointment has been booked.</p>${renderTemplateTable(renderDataRow("Patient",patientName),renderDataRow("Doctor",doctorName),renderDataRow("Specialty",specialty),renderDataRow("Date",formatDate(date)),renderDataRow("Time",time),renderDataRow("Status","Confirmed"))}<p style="font-size:13px;color:#64748b;">Please ensure the doctor is available.</p>`) });
};

exports.sendClinicCancellationNotice = async (to, {clinicName, patientName, doctorName, date, time, cancelledBy}) => {
  await transporter().sendMail({ from:FROM(), to, subject:`Tym4DOC — Appointment Cancelled`,
    headers: HEADERS,
    html: wrap(`<h3 style="color:#dc2626;margin-top:0;">Appointment Cancelled</h3><p>Hi <strong>${clinicName || 'Clinic Team'}</strong>, an appointment has been cancelled by the <strong>${cancelledBy || 'user'}</strong>.</p>${renderTemplateTable(renderDataRow("Patient",patientName),renderDataRow("Doctor",doctorName),renderDataRow("Date",formatDate(date)),renderDataRow("Time",time))}<p style="font-size:13px;color:#64748b;">This slot is now open for new bookings.</p>`) });
};

exports.sendClinicRescheduleNotice = async (to, {clinicName, patientName, doctorName, oldDate, oldTime, newDate, newTime}) => {
  await transporter().sendMail({ from:FROM(), to, subject:`Tym4DOC — Appointment Rescheduled`,
    headers: HEADERS,
    html: wrap(`<h3 style="color:#0284c7;margin-top:0;">Appointment Rescheduled</h3><p>Hi <strong>${clinicName || 'Clinic Team'}</strong>, an appointment has been rescheduled.</p>${renderTemplateTable(renderDataRow("Patient",patientName),renderDataRow("Doctor",doctorName),renderDataRow("Previous",`${formatDate(oldDate)} at ${oldTime}`),renderDataRow("New Slot",`${formatDate(newDate)} at ${newTime}`),renderDataRow("Status","Confirmed"))}<p style="font-size:13px;color:#64748b;">Please update your records accordingly.</p>`) });
};


exports.sendPasswordResetLink = async (to, token, role, name="User") => {
  const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${token}&role=${role}`;
  await transporter().sendMail({ from:FROM(), to, subject:"Tym4DOC — Reset Your Password",
    headers: HEADERS,
    html: wrap(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>You requested to reset your password. Click the button below to set a new one. This link is valid for <strong>10 minutes</strong>.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${resetUrl}" style="background:#0d9488;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Reset Password</a>
      </div>
      <p style="font-size:12px;color:#94a3b8;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size:11px;word-break:break-all;color:#0d9488;">${resetUrl}</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px;">If you did not request this, please ignore this email.</p>
    `) });
};

exports.sendVerificationEmailLink = async (to, token, role, name="User") => {
  const verifyUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-email?token=${token}&role=${role}`;
  await transporter().sendMail({ from:FROM(), to, subject:"Tym4DOC — Please Verify Your Email",
    headers: HEADERS,
    html: wrap(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>Thank you for using ${LOGO_HTML}! Please confirm your email address by clicking the button below. This link is valid for <strong>10 minutes</strong>.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${verifyUrl}" style="background:#0d9488;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Verify Email Address</a>
      </div>
      <p style="font-size:12px;color:#94a3b8;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size:11px;word-break:break-all;color:#0d9488;">${verifyUrl}</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px;">If you did not sign up for ${LOGO_HTML}, please ignore this email.</p>
    `) });
};

exports.sendAppointmentReminder = async (to, {patientName, doctorName, date, time, msg}) => {
  await transporter().sendMail({ from:FROM(), to, subject:`Tym4DOC — Appointment Reminder`,
    headers: HEADERS,
    html: wrap(`<h3 style="color:#0d9488;margin-top:0;">Appointment Reminder</h3><p>${msg}</p>${renderTemplateTable(renderDataRow("Doctor",doctorName),renderDataRow("Date",formatDate(date)),renderDataRow("Time",time))}<p style="font-size:13px;color:#64748b;">You can manage your bookings from your dashboard.</p>`) });
};

exports.sendSupportTicket = async ({ fromName, fromEmail, fromRole, subject, message, userId }) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  await transporter().sendMail({
    from: fromEmail,
    to: adminEmail,
    replyTo: fromEmail,
    subject: `Support Request: ${subject} (${fromRole})`,
    headers: HEADERS,
    html: wrap(`
      <h3 style="color:#0d9488;margin-top:0;">New Support Request</h3>
      <p>A new support ticket has been submitted from the <strong>${fromRole}</strong> dashboard.</p>
      ${renderTemplateTable(
        renderDataRow("From", fromName),
        renderDataRow("Email", fromEmail),
        renderDataRow("Role", fromRole),
        renderDataRow("User ID", userId),
        renderDataRow("Subject", subject)
      )}
      <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin-top:16px;white-space:pre-wrap;color:#0f172a;font-size:14px;border-left:4px solid #0d9488;">
        <strong>Message:</strong><br/>
        ${message}
      </div>
      <p style="font-size:13px;color:#64748b;margin-top:20px;">You can reply directly to this user by clicking "Reply" or email: <a href="mailto:${fromEmail}">${fromEmail}</a></p>
    `)
  });
};
