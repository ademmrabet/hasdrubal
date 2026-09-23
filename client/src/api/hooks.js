import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

const get = (url, params) => api.get(url, { params }).then((r) => r.data);

/** Invalide tout ce qui depend de l'etat du stock apres une operation. */
function useStockInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['ingredients'] });
    qc.invalidateQueries({ queryKey: ['stock'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

// --- Lectures ---------------------------------------------------------
export const useIngredients = (filters = {}) =>
  useQuery({ queryKey: ['ingredients', filters], queryFn: () => get('/ingredients', filters) });

export const useIngredient = (id) =>
  useQuery({ queryKey: ['ingredients', 'detail', id], queryFn: () => get(`/ingredients/${id}`), enabled: !!id });

export const useCategories = () =>
  useQuery({ queryKey: ['ingredients', 'categories'], queryFn: () => get('/ingredients/categories') });

export const useSuppliers = (filters = {}) =>
  useQuery({ queryKey: ['suppliers', filters], queryFn: () => get('/suppliers', filters) });

export const useMovements = (filters = {}) =>
  useQuery({ queryKey: ['stock', 'movements', filters], queryFn: () => get('/stock/movements', filters) });

export const useAlerts = () =>
  useQuery({ queryKey: ['stock', 'alerts'], queryFn: () => get('/stock/alerts') });

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard', 'summary'], queryFn: () => get('/dashboard/summary') });

export const useStaffToday = () =>
  useQuery({ queryKey: ['dashboard', 'staff-today'], queryFn: () => get('/dashboard/staff-today'), refetchInterval: 60_000 });

export const useUsers = () =>
  useQuery({ queryKey: ['users'], queryFn: () => get('/users') });

// --- Ecritures --------------------------------------------------------
export function useSaveIngredient() {
  const invalidate = useStockInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      (id ? api.put(`/ingredients/${id}`, body) : api.post('/ingredients', body)).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeleteIngredients() {
  const invalidate = useStockInvalidation();
  return useMutation({
    mutationFn: (ids) => api.delete('/ingredients', { data: { ids } }).then((r) => r.data),
    onSuccess: invalidate,
  });
}

// Correction manuelle du cout moyen (hors reception) : impacte le cout des
// fiches techniques et donc les marges affichees sur la carte.
export function useUpdateIngredientCost() {
  const invalidate = useStockInvalidation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/ingredients/${id}/cost`, body).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}

export function useSaveSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      (id ? api.put(`/suppliers/${id}`, body) : api.post('/suppliers', body)).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useReceiveStock() {
  const invalidate = useStockInvalidation();
  return useMutation({
    mutationFn: (body) => api.post('/stock/receive', body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useConsumeStock() {
  const invalidate = useStockInvalidation();
  return useMutation({
    mutationFn: (body) => api.post('/stock/consume', body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useInventoryCount() {
  const invalidate = useStockInvalidation();
  return useMutation({
    mutationFn: (body) => api.post('/stock/inventory', body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      (id ? api.patch(`/users/${id}`, body) : api.post('/users', body)).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// =====================================================================
// Menu (phase 2)
// =====================================================================
function useMenuInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['menu'] });
    qc.invalidateQueries({ queryKey: ['public-menu'] });
  };
}

export const useMenuReference = () =>
  useQuery({ queryKey: ['menu', 'reference'], queryFn: () => get('/menu/reference'), staleTime: Infinity });

export const useMenuCategories = () =>
  useQuery({ queryKey: ['menu', 'categories'], queryFn: () => get('/menu/categories') });

export const useMenuItems = (filters = {}) =>
  useQuery({ queryKey: ['menu', 'items', filters], queryFn: () => get('/menu/items', filters) });

export const useMenuItem = (id) =>
  useQuery({ queryKey: ['menu', 'item', id], queryFn: () => get(`/menu/items/${id}`), enabled: !!id });

export function useSaveMenuItem() {
  const invalidate = useMenuInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      (id ? api.put(`/menu/items/${id}`, body) : api.post('/menu/items', body)).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useRemoveMenuItem() {
  const invalidate = useMenuInvalidation();
  return useMutation({ mutationFn: (id) => api.delete(`/menu/items/${id}`), onSuccess: invalidate });
}

export function useSaveMenuCategory() {
  const invalidate = useMenuInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      (id ? api.put(`/menu/categories/${id}`, body) : api.post('/menu/categories', body)).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeleteMenuCategory() {
  const invalidate = useMenuInvalidation();
  return useMutation({ mutationFn: (id) => api.delete(`/menu/categories/${id}`), onSuccess: invalidate });
}

/** Coupe ou remet un plat en service, avec mise a jour optimiste. */
export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isAvailable }) =>
      api.patch(`/menu/items/${id}/availability`, { isAvailable }).then((r) => r.data),
    onMutate: async ({ id, isAvailable }) => {
      await qc.cancelQueries({ queryKey: ['menu', 'items'] });
      const snapshots = qc.getQueriesData({ queryKey: ['menu', 'items'] });
      qc.setQueriesData({ queryKey: ['menu', 'items'] }, (old) =>
        old ? { ...old, data: old.data.map((i) => (i.id === id ? { ...i, isAvailable } : i)) } : old);
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => ctx?.snapshots.forEach(([key, value]) => qc.setQueryData(key, value)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      qc.invalidateQueries({ queryKey: ['public-menu'] });
    },
  });
}

export function useUploadMenuImage() {
  const invalidate = useMenuInvalidation();
  return useMutation({
    mutationFn: ({ id, file }) => {
      const form = new FormData();
      form.append('image', file);
      return api.post(`/menu/items/${id}/image`, form).then((r) => r.data);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteMenuImage() {
  const invalidate = useMenuInvalidation();
  return useMutation({ mutationFn: (id) => api.delete(`/menu/items/${id}/image`), onSuccess: invalidate });
}

export const usePublicMenu = () =>
  useQuery({ queryKey: ['public-menu'], queryFn: () => get('/public/menu'), staleTime: 60_000 });

// --- Parametres -------------------------------------------------------
export const useSetting = (key) =>
  useQuery({ queryKey: ['settings', key], queryFn: () => get(`/settings/${key}`) });

export function useSaveSetting(key) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.put(`/settings/${key}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', key] }),
  });
}

// =====================================================================
// Paie (proprietaire uniquement) — les taux CNSS/TFP/FOPROLOS/SMIG
// passent par les hooks de parametres generiques ci-dessus (cle 'payroll').
// =====================================================================
function usePayrollInvalidation() {
  const qc = useQueryClient();
  // Une seule invalidation large : une avance consommee par une fiche de
  // paie, par exemple, doit rafraichir a la fois la liste des employes
  // (avances en attente) et celle des fiches.
  return () => qc.invalidateQueries({ queryKey: ['payroll'] });
}

export const useEmployees = (filters = {}) =>
  useQuery({ queryKey: ['payroll', 'employees', filters], queryFn: () => get('/payroll/employees', filters) });

export const useEmployee = (id) =>
  useQuery({
    queryKey: ['payroll', 'employees', 'detail', id],
    queryFn: () => get(`/payroll/employees/${id}`),
    enabled: !!id,
  });

export function useSaveEmployee() {
  const invalidate = usePayrollInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      (id ? api.put(`/payroll/employees/${id}`, body) : api.post('/payroll/employees', body)).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeactivateEmployee() {
  const invalidate = usePayrollInvalidation();
  return useMutation({ mutationFn: (id) => api.delete(`/payroll/employees/${id}`), onSuccess: invalidate });
}

export function useAddSalaryChange() {
  const invalidate = usePayrollInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.post(`/payroll/employees/${id}/salary`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useAddAdvance() {
  const invalidate = usePayrollInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.post(`/payroll/employees/${id}/advances`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeleteAdvance() {
  const invalidate = usePayrollInvalidation();
  return useMutation({
    mutationFn: (advanceId) => api.delete(`/payroll/advances/${advanceId}`),
    onSuccess: invalidate,
  });
}

export const usePayslips = (filters = {}) =>
  useQuery({ queryKey: ['payroll', 'payslips', filters], queryFn: () => get('/payroll/payslips', filters) });

export const usePayslip = (id) =>
  useQuery({
    queryKey: ['payroll', 'payslips', 'detail', id],
    queryFn: () => get(`/payroll/payslips/${id}`),
    enabled: !!id,
  });

export function useCreatePayslip() {
  const invalidate = usePayrollInvalidation();
  return useMutation({
    mutationFn: (body) => api.post('/payroll/payslips', body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useSetPayslipStatus() {
  const invalidate = usePayrollInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/payroll/payslips/${id}/status`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeletePayslip() {
  const invalidate = usePayrollInvalidation();
  return useMutation({ mutationFn: (id) => api.delete(`/payroll/payslips/${id}`), onSuccess: invalidate });
}
