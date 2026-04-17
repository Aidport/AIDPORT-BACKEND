import { getMailgen } from './mailgen.factory';

export type ShipmentAssignedAgentParams = {
  agentName: string;
  shipmentId: string;
  cargoName: string;
  originCity: string;
  destinationCity: string;
  shipperName?: string;
};

/** When admin assigns a shipment to an agent after payment. */
export function buildShipmentAssignedToAgentEmail(params: ShipmentAssignedAgentParams) {
  const mailgen = getMailgen();
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const dashboardLink = `${baseUrl.replace(/\/$/, '')}/agent/shipments`;

  const intro: string[] = [
    'An administrator has assigned a shipment to you.',
    `Shipment ID: ${params.shipmentId}`,
    `Cargo: ${params.cargoName}`,
    `Route: ${params.originCity} → ${params.destinationCity}`,
  ];
  if (params.shipperName) {
    intro.push(`Shipper: ${params.shipperName}`);
  }

  const email = {
    body: {
      name: params.agentName,
      intro,
      action: {
        instructions: 'Open your agent dashboard to view the shipment and add rates if needed.',
        button: {
          color: '#2563eb',
          text: 'View shipments',
          link: dashboardLink,
        },
      },
      outro: `If the button does not work: ${dashboardLink}`,
    },
  };

  return {
    subject: `Aidport — New shipment assigned: ${params.cargoName}`,
    html: mailgen.generate(email),
    text: mailgen.generatePlaintext(email),
  };
}
