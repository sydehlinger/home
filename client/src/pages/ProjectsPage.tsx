import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, ExternalLink, Trash2, StickyNote, X, ChevronDown } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10',
  paused: 'text-yellow-400 bg-yellow-400/10',
  done: 'text-gray-400 bg-gray-400/10',
};

const PROJECT_COLORS = ['#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#a855f7'];

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [form, setForm] = useState({ name: '', description: '', url: '', status: 'active', color: '#6366f1' });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects'),
  });

  const createProject = useMutation({
    mutationFn: (body: typeof form) => api.post('/projects', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowForm(false); setForm({ name: '', description: '', url: '', status: 'active', color: '#6366f1' }); },
  });

  const deleteProject = useMutation({
    mutationFn: (id: number) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/projects/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const { data: notes = [] } = useQuery<any[]>({
    queryKey: ['notes', expandedId],
    queryFn: () => api.get(`/projects/${expandedId}/notes`),
    enabled: !!expandedId,
  });

  const addNote = useMutation({
    mutationFn: (content: string) => api.post(`/projects/${expandedId}/notes`, { content }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes', expandedId] }); setNewNote(''); },
  });

  const deleteNote = useMutation({
    mutationFn: ({ projectId, noteId }: { projectId: number; noteId: number }) =>
      api.delete(`/projects/${projectId}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', expandedId] }),
  });

  const grouped = {
    active: (projects as any[]).filter((p) => p.status === 'active'),
    paused: (projects as any[]).filter((p) => p.status === 'paused'),
    done: (projects as any[]).filter((p) => p.status === 'done'),
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Projects</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus size={15} /> New project
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-200">New project</h3>
            <button onClick={() => setShowForm(false)}><X size={15} className="text-gray-500" /></button>
          </div>
          <input className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500" placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500" placeholder="URL (optional)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Color:</span>
            <div className="flex gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })} className={`h-5 w-5 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <button disabled={!form.name} onClick={() => createProject.mutate(form)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            Create
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([status, items]) =>
        items.length === 0 ? null : (
          <div key={status}>
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2 capitalize">{status}</h2>
            <ul className="space-y-2">
              {items.map((p: any) => (
                <li key={p.id} className="rounded-xl border border-gray-800 bg-gray-900">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-100">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-500 truncate">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="relative">
                        <select
                          value={p.status}
                          onChange={(e) => updateStatus.mutate({ id: p.id, status: e.target.value })}
                          className={`appearance-none rounded-md px-2 py-0.5 text-xs font-medium pr-5 focus:outline-none ${STATUS_COLORS[p.status] ?? ''} bg-transparent border-0 cursor-pointer`}
                        >
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="done">Done</option>
                        </select>
                        <ChevronDown size={10} className="absolute right-0.5 top-1 pointer-events-none text-current opacity-60" />
                      </div>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-brand-400">
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className={`text-gray-500 hover:text-gray-300 ${expandedId === p.id ? 'text-brand-400' : ''}`}>
                        <StickyNote size={14} />
                      </button>
                      <button onClick={() => deleteProject.mutate(p.id)} className="text-gray-600 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {expandedId === p.id && (
                    <div className="border-t border-gray-800 px-4 py-3 space-y-2">
                      <p className="text-xs text-gray-500 font-medium">Notes</p>
                      {(notes as any[]).map((n: any) => (
                        <div key={n.id} className="flex items-start gap-2 group">
                          <p className="flex-1 text-xs text-gray-300">{n.content}</p>
                          <button onClick={() => deleteNote.mutate({ projectId: p.id, noteId: n.id })} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 flex-shrink-0">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      <form onSubmit={(e) => { e.preventDefault(); if (newNote.trim()) addNote.mutate(newNote.trim()); }} className="flex gap-2 mt-1">
                        <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note…" className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500" />
                        <button type="submit" disabled={!newNote.trim()} className="rounded-lg bg-brand-500 px-2 py-1 text-xs text-white hover:bg-brand-600 disabled:opacity-50">Add</button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {projects.length === 0 && !showForm && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-gray-500">No projects yet — create one to get started</p>
        </div>
      )}
    </div>
  );
}
