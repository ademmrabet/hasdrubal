import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

const EMPLOYEE_COLUMNS = `
  id, full_name AS "fullName", cin, cnss_number AS "cnssNumber", phone,
  birth_date AS "birthDate", position, contract_type AS "contractType",
  contract_end_date AS "contractEndDate", weekly_hours_regime AS "weeklyHoursRegime",
  hire_date AS "hireDate", termination_date AS "terminationDate", user_id AS "userId",
  is_active AS "isActive", notes`;

/** Taux de paie courants (settings.payroll), avec repli si la cle est absente. */
async function loadPayrollRates(db = { query }) {
  const { rows } = await db.query("SELECT value FROM settings WHERE key = 'payroll'");
  const v = rows[0]?.value ?? {};
  return {
    cnssEmployeeRatePct: v.cnssEmployeeRatePct ?? 9.68,
    cnssEmployerRatePct: v.cnssEmployerRatePct ?? 17.07,
    tfpRatePct: v.tfpRatePct ?? 1,
    foprolosRatePct: v.foprolosRatePct ?? 1,
    smig48hMillimes: v.smig48hMillimes ?? 554736,
    smig40hMillimes: v.smig40hMillimes ?? 470251,
  };
}

const pct = (amountMillimes, ratePct) => Math.round(amountMillimes * ratePct / 100);

// --- Employes -----------------------------------------------------------

export async function listEmployees({ includeInactive = false, search } = {}) {
  const { rows } = await query(
    `SELECT ${EMPLOYEE_COLUMNS},
            (SELECT base_salary_millimes FROM salary_history sh
              WHERE sh.employee_id = e.id AND sh.effective_from <= CURRENT_DATE
              ORDER BY sh.effective_from DESC, sh.created_at DESC LIMIT 1) AS "currentSalaryMillimes",
            (SELECT COALESCE(SUM(amount_millimes), 0) FROM salary_advances sa
              WHERE sa.employee_id = e.id AND sa.payslip_id IS NULL) AS "pendingAdvancesMillimes"
       FROM employees e
      WHERE ($1::boolean OR is_active)
        AND ($2::text IS NULL OR full_name ILIKE '%' || $2 || '%')
      ORDER BY is_active DESC, full_name`,
    [includeInactive, search || null],
  );
  return rows;
}

export async function getEmployee(id) {
  const { rows } = await query(`SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE id = $1`, [id]);
  if (!rows[0]) throw ApiError.notFound('Employé introuvable');

  const history = await query(
    `SELECT sh.id, sh.base_salary_millimes AS "baseSalaryMillimes", sh.effective_from AS "effectiveFrom",
            sh.reason, u.full_name AS "createdByName", sh.created_at AS "createdAt"
       FROM salary_history sh LEFT JOIN users u ON u.id = sh.created_by
      WHERE sh.employee_id = $1
      ORDER BY sh.effective_from DESC, sh.created_at DESC`,
    [id],
  );
  const advances = await query(
    `SELECT sa.id, sa.amount_millimes AS "amountMillimes", sa.granted_at AS "grantedAt", sa.reason,
            sa.payslip_id AS "payslipId", u.full_name AS "createdByName", sa.created_at AS "createdAt"
       FROM salary_advances sa LEFT JOIN users u ON u.id = sa.created_by
      WHERE sa.employee_id = $1
      ORDER BY sa.granted_at DESC, sa.created_at DESC`,
    [id],
  );
  const payslips = await query(
    `SELECT id, period_start AS "periodStart", period_end AS "periodEnd",
            gross_millimes AS "grossMillimes", net_millimes AS "netMillimes",
            status, below_smig AS "belowSmig", paid_at AS "paidAt"
       FROM payslips WHERE employee_id = $1
      ORDER BY period_start DESC`,
    [id],
  );

  return {
    ...rows[0],
    currentSalaryMillimes: history.rows[0]?.baseSalaryMillimes ?? null,
    salaryHistory: history.rows,
    advances: advances.rows,
    payslips: payslips.rows,
  };
}

