import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadBooks, saveBooks } from './github';
import AuthorInput from './AuthorInput';
import './App.css';

const COLS = [
  { key: 'author', label: 'Author', width: 160, textarea: false },
  { key: 'series', label: 'Series', width: 160, textarea: false },
  { key: 'series_number', label: '#', width: 60, textarea: false },
  { key: 'title', label: 'Title', width: 220, textarea: false },
  { key: 'note', label: 'Note', width: 320, textarea: true },
];

let _id = 0;
const mkRow = () => ({
  _id: ++_id,
  author: '',
  series: '',
  series_number: '',
  title: '',
  note: '',
});

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('gh_token') || '');
  const [input, setInput] = useState('');
  const [books, setBooks] = useState([]);
  const [sha, setSha] = useState(null);
  const [widths, setWidths] = useState(COLS.map(c => c.width));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    loadBooks()
      .then(({ books, sha }) => {
        setBooks(books.map(b => ({ ...b, _id: ++_id })));
        setSha(sha);
        setStatus('');
      })
      .catch(err => {
        setError(err.message);
        setStatus('');
      });
  }, [token]);

  const allAuthors = useMemo(
    () => [...new Set(books.map(b => b.author).filter(Boolean))],
    [books]
  );

  const update = useCallback((id, field, value) => {
    setBooks(prev => prev.map(b => b._id === id ? { ...b, [field]: value } : b));
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
    setBooks(prev => [...prev, mkRow()]);
    setDirty(true);
  };

  const delRow = (id) => {
    if (!window.confirm('Delete this row?')) return;
    setBooks(prev => prev.filter(b => b._id !== id));
    setDirty(true);
  };

  const save = async () => {
    setStatus('saving');
    setError(null);
    try {
      const clean = books.map(({ _id, ...rest }) => rest);
      const newSha = await saveBooks(clean, sha);
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
                      ? <AuthorInput
                        value={book.author}
                        onChange={v => update(book._id, 'author', v)}
                        allAuthors={allAuthors}
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
