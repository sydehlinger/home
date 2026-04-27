import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { BookOpen, UtensilsCrossed, ShoppingCart, Plus, Trash2, X, Upload, Tag } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MealPlanPage from './MealPlanPage';
import GroceryPage from './GroceryPage';

type Tab = 'recipes' | 'meals' | 'grocery';

interface Recipe {
  id: number;
  title: string;
  content: string;
  tags: string; // JSON array string from server
  updated_at: number;
}

function parseTags(raw: string | undefined): string[] {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'recipes', label: 'Recipe Box',  icon: BookOpen        },
  { id: 'meals',   label: 'Meal Plan',   icon: UtensilsCrossed },
  { id: 'grocery', label: 'Grocery',     icon: ShoppingCart    },
];

export default function KitchenPage() {
  const [tab, setTab] = useState<Tab>('recipes');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-1 px-6 pt-4 pb-0 border-b border-gray-800 flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors -mb-px ${
              tab === id
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'recipes' && <RecipeBox />}
        {tab === 'meals'   && <div className="h-full overflow-y-auto"><MealPlanPage /></div>}
        {tab === 'grocery' && <div className="h-full overflow-y-auto"><GroceryPage /></div>}
      </div>
    </div>
  );
}

// ── Recipe Box ─────────────────────────────────────────────────────────────────

