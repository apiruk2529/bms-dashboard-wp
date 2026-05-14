// =============================================================================
// Charset Encoding Utility - Fix common encoding issues with Thai text
// =============================================================================

/**
 * Detects if a string appears to have UTF-8 encoding issues (mojibake).
 * Thai text encoded as latin1 but interpreted as UTF-8 produces specific patterns.
 *
 * @returns true if the string likely has encoding issues
 */
export function hasEncodingIssues(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Check for replacement character (U+FFFD) which indicates encoding problems
  if (text.includes('\uFFFD')) {
    return true;
  }

  // Check for high percentage of replacement chars or ASCII substitute chars
  if (text.includes('?') && text.length > 2) {
    // If more than 30% of string is question marks, likely encoding issue
    const questionMarkRatio = (text.match(/\?/g) || []).length / text.length;
    if (questionMarkRatio > 0.3) {
      return true;
    }
  }

  // Check for common mojibake patterns in Thai:
  // - High percentage of chars in the latin-1 supplement range
  const latinSupplementChars = text.match(/[\u0080-\u00FF]/g);
  if (latinSupplementChars && latinSupplementChars.length > text.length * 0.3) {
    return true;
  }

  return false;
}

/**
 * Attempts to fix UTF-8 encoding issues by re-interpreting mis-encoded bytes.
 * Handles:
 * - Latin-1 bytes interpreted as UTF-8
 * - Question mark placeholders from failed decoding
 *
 * @param text - The potentially mis-encoded text
 * @returns The corrected text, or original if unable to fix
 */
export function fixEncodingIssues(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  if (!hasEncodingIssues(text)) {
    return text;
  }

  try {
    // Strategy: Convert string to byte array and try UTF-8 decoding
    const bytes: number[] = [];

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      bytes.push(code & 0xFF); // Keep only low byte
    }

    // Try to decode as UTF-8
    const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));

    // Validate the result
    if (decoded && decoded.length > 0 && decoded !== text) {
      // Check if result contains Thai characters (U+0E00-U+0E7F range)
      const hasThai = /[\u0E00-\u0E7F]/.test(decoded);
      if (hasThai && !decoded.includes('?')) {
        return decoded;
      }

      // Also accept if it has significantly fewer replacement characters
      const origQuestions = (text.match(/\?/g) || []).length;
      const newQuestions = (decoded.match(/\?/g) || []).length;
      if (newQuestions < origQuestions && newQuestions === 0) {
        return decoded;
      }
    }
  } catch (e) {
    // If decoding fails, return original text
    console.debug('Charset: Failed to fix encoding issues:', e);
  }

  return text;
}

/**
 * Recursively fixes encoding issues in an object's string values.
 * Useful for fixing entire API responses at once.
 */
export function fixObjectEncoding<T>(obj: T, depth = 0): T {
  if (depth > 10) return obj; // Prevent infinite recursion

  if (typeof obj === 'string') {
    const fixed = fixEncodingIssues(obj);
    if (fixed !== obj) {
      console.debug(`Charset: Fixed string at depth ${depth}: "${obj}" → "${fixed}"`);
    }
    return fixed as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => fixObjectEncoding(item, depth + 1)) as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const fixed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      fixed[key] = fixObjectEncoding(value, depth + 1);
    }
    return fixed as T;
  }

  return obj;
}
