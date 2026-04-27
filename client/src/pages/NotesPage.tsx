import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, Trash2, FileText } from 'lucide-react';
import { formatDistanceToNow, fromUnixTime } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Note {
  id: number;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export default function NotesPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);

  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['notes'],
    queryFn: () => api.get('/notes'),
  });

  const createNote = useMutation({
    mutationFn: () => api.post<Note>('/notes', { title: 'Untitled', content: '' }),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      setSelectedId(note.id);
      setTitle(note.title);
      setContent(note.content);
    },
  });

  const saveNote = useMutation({
    mutationFn: ({ id, title, content }: { id: number; title: string; content: string }) =>
      api.patch(`/notes/${id}`, { title, content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });

  const deleteNote = useMutation({
    mutationFn: (id: number) => api.delete(`/notes/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      if (selectedId === id) {
        const remaining = notes.filter(n => n.id !== id);
        if (remaining.length > 0) selectNote(remaining[0]);
        else { setSelectedId(null); setTitle(''); setContent(''); }
      }
    },
  });

  function selectNote(note: Note) {
    flushSave();
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.content);
    isDirty.current = false;
  }

  function flushSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (isDirty.current && selectedId !== null) {
      saveNote.mutate({ id: selectedId, title, content });
      isDirty.current = false;
    }
  }

  function scheduleSave(newTitle: string, newContent: string) {
    isDirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (selectedId !== null) {
        saveNote.mutate({ id: selectedId, title: newTitle, content: newContent });
        isDirty.current = false;
      }
    }, 800);
  }

  useEffect(() => {
    if (notes.length > 0 && selectedId === null) {
      const first = notes[0];
      setSelectedId(first.id);
      setTitle(first.title);
      setContent(first.content);
    }
  }, [notes, selectedId]);

  useEffect(() => () => { flushSave(); }, []);

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const selectedNote = notes.find(n => n.id === selectedId);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800">
          <span className="text-sm font-medium text-gray-200">Notes</span>
          <button
            onClick={() => createNote.mutate()}
            disabled={createNote.isPending}
            className="rounded p-1 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="New note"
          >
            <Plus size={15} />
          </button>
        </div>

        <div className="px-3 py-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
          />
        </div>

        <ul className="flex-1 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-xs text-gray-600 text-center">No notes yet</li>
          )}
          {filtered.map(note => (
            <li key={note.id}>
              <button
                onClick={() => selectNote(note)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-800/50 transition-colors ${
                  selectedId === note.id ? 'bg-brand-500/10 border-l-2 border-l-brand-500' : 'hover:bg-gray-800'
                }`}
              >
                <p className={`text-xs font-medium truncate ${selectedId === note.id ? 'text-brand-300' : 'text-gray-200'}`}>
                  {note.title || 'Untitled'}
                </p>
                <p className="text-xs text-gray-600 truncate mt-0.5">
                  {note.content.split('\n')[0] || '—'}
                </p>
                <p className="text-xs text-gray-700 mt-0.5">
                  {formatDistanceToNow(fromUnixTime(note.updated_at), { addSuffix: true })}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor / Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedNote ? (
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
              <input
                value={title}
                onChange={e => { setTitle(e.target.value); scheduleSave(e.target.value, content); }}
                onBlur={flushSave}
                className="flex-1 bg-transparent text-lg font-semibold text-white placeholder-gray-600 focus:outline-none"
                placeholder="Untitled"
              />
              <button
                onClick={() => deleteNote.mutate(selectedNote.id)}
                className="ml-4 rounded p-1.5 text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
                title="Delete note"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <textarea
                value={content}
                onChange={e => { setContent(e.target.value); scheduleSave(title, e.target.value); }}
                onBlur={flushSave}
                placeholder="Start writing… (markdown supported)"
                className="flex-1 resize-none bg-transparent px-6 py-4 text-sm text-gray-300 placeholder-gray-700 focus:outline-none leading-relaxed font-mono border-r border-gray-800"
              />
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {content.trim() ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 italic">Preview will appear here.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-600">
            <FileText size={36} className="mb-3 opacity-30" />
            <p className="text-sm">No note selected</p>
            <button
              onClick={() => createNote.mutate()}
              className="mt-3 text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              Create your first note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
