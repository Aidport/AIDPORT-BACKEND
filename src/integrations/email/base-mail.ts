import { EmailService } from './email.service';

export abstract class BaseEmail {
  constructor(
    protected readonly email: string,
    protected readonly subject: string,
    protected readonly introLines: string[],
    protected readonly emailService: EmailService,
    protected readonly otpOrCode?: string,
    protected readonly outroLine?: string,
  ) {}

  protected buildHtml(): string {
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${this.subject}</h2>
        ${this.introLines.map((line) => `<p style="color: #555; line-height: 1.6;">${line}</p>`).join('')}
        ${this.otpOrCode ? `
          <div style="background: #f4f4f4; padding: 16px; margin: 20px 0; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px;">
            ${this.otpOrCode}
          </div>
        ` : ''}
        ${this.outroLine ? `<p style="color: #555; line-height: 1.6;">${this.outroLine}</p>` : ''}
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Aidport - Shipment & Logistics</p>
      </div>
    `;
    return html;
  }

  protected buildText(): string {
    let text = `${this.subject}\n\n`;
    text += this.introLines.join('\n') + '\n\n';
    if (this.otpOrCode) {
      text += `Code: ${this.otpOrCode}\n\n`;
    }
    if (this.outroLine) {
      text += this.outroLine + '\n';
    }
    return text;
  }

  async send(): Promise<void> {
    await this.emailService.sendMail({
      to: this.email,
      subject: this.subject,
      text: this.buildText(),
      html: this.buildHtml(),
    });
  }
}
