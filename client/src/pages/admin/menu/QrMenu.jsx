import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Download, ExternalLink, Printer } from 'lucide-react';
import { useSaveSetting, useSetting } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/lib/auth';
import { RESTAURANT } from '@/lib/restaurant';
import { Logo } from '@/components/Logo';
import { Button, Card, ErrorNote, Field, Input, PageHeader, Spinner } from '@/components/ui';

// Couleurs du QR : encre brune sur creme. Contraste largement suffisant pour tous les lecteurs.
const QR_COLORS = { dark: '#3a2a1c', light: '#fffcf6' };

const defaultUrl = () => `${window.location.origin}/menu`;

function download(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

export default function QrMenu() {
  const { isOwner } = useAuth();
  const { data, isLoading } = useSetting('qr_menu');
  const save = useSaveSetting('qr_menu');
  const [draft, setDraft] = useState('');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const url = data?.data?.baseUrl || defaultUrl();
  const isLocal = /localhost|127\.0\.0\.1|192\.168\./.test(url);

  useEffect(() => { setDraft(data?.data?.baseUrl ?? ''); }, [data]);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: 'M', color: QR_COLORS })
      .then(setQr)
      .catch(() => setQr(''));
  }, [url]);

  const saveUrl = async (event) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    try {
      const value = draft.trim();
      if (value) new URL(value);           // leve une erreur si l'adresse est invalide
      await save.mutateAsync({ baseUrl: value || null });
      setSaved(true);
    } catch (err) {
      setError(err instanceof TypeError ? 'Adresse invalide : elle doit commencer par https://' : errorMessage(err));
    }
  };

  const downloadPng = async () => {
    const png = await QRCode.toDataURL(url, { width: 1600, margin: 2, errorCorrectionLevel: 'M', color: QR_COLORS });
    download(png, 'hasdrubal-menu-qr.png');
  };

  const downloadSvg = async () => {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: QR_COLORS });
    download(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), 'hasdrubal-menu-qr.svg');
  };

  if (isLoading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Menu QR"
        subtitle="Le code à poser sur les tables : il ouvre la carte à jour, sans application"
        actions={
          <>
            <Link to="/admin/carte"><Button variant="ghost"><ArrowLeft size={15} /> La carte</Button></Link>
            <a href={url} target="_blank" rel="noreferrer">
              <Button variant="secondary"><ExternalLink size={15} /> Ouvrir le menu</Button>
            </a>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <h2 className="text-sm mb-3">Adresse du menu</h2>
            <p className="mb-3 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-sm break-all">
              {url}
            </p>
            {isLocal && (
              <p className="mb-3 rounded-[var(--radius-control)] bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
                Cette adresse n'est joignable que sur ce réseau : le téléphone d'un client ne pourra pas l'ouvrir.
                Une fois l'application en ligne, renseignez son adresse publique ci-dessous avant d'imprimer.
              </p>
            )}
            {isOwner ? (
              <form onSubmit={saveUrl} className="space-y-3">
                <Field label="Adresse publique" hint="Laisser vide pour utiliser l'adresse actuelle de l'application">
                  <Input
                    type="url"
                    placeholder="https://menu.hasdrubal.tn"
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
                  />
                </Field>
                <ErrorNote message={error} />
                <div className="flex items-center gap-3">
                  <Button type="submit" loading={save.isPending}>Enregistrer</Button>
                  {saved && <span className="text-sm text-[var(--color-ok)]">Adresse enregistrée</span>}
                </div>
              </form>
            ) : (
              <p className="text-xs text-[var(--color-ink-faint)]">Seul le propriétaire peut changer cette adresse.</p>
            )}
          </Card>

          <Card>
            <h2 className="text-sm mb-1">Télécharger</h2>
            <p className="text-xs text-[var(--color-ink-soft)] mb-3">
              PNG pour un usage courant, SVG pour l'imprimeur : il reste net à toutes les tailles.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={downloadPng}><Download size={15} /> PNG haute définition</Button>
              <Button variant="secondary" onClick={downloadSvg}><Download size={15} /> SVG vectoriel</Button>
              <Button onClick={() => window.print()}><Printer size={15} /> Imprimer le chevalet</Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm mb-2">Bon à savoir</h2>
            <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
              Le QR code contient seulement l'adresse du menu, pas son contenu. Changer un prix, ajouter un plat
              ou couper un plat en rupture se voit immédiatement sur les téléphones des clients, sans réimprimer.
              Il ne faut réimprimer que si l'adresse du menu change.
            </p>
          </Card>
        </div>

        {/* Chevalet de table : seule zone imprimee */}
        <div className="print-area">
          <div className="card mx-auto w-full max-w-[340px] overflow-hidden p-0 text-center">
            <div className="bg-[var(--color-hero)] px-6 pb-5 pt-7">
              <Logo width={200} className="mx-auto" />
            </div>
            <div className="px-6 pb-7 pt-5">
              <p className="display text-lg text-[var(--color-brand)]">Notre carte</p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Scannez avec l'appareil photo de votre téléphone</p>
              {qr
                ? <img src={qr} alt={`QR code vers ${url}`} className="mx-auto my-4 w-56" />
                : <div className="my-4"><Spinner label="Génération..." /></div>}
              <div className="rule-brand my-3" />
              <p className="text-[0.7rem] text-[var(--color-ink-faint)]">
                {RESTAURANT.address} · {RESTAURANT.phone}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
