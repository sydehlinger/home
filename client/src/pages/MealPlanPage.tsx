import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ChevronLeft, ChevronRight, X, Plus, Check } from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameMonth,
} from 'date-fns';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
type MealType = typeof MEAL_TYPES[number];

const MEAL_LABELS: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_SHORT: Record<MealType, string> = { breakfast: 'B', lunch: 'L', dinner: 'D' };
const MEAL_COLORS: Record<MealType, string> = {
  breakfast: 'text-orange-300',
  lunch: 'text-green-300',
  dinner: 'text-blue-300',
};

interface Meal {
  id: number;
  date: string;
  meal_type: MealType;
  name: string;
}

type View = 'week' | 'month';

function isoDate(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export default function MealPlanPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [editing, setEditing] = useState<{ date: string; meal_type: MealType } | null>(null);
  const [input, setInput] = useState('');

  // Compute fetch range for each view
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthCalStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const monthCalEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: monthCalStart, end: monthCalEnd });

  const queryStart = view === 'week' ? isoDate(weekDays[0]) : isoDate(monthCalStart);
  const queryEnd   = view === 'week' ? isoDate(weekDays[6]) : isoDate(monthCalEnd);

  const { data: meals = [] } = useQuery<Meal[]>({
    queryKey: ['meals', queryStart, queryEnd],
    queryFn: () => api.get(`/meals?start=${queryStart}&end=${queryEnd}`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['meals', queryStart, queryEnd] });

  const addMeal = useMutation({
    mutationFn: (body: { date: string; meal_type: string; name: string }) => api.post('/meals', body),
    onSuccess: () => { invalidate(); setEditing(null); setInput(''); },
  });

  const deleteMeal = useMutation({
    mutationFn: (id: number) => api.delete(`/meals/${id}`),
    onSuccess: invalidate,
  });

  function getMeals(date: string, type: MealType) {
    return meals.filter(m => m.date === date && m.meal_type === type);
  }

  function startAdding(date: string, meal_type: MealType) {
    setEditing({ date, meal_type });
    setInput('');
  }

  function commitAdd() {
    if (!editing || !input.trim()) { setEditing(null); return; }
    addMeal.mutate({ date: editing.date, meal_type: editing.meal_type, name: input.trim() });
  }

  const today = isoDate(new Date());

  // Navigation
  const prevLabel = view === 'week' ? <ChevronLeft size={16} /> : <ChevronLeft size={16} />;
  const nextLabel = view === 'week' ? <ChevronRight size={16} /> : <ChevronRight size={16} />;
  const rangeLabel = view === 'week'
    ? `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`
    : format(monthDate, 'MMMM yyyy');

  function goBack() {
    if (view === 'week') setWeekStart(w => subWeeks(w, 1));
    else setMonthDate(m => subMonths(m, 1));
  }
  function goForward() {
    if (view === 'week') setWeekStart(w => addWeeks(w, 1));
    else setMonthDate(m => addMonths(m, 1));
  }
  function goToday() {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setMonthDate(startOfMonth(new Date()));
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Meal Plan</h1>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-md border border-gray-700 overflow-hidden text-xs">
            {(['week', 'month'] as View[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  view === v ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button onClick={goBack} className="rounded p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-300 w-48 text-center">{rangeLabel}</span>
          <button onClick={goForward} className="rounded p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={goToday}
            className="rounded-md px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <WeekGrid
          days={weekDays}
          today={today}
          getMeals={getMeals}
          editing={editing}
          input={input}
          setInput={setInput}
          startAdding={startAdding}
          commitAdd={commitAdd}
          cancelEdit={() => setEditing(null)}
          onDelete={id => deleteMeal.mutate(id)}
        />
      ) : (
        <MonthGrid
          days={monthDays}
          monthDate={monthDate}
          today={today}
          getMeals={getMeals}
          editing={editing}
          input={input}
          setInput={setInput}
          startAdding={startAdding}
          commitAdd={commitAdd}
          cancelEdit={() => setEditing(null)}
          onDelete={id => deleteMeal.mutate(id)}
        />
      )}
    </div>
  );
}

// ── Shared cell input ──────────────────────────────────────────────────────────

function AddInput({ onCommit, onCancel, value, onChange }: {
  onCommit: () => void;
  onCancel: () => void;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Add meal…"
        className="flex-1 min-w-0 bg-gray-800 border border-brand-500/50 rounded px-1.5 py-1 text-xs text-white placeholder-gray-600 focus:outline-none"
      />
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={onCommit}
        className="flex-shrink-0 text-brand-400 hover:text-brand-300 transition-colors"
        title="Save"
      >
        <Check size={12} />
      </button>
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={onCancel}
        className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors"
        title="Cancel"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Week view ──────────────────────────────────────────────────────────────────

function WeekGrid({ days, today, getMeals, editing, input, setInput, startAdding, commitAdd, cancelEdit, onDelete }: {
  days: Date[];
  today: string;
  getMeals: (date: string, type: MealType) => Meal[];
  editing: { date: string; meal_type: MealType } | null;
  input: string;
  setInput: (v: string) => void;
  startAdding: (date: string, type: MealType) => void;
  commitAdd: () => void;
  cancelEdit: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-24 pb-3 pr-4" />
            {days.map(day => {
              const d = isoDate(day);
              return (
                <th key={d} className="pb-3 px-2 text-center min-w-[120px]">
                  <div className={`text-xs font-medium ${d === today ? 'text-brand-400' : 'text-gray-500'}`}>{format(day, 'EEE')}</div>
                  <div className={`text-sm font-semibold mt-0.5 ${d === today ? 'text-brand-300' : 'text-gray-300'}`}>{format(day, 'MMM d')}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {MEAL_TYPES.map(type => (
            <tr key={type}>
              <td className="py-2 pr-4 align-top">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{MEAL_LABELS[type]}</span>
              </td>
              {days.map(day => {
                const date = isoDate(day);
                const cellMeals = getMeals(date, type);
                const isEditing = editing?.date === date && editing?.meal_type === type;
                return (
                  <td key={date} className="py-2 px-2 align-top">
                    <div className={`min-h-[60px] rounded-lg border p-2 transition-colors ${date === today ? 'border-brand-500/30 bg-brand-500/5' : 'border-gray-800 bg-gray-900'}`}>
                      <ul className="space-y-1 mb-1">
                        {cellMeals.map(meal => (
                          <li key={meal.id} className="flex items-start gap-1 group">
                            <span className="flex-1 text-xs text-gray-300 leading-snug">{meal.name}</span>
                            <button onClick={() => onDelete(meal.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
                              <X size={10} />
                            </button>
                          </li>
                        ))}
                      </ul>
                      {isEditing ? (
                        <AddInput value={input} onChange={setInput} onCommit={commitAdd} onCancel={cancelEdit} />
                      ) : (
                        <button onClick={() => startAdding(date, type)} className="text-gray-700 hover:text-gray-400 transition-colors">
                          <Plus size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Month view ─────────────────────────────────────────────────────────────────

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function MonthGrid({ days, monthDate, today, getMeals, editing, input, setInput, startAdding, commitAdd, cancelEdit, onDelete }: {
  days: Date[];
  monthDate: Date;
  today: string;
  getMeals: (date: string, type: MealType) => Meal[];
  editing: { date: string; meal_type: MealType } | null;
  input: string;
  setInput: (v: string) => void;
  startAdding: (date: string, type: MealType) => void;
  commitAdd: () => void;
  cancelEdit: () => void;
  onDelete: (id: number) => void;
}) {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map(day => {
              const date = isoDate(day);
              const inMonth = isSameMonth(day, monthDate);
              const isToday = date === today;

              return (
                <div
                  key={date}
                  className={`rounded-lg border p-1.5 min-h-[90px] transition-colors ${
                    isToday ? 'border-brand-500/40 bg-brand-500/5' : inMonth ? 'border-gray-800 bg-gray-900' : 'border-gray-800/50 bg-gray-900/40'
                  }`}
                >
                  {/* Day number */}
                  <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-brand-400' : inMonth ? 'text-gray-300' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>

                  {/* Meal slots */}
                  <div className="space-y-0.5">
                    {MEAL_TYPES.map(type => {
                      const cellMeals = getMeals(date, type);
                      const isEditing = editing?.date === date && editing?.meal_type === type;

                      return (
                        <div key={type}>
                          {cellMeals.map(meal => (
                            <div key={meal.id} className="flex items-center gap-0.5 group">
                              <span className={`text-xs font-bold flex-shrink-0 ${MEAL_COLORS[type]}`}>{MEAL_SHORT[type]}</span>
                              <span className="flex-1 text-xs text-gray-400 truncate leading-snug">{meal.name}</span>
                              <button onClick={() => onDelete(meal.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                                <X size={9} />
                              </button>
                            </div>
                          ))}
                          {isEditing ? (
                            <AddInput value={input} onChange={setInput} onCommit={commitAdd} onCancel={cancelEdit} />
                          ) : (
                            cellMeals.length === 0 && inMonth && (
                              <button
                                onClick={() => startAdding(date, type)}
                                className="flex items-center gap-0.5 text-gray-800 hover:text-gray-500 transition-colors w-full"
                              >
                                <span className={`text-xs font-bold ${MEAL_COLORS[type]} opacity-30`}>{MEAL_SHORT[type]}</span>
                                <Plus size={9} className="opacity-50" />
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