export async function createEmployee(body, userId) {
  // getEmployee() lit via le pool, pas via la connexion de la transaction :
  // on ne l'appelle qu'apres COMMIT (withTransaction ne valide qu'a la toute
  // fin), sinon la ligne fraichement inseree est invisible et renvoie 404.
  const id = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO employees (full_name, cin, cnss_number, phone, birth_date, position,
                              contract_type, contract_end_date, weekly_hours_regime,
                              hire_date, user_id, is_active, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [body.fullName, body.cin ?? null, body.cnssNumber ?? null, body.phone ?? null,
       body.birthDate ?? null, body.position ?? null, body.contractType, body.contractEndDate ?? null,
       body.weeklyHoursRegime, body.hireDate, body.userId ?? null, body.isActive, body.notes ?? null],
    );
    await db.query(
      `INSERT INTO salary_history (employee_id, base_salary_millimes, effective_from, reason, created_by)
       VALUES ($1,$2,$3,'embauche',$4)`,
      [rows[0].id, body.baseSalaryMillimes, body.hireDate, userId],
    );
    return rows[0].id;
  });
  return getEmployee(id);
}

export async function updateEmployee(id, body) {
  const { rowCount } = await query(
    `UPDATE employees SET full_name=$2, cin=$3, cnss_number=$4, phone=$5, birth_date=$6, position=$7,
            contract_type=$8, contract_end_date=$9, weekly_hours_regime=$10, hire_date=$11,
            termination_date=$12, user_id=$13, is_active=$14, notes=$15
      WHERE id = $1`,
    [id, body.fullName, body.cin ?? null, body.cnssNumber ?? null, body.phone ?? null, body.birthDate ?? null,
     body.position ?? null, body.contractType, body.contractEndDate ?? null, body.weeklyHoursRegime,
     body.hireDate, body.terminationDate ?? null, body.userId ?? null, body.isActive, body.notes ?? null],
  );
  if (!rowCount) throw ApiError.notFound('Employé introuvable');
  return getEmployee(id);
}

export async function deactivateEmployee(id) {
  const { rowCount } = await query(
    `UPDATE employees SET is_active = false,
            termination_date = COALESCE(termination_date, CURRENT_DATE) WHERE id = $1`,
    [id],
  );
  if (!rowCount) throw ApiError.notFound('Employé introuvable');
}

// --- Historique de salaire ------------------------------------------------

export async function addSalaryChange(employeeId, { baseSalaryMillimes, effectiveFrom, reason }, userId) {
  const exists = await query('SELECT 1 FROM employees WHERE id = $1', [employeeId]);
  if (!exists.rowCount) throw ApiError.notFound('Employé introuvable');
  const { rows } = await query(
    `INSERT INTO salary_history (employee_id, base_salary_millimes, effective_from, reason, created_by)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, base_salary_millimes AS "baseSalaryMillimes", effective_from AS "effectiveFrom", reason`,
    [employeeId, baseSalaryMillimes, effectiveFrom, reason ?? null, userId],
  );
  return rows[0];
}

// --- Avances sur salaire ----------------------------------------------

export async function createAdvance(employeeId, { amountMillimes, grantedAt, reason }, userId) {
  const exists = await query('SELECT 1 FROM employees WHERE id = $1 AND is_active', [employeeId]);
  if (!exists.rowCount) throw ApiError.notFound('Employé introuvable ou inactif');
  const { rows } = await query(
    `INSERT INTO salary_advances (employee_id, amount_millimes, granted_at, reason, created_by)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, amount_millimes AS "amountMillimes", granted_at AS "grantedAt", reason`,
    [employeeId, amountMillimes, grantedAt, reason ?? null, userId],
  );
  return rows[0];
}

export async function deleteAdvance(id) {
  const { rowCount } = await query(
    'DELETE FROM salary_advances WHERE id = $1 AND payslip_id IS NULL',
    [id],
  );
  if (!rowCount) throw ApiError.conflict('Avance introuvable, ou déjà déduite d’une fiche de paie');
}

// --- Parametres de paie (lecture pour le formulaire de fiche) ------------

export const getPayrollRates = () => loadPayrollRates();

// --- Fiches de paie -------------------------------------------------------

export async function listPayslips({ periodStart, employeeId, status } = {}) {
  const { rows } = await query(
    `SELECT p.id, p.employee_id AS "employeeId", e.full_name AS "employeeName",
            p.period_start AS "periodStart", p.period_end AS "periodEnd",
            p.gross_millimes AS "grossMillimes", p.net_millimes AS "netMillimes",
            p.employer_cost_millimes AS "employerCostMillimes",
            p.status, p.below_smig AS "belowSmig", p.paid_at AS "paidAt"
       FROM payslips p JOIN employees e ON e.id = p.employee_id
      WHERE ($1::date IS NULL OR p.period_start = $1)
        AND ($2::uuid IS NULL OR p.employee_id = $2)
        AND ($3::payslip_status IS NULL OR p.status = $3::payslip_status)
      ORDER BY p.period_start DESC, e.full_name`,
    [periodStart || null, employeeId || null, status || null],
  );
  return rows;
}

