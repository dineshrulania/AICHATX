function buildInviteEmail({ toEmail, inviterEmail, projectName, inviteUrl }) {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#161b22;border:1px solid #21262d;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #21262d;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#4f46e5;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
              <span style="color:white;font-size:16px;font-weight:bold;">&lt;/&gt;</span>
            </td>
            <td style="padding-left:10px;">
              <span style="color:white;font-size:18px;font-weight:700;">AIChatX</span>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="margin:0 0 6px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">You've been invited</p>
          <h1 style="margin:0 0 16px;color:#e6edf3;font-size:22px;font-weight:600;line-height:1.3;">
            Join <span style="color:#818cf8;">${projectName}</span> on AIChatX
          </h1>
          <p style="margin:0 0 24px;color:#8b949e;font-size:14px;line-height:1.6;">
            <strong style="color:#cdd9e5;">${inviterEmail}</strong> invited you to collaborate on
            <strong style="color:#cdd9e5;">${projectName}</strong> — a shared workspace with real-time chat,
            live code editing, and AI assistance.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr>
            <td style="background:#4f46e5;border-radius:8px;">
              <a href="${inviteUrl}" style="display:inline-block;padding:13px 32px;color:white;font-size:14px;font-weight:600;text-decoration:none;">
                Accept Invitation →
              </a>
            </td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${[
              ['💬', 'Team Chat', 'Real-time messaging with collaborators'],
              ['🤖', 'AI Assistant', 'Type @ai to get instant code help'],
              ['⚡', 'Live Editor', 'Edit and run code in the browser'],
            ].map(([icon, title, desc]) => `
            <tr><td style="padding:8px 0;border-bottom:1px solid #21262d;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="font-size:18px;padding-right:12px;vertical-align:middle;">${icon}</td>
                <td>
                  <p style="margin:0;color:#cdd9e5;font-size:13px;font-weight:600;">${title}</p>
                  <p style="margin:2px 0 0;color:#8b949e;font-size:12px;">${desc}</p>
                </td>
              </tr></table>
            </td></tr>`).join('')}
          </table>

          <p style="margin:0;color:#484f58;font-size:12px;line-height:1.5;">
            This link expires in <strong style="color:#8b949e;">48 hours</strong>.
            If you didn't expect this, you can safely ignore it.
          </p>
        </td></tr>

        <tr><td style="padding:16px 32px;border-top:1px solid #21262d;background:#0d1117;">
          <p style="margin:0;color:#484f58;font-size:11px;">
            AIChatX · Collaborative coding platform ·
            <a href="${inviteUrl}" style="color:#6366f1;text-decoration:none;">View invite</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const text = `${inviterEmail} invited you to join "${projectName}" on AIChatX.\n\nAccept here: ${inviteUrl}\n\nExpires in 48 hours.`;

    return {
        html,
        text,
        subject: `${inviterEmail} invited you to join "${projectName}" on AIChatX`,
    };
}

async function sendViaSendGrid({ toEmail, inviterEmail, projectName, inviteUrl }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM;

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is required for SendGrid delivery');
  }

  if (!fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL is required for SendGrid delivery');
  }

    const { html, text, subject } = buildInviteEmail({ toEmail, inviterEmail, projectName, inviteUrl });

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
      Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: toEmail }],
          subject,
        },
      ],
      from: { email: fromEmail, name: 'AIChatX' },
      reply_to: { email: inviterEmail },
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
        }),
    });

  if (response.status !== 202) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${errorText || response.statusText}`);
    }

  return { accepted: true };
}

export async function sendInviteEmail({ toEmail, inviterEmail, projectName, inviteUrl }) {
    const provider = (process.env.MAIL_PROVIDER || '').toLowerCase().trim();

  if (provider === 'sendgrid') {
    return sendViaSendGrid({ toEmail, inviterEmail, projectName, inviteUrl });
  }

    if (provider === 'smtp') {
    throw new Error('SMTP is no longer the recommended provider. Set MAIL_PROVIDER=sendgrid and configure SENDGRID_API_KEY/SENDGRID_FROM_EMAIL.');
    }

  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
    return sendViaSendGrid({ toEmail, inviterEmail, projectName, inviteUrl });
    }

  if (provider === 'resend') {
    throw new Error('Resend is no longer the recommended provider. Set MAIL_PROVIDER=sendgrid and configure SENDGRID_API_KEY/SENDGRID_FROM_EMAIL.');
    }

  throw new Error('No mail transport configured. Set MAIL_PROVIDER=sendgrid and configure SENDGRID_API_KEY/SENDGRID_FROM_EMAIL.');
}

function buildOtpEmail({ toEmail, otp, purpose }) {
    const title = purpose === 'login' ? 'Login verification code' : 'Verify your AIChatX account';
    const subtitle = purpose === 'login'
        ? 'Use this code to finish signing in to your workspace.'
        : 'Use this code to verify your email and complete signup.';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#161b22;border:1px solid #21262d;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #21262d;">
          <span style="color:white;font-size:18px;font-weight:700;">AIChatX</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email verification</p>
          <h1 style="margin:0 0 10px;color:#e6edf3;font-size:22px;font-weight:600;line-height:1.3;">${title}</h1>
          <p style="margin:0 0 24px;color:#8b949e;font-size:14px;line-height:1.6;">${subtitle}</p>
          <div style="background:#0d1117;border:1px solid #21262d;border-radius:12px;padding:18px;text-align:center;margin-bottom:24px;">
            <div style="color:#8b949e;font-size:12px;margin-bottom:6px;">One-time code</div>
            <div style="font-size:34px;letter-spacing:8px;font-weight:700;color:#e6edf3;">${otp}</div>
          </div>
          <p style="margin:0;color:#484f58;font-size:12px;line-height:1.5;">If you didn't request this code, you can ignore this email. This code expires in 10 minutes.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const text = `${title}\n\nCode: ${otp}\n\n${subtitle}\n\nThis code expires in 10 minutes.`;

    return {
        html,
        text,
        subject: `AIChatX ${title}`,
    };
}

async function sendRawViaSendGrid({ toEmail, subject, text, html }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM;

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is required for SendGrid delivery');
  }

  if (!fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL is required for SendGrid delivery');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: toEmail }],
          subject,
        },
      ],
      from: { email: fromEmail, name: 'AIChatX' },
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });

  if (response.status !== 202) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${errorText || response.statusText}`);
  }

  return { accepted: true };
}

export async function sendVerificationOtpEmail({ toEmail, otp, purpose }) {
  const { html, text, subject } = buildOtpEmail({ toEmail, otp, purpose });
  return sendRawViaSendGrid({ toEmail, subject, text, html });
}