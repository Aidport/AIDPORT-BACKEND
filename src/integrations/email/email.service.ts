import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OAuth2Client } from 'google-auth-library';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  createGmailOAuth2Client,
  createGmailOAuthTransport,
  type GmailOAuthConfig,
} from './gmail-oauth.transport';
import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildShipmentInvoiceAgentNotifyEmail,
  buildShipmentInvoiceEmail,
  buildVerificationEmail,
  type InvoiceParcelLine,
  type VerificationVariant,
} from './templates';

@Injectable()
export class EmailService {
  private passwordSmtpTransporter: Transporter | null = null;
  private gmailOAuth2Client: OAuth2Client | null = null;

  constructor(private configService: ConfigService) {}

  private getPasswordSmtpTransporter(): Transporter {
    if (!this.passwordSmtpTransporter) {
      const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
      const port = this.configService.get<number>('SMTP_PORT', 587);
      const secure = this.configService.get<boolean>('SMTP_SECURE', false);
      const user = this.configService.get<string>('SMTP_USER');
      const pass = this.configService.get<string>('SMTP_PASS');

      if (!user || !pass) {
        throw new Error('SMTP_USER and SMTP_PASS must be configured for email');
      }

      this.passwordSmtpTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 25_000,
        greetingTimeout: 25_000,
        socketTimeout: 60_000,
      });
    }
    return this.passwordSmtpTransporter;
  }

  /** OAuth2 + Gmail API (googleapis) — matches a typical working Nodemailer `service: 'gmail'` setup. */
  private getGmailOAuthConfig(): GmailOAuthConfig | null {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID')?.trim();
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET')?.trim();
    const redirectUri = this.configService.get<string>('GMAIL_REDIRECT_URI')?.trim();
    const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN')?.trim();
    const user = this.configService.get<string>('GMAIL_USER')?.trim();
    if (!clientId || !clientSecret || !redirectUri || !refreshToken || !user) {
      return null;
    }
    return {
      clientId,
      clientSecret,
      redirectUri,
      refreshToken,
      user,
    };
  }

  private usesGmailOAuth(): boolean {
    return this.getGmailOAuthConfig() !== null;
  }

  private getGmailOAuth2Client(): OAuth2Client {
    if (!this.gmailOAuth2Client) {
      const cfg = this.getGmailOAuthConfig();
      if (!cfg) {
        throw new Error('Gmail OAuth is not configured');
      }
      this.gmailOAuth2Client = createGmailOAuth2Client(cfg);
    }
    return this.gmailOAuth2Client;
  }

  /** From address for SMTP-style sends (password SMTP or Gmail OAuth). */
  private getMailFromAddress(): string {
    return (
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('GMAIL_FROM') ||
      this.configService.get<string>('GMAIL_USER') ||
      this.configService.get<string>('SMTP_USER') ||
      'noreply@aidport.com'
    );
  }

  private async sendViaGmailOAuth(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    const cfg = this.getGmailOAuthConfig();
    if (!cfg) {
      throw new Error('Gmail OAuth is not configured');
    }
    const oauth2 = this.getGmailOAuth2Client();
    const transport = await createGmailOAuthTransport(oauth2, cfg);
    const from = this.getMailFromAddress();
    await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    if (this.usesGmailOAuth()) {
      await this.sendViaGmailOAuth(options);
      return;
    }
    const transporter = this.getPasswordSmtpTransporter();
    const from = this.getMailFromAddress();
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  isConfigured(): boolean {
    if (this.usesGmailOAuth()) {
      return true;
    }
    return !!(
      this.configService.get<string>('SMTP_USER') &&
      this.configService.get<string>('SMTP_PASS')
    );
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    otp: string,
    variant: VerificationVariant = 'repeat',
  ): Promise<void> {
    const { subject, html, text } = buildVerificationEmail(name, otp, variant);
    await this.sendMail({ to, subject, html, text });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const { subject, html, text } = buildPasswordResetEmail(name, resetToken);
    await this.sendMail({ to, subject, html, text });
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    const { subject, html, text } = buildPasswordChangedEmail(name);
    await this.sendMail({ to, subject, html, text });
  }

  async sendShipmentInvoiceEmail(params: {
    to: string;
    recipientName: string;
    cargoName: string;
    originCity: string;
    destinationCity: string;
    parcelItems: InvoiceParcelLine[];
    totalPrice: number;
    paymentLink: string;
  }): Promise<void> {
    const { subject, html, text } = buildShipmentInvoiceEmail({
      recipientName: params.recipientName,
      cargoName: params.cargoName,
      originCity: params.originCity,
      destinationCity: params.destinationCity,
      parcelItems: params.parcelItems,
      totalPrice: params.totalPrice,
      paymentLink: params.paymentLink,
    });
    await this.sendMail({ to: params.to, subject, html, text });
  }

  /** Agent copy: invoice was issued; customer receives the payable invoice separately. */
  async sendShipmentInvoiceAgentNotifyEmail(params: {
    to: string;
    agentName: string;
    shipmentId: string;
    cargoName: string;
    originCity: string;
    destinationCity: string;
    shipperName: string;
    shipperEmail: string;
    totalPrice: number;
    paymentLink: string;
  }): Promise<void> {
    const { subject, html, text } = buildShipmentInvoiceAgentNotifyEmail({
      agentName: params.agentName,
      shipmentId: params.shipmentId,
      cargoName: params.cargoName,
      originCity: params.originCity,
      destinationCity: params.destinationCity,
      shipperName: params.shipperName,
      shipperEmail: params.shipperEmail,
      totalPrice: params.totalPrice,
      paymentLink: params.paymentLink,
    });
    await this.sendMail({ to: params.to, subject, html, text });
  }
}