const PAYSLIP_COLUMNS = `
  p.id, p.employee_id AS "employeeId", p.period_start AS "periodStart", p.period_end AS "periodEnd",
  p.contract_type AS "contractType", p.weekly_hours_regime AS "weeklyHoursRegime",
  p.base_salary_millimes AS "baseSalaryMillimes", p.hours_worked AS "hoursWorked",
  p.overtime_hours AS "overtimeHours", p.overtime_amount_millimes AS "overtimeAmountMillimes",
  p.bonus_millimes AS "bonusMillimes", p.bonus_note AS "bonusNote",
  p.gross_millimes AS "grossMillimes",
  p.cnss_employee_rate_pct AS "cnssEmployeeRatePct", p.cnss_employee_millimes AS "cnssEmployeeMillimes",
  p.cnss_employer_rate_pct AS "cnssEmployerRatePct", p.cnss_employer_millimes AS "cnssEmployerMillimes",
  p.tfp_rate_pct AS "tfpRatePct", p.tfp_millimes AS "tfpMillimes",
  p.foprolos_rate_pct AS "foprolosRatePct", p.foprolos_millimes AS "foprolosMillimes",
  p.irpp_millimes AS "irppMillimes",
  p.other_deductions_millimes AS "otherDeductionsMillimes", p.other_deductions_note AS "otherDeductionsNote",
  p.advances_millimes AS "advancesMillimes", p.net_millimes AS "netMillimes",
  p.employer_cost_millimes AS "employerCostMillimes", p.below_smig AS "belowSmig",
  p.status, p.paid_at AS "paidAt", p.notes`;

export async function getPayslip(id) {
  const { rows } = await query(
    `SELECT ${PAYSLIP_COLUMNS},
            e.full_name AS "employeeFullName", e.cin AS "employeeCin", e.cnss_number AS "employeeCnssNumber",
            e.position AS "employeePosition", e.hire_date AS "employeeHireDate"
       FROM payslips p JOIN employees e ON e.id = p.employee_id
      WHERE p.id = $1`,
    [id],
  );
  if (!rows[0]) throw ApiError.notFound('Fiche de paie introuvable');

  const advances = await query(
    `SELECT id, amount_millimes AS "amountMillimes", granted_at AS "grantedAt", reason
       FROM salary_advances WHERE payslip_id = $1 ORDER BY granted_at`,
    [id],
  );
  return { ...rows[0], deductedAdvances: advances.rows };
}

/**
 * Calcule et enregistre une fiche de paie. Les taux CNSS/TFP/FOPROLOS et le
 * SMIG applicable sont ceux en vigueur au moment de l'emission (figes sur la
 * fiche : une modification ulterieure des taux ne change jamais une fiche
 * deja emise). L'IRPP et le montant des heures supplementaires restent une
 * saisie manuelle (voir la note en tete de la migration 005).
 */
