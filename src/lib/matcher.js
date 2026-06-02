import { splitAliases, parseOptions, normalizeLabel } from './parser.js';
import { FUZZY_THRESHOLD } from './constants.js';

/**
 * Jaro similarity between two strings.
 */
function jaro(s1, s2) {
  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
  );
}

/**
 * Jaro-Winkler similarity with prefix bonus.
 */
export function jaroWinkler(s1, s2) {
  const jaroSim = jaro(s1, s2);

  // Common prefix up to 4 characters
  let prefixLen = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefixLen++;
    } else {
      break;
    }
  }

  const p = 0.1; // Winkler scaling factor
  return jaroSim + prefixLen * p * (1 - jaroSim);
}

/**
 * Sorensen-Dice coefficient on character bigrams.
 */
export function diceCoefficient(s1, s2) {
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams1.get(bigram);
    if (count && count > 0) {
      bigrams1.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (s1.length - 1 + (s2.length - 1));
}

/**
 * Build a search index from raw Notion rows.
 * Input: array of { id, question, answer }
 * Output: array of { id, canonical, aliases, normalizedAliases, options }
 */
export function buildIndex(rows) {
  return rows.map((row) => {
    const { canonical, aliases } = splitAliases(row.question);
    const options = parseOptions(row.answer);
    const normalizedAliases = aliases.map((a) => normalizeLabel(a));

    return {
      id: row.id,
      canonical,
      aliases,
      normalizedAliases,
      options,
      rawAnswer: row.answer,
    };
  });
}

/**
 * Find matching questions for an extracted label.
 * Returns array of { id, canonical, options, confidence, rawAnswer } sorted by confidence desc.
 */
export function findMatches(extractedLabel, index, threshold = FUZZY_THRESHOLD) {
  if (!extractedLabel || !index || index.length === 0) return [];

  const normalizedInput = normalizeLabel(extractedLabel);
  if (!normalizedInput) return [];

  const results = [];

  for (const entry of index) {
    let bestScore = 0;

    for (const alias of entry.normalizedAliases) {
      if (!alias) continue;

      // Tier 1: Exact match
      if (normalizedInput === alias) {
        bestScore = 1.0;
        break;
      }

      // Tier 2: Fuzzy match
      const jw = jaroWinkler(normalizedInput, alias);
      const dice = diceCoefficient(normalizedInput, alias);
      const score = Math.max(jw, dice);
      if (score > bestScore) {
        bestScore = score;
      }
    }

    if (bestScore >= threshold) {
      results.push({
        id: entry.id,
        canonical: entry.canonical,
        options: entry.options,
        confidence: bestScore,
        rawAnswer: entry.rawAnswer,
      });
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}
