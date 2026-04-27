import { useState, useRef } from 'react';
import { ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { NAV_ITEMS, type NavItem, loadNavOrder, saveNavOrder } from '../lib/navOrder';

export default function SettingsPage() {
  const [order, setOrder] = useState<NavItem[]>(() => loadNavOrder());
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);

  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setOrder(next);
    saveNavOrder(next.map(n => n.to));
  }

  function onDragStart(i: number) {
    dragIndex.current = i;
  }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOver(i);
  }

  function onDrop(i: number) {
    const from = dragIndex.current;
    if (from === null || from === i) { setDragOver(null); return; }
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(i, 0, item);
    setOrder(next);
    saveNavOrder(next.map(n => n.to));
    dragIndex.current = null;
    setDragOver(null);
  }

  function onDragEnd() {
    dragIndex.current = null;
    setDragOver(null);
  }

  function reset() {
    setOrder(NAV_ITEMS);
    saveNavOrder(null);
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold text-white mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Drag or use arrows to reorder sidebar navigation items.</p>

      <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
        {order.map((item, i) => {
          const Icon = item.icon;
          const isOver = dragOver === i;
          return (
            <div
              key={item.to}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={e => onDragOver(e, i)}
              onDrop={() => onDrop(i)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-3 px-4 py-3 transition-colors select-none ${
                isOver ? 'bg-brand-500/10 border-l-2 border-l-brand-500' : 'border-l-2 border-l-transparent'
              }`}
            >
              <GripVertical size={14} className="text-gray-500 flex-shrink-0 cursor-grab active:cursor-grabbing" />
              <Icon size={15} className="text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-200">{item.label}</span>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-0.5 rounded text-gray-600 hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  className="p-0.5 rounded text-gray-600 hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={reset}
        className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        Reset to default order
      </button>
    </div>
  );
}
