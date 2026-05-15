import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Trash2, ExternalLink } from 'lucide-react';
import { format, fromUnixTime } from 'date-fns';

const CARRIERS = [
  { id: 'usps',    label: 'USPS',         url: (n: string) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` },
  { id: 'ups',     label: 'UPS',          url: (n: string) => `https://www.ups.com/track?tracknum=${n}` },
  { id: 'fedex',   label: 'FedEx',        url: (n: string) => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { id: 'dhl',     label: 'DHL',          url: (n: string) => `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${n}` },
  { id: 'amazon',  label: 'Amazon',       url: (n: string) => `https://track.amazon.com/tracking/${n}` },
  { id: 'ontrac',  label: 'OnTrac',       url: (n: string) => `https://www.ontrac.com/trackres.asp?tracking_number=${n}` },
  { id: 'lasership', label: 'LaserShip',  url: (n: string) => `https://www.lasership.com/track/${n}` },
  { id: 'other',   label: 'Other',        url: () => '' },
];

const STATUS_LABELS: Record<string, string> = {
  pending:           'Pending',
  in_transit:        'In Transit',
  out_for_delivery:  'Out for Delivery',
  delivered:         'Delivered',
};

const STATUS_COLORS: Record<string, string> = {
  pending:           'bg-gray-700 text-gray-300',
  in_transit:        'bg-blue-900/40 text-blue-300',
  out_for_delivery:  'bg-yellow-900/40 text-yellow-300',
  delivered:         'bg-green-900/40 text-green-300',
};

interface Package {
  id: number;
  tracking_number: string;
  carrier: string;
  label: string;
  status: string;
  expected_delivery: number | null;
  delivered_at: number | null;
  created_at: number;
}

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/packages${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });

export default function PackagesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tracking_number: '', carrier: 'usps', label: '', expected_delivery: '' });

  const { data: packages = [], isLoading } = useQuery<Package[]>({
    queryKey: ['packages'],
    queryFn: () => api('').then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('', { method: 'POST', body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packages'] }); setShowForm(false); setForm({ tracking_number: '', carrier: 'usps', label: '', expected_delivery: '' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      api(`/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tracking_number.trim() || !form.label.trim()) return;
    addMutation.mutate({
      tracking_number: form.tracking_number.trim(),
      carrier: form.carrier,
      label: form.label.trim(),
      expected_delivery: form.expected_delivery ? Math.floor(new Date(form.expected_delivery).getTime() / 1000) : undefined,
    });
  };

  const getTrackingUrl = (pkg: Package) => {
    const carrier = CARRIERS.find(c => c.id === pkg.carrier);
    return carrier ? carrier.url(pkg.tracking_number) : '';
  };

  const active = packages.filter(p => p.status !== 'delivered');
  const delivered = packages.filter(p => p.status === 'delivered');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-brand-400" />
          <h1 className="text-xl font-semibold text-white">Packages</h1>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <Plus size={14} /> Add Package
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Label / Description</label>
              <input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Amazon order, Birthday gift"
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Carrier</label>
              <select
                value={form.carrier}
                onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                {CARRIERS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tracking Number</label>
              <input
                value={form.tracking_number}
                onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))}
                placeholder="Enter tracking number"
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Expected Delivery (optional)</label>
              <input
                type="date"
                value={form.expected_delivery}
                onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))}
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={addMutation.isPending} className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50">
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {active.length === 0 && delivered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Package size={36} className="mb-3 opacity-30" />
              <p className="text-sm">No packages yet. Add one to start tracking.</p>
            </div>
          )}

          {active.length > 0 && (
            <div className="space-y-2 mb-6">
              {active.map(pkg => (
                <PackageRow
                  key={pkg.id}
                  pkg={pkg}
                  trackingUrl={getTrackingUrl(pkg)}
                  onStatusChange={(status) => updateMutation.mutate({ id: pkg.id, status })}
                  onDelete={() => deleteMutation.mutate(pkg.id)}
                />
              ))}
            </div>
          )}

          {delivered.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-400 mb-2 select-none">
                Delivered ({delivered.length})
              </summary>
              <div className="space-y-2 mt-2">
                {delivered.map(pkg => (
                  <PackageRow
                    key={pkg.id}
                    pkg={pkg}
                    trackingUrl={getTrackingUrl(pkg)}
                    onStatusChange={(status) => updateMutation.mutate({ id: pkg.id, status })}
                    onDelete={() => deleteMutation.mutate(pkg.id)}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function PackageRow({ pkg, trackingUrl, onStatusChange, onDelete }: {
  pkg: Package;
  trackingUrl: string;
  onStatusChange: (s: string) => void;
  onDelete: () => void;
}) {
  const carrierLabel = CARRIERS.find(c => c.id === pkg.carrier)?.label ?? pkg.carrier;

  return (
    <div className={`rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 flex items-center gap-3 ${pkg.status === 'delivered' ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-white truncate">{pkg.label}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[pkg.status] ?? STATUS_COLORS.pending}`}>
            {STATUS_LABELS[pkg.status] ?? pkg.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{carrierLabel}</span>
          <span className="font-mono">{pkg.tracking_number}</span>
          {pkg.expected_delivery && pkg.status !== 'delivered' && (
            <span>Expected {format(fromUnixTime(pkg.expected_delivery), 'MMM d')}</span>
          )}
          {pkg.delivered_at && (
            <span>Delivered {format(fromUnixTime(pkg.delivered_at), 'MMM d')}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {trackingUrl && (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
            title="Track on carrier site"
          >
            <ExternalLink size={14} />
          </a>
        )}

        <select
          value={pkg.status}
          onChange={e => onStatusChange(e.target.value)}
          className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-300 focus:border-brand-500 focus:outline-none"
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <button
          onClick={onDelete}
          className="rounded p-1.5 text-gray-600 hover:text-red-400 hover:bg-gray-700 transition-colors"
          title="Remove package"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
