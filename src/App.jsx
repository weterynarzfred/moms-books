import { useState, useMemo, Fragment } from 'react';
import { useBooks } from './useBooks';
import SuggestInput from './SuggestInput';
import GroupHeaderInput from './GroupHeaderInput';
import './App.css';

const COLS = [
  { key: 'author', label: 'Author', width: 160, textarea: false },
  { key: 'series', label: 'Series', width: 160, textarea: false },
  { key: 'series_number', label: '#', width: 60, textarea: false },
  { key: 'title', label: 'Title', width: 220, textarea: false },
  { key: 'note', label: 'Note', width: 320, textarea: true },
];

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('gh_token') || '');
  const [tokenInput, setTokenInput] = useState('');
  const { books, dirty, status, error, update, renameGroup, addRow, delRow, save } = useBooks(token);
  const [widths, setWidths] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('col_widths'));
      if (Array.isArray(saved) && saved.length === COLS.length) return saved;
    } catch {}
    return COLS.map(c => c.width);
  });
  const [groupBy, setGroupBy] = useState(() => localStorage.getItem('group_by') || '');

  const allAuthors = useMemo(() => [...new Set(books.map(b => b.author).filter(Boolean))], [books]);
  const allSeries  = useMemo(() => [...new Set(books.map(b => b.series).filter(Boolean))],  [books]);

  const visibleCols = useMemo(
    () => groupBy ? COLS.filter(c => c.key !== groupBy) : COLS,
    [groupBy]
  );

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map();
    for (const book of books) {
      const key = book[groupBy] ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(book);
    }
    return [...map.entries()];
  }, [books, groupBy]);

  const handleGroupBy = (val) => {
    setGroupBy(val);
    localStorage.setItem('group_by', val);
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
        localStorage.setItem('col_widths', JSON.stringify(next));
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

  const submitToken = (e) => {
    e.preventDefault();
    const t = tokenInput.trim();
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
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder="ghp_..."
            autoFocus
          />
          <button type="submit">Continue</button>
        </form>
      </div>
    );
  }

  const renderCell = (book, col) => {
    if (col.key === 'author')
      return <SuggestInput value={book.author} onChange={v => update(book._id, 'author', v)} allValues={allAuthors} />;
    if (col.key === 'series')
      return <SuggestInput value={book.series} onChange={v => update(book._id, 'series', v)} allValues={allSeries} />;
    if (col.textarea)
      return <textarea value={book[col.key]} onChange={e => update(book._id, col.key, e.target.value)} rows={2} />;
    return <input type="text" value={book[col.key]} onChange={e => update(book._id, col.key, e.target.value)} />;
  };

  const renderRow = (book) => (
    <tr key={book._id}>
      {visibleCols.map(col => <td key={col.key}>{renderCell(book, col)}</td>)}
      <td className="del-cell">
        <button className="btn-del" onClick={() => delRow(book._id)}>×</button>
      </td>
    </tr>
  );

  return (
    <div className="app">
      <header className="topbar">
        <h1>Books</h1>
        <div className="topbar-right">
          <select className="group-select" value={groupBy} onChange={e => handleGroupBy(e.target.value)}>
            <option value="">no grouping</option>
            <option value="author">author</option>
            <option value="series">series</option>
          </select>
          {status === 'loading' && <span className="msg">Loading…</span>}
          {status === 'saving'  && <span className="msg">Saving…</span>}
          {status === 'saved'   && <span className="msg ok">Saved</span>}
          {error && <span className="msg err" title={error}>Error: {error}</span>}
          <button className="btn-save" onClick={save} disabled={!dirty || status === 'saving'}>
            save
          </button>
        </div>
      </header>

      <div className="table-wrap">
        <table>
          <colgroup>
            {visibleCols.map(col => <col key={col.key} style={{ width: widths[COLS.indexOf(col)] }} />)}
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              {visibleCols.map(col => (
                <th key={col.key}>
                  {col.label}
                  <span
                    className="rh"
                    onMouseDown={e => startResize(COLS.indexOf(col), e)}
                    onTouchStart={e => startResize(COLS.indexOf(col), e)}
                  />
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map(([groupName, groupBooks]) => (
                  <Fragment key={groupBooks[0]._id}>
                    <tr className="group-row">
                      <td colSpan={visibleCols.length + 1}>
                        <GroupHeaderInput
                          value={groupName}
                          onCommit={newName => renameGroup(groupBy, groupName, newName)}
                        />
                      </td>
                    </tr>
                    {groupBooks.map(renderRow)}
                  </Fragment>
                ))
              : books.map(renderRow)
            }
          </tbody>
        </table>
      </div>

      <button className="btn-add" onClick={addRow}>+ Add book</button>
    </div>
  );
}
