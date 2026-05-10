import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday,
} from 'date-fns';
import { Plus, Trash2, X, List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ summary: '', description: '', start: '', end: '', allDay: false });
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: events = [], isLoading, isError, error } = useQuery<any[]>({
    queryKey: ['calendar'],
    queryFn: () => api.get('/calendar/events'),
  });

  const createEvent = useMutation({
    mutationFn: (body: typeof form) => api.post('/calendar/events', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); setShowForm(false); setForm({ summary: '', description: '', start: '', end: '', allDay: false }); },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  function getEventsForDay(day: Date) {
    return events.filter((e: any) => {
      const dateStr = e.start?.dateTime || e.start?.date;
      return dateStr ? isSameDay(parseISO(dateStr), day) : false;
    });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Calendar</h1>
          <p className="text-sm text-gray-500">Next 14 days from Google Calendar</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-700 overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`p-2 transition-colors ${view === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="List view"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`p-2 transition-colors ${view === 'calendar' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Calendar view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Plus size={15} /> New event
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-200">New event</h3>
            <button onClick={() => setShowForm(false)}><X size={15} className="text-gray-500" /></button>
          </div>
          <input className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500" placeholder="Title" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <input type={form.allDay ? 'date' : 'datetime-local'} className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            <input type={form.allDay ? 'date' : 'datetime-local'} className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="rounded" />
            All day
          </label>
          <button disabled={!form.summary || !form.start} onClick={() => createEvent.mutate(form)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            Create
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-800 animate-pulse" />)}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-6 space-y-2">
          <p className="text-sm font-medium text-red-400">Failed to load calendar events</p>
          <p className="text-xs text-red-500">{(error as Error)?.message}</p>
          <p className="text-xs text-gray-500">Try signing out and signing back in to re-authorize Google Calendar access.</p>
        </div>
      ) : view === 'list' ? (
        events.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-500">No upcoming events in the next 2 weeks</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((e: any) => (
              <li key={e.id} className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100">{e.summary}</p>
                  {e.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{e.description}</p>}
                  <p className="text-xs text-gray-500 mt-1">
                    {e.start?.dateTime
                      ? format(parseISO(e.start.dateTime), 'EEE, MMM d · h:mm a')
                      : e.start?.date
                      ? format(parseISO(e.start.date), 'EEE, MMM d') + ' · All day'
                      : ''}
                  </p>
                </div>
                <button
                  onClick={() => deleteEvent.mutate(e.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-200">{format(currentMonth, 'MMMM yyyy')}</span>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 border-b border-gray-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2 text-center text-xs text-gray-500 font-medium">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              return (
                <div
                  key={i}
                  className={`min-h-20 p-2 border-b border-r border-gray-800 ${!inMonth ? 'opacity-40' : ''}`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full mb-1 ${
                    today ? 'bg-brand-500 text-white font-semibold' : 'text-gray-400'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e: any) => (
                      <div key={e.id} className="text-xs bg-brand-500/20 text-brand-300 rounded px-1 py-0.5 truncate leading-tight">
                        {e.summary}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500 px-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
