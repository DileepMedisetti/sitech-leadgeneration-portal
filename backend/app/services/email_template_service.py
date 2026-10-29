import logging
import math
import re
from typing import Optional
from sqlalchemy import func, or_, desc, asc
from sqlalchemy.orm import Session

from app.models.email_template import EmailTemplate
from app.schemas.email_template import (
    EmailTemplateCreate,
    EmailTemplateUpdate,
    EmailTemplateResponse,
    PaginatedEmailTemplatesResponse,
)
from app.services.cloudinary_storage_service import cloudinary_storage_service

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB limit

DEFAULT_STARTER_TEMPLATES = [
    {
        "name": "Product Update",
        "category": "Product Update",
        "description": "Clean and modern design for product updates and announcements.",
        "subject_hint": "Exciting Updates from Sitech Series",
        "is_system_template": True,
        "html_content": """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Update</title>
</head>
<body style="margin:0;padding:20px 0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid #f1f5f9;">
      <span style="font-weight:700;font-size:15px;color:#0f172a;">Sitech Series</span>
      <div style="display:flex;gap:16px;font-size:13px;color:#475569;">
        <span>Events</span><span>Research</span><span>Contact</span>
      </div>
    </div>
    <div style="background:linear-gradient(135deg,#f0f7ff 0%,#e0effe 100%);padding:32px 28px;">
      <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#0f172a;">Exciting Updates from Sitech Series</h1>
      <p style="margin:0 0 22px;font-size:14px;color:#475569;">Discover new features and improvements to help you grow faster.</p>
      <a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;font-weight:600;font-size:13px;padding:10px 22px;border-radius:6px;text-decoration:none;">Learn More</a>
    </div>
    <div style="padding:28px 24px;color:#334155;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 12px;font-weight:600;color:#0f172a;">Hi there,</p>
      <p style="margin:0 0 24px;color:#475569;">We're excited to share the latest updates from Sitech Series. These new features are designed to help you streamline your workflow and achieve better results.</p>
      <h3 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f172a;">What's New?</h3>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>✓ Improved performance and faster processing</div>
        <div>✓ New analytics dashboard with deeper insights</div>
        <div>✓ Enhanced user experience and updated interface</div>
      </div>
    </div>
    <div style="border-top:1px solid #f1f5f9;padding:18px 24px;text-align:center;font-size:12px;color:#94a3b8;background-color:#fafafa;">
      <p style="margin:0;">Sitech Series &middot; Academic Lead Generation Platform</p>
      <p style="margin:6px 0 0;"><a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>""",
    },
    {
        "name": "Academic Research Collaboration",
        "category": "Research & Labs",
        "description": "Targeted invitation to faculty peers exploring joint lab initiatives and co-investigator grants.",
        "subject_hint": "Cross-Institutional Research Initiative — Faculty Collaboration",
        "is_system_template": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Academic Research Collaboration</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:32px 28px;text-align:left;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Sitech Series Academic Research Initiative</h1>
      <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">Advancing Cross-Disciplinary Computational Sciences</p>
    </div>
    <div style="padding:32px 28px;color:#334155;line-height:1.65;font-size:15px;">
      <p style="margin-top:0;">Dear {{name}},</p>
      <p>I have followed your laboratory's recent contributions in <strong>{{department}}</strong> at <strong>{{university}}</strong> with great appreciation.</p>
      <p>Our research consortium is coordinating a multi-institutional proposal targeting next-generation computational methods and autonomous discovery systems. Given your impactful track record, we would welcome the opportunity to explore potential collaborative synergy.</p>
      <div style="background:#f1f5f9;border-left:4px solid #2563eb;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">
        <h4 style="margin:0 0 6px;color:#1e293b;font-size:15px;">Focus Areas for Joint Investigation</h4>
        <ul style="margin:0;padding-left:20px;color:#475569;font-size:14px;">
          <li>Scalable intelligence architectures</li>
          <li>Data pipeline orchestration & reproducibility</li>
          <li>Cross-institutional benchmark validation</li>
        </ul>
      </div>
      <p>We invite you to review our preliminary research framework at your convenience:</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://sitechseries.org/research-framework" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:6px;box-shadow:0 2px 4px rgba(37,99,235,0.2);">Review Research Framework</a>
      </div>
      <p>I would be delighted to schedule a brief introductory call with our primary investigators at your earliest convenience.</p>
      <p style="margin-bottom:0;">Sincerely,<br><strong>{{first_name|Colleague}}</strong><br><span style="color:#64748b;font-size:13px;">Consortium Director, Sitech Series</span></p>
    </div>
    <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 28px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.5;">
      <p style="margin:0;">Sitech Academic Outreach &middot; 100 Innovation Way, Suite 400, Cambridge, MA 02142</p>
      <p style="margin:6px 0 0;"><a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Unsubscribe from future academic research notices</a></p>
    </div>
  </div>
</body>
</html>""",
    },
    {
        "name": "Symposium & Keynote Speaker Invitation",
        "category": "Event Invitation",
        "description": "Formal academic conference invitation for department chairs and distinguished lecturers.",
        "subject_hint": "Keynote Speaker Invitation — 2026 Academic Summit on Advanced Computing",
        "is_system_template": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Keynote Speaker Invitation</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);">
    <div style="background:#1e1b4b;padding:36px 32px;text-align:center;">
      <span style="display:inline-block;padding:4px 12px;background:#4338ca;color:#e0e7ff;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;border-radius:20px;margin-bottom:12px;">Official Invitation</span>
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.02em;">2026 Academic Summit on Advanced Computing</h1>
      <p style="margin:10px 0 0;color:#c7d2fe;font-size:14px;">October 14–16, 2026 &middot; Boston Convention Center & Virtual</p>
    </div>
    <div style="padding:36px 32px;color:#334155;line-height:1.7;font-size:15px;">
      <p style="margin-top:0;">Dear {{name}},</p>
      <p>On behalf of the academic organizing committee, we have the distinct privilege of inviting you to deliver a <strong>Keynote Address</strong> at the upcoming 2026 Academic Summit.</p>
      <p>Your groundbreaking work at <strong>{{university}}</strong> represents an influential voice in the field. Our program committee unanimously identified your recent research as a premier highlight for our keynote plenary session.</p>
      <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:20px;margin:24px 0;">
        <h4 style="margin:0 0 8px;color:#6b21a8;font-size:15px;">Session Details</h4>
        <p style="margin:0 0 6px;font-size:14px;color:#581c87;"><strong>Track:</strong> Advanced Computing & Scalable Architectures</p>
        <p style="margin:0 0 6px;font-size:14px;color:#581c87;"><strong>Format:</strong> 45-minute Keynote Presentation + 15-minute Q&A</p>
        <p style="margin:0;font-size:14px;color:#581c87;"><strong>Honorarium & Travel:</strong> Fully sponsored by the Summit Foundation</p>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="https://sitechseries.org/symposium2026/keynote-accept" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 32px;border-radius:8px;box-shadow:0 4px 6px -1px rgba(79,70,229,0.3);">Confirm Availability & Details</a>
      </div>
      <p style="margin-bottom:0;">With warm regards,<br><strong>Symposium Secretariat</strong><br><span style="color:#64748b;font-size:13px;">Sitech Series Academic Conferences</span></p>
    </div>
    <div style="border-top:1px solid #f1f5f9;background:#f8fafc;padding:20px 32px;text-align:center;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">Summit Secretariat &middot; 200 Technology Square, Cambridge, MA 02139</p>
      <p style="margin:6px 0 0;"><a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Opt-out from speaker invitations</a></p>
    </div>
  </div>
</body>
</html>""",
    },
    {
        "name": "Special Issue Call for Papers",
        "category": "Announcement",
        "description": "Targeted invitation for high-impact manuscript submissions to upcoming journal special issues.",
        "subject_hint": "Call for Papers: Special Issue on Scalable Intelligence Systems",
        "is_system_template": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Special Issue Call for Papers</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #cbd5e1;overflow:hidden;">
    <div style="border-bottom:3px solid #0284c7;padding:24px 28px;display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;color:#0f172a;font-size:18px;font-weight:700;">Journal of Applied System Intelligence</h2>
      <span style="font-size:12px;color:#0284c7;font-weight:600;">Impact Factor: 4.82</span>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.65;font-size:15px;">
      <p style="margin-top:0;">Dear {{name}},</p>
      <p>The Editorial Board cordially invites you and your colleagues at <strong>{{university}}</strong> to submit original research to our upcoming Special Issue entitled:</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <h3 style="margin:0;color:#0369a1;font-size:16px;">"Scalable Intelligence Systems: Architecture, Optimization & Ethics"</h3>
        <p style="margin:8px 0 0;font-size:13px;color:#0284c7;"><strong>Guest Editors:</strong> Prof. E. Vance, Dr. K. Sato, Dr. M. Al-Hassan</p>
      </div>
      <p>Given your contributions in <strong>{{department}}</strong>, your latest investigations would be an ideal fit for this collection.</p>
      <p><strong>Key Milestones:</strong></p>
      <ul style="padding-left:20px;color:#475569;font-size:14px;margin-bottom:24px;">
        <li>Manuscript Submission Deadline: <strong>July 31, 2026</strong></li>
        <li>First Editorial Decision: <strong>Within 4 weeks</strong> of receipt</li>
        <li>Target Publication Date: <strong>November 2026</strong></li>
      </ul>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://sitechseries.org/special-issue" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:6px;">View Author Guidelines & Submit</a>
      </div>
      <p style="margin-bottom:0;">Warm regards,<br><strong>Editorial Office</strong><br><span style="color:#64748b;font-size:13px;">Sitech Series Publishing</span></p>
    </div>
    <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:18px 28px;text-align:center;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">Sitech Publishing &middot; 400 Research Parkway, New York, NY 10001</p>
      <p style="margin:6px 0 0;"><a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Manage email preferences</a></p>
    </div>
  </div>
</body>
</html>""",
    },
    {
        "name": "Executive Monthly Newsletter",
        "category": "Newsletter",
        "description": "Clean, modern multi-column newsletter format suitable for monthly updates, curated articles, and releases.",
        "subject_hint": "Sitech Series Monthly Digest: Breakthroughs, Trends & Insights",
        "is_system_template": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive Monthly Newsletter</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="padding:24px 28px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.03em;">THE DISPATCH</span>
      <span style="font-size:13px;color:#64748b;font-weight:500;">Issue #42 &middot; 2026 Edition</span>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.65;font-size:15px;">
      <p style="margin-top:0;">Hello {{name}},</p>
      <p>Welcome to this month's roundup of high-impact research, tech leadership highlights, and platform updates from the Sitech Series network.</p>
      <div style="border-top:1px solid #f1f5f9;padding-top:20px;margin-top:24px;">
        <span style="color:#059669;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Featured Story</span>
        <h3 style="margin:6px 0 10px;color:#0f172a;font-size:18px;">How Adaptive Lead Pipelines Accelerate Institutional Outreach</h3>
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">A deep dive into cross-referencing global academic registries with verified publications to streamline department partnerships.</p>
        <a href="https://sitechseries.org/blog/adaptive-lead-pipelines" style="display:inline-block;margin-top:10px;color:#2563eb;font-weight:600;font-size:14px;text-decoration:none;">Read full analysis &rarr;</a>
      </div>
      <div style="border-top:1px solid #f1f5f9;padding-top:20px;margin-top:24px;">
        <span style="color:#d97706;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Community Spotlight</span>
        <h3 style="margin:6px 0 10px;color:#0f172a;font-size:18px;">Faculty Recognition at {{university}}</h3>
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">Highlighting remarkable achievements and published works from department researchers.</p>
        <a href="https://sitechseries.org/community" style="display:inline-block;margin-top:10px;color:#2563eb;font-weight:600;font-size:14px;text-decoration:none;">Explore spotlight &rarr;</a>
      </div>
    </div>
    <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 28px;text-align:center;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">Delivered to {{email}} as part of your Sitech Series subscription.</p>
      <p style="margin:6px 0 0;"><a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Unsubscribe from newsletters</a></p>
    </div>
  </div>
</body>
</html>""",
    },
    {
        "name": "Product Launch & Major Release",
        "category": "Product Update",
        "description": "Polished announcement template for major features, platform enhancements, and product updates.",
        "subject_hint": "Introducing Next-Gen Lead Intelligence & Campaign Automation",
        "is_system_template": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Launch & Release</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 12px 24px rgba(0,0,0,0.15);">
    <div style="background:linear-gradient(135deg,#047857,#065f46);padding:36px 32px;text-align:center;">
      <span style="display:inline-block;background:#064e3b;color:#a7f3d0;padding:4px 12px;border-radius:16px;font-size:12px;font-weight:700;letter-spacing:0.05em;margin-bottom:12px;text-transform:uppercase;">What's New in v3.0</span>
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">Enterprise Lead Intelligence Has Arrived</h1>
      <p style="margin:10px 0 0;color:#6ee7b7;font-size:14px;">Faster discovery, verified contact matching, and real-time deliverability audits.</p>
    </div>
    <div style="padding:32px;color:#334155;line-height:1.65;font-size:15px;">
      <p style="margin-top:0;">Hi {{name}},</p>
      <p>We are thrilled to announce the general availability of our major update. Designed specifically for institutional outreach teams at organisations like <strong>{{university}}</strong>, this release introduces game-changing capabilities:</p>
      <div style="display:flex;gap:12px;margin:16px 0;">
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:16px;border-radius:8px;">
          <h4 style="margin:0 0 6px;color:#0f172a;font-size:14px;">Instant Verification</h4>
          <p style="margin:0;color:#64748b;font-size:13px;">Pre-flight deliverability checks reduce bounce rates under 1.2%.</p>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:16px;border-radius:8px;">
          <h4 style="margin:0 0 6px;color:#0f172a;font-size:14px;">Template Engine</h4>
          <p style="margin:0;color:#64748b;font-size:13px;">Curated responsive layouts and real-time custom HTML editor.</p>
        </div>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://sitechseries.org/releases/v3" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 30px;border-radius:8px;box-shadow:0 2px 4px rgba(5,150,105,0.3);">Explore What's New</a>
      </div>
    </div>
    <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 32px;text-align:center;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">Sitech Series &middot; Platform Engineering & Product Operations</p>
      <p style="margin:6px 0 0;"><a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Update notification preferences</a></p>
    </div>
  </div>
</body>
</html>""",
    },
    {
        "name": "Client Onboarding & Welcome",
        "category": "Welcome",
        "description": "Warm and informative welcome email for new platform users with quick-start steps.",
        "subject_hint": "Welcome to Sitech Series Lead Intelligence — Quick Start Guide",
        "is_system_template": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Sitech Series</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#0f172a;padding:32px 28px;text-align:left;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Welcome to Sitech Series</h1>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">Your workspace is ready. Let's get you set up for success.</p>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.65;font-size:15px;">
      <p style="margin-top:0;">Welcome, {{first_name|there}}!</p>
      <p>Thank you for choosing Sitech Series Lead Intelligence. We are excited to support your outreach and research coordination at <strong>{{university}}</strong>.</p>
      <p>Here are three quick steps to get the most out of your account right away:</p>
      <ol style="padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
        <li><strong>Connect your sending identity:</strong> Head to <em>Email Accounts</em> to link your sender details.</li>
        <li><strong>Import your lead audience:</strong> Use our smart search to discover faculty or upload CSV lists.</li>
        <li><strong>Launch your first campaign:</strong> Choose a curated template or craft custom HTML with our live editor.</li>
      </ol>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://sitechseries.org/dashboard" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:6px;">Go to Workspace</a>
      </div>
      <p style="margin-bottom:0;">Have questions? Simply reply to this email to reach our dedicated support desk.</p>
    </div>
    <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 28px;text-align:center;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">Sitech Series &middot; Customer Success Team</p>
      <p style="margin:6px 0 0;"><a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>""",
    },
    {
        "name": "Post-Event Follow-up & Discussion",
        "category": "Follow-up",
        "description": "Engaging follow-up email after a conference, presentation, or discovery call.",
        "subject_hint": "Thank You for Connecting — Next Steps & Resources",
        "is_system_template": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Post-Event Follow-up</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="padding:28px 28px 20px;border-bottom:1px solid #f1f5f9;">
      <h2 style="margin:0;color:#0f172a;font-size:20px;font-weight:700;">Great connecting with you, {{first_name|Colleague}}</h2>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.65;font-size:15px;">
      <p style="margin-top:0;">Dear {{name}},</p>
      <p>Thank you for taking the time to connect with our team regarding the latest developments in <strong>{{department}}</strong> at <strong>{{university}}</strong>.</p>
      <p>As discussed, here are the key references and collaborative frameworks we highlighted during our discussion:</p>
      <ul style="padding-left:20px;color:#475569;font-size:14px;line-height:1.7;">
        <li><a href="https://sitechseries.org/summary" style="color:#2563eb;text-decoration:underline;">Executive Summary of Findings (PDF)</a></li>
        <li><a href="https://sitechseries.org/shared-docs" style="color:#2563eb;text-decoration:underline;">Shared Consortium Documentation</a></li>
      </ul>
      <p>Please let me know if you have any questions or if you would like to schedule a follow-up session next week.</p>
      <p style="margin-bottom:0;">Best regards,<br><strong>{{first_name|Outreach Coordinator}}</strong><br><span style="color:#64748b;font-size:13px;">Sitech Series Consortium</span></p>
    </div>
    <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:18px 28px;text-align:center;color:#94a3b8;font-size:12px;">
      <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Unsubscribe from follow-up notifications</a></p>
    </div>
  </div>
</body>
</html>""",
    },
    {
        "name": "Webinar & Demo Invitation",
        "category": "Promotional",
        "description": "High-conversion promotional invitation for live webinars, workshops, and platform walkthroughs.",
        "subject_hint": "Live Workshop: Optimizing Higher-Education Lead Outreach",
        "is_system_template": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Workshop Invitation</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:36px 32px;text-align:center;">
      <span style="display:inline-block;background:#5b21b6;color:#ddd6fe;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:12px;">Interactive Workshop</span>
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">Modern Lead Intelligence for Academic Institutions</h1>
      <p style="margin:10px 0 0;color:#c4b5fd;font-size:14px;">Thursday, November 12 &middot; 1:00 PM EST &middot; 45 Mins</p>
    </div>
    <div style="padding:32px;color:#334155;line-height:1.65;font-size:15px;">
      <p style="margin-top:0;">Dear {{name}},</p>
      <p>We are hosting a private masterclass tailored for academic outreach and research partnership directors at institutions including <strong>{{university}}</strong>.</p>
      <p>In this focused 45-minute workshop, our lead architects will demonstrate:</p>
      <ul style="padding-left:20px;color:#475569;font-size:14px;line-height:1.7;">
        <li>Automated faculty discovery across top 50 global databases</li>
        <li>Dynamic deliverability tuning to ensure inbox placement</li>
        <li>Custom HTML responsive layout best practices</li>
      </ul>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://sitechseries.org/webinars/lead-intel" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 32px;border-radius:8px;box-shadow:0 4px 6px -1px rgba(124,58,237,0.3);">Reserve Your Free Seat</a>
      </div>
      <p style="font-size:13px;color:#64748b;text-align:center;">Can't attend live? Register anyway and we'll send you the full recording.</p>
    </div>
    <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 32px;text-align:center;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">Sitech Series Webinar Operations &middot; Boston, MA</p>
      <p style="margin:6px 0 0;"><a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>""",
    },
]


