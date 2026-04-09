import { getMailgen } from './mailgen.factory';

export type VerificationVariant = 'signup' | 'repeat';

/**
 * Email verification OTP — used after signup and when the user requests a new code.
 */
export function buildVerificationEmail(
  name: string,
  otp: string,
  variant: VerificationVariant = 'repeat',
) {
  const mailgen = getMailgen();
  const intro =
    variant === 'signup'
      ? [
          'Welcome to Aidport — your account is almost ready.',
          `Your verification code is: ${otp}`,
          'Enter this code in the app to verify your email. It expires in 15 minutes.',
        ]
      : [
          'You requested a new verification code for your Aidport account.',
          `Your verification code is: ${otp}`,
          'Enter this code in the app to verify your email. It expires in 15 minutes.',
        ];

  const email = {
    body: {
      name,
      intro,
      outro: 'If you did not create an account, you can ignore this email.',
    },
  };

  return {
    subject: 'Aidport — Verify your email',
    html: mailgen.generate(email),
    text: mailgen.generatePlaintext(email),
  };
}
