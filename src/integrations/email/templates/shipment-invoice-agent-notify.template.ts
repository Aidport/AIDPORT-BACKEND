import { getMailgen } from './mailgen.factory';

/** Notifies the assigned / involved agent that an invoice was sent to the shipper. */
export function buildShipmentInvoiceAgentNotifyEmail(params: {
  agentName: string;
  shipmentId: string;
  cargoName: string;
  originCity: string;
  destinationCity: string;
  shipperName: string;
  shipperEmail: string;
  totalPrice: number;
  paymentLink: string;
}) {
  const mailgen = getMailgen();
  const {
    agentName,
    shipmentId,
    cargoName,
    originCity,
    destinationCity,
    shipperName,
    shipperEmail,
    totalPrice,
    paymentLink,
  } = params;

  const email = {
    body: {
      name: agentName,
      intro: [
        'An invoice was sent for a shipment you are associated with on Aidport.',
        `Shipment ID: ${shipmentId}`,
        `Cargo: ${cargoName}`,
        `Route: ${originCity} → ${destinationCity}`,
        `Customer (shipper): ${shipperName} (${shipperEmail})`,
        `Invoice total: ${totalPrice}`,
        'The customer has been emailed the same invoice with a secure payment link.',
      ],
      action: {
        instructions: 'Payment link (for your reference — payment is made by the customer).',
        button: {
          color: '#64748b',
          text: 'View payment link',
          link: paymentLink,
        },
      },
      outro: 'If you are not involved with this shipment, contact support.',
    },
  };

  return {
    subject: `Aidport — Invoice sent: ${cargoName} (${shipmentId})`,
    html: mailgen.generate(email),
    text: mailgen.generatePlaintext(email),
  };
}
