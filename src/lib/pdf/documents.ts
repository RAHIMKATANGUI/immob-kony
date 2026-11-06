import "server-only";
import type { Content } from "pdfmake/interfaces";
import { prisma } from "../prisma";
import { getSettings } from "../settings";
import { formatDate, formatMoneyPdf, formatMonth, toNumber } from "../utils";
import { notFound } from "../errors";
import { leaseBalance } from "../services/rent.service";
import { COLORS, dataTable, fieldGrid, headerBand, imageDataUrl, pdfText, qrDataUrl, renderPdf } from "./core";
import { APARTMENT_STATUS, ID_TYPES, PAYMENT_METHODS, PAYMENT_TYPES, RENT_STATUS, ROOM_TYPES } from "../labels";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const money = (v: unknown, cur?: string) => formatMoneyPdf(v, cur);
const date = (d: Date | null | undefined) => pdfText(formatDate(d, { month: "long" }));

function signatureBlock(left: string, right: string, signatureImage?: string | null): Content {
  return {
    margin: [0, 30, 0, 0],
    columns: [
      { stack: [{ text: left, bold: true, fontSize: 9 }, { text: "Lu et approuvé, signature :", style: "small", margin: [0, 4, 0, 0] }, { canvas: [{ type: "line", x1: 0, y1: 50, x2: 200, y2: 50, lineWidth: 0.5, lineColor: COLORS.muted }] }] },
      {
        stack: [
          { text: right, bold: true, fontSize: 9 },
          { text: "Lu et approuvé, signature :", style: "small", margin: [0, 4, 0, 0] },
          signatureImage ? { image: signatureImage, width: 120, margin: [0, 4, 0, 0] } : { canvas: [{ type: "line", x1: 0, y1: 50, x2: 200, y2: 50, lineWidth: 0.5, lineColor: COLORS.muted }] },
        ],
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Reçu de paiement                                                    */
/* ------------------------------------------------------------------ */
export async function receiptPdf(receiptId: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        include: {
          recordedBy: true,
          allocations: { include: { rent: true }, orderBy: { rent: { period: "asc" } } },
          advancePayment: true,
          lease: { include: { tenant: true, residence: { include: { owner: true } }, apartment: true, deposit: true } },
        },
      },
    },
  });
  if (!receipt) throw notFound("Reçu introuvable");
  const s = await getSettings();
  const { payment } = receipt;
  const { lease } = payment;
  const balance = await leaseBalance(lease.id);
  const qr = await qrDataUrl(`${appUrl()}/verify/${receipt.verifyToken}`);

  const allocRows = payment.allocations.map((a) => [pdfText(formatMonth(a.rent.period)), date(a.rent.dueDate), money(a.rent.amount, s.currency), money(a.amount, s.currency), RENT_STATUS[a.rent.status]]);

  const content: Content[] = [
    headerBand(s.agencyName, "REÇU DE PAIEMENT", receipt.number),
    {
      columns: [
        {
          width: "*",
          stack: [
            fieldGrid(
              [
                ["Locataire", `${lease.tenant.firstName} ${lease.tenant.lastName}`],
                ["Téléphone", lease.tenant.phone],
                ["Bail", lease.reference],
                ["Résidence", lease.residence.name],
                ["Appartement", lease.apartment ? `N° ${lease.apartment.number}` : "—"],
                ["Propriétaire", `${lease.residence.owner.firstName} ${lease.residence.owner.lastName}`],
                ["Date du paiement", date(payment.paidAt)],
                ["Mode de paiement", PAYMENT_METHODS[payment.method]],
                ["Référence", payment.reference],
              ],
              3,
            ),
          ],
        },
        { width: 110, stack: [{ image: qr, width: 100, alignment: "right" }, { text: "Scannez pour vérifier", style: "small", alignment: "right" }] },
      ],
      columnGap: 12,
    },
    {
      margin: [0, 10, 0, 10],
      table: {
        widths: ["*", "auto"],
        body: [
          [
            { text: [{ text: "Objet : ", bold: true }, pdfText(receipt.label)], margin: [12, 12, 0, 12] },
            { text: money(receipt.amount, s.currency), bold: true, fontSize: 16, color: COLORS.turquoise, margin: [0, 8, 12, 8] },
          ],
        ],
      },
      layout: { fillColor: () => COLORS.soft, hLineWidth: () => 0, vLineWidth: () => 0 },
    },
  ];

  if (payment.type === "DEPOSIT" && lease.deposit) {
    content.push({ text: "Situation de la caution", style: "h2" });
    content.push(
      fieldGrid([
        ["Montant de la caution", money(lease.deposit.amount, s.currency)],
        ["Total versé", money(lease.deposit.amountPaid, s.currency)],
        ["Restant à payer", money(toNumber(lease.deposit.amount) - toNumber(lease.deposit.amountPaid), s.currency)],
      ]),
    );
  } else {
    if (allocRows.length) {
      content.push({ text: "Échéances réglées", style: "h2" });
      content.push(dataTable(["Période", "Échéance", "Montant dû", "Réglé par ce paiement", "Statut"], allocRows, ["*", "auto", "auto", "auto", "auto"]));
    }
    content.push({ text: "Situation du compte", style: "h2" });
    content.push(
      fieldGrid([
        ["Loyer mensuel (charges incl.)", money(balance.monthlyTotal, s.currency)],
        ["Arriéré", money(balance.arrears, s.currency)],
        ["Solde disponible (avance)", money(balance.creditBalance, s.currency)],
        ["Payé jusqu'à", balance.paidUntil ? pdfText(formatMonth(balance.paidUntil)) : "—"],
        ["Prochaine échéance", balance.nextDueDate ? date(balance.nextDueDate) : "—"],
        ["Montant prochaine échéance", money(balance.nextDueAmount, s.currency)],
      ]),
    );
    if (payment.advancePayment) {
      content.push({
        text: pdfText(
          `Paiement anticipé : ${payment.advancePayment.monthsCovered} mois couverts de ${formatMonth(payment.advancePayment.coveredFrom)} à ${formatMonth(payment.advancePayment.coveredTo)}.`,
        ),
        color: COLORS.turquoise,
        bold: true,
        margin: [0, 4, 0, 0],
      });
    }
  }

  content.push(signatureBlock("Le locataire", `Pour ${s.agencyName}${payment.recordedBy ? ` — ${payment.recordedBy.firstName} ${payment.recordedBy.lastName}` : ""}`));
  content.push({ text: pdfText(`Reçu émis le ${formatDate(receipt.issuedAt, { month: "long" })}. Ce document fait foi de paiement. Vérification en ligne via le QR code.`), style: "small", margin: [0, 24, 0, 0] });

  return { buffer: await renderPdf({ content, info: { title: `Reçu ${receipt.number}` } }), filename: `${receipt.number}.pdf`, receipt, tenantEmail: lease.tenant.email };
}

