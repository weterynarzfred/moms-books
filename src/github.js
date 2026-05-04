import { REPO_OWNER, REPO_NAME, DATA_FILE, BRANCH } from './config';

const BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}`;

function headers() {
  const token = localStorage.getItem('gh_token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
  };
}

async function fetchCurrentSha() {
  const res = await fetch(`${BASE}?ref=${BRANCH}`, { headers: headers() });
  if (!res.ok) return null;
  return (await res.json()).sha;
}

export async function loadBooks() {
  const res = await fetch(`${BASE}?ref=${BRANCH}`, { headers: headers() });
  if (res.status === 404) return { books: [], sha: null };
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = await res.json();
  const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, '')), c => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return { books: JSON.parse(json), sha: data.sha };
}

async function putBooks(encodedContent, sha) {
  const body = { message: 'Update books', content: encodedContent, branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(BASE, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return res;
}

export async function saveBooks(books, sha) {
  const json = JSON.stringify(books, null, 2);
  const content = btoa(unescape(encodeURIComponent(json)));

  let res = await putBooks(content, sha);

  if (res.status === 409) {
    const freshSha = await fetchCurrentSha();
    res = await putBooks(content, freshSha);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub ${res.status}`);
  }
  const data = await res.json();
  return data.content.sha;
}
