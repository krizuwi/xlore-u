import { config } from "../src/config.js";
import { isEmailDeliveryEnabled, verifyEmailTransport } from "../src/services/email.js";

if (!isEmailDeliveryEnabled()) {
  console.log("Email delivery is disabled. Account creation and password reset email will be unavailable.");
  console.log("Configure SMTP_USER, SMTP_PASS, EMAIL_FROM, then set EMAIL_ENABLED=true.");
} else {
  try {
    await verifyEmailTransport();
    console.log(`Email SMTP verification passed for ${config.email.host}:${config.email.port}.`);
  } catch (error) {
    console.error("Email SMTP verification failed.");
    console.error(`Code: ${String(error.code ?? "unavailable")}`);
    console.error(`Command: ${String(error.command ?? "unavailable")}`);
    process.exitCode = 1;
  }
}
