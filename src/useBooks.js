import { useState, useEffect, useCallback, useRef } from 'react';
import { loadBooks, saveBooks } from './github';
import { ensureFields, mergeBooks } from './merge';

let _id = 0;

const _draft = (() => {
  try { return JSON.parse(localStorage.getItem('books_draft')); } catch { return null; }
})();
const _hasDirtyDraft = _draft?.dirty === true;

export const mkRow = () => ({
  _id: ++_id,
  id: crypto.randomUUID(),
  lastEdit: Date.now(),
  author: '',
  series: '',
  series_number: '',
  title: '',
  note: '',
});

export function useBooks(token) {
  const [books, setBooks] = useState(() =>
    _hasDirtyDraft ? ensureFields(_draft.books).map(b => ({ ...b, _id: ++_id })) : []
  );
  const [sha, setSha] = useState(_hasDirtyDraft ? _draft.sha : null);
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

  const update = useCallback((rowId, field, value) => {
    setBooks(prev => prev.map(b => {
      if (b._id !== rowId) return b;
      dirtyIdsRef.current = new Set([...dirtyIdsRef.current, b.id]);
      return { ...b, [field]: value, lastEdit: Date.now() };
    }));
    setDirty(true);
  }, []);

  const renameGroup = useCallback((field, oldName, newName) => {
    if (oldName === newName) return;
    setBooks(prev => prev.map(b => {
      if (b[field] !== oldName) return b;
      dirtyIdsRef.current = new Set([...dirtyIdsRef.current, b.id]);
      return { ...b, [field]: newName, lastEdit: Date.now() };
    }));
    setDirty(true);
  }, []);

  const addRow = useCallback(() => {
    const row = mkRow();
    dirtyIdsRef.current = new Set([...dirtyIdsRef.current, row.id]);
    setBooks(prev => [...prev, row]);
    setDirty(true);
  }, []);

  const delRow = useCallback((rowId) => {
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
  }, []);

  const save = useCallback(async () => {
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
  }, [books, sha]);

  return { books, dirty, status, error, update, renameGroup, addRow, delRow, save };
}
