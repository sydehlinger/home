import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Trash2, Search, Upload, X, Star, Headphones, Tablet, Book, Pencil, ImageDown } from 'lucide-react';
import { format, fromUnixTime } from 'date-fns';
import { parseBook, type BookRecord, type Ownership } from '../lib/books';

type LibraryTab = 'library' | 'tbr' | 'read' | 'all';

const OWNERSHIPS: { id: Ownership; label: string }[] = [
  { id: 'owned', label: 'Owned'     },
  { id: 'none',  label: "Don't own" },
];

interface SearchResult {
  title: string;
  author: string | null;
  isbn: string | null;
  pages: number | null;
  cover_url: string | null;
  year: number | null;
}

const FORMATS = [
  { id: 'physical', label: 'Physical', icon: Book },
  { id: 'ebook',    label: 'eBook',    icon: Tablet },
  { id: 'audio',    label: 'Audio',    icon: Headphones },
] as const;

const STATUSES = [
  { id: 'to-read',  label: 'To Read'   },
  { id: 'reading',  label: 'Reading'   },
  { id: 'read',     label: 'Read'      },
  { id: 'dnf',      label: 'DNF'       },
] as const;

const STATUS_COLORS: Record<string, string> = {
  'to-read':  'bg-gray-700 text-gray-300',
  'reading':  'bg-blue-900/40 text-blue-300',
  'read':     'bg-green-900/40 text-green-300',
  'dnf':      'bg-red-900/40 text-red-300',
};

const FORMAT_COLORS: Record<string, string> = {
  physical: 'bg-amber-900/40 text-amber-300',
  ebook:    'bg-purple-900/40 text-purple-300',
  audio:    'bg-cyan-900/40 text-cyan-300',
};

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/books${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });

