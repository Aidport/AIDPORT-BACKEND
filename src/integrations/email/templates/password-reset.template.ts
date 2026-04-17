import { getMailgen } from './mailgen.factory';

/**
 * Forgot password — link includes user id + opaque `reset` (stored as `resetUrlToken` on the user).
 * Legacy `?token=` still works via API if old emails are in the wild.
 */
export function buildPasswordResetEmail(name: string, userId: string, resetUrlToken: string) {
  const mailgen = getMailgen();
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const q = new URLSearchParams({
    uid: userId,
    reset: resetUrlToken,
  });
  const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?${q.toString()}`;

  const email = {
    body: {
      name,
      intro: [
        'We received a request to reset the password for your Aidport account.',
        'This link is valid for 1 hour and is unique to your account.',
      ],
      action: {
        instructions: 'Click the button below to choose a new password.',
        button: {
          color: '#2563eb',
          text: 'Reset password',
          link: resetLink,
        },
      },
      outro: `If the button does not work, copy and paste this link into your browser:\n${resetLink}`,
    },
  };

  return {
    subject: 'Aidport — Reset your password',
    html: mailgen.generate(email),
    text: mailgen.generatePlaintext(email),
  };
}
