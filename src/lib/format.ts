/** "1 mot", "3 mots". Regular French plurals only. */
export const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;
