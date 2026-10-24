import email.utils
import html
import logging
import os
import smtplib
import socket
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailDeliveryService:
    """Enterprise email delivery service adapter supporting authenticated SMTP with CID-embedded

    branding, 6-digit visual OTP boxes, accessible plain-text fallbacks, and dev console fallback.
    """

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST.strip()
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER.strip()
        self.smtp_password = settings.SMTP_PASSWORD.strip()
        # Fall back to authenticated SMTP user if from_email is not configured (required by Gmail)
        self.from_email = (
            settings.SMTP_FROM_EMAIL.strip()
            or self.smtp_user
            or "auth@sitechseries.org"
        )
        self.from_name = (
            settings.SMTP_FROM_NAME.strip()
            or "Sitech Series Lead Generation"
        )
        self.use_tls = settings.SMTP_USE_TLS
        self.is_production = settings.APP_ENV.lower() == "production"
        self.enable_dev_console = settings.ENABLE_DEV_OTP_CONSOLE
        self.logo_path = self._resolve_logo_path()

    def _resolve_logo_path(self) -> str | None:
        """Finds the local Sitech Series logo asset for inline CID embedding."""
        candidates = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static", "logo.png")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "logo.png")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "dist", "logo.png")),
        ]
        for path in candidates:
            if os.path.exists(path) and os.path.isfile(path):
                return path
        return None

    def verify_smtp_connection(self) -> Tuple[bool, str]:
        """Tests SMTP connectivity and authentication without dispatching an email.

        Never exposes credentials or secrets in output.
        """
        if not self.smtp_host:
            return False, "SMTP_HOST is not configured."

        server = None
        try:
            if self.smtp_port == 465:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=12)
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=12)
                if self.use_tls:
                    server.starttls()

            if self.smtp_user and self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)

            # Check server response
            status_code, _ = server.noop()
            server.quit()
            return True, f"SMTP connection and authentication verified successfully (code {status_code})."

        except smtplib.SMTPAuthenticationError:
            logger.error("SMTP Authentication failed for configured user.")
            return False, "SMTP authentication failed: Invalid username or password."
        except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected):
            logger.error("SMTP Connection failed to %s:%s", self.smtp_host, self.smtp_port)
            return False, "Could not establish connection to SMTP server."
        except (socket.timeout, TimeoutError):
            logger.error("SMTP Connection timed out to %s:%s", self.smtp_host, self.smtp_port)
            return False, "SMTP server connection timed out."
        except Exception as exc:
            logger.error("SMTP Connection test failed: %s", type(exc).__name__)
            return False, f"SMTP verification failed: {type(exc).__name__}"
        finally:
            if server:
                try:
                    server.close()
                except Exception:
                    pass

    def build_otp_email_markup(self, otp_code: str) -> Tuple[str, str]:
        """Generates the premium Sitech Series HTML and Plain-Text email bodies.

        Features:
        - 6 individual visual OTP digit boxes constructed with bulletproof HTML tables
        - Deep navy header with logo and LEAD INTELLIGENCE PORTAL subtitle
        - 10-minute expiration notice and security advisory
        - Centered 600px container with high-contrast typography
        - Plain text fallback with visual brackets representation
        """
        clean_code = str(otp_code).strip()
        # Extract 6 individual digits, padding defensively if needed
        raw_digits = list(clean_code[:6])
        while len(raw_digits) < 6:
            raw_digits.append(" ")
        escaped_digits = [html.escape(d) for d in raw_digits]

        # Construct 6 individual table cells for maximum email client compatibility (Outlook, Gmail, Apple)
        digit_cells = []
        for i, digit in enumerate(escaped_digits):
            if i > 0:
                digit_cells.append('<td style="width: 8px; font-size: 0; line-height: 0;">&nbsp;</td>')
            digit_cells.append(
                f'<td align="center" valign="middle" style="width: 48px; height: 56px; background-color: #F3F6FC; '
                f'border: 1.5px solid #3563F5; border-radius: 8px; font-size: 26px; font-weight: 800; '
                f'color: #101A33; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, monospace; '
                f'text-align: center; line-height: 56px;">{digit}</td>'
            )
        digit_boxes_row = "".join(digit_cells)

        # High-compat HTML email body
        html_body = f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Sitech Series Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F6FC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Outer centering container -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F3F6FC; width: 100%; margin: 0; padding: 40px 16px;">
    <tr>
      <td align="center" valign="top">
        <!-- Main Card Container: Max-width 600px -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(16, 26, 51, 0.06);">
          
          <!-- Branded Header: Deep Navy with Cyan Accent -->
          <tr>
            <td align="center" style="background-color: #101A33; padding: 28px 24px; border-bottom: 3px solid #25C7F7;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <img src="cid:sitech_logo" alt="Sitech Series" height="34" style="height: 34px; width: auto; max-width: 200px; display: block; border: 0; margin: 0 auto;" />
                    <div style="font-size: 11px; font-weight: 700; color: #25C7F7; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      LEAD INTELLIGENCE PORTAL
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 36px 32px 32px 32px; background-color: #FFFFFF;">
              
              <!-- Heading -->
              <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #17233B; letter-spacing: -0.02em; text-align: center; line-height: 1.3;">
                Verify your email address
              </h1>
              
              <!-- Supporting copy -->
              <p style="margin: 0 0 28px 0; font-size: 14.5px; line-height: 1.55; color: #64748B; text-align: center;">
                Use the verification code below to securely sign in to your Sitech Series workspace.
              </p>

              <!-- 6 Separate OTP Digit Boxes (Table-based layout) -->
              <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px auto;">
                <tr>
                  {digit_boxes_row}
                </tr>
              </table>

              <!-- Accessible Plain-Text Code Fallback -->
              <div style="text-align: center; margin-bottom: 24px; font-size: 12.5px; color: #64748B;">
                Verification code: <strong style="color: #101A33; font-family: monospace; font-size: 14px; letter-spacing: 2px;">{html.escape(clean_code)}</strong>
              </div>

              <!-- Expiration Notice Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 22px;">
                <tr>
                  <td style="padding: 12px 16px; text-align: center; font-size: 13px; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <span style="font-weight: 600;">⏱️ Your verification code expires in 10 minutes.</span>
                  </td>
                </tr>
              </table>

              <!-- Security Reminder -->
              <p style="margin: 0; font-size: 12.5px; line-height: 1.55; color: #64748B; text-align: center;">
                If you didn't request this code, you can safely ignore this email. Never share your verification code with anyone.
              </p>

            </td>
          </tr>

          <!-- Professional Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 24px; text-align: center;">
              <div style="font-size: 12px; font-weight: 700; color: #17233B;">
                Sitech Series
              </div>
              <div style="font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: #3563F5; margin: 2px 0 4px 0; font-weight: 600;">
                Lead Intelligence Portal
              </div>
              <div style="font-size: 11.5px; color: #94A3B8;">
                Secure access to your workspace
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        # Accessible plain-text fallback
        bracketed_boxes = "  ".join([f"[ {d} ]" for d in raw_digits])
        plain_body = f"""Sitech Series Lead Intelligence Portal
Verify your email address

Use the verification code below to securely sign in to your Sitech Series workspace:

{bracketed_boxes}

Verification code: {clean_code}

Your verification code expires in 10 minutes.

If you didn't request this code, you can safely ignore this email. Never share your verification code with anyone.

--
Sitech Series
Lead Intelligence Portal
Secure access to your workspace
"""

        return html_body, plain_body

    def send_otp_email(self, recipient_email: str, otp_code: str) -> Tuple[bool, str]:
        """Dispatches a secure 6-digit verification code to the recipient email address.

        Constructs a RFC-2387 compliant multipart/related email with CID-embedded branding,
        six distinct digit boxes, and robust SMTP delivery handling.
        """
        clean_recipient = recipient_email.strip()
        html_content, plain_text = self.build_otp_email_markup(otp_code)

        # In non-production environments, populate dev cache for automated testing harnesses
        if not self.is_production:
            _dev_otp_cache[clean_recipient.lower()] = otp_code

        # Security safeguard: Never dispatch real SMTP emails to reserved synthetic/test domains
        if clean_recipient.endswith(("@example.com", "@test.com", "@test.local", "@invalid")):
            logger.info("[SAFEGUARD] Suppressed external SMTP dispatch for synthetic test address: %s", clean_recipient)
            return True, "Verification code sent to your email (Test Safe Mode)."

        # 1. If SMTP host is configured, attempt real email delivery
        if self.smtp_host:
            server = None
            try:
                # Outer related container holds inline attachments like the CID logo
                msg = MIMEMultipart("related")
                msg["Subject"] = "Your Sitech Series Sign-In Verification Code"
                msg["From"] = email.utils.formataddr((self.from_name, self.from_email))
                msg["To"] = clean_recipient
                msg["Date"] = email.utils.formatdate(localtime=True)
                msg["Message-ID"] = email.utils.make_msgid(domain=self.from_email.split("@")[-1])

                # Alternative container holds plain-text and HTML
                alt_part = MIMEMultipart("alternative")
                alt_part.attach(MIMEText(plain_text, "plain", "utf-8"))
                alt_part.attach(MIMEText(html_content, "html", "utf-8"))
                msg.attach(alt_part)

                # Attach logo as inline CID image if asset is found
                if self.logo_path and os.path.exists(self.logo_path):
                    try:
                        with open(self.logo_path, "rb") as img_file:
                            img_data = img_file.read()
                        img = MIMEImage(img_data, _subtype="png")
                        img.add_header("Content-ID", "<sitech_logo>")
                        img.add_header("Content-Disposition", "inline", filename="logo.png")
                        msg.attach(img)
                    except Exception as img_err:
                        logger.warning("Could not attach CID logo: %s", str(img_err))

                # Establish SMTP connection with appropriate SSL/TLS
                if self.smtp_port == 465:
                    server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=12)
                else:
                    server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=12)
                    if self.use_tls:
                        server.starttls()

                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)

                server.sendmail(self.from_email, [clean_recipient], msg.as_string())
                server.quit()
                server = None

                logger.info("Successfully dispatched OTP verification email to %s via %s", clean_recipient, self.smtp_host)
                return True, "Verification code sent to your email."

            except smtplib.SMTPAuthenticationError:
                logger.error("SMTP delivery failed for %s: Authentication rejected by server.", clean_recipient)
                return False, "Failed to authenticate with email delivery server. Please check SMTP credentials."
            except smtplib.SMTPRecipientsRefused:
                logger.error("SMTP delivery failed for %s: Recipient address refused by server.", clean_recipient)
                return False, "Recipient email address was rejected by the email delivery service."
            except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected):
                logger.error("SMTP delivery failed for %s: Connection dropped or refused.", clean_recipient)
                return False, "Could not connect to email delivery server. Please try again shortly."
            except (socket.timeout, TimeoutError):
                logger.error("SMTP delivery failed for %s: Connection timed out.", clean_recipient)
                return False, "Email delivery server timed out. Please try again."
            except Exception as exc:
                logger.error("SMTP delivery failed for %s: %s", clean_recipient, type(exc).__name__)
                return False, "Failed to deliver verification code via email provider. Please try again later."
            finally:
                if server:
                    try:
                        server.close()
                    except Exception:
                        pass

        # 2. In Development when SMTP host is not configured
        if not self.is_production and self.enable_dev_console:
            logger.info("==================================================================")
            logger.info("[DEV EMAIL ADAPTER] OTP for %s: %s (expires in 10 minutes)", clean_recipient, otp_code)
            logger.info("==================================================================")
            # Store in dev cache for test harness
            _dev_otp_cache[clean_recipient.lower()] = otp_code
            return True, "Verification code generated and sent (Development Mode)."

        # 3. Production without configured provider
        logger.error("Email delivery provider not configured in production environment.")
        return False, "Email provider is not configured. Please contact workspace administrator."


# In-memory dictionary for development/test suite assertions only
_dev_otp_cache: dict[str, str] = {}


def get_latest_dev_otp(email_addr: str) -> str | None:
    """Development testing helper: retrieves the latest generated OTP for automated tests."""
    return _dev_otp_cache.get(email_addr.lower())
