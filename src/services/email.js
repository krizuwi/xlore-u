import tls from "node:tls";
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { HttpError } from "../utils/http-error.js";

const defaultRoots = typeof tls.getCACertificates === "function"
  ? tls.getCACertificates("default") : tls.rootCertificates;
const systemRoots = process.platform === "win32" && typeof tls.getCACertificates === "function"
  ? tls.getCACertificates("system") : [];

const transporter = config.email.enabled
  ? nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: { user: config.email.user, pass: config.email.password },
      tls: {
        ca: [...new Set([...defaultRoots, ...systemRoots])],
        rejectUnauthorized: true
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      disableFileAccess: true,
      disableUrlAccess: true
    })
  : null;

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function emailDocument({ preview, heading, name, code, instruction }) {
  return `<!doctype html>
<html><body style="margin:0;background:#0d1422;color:#e8edfa;font-family:Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div>
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">
    <div style="border:1px solid #2c3850;border-radius:20px;background:#141d2c;padding:36px">
      <div style="color:#7797ff;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">Xlore U</div>
      <h1 style="margin:16px 0 12px;color:#f5f7ff;font-size:28px">${escapeHtml(heading)}</h1>
      <p style="color:#aeb8cc;line-height:1.7">Hello ${escapeHtml(name)},</p>
      <p style="color:#aeb8cc;line-height:1.7">${escapeHtml(instruction)}</p>
      <div style="margin:28px 0;padding:20px;border-radius:14px;background:#0d1422;color:#87a2ff;text-align:center;font-size:34px;font-weight:900;letter-spacing:.22em">${escapeHtml(code)}</div>
      <p style="margin:0;color:#7f8aa0;font-size:13px;line-height:1.6">This code expires in 15 minutes. If you did not request it, you can ignore this email.</p>
    </div>
  </div>
</body></html>`;
}

async function deliver({ to, subject, text, html }) {
  if (!transporter) {
    throw new HttpError(503, "Email delivery is not configured. Add the SMTP settings to the backend .env file.");
  }
  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      text,
      html
    });
  } catch (error) {
    console.error("Email delivery failed:", {
      code: String(error?.code ?? ""),
      command: String(error?.command ?? ""),
      responseCode: Number(error?.responseCode ?? 0)
    });
    throw new HttpError(502, "The email could not be sent. Check the backend email configuration and try again.");
  }
}

export function isEmailDeliveryEnabled() {
  return Boolean(transporter);
}

export async function verifyEmailTransport() {
  if (!transporter) return false;
  await transporter.verify();
  return true;
}

export async function sendVerificationEmail({ to, name, code }) {
  return deliver({
    to,
    subject: "Verify your Xlore U account",
    text: `Hello ${name}, your Xlore U verification code is ${code}. It expires in 15 minutes.`,
    html: emailDocument({
      preview: `Your Xlore U verification code is ${code}`,
      heading: "Verify your email",
      name,
      code,
      instruction: "Enter this six-digit code in Xlore U to finish creating your account."
    })
  });
}

export async function sendPasswordResetEmail({ to, name, code }) {
  return deliver({
    to,
    subject: "Reset your Xlore U password",
    text: `Hello ${name}, your Xlore U password reset code is ${code}. It expires in 15 minutes.`,
    html: emailDocument({
      preview: `Your Xlore U password reset code is ${code}`,
      heading: "Reset your password",
      name,
      code,
      instruction: "Enter this six-digit code in Xlore U to choose a new password."
    })
  });
}
