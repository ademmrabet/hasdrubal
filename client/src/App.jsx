import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_ROLES, useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';
import AdminLayout from '@/layouts/AdminLayout';
import StaffLayout from '@/layouts/StaffLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/admin/Dashboard';
import Ingredients from '@/pages/admin/Ingredients';
import Suppliers from '@/pages/admin/Suppliers';
import Movements from '@/pages/admin/Movements';
import Alerts from '@/pages/admin/Alerts';
import Users from '@/pages/admin/Users';
import Payroll from '@/pages/admin/Payroll';
import StaffToday from '@/pages/staff/Today';
import StaffStock from '@/pages/staff/StockOps';
import StaffCarte from '@/pages/staff/Carte';
import Menu from '@/pages/admin/menu/Menu';
import QrMenu from '@/pages/admin/menu/QrMenu';
import PublicMenu from '@/pages/public/PublicMenu';

/** Porte d'entree : redirige chaque role vers son interface. */
function Protected({ roles, children }) {
  const { user, status } = useAuth();

  if (status === 'loading') return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  if (status !== 'authenticated') return <Navigate to="/connexion" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ADMIN_ROLES.includes(user.role) ? '/admin' : '/service'} replace />;

  return children;
}

function Home() {
  const { user, status } = useAuth();
  if (status === 'loading') return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  if (status !== 'authenticated') return <Navigate to="/connexion" replace />;
  return <Navigate to={ADMIN_ROLES.includes(user.role) ? '/admin' : '/service'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />

      {/* Menu public du QR code : aucune connexion requise */}
      <Route path="/menu" element={<PublicMenu />} />

      {/* Interface Admin : proprietaire et responsable */}
      <Route path="/admin" element={<Protected roles={ADMIN_ROLES}><AdminLayout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="carte" element={<Menu />} />
        <Route path="carte/qr" element={<QrMenu />} />
        <Route path="ingredients" element={<Ingredients />} />
        <Route path="fournisseurs" element={<Suppliers />} />
        <Route path="mouvements" element={<Movements />} />
        <Route path="alertes" element={<Alerts />} />
        <Route path="utilisateurs" element={<Users />} />
        <Route path="paie" element={<Payroll />} />
      </Route>

      {/* Interface Staff : equipe de service */}
      <Route path="/service" element={<Protected><StaffLayout /></Protected>}>
        <Route index element={<StaffToday />} />
        <Route path="carte" element={<StaffCarte />} />
        <Route path="stock" element={<StaffStock />} />
      </Route>

      <Route path="/" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
