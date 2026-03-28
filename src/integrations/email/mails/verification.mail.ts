import { BaseEmail } from '../base-mail';
import { EmailService } from '../email.service';

export class VerificationMail extends BaseEmail {
  constructor(
    email: string,
    name: string,
    otp: string,
    emailService: EmailService,
  ) {
    super(
      email,
      'Aidport - Email Verification',
      [
        `Hello ${name},`,
        'You are receiving this message because you signed up for Aidport.',
        'To verify your email address, copy/type the OTP below into the verification field provided.',
      ],
      emailService,
      otp,
      'If you did not create an account, please ignore this email.',
    );
  }

  async sendVerificationEmail(): Promise<void> {
    await this.send();
  }
}
