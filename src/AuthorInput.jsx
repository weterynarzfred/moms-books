import { useState, useEffect, useRef } from 'react';

export default function AuthorInput({ value, onChange, allAuthors }) {
  const [suggestions, setSuggestions] = useState([]);
  const timerRef    = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const q = value.trim().toLowerCase();
      if (!q) { setSuggestions([]); return; }
      setSuggestions(allAuthors.filter(a => a !== value && a.toLowerCase().includes(q)));
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [value, allAuthors]);

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
