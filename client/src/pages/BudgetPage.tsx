import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ExternalLink } from 'lucide-react';

const SHEET_ID_KEY = 'budget_sheet_id';
const SHEET_TAB_KEY = 'budget_sheet_tab';

export default function BudgetPage() {
  const [sheetId, setSheetId] = useState(() => localStorage.getItem(SHEET_ID_KEY) ?? '');
  const [sheetTab, setSheetTab] = useState(() => localStorage.getItem(SHEET_TAB_KEY) ?? '');
  const [inputId, setInputId] = useState(sheetId);
  const [inputTab, setInputTab] = useState(sheetTab);
  const [saved, setSaved] = useState(!!sheetId);

  const { data, isLoading, error, refetch } = useQuery<{ title: string; sheets: string[]; values: string[][] }>({
    queryKey: ['budget', sheetId, sheetTab],
    queryFn: () =>
      sheetTab
        ? api.get(`/sheets/${sheetId}/tab/${encodeURIComponent(sheetTab)}`)
        : api.get(`/sheets/${sheetId}`),
    enabled: saved && !!sheetId,
    select: (d) => d,
  });

  function save() {
    localStorage.setItem(SHEET_ID_KEY, inputId);
    localStorage.setItem(SHEET_TAB_KEY, inputTab);
    setSheetId(inputId);
    setSheetTab(inputTab);
    setSaved(true);
  }

  const values: string[][] = (data as any)?.values ?? [];
  const headers = values[0] ?? [];
  const rows = values.slice(1);

  const chartData = buildChartData(headers, rows);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Budget</h1>
          {(data as any)?.title && <p className="text-sm text-gray-500">{(data as any).title}</p>}
        </div>
        {sheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300"
          >
            Open in Sheets <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Sheet config */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Google Sheet connection</h3>
        <p className="text-xs text-gray-500">
          Paste your spreadsheet ID from the URL:{' '}
          <span className="text-gray-400">docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit</span>
        </p>
        <div className="flex gap-2">
          <input
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            placeholder="Spreadsheet ID"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
          />
          <input
            value={inputTab}
            onChange={(e) => setInputTab(e.target.value)}
            placeholder="Tab name (optional)"
            className="w-40 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
          />
          <button onClick={save} disabled={!inputId} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            Load
          </button>
        </div>
        {(data as any)?.sheets && (
          <p className="text-xs text-gray-500">
            Available tabs: {(data as any).sheets.join(', ')}
          </p>
        )}
      </div>

      {isLoading && <div className="h-64 rounded-xl bg-gray-800 animate-pulse" />}
      {error && <p className="text-sm text-red-400">Failed to load spreadsheet. Check the ID and sharing settings.</p>}
      {!isLoading && !error && data && values.length === 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center space-y-1">
          <p className="text-sm text-gray-400">Sheet connected but no data found.</p>
          <p className="text-xs text-gray-600">Make sure data starts at cell A1{sheetTab ? ` on the "${sheetTab}" tab` : ''}, or try a different tab name.</p>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Summary</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#a5b4fc' }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-gray-800/50">
                    {headers.map((_, ci) => (
                      <td key={ci} className="px-4 py-2.5 text-gray-300 whitespace-nowrap">
                        {row[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function buildChartData(headers: string[], rows: string[][]): { label: string; value: number }[] {
  if (!headers.length || !rows.length) return [];

  const numericCols = headers.reduce<number[]>((acc, _, ci) => {
    const vals = rows.map((r) => r[ci]).filter(Boolean);
    const numeric = vals.filter((v) => !isNaN(parseFloat(v.replace(/[$,]/g, ''))));
    if (numeric.length > rows.length * 0.5) acc.push(ci);
    return acc;
  }, []);

  if (numericCols.length === 0) return [];

  const colIndex = numericCols[numericCols.length - 1];
  const labelIndex = 0;

  return rows
    .map((row) => ({
      label: row[labelIndex] ?? '',
      value: parseFloat((row[colIndex] ?? '0').replace(/[$,]/g, '')) || 0,
    }))
    .filter((d) => d.label && d.value !== 0)
    .slice(0, 20);
}
