/**
 * Export d'une fiche de paie en PDF, genere entierement cote client (aucun
 * appel serveur supplementaire : on part des memes donnees que celles deja
 * affichees dans le detail de la fiche).
 *
 * Note sur le formatage des montants : on evite volontairement
 * Intl.NumberFormat('fr-TN', ...) ici, car son separateur de milliers est une
 * espace fine insecable (U+202F) que les polices standard de jsPDF (encodage
 * WinAnsi) ne savent pas dessiner (verifie : elle s'affiche comme un glyphe
 * manquant). Les caracteres accentues francais standard (e, a, c, u...) sont
 * en revanche bien geres par les polices standard et s'affichent normalement.
 * On formate donc les montants a la main avec une espace normale, en gardant
 * le point comme separateur decimal (coherent avec les champs <input
 * type="number"> de l'application, deja tous a point decimal).
 *
 * jsPDF est importe dynamiquement (voir downloadPayslipPdf) plutot qu'en tete
 * de fichier : la librairie pese plusieurs centaines de ko une fois integree
 * au bundle, et seul le proprietaire consultant une fiche de paie en a
 * besoin. Un import statique l'aurait fait telecharger par tout le monde
 * (personnel de service compris) des le premier chargement de l'application.
 */
import { RESTAURANT } from './restaurant';
import { CONTRACT_TYPE_LABELS, PAYSLIP_STATUS_LABELS, formatDate, formatMonthLabel } from './format';

function pdfAmount(millimes, { withSign = false } = {}) {
  if (millimes == null) return '—';
  const value = Number(millimes);
  const negative = value < 0;
  const abs = Math.round(Math.abs(value));
  const dinars = Math.floor(abs / 1000);
  const milli = String(abs % 1000).padStart(3, '0');
  const grouped = dinars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = negative ? '-' : (withSign && abs > 0 ? '+' : '');
  return `${sign}${grouped}.${milli} DT`;
}

/** Nom de fichier sans accents ni espaces, pour un telechargement propre. */
function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const MARGIN = 16;
const PAGE_WIDTH = 210; // A4 portrait, mm

/**
 * Construit le document jsPDF pour une fiche de paie. `payslip` est la forme
 * exacte renvoyee par GET /api/payroll/payslips/:id (voir usePayslip).
 */
