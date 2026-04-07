import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
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

  async sendVerificationEmail(
    to: string,
    name: string,
    otp: string,
    variant: VerificationVariant = 'resend',
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
