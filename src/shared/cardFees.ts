/**
 * The issuer's monthly charge for holding the card, which the AI categorizer
 * scatters across ordinary spending categories. Matching is on the statement
 * text alone so the import preview can flag it without a model call.
 */

// Hebrew letters plus Latin letters and digits; everything else — including the
// slashes and dashes statements wrap these descriptions in — separates words.
const WORD_SEPARATOR = /[^0-9A-Za-z֐-׿]+/;

const CARD_FEE_PHRASES: string[][] = [
  ['דמי', 'כרטיס'],
  ['דמי', 'הנפקה'],
  ['דמי', 'שימוש'],
  ['דמי', 'חבר'],
  ['card', 'fee'],
  ['annual', 'fee'],
  ['membership', 'fee'],
];

export function isCardHoldingFee(description: string): boolean {
  const words = toWords(description);

  return CARD_FEE_PHRASES.some((phrase) => containsPhrase(words, phrase));
}

function toWords(description: string): string[] {
  return description
    .toLowerCase()
    .split(WORD_SEPARATOR)
    .filter((word) => word !== '');
}

/**
 * Whole words in order: `דמי לידה` and `דמי אבטלה` are benefits, not fees, so a
 * phrase only counts where every one of its words stands on its own.
 */
function containsPhrase(words: string[], phrase: string[]): boolean {
  return words.some((_word, start) =>
    phrase.every((phraseWord, offset) => words[start + offset] === phraseWord),
  );
}
