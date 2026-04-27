import {
  LayoutDashboard, Calendar, CheckSquare, DollarSign, FolderKanban,
  Package, FileText, Utensils,
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
];

const STORAGE_KEY = 'nav-order';

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
