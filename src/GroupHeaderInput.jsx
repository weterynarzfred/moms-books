import { useState, useEffect } from 'react';

export default function GroupHeaderInput({ value, onCommit }) {
  const [val, setVal] = useState(value);
  useEffect(() => { setVal(value); }, [value]);
  return (
    <input
      className="group-input"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== value) onCommit(val); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}
