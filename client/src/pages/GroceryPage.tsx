import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ShoppingCart, Plus, Trash2, Share2, X, Copy, Check, Unlink } from 'lucide-react';

export default function GroceryPage() {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['grocery'],
    queryFn: () => api.get('/grocery'),
  });

  const addItem = useMutation({
    mutationFn: (name: string) => api.post('/grocery/items', { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grocery'] }); setInput(''); },
  });

  const toggleItem = useMutation({
    mutationFn: ({ id, checked }: { id: number; checked: boolean }) =>
      api.patch(`/grocery/items/${id}`, { checked: checked ? 1 : 0 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grocery'] }),
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`/grocery/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grocery'] }),
  });

  const clearChecked = useMutation({
    mutationFn: () => api.delete('/grocery/items/checked'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grocery'] }),
  });

  const generateShare = useMutation({
    mutationFn: () => api.post<{ share_token: string }>('/grocery/share', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grocery'] }),
  });

  const revokeShare = useMutation({
    mutationFn: () => api.delete('/grocery/share'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grocery'] }); setShowShare(false); },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) addItem.mutate(input.trim());
  };

  const shareUrl = data?.share_token
    ? `${window.location.origin}/shared/${data.share_token}`
    : null;

  const copyUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );

  const unchecked = (data?.items ?? []).filter((i: any) => !i.checked);
  const checked = (data?.items ?? []).filter((i: any) => i.checked);

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} className="text-brand-400" />
          <h1 className="text-xl font-semibold text-white">{data?.name ?? 'Grocery List'}</h1>
        </div>
        <button
          onClick={() => setShowShare(v => !v)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            showShare ? 'bg-gray-700 text-gray-200' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          }`}
        >
          <Share2 size={14} /> Share
        </button>
      </div>

      {showShare && (
        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-200">Share link</p>
            <button onClick={() => setShowShare(false)} className="text-gray-500 hover:text-gray-300">
              <X size={14} />
            </button>
          </div>
          {shareUrl ? (
            <>
              <div className="flex gap-2 mb-3">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-xs text-gray-300 focus:outline-none"
                />
                <button
                  onClick={copyUrl}
                  className="flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
                >
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Anyone with this link can view and edit your list.</p>
              <button
                onClick={() => revokeShare.mutate()}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                <Unlink size={12} /> Revoke link
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Generate a link so others can view and add to your grocery list without needing an account.
              </p>
              <button
                onClick={() => generateShare.mutate()}
                disabled={generateShare.isPending}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {generateShare.isPending ? 'Generating…' : 'Generate link'}
              </button>
            </>
          )}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add an item…"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || addItem.isPending}
          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          <Plus size={16} />
        </button>
      </form>

      <ul className="space-y-1">
        {unchecked.map((item: any) => (
          <GroceryItem key={item.id} item={item} onToggle={toggleItem.mutate} onDelete={deleteItem.mutate} />
        ))}
      </ul>

      {checked.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-600">Checked off ({checked.length})</p>
            <button
              onClick={() => clearChecked.mutate()}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          </div>
          <ul className="space-y-1">
            {checked.map((item: any) => (
              <GroceryItem key={item.id} item={item} onToggle={toggleItem.mutate} onDelete={deleteItem.mutate} />
            ))}
          </ul>
        </div>
      )}

      {data?.items?.length === 0 && (
        <p className="text-center text-sm text-gray-600 py-8">No items yet — add something above</p>
      )}
    </div>
  );
}

function GroceryItem({ item, onToggle, onDelete }: {
  item: any;
  onToggle: (args: { id: number; checked: boolean }) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-800/50 group transition-colors">
      <input
        type="checkbox"
        checked={!!item.checked}
        onChange={e => onToggle({ id: item.id, checked: e.target.checked })}
        className="h-4 w-4 rounded border-gray-600 bg-gray-700 accent-indigo-500 cursor-pointer"
      />
      <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-600' : 'text-gray-200'}`}>
        {item.name}
      </span>
      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-colors"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}
