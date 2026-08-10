import { splitAliases, parseOptions, normalizeLabel } from './parser.js';
import { applySynonyms } from './synonyms.js';
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
 * Word-level Jaccard similarity.
 * Splits both strings on whitespace and computes |intersection| / |union|.
 * Good for catching token-overlap matches like "Years of Experience" vs
 * "Number of Years Experience".
 */
export function tokenJaccard(s1, s2) {
  const t1 = new Set(s1.split(/\s+/).filter(Boolean));
  const t2 = new Set(s2.split(/\s+/).filter(Boolean));
  if (t1.size === 0 && t2.size === 0) return 1.0;
  if (t1.size === 0 || t2.size === 0) return 0.0;

  let intersection = 0;
  for (const word of t1) {
    if (t2.has(word)) intersection++;
  }

  const union = t1.size + t2.size - intersection;
  return intersection / union;
}

/**
 * Proportional containment score.
 * If one string contains the other, returns shorter.length / longer.length.
 * Good for "LinkedIn" vs "LinkedIn URL" (returns ~0.73).
 */
export function containmentScore(s1, s2) {
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
  }
  return 0.0;
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
    const synonymNormalizedAliases = normalizedAliases.map((a) => applySynonyms(a));

    return {
      id: row.id,
      canonical,
      aliases,
      normalizedAliases,
      synonymNormalizedAliases,
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

  // Apply synonym normalization to the query so that e.g. "mobile number"
  // is treated as "phone number" when scoring against index entries.
  const synonymInput = applySynonyms(normalizedInput);

  const results = [];

  for (const entry of index) {
    let bestScore = 0;

    for (let i = 0; i < entry.normalizedAliases.length; i++) {
      const alias = entry.normalizedAliases[i];
      if (!alias) continue;

      // Tier 1: Exact match on normalized alias
      if (normalizedInput === alias) {
        bestScore = 1.0;
        break;
      }

      // Tier 2: Exact synonym match — both sides resolve to the same canonical
      // Use optional chaining: old cached index entries may not have this field.
      const synonymAlias = entry.synonymNormalizedAliases?.[i];
      if (synonymInput === synonymAlias && synonymInput !== normalizedInput) {
        // High confidence but distinct from a true exact match
        if (0.95 > bestScore) bestScore = 0.95;
      }

      // Tier 3: Combined fuzzy + structural signals
      const jw = jaroWinkler(normalizedInput, alias);
      const dice = diceCoefficient(normalizedInput, alias);
      const jaccard = tokenJaccard(normalizedInput, alias);
      const contain = containmentScore(normalizedInput, alias);
      const score = Math.max(jw, dice, jaccard, contain);
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