function buildPayslipDoc(jsPDF, payslip) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let y = MARGIN;

  // --- En-tete : identite de l'employeur -------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(RESTAURANT.fullName, MARGIN, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`${RESTAURANT.address}, ${RESTAURANT.city}, ${RESTAURANT.country}`, MARGIN, y + 5);
  doc.text(RESTAURANT.phone, MARGIN, y + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text('BULLETIN DE PAIE', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(formatMonthLabel(payslip.periodStart), PAGE_WIDTH - MARGIN, y + 5.5, { align: 'right' });

  y += 16;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  // --- Identite de l'employe --------------------------------------------
  const leftX = MARGIN;
  const rightX = MARGIN + contentWidth / 2 + 4;
  const infoLine = (x, label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 30, 30);
    doc.text(String(value ?? '—'), x, y + 4.6);
  };

  infoLine(leftX, 'Employé', payslip.employeeFullName);
  infoLine(rightX, 'Poste', payslip.employeePosition || 'Non renseigné');
  y += 11;
  infoLine(leftX, 'CIN', payslip.employeeCin || '—');
  infoLine(rightX, 'Matricule CNSS', payslip.employeeCnssNumber || '—');
  y += 11;
  infoLine(leftX, 'Type de contrat', CONTRACT_TYPE_LABELS[payslip.contractType] ?? payslip.contractType);
  infoLine(rightX, 'Régime hebdomadaire', `${payslip.weeklyHoursRegime} heures`);
  y += 11;
  infoLine(
    leftX,
    'Période',
    `Du ${formatDate(payslip.periodStart)} au ${formatDate(payslip.periodEnd)}`,
  );
  const statutTexte = payslip.status === 'payee' && payslip.paidAt
    ? `${PAYSLIP_STATUS_LABELS[payslip.status]} le ${formatDate(payslip.paidAt)}`
    : PAYSLIP_STATUS_LABELS[payslip.status] ?? payslip.status;
  infoLine(rightX, 'Statut', statutTexte);
  y += 13;

  // --- Tableau retenues / gains -------------------------------------------
  const tableRowHeight = 7;
  let stripe = false;

  const drawTableHeader = () => {
    doc.setFillColor(245, 240, 232);
    doc.rect(MARGIN, y, contentWidth, tableRowHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(90, 70, 50);
    doc.text('ÉLÉMENT', MARGIN + 3, y + 4.8);
    doc.text('MONTANT', PAGE_WIDTH - MARGIN - 3, y + 4.8, { align: 'right' });
    y += tableRowHeight;
    stripe = false;
  };

  const ensureSpace = (needed) => {
    if (y + needed > 285) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const row = (label, value, opts = {}) => {
    ensureSpace(tableRowHeight);
    if (stripe) {
      doc.setFillColor(250, 248, 244);
      doc.rect(MARGIN, y, contentWidth, tableRowHeight, 'F');
    }
    stripe = !stripe;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.small ? 8.5 : 10);
    doc.setTextColor(...(opts.color ?? [40, 40, 40]));
    doc.text(String(label), MARGIN + 3, y + 4.8);
    doc.text(String(value), PAGE_WIDTH - MARGIN - 3, y + 4.8, { align: 'right' });
    y += tableRowHeight;
  };

  const separator = () => {
    doc.setDrawColor(215, 205, 190);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  };

  drawTableHeader();
  row('Salaire de base', pdfAmount(payslip.baseSalaryMillimes));
  if (payslip.overtimeAmountMillimes > 0) {
    const label = payslip.overtimeHours
      ? `Heures supplémentaires (${payslip.overtimeHours} h)`
      : 'Heures supplémentaires';
    row(label, pdfAmount(payslip.overtimeAmountMillimes, { withSign: true }));
  }
  if (payslip.bonusMillimes > 0) {
    row(payslip.bonusNote ? `Prime — ${payslip.bonusNote}` : 'Prime', pdfAmount(payslip.bonusMillimes, { withSign: true }));
  }
  separator();
  row('BRUT', pdfAmount(payslip.grossMillimes), { bold: true });
  row(`CNSS salarié (${payslip.cnssEmployeeRatePct} %)`, pdfAmount(-payslip.cnssEmployeeMillimes));
  if (payslip.irppMillimes > 0) row('IRPP (impôt sur le revenu)', pdfAmount(-payslip.irppMillimes));
  if (payslip.otherDeductionsMillimes > 0) {
    row(payslip.otherDeductionsNote || 'Autres retenues', pdfAmount(-payslip.otherDeductionsMillimes));
  }
  if (payslip.advancesMillimes > 0) {
    row('Avances sur salaire déduites', pdfAmount(-payslip.advancesMillimes));
    for (const adv of payslip.deductedAdvances ?? []) {
      const detail = `${formatDate(adv.grantedAt)}${adv.reason ? ` — ${adv.reason}` : ''}`;
      row(`   ${detail}`, pdfAmount(-adv.amountMillimes), { small: true, color: [120, 120, 120] });
    }
  }
  separator();
  ensureSpace(tableRowHeight + 2);
  doc.setFillColor(90, 70, 50);
  doc.rect(MARGIN, y, contentWidth, tableRowHeight + 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(255, 255, 255);
  doc.text('NET À PAYER', MARGIN + 3, y + 5.6);
  doc.text(pdfAmount(payslip.netMillimes), PAGE_WIDTH - MARGIN - 3, y + 5.6, { align: 'right' });
  y += tableRowHeight + 2 + 10;

  // --- Charges patronales (indicatif) ------------------------------------
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(120, 120, 120);
  doc.text('CHARGES PATRONALES (À TITRE INDICATIF, NON DÉDUITES DU SALARIÉ)', MARGIN, y);
  y += 6;

  const employerRow = (label, value) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 70, 70);
    doc.text(label, MARGIN + 3, y);
    doc.text(value, PAGE_WIDTH - MARGIN - 3, y, { align: 'right' });
    y += 5.5;
  };
  employerRow(`CNSS employeur (${payslip.cnssEmployerRatePct} %)`, pdfAmount(payslip.cnssEmployerMillimes));
  employerRow(`TFP (${payslip.tfpRatePct} %)`, pdfAmount(payslip.tfpMillimes));
  employerRow(`FOPROLOS (${payslip.foprolosRatePct} %)`, pdfAmount(payslip.foprolosMillimes));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  doc.text('Coût total employeur', MARGIN + 3, y);
  doc.text(pdfAmount(payslip.employerCostMillimes), PAGE_WIDTH - MARGIN - 3, y, { align: 'right' });
  y += 12;

  if (payslip.belowSmig) {
    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 60, 50);
    doc.text('Le salaire de base est en dessous du SMIG applicable pour ce régime horaire.', MARGIN, y);
    y += 8;
  }

  // --- Pied de page ---------------------------------------------------
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Document généré le ${formatDate(new Date(), 'medium')} — Système de gestion Hasdrubal`,
      MARGIN,
      292,
    );
    if (pageCount > 1) doc.text(`${i} / ${pageCount}`, PAGE_WIDTH - MARGIN, 292, { align: 'right' });
  }

  return doc;
}

/** Génère le PDF et déclenche son téléchargement dans le navigateur. */
export async function downloadPayslipPdf(payslip) {
  const { jsPDF } = await import('jspdf');
  const doc = buildPayslipDoc(jsPDF, payslip);
  const filename = `bulletin-paie-${slugify(payslip.employeeFullName)}-${payslip.periodStart.slice(0, 7)}.pdf`;
  doc.save(filename);
}
