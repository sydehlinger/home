export type Ownership = 'owned' | 'none';

export interface BookRecord {
  id: number;
  title: string;
  author: string | null;
  isbn: string | null;
  formats: string[];
  status: string;
  cover_url: string | null;
  rating: number | null;
  pages: number | null;
  notes: string | null;
  date_finished: number | null;
  ownership: Ownership;
  created_at: number;
  updated_at: number;
}

export function parseBook(raw: any): BookRecord {
  let formats: string[] = ['physical'];
  try {
    const parsed = JSON.parse(raw.formats ?? '["physical"]');
    if (Array.isArray(parsed) && parsed.length > 0) formats = parsed;
  } catch {}
  const ownership: Ownership = raw.ownership === 'owned' ? 'owned' : 'none';
  return { ...raw, formats, ownership };
}
