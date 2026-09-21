import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/api/client';
import { RESTAURANT } from '@/lib/restaurant';
import { enterPanel, shake, gsap } from '@/lib/animations';
import { Logo } from '@/components/Logo';
import { Button, ErrorNote, Field, Input, Spinner } from '@/components/ui';

export default function Login() {
  const { login, status } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  const archRef = useRef(null);

  useEffect(() => {
    const cleanup = enterPanel(cardRef.current, { from: 'bottom' });
    // L'arche punique se devoile lentement derriere la carte.
    const tween = archRef.current
      ? gsap.fromTo(archRef.current, { opacity: 0, scaleY: 0.85 },
          { opacity: 1, scaleY: 1, duration: 1.1, ease: 'power2.out', transformOrigin: 'bottom center' })
      : null;
    return () => { cleanup(); tween?.kill(); };
  }, []);

  if (status === 'loading') return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form);
    } catch (err) {
      setError(errorMessage(err, 'Connexion impossible'));
      shake(cardRef.current);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen grid place-items-center overflow-hidden p-4">
      {/* Decor : arche de la salle, en tres discret */}
      <div
        ref={archRef}
        aria-hidden
        className="arch pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[520px] h-[420px] opacity-0"
      />

      <div ref={cardRef} className="relative card w-full max-w-sm p-7">
        <div className="mb-7 text-center">
          <Logo width={220} className="mx-auto" />
          <div className="rule-brand my-4" />
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
            Système de gestion
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Adresse email">
            <Input
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="vous@hasdrubal.tn"
            />
          </Field>

          <Field label="Mot de passe">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </Field>

          <ErrorNote message={error} />

          <Button type="submit" loading={busy} className="w-full">Se connecter</Button>
        </form>

        <p className="mt-6 text-center text-[0.7rem] text-[var(--color-ink-faint)]">
          {RESTAURANT.address} · {RESTAURANT.phone}
        </p>
      </div>
    </div>
  );
}
