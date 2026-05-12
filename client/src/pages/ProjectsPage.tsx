import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, ExternalLink, Trash2, StickyNote, X, ChevronDown, Link as LinkIcon, FileText, Pencil } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10',
  paused: 'text-yellow-400 bg-yellow-400/10',
  done: 'text-gray-400 bg-gray-400/10',
};

const PROJECT_COLORS = ['#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#a855f7'];

type Workspace = { id: number; name: string; color: string };
type Resource = { id: number; type: 'link' | 'note'; title: string; url: string | null; content: string | null };

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [activeWs, setActiveWs] = useState<number | null>(null); // null = "All"
  const [showForm, setShowForm] = useState(false);
  const [showWsForm, setShowWsForm] = useState(false);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [form, setForm] = useState({ name: '', description: '', url: '', status: 'active', color: '#6366f1' });
  const [wsForm, setWsForm] = useState({ name: '', color: '#6366f1' });
  const [resForm, setResForm] = useState<{ type: 'link' | 'note'; title: string; url: string; content: string }>(
    { type: 'link', title: '', url: '', content: '' }
  );

  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: () => api.get('/workspaces'),
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects'),
  });

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ['workspace-resources', activeWs],
    queryFn: () => api.get(`/workspaces/${activeWs}/resources`),
    enabled: activeWs !== null,
  });

  const createWorkspace = useMutation({
    mutationFn: (body: typeof wsForm) => api.post<Workspace>('/workspaces', body),
    onSuccess: (ws) => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      setShowWsForm(false);
      setWsForm({ name: '', color: '#6366f1' });
      setActiveWs(ws.id);
    },
  });

  const updateWorkspace = useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; color?: string }) =>
      api.patch(`/workspaces/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workspaces'] }); setEditingWs(null); },
  });

  const deleteWorkspace = useMutation({
    mutationFn: (id: number) => api.delete(`/workspaces/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setActiveWs(null);
      setEditingWs(null);
    },
  });

  const createProject = useMutation({
    mutationFn: (body: typeof form & { workspace_id: number | null }) => api.post('/projects', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowForm(false);
      setForm({ name: '', description: '', url: '', status: 'active', color: '#6366f1' });
    },
  });

  const deleteProject = useMutation({
    mutationFn: (id: number) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const updateProject = useMutation({
    mutationFn: ({ id, ...body }: { id: number; status?: string; workspace_id?: number | null }) =>
      api.patch(`/projects/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const createResource = useMutation({
    mutationFn: (body: { type: 'link' | 'note'; title: string; url?: string; content?: string }) =>
      api.post(`/workspaces/${activeWs}/resources`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-resources', activeWs] });
      setShowResourceForm(false);
      setResForm({ type: 'link', title: '', url: '', content: '' });
    },
  });

  const deleteResource = useMutation({
    mutationFn: (resourceId: number) => api.delete(`/workspaces/${activeWs}/resources/${resourceId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-resources', activeWs] }),
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

  const visibleProjects = (projects as any[]).filter((p) =>
    activeWs === null ? true : p.workspace_id === activeWs
  );

  const grouped = {
    active: visibleProjects.filter((p) => p.status === 'active'),
    paused: visibleProjects.filter((p) => p.status === 'paused'),
    done: visibleProjects.filter((p) => p.status === 'done'),
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWs) ?? null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Projects</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus size={15} /> New project
        </button>
      </div>

      {/* Workspace tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 flex-wrap">
        <button
          onClick={() => setActiveWs(null)}
          className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
            activeWs === null ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          All
        </button>
        {workspaces.map((w) => (
          <button
            key={w.id}
            onClick={() => setActiveWs(w.id)}
            className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeWs === w.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />
            {w.name}
          </button>
        ))}
        <button
          onClick={() => setShowWsForm(true)}
          className="flex items-center gap-1 px-2 py-2 text-sm text-gray-500 hover:text-gray-200 whitespace-nowrap"
          title="New workspace"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* New workspace form */}
      {showWsForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-200">New workspace</h3>
            <button onClick={() => setShowWsForm(false)}><X size={15} className="text-gray-500" /></button>
          </div>
          <input
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
            placeholder="Workspace name (e.g. Knitting)"
            value={wsForm.name}
            onChange={(e) => setWsForm({ ...wsForm, name: e.target.value })}
            autoFocus
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Color:</span>
            <div className="flex gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setWsForm({ ...wsForm, color: c })} className={`h-5 w-5 rounded-full transition-transform ${wsForm.color === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <button disabled={!wsForm.name} onClick={() => createWorkspace.mutate(wsForm)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            Create workspace
          </button>
        </div>
      )}

      {/* Edit workspace */}
      {editingWs && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-200">Edit workspace</h3>
            <button onClick={() => setEditingWs(null)}><X size={15} className="text-gray-500" /></button>
          </div>
          <input
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
            value={editingWs.name}
            onChange={(e) => setEditingWs({ ...editingWs, name: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Color:</span>
            <div className="flex gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setEditingWs({ ...editingWs, color: c })} className={`h-5 w-5 rounded-full transition-transform ${editingWs.color === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => updateWorkspace.mutate({ id: editingWs.id, name: editingWs.name, color: editingWs.color })}
              disabled={!editingWs.name}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete workspace "${editingWs.name}"? Projects in it will move to "All".`)) {
                  deleteWorkspace.mutate(editingWs.id);
                }
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Delete workspace
            </button>
          </div>
        </div>
      )}

      {/* Resources panel — only when a specific workspace is selected */}
      {activeWorkspace && (
        <div className="rounded-xl border border-gray-800 bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2.5">
            <button
              onClick={() => setResourcesOpen(!resourcesOpen)}
              className="flex items-center gap-2 text-sm font-medium text-gray-200 hover:text-white"
            >
              <ChevronDown size={14} className={`transition-transform ${resourcesOpen ? '' : '-rotate-90'}`} />
              Resources
              <span className="text-xs text-gray-500">({resources.length})</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingWs(activeWorkspace)}
                className="text-gray-500 hover:text-gray-300"
                title="Edit workspace"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setShowResourceForm(true)}
                className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
              >
                <Plus size={12} /> Add resource
              </button>
            </div>
          </div>

          {resourcesOpen && (
            <div className="border-t border-gray-800 px-4 py-3 space-y-2">
              {showResourceForm && (
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2 mb-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResForm({ ...resForm, type: 'link' })}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${resForm.type === 'link' ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                      <LinkIcon size={11} /> Link
                    </button>
                    <button
                      onClick={() => setResForm({ ...resForm, type: 'note' })}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${resForm.type === 'note' ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                      <FileText size={11} /> Note
                    </button>
                    <button onClick={() => setShowResourceForm(false)} className="ml-auto text-gray-500 hover:text-gray-300"><X size={13} /></button>
                  </div>
                  <input
                    className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                    placeholder="Title"
                    value={resForm.title}
                    onChange={(e) => setResForm({ ...resForm, title: e.target.value })}
                    autoFocus
                  />
                  {resForm.type === 'link' ? (
                    <input
                      className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                      placeholder="https://…"
                      value={resForm.url}
                      onChange={(e) => setResForm({ ...resForm, url: e.target.value })}
                    />
                  ) : (
                    <textarea
                      className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 min-h-[60px]"
                      placeholder="Note content"
                      value={resForm.content}
                      onChange={(e) => setResForm({ ...resForm, content: e.target.value })}
                    />
                  )}
                  <button
                    disabled={!resForm.title || (resForm.type === 'link' && !resForm.url) || (resForm.type === 'note' && !resForm.content)}
                    onClick={() => createResource.mutate({
                      type: resForm.type,
                      title: resForm.title,
                      url: resForm.type === 'link' ? resForm.url : undefined,
                      content: resForm.type === 'note' ? resForm.content : undefined,
                    })}
                    className="rounded bg-brand-500 px-3 py-1 text-xs text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              )}

              {resources.length === 0 && !showResourceForm && (
                <p className="text-xs text-gray-500">No resources yet</p>
              )}

              {resources.map((r) => (
                <div key={r.id} className="flex items-start gap-2 group">
                  {r.type === 'link' ? <LinkIcon size={12} className="text-gray-500 mt-0.5 flex-shrink-0" /> : <FileText size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    {r.type === 'link' && r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-gray-200 hover:text-brand-400 break-all">
                        {r.title}
                        <span className="text-gray-500 ml-2 text-[10px]">{r.url}</span>
                      </a>
                    ) : (
                      <div>
                        <p className="text-xs font-medium text-gray-200">{r.title}</p>
                        {r.content && <p className="text-xs text-gray-400 whitespace-pre-wrap">{r.content}</p>}
                      </div>
                    )}
                  </div>
                  <button onClick={() => deleteResource.mutate(r.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 flex-shrink-0">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New project form */}
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
          {workspaces.length > 0 && (
            <div className="text-xs text-gray-500">
              {activeWs === null ? 'Will be created without a workspace.' : (
                <>Will be added to <span className="text-gray-300">{activeWorkspace?.name}</span>.</>
              )}
            </div>
          )}
          <button disabled={!form.name} onClick={() => createProject.mutate({ ...form, workspace_id: activeWs })} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            Create
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([status, items]) =>
        items.length === 0 ? null : (
          <div key={status}>
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2 capitalize">{status}</h2>
            <ul className="space-y-2">
              {items.map((p: any) => {
                const ws = workspaces.find((w) => w.id === p.workspace_id);
                return (
                <li key={p.id} className="rounded-xl border border-gray-800 bg-gray-900">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-100">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-500 truncate">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Workspace assignment — only shown on the "All" view so it doesn't clutter individual workspace tabs */}
                      {activeWs === null && (
                        <div className="relative">
                          <select
                            value={p.workspace_id ?? ''}
                            onChange={(e) => updateProject.mutate({ id: p.id, workspace_id: e.target.value === '' ? null : Number(e.target.value) })}
                            className="appearance-none rounded-md px-2 py-0.5 text-xs font-medium pr-5 focus:outline-none bg-gray-800 text-gray-300 border border-gray-700 cursor-pointer"
                            style={ws ? { color: ws.color, borderColor: ws.color + '40' } : undefined}
                          >
                            <option value="">No workspace</option>
                            {workspaces.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={10} className="absolute right-0.5 top-1.5 pointer-events-none text-current opacity-60" />
                        </div>
                      )}
                      <div className="relative">
                        <select
                          value={p.status}
                          onChange={(e) => updateProject.mutate({ id: p.id, status: e.target.value })}
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
                );
              })}
            </ul>
          </div>
        )
      )}

      {visibleProjects.length === 0 && !showForm && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-gray-500">
            {activeWorkspace
              ? `No projects in ${activeWorkspace.name} yet — create one to get started`
              : 'No projects yet — create one to get started'}
          </p>
        </div>
      )}
    </div>
  );
}
