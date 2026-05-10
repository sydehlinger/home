import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, Check, Trash2, ChevronDown } from 'lucide-react';

export default function TasksPage() {
  const qc = useQueryClient();
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [newTask, setNewTask] = useState('');

  const { data: lists = [] } = useQuery<any[]>({
    queryKey: ['taskLists'],
    queryFn: () => api.get('/tasks/lists'),
  });

  useEffect(() => {
    if (lists.length && !selectedList) setSelectedList(lists[0].id);
  }, [lists, selectedList]);

  const activeListId = selectedList ?? lists[0]?.id;

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ['tasks', activeListId],
    queryFn: () => api.get(`/tasks/lists/${activeListId}`),
    enabled: !!activeListId,
  });

  const addTask = useMutation({
    mutationFn: (title: string) => api.post(`/tasks/lists/${activeListId}`, { title }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', activeListId] }); setNewTask(''); },
  });

  const completeTask = useMutation({
    mutationFn: (taskId: string) => api.patch(`/tasks/lists/${activeListId}/${taskId}/complete`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', activeListId] }),
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => api.delete(`/tasks/lists/${activeListId}/${taskId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', activeListId] }),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Tasks</h1>

        {lists.length > 1 && (
          <div className="relative">
            <select
              value={activeListId ?? ''}
              onChange={(e) => setSelectedList(e.target.value)}
              className="appearance-none rounded-lg border border-gray-700 bg-gray-800 pl-3 pr-8 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
            >
              {lists.map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-2.5 text-gray-500 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Add task */}
      <form
        onSubmit={(e) => { e.preventDefault(); if (newTask.trim()) addTask.mutate(newTask.trim()); }}
        className="flex gap-2"
      >
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
        />
        <button type="submit" disabled={!newTask.trim()} className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
          <Plus size={15} />
        </button>
      </form>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-gray-800 animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-gray-500">No tasks — you're all caught up</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {(() => {
            const subtasksByParent = new Map<string, any[]>();
            const topLevel: any[] = [];
            for (const t of tasks) {
              if (t.parent) {
                const arr = subtasksByParent.get(t.parent) ?? [];
                arr.push(t);
                subtasksByParent.set(t.parent, arr);
              } else {
                topLevel.push(t);
              }
            }
            const ordered: { task: any; indent: boolean }[] = [];
            for (const t of topLevel) {
              ordered.push({ task: t, indent: false });
              for (const sub of subtasksByParent.get(t.id) ?? []) {
                ordered.push({ task: sub, indent: true });
              }
            }
            return ordered;
          })().map(({ task: t, indent }) => (
            <li key={t.id} className={`flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 group${indent ? ' ml-6' : ''}`}>
              <button
                onClick={() => completeTask.mutate(t.id)}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gray-600 hover:border-green-400 hover:bg-green-400/10 transition-colors"
              >
                <Check size={11} className="text-transparent group-hover:text-green-400" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">{t.title}</p>
                {t.due && <p className="text-xs text-gray-500">Due {new Date(t.due).toLocaleDateString()}</p>}
                {t.notes && <p className="text-xs text-gray-500 truncate">{t.notes}</p>}
              </div>
              <button
                onClick={() => deleteTask.mutate(t.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
