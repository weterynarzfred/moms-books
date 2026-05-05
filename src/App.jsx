import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadBooks, saveBooks } from './github';
import SuggestInput from './SuggestInput';
import './App.css';

const COLS = [
  { key: 'author', label: 'Author', width: 160, textarea: false },
  { key: 'series', label: 'Series', width: 160, textarea: false },
  { key: 'series_number', label: '#', width: 60, textarea: false },
  { key: 'title', label: 'Title', width: 220, textarea: false },
  { key: 'note', label: 'Note', width: 320, textarea: true },
];

let _id = 0;

// Deterministic ID for entries that don't have one yet (migration).
// Content-hash so same entry gets same ID on every device.
function contentId(b) {
  const s = JSON.stringify([b.author, b.series, b.series_number, b.title, b.note]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return 'c' + (h >>> 0).toString(36);
}

function ensureFields(books) {
  return books.map(b => ({
    ...b,
    id: b.id || contentId(b),
    lastEdit: b.lastEdit || 0,
  }));
}

function mergeBooks(localBooks, dirtyIds, tombstones, fetchedBooks) {
  const dirtySet = new Set(dirtyIds);
  const fetchedById = new Map(fetchedBooks.map(b => [b.id, b]));
  const localById = new Map(localBooks.map(b => [b.id, b]));
  const result = [];
  const remainingDirtyIds = new Set();
  const remainingTombstones = {};

  for (const fb of fetchedBooks) {
    const tombstoneTime = tombstones[fb.id];
    const lb = localById.get(fb.id);

    if (tombstoneTime !== undefined) {
      if (fb.lastEdit > tombstoneTime) {
        result.push(fb); // re-added remotely after local delete → restore
      } else {
        remainingTombstones[fb.id] = tombstoneTime; // local delete still wins
      }
    } else if (lb && dirtySet.has(fb.id)) {
      if (lb.lastEdit >= fb.lastEdit) {
        result.push(lb);
        remainingDirtyIds.add(lb.id);
      } else {
        result.push(fb); // remote is newer
      }
    } else if (lb) {
      // Local is clean → remote wins (may have newer remote edit)
      result.push(fb);
    } else {
      // Not in local at all → new on remote, add it
      result.push(fb);
    }
  }

  // Local-only dirty entries (created locally, not yet on remote)
  for (const lb of localBooks) {
    if (dirtySet.has(lb.id) && !fetchedById.has(lb.id)) {
      result.push(lb);
      remainingDirtyIds.add(lb.id);
    }
  }

  return {
    books: result,
    dirtyIds: [...remainingDirtyIds],
    tombstones: remainingTombstones,
    dirty: remainingDirtyIds.size > 0 || Object.keys(remainingTombstones).length > 0,
  };
}

const _draft = (() => {
  try { return JSON.parse(localStorage.getItem('books_draft')); } catch { return null; }
})();
const _hasDirtyDraft = _draft?.dirty === true;

const mkRow = () => ({
  _id: ++_id,
  id: crypto.randomUUID(),
  lastEdit: Date.now(),
  author: '',
  series: '',
  series_number: '',
  title: '',
  note: '',
});

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('gh_token') || '');
  const [input, setInput] = useState('');
  const [books, setBooks] = useState(() =>
    _hasDirtyDraft ? ensureFields(_draft.books).map(b => ({ ...b, _id: ++_id })) : []
  );
  const [sha, setSha] = useState(_hasDirtyDraft ? _draft.sha : null);
  const [widths, setWidths] = useState(COLS.map(c => c.width));
  const [dirty, setDirty] = useState(_hasDirtyDraft);
  const [status, setStatus] = useState(_hasDirtyDraft ? '' : 'loading');
  const [error, setError] = useState(null);

  const dirtyIdsRef = useRef(new Set(_hasDirtyDraft ? (_draft.dirtyIds || []) : []));
  const tombstonesRef = useRef(_hasDirtyDraft ? (_draft.tombstones || {}) : {});

  useEffect(() => {
    if (!token) return;
    loadBooks()
      .then(({ books: fetched, sha: fetchedSha }) => {
        const withFields = ensureFields(fetched);
        if (_hasDirtyDraft) {
          const { books: merged, dirtyIds, tombstones, dirty: mergedDirty } = mergeBooks(
            ensureFields(_draft.books),
            [...dirtyIdsRef.current],
            tombstonesRef.current,
            withFields
          );
          setBooks(merged.map(b => ({ ...b, _id: ++_id })));
          setSha(fetchedSha);
          dirtyIdsRef.current = new Set(dirtyIds);
          tombstonesRef.current = tombstones;
          setDirty(mergedDirty);
        } else {
          setBooks(withFields.map(b => ({ ...b, _id: ++_id })));
          setSha(fetchedSha);
        }
        setStatus('');
      })
      .catch(err => {
        setError(err.message);
        setStatus('');
      });
  }, [token]);

  useEffect(() => {
    const clean = books.map(({ _id, ...rest }) => rest);
    localStorage.setItem('books_draft', JSON.stringify({
      books: clean,
      sha,
      dirty,
      dirtyIds: [...dirtyIdsRef.current],
      tombstones: tombstonesRef.current,
    }));
  }, [books, sha, dirty]);

  const allAuthors = useMemo(
    () => [...new Set(books.map(b => b.author).filter(Boolean))],
    [books]
  );

  const allSeries = useMemo(
    () => [...new Set(books.map(b => b.series).filter(Boolean))],
    [books]
  );

  const update = useCallback((rowId, field, value) => {
    setBooks(prev => prev.map(b => {
      if (b._id !== rowId) return b;
      dirtyIdsRef.current = new Set([...dirtyIdsRef.current, b.id]);
      return { ...b, [field]: value, lastEdit: Date.now() };
    }));
    setDirty(true);
  }, []);

  const submitToken = (e) => {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    localStorage.setItem('gh_token', t);
    setToken(t);
  };

  if (!token) {
    return (
      <div className="token-screen">
        <form onSubmit={submitToken} className="token-form">
          <label htmlFor="pat">GitHub Personal Access Token</label>
          <input
            id="pat"
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="ghp_..."
            autoFocus
          />
          <button type="submit">Continue</button>
        </form>
      </div>
    );
  }

  const addRow = () => {
    const row = mkRow();
    dirtyIdsRef.current = new Set([...dirtyIdsRef.current, row.id]);
    setBooks(prev => [...prev, row]);
    setDirty(true);
  };

  const delRow = (rowId) => {
    if (!window.confirm('Delete this row?')) return;
    setBooks(prev => {
      const book = prev.find(b => b._id === rowId);
      if (book) {
        tombstonesRef.current = { ...tombstonesRef.current, [book.id]: Date.now() };
        dirtyIdsRef.current.delete(book.id);
      }
      return prev.filter(b => b._id !== rowId);
    });
    setDirty(true);
  };

  const save = async () => {
    setStatus('saving');
    setError(null);
    try {
      const clean = books.map(({ _id, ...rest }) => rest);
      const newSha = await saveBooks(clean, sha);
      dirtyIdsRef.current = new Set();
      tombstonesRef.current = {};
      setSha(newSha);
      setDirty(false);
      setStatus('saved');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setError(err.message);
      setStatus('');
    }
  };

  const startResize = (colIdx, e) => {
    e.preventDefault();
    const x0 = e.touches ? e.touches[0].clientX : e.clientX;
    const w0 = widths[colIdx];
    const onMove = (e) => {
      e.preventDefault();
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      setWidths(prev => {
        const next = [...prev];
        next[colIdx] = Math.max(40, w0 + x - x0);
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Books</h1>
        <div className="topbar-right">
          {status === 'loading' && <span className="msg">Loading…</span>}
          {status === 'saving' && <span className="msg">Saving…</span>}
          {status === 'saved' && <span className="msg ok">Saved</span>}
          {error && <span className="msg err" title={error}>Error: {error}</span>}
          <button
            className="btn-save"
            onClick={save}
            disabled={!dirty || status === 'saving'}
          >
            save
          </button>
        </div>
      </header>

      <div className="table-wrap">
        <table>
          <colgroup>
            {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              {COLS.map((col, i) => (
                <th key={col.key}>
                  {col.label}
                  <span className="rh" onMouseDown={e => startResize(i, e)} onTouchStart={e => startResize(i, e)} />
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {books.map(book => (
              <tr key={book._id}>
                {COLS.map(col => (
                  <td key={col.key}>
                    {col.key === 'author'
                      ? <SuggestInput
                          value={book.author}
                          onChange={v => update(book._id, 'author', v)}
                          allValues={allAuthors}
                        />
                      : col.key === 'series'
                      ? <SuggestInput
                          value={book.series}
                          onChange={v => update(book._id, 'series', v)}
                          allValues={allSeries}
                        />
                      : col.textarea
                        ? <textarea
                            value={book[col.key]}
                            onChange={e => update(book._id, col.key, e.target.value)}
                            rows={2}
                          />
                        : <input
                            type="text"
                            value={book[col.key]}
                            onChange={e => update(book._id, col.key, e.target.value)}
                          />
                    }
                  </td>
                ))}
                <td className="del-cell">
                  <button className="btn-del" onClick={() => delRow(book._id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn-add" onClick={addRow}>+ Add book</button>
    </div>
  );
}
