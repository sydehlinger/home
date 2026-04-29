import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { ChevronLeft, ChevronRight, Trash2, Upload, X } from 'lucide-react';

const CATEGORIES = [
  'Recurring', 'Insurance', 'Utilities', 'Car', 'Subscriptions',
  'Groceries', 'Eating Out', 'Gas', 'Cats', 'Fun', 'Hobbies',
  'Clothes/Beauty', 'Other', 'Emergency Savings', 'Down Payment', 'Deposits',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CAT_COLORS: Record<string, string> = {
  Recurring: '#6366f1',
  Insurance: '#3b82f6',
  Utilities: '#8b5cf6',
  Car: '#f97316',
  Subscriptions: '#ec4899',
  Groceries: '#10b981',
  'Eating Out': '#f59e0b',
  Gas: '#ef4444',
  Cats: '#14b8a6',
  Fun: '#a855f7',
  Hobbies: '#06b6d4',
  'Clothes/Beauty': '#f472b6',
  Other: '#6b7280',
  'Emergency Savings': '#22c55e',
  'Down Payment': '#0ea5e9',
  Deposits: '#84cc16',
};

type Transaction = {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
};

type CsvData = { headers: string[]; rows: string[][] };
type Mapping = { date: string; description: string; amount: string; category: string };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseCSV(text: string): CsvData {
  const lines = text.trim().split(/\r?\n/);
  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { fields.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    fields.push(cur.trim());
    return fields;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim()).map(parseLine);
  return { headers, rows };
}

function autoDetectMapping(headers: string[]): Mapping {
  const find = (...keywords: string[]) =>
    headers.find((h) => keywords.some((k) => h.toLowerCase().includes(k))) ?? '';
  return {
    date: find('date'),
    description: find('description', 'memo', 'payee', 'merchant', 'name', 'narration'),
    amount: find('amount', 'debit', 'credit', 'sum', 'total'),
    category: find('category', 'type', 'label'),
  };
}

function normalizeDate(raw: string): string {
  const s = raw.trim().replace(/^["']|["']$/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  // MM/DD/YY
  const mdyShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdyShort) {
    const y = Number(mdyShort[3]) > 50 ? `19${mdyShort[3]}` : `20${mdyShort[3]}`;
    return `${y}-${mdyShort[1].padStart(2, '0')}-${mdyShort[2].padStart(2, '0')}`;
  }
  // Fallback: let Date parse it and convert to ISO
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function applyMapping(rows: string[][], headers: string[], mapping: Mapping): Transaction[] {
  const idx = (field: string) => headers.indexOf(field);
  const di = idx(mapping.date);
  const dsi = idx(mapping.description);
  const ai = idx(mapping.amount);
  const ci = idx(mapping.category);
  return rows
    .map((row) => ({
      id: 0,
      date: di >= 0 ? normalizeDate(row[di] ?? '') : '',
      description: dsi >= 0 ? row[dsi] ?? '' : '',
      amount: ai >= 0 ? Math.abs(parseFloat((row[ai] ?? '0').replace(/[$,]/g, '')) || 0) : 0,
      category: ci >= 0 && row[ci] ? row[ci] : 'Other',
    }))
    .filter((t) => t.date && t.description);
}

function MappingSelect({
  label, field, headers, mapping, setMapping,
}: {
  label: string;
  field: keyof Mapping;
  headers: string[];
  mapping: Mapping;
  setMapping: React.Dispatch<React.SetStateAction<Mapping>>;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      <select
        value={mapping[field]}
        onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
      >
        <option value="">— skip —</option>
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}

export default function BudgetPage() {
  const [tab, setTab] = useState<'overview' | 'transactions' | 'year'>('overview');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    category: CATEGORIES[0],
  });

  // CSV import state
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ date: '', description: '', amount: '', category: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions', month],
    queryFn: () => api.get(`/budget?month=${month}`),
    enabled: tab !== 'year',
  });

  const { data: yearTransactions = [], isLoading: yearLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions-year', year],
    queryFn: () => api.get(`/budget?year=${year}`),
    enabled: tab === 'year',
  });

  const addMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/budget', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      setForm((f) => ({ ...f, description: '', amount: '' }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/budget/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const importMutation = useMutation({
    mutationFn: (txs: Omit<Transaction, 'id'>[]) => api.post('/budget/import', { transactions: txs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      setCsvData(null);
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  // Month overview derived data
  const spendTransactions = transactions.filter((t) => t.category !== 'Deposits');
  const totalSpend = spendTransactions.reduce((sum, t) => sum + t.amount, 0);
  const categoryTotals = CATEGORIES.filter((c) => c !== 'Deposits').map((cat) => ({
    category: cat,
    total: spendTransactions.filter((t) => t.category === cat).reduce((sum, t) => sum + t.amount, 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  // Year overview derived data
  const yearSpend = yearTransactions.filter((t) => t.category !== 'Deposits');
  const yearTotal = yearSpend.reduce((sum, t) => sum + t.amount, 0);
  const activeMonths = new Set(yearSpend.map((t) => t.date.slice(0, 7))).size;
  const monthlyData = MONTHS_SHORT.map((label, i) => {
    const mo = String(i + 1).padStart(2, '0');
    return {
      month: label,
      total: yearSpend
        .filter((t) => t.date.startsWith(`${year}-${mo}`))
        .reduce((sum, t) => sum + t.amount, 0),
    };
  });
  const yearCategoryTotals = CATEGORIES.filter((c) => c !== 'Deposits').map((cat) => ({
    category: cat,
    total: yearSpend.filter((t) => t.category === cat).reduce((sum, t) => sum + t.amount, 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.amount) return;
    addMutation.mutate(form);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target?.result as string);
      setCsvData(parsed);
      setMapping(autoDetectMapping(parsed.headers));
    };
    reader.readAsText(file);
  }

  const preview = csvData ? applyMapping(csvData.rows, csvData.headers, mapping) : [];

  function handleImport() {
    if (!preview.length) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    importMutation.mutate(preview.map(({ id: _id, ...rest }) => rest));
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Budget</h1>
        <div className="flex gap-1 rounded-lg border border-gray-800 p-1">
          {(['overview', 'transactions', 'year'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Month selector */}
      {tab !== 'year' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-200 w-40 text-center">{monthLabel(month)}</span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          {month !== currentMonth() && (
            <button
              onClick={() => setMonth(currentMonth())}
              className="text-xs text-brand-400 hover:text-brand-300 ml-1 transition-colors"
            >
              This month
            </button>
          )}
        </div>
      )}

      {/* Year selector */}
      {tab === 'year' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-200 w-16 text-center">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          {year !== new Date().getFullYear() && (
            <button
              onClick={() => setYear(new Date().getFullYear())}
              className="text-xs text-brand-400 hover:text-brand-300 ml-1 transition-colors"
            >
              This year
            </button>
          )}
        </div>
      )}

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total Spent</p>
              <p className="text-2xl font-semibold text-white mt-1">${totalSpend.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Transactions</p>
              <p className="text-2xl font-semibold text-white mt-1">{transactions.length}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="h-64 rounded-xl bg-gray-800 animate-pulse" />
          ) : categoryTotals.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
              <p className="text-sm text-gray-500">No transactions for {monthLabel(month)}</p>
              <button onClick={() => setTab('transactions')} className="mt-2 text-xs text-brand-400 hover:text-brand-300">
                Add one
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Spending by Category</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryTotals} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                      labelStyle={{ color: '#e5e7eb' }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, 'Spent']}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {categoryTotals.map((c) => <Cell key={c.category} fill={CAT_COLORS[c.category] ?? '#6366f1'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {categoryTotals.map((c) => (
                      <tr key={c.category} className="hover:bg-gray-800/50">
                        <td className="px-4 py-2.5 text-gray-300">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[c.category] ?? '#6366f1' }} />
                            {c.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-right">{transactions.filter((t) => t.category === c.category).length}</td>
                        <td className="px-4 py-2.5 text-gray-200 text-right font-medium">${c.total.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-right">
                          {totalSpend > 0 ? `${((c.total / totalSpend) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Transactions tab */}
      {tab === 'transactions' && (
        <div className="space-y-4">
          {/* Manual add form */}
          <form onSubmit={handleAdd} className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-300">Add Transaction</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
              />
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="Amount"
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={!form.description || !form.amount || addMutation.isPending}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
          </form>

          {/* CSV import */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Import CSV</h3>
              {csvData && (
                <button
                  onClick={() => { setCsvData(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {!csvData ? (
              <label className="flex flex-col items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-700 px-4 py-6 hover:border-gray-600 transition-colors">
                <Upload size={18} className="text-gray-500" />
                <span className="text-sm text-gray-500">Click to upload a CSV file</span>
                <span className="text-xs text-gray-600">Any CSV with headers — you'll map columns after upload</span>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
              </label>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">{csvData.rows.length} rows detected — map columns below</p>

                {/* Column mapping */}
                <div className="grid grid-cols-2 gap-3">
                  <MappingSelect label="Date column" field="date" headers={csvData.headers} mapping={mapping} setMapping={setMapping} />
                  <MappingSelect label="Description column" field="description" headers={csvData.headers} mapping={mapping} setMapping={setMapping} />
                  <MappingSelect label="Amount column" field="amount" headers={csvData.headers} mapping={mapping} setMapping={setMapping} />
                  <MappingSelect label="Category column (optional)" field="category" headers={csvData.headers} mapping={mapping} setMapping={setMapping} />
                </div>

                {/* Preview */}
                {preview.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-gray-700">
                    <div className="px-3 py-2 bg-gray-800 text-xs text-gray-400">
                      Preview — first 5 rows ({preview.length} total will be imported)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="px-3 py-2 text-left text-gray-500">Date</th>
                            <th className="px-3 py-2 text-left text-gray-500">Description</th>
                            <th className="px-3 py-2 text-left text-gray-500">Category</th>
                            <th className="px-3 py-2 text-right text-gray-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {preview.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{row.date}</td>
                              <td className="px-3 py-2 text-gray-300 max-w-[200px] truncate">{row.description}</td>
                              <td className="px-3 py-2 text-gray-400">{row.category}</td>
                              <td className="px-3 py-2 text-gray-300 text-right">${row.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {preview.length === 0 && mapping.date && mapping.description && (
                  <p className="text-xs text-red-400">No valid rows found with the current mapping.</p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleImport}
                    disabled={preview.length === 0 || importMutation.isPending}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                  >
                    {importMutation.isPending ? 'Importing…' : `Import ${preview.length} transaction${preview.length !== 1 ? 's' : ''}`}
                  </button>
                  {importMutation.isSuccess && (
                    <span className="text-xs text-green-400">Imported successfully</span>
                  )}
                  {importMutation.isError && (
                    <span className="text-xs text-red-400">Import failed — check the console</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Transaction list */}
          {isLoading ? (
            <div className="h-32 rounded-xl bg-gray-800 animate-pulse" />
          ) : transactions.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
              <p className="text-sm text-gray-500">No transactions for {monthLabel(month)}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{tx.date}</td>
                      <td className="px-4 py-2.5 text-gray-200">{tx.description}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-gray-400">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[tx.category] ?? '#6366f1' }} />
                          {tx.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-200 text-right font-medium">${Number(tx.amount).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => deleteMutation.mutate(tx.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Year tab */}
      {tab === 'year' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total Spent</p>
              <p className="text-2xl font-semibold text-white mt-1">${yearTotal.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Monthly Avg</p>
              <p className="text-2xl font-semibold text-white mt-1">
                ${activeMonths > 0 ? (yearTotal / activeMonths).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Transactions</p>
              <p className="text-2xl font-semibold text-white mt-1">{yearTransactions.length}</p>
            </div>
          </div>

          {yearLoading ? (
            <div className="h-64 rounded-xl bg-gray-800 animate-pulse" />
          ) : yearTransactions.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
              <p className="text-sm text-gray-500">No transactions for {year}</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Monthly Spending</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                      labelStyle={{ color: '#e5e7eb' }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, 'Spent']}
                    />
                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h3 className="text-sm font-medium text-gray-300">Spending by Category</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {yearCategoryTotals.map((c) => (
                      <tr key={c.category} className="hover:bg-gray-800/50">
                        <td className="px-4 py-2.5 text-gray-300">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[c.category] ?? '#6366f1' }} />
                            {c.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-right">
                          {yearTransactions.filter((t) => t.category === c.category).length}
                        </td>
                        <td className="px-4 py-2.5 text-gray-200 text-right font-medium">${c.total.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-right">
                          {yearTotal > 0 ? `${((c.total / yearTotal) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
