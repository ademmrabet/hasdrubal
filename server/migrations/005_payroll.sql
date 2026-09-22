-- =====================================================================
-- 005 — Personnel et paie : employes, historique de salaire, avances,
--        fiches de paie (CNSS, TFP, FOPROLOS)
--
-- Hypotheses de calcul (a confirmer avec un comptable, taux modifiables
-- sans migration via la table settings, cle 'payroll') :
--   - CNSS salarie et CNSS employeur sont calcules sur le brut de la paie
--     (base + heures supp. + primes), sans plafond — le regime general
--     tunisien n'a pas de plafond de cotisation (contrairement a un
--     regime complementaire facultatif, hors perimetre ici).
--   - TFP et FOPROLOS sont des charges PATRONALES uniquement (jamais
--     retenues sur le salarie), leur taux exact depend du secteur.
--   - L'IRPP (impot sur le revenu, retenue a la source) n'est PAS calcule
--     automatiquement : le bareme progressif, les abattements familiaux
--     et les frais professionnels changent trop souvent pour etre encodes
--     sans verification. Le montant est saisi a la main sur la fiche,
--     en attendant une phase dediee une fois le bareme 2026 confirme.
--   - Les heures supplementaires sont tracees (nombre d'heures) mais leur
--     majoration n'est pas calculee automatiquement — le taux exact selon
--     le regime horaire n'a pas ete confirme a partir d'une source fiable.
--     Le montant reste une saisie manuelle, informee par les heures.
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE contract_type AS ENUM ('cdi', 'cdd', 'stage', 'autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payslip_status AS ENUM ('brouillon', 'validee', 'payee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE employees (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name            text NOT NULL,
  cin                  text,                      -- carte d'identite nationale
  cnss_number          text,                       -- matricule CNSS (immatriculation salarie)
  phone                text,
  birth_date           date,
  position             text,                       -- poste : cuisinier, serveur, plongeur...
  contract_type        contract_type NOT NULL DEFAULT 'cdi',
  contract_end_date    date,                       -- pour un CDD
  weekly_hours_regime  integer NOT NULL DEFAULT 48 CHECK (weekly_hours_regime IN (40, 48)),
  hire_date            date NOT NULL DEFAULT CURRENT_DATE,
  termination_date     date,
  user_id              uuid REFERENCES users(id) ON DELETE SET NULL,  -- compte de connexion lie, optionnel
  is_active            boolean NOT NULL DEFAULT true,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (contract_type <> 'cdd' OR contract_end_date IS NOT NULL)
);
CREATE INDEX employees_active_idx ON employees (is_active, full_name);
CREATE TRIGGER employees_set_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Historique de salaire : append-only, pour qu'une augmentation ne
-- reecrive jamais le salaire applique aux fiches de paie deja emises.
CREATE TABLE salary_history (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id            uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  base_salary_millimes   bigint NOT NULL CHECK (base_salary_millimes >= 0),
  effective_from         date NOT NULL DEFAULT CURRENT_DATE,
  reason                 text,                     -- 'embauche', 'augmentation', 'ajustement SMIG'...
  created_by             uuid REFERENCES users(id),
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX salary_history_employee_idx ON salary_history (employee_id, effective_from DESC);

CREATE TABLE payslips (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  period_start                date NOT NULL,        -- 1er du mois couvert
  period_end                  date NOT NULL,        -- dernier jour du mois couvert
  contract_type               contract_type NOT NULL,   -- fige au moment de l'emission
  weekly_hours_regime         integer NOT NULL,         -- fige : sert a comparer au SMIG applicable
  base_salary_millimes        bigint NOT NULL CHECK (base_salary_millimes >= 0),
  hours_worked                numeric(6,2),
  overtime_hours              numeric(6,2) NOT NULL DEFAULT 0,
  overtime_amount_millimes    bigint NOT NULL DEFAULT 0 CHECK (overtime_amount_millimes >= 0),
  bonus_millimes              bigint NOT NULL DEFAULT 0 CHECK (bonus_millimes >= 0),
  bonus_note                  text,
  gross_millimes               bigint NOT NULL CHECK (gross_millimes >= 0),
  cnss_employee_rate_pct       numeric(5,2) NOT NULL,
  cnss_employee_millimes       bigint NOT NULL CHECK (cnss_employee_millimes >= 0),
  cnss_employer_rate_pct       numeric(5,2) NOT NULL,
  cnss_employer_millimes       bigint NOT NULL CHECK (cnss_employer_millimes >= 0),
  tfp_rate_pct                 numeric(5,2) NOT NULL DEFAULT 0,
  tfp_millimes                 bigint NOT NULL DEFAULT 0 CHECK (tfp_millimes >= 0),
  foprolos_rate_pct            numeric(5,2) NOT NULL DEFAULT 0,
  foprolos_millimes            bigint NOT NULL DEFAULT 0 CHECK (foprolos_millimes >= 0),
  irpp_millimes                bigint NOT NULL DEFAULT 0 CHECK (irpp_millimes >= 0),  -- saisie manuelle (voir note en tete de fichier)
  other_deductions_millimes    bigint NOT NULL DEFAULT 0 CHECK (other_deductions_millimes >= 0),
  other_deductions_note        text,
  advances_millimes            bigint NOT NULL DEFAULT 0 CHECK (advances_millimes >= 0),
  net_millimes                  bigint NOT NULL,      -- peut etre negatif si avances > net (alerte a l'ecran)
  employer_cost_millimes        bigint NOT NULL CHECK (employer_cost_millimes >= 0),
  below_smig                    boolean NOT NULL DEFAULT false,  -- alerte figee au moment de l'emission
  status                        payslip_status NOT NULL DEFAULT 'brouillon',
  paid_at                       date,
  notes                         text,
  created_by                    uuid REFERENCES users(id),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payslips_employee_period_key ON payslips (employee_id, period_start);
CREATE INDEX payslips_period_idx ON payslips (period_start DESC);
CREATE TRIGGER payslips_set_updated_at BEFORE UPDATE ON payslips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Avances sur salaire : append-only. payslip_id reste NULL tant que
-- l'avance n'a pas ete deduite d'une fiche de paie.
CREATE TABLE salary_advances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount_millimes   bigint NOT NULL CHECK (amount_millimes > 0),
  granted_at        date NOT NULL DEFAULT CURRENT_DATE,
  reason            text,
  payslip_id        uuid REFERENCES payslips(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX salary_advances_employee_idx ON salary_advances (employee_id, granted_at DESC);
CREATE INDEX salary_advances_pending_idx ON salary_advances (employee_id) WHERE payslip_id IS NULL;

-- Taux de paie par defaut (voir la note en tete de fichier). Modifiables
-- depuis l'application (Personnel > Parametres de paie, proprietaire
-- uniquement) sans redeploiement : GET/PUT /api/settings/payroll.
INSERT INTO settings (key, value) VALUES (
  'payroll',
  '{
     "cnssEmployeeRatePct": 9.68,
     "cnssEmployerRatePct": 17.07,
     "tfpRatePct": 1,
     "foprolosRatePct": 1,
     "smig48hMillimes": 554736,
     "smig40hMillimes": 470251
   }'::jsonb
)
ON CONFLICT (key) DO UPDATE
  SET value = settings.value || EXCLUDED.value, updated_at = now();
