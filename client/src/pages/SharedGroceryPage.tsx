import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';

const base = (token: string) => `/api/shared/${token}`;

const req = (url: string, init?: RequestInit) =>
  fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init }).then(r => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  });

export default function SharedGroceryPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [input, setInput] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['shared', token],
    queryFn: () => req(base(token!)),
    refetchInterval: 15000,
  });

  const addItem = useMutation({
    mutationFn: (name: string) => req(`${base(token!)}/items`, { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shared', token] }); setInput(''); },
  });

  const toggleItem = useMutation({
    mutationFn: ({ id, checked }: { id: number; checked: boolean }) =>
      req(`${base(token!)}/items/${id}`, { method: 'PATCH', body: JSON.stringify({ checked: checked ? 1 : 0 }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared', token] }),
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => req(`${base(token!)}/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared', token] }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) addItem.mutate(input.trim());
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );

  if (isError || !data) return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400 text-sm">
      List not found or sharing has been disabled.
    </div>
  );

  const unchecked = data.items.filter((i: any) => !i.checked);
  const checked = data.items.filter((i: any) => i.checked);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <ShoppingCart size={20} className="text-indigo-400" />
          <h1 className="text-xl font-semibold">{data.name}</h1>
        </div>

        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Add an item…"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || addItem.isPending}
            className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
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
            <p className="text-xs text-gray-600 mb-1">Checked off</p>
            <ul className="space-y-1">
              {checked.map((item: any) => (
                <GroceryItem key={item.id} item={item} onToggle={toggleItem.mutate} onDelete={deleteItem.mutate} />
              ))}
            </ul>
          </div>
        )}

        {data.items.length === 0 && (
          <p className="text-center text-sm text-gray-600 py-8">No items yet</p>
        )}
      </div>
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
