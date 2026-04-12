import type { OAuth2Client } from 'google-auth-library';
import * as dns from 'node:dns/promises';
import { google } from 'googleapis';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/** Same fields as a working Gmail + OAuth2 + Nodemailer setup (OAuth Playground refresh token). */
export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  /** Mailbox user (e.g. you@gmail.com) — must match the account that authorized the refresh token. */
  user: string;
};

export function createGmailOAuth2Client(cfg: GmailOAuthConfig): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    cfg.clientId,
    cfg.clientSecret,
    cfg.redirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: cfg.refreshToken });
  return oauth2Client;
}

/** Builds a transport with a fresh access token (refresh token is reused via `oauth2Client`). */
export async function createGmailOAuthTransport(
  oauth2Client: OAuth2Client,
  cfg: GmailOAuthConfig,
): Promise<Transporter> {
  const access = await oauth2Client.getAccessToken();
  if (!access.token) {
    throw new Error('Gmail OAuth2: failed to obtain access token');
  }
  /** Same as Nodemailer well-known "Gmail" — avoid `service: 'gmail'` random IPv6 pick on hosts without IPv6 SMTP. */
  const logicalHost = 'smtp.gmail.com';
  let host = logicalHost;
  try {
    const { address } = await dns.lookup(logicalHost, { family: 4 });
    host = address;
  } catch {
    /* use hostname */
  }
  return nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: {
      type: 'OAuth2',
      user: cfg.user,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      refreshToken: cfg.refreshToken,
      accessToken: access.token,
    },
    tls: {
      rejectUnauthorized: false,
      servername: logicalHost,
    },
    connectionTimeout: 25_000,
    greetingTimeout: 25_000,
    socketTimeout: 60_000,
  });
}