function RecipeBox() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const dirty = useRef(false);
  const flushRef = useRef<() => void>(() => {});

  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: () => api.get('/recipes'),
  });

  const createRecipe = useMutation({
    mutationFn: () => api.post<Recipe>('/recipes', { title: 'Untitled Recipe', content: '', tags: '[]' }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      setSelectedId(r.id);
      setTitle(r.title);
      setContent(r.content);
      setTags([]);
      setEditing(true);
      dirty.current = false;
    },
  });

  const updateRecipe = useMutation({
    mutationFn: ({ id, title, content, tags }: { id: number; title: string; content: string; tags: string }) =>
      api.patch(`/recipes/${id}`, { title, content, tags }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });

  const deleteRecipe = useMutation({
    mutationFn: (id: number) => api.delete(`/recipes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      setSelectedId(null);
      setTitle('');
      setContent('');
      setTags([]);
      setEditing(false);
      setConfirmDelete(false);
      dirty.current = false;
    },
  });

  // Always-fresh flush callable from unmount/blur
  useEffect(() => {
    flushRef.current = () => {
      if (!dirty.current || selectedId === null) return;
      clearTimeout(saveTimer.current);
      updateRecipe.mutate({ id: selectedId, title, content, tags: JSON.stringify(tags) });
      dirty.current = false;
    };
  });

  useEffect(() => () => { flushRef.current(); }, []);

  useEffect(() => {
    if (recipes.length > 0 && selectedId === null) {
      const r = recipes[0];
      setSelectedId(r.id);
      setTitle(r.title);
      setContent(r.content);
      setTags(parseTags(r.tags));
    }
  }, [recipes]);

  function selectRecipe(r: Recipe) {
    flushRef.current();
    setSelectedId(r.id);
    setTitle(r.title);
    setContent(r.content);
    setTags(parseTags(r.tags));
    setEditing(false);
    setConfirmDelete(false);
    dirty.current = false;
  }

  function scheduleSave() {
    dirty.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(), 800);
  }

  function handleTitleChange(v: string)   { setTitle(v);   scheduleSave(); }
  function handleContentChange(v: string) { setContent(v); scheduleSave(); }

  function addTag(val: string) {
    const tag = val.trim().toLowerCase().replace(/,/g, '');
    if (!tag || tags.includes(tag)) { setTagInput(''); return; }
    const next = [...tags, tag];
    setTags(next);
    setTagInput('');
    scheduleSave();
  }

  function removeTag(t: string) {
    setTags(prev => { scheduleSave(); return prev.filter(x => x !== t); });
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
    else if (e.key === 'Backspace' && !tagInput && tags.length > 0) removeTag(tags[tags.length - 1]);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const title = file.name.replace(/\.md$/i, '');
        api.post<Recipe>('/recipes', { title, content, tags: '[]' }).then(r => {
          qc.invalidateQueries({ queryKey: ['recipes'] });
          setSelectedId(r.id);
          setTitle(r.title);
          setContent(r.content);
          setTags([]);
          setEditing(false);
          dirty.current = false;
        });
      };
      reader.readAsText(file);
    });
  }

  const allTags = [...new Set(recipes.flatMap(r => parseTags(r.tags)))].sort();

  const filtered = recipes.filter(r => {
    const recipeTags = parseTags(r.tags);
    if (tagFilter && !recipeTags.includes(tagFilter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q) ||
      recipeTags.some(t => t.toLowerCase().includes(q))
    );
  }).sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-gray-800 flex flex-col">
        {/* Search + actions */}
        <div className="p-3 border-b border-gray-800 flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
          />
          <button onClick={() => fileInputRef.current?.click()} title="Upload .md file"
            className="flex-shrink-0 rounded-md p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
            <Upload size={14} />
          </button>
          <button onClick={() => createRecipe.mutate()} disabled={createRecipe.isPending} title="New recipe"
            className="flex-shrink-0 rounded-md p-1.5 bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 transition-colors">
            <Plus size={14} />
          </button>
          <input ref={fileInputRef} type="file" accept=".md,text/markdown" multiple className="hidden" onChange={handleUpload} />
        </div>

        {/* Tag filter pills */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-gray-800">
            {allTags.map(t => (
              <button
                key={t}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                  tagFilter === t
                    ? 'bg-brand-500/30 text-brand-300'
                    : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}
              >
                <Tag size={9} />
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Recipe list */}
        <ul className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-xs text-gray-600 text-center">
              {search || tagFilter ? 'No matches' : 'No recipes yet'}
            </li>
          )}
          {filtered.map(r => {
            const rTags = parseTags(r.tags);
            return (
              <li key={r.id}>
                <button
                  onClick={() => selectRecipe(r)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors ${
                    r.id === selectedId ? 'bg-brand-500/10' : 'hover:bg-gray-800/50'
                  }`}
                >
                  <p className={`text-sm font-medium truncate ${r.id === selectedId ? 'text-brand-300' : 'text-gray-200'}`}>
                    {r.title || 'Untitled Recipe'}
                  </p>
                  <p className="text-xs text-gray-600 truncate mt-0.5">
                    {r.content.split('\n').find(l => l.trim()) || '—'}
                  </p>
                  {rTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {rTags.map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 text-xs">{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Detail panel */}
      {selectedId === null ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-700">
          <BookOpen size={32} />
          <p className="text-sm">Select a recipe or create a new one</p>
          <button onClick={() => createRecipe.mutate()}
            className="rounded-md px-3 py-1.5 text-xs bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 transition-colors">
            New recipe
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Title row */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 flex-shrink-0">
            {editing ? (
              <input
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                className="flex-1 bg-transparent text-lg font-semibold text-white focus:outline-none border-b border-brand-500/50 pb-0.5"
                placeholder="Recipe title…"
              />
            ) : (
              <h2 className="flex-1 text-lg font-semibold text-white truncate">{title || 'Untitled Recipe'}</h2>
            )}

            <div className="flex items-center gap-2 flex-shrink-0">
              {editing ? (
                <button onClick={() => { flushRef.current(); setEditing(false); }}
                  className="rounded-md px-3 py-1 text-xs bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 transition-colors">
                  Done
                </button>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="rounded-md px-3 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700 transition-colors">
                  Edit
                </button>
              )}
              {confirmDelete ? (
                <>
                  <span className="text-xs text-gray-500">Delete?</span>
                  <button onClick={() => deleteRecipe.mutate(selectedId)}
                    className="rounded-md px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors">
                    Yes
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-gray-600 hover:text-gray-400 transition-colors">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} title="Delete recipe"
                  className="text-gray-700 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Tags row */}
          {(editing || tags.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 px-6 py-2 border-b border-gray-800 flex-shrink-0">
              <Tag size={11} className="text-gray-600 flex-shrink-0" />
              {tags.map(t => (
                <span key={t} className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 text-xs">
                  {t}
                  {editing && (
                    <button onClick={() => removeTag(t)} className="hover:text-white transition-colors ml-0.5">
                      <X size={9} />
                    </button>
                  )}
                </span>
              ))}
              {editing && (
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                  placeholder={tags.length === 0 ? 'Add tags…' : 'Add…'}
                  className="bg-transparent text-xs text-gray-400 placeholder-gray-600 focus:outline-none w-20"
                />
              )}
            </div>
          )}

          {/* Content */}
          {editing ? (
            <div className="flex flex-1 overflow-hidden">
              <textarea
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="Write your recipe in markdown…"
                className="flex-1 resize-none bg-gray-950 px-6 py-4 text-sm text-gray-200 font-mono focus:outline-none border-r border-gray-800 placeholder-gray-700"
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
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {content.trim() ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-gray-600 italic">
                  No content yet.{' '}
                  <button onClick={() => setEditing(true)} className="text-brand-400 hover:underline">Start writing</button>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
