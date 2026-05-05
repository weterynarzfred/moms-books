import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useBooks } from './useBooks';
import SuggestInput from './SuggestInput';
import GroupHeaderInput from './GroupHeaderInput';
import './App.css';

const COLS = [
  { key: 'author', label: 'Author', width: 160, textarea: false, sortable: true },
  { key: 'series', label: 'Series', width: 160, textarea: false, sortable: true },
  { key: 'series_number', label: '#', width: 60, textarea: false },
  { key: 'title', label: 'Title', width: 220, textarea: false, sortable: true },
  { key: 'note', label: 'Note', width: 320, textarea: true },
];

const SORT_DEFAULT = { key: 'author', dir: 1 };

const bookData = (b) =>
  JSON.stringify([b.author, b.series, b.series_number, b.title, b.note]);

function cmpStr(a, b) {
  const av = (a ?? '').toLowerCase();
  const bv = (b ?? '').toLowerCase();
  if (av === '' && bv === '') return 0;
  if (av === '') return 1;
  if (bv === '') return -1;
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function cmpNum(a, b) {
  const an = parseFloat(a);
  const bn = parseFloat(b);
  if (isNaN(an) && isNaN(bn)) return 0;
  if (isNaN(an)) return 1;
  if (isNaN(bn)) return -1;
  return an - bn;
}

function sortBooks(books, sort) {
  return [...books].sort((a, b) => {
    const av = (a[sort.key] ?? '').toLowerCase();
    const bv = (b[sort.key] ?? '').toLowerCase();
    if (av === '' && bv !== '') return 1;
    if (bv === '' && av !== '') return -1;
    const primary = (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    if (primary !== 0) return primary;
    if (sort.key === 'author') {
      const bySeries = cmpStr(a.series, b.series);
      if (bySeries !== 0) return bySeries;
    }
    if (sort.key === 'author' || sort.key === 'series') {
      return cmpNum(a.series_number, b.series_number);
    }
    return 0;
  });
}

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
  const [sort, setSort] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('sort'));
      if (s?.key) return s;
    } catch {}
    return SORT_DEFAULT;
  });

  const allAuthors = useMemo(() => [...new Set(books.map(b => b.author).filter(Boolean))], [books]);
  const allSeries  = useMemo(() => [...new Set(books.map(b => b.series).filter(Boolean))],  [books]);

  const sortedBooks = useMemo(() => sortBooks(books, sort), [books, sort]);

  const [frozenOrder, setFrozenOrder]           = useState(null);
  const [recentlyEditedId, setRecentlyEditedId] = useState(null);
  const blurTimerRef     = useRef(null);
  const isFrozenRef      = useRef(false);
  const focusSnapshotRef = useRef(null);

  const displayedBooks = useMemo(() => {
    if (!frozenOrder) return sortedBooks;
    const byId = new Map(books.map(b => [b._id, b]));
    return frozenOrder.map(id => byId.get(id)).filter(Boolean);
  }, [frozenOrder, books, sortedBooks]);

  useEffect(() => {
    if (!recentlyEditedId) return;
    const el = document.querySelector(`tr[data-id="${recentlyEditedId}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const t = setTimeout(() => setRecentlyEditedId(null), 5000);
    return () => clearTimeout(t);
  }, [recentlyEditedId]);

  const handleCellFocus = (book) => {
    clearTimeout(blurTimerRef.current);
    if (!isFrozenRef.current) {
      isFrozenRef.current = true;
      focusSnapshotRef.current = bookData(book);
      setFrozenOrder(sortedBooks.map(b => b._id));
    }
  };

  const handleCellBlur = (book) => {
    blurTimerRef.current = setTimeout(() => {
      const changed = bookData(book) !== focusSnapshotRef.current;
      isFrozenRef.current = false;
      focusSnapshotRef.current = null;
      setFrozenOrder(null);
      if (changed) setRecentlyEditedId(book._id);
    }, 0);
  };

  const visibleCols = useMemo(
    () => groupBy ? COLS.filter(c => c.key !== groupBy) : COLS,
    [groupBy]
  );

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map();
    for (const book of displayedBooks) {
      const key = book[groupBy] ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(book);
    }
    return [...map.entries()];
  }, [displayedBooks, groupBy]);

  const handleGroupBy = (val) => {
    setGroupBy(val);
    localStorage.setItem('group_by', val);
  };

  const handleSort = (key) => {
    setSort(prev => {
      const next = prev.key === key ? { key, dir: -prev.dir } : { key, dir: 1 };
      localStorage.setItem('sort', JSON.stringify(next));
      return next;
    });
  };

  const startResize = (colIdx, e) => {
    e.preventDefault();
    e.stopPropagation();
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
    <tr
      key={book._id}
      data-id={book._id}
      className={recentlyEditedId === book._id ? 'row-edited' : undefined}
      onFocus={() => handleCellFocus(book)}
      onBlur={() => handleCellBlur(book)}
    >
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
                <th
                  key={col.key}
                  className={col.sortable ? 'sortable' : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && sort.key === col.key && (
                    <span className="sort-arrow">{sort.dir === 1 ? ' ↑' : ' ↓'}</span>
                  )}
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
              : displayedBooks.map(renderRow)
            }
          </tbody>
        </table>
      </div>

      <button className="btn-add" onClick={addRow}>+ Add book</button>
    </div>
  );
}
