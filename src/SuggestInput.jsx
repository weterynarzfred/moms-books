import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';

export default function SuggestInput({ value, onChange, allValues }) {
  const [suggestions, setSuggestions] = useState([]);
  const timerRef     = useRef(null);
  const containerRef = useRef(null);

  const fuse = useMemo(
    () => new Fuse(allValues, { threshold: 0.4, includeScore: false }),
    [allValues]
  );

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const q = value.trim();
      if (!q) { setSuggestions([]); return; }
      const results = fuse.search(q).map(r => r.item).filter(a => a !== value);
      setSuggestions(results);
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [value, fuse]);

  useEffect(() => {
    const hide = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        setSuggestions([]);
    };
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  return (
    <div ref={containerRef} className="author-wrap">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {suggestions.length > 0 && (
        <ul className="author-suggestions">
          {suggestions.map(a => (
            <li key={a} onMouseDown={() => { onChange(a); setSuggestions([]); }}>
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
