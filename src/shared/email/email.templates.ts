const BRAND = '#013537';
const ACCENT = '#8ce66b';

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f0f7f4;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f4;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(1,53,55,.08);">
        <tr><td style="background:${BRAND};padding:24px 28px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">Ingobyi Academy</p>
          <p style="margin:4px 0 0;font-size:12px;color:${ACCENT};">Learning infrastructure for Rwanda</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND};">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafafa;border-top:1px solid #e8f4ef;">
          <p style="margin:0;font-size:11px;color:#6b7280;">© Ingobyi Innovation Hub · This is an automated message.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function otpEmail(purpose: string, code: string) {
  const label = purpose.replace(/_/g, ' ').toLowerCase();
  return layout(
    'Your verification code',
    `<p style="color:#374151;font-size:14px;line-height:1.6;">Use this code to complete <strong>${label}</strong>. It expires in <strong>10 minutes</strong>.</p>
     <p style="margin:24px 0;text-align:center;font-size:32px;font-weight:800;letter-spacing:8px;color:${BRAND};">${code}</p>
     <p style="color:#6b7280;font-size:12px;">If you did not request this, you can safely ignore this email.</p>`,
  );
}

export function inviteEmail(orgName: string, role: string, inviteUrl: string) {
  return layout(
    `You're invited to ${orgName}`,
    `<p style="color:#374151;font-size:14px;line-height:1.6;">You've been invited to join <strong>${orgName}</strong> on Ingobyi Academy as a <strong>${role}</strong>.</p>
     <p style="margin:24px 0;"><a href="${inviteUrl}" style="display:inline-block;background:${BRAND};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Accept invitation</a></p>
     <p style="color:#6b7280;font-size:12px;">This link expires in 7 days.</p>`,
  );
}

export function joinRequestEmail(
  orgName: string,
  requesterName: string,
  dashboardUrl: string,
) {
  return layout(
    'New join request',
    `<p style="color:#374151;font-size:14px;"><strong>${requesterName}</strong> requested to join <strong>${orgName}</strong>.</p>
     <p style="margin:24px 0;"><a href="${dashboardUrl}" style="display:inline-block;background:${BRAND};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Review request</a></p>`,
  );
}

export function joinDecisionEmail(orgName: string, approved: boolean) {
  return layout(
    approved ? 'Join request approved' : 'Join request declined',
    `<p style="color:#374151;font-size:14px;">Your request to join <strong>${orgName}</strong> was <strong>${approved ? 'approved' : 'declined'}</strong>.</p>
     ${approved ? `<p style="color:#374151;font-size:14px;">You can now access the organization from your dashboard.</p>` : ''}`,
  );
}

export function enrollmentEmail(courseTitle: string, learnUrl: string) {
  return layout(
    'Enrollment confirmed',
    `<p style="color:#374151;font-size:14px;">You are now enrolled in <strong>${courseTitle}</strong>. Start learning at your own pace.</p>
     <p style="margin:24px 0;"><a href="${learnUrl}" style="display:inline-block;background:${BRAND};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Start learning</a></p>`,
  );
}

export function gradedEmail(
  assignmentTitle: string,
  score: number,
  feedback?: string,
) {
  return layout(
    'Assignment graded',
    `<p style="color:#374151;font-size:14px;">Your submission for <strong>${assignmentTitle}</strong> has been graded.</p>
     <p style="font-size:24px;font-weight:700;color:${BRAND};">Score: ${score}%</p>
     ${feedback ? `<p style="color:#374151;font-size:14px;"><strong>Feedback:</strong> ${feedback}</p>` : ''}`,
  );
}

export function certificateEmail(
  courseTitle: string,
  verifyCode: string,
  certsUrl: string,
) {
  return layout(
    'Certificate issued',
    `<p style="color:#374151;font-size:14px;">Congratulations! You earned a certificate for completing <strong>${courseTitle}</strong>.</p>
     <p style="color:#374151;font-size:14px;">Verification code: <strong>${verifyCode}</strong></p>
     <p style="margin:24px 0;"><a href="${certsUrl}" style="display:inline-block;background:${BRAND};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View certificate</a></p>`,
  );
}

export function reportNewEmail(
  title: string,
  reporterEmail: string,
  moderationUrl: string,
) {
  return layout(
    'New content report',
    `<p style="color:#374151;font-size:14px;"><strong>${title}</strong></p>
     <p style="color:#6b7280;font-size:13px;">Reported by ${reporterEmail}</p>
     <p style="margin:24px 0;"><a href="${moderationUrl}" style="display:inline-block;background:${BRAND};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Review report</a></p>`,
  );
}

export function reportResolvedEmail(title: string, status: string) {
  return layout(
    'Report update',
    `<p style="color:#374151;font-size:14px;">Your report <strong>"${title}"</strong> has been marked as <strong>${status.toLowerCase()}</strong>.</p>
     <p style="color:#6b7280;font-size:12px;">Thank you for helping keep Ingobyi Academy safe.</p>`,
  );
}

export function notificationEmail(title: string, body: string, link?: string) {
  return layout(
    title,
    `<p style="color:#374151;font-size:14px;line-height:1.6;">${body}</p>
     ${link ? `<p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:${BRAND};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Open in app</a></p>` : ''}`,
  );
}