export default function LibraryPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingBook, setEditingBook] = useState<BookRecord | null>(null);
  const [tab, setTab] = useState<LibraryTab>('library');
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [coverMsg, setCoverMsg] = useState<string | null>(null);

  const { data: books = [], isLoading } = useQuery<BookRecord[]>({
    queryKey: ['books'],
    queryFn: () => api('').then(r => r.json()).then((rows: any[]) => rows.map(parseBook)),
  });

  const addMutation = useMutation({
    mutationFn: (body: { formats?: string[] } & Record<string, unknown>) => {
      const payload = { ...body, formats: body.formats ? JSON.stringify(body.formats) : undefined };
      return api('', { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['books'] }); setShowAdd(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; formats?: string[] } & Record<string, unknown>) => {
      const payload = { ...body, formats: body.formats ? JSON.stringify(body.formats) : undefined };
      return api(`/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }).then(r => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['books'] }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; formats?: string[] } & Record<string, unknown>) => {
      const payload = { ...body, formats: body.formats ? JSON.stringify(body.formats) : undefined };
      return api(`/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }).then(r => r.json());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['books'] }); setEditingBook(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['books'] }),
  });

  const backfillCovers = useMutation({
    mutationFn: () => api('/backfill-covers', { method: 'POST' }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['books'] });
      setCoverMsg(`Updated ${data.updated} cover${data.updated === 1 ? '' : 's'}.`);
      setTimeout(() => setCoverMsg(null), 2500);
    },
  });

  const filtered = books.filter(b => {
    if (tab === 'library' && b.ownership !== 'owned') return false;
    if (tab === 'tbr'     && b.status !== 'to-read')  return false;
    if (tab === 'read'    && b.status !== 'read')     return false;
    if (filterFormat !== 'all' && !b.formats.includes(filterFormat)) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (search && !`${b.title} ${b.author ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const ownedBooks = books.filter(b => b.ownership === 'owned');
  const currentlyReading = books.filter(b => b.status === 'reading');
  const counts = {
    library:  ownedBooks.length,
    tbr:      books.filter(b => b.status === 'to-read').length,
    read:     books.filter(b => b.status === 'read').length,
    all:      books.length,
    physical: ownedBooks.filter(b => b.formats.includes('physical')).length,
    ebook:    ownedBooks.filter(b => b.formats.includes('ebook')).length,
    audio:    ownedBooks.filter(b => b.formats.includes('audio')).length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-brand-400" />
          <h1 className="text-xl font-semibold text-white">Library</h1>
          <span className="ml-2 text-xs text-gray-500">
            {counts.library} owned · {counts.tbr} TBR · {counts.read} read
            {tab === 'library' && ` · ${counts.physical} physical · ${counts.ebook} ebook · ${counts.audio} audio`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => backfillCovers.mutate()}
            disabled={backfillCovers.isPending}
            title="Fetch missing covers from OpenLibrary using ISBNs"
            className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <ImageDown size={14} /> {backfillCovers.isPending ? 'Fetching…' : 'Fetch Covers'}
          </button>
          <button
            onClick={() => setShowImport(v => !v)}
            className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-700 transition-colors"
          >
            <Upload size={14} /> Import StoryGraph CSV
          </button>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            <Plus size={14} /> Add Book
          </button>
        </div>
      </div>

      {coverMsg && <div className="mb-4 text-xs text-green-400">{coverMsg}</div>}

      {currentlyReading.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-900/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-brand-400" />
              <h2 className="text-sm font-medium text-gray-200">Currently Reading</h2>
              <span className="text-xs text-gray-500">{currentlyReading.length}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {currentlyReading.map(book => (
              <button
                key={book.id}
                onClick={() => setEditingBook(book)}
                className="group flex gap-3 rounded-lg border border-gray-700/60 bg-gray-800/60 p-2.5 hover:border-brand-500/60 hover:bg-gray-800 transition-colors text-left w-72"
              >
                <div className="shrink-0 w-14 h-20 rounded overflow-hidden">
                  <CoverImage src={book.cover_url} className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <p className="text-sm font-medium text-white truncate group-hover:text-brand-400 transition-colors">{book.title}</p>
                  {book.author && <p className="text-xs text-gray-400 truncate">{book.author}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1.5">
                    {book.formats.map(fmt => {
                      const meta = FORMATS.find(f => f.id === fmt);
                      const Icon = meta?.icon ?? Book;
                      return (
                        <span key={fmt} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${FORMAT_COLORS[fmt] ?? FORMAT_COLORS.physical}`}>
                          <Icon size={10} />
                          {meta?.label ?? fmt}
                        </span>
                      );
                    })}
                    {book.pages && <span className="text-[10px] text-gray-500">{book.pages}p</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 mb-4 border-b border-gray-800 flex-wrap">
        {([
          { id: 'library', label: 'My Library', count: counts.library },
          { id: 'tbr',     label: 'TBR',        count: counts.tbr     },
          { id: 'read',    label: 'Read',       count: counts.read    },
          { id: 'all',     label: 'All',        count: counts.all     },
        ] as { id: LibraryTab; label: string; count: number }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            <span className={`text-xs ${tab === t.id ? 'text-brand-400' : 'text-gray-600'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {showImport && <ImportPanel onDone={() => { setShowImport(false); qc.invalidateQueries({ queryKey: ['books'] }); }} />}

      {showAdd && (
        <BookModal
          mode="add"
          onSubmit={(b) => addMutation.mutate(b)}
          onClose={() => setShowAdd(false)}
          pending={addMutation.isPending}
        />
      )}

      {editingBook && (
        <BookModal
          mode="edit"
          initial={editingBook}
          onSubmit={(b) => editMutation.mutate({ id: editingBook.id, ...b })}
          onClose={() => setEditingBook(null)}
          pending={editMutation.isPending}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title or author"
            className="w-full rounded-md border border-gray-700 bg-gray-800 pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <select
          value={filterFormat}
          onChange={e => setFilterFormat(e.target.value)}
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-brand-500 focus:outline-none"
        >
          <option value="all">All formats</option>
          {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-brand-500 focus:outline-none"
        >
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <BookOpen size={36} className="mb-3 opacity-30" />
          <p className="text-sm">
            {books.length === 0
              ? 'No books yet. Add one to start your library.'
              : tab === 'library' ? 'No owned books match your filters.'
              : tab === 'tbr'     ? 'Nothing in your TBR matches your filters.'
              : tab === 'read'    ? 'No read books match your filters.'
              : 'No books match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(book => (
            <BookCard
              key={book.id}
              book={book}
              onUpdate={(patch) => updateMutation.mutate({ id: book.id, ...patch })}
              onEdit={() => setEditingBook(book)}
              onDelete={() => deleteMutation.mutate(book.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CoverImage({ src, className }: { src: string | null; className?: string }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => { setErrored(false); }, [src]);

  if (!src || errored) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 ${className ?? ''}`}>
        <BookOpen size={20} className="text-gray-700" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setErrored(true)}
      className={`object-cover ${className ?? ''}`}
    />
  );
}

