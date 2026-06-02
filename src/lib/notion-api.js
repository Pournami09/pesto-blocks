import { NOTION_VERSION, NOTION_BASE_URL, ANSWER_CHAR_LIMIT } from './constants.js';

class NotionError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'NotionError';
    this.status = status;
    this.code = code;
  }
}

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function notionFetch(token, path, options = {}) {
  const url = `${NOTION_BASE_URL}${path}`;
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : undefined;

  let response;
  try {
    response = await fetch(url, { method, headers: headers(token), body });
  } catch (err) {
    throw new NotionError(0, 'network_error', `Network error: ${err.message}`);
  }

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    try {
      response = await fetch(url, { method, headers: headers(token), body });
    } catch (err) {
      throw new NotionError(0, 'network_error', `Network error on retry: ${err.message}`);
    }
    if (response.status === 429) {
      throw new NotionError(429, 'rate_limited', 'Notion rate limit exceeded. Please try again in a moment.');
    }
  }

  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { code: 'unknown', message: response.statusText };
    }
    throw new NotionError(
      response.status,
      errorBody.code || 'unknown',
      errorBody.message || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

function extractRowData(page) {
  const questionParts = page.properties.Question?.title || [];
  const answerParts = page.properties.Answer?.rich_text || [];
  return {
    id: page.id,
    question: questionParts.map((rt) => rt.plain_text).join(''),
    answer: answerParts.map((rt) => rt.plain_text).join(''),
  };
}

/**
 * Query all rows from a Notion database, auto-paginating.
 * Returns an array of { id, question, answer }.
 */
export async function queryAllRows(token, dbId) {
  const rows = [];
  let startCursor = undefined;
  let hasMore = true;

  while (hasMore) {
    const body = {};
    if (startCursor) body.start_cursor = startCursor;

    const data = await notionFetch(token, `/databases/${dbId}/query`, {
      method: 'POST',
      body,
    });

    for (const page of data.results) {
      if (page.in_trash) continue;
      rows.push(extractRowData(page));
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return rows;
}

/**
 * Create a new page (Q+A row) in the database.
 */
export async function createPage(token, dbId, question, answer) {
  if (answer.length > ANSWER_CHAR_LIMIT) {
    throw new NotionError(0, 'content_too_long', `Answer exceeds ${ANSWER_CHAR_LIMIT} character limit (${answer.length} chars).`);
  }

  return notionFetch(token, '/pages', {
    method: 'POST',
    body: {
      parent: { database_id: dbId },
      properties: {
        Question: { title: [{ text: { content: question } }] },
        Answer: { rich_text: [{ text: { content: answer } }] },
      },
    },
  });
}

/**
 * Update the Answer cell on an existing page.
 * Used for merge (append option) and option delete (rewrite minus deleted).
 */
export async function updatePageAnswer(token, pageId, newAnswerText) {
  if (newAnswerText.length > ANSWER_CHAR_LIMIT) {
    throw new NotionError(0, 'content_too_long', `Answer exceeds ${ANSWER_CHAR_LIMIT} character limit (${newAnswerText.length} chars).`);
  }

  return notionFetch(token, `/pages/${pageId}`, {
    method: 'PATCH',
    body: {
      properties: {
        Answer: { rich_text: [{ text: { content: newAnswerText } }] },
      },
    },
  });
}

/**
 * Archive (trash) a page.
 */
export async function archivePage(token, pageId) {
  return notionFetch(token, `/pages/${pageId}`, {
    method: 'PATCH',
    body: { in_trash: true },
  });
}

/**
 * Create a new database with the Pesto schema under a parent page.
 * Seeds one example row demonstrating the numbered-bullet format.
 */
export async function createDatabase(token, parentPageId) {
  const db = await notionFetch(token, '/databases', {
    method: 'POST',
    body: {
      parent: { type: 'page_id', page_id: parentPageId },
      title: [{ type: 'text', text: { content: 'Pesto Answers' } }],
      properties: {
        Question: { title: {} },
        Answer: { rich_text: {} },
      },
    },
  });

  // Seed with example row
  await createPage(
    token,
    db.id,
    'Full name | Your name | Name',
    '1. Jane Doe'
  );

  return db;
}

/**
 * Search for pages the connection can access (for the create-DB-for-me parent page picker).
 */
export async function searchPages(token) {
  const data = await notionFetch(token, '/search', {
    method: 'POST',
    body: {
      filter: { property: 'object', value: 'page' },
      page_size: 20,
    },
  });

  return data.results.map((page) => {
    const titleParts = page.properties?.title?.title || [];
    let title = titleParts.map((rt) => rt.plain_text).join('');
    if (!title) {
      // Some pages store title differently
      for (const prop of Object.values(page.properties || {})) {
        if (prop.type === 'title' && prop.title?.length) {
          title = prop.title.map((rt) => rt.plain_text).join('');
          break;
        }
      }
    }
    return {
      id: page.id,
      title: title || 'Untitled',
    };
  });
}

/**
 * Test connection by querying the database with a 1-page limit and validating schema.
 * Returns { valid, dbName, rowCount, error }.
 */
export async function testConnection(token, dbId) {
  try {
    // First, retrieve the database metadata to check schema
    const dbMeta = await notionFetch(token, `/databases/${dbId}`, { method: 'GET' });

    const dbName = dbMeta.title?.map((rt) => rt.plain_text).join('') || 'Untitled';

    // Validate schema: must have Question (title) and Answer (rich_text)
    const props = dbMeta.properties || {};
    let hasQuestion = false;
    let hasAnswer = false;

    for (const [name, prop] of Object.entries(props)) {
      if (prop.type === 'title') {
        if (name === 'Question') {
          hasQuestion = true;
        } else {
          // Title column exists but isn't named "Question"
          return {
            valid: false,
            error: `Your database has a Title column named "${name}" — it must be named exactly "Question". Rename it in Notion and try again.`,
          };
        }
      }
      if (name === 'Answer') {
        if (prop.type === 'rich_text') {
          hasAnswer = true;
        } else {
          return {
            valid: false,
            error: `The "Answer" column exists but its type is "${prop.type}" — it must be "Text" (rich_text). Fix the type in Notion and try again.`,
          };
        }
      }
    }

    if (!hasQuestion) {
      return {
        valid: false,
        error: 'Your database is missing a Title column named "Question". Add one in Notion and try again.',
      };
    }
    if (!hasAnswer) {
      return {
        valid: false,
        error: 'Your database is missing a Text column named "Answer". Add one in Notion and try again.',
      };
    }

    // Query to get row count
    const queryResult = await notionFetch(token, `/databases/${dbId}/query`, {
      method: 'POST',
      body: { page_size: 1 },
    });

    // For row count, we'd need to paginate fully — approximate with has_more
    const rowCount = queryResult.results.length + (queryResult.has_more ? '+' : '');

    return {
      valid: true,
      dbName,
      rowCount: queryResult.has_more ? '100+' : String(queryResult.results.length),
    };
  } catch (err) {
    if (err instanceof NotionError) {
      if (err.status === 401) {
        return { valid: false, error: 'Invalid or expired token. Check that your installation access token is correct.' };
      }
      if (err.status === 404 || err.code === 'object_not_found') {
        return { valid: false, error: 'Database not found. Make sure the page containing this database is shared with your Pesto connection.' };
      }
      if (err.code === 'restricted_resource') {
        return { valid: false, error: 'Your connection doesn\'t have permission to access this database. Share the page with your Pesto connection via the "..." menu → "+ Add Connections".' };
      }
      if (err.code === 'unauthorized') {
        return { valid: false, error: 'Token unauthorized. Re-check your installation access token.' };
      }
      return { valid: false, error: err.message };
    }
    return { valid: false, error: `Unexpected error: ${err.message}` };
  }
}

/**
 * Extract a 32-char hex database ID from a Notion URL.
 * Handles both dashed and non-dashed formats.
 */
export function extractDbId(input) {
  const trimmed = input.trim();

  // Try to match a 32-char hex string (with or without dashes)
  const dashless = trimmed.replace(/-/g, '');
  const match = dashless.match(/([a-f0-9]{32})/i);
  if (match) {
    return match[1];
  }

  return null;
}
