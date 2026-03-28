import { BaseEmail } from '../base-mail';
import { EmailService } from '../email.service';

export class PasswordResetMail extends BaseEmail {
  private readonly resetLink: string;

  constructor(
    email: string,
    name: string,
    resetToken: string,
    emailService: EmailService,
  ) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    super(
      email,
      'Aidport - Password Reset',
      [
        `Hello ${name},`,
        'You are receiving this message because you requested a password reset for your Aidport account.',
        'Click the link below to reset your password (valid for 1 hour):',
      ],
      emailService,
      undefined,
      resetLink,
    );
    this.resetLink = resetLink;
  }

  protected override buildHtml(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Aidport - Password Reset</h2>
        <p style="color: #555; line-height: 1.6;">You requested a password reset. Click the button below to reset your password (valid for 1 hour):</p>
        <a href="${this.resetLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
        <p style="color: #999; font-size: 12px;">If the button doesn't work, copy this link: ${this.resetLink}</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Aidport - Shipment & Logistics</p>
      </div>
    `;
  }

  async sendPasswordResetEmail(): Promise<void> {
    await this.send();
  }
}
