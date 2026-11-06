import "server-only";
import { prisma } from "../prisma";
import { emailTemplate, sendEmail } from "../email";
import { receiptPdf } from "../pdf/documents";
import { formatMoney } from "../utils";

/** Envoie le reçu PDF par email au locataire (si email renseigné). */
export async function sendReceiptEmail(receiptId: string) {
  const { buffer, filename, receipt, tenantEmail } = await receiptPdf(receiptId);
  if (!tenantEmail) return { ok: false, error: "Le locataire n'a pas d'email" };
  const res = await sendEmail({
    to: tenantEmail,
    subject: `Votre reçu ${receipt.number}`,
    html: emailTemplate(`Reçu ${receipt.number}`, [
      "Bonjour,",
      `Nous accusons réception de votre paiement de ${formatMoney(receipt.amount)} (${receipt.label}).`,
      "Vous trouverez votre reçu en pièce jointe. Merci pour votre confiance.",
    ]),
    attachments: [{ filename, content: buffer }],
  });
  if (res.ok) await prisma.receipt.update({ where: { id: receiptId }, data: { emailedAt: new Date() } });
  return res;
}
