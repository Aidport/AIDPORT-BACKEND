import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import type { OAuth2Client } from 'google-auth-library';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  createGmailOAuth2Client,
  createGmailOAuthTransport,
  type GmailOAuthConfig,
} from './gmail-oauth.transport';
import {
  buildLoginNotificationEmail,
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildShipmentAssignedToAgentEmail,
  buildShipmentInvoiceAgentNotifyEmail,
  buildShipmentInvoiceEmail,
  buildVerificationEmail,
  type InvoiceParcelLine,
  type LoginNotificationParams,
  type ShipmentAssignedAgentParams,
  type VerificationVariant,
} from './templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private passwordSmtpTransporter: Transporter | null = null;
  private passwordSmtpInitPromise: Promise<Transporter> | null = null;
  private gmailOAuth2Client: OAuth2Client | null = null;

  constructor(private configService: ConfigService) {}

  /** Supports both `GMAIL_*` and common `.env` aliases (`CLIENT_ID`, `REFRESH_TOKEN`, …). */
  private cfgTrim(...keys: string[]): string | undefined {
    for (const key of keys) {
      const v = this.configService.get<string>(key)?.trim();
      if (v) {
        return v;
      }
    }
    return undefined;
  }

  /** Resolves SMTP host to IPv4 when possible so PaaS without working IPv6 (e.g. Render) can reach Gmail. */
  private async getPasswordSmtpTransporter(): Promise<Transporter> {
    if (this.passwordSmtpTransporter) {
      return this.passwordSmtpTransporter;
    }
    if (!this.passwordSmtpInitPromise) {
      this.passwordSmtpInitPromise = this.buildPasswordSmtpTransporter();
    }
    return this.passwordSmtpInitPromise;
  }

  private async buildPasswordSmtpTransporter(): Promise<Transporter> {
    const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    const user = this.cfgTrim('SMTP_USER');
    const pass = this.cfgTrim('SMTP_PASS');

    if (!user || !pass) {
      throw new Error('SMTP_USER and SMTP_PASS must be configured for email');
    }

    const preferIpv4 =
      this.configService.get<string>('SMTP_PREFER_IPV4', 'true') !== 'false';
    let connectHost = host;
    if (preferIpv4 && !net.isIP(host)) {
      try {
        const { address } = await dns.lookup(host, { family: 4 });
        connectHost = address;
      } catch (e) {
        this.logger.warn(
          `SMTP IPv4 lookup failed for ${host}, using hostname: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    this.passwordSmtpTransporter = nodemailer.createTransport({
      host: connectHost,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 25_000,
      greetingTimeout: 25_000,
      socketTimeout: 60_000,
      ...(connectHost !== host
        ? {
            tls: {
              servername: host,
            },
          }
        : {}),
    });
    return this.passwordSmtpTransporter;
  }

  /** OAuth2 + Gmail API (googleapis) — matches a typical working Nodemailer `service: 'gmail'` setup. */
  private getGmailOAuthConfig(): GmailOAuthConfig | null {
    const clientId = this.cfgTrim('GMAIL_CLIENT_ID', 'CLIENT_ID');
    const clientSecret = this.cfgTrim('GMAIL_CLIENT_SECRET', 'CLIENT_SECRET');
    const redirectUri = this.cfgTrim('GMAIL_REDIRECT_URI', 'REDIRECT_URI');
    const refreshToken = this.cfgTrim('GMAIL_REFRESH_TOKEN', 'REFRESH_TOKEN');
    const user = this.cfgTrim('GMAIL_USER', 'GMAIL_NAME');
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
      this.cfgTrim('SMTP_FROM', 'GMAIL_FROM', 'GMAIL_USER', 'GMAIL_NAME') ||
      this.cfgTrim('SMTP_USER') ||
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
    const transporter = await this.getPasswordSmtpTransporter();
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
    return !!(this.cfgTrim('SMTP_USER') && this.cfgTrim('SMTP_PASS'));
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
    userId: string,
    resetUrlToken: string,
  ): Promise<void> {
    const { subject, html, text } = buildPasswordResetEmail(name, userId, resetUrlToken);
    await this.sendMail({ to, subject, html, text });
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    const { subject, html, text } = buildPasswordChangedEmail(name);
    await this.sendMail({ to, subject, html, text });
  }

  /** After each successful login (optional IP / User-Agent from request). */
  async sendLoginNotificationEmail(
    to: string,
    name: string,
    params: LoginNotificationParams,
  ): Promise<void> {
    const { subject, html, text } = buildLoginNotificationEmail(name, params);
    await this.sendMail({ to, subject, html, text });
  }

  /** Admin assigned this shipment to the agent (after payment). */
  async sendShipmentAssignedToAgentEmail(
    to: string,
    params: ShipmentAssignedAgentParams,
  ): Promise<void> {
    const { subject, html, text } = buildShipmentAssignedToAgentEmail(params);
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
