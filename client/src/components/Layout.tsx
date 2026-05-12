import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Settings, Menu, X, Home } from 'lucide-react';
import { format } from 'date-fns';
import { loadNavOrder, loadHiddenNav } from '../lib/navOrder';
import { SidebarContext } from '../lib/sidebarContext';
import WeatherWidget from './WeatherWidget';

interface Props {
  user: { name: string; email: string };
  children: React.ReactNode;
}

export default function Layout({ user, children }: Props) {
  const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const [nav, setNav] = useState(() => loadNavOrder().filter(n => !loadHiddenNav().has(n.to)));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const handler = () => {
      const hidden = loadHiddenNav();
      setNav(loadNavOrder().filter(n => !hidden.has(n.to)));
    };
    window.addEventListener('nav-order-changed', handler);
    return () => window.removeEventListener('nav-order-changed', handler);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const sidebar = (
    <aside className="flex w-56 flex-col border-r border-gray-800 bg-gray-900 h-full">
      <div className="flex h-14 items-center justify-between px-4 border-b border-gray-800 flex-shrink-0">
        <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold text-white hover:text-brand-400 transition-colors"><Home size={20} />HOME</NavLink>
        <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
          <X size={18} />
        </button>
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
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static on desktop */}
      <div className={`fixed inset-y-0 left-0 z-30 md:static md:flex md:translate-x-0 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebar}
      </div>

      {/* Right side */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top bar — hidden on dashboard */}
        {pathname !== '/' && (
          <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-gray-800 bg-gray-950 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              <p className="text-sm font-medium text-white">{format(new Date(), 'EEEE, MMMM d')}</p>
            </div>
            <WeatherWidget compact />
          </header>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <SidebarContext.Provider value={() => setSidebarOpen(true)}>
            {children}
          </SidebarContext.Provider>
        </main>
      </div>
    </div>
  );
}
