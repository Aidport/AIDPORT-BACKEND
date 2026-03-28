import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: Transporter | null = null;

  constructor(private configService: ConfigService) {}

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
      const port = this.configService.get<number>('SMTP_PORT', 587);
      const secure = this.configService.get<boolean>('SMTP_SECURE', false);
      const user = this.configService.get<string>('SMTP_USER');
      const pass = this.configService.get<string>('SMTP_PASS');

      if (!user || !pass) {
        throw new Error('SMTP_USER and SMTP_PASS must be configured for email');
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
    }
    return this.transporter;
  }

  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    const transporter = this.getTransporter();
    const from = this.configService.get<string>(
      'SMTP_FROM',
      this.configService.get<string>('SMTP_USER') || 'noreply@aidport.com',
    );
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  isConfigured(): boolean {
    return !!(
      this.configService.get<string>('SMTP_USER') &&
      this.configService.get<string>('SMTP_PASS')
    );
  }
}
