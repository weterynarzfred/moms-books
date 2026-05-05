import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';

export default function SuggestInput({ value, onChange, allValues }) {
  const [suggestions, setSuggestions] = useState([]);
  const [focused, setFocused] = useState(false);
  const timerRef     = useRef(null);
  const containerRef = useRef(null);

  const fuse = useMemo(
    () => new Fuse(allValues, { threshold: 0.4, includeScore: false }),
    [allValues]
  );

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!focused) { setSuggestions([]); return; }
    timerRef.current = setTimeout(() => {
      const q = value.trim();
      if (!q) { setSuggestions([]); return; }
      const results = fuse.search(q).map(r => r.item).filter(a => a !== value);
      setSuggestions(results);
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [value, fuse, focused]);

  return (
    <div ref={containerRef} className="author-wrap">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setSuggestions([]); }}
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
