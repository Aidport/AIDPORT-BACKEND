import { getMailgen } from './mailgen.factory';

export type InvoiceParcelLine = {
  name: string;
  quantity?: number;
  price: number;
};

/** Admin-sent shipment invoice with Paystack (or other) payment link. */
export function buildShipmentInvoiceEmail(params: {
  recipientName: string;
  cargoName: string;
  originCity: string;
  destinationCity: string;
  parcelItems: InvoiceParcelLine[];
  totalPrice: number;
  paymentLink: string;
}) {
  const mailgen = getMailgen();
  const {
    recipientName,
    cargoName,
    originCity,
    destinationCity,
    parcelItems,
    totalPrice,
    paymentLink,
  } = params;

  const tableData = parcelItems.map((p) => ({
    item: p.name,
    qty: p.quantity != null ? String(p.quantity) : '—',
    amount: String(p.price),
  }));

  const email = {
    body: {
      name: recipientName,
      intro: [
        `Your shipment invoice for ${cargoName} is ready.`,
        `Route: ${originCity} → ${destinationCity}`,
      ],
      table: {
        title: 'Invoice items',
        data: tableData,
        columns: {
          customWidth: {
            item: '45%',
            qty: '15%',
            amount: '40%',
          },
        },
      },
      dictionary: {
        'Total (NGN or as quoted)': String(totalPrice),
      },
      action: {
        instructions: 'Complete payment using the secure link below.',
        button: {
          color: '#16a34a',
          text: 'Pay now',
          link: paymentLink,
        },
      },
      outro: `If you have questions, reply to this email or contact support. Pay link: ${paymentLink}`,
    },
  };

  return {
    subject: `Aidport — Invoice: ${cargoName}`,
    html: mailgen.generate(email),
    text: mailgen.generatePlaintext(email),
  };
}