class EmailTemplateService:
    @staticmethod
    def seed_default_templates(db: Session) -> int:
        """
        Seeds default templates if none exist in the database.
        Returns the number of seeded templates.
        """
        seeded_count = 0
        for item in DEFAULT_STARTER_TEMPLATES:
            existing = (
                db.query(EmailTemplate)
                .filter(EmailTemplate.name == item["name"])
                .first()
            )
            if not existing:
                template = EmailTemplate(
                    name=item["name"],
                    category=item["category"],
                    description=item["description"],
                    subject_hint=item.get("subject_hint"),
                    html_content=item["html_content"],
                    mime_type="text/html",
                    storage_provider="cloudinary",
                    file_size=len(item["html_content"].encode("utf-8")),
                    is_system_template=True,
                    is_active=True,
                )
                db.add(template)
                seeded_count += 1

        if seeded_count > 0:
            db.commit()
            logger.info(f"Seeded {seeded_count} starter email templates into database.")
        return seeded_count

    @staticmethod
    def validate_html_file(file_bytes: bytes, filename: str) -> None:
        """
        Validates imported HTML file extension, size, and minimal structure.
        Raises ValueError if invalid.
        """
        if not filename.lower().endswith((".html", ".htm")):
            raise ValueError("Only .html or .htm files are supported.")

        if len(file_bytes) == 0:
            raise ValueError("The uploaded file is empty.")

        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File size exceeds the 2 MB limit ({len(file_bytes) / 1024 / 1024:.2f} MB).")

        try:
            content_str = file_bytes.decode("utf-8", errors="replace")
        except Exception:
            raise ValueError("File content could not be decoded as text.")

        if not content_str.strip():
            raise ValueError("File contains only whitespace.")

        # Check for basic HTML markup
        has_tags = re.search(r"<[a-zA-Z][^>]*>", content_str)
        if not has_tags:
            raise ValueError("Uploaded file does not appear to contain valid HTML markup.")

    @staticmethod
    def list_templates(
        db: Session,
        search: Optional[str] = None,
        category: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 12,
    ) -> PaginatedEmailTemplatesResponse:
        """
        Lists email templates with search, category filtering, and pagination.
        Also retrieves the distinct list of categories.
        """
        query = db.query(EmailTemplate).filter(EmailTemplate.is_active.is_(True))

        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    EmailTemplate.name.ilike(search_term),
                    EmailTemplate.description.ilike(search_term),
                    EmailTemplate.category.ilike(search_term),
                )
            )

        if category and category.strip() and category.strip().lower() != "all":
            query = query.filter(EmailTemplate.category.ilike(category.strip()))

        total = query.count()

        # Sorting
        sort_col = getattr(EmailTemplate, sort_by, EmailTemplate.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_col))
        else:
            query = query.order_by(desc(sort_col))

        offset = max(0, (page - 1) * page_size)
        items = query.offset(offset).limit(page_size).all()
        total_pages = math.ceil(total / page_size) if total > 0 else 1

        # Fetch distinct categories across all active templates
        distinct_categories_query = (
            db.query(EmailTemplate.category)
            .filter(EmailTemplate.is_active.is_(True))
            .distinct()
            .order_by(EmailTemplate.category)
            .all()
        )
        categories = [c[0] for c in distinct_categories_query if c[0]]

        return PaginatedEmailTemplatesResponse(
            items=[EmailTemplateResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            categories=categories,
        )

    @staticmethod
    def get_template_by_id(db: Session, template_id: int) -> Optional[EmailTemplate]:
        return db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()

    @staticmethod
    def create_template(
        db: Session,
        template_in: EmailTemplateCreate,
        upload_to_cloudinary: bool = True,
    ) -> EmailTemplate:
        """
        Creates a template and optionally uploads its HTML to Cloudinary.
        """
        cloudinary_public_id = None
        cloudinary_url = None

        if upload_to_cloudinary:
            filename = template_in.original_filename or f"{template_in.name.lower().replace(' ', '_')}.html"
            upload_result = cloudinary_storage_service.upload_html_template(
                content=template_in.html_content,
                filename=filename,
            )
            cloudinary_public_id = upload_result.get("public_id")
            cloudinary_url = upload_result.get("secure_url")

        template = EmailTemplate(
            name=template_in.name.strip(),
            description=template_in.description.strip() if template_in.description else None,
            category=template_in.category.strip() or "General",
            html_content=template_in.html_content,
            subject_hint=template_in.subject_hint.strip() if template_in.subject_hint else None,
            original_filename=template_in.original_filename,
            mime_type=template_in.mime_type or "text/html",
            file_size=template_in.file_size or len(template_in.html_content.encode("utf-8")),
            storage_provider="cloudinary" if cloudinary_public_id else "database",
            cloudinary_public_id=cloudinary_public_id,
            cloudinary_url=cloudinary_url,
            is_system_template=template_in.is_system_template,
            is_active=True,
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def update_template(
        db: Session,
        template_id: int,
        template_update: EmailTemplateUpdate,
    ) -> Optional[EmailTemplate]:
        template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
        if not template:
            return None

        update_dict = template_update.model_dump(exclude_unset=True)

        if "html_content" in update_dict and update_dict["html_content"]:
            # Recalculate file size
            template.file_size = len(update_dict["html_content"].encode("utf-8"))
            # If Cloudinary public id exists, update raw file
            if template.cloudinary_public_id:
                cloudinary_storage_service.upload_html_template(
                    content=update_dict["html_content"],
                    filename=template.original_filename or f"{template.name}.html",
                )

        for key, value in update_dict.items():
            setattr(template, key, value)

        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def delete_template(db: Session, template_id: int) -> bool:
        template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
        if not template:
            return False

        if template.cloudinary_public_id:
            cloudinary_storage_service.delete_html_template(template.cloudinary_public_id)

        db.delete(template)
        db.commit()
        return True


email_template_service = EmailTemplateService()
