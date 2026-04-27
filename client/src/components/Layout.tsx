import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { loadNavOrder } from '../lib/navOrder';
import WeatherWidget from './WeatherWidget';

interface Props {
  user: { name: string; email: string };
  children: React.ReactNode;
}

export default function Layout({ user, children }: Props) {
  const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const [nav, setNav] = useState(loadNavOrder);
  const { pathname } = useLocation();

  useEffect(() => {
    const handler = () => setNav(loadNavOrder());
    window.addEventListener('nav-order-changed', handler);
    return () => window.removeEventListener('nav-order-changed', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-gray-800 bg-gray-900">
        <div className="flex h-14 items-center px-4 border-b border-gray-800">
          <span className="text-lg font-semibold text-white">Home</span>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-800 p-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-2 py-1.5 text-xs mb-2 transition-colors ${
                isActive ? 'text-brand-400 bg-brand-500/10' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
              }`
            }
          >
            <Settings size={13} /> Settings
          </NavLink>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-medium text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-gray-200">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => fetch('/auth/logout', { method: 'POST', credentials: 'include' }).then(() => location.reload())}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* Right side */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar — hidden on dashboard which has its own header */}
        {pathname !== '/' && (
          <header className="flex items-center justify-between px-6 h-14 border-b border-gray-800 bg-gray-950 flex-shrink-0">
            <p className="text-sm font-medium text-white">{format(new Date(), 'EEEE, MMMM d')}</p>
            <WeatherWidget compact />
          </header>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