/* ------------------------------------------------------------------ */
/*  Contrat de bail                                                     */
/* ------------------------------------------------------------------ */
export async function leaseContractPdf(leaseId: string) {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      tenant: true,
      deposit: true,
      apartment: { include: { rooms: true } },
      residence: { include: { owner: true, manager: true } },
    },
  });
  if (!lease) throw notFound("Bail introuvable");
  const s = await getSettings();
  const owner = lease.residence.owner;
  const manager = lease.residence.manager;
  const qr = await qrDataUrl(`${appUrl()}/leases/${lease.id}`);
  const clauses = (lease.clauses || s.defaultClauses || "").split(/\n+/).filter(Boolean);

  const party = (title: string, lines: (string | null | undefined)[]) => ({
    width: "*",
    table: {
      widths: ["*"],
      body: [[{ stack: [{ text: title, style: "label", margin: [0, 0, 0, 4] }, ...lines.filter(Boolean).map((l, i) => ({ text: pdfText(l), fontSize: i === 0 ? 10 : 9, bold: i === 0 }))], margin: [8, 8, 8, 8] }]],
    },
    layout: { fillColor: () => COLORS.soft, hLineWidth: () => 0, vLineWidth: () => 0 },
  }) as Content;

  const content: Content[] = [
    headerBand(s.agencyName, "CONTRAT DE BAIL D'HABITATION", lease.reference),
    { text: "ENTRE LES SOUSSIGNÉS", style: "h2", margin: [0, 0, 0, 8] },
    {
      columns: [
        party("LE BAILLEUR (PROPRIÉTAIRE)", [`${owner.firstName} ${owner.lastName}`, owner.address, `Tél. ${owner.phone}`, owner.email]),
        party("LE MANDATAIRE (GESTIONNAIRE)", manager ? [`${manager.firstName} ${manager.lastName}`, manager.company, manager.address, `Tél. ${manager.phone}`, manager.email] : [s.agencyName, s.agencyAddress, s.agencyPhone]),
        party("LE PRENEUR (LOCATAIRE)", [
          `${lease.tenant.firstName} ${lease.tenant.lastName}`,
          lease.tenant.profession,
          `${ID_TYPES[lease.tenant.idType]} n° ${lease.tenant.idNumber}`,
          `Tél. ${lease.tenant.phone}`,
          lease.tenant.email,
        ]),
      ],
      columnGap: 8,
    },
    { text: "ARTICLE 1 — DÉSIGNATION DES LIEUX", style: "h2" },
    fieldGrid([
      ["Résidence", lease.residence.name],
      ["Adresse", `${lease.residence.address}, ${lease.residence.commune}, ${lease.residence.city}`],
      ["Appartement", lease.apartment ? `N° ${lease.apartment.number} — étage ${lease.apartment.floor}` : "Logement au sein de la résidence"],
      ["Surface", lease.apartment ? `${toNumber(lease.apartment.surface)} m²` : "—"],
      ["Nombre de pièces", lease.apartment?.roomsCount ?? "—"],
      ["Occupants déclarés", `${lease.tenant.totalOccupants} (${lease.tenant.adults} adulte(s), ${lease.tenant.children} enfant(s))`],
    ]),
    ...(lease.apartment?.rooms.length
      ? [{ text: pdfText(`Composition : ${lease.apartment.rooms.map((r) => r.label || ROOM_TYPES[r.type]).join(", ")}.`), style: "small", margin: [0, 0, 0, 6] } as Content]
      : []),
    { text: "ARTICLE 2 — DURÉE", style: "h2" },
    { text: pdfText(`Le présent bail est consenti pour une durée de ${lease.durationMonths} mois, prenant effet le ${formatDate(lease.startDate, { month: "long" })} pour se terminer le ${formatDate(lease.endDate, { month: "long" })}. Il pourra être renouvelé par accord exprès des parties.`), alignment: "justify" },
    { text: "ARTICLE 3 — LOYER, CHARGES ET CAUTION", style: "h2" },
    fieldGrid([
      ["Loyer mensuel", money(lease.monthlyRent, s.currency)],
      ["Charges mensuelles", money(lease.charges, s.currency)],
      ["Total mensuel", money(toNumber(lease.monthlyRent) + toNumber(lease.charges), s.currency)],
      ["Échéance", `Le ${lease.dueDay} de chaque mois`],
      ["Dépôt de garantie (caution)", money(lease.deposit?.amount ?? 0, s.currency)],
      ["Montant total du bail", money((toNumber(lease.monthlyRent) + toNumber(lease.charges)) * lease.durationMonths, s.currency)],
    ]),
    { text: "ARTICLE 4 — CLAUSES ET CONDITIONS", style: "h2" },
    ...clauses.map((c) => ({ text: pdfText(c), margin: [0, 0, 0, 5], alignment: "justify", fontSize: 9.5 }) as Content),
    { text: pdfText(`Fait en deux exemplaires originaux, le ${formatDate(lease.signedAt ?? lease.createdAt, { month: "long" })}${lease.residence.city ? ` à ${lease.residence.city}` : ""}.`), margin: [0, 16, 0, 0] },
    signatureBlock("LE BAILLEUR / MANDATAIRE", "LE PRENEUR"),
    { columns: [{ text: "" }, { image: qr, width: 64, alignment: "right" }], margin: [0, 18, 0, 0] },
  ];

  return { buffer: await renderPdf({ content, info: { title: `Contrat ${lease.reference}` } }), filename: `Contrat-${lease.reference}.pdf` };
}