export async function createPayslip(body, userId) {
  // Meme remarque que pour createEmployee : getPayslip() lit via le pool,
  // donc seulement apres COMMIT (renvoye par withTransaction), jamais depuis
  // l'interieur du callback.
  const id = await withTransaction(async (db) => {
    const { rows: empRows } = await db.query(
      `SELECT id, contract_type, weekly_hours_regime, is_active FROM employees WHERE id = $1 FOR UPDATE`,
      [body.employeeId],
    );
    if (!empRows[0]) throw ApiError.notFound('Employé introuvable');

    const { rows: salaryRows } = await db.query(
      `SELECT base_salary_millimes FROM salary_history
        WHERE employee_id = $1 AND effective_from <= $2
        ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      [body.employeeId, body.periodStart],
    );
    if (!salaryRows[0]) throw ApiError.badRequest('Aucun salaire connu pour cet employé à cette date');
    const baseSalaryMillimes = salaryRows[0].base_salary_millimes;

    const dup = await db.query(
      'SELECT 1 FROM payslips WHERE employee_id = $1 AND period_start = $2',
      [body.employeeId, body.periodStart],
    );
    if (dup.rowCount) throw ApiError.conflict('Une fiche de paie existe déjà pour cet employé sur cette période');

    const rates = await loadPayrollRates(db);
    const overtimeAmount = body.overtimeAmountMillimes ?? 0;
    const bonus = body.bonusMillimes ?? 0;
    const gross = baseSalaryMillimes + overtimeAmount + bonus;

    const cnssEmployee = pct(gross, rates.cnssEmployeeRatePct);
    const cnssEmployer = pct(gross, rates.cnssEmployerRatePct);
    const tfp = pct(gross, rates.tfpRatePct);
    const foprolos = pct(gross, rates.foprolosRatePct);
    const irpp = body.irppMillimes ?? 0;
    const otherDeductions = body.otherDeductionsMillimes ?? 0;

    // Les avances non deduites de cet employe, jusqu'a due concurrence de celles
    // explicitement selectionnees par l'appelant (jamais toutes automatiquement :
    // l'utilisateur choisit lesquelles regler sur cette paie).
    let advancesTotal = 0;
    const advanceIds = body.advanceIds ?? [];
    if (advanceIds.length) {
      const { rows: adv } = await db.query(
        `SELECT id, amount_millimes FROM salary_advances
          WHERE id = ANY($1::uuid[]) AND employee_id = $2 AND payslip_id IS NULL FOR UPDATE`,
        [advanceIds, body.employeeId],
      );
      if (adv.length !== advanceIds.length) {
        throw ApiError.conflict('Une des avances sélectionnées est introuvable ou déjà réglée');
      }
      advancesTotal = adv.reduce((s, a) => s + Number(a.amount_millimes), 0);
    }

    const net = gross - cnssEmployee - irpp - otherDeductions - advancesTotal;
    const employerCost = gross + cnssEmployer + tfp + foprolos;
    const smigThreshold = empRows[0].weekly_hours_regime === 40 ? rates.smig40hMillimes : rates.smig48hMillimes;
    const belowSmig = baseSalaryMillimes < smigThreshold;

    const { rows: created } = await db.query(
      `INSERT INTO payslips (
         employee_id, period_start, period_end, contract_type, weekly_hours_regime,
         base_salary_millimes, hours_worked, overtime_hours, overtime_amount_millimes,
         bonus_millimes, bonus_note, gross_millimes,
         cnss_employee_rate_pct, cnss_employee_millimes, cnss_employer_rate_pct, cnss_employer_millimes,
         tfp_rate_pct, tfp_millimes, foprolos_rate_pct, foprolos_millimes,
         irpp_millimes, other_deductions_millimes, other_deductions_note,
         advances_millimes, net_millimes, employer_cost_millimes, below_smig, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
       RETURNING id`,
      [body.employeeId, body.periodStart, body.periodEnd, empRows[0].contract_type, empRows[0].weekly_hours_regime,
       baseSalaryMillimes, body.hoursWorked ?? null, body.overtimeHours ?? 0, overtimeAmount,
       bonus, body.bonusNote ?? null, gross,
       rates.cnssEmployeeRatePct, cnssEmployee, rates.cnssEmployerRatePct, cnssEmployer,
       rates.tfpRatePct, tfp, rates.foprolosRatePct, foprolos,
       irpp, otherDeductions, body.otherDeductionsNote ?? null,
       advancesTotal, net, employerCost, belowSmig, body.notes ?? null, userId],
    );

    if (advanceIds.length) {
      await db.query('UPDATE salary_advances SET payslip_id = $1 WHERE id = ANY($2::uuid[])',
        [created[0].id, advanceIds]);
    }

    return created[0].id;
  });
  return getPayslip(id);
}

export async function setPayslipStatus(id, status, paidAt) {
  const { rowCount } = await query(
    `UPDATE payslips SET status = $2::payslip_status,
            paid_at = CASE WHEN $2::payslip_status = 'payee' THEN COALESCE($3, CURRENT_DATE) ELSE paid_at END
      WHERE id = $1`,
    [id, status, paidAt ?? null],
  );
  if (!rowCount) throw ApiError.notFound('Fiche de paie introuvable');
  return getPayslip(id);
}

export async function deletePayslip(id) {
  return withTransaction(async (db) => {
    const { rows } = await db.query("SELECT status FROM payslips WHERE id = $1 FOR UPDATE", [id]);
    if (!rows[0]) throw ApiError.notFound('Fiche de paie introuvable');
    if (rows[0].status !== 'brouillon') {
      throw ApiError.conflict('Seule une fiche au brouillon peut être supprimée');
    }
    // Libere les avances qui avaient ete rattachees a cette fiche.
    await db.query('UPDATE salary_advances SET payslip_id = NULL WHERE payslip_id = $1', [id]);
    await db.query('DELETE FROM payslips WHERE id = $1', [id]);
  });
}
