import { createApp } from '../src/app.js';
import { pool } from '../src/config/db.js';

const app = createApp();
const server = app.listen(4102);
const BASE = 'http://localhost:4102/api';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Hasdrubal2026!' }),
  });
  const body = await res.json();
  return { token: body.accessToken, user: body.user, status: res.status };
}

const call = (token, path, opts = {}) => fetch(`${BASE}${path}`, {
  ...opts,
  headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

try {
  const owner = await login('owner@hasdrubal.tn');
  const manager = await login('manager@hasdrubal.tn');
  const staff = await login('staff@hasdrubal.tn');
  check('connexions', owner.status === 200 && manager.status === 200 && staff.status === 200);

  console.log('\n--- RBAC : reserve au proprietaire ---');
  const managerList = await call(manager.token, '/payroll/employees');
  check('manager bloque sur /payroll', managerList.status === 403, `recu ${managerList.status}`);
  const staffList = await call(staff.token, '/payroll/employees');
  check('staff bloque sur /payroll', staffList.status === 403, `recu ${staffList.status}`);

  console.log('\n--- Parametres de paie (settings generiques) ---');
  const rates = await call(owner.token, '/settings/payroll');
  check('taux CNSS/TFP/FOPROLOS/SMIG presents', rates.status === 200 &&
    rates.body.data.cnssEmployeeRatePct === 9.68 && rates.body.data.cnssEmployerRatePct === 17.07 &&
    rates.body.data.tfpRatePct === 1 && rates.body.data.foprolosRatePct === 1 &&
    rates.body.data.smig48hMillimes === 554736 && rates.body.data.smig40hMillimes === 470251,
    JSON.stringify(rates.body));

  console.log('\n--- Employes ---');
  const badEmployee = await call(owner.token, '/payroll/employees', {
    method: 'POST', body: JSON.stringify({ fullName: 'X', weeklyHoursRegime: 45, hireDate: '2026-01-01', baseSalaryMillimes: 500000 }),
  });
  check('regime horaire invalide rejete', badEmployee.status === 400, JSON.stringify(badEmployee.body));

  const cddNoEnd = await call(owner.token, '/payroll/employees', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'CDD sans fin', contractType: 'cdd', weeklyHoursRegime: 48,
      hireDate: '2026-01-01', baseSalaryMillimes: 500000,
    }),
  });
  check('CDD sans date de fin rejete', cddNoEnd.status === 400, JSON.stringify(cddNoEnd.body));

  const emp = await call(owner.token, '/payroll/employees', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Amine Serveur', cin: '12345678', cnssNumber: 'CNSS-001', phone: '+216 20 111 222',
      position: 'Serveur', contractType: 'cdi', weeklyHoursRegime: 48, hireDate: '2026-01-01',
      baseSalaryMillimes: 600000,
    }),
  });
  check('creation employe', emp.status === 201 && emp.body.data.fullName === 'Amine Serveur' &&
    emp.body.data.currentSalaryMillimes === 600000, JSON.stringify(emp.body).slice(0, 300));
  const empId = emp.body.data.id;

  const belowSmigEmp = await call(owner.token, '/payroll/employees', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Sous SMIG', contractType: 'cdi', weeklyHoursRegime: 48, hireDate: '2026-01-01',
      baseSalaryMillimes: 300000,
    }),
  });
  check('employe cree meme sous le SMIG (alerte geree a la fiche)', belowSmigEmp.status === 201);
  const belowSmigId = belowSmigEmp.body.data.id;

  const list = await call(owner.token, '/payroll/employees');
  check('liste employes actifs', list.status === 200 && list.body.data.length === 2, JSON.stringify(list.body));

  const detail = await call(owner.token, `/payroll/employees/${empId}`);
  check('detail employe avec historique de salaire', detail.status === 200 &&
    detail.body.data.salaryHistory.length === 1 && detail.body.data.salaryHistory[0].reason === 'embauche',
    JSON.stringify(detail.body));

  const raise = await call(owner.token, `/payroll/employees/${empId}/salary`, {
    method: 'POST',
    body: JSON.stringify({ baseSalaryMillimes: 700000, effectiveFrom: '2026-06-01', reason: 'augmentation' }),
  });
  check('augmentation enregistree', raise.status === 201 && raise.body.data.baseSalaryMillimes === 700000,
    JSON.stringify(raise.body));

  console.log('\n--- Avances sur salaire ---');
  const advance = await call(owner.token, `/payroll/employees/${empId}/advances`, {
    method: 'POST', body: JSON.stringify({ amountMillimes: 50000, grantedAt: '2026-01-15', reason: 'Avance depannage' }),
  });
  check('avance creee', advance.status === 201 && advance.body.data.amountMillimes === 50000, JSON.stringify(advance.body));
  const advanceId = advance.body.data.id;

  const empWithAdvance = await call(owner.token, `/payroll/employees/${empId}`);
  check('avance visible sur le detail employe', empWithAdvance.body.data.advances.length === 1);

  console.log('\n--- Fiches de paie ---');
  const noSalaryYet = await call(owner.token, '/payroll/payslips', {
    method: 'POST',
    body: JSON.stringify({ employeeId: empId, periodStart: '2025-12-01', periodEnd: '2025-12-31' }),
  });
  check('pas de salaire connu avant embauche : rejete', noSalaryYet.status === 400, JSON.stringify(noSalaryYet.body));

  const payslip1 = await call(owner.token, '/payroll/payslips', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: empId, periodStart: '2026-01-01', periodEnd: '2026-01-31',
      hoursWorked: 208, advanceIds: [advanceId],
    }),
  });
  const p1 = payslip1.body?.data;
  const expectedCnssEmployee = Math.round(600000 * 9.68 / 100);
  const expectedCnssEmployer = Math.round(600000 * 17.07 / 100);
  const expectedTfp = Math.round(600000 * 1 / 100);
  const expectedNet = 600000 - expectedCnssEmployee - 50000;
  check('fiche de paie de janvier calculee', payslip1.status === 201 &&
    p1.baseSalaryMillimes === 600000 && p1.grossMillimes === 600000 &&
    p1.cnssEmployeeMillimes === expectedCnssEmployee && p1.cnssEmployerMillimes === expectedCnssEmployer &&
    p1.tfpMillimes === expectedTfp && p1.advancesMillimes === 50000 && p1.netMillimes === expectedNet &&
    p1.belowSmig === false, JSON.stringify(p1));
  check('avance rattachee a la fiche', p1.deductedAdvances.length === 1 && p1.deductedAdvances[0].id === advanceId);

  const advanceAfterUse = await call(owner.token, `/payroll/employees/${empId}`);
  check('avance deduite absente des avances en attente',
    !advanceAfterUse.body.data.advances.some((a) => a.id === advanceId && a.payslipId === null));

  const dupPeriod = await call(owner.token, '/payroll/payslips', {
    method: 'POST',
    body: JSON.stringify({ employeeId: empId, periodStart: '2026-01-01', periodEnd: '2026-01-31' }),
  });
  check('doublon de periode refuse', dupPeriod.status === 409, JSON.stringify(dupPeriod.body));

  const alreadyDeductedAdvance = await call(owner.token, '/payroll/payslips', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: empId, periodStart: '2026-02-01', periodEnd: '2026-02-28', advanceIds: [advanceId],
    }),
  });
  check('avance deja reglee refusee sur une autre fiche', alreadyDeductedAdvance.status === 409,
    JSON.stringify(alreadyDeductedAdvance.body));

  const smigThresholdMillimes = 554736;
  const belowSmigSlip = await call(owner.token, '/payroll/payslips', {
    method: 'POST',
    body: JSON.stringify({ employeeId: belowSmigId, periodStart: '2026-01-01', periodEnd: '2026-01-31' }),
  });
  check('alerte SMIG declenchee sous le seuil 48h', belowSmigSlip.status === 201 &&
    belowSmigSlip.body.data.belowSmig === true && belowSmigSlip.body.data.baseSalaryMillimes < smigThresholdMillimes,
    JSON.stringify(belowSmigSlip.body));

  const raiseAfterFiche = await call(owner.token, `/payroll/payslips/${p1.id}`);
  check('la fiche emise garde le salaire fige malgre l\'augmentation posterieure',
    raiseAfterFiche.body.data.baseSalaryMillimes === 600000);

  console.log('\n--- Statuts et suppression ---');
  const statusBad = await call(owner.token, `/payroll/payslips/${p1.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'inexistant' }),
  });
  check('statut invalide rejete', statusBad.status === 400);

  const toValidated = await call(owner.token, `/payroll/payslips/${p1.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'validee' }),
  });
  check('passage a validee', toValidated.status === 200 && toValidated.body.data.status === 'validee');

  const cannotDeleteValidated = await call(owner.token, `/payroll/payslips/${p1.id}`, { method: 'DELETE' });
  check('suppression refusee hors brouillon', cannotDeleteValidated.status === 409, JSON.stringify(cannotDeleteValidated.body));

  const toPaid = await call(owner.token, `/payroll/payslips/${p1.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'payee', paidAt: '2026-02-05' }),
  });
  check('passage a payee avec date', toPaid.status === 200 && toPaid.body.data.paidAt?.startsWith('2026-02-05'),
    JSON.stringify(toPaid.body));

  const draftDelete = await call(owner.token, '/payroll/payslips', {
    method: 'POST',
    body: JSON.stringify({ employeeId: belowSmigId, periodStart: '2026-03-01', periodEnd: '2026-03-31' }),
  });
  const delOk = await call(owner.token, `/payroll/payslips/${draftDelete.body.data.id}`, { method: 'DELETE' });
  check('brouillon supprimable', delOk.status === 204, `recu ${delOk.status}`);

  console.log('\n--- Listes et filtres ---');
  const byEmployee = await call(owner.token, `/payroll/payslips?employeeId=${empId}`);
  check('filtre fiches par employe', byEmployee.status === 200 && byEmployee.body.data.every((p) => p.employeeId === empId));
  const byStatus = await call(owner.token, '/payroll/payslips?status=payee');
  check('filtre fiches par statut', byStatus.status === 200 && byStatus.body.data.every((p) => p.status === 'payee'));

  console.log('\n--- Avance en attente non supprimable une fois deduite ---');
  const cannotDeleteUsedAdvance = await call(owner.token, `/payroll/advances/${advanceId}`, { method: 'DELETE' });
  check('avance deja deduite non annulable', cannotDeleteUsedAdvance.status === 409, JSON.stringify(cannotDeleteUsedAdvance.body));

  const advance2 = await call(owner.token, `/payroll/employees/${empId}/advances`, {
    method: 'POST', body: JSON.stringify({ amountMillimes: 20000, grantedAt: '2026-02-01' }),
  });
  const cancelPending = await call(owner.token, `/payroll/advances/${advance2.body.data.id}`, { method: 'DELETE' });
  check('avance en attente annulable', cancelPending.status === 204, `recu ${cancelPending.status}`);

  console.log('\n--- Desactivation employe ---');
  const deactivate = await call(owner.token, `/payroll/employees/${belowSmigId}`, { method: 'DELETE' });
  check('desactivation employe', deactivate.status === 204);
  const listAfterDeactivate = await call(owner.token, '/payroll/employees');
  check('employe desactive absent de la liste par defaut',
    !listAfterDeactivate.body.data.some((e) => e.id === belowSmigId));
  const listIncludingInactive = await call(owner.token, '/payroll/employees?includeInactive=true');
  check('employe desactive visible avec includeInactive',
    listIncludingInactive.body.data.some((e) => e.id === belowSmigId && e.isActive === false));

  console.log(`\n=== ${pass} reussis, ${fail} echecs ===`);
} catch (err) {
  console.error('ERREUR DE TEST', err);
  fail++;
} finally {
  server.close();
  await pool.end();
  process.exit(fail ? 1 : 0);
}
