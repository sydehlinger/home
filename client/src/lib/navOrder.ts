import {
  LayoutDashboard, Calendar, CheckSquare, DollarSign, FolderKanban,
  Package, FileText, Utensils, BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/budget', label: 'Budget', icon: DollarSign },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/packages', label: 'Packages', icon: Package },
  { to: '/notes', label: 'Notes', icon: FileText },
  { to: '/kitchen', label: 'Kitchen', icon: Utensils },
  { to: '/library', label: 'Library', icon: BookOpen },
];

const STORAGE_KEY = 'nav-order';
const HIDDEN_KEY = 'nav-hidden';

export function loadNavOrder(): NavItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return NAV_ITEMS;
    const saved: string[] = JSON.parse(raw);
    const map = new Map(NAV_ITEMS.map(n => [n.to, n]));
    const ordered = saved.map(to => map.get(to)).filter(Boolean) as NavItem[];
    // append any items not yet in saved order (future additions)
    const savedSet = new Set(saved);
    NAV_ITEMS.forEach(n => { if (!savedSet.has(n.to)) ordered.push(n); });
    return ordered;
  } catch {
    return NAV_ITEMS;
  }
}

export function saveNavOrder(order: string[] | null) {
  if (order === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }
  window.dispatchEvent(new Event('nav-order-changed'));
}

export function loadHiddenNav(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (!raw) return new Set();
    const saved: string[] = JSON.parse(raw);
    return new Set(saved);
  } catch {
    return new Set();
  }
}

export function saveHiddenNav(hidden: Set<string> | null) {
  if (hidden === null || hidden.size === 0) {
    localStorage.removeItem(HIDDEN_KEY);
  } else {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
  }
  window.dispatchEvent(new Event('nav-order-changed'));
}
