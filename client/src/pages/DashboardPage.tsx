import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  Calendar, CheckSquare, DollarSign, FolderKanban, FileText, UtensilsCrossed, Menu,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow, fromUnixTime } from 'date-fns';
import { Link } from 'react-router-dom';
import WeatherWidget from '../components/WeatherWidget';
import { useSidebar } from '../lib/sidebarContext';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
const MEAL_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export default function DashboardPage() {
  const { data: events = [] } = useQuery<any[]>({ queryKey: ['calendar'], queryFn: () => api.get('/calendar/events') });
  const { data: taskLists = [] } = useQuery<any[]>({ queryKey: ['taskLists'], queryFn: () => api.get('/tasks/lists') });
  const { data: projects = [] } = useQuery<any[]>({ queryKey: ['projects'], queryFn: () => api.get('/projects') });
  const { data: notes = [] } = useQuery<any[]>({ queryKey: ['notes'], queryFn: () => api.get('/notes') });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: todayMeals = [] } = useQuery<any[]>({
    queryKey: ['meals', todayStr],
    queryFn: () => api.get(`/meals?start=${todayStr}&end=${todayStr}`),
  });

  const upcomingEvents = events.slice(0, 3);
  const activeProjects = (projects as any[]).filter((p) => p.status === 'active').slice(0, 4);
  const recentNotes = (notes as any[]).slice(0, 3);

  const openSidebar = useSidebar();
  const today = format(new Date(), 'EEEE, MMMM d');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-gray-400 hover:text-white mt-1" onClick={openSidebar}>
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-white">{today}</h1>
            <p className="text-gray-500 text-sm mt-0.5">Here's what's going on</p>
          </div>
        </div>
        <WeatherWidget />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Upcoming events" value={events.length} to="/calendar" color="blue" />
        <StatCard icon={CheckSquare} label="Task lists" value={taskLists.length} to="/tasks" color="green" />
        <StatCard icon={FolderKanban} label="Active projects" value={activeProjects.length} to="/projects" color="indigo" />
        <StatCard icon={DollarSign} label="Budget" value="View" to="/budget" color="yellow" />
        <StatCard icon={FileText} label="Notes" value={notes.length} to="/notes" color="purple" />
        <StatCard icon={UtensilsCrossed} label="Meal plan" value="View" to="/meals" color="orange" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming events */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-300">Next up</h2>
            <Link to="/calendar" className="text-xs text-brand-400 hover:text-brand-300">View all</Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-gray-600">No upcoming events</p>
          ) : (
            <ul className="space-y-2">
              {upcomingEvents.map((e: any) => (
                <li key={e.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-200">{e.summary}</p>
                    <p className="text-xs text-gray-500">
                      {e.start?.dateTime
                        ? format(parseISO(e.start.dateTime), 'MMM d, h:mm a')
                        : e.start?.date}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Active projects */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-300">Active projects</h2>
            <Link to="/projects" className="text-xs text-brand-400 hover:text-brand-300">View all</Link>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-gray-600">No active projects</p>
          ) : (
            <ul className="space-y-2">
              {activeProjects.map((p: any) => (
                <li key={p.id} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-sm text-gray-200 truncate">{p.name}</span>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-brand-400 hover:underline flex-shrink-0">
                      Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent notes */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-300">Recent notes</h2>
            <Link to="/notes" className="text-xs text-brand-400 hover:text-brand-300">View all</Link>
          </div>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-gray-600">No notes yet</p>
          ) : (
            <ul className="space-y-2">
              {recentNotes.map((n: any) => (
                <li key={n.id}>
                  <Link to="/notes" className="flex items-start gap-3 group">
                    <FileText size={14} className="mt-0.5 flex-shrink-0 text-gray-600 group-hover:text-gray-400 transition-colors" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 truncate group-hover:text-white transition-colors">
                        {n.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {n.content.split('\n')[0] || '—'}
                      </p>
                      <p className="text-xs text-gray-700 mt-0.5">
                        {formatDistanceToNow(fromUnixTime(n.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Today's meals */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-300">Today's meals</h2>
            <Link to="/meals" className="text-xs text-brand-400 hover:text-brand-300">Plan week</Link>
          </div>
          <ul className="space-y-2">
            {MEAL_TYPES.map(type => {
              const items = (todayMeals as any[]).filter(m => m.meal_type === type);
              return (
                <li key={type} className="flex items-start gap-3">
                  <span className="w-16 text-xs text-gray-600 pt-0.5 flex-shrink-0">{MEAL_LABELS[type]}</span>
                  {items.length > 0 ? (
                    <span className="text-sm text-gray-200">{items.map((m: any) => m.name).join(', ')}</span>
                  ) : (
                    <Link to="/meals" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">Not planned</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, to, color }: {
  icon: React.ElementType; label: string; value: number | string; to: string;
  color: 'blue' | 'green' | 'indigo' | 'yellow' | 'purple' | 'orange';
}) {
  const colors = {
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    indigo: 'text-brand-400 bg-brand-500/10',
    yellow: 'text-yellow-400 bg-yellow-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    orange: 'text-orange-400 bg-orange-400/10',
  };
  return (
    <Link to={to} className="rounded-xl border border-gray-800 bg-gray-900 p-4 hover:bg-gray-800 transition-colors">
      <div className={`inline-flex rounded-lg p-2 ${colors[color]}`}>
        <Icon size={16} />
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Link>
  );
}
