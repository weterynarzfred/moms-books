import Database from 'better-sqlite3';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

const DB_PATH = 'H:/proton/My files/books/metadata.db';
const OUTPUT_PATH = 'books.json';

const db = new Database(DB_PATH, { readonly: true });

const mamaCol = db.prepare("SELECT id FROM custom_columns WHERE label = 'mama'").get();
if (!mamaCol) {
  console.error('Custom column "mama" not found in calibre db');
  process.exit(1);
}

const mamaValues = db.prepare(`SELECT book, value FROM custom_column_${mamaCol.id}`).all();
const mamaMap = new Map(mamaValues.map(r => [r.book, Boolean(r.value)]));

const rows = db.prepare(`
  SELECT
    b.id,
    b.title,
    b.series_index,
    GROUP_CONCAT(a.name, ', ') AS authors,
    s.name AS series
  FROM books b
  JOIN books_languages_link bll ON bll.book = b.id
  JOIN languages l ON l.id = bll.lang_code AND l.lang_code = 'pol'
  LEFT JOIN books_authors_link bal ON bal.book = b.id
  LEFT JOIN authors a ON a.id = bal.author
  LEFT JOIN books_series_link bsl ON bsl.book = b.id
  LEFT JOIN series s ON s.id = bsl.series
  GROUP BY b.id
`).all();

db.close();

const existing = existsSync(OUTPUT_PATH)
  ? JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
  : [];

const bookKey = b => `${b.author}|${b.series}|${b.series_number}|${b.title}`;
const existingKeys = new Set(existing.map(bookKey));

const newBooks = rows
  .map(row => ({
    available: true,
    uploaded: mamaMap.get(row.id) ?? false,
    read: false,
    author: row.authors ?? '',
    series: row.series ?? '',
    series_number: row.series_index ?? '',
    title: row.title,
    note: '',
    id: randomUUID(),
    lastEdit: 0,
  }))
  .filter(b => !existingKeys.has(bookKey(b)));

const books = [...existing, ...newBooks];

writeFileSync(OUTPUT_PATH, JSON.stringify(books, null, 2));
console.log(`Added ${newBooks.length} books (${existing.length} existing, ${books.length} total) → ${OUTPUT_PATH}`);