/* ------------------------------------------------------------------ */
/*  Fiche individuelle locataire                                        */
/* ------------------------------------------------------------------ */
export async function tenantSheetPdf(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      residence: true,
      apartment: true,
      leases: {
        orderBy: { startDate: "desc" },
        include: { deposit: true, apartment: true, payments: { orderBy: { paidAt: "desc" }, take: 24, include: { receipt: true } } },
      },
    },
  });
  if (!tenant) throw notFound("Locataire introuvable");
  const s = await getSettings();
  const [photo, signature, qr] = await Promise.all([
    imageDataUrl(tenant.photoUrl),
    imageDataUrl(tenant.signatureUrl),
    qrDataUrl(`${appUrl()}/tenants/${tenant.id}`),
  ]);
  const lease = tenant.leases.find((l) => l.status === "ACTIVE") ?? tenant.leases[0];
  const balance = lease ? await leaseBalance(lease.id) : null;
  const payments = tenant.leases.flatMap((l) => l.payments.map((p) => ({ ...p, ref: l.reference }))).sort((a, b) => +b.paidAt - +a.paidAt).slice(0, 24);

  const content: Content[] = [
    headerBand(s.agencyName, "FICHE INDIVIDUELLE LOCATAIRE", tenant.code),
    {
      columns: [
        photo
          ? { image: photo, width: 96, height: 96 }
          : { table: { widths: [96], heights: [96], body: [[{ text: `${tenant.firstName[0]}${tenant.lastName[0]}`, fontSize: 30, bold: true, color: "#ffffff", alignment: "center", margin: [0, 28, 0, 0] }]] }, layout: { fillColor: () => COLORS.night, hLineWidth: () => 0, vLineWidth: () => 0 }, width: 96 },
        {
          width: "*",
          stack: [
            { text: pdfText(`${tenant.firstName} ${tenant.lastName}`), style: "h1" },
            { text: pdfText(tenant.profession ?? "Profession non renseignée"), color: COLORS.slate, margin: [0, 2, 0, 10] },
            fieldGrid(
              [
                ["Téléphone", tenant.phone],
                ["Email", tenant.email],
                [ID_TYPES[tenant.idType], tenant.idNumber],
                ["Date d'entrée", date(tenant.entryDate)],
                ["Date de sortie", tenant.exitDate ? date(tenant.exitDate) : "En cours"],
                ["Occupants", `${tenant.totalOccupants} (${tenant.adults} ad. / ${tenant.children} enf.)`],
              ],
              3,
            ),
          ],
        },
        { width: 80, stack: [{ image: qr, width: 76 }, { text: "Dossier en ligne", style: "small", alignment: "center" }] },
      ],
      columnGap: 14,
    },
    { text: "Logement occupé", style: "h2" },
    fieldGrid([
      ["Résidence", tenant.residence.name],
      ["Adresse", `${tenant.residence.address}, ${tenant.residence.commune}`],
      ["Appartement", tenant.apartment ? `N° ${tenant.apartment.number} (étage ${tenant.apartment.floor}) — ${APARTMENT_STATUS[tenant.apartment.status]}` : "Rattaché à la résidence"],
    ]),
  ];

  if (lease) {
    content.push({ text: "Contrat de bail", style: "h2" });
    content.push(
      fieldGrid([
        ["Référence", lease.reference],
        ["Période", `${formatDate(lease.startDate)} → ${formatDate(lease.endDate)}`],
        ["Loyer + charges", money(toNumber(lease.monthlyRent) + toNumber(lease.charges), s.currency)],
        ["Arriéré", money(balance?.arrears, s.currency)],
        ["Solde disponible", money(balance?.creditBalance, s.currency)],
        ["Prochaine échéance", balance?.nextDueDate ? date(balance.nextDueDate) : "—"],
      ]),
    );
    content.push({ text: "Caution", style: "h2" });
    content.push(
      fieldGrid([
        ["Montant", money(lease.deposit?.amount ?? 0, s.currency)],
        ["Versé", money(lease.deposit?.amountPaid ?? 0, s.currency)],
        ["Restant", money(toNumber(lease.deposit?.amount) - toNumber(lease.deposit?.amountPaid), s.currency)],
      ]),
    );
  }

  content.push({ text: "Historique des paiements", style: "h2" });
  content.push(
    payments.length
      ? dataTable(
          ["Date", "Reçu", "Bail", "Type", "Mode", "Montant"],
          payments.map((p) => [formatDate(p.paidAt), p.receipt?.number ?? "—", p.ref, PAYMENT_TYPES[p.type], PAYMENT_METHODS[p.method], money(p.amount, s.currency)]),
          ["auto", "auto", "auto", "*", "auto", "auto"],
        )
      : { text: "Aucun paiement enregistré.", style: "small" },
  );
  content.push(signatureBlock("Le gestionnaire", "Le locataire", signature));

  return { buffer: await renderPdf({ content, info: { title: `Fiche ${tenant.code}` } }), filename: `Fiche-${tenant.code}.pdf` };
}

