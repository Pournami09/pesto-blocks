// Message types: Content script -> Service worker
export const MSG_MATCH_FIELD = 'MATCH_FIELD';
export const MSG_SAVE_ANSWER = 'SAVE_ANSWER';
export const MSG_DELETE_OPTION = 'DELETE_OPTION';
export const MSG_ARCHIVE_ROW = 'ARCHIVE_ROW';
export const MSG_GET_CONNECTION_STATUS = 'GET_CONNECTION_STATUS';
export const MSG_UPDATE_RECENTS = 'UPDATE_RECENTS';

// Message types: Popup / Onboarding -> Service worker
export const MSG_TEST_CONNECTION = 'TEST_CONNECTION';
export const MSG_SET_TOKEN = 'SET_TOKEN';
export const MSG_SET_DATABASE = 'SET_DATABASE';
export const MSG_CREATE_DATABASE = 'CREATE_DATABASE';
export const MSG_SEARCH_PAGES = 'SEARCH_PAGES';
export const MSG_SET_TRIGGER_MODE = 'SET_TRIGGER_MODE';
export const MSG_GET_RECENTS = 'GET_RECENTS';
export const MSG_ADD_SITE = 'ADD_SITE';
export const MSG_REMOVE_SITE = 'REMOVE_SITE';
export const MSG_REFRESH_CACHE = 'REFRESH_CACHE';
export const MSG_CLEAR_CACHE = 'CLEAR_CACHE';
export const MSG_LOCK = 'LOCK';
export const MSG_GET_STATE = 'GET_STATE';
export const MSG_ARM_TAB = 'ARM_TAB';
export const MSG_REGISTER_SCRIPTS = 'REGISTER_SCRIPTS';
export const MSG_PIN_RECENT = 'PIN_RECENT';
export const MSG_UNPIN_RECENT = 'UNPIN_RECENT';
export const MSG_DISMISS_RECENT = 'DISMISS_RECENT';
export const MSG_SEARCH_DATABASES = 'SEARCH_DATABASES';
export const MSG_SWITCH_DATABASE = 'SWITCH_DATABASE';

// Storage keys
export const STORAGE_TOKEN = 'pesto_token';
export const STORAGE_DB_ID = 'pesto_db_id';
export const STORAGE_DB_NAME = 'pesto_db_name';
export const STORAGE_CACHE = 'pesto_cache';
export const STORAGE_CACHE_TS = 'pesto_cache_ts';
export const STORAGE_TRIGGER_MODE = 'pesto_trigger_mode';
export const STORAGE_ALLOWLIST = 'pesto_allowlist';
export const STORAGE_RECENTS = 'pesto_recents';
export const STORAGE_ARMED_TABS = 'pesto_armed_tabs';
export const STORAGE_PINNED = 'pesto_pinned';
export const STORAGE_DB_PARENT = 'pesto_db_parent';

// Trigger modes
export const MODE_AUTO_ALL = 1;
export const MODE_AUTO_ALLOWLIST = 2;
export const MODE_CLICK_TO_ARM = 3;

// Cache
export const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Notion API
export const NOTION_VERSION = '2022-06-28';
export const NOTION_BASE_URL = 'https://api.notion.com/v1';

// Matching
export const FUZZY_THRESHOLD = 0.75;
export const MERGE_THRESHOLD = 0.85;
export const ANSWER_CHAR_LIMIT = 2000;
export const ANSWER_WARN_LIMIT = 1500;

// Recents
export const MAX_RECENTS = 10;

// Alarm names
export const ALARM_CACHE_TTL = 'pesto-cache-ttl';

// Seeded allowlist for Mode 2
export const SEEDED_ALLOWLIST = [
  { domain: 'greenhouse.io', patterns: ['https://*.greenhouse.io/*', 'https://job-boards.greenhouse.io/*'], label: 'Greenhouse' },
  { domain: 'lever.co', patterns: ['https://jobs.lever.co/*'], label: 'Lever' },
  { domain: 'ashbyhq.com', patterns: ['https://jobs.ashbyhq.com/*'], label: 'Ashby' },
  { domain: 'myworkdayjobs.com', patterns: ['https://*.myworkdayjobs.com/*'], label: 'Workday' },
  { domain: 'workday.com', patterns: ['https://*.workday.com/*'], label: 'Workday (alt)' },
  { domain: 'linkedin.com', patterns: ['https://www.linkedin.com/jobs/*'], label: 'LinkedIn' },
  { domain: 'wellfound.com', patterns: ['https://wellfound.com/*'], label: 'Wellfound' },
];