function BookCard({ book, onUpdate, onEdit, onDelete }: {
  book: BookRecord;
  onUpdate: (patch: { formats?: string[]; status?: string; ownership?: Ownership }) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toggleFormat = (id: string) => {
    const next = book.formats.includes(id)
      ? book.formats.filter(f => f !== id)
      : [...book.formats, id];
    if (next.length === 0) return;
    onUpdate({ formats: next });
  };

  return (
    <div className="group relative flex gap-3 rounded-lg border border-gray-700 bg-gray-800 p-3 hover:border-gray-600 transition-colors">
      <button
        onClick={onEdit}
        title="Edit book"
        className="shrink-0 w-16 h-24 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-500 transition-all"
      >
        <CoverImage src={book.cover_url} className="w-full h-full" />
      </button>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onEdit} className="min-w-0 text-left hover:text-brand-400 transition-colors">
            <p className="text-sm font-medium text-white truncate hover:text-brand-400">{book.title}</p>
            {book.author && <p className="text-xs text-gray-400 truncate">{book.author}</p>}
          </button>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="rounded p-1 text-gray-500 hover:text-brand-400 hover:bg-gray-700 transition-colors"
              title="Edit book"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1 text-gray-600 hover:text-red-400 hover:bg-gray-700 transition-colors"
              title="Remove book"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {!(book.status === 'to-read' && book.ownership === 'none') && book.formats.map(fmt => {
            const meta = FORMATS.find(f => f.id === fmt);
            const Icon = meta?.icon ?? Book;
            return (
              <span key={fmt} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${FORMAT_COLORS[fmt] ?? FORMAT_COLORS.physical}`}>
                <Icon size={10} />
                {meta?.label ?? fmt}
              </span>
            );
          })}
          {book.rating != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-yellow-400">
              <Star size={10} fill="currentColor" /> {book.rating.toFixed(1)}
            </span>
          )}
          {book.pages && <span className="text-[10px] text-gray-500">{book.pages}p</span>}
        </div>

        <div className="mt-auto pt-2 flex items-center gap-1.5">
          <select
            value={book.status}
            onChange={e => onUpdate({ status: e.target.value })}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium border-0 focus:outline-none cursor-pointer ${STATUS_COLORS[book.status] ?? STATUS_COLORS['to-read']}`}
          >
            {STATUSES.map(s => <option key={s.id} value={s.id} className="bg-gray-800 text-gray-200">{s.label}</option>)}
          </select>
          <div className="flex items-center gap-0.5 rounded border border-gray-700 bg-gray-900 p-0.5">
            {FORMATS.map(f => {
              const active = book.formats.includes(f.id);
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => toggleFormat(f.id)}
                  title={`${active ? 'Remove' : 'Add'} ${f.label}`}
                  className={`rounded p-1 transition-colors ${active ? 'bg-brand-500/30 text-brand-300' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-800'}`}
                >
                  <Icon size={11} />
                </button>
              );
            })}
          </div>
          <select
            value={book.ownership}
            onChange={e => onUpdate({ ownership: e.target.value as Ownership })}
            title="Ownership"
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium border-0 focus:outline-none cursor-pointer ${
              book.ownership === 'owned' ? 'bg-brand-500/20 text-brand-300' : 'bg-gray-700 text-gray-400'
            }`}
          >
            {OWNERSHIPS.map(o => (
              <option key={o.id} value={o.id} className="bg-gray-800 text-gray-200">{o.label}</option>
            ))}
          </select>
          {book.date_finished && (
            <span className="text-[10px] text-gray-600 ml-auto">
              {format(fromUnixTime(book.date_finished), 'MMM yyyy')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BookModal({ mode, initial, onSubmit, onClose, pending }: {
  mode: 'add' | 'edit';
  initial?: BookRecord;
  onSubmit: (b: Record<string, unknown>) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    author: initial?.author ?? '',
    isbn: initial?.isbn ?? '',
    formats: initial?.formats ?? (['physical'] as string[]),
    status: initial?.status ?? 'to-read',
    cover_url: initial?.cover_url ?? '',
    pages: initial?.pages != null ? String(initial.pages) : '',
    rating: initial?.rating != null ? String(initial.rating) : '',
    notes: initial?.notes ?? '',
    date_finished: initial?.date_finished
      ? format(fromUnixTime(initial.date_finished), 'yyyy-MM-dd')
      : '',
    ownership: initial?.ownership ?? ('owned' as Ownership),
  });

  const toggleFormat = (id: string) => {
    setForm(f => {
      const next = f.formats.includes(id) ? f.formats.filter(x => x !== id) : [...f.formats, id];
      return { ...f, formats: next.length ? next : f.formats };
    });
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await api(`/search?q=${encodeURIComponent(query.trim())}`).then(r => r.json());
      setResults(r.results ?? []);
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: SearchResult) => {
    setForm(f => ({
      ...f,
      title: r.title,
      author: r.author ?? '',
      isbn: r.isbn ?? '',
      cover_url: r.cover_url ?? '',
      pages: r.pages ? String(r.pages) : '',
    }));
    setResults([]);
    setQuery('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const dateFinished = form.date_finished ? Math.floor(new Date(form.date_finished).getTime() / 1000) : null;
    onSubmit({
      title: form.title.trim(),
      author: form.author.trim() || null,
      isbn: form.isbn.trim() || null,
      formats: form.formats,
      status: form.status,
      cover_url: form.cover_url.trim() || null,
      pages: form.pages ? parseInt(form.pages, 10) : null,
      rating: form.rating ? parseFloat(form.rating) : null,
      notes: form.notes.trim() || null,
      date_finished: dateFinished,
      ownership: form.ownership,
    });
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
          <h3 className="text-sm font-medium text-white">{mode === 'add' ? 'Add Book' : 'Edit Book'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
                placeholder="Search OpenLibrary by title, author, or ISBN"
                className="w-full rounded-md border border-gray-600 bg-gray-700 pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={runSearch}
              disabled={searching || !query.trim()}
              className="rounded-md bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {results.length > 0 && (
            <div className="max-h-60 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 divide-y divide-gray-800">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickResult(r)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800 transition-colors"
                >
                  <div className="w-8 h-12 shrink-0 rounded overflow-hidden">
                    <CoverImage src={r.cover_url} className="w-full h-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{r.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {r.author ?? 'Unknown author'}{r.year ? ` · ${r.year}` : ''}{r.pages ? ` · ${r.pages}p` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            <div className="flex gap-3">
              <div className="shrink-0 w-20 h-28 rounded overflow-hidden">
                <CoverImage src={form.cover_url || null} className="w-full h-full" />
              </div>
              <div className="flex-1 space-y-2">
                <Input label="Title *" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} />
                <Input label="Author" value={form.author} onChange={v => setForm(f => ({ ...f, author: v }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="ISBN" value={form.isbn} onChange={v => setForm(f => ({ ...f, isbn: v }))} />
              <Input label="Pages" type="number" value={form.pages} onChange={v => setForm(f => ({ ...f, pages: v }))} />
              <div>
                <label className="block text-xs text-gray-400 mb-1">Formats (toggle multiple)</label>
                <div className="flex items-center gap-1">
                  {FORMATS.map(f => {
                    const active = form.formats.includes(f.id);
                    const Icon = f.icon;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => toggleFormat(f.id)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-brand-500 bg-brand-500/20 text-brand-300'
                            : 'border-gray-600 bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        <Icon size={12} /> {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                >
                  {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <Input label="Rating (0–5)" type="number" value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} />
              <Input label="Date Finished" type="date" value={form.date_finished} onChange={v => setForm(f => ({ ...f, date_finished: v }))} />
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ownership</label>
                <select
                  value={form.ownership}
                  onChange={e => setForm(f => ({ ...f, ownership: e.target.value as Ownership }))}
                  className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="owned">I own this book</option>
                  <option value="none">Don't own</option>
                </select>
              </div>
            </div>

            <Input label="Cover URL" value={form.cover_url} onChange={v => setForm(f => ({ ...f, cover_url: v }))} />

            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none resize-y"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-700">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
              <button type="submit" disabled={pending || !form.title.trim()} className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50">
                {pending ? 'Saving…' : mode === 'add' ? 'Add Book' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
      />
    </div>
  );
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const csv = await file.text();
      const r = await fetch('/api/books/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg(`Error: ${data.error ?? 'Import failed'}`);
      } else {
        const parts = [];
        if (data.imported) parts.push(`Imported ${data.imported} new`);
        if (data.updated)  parts.push(`updated ${data.updated} existing`);
        setMsg(parts.length ? `${parts.join(', ')} books.` : 'No changes.');
        setTimeout(onDone, 1500);
      }
    } catch (err: any) {
      setMsg(`Error: ${err?.message ?? 'Import failed'}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white">Import StoryGraph CSV</h3>
        <button onClick={onDone} className="text-gray-400 hover:text-white"><X size={16} /></button>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        On StoryGraph, go to <span className="text-gray-300">Manage Account → Manage Your Data → Export StoryGraph Library</span>, download the CSV, then upload it here. Covers will be auto-fetched from OpenLibrary using ISBN.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        disabled={busy}
        className="block w-full text-sm text-gray-300 file:mr-3 file:rounded-md file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 file:cursor-pointer disabled:opacity-50"
      />
      {busy && <p className="mt-2 text-xs text-gray-400">Importing…</p>}
      {msg && <p className={`mt-2 text-xs ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}
    </div>
  );
}