/* ------------------------------------------------------------------ */
/*  Relevé de caution                                                   */
/* ------------------------------------------------------------------ */
export async function depositStatementPdf(depositId: string) {
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
    include: { payments: { orderBy: { paidAt: "asc" }, include: { receipt: true } }, lease: { include: { tenant: true, residence: true, apartment: true } } },
  });
  if (!deposit) throw notFound("Caution introuvable");
  const s = await getSettings();
  const { lease } = deposit;
  const content: Content[] = [
    headerBand(s.agencyName, "RELEVÉ DE CAUTION", lease.reference),
    fieldGrid([
      ["Locataire", `${lease.tenant.firstName} ${lease.tenant.lastName}`],
      ["Résidence", lease.residence.name],
      ["Appartement", lease.apartment?.number ?? "—"],
      ["Montant de la caution", money(deposit.amount, s.currency)],
      ["Total versé", money(deposit.amountPaid, s.currency)],
      ["Restant à payer", money(toNumber(deposit.amount) - toNumber(deposit.amountPaid), s.currency)],
      ["Premier versement", date(deposit.firstPaidAt)],
      ["Restitution", deposit.refundedAt ? `${money(deposit.refundedAmount, s.currency)} le ${formatDate(deposit.refundedAt)}` : "—"],
    ]),
    { text: "Historique des versements", style: "h2" },
    deposit.payments.length
      ? dataTable(["Date", "Reçu", "Mode", "Référence", "Montant"], deposit.payments.map((p) => [formatDate(p.paidAt), p.receipt?.number ?? "—", PAYMENT_METHODS[p.method], p.reference ?? "—", money(p.amount, s.currency)]))
      : { text: "Aucun versement.", style: "small" },
    signatureBlock("Le locataire", s.agencyName),
  ];
  return { buffer: await renderPdf({ content, info: { title: `Caution ${lease.reference}` } }), filename: `Caution-${lease.reference}.pdf` };
}

/* ------------------------------------------------------------------ */
/*  Export tabulaire générique                                          */
/* ------------------------------------------------------------------ */
export async function tablePdf(title: string, headers: string[], rows: (string | number)[][]) {
  const s = await getSettings();
  return renderPdf({
    pageOrientation: headers.length > 6 ? "landscape" : "portrait",
    content: [headerBand(s.agencyName, title.toUpperCase(), `${rows.length} enregistrement(s)`), dataTable(headers, rows)],
    info: { title },
  });
}
