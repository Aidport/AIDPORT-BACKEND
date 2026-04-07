import { getMailgen } from './mailgen.factory';

/** Forgot password — link to frontend reset page (token in query). */
export function buildPasswordResetEmail(name: string, resetToken: string) {
  const mailgen = getMailgen();
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const email = {
    body: {
      name,
      intro: [
        'We received a request to reset the password for your Aidport account.',
        'This link is valid for 1 hour.',
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
