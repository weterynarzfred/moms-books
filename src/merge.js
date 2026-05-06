export function contentId(b) {
  const s = JSON.stringify([b.author, b.series, b.series_number, b.title]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return 'c' + (h >>> 0).toString(36);
}

export function ensureFields(books) {
  return books.map(b => ({
    available: false,
    uploaded: false,
    read: false,
    ...b,
    id: b.id || contentId(b),
    lastEdit: b.lastEdit || 0,
  }));
}

export function mergeBooks(localBooks, dirtyIds, tombstones, fetchedBooks) {
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
        result.push(fb);
      } else {
        remainingTombstones[fb.id] = tombstoneTime;
      }
    } else if (lb && dirtySet.has(fb.id)) {
      if (lb.lastEdit >= fb.lastEdit) {
        result.push(lb);
        remainingDirtyIds.add(lb.id);
      } else {
        result.push(fb);
      }
    } else {
      result.push(fb);
    }
  }

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
