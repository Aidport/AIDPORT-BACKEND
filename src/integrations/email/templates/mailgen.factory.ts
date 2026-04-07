import Mailgen = require('mailgen');

let instance: Mailgen | null = null;

/** Shared Mailgen instance (theme + product branding). */
export function getMailgen(): Mailgen {
  if (!instance) {
    instance = new Mailgen({
      theme: 'default',
      product: {
        name: 'Aidport',
        link: process.env.FRONTEND_URL || 'http://localhost:3000',
        copyright: 'Aidport — Shipment & Logistics',
      },
    });
  }
  return instance;
}
