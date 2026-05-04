import { GITHUB_TOKEN, REPO_OWNER, REPO_NAME, DATA_FILE, BRANCH } from './config';

const BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}`;
const HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  'Content-Type': 'application/json',
  Accept: 'application/vnd.github+json',
};

export async function loadBooks() {
  const res = await fetch(`${BASE}?ref=${BRANCH}`, { headers: HEADERS });
  if (res.status === 404) return { books: [], sha: null };
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = await res.json();
  const json = atob(data.content.replace(/\s/g, ''));
  return { books: JSON.parse(json), sha: data.sha };
}

export async function saveBooks(books, sha) {
  const json = JSON.stringify(books, null, 2);
  const content = btoa(unescape(encodeURIComponent(json)));
  const body = { message: 'Update books', content, branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(BASE, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub ${res.status}`);
  }
  const data = await res.json();
  return data.content.sha;
}
