
export function fuzzyScore(text: string, query: string): number {
    if (!query) return 0;
    if (!text) return -Infinity;

    const t = text.toLowerCase();
    const q = query.toLowerCase();

    // Exact match bonus
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;

    let score = 0;
    let tIdx = 0;
    let qIdx = 0;
    let consecutive = 0;

    // Check if query is a subsequence of text
    while (tIdx < t.length && qIdx < q.length) {
        if (t[tIdx] === q[qIdx]) {
            score += 10;
            score += consecutive * 5; // Bonus for consecutive matches

            // Bonus for start of word (camelCase, snake_case, spaces, slashes)
            const isStart = tIdx === 0;
            const isSeparator = tIdx > 0 && /[\/\-_ .]/.test(t[tIdx - 1] || '');
            const isCamel = tIdx > 0 && text[tIdx] && text[tIdx] !== text[tIdx].toLowerCase() && text[tIdx - 1] === text[tIdx - 1]?.toLowerCase();

            if (isStart || isSeparator || isCamel) {
                score += 20;
            }

            consecutive++;
            qIdx++;
        } else {
            consecutive = 0;
            // Small penalty for gaps, but don't punish too hard or long strings fail
            // score -= 1; 
        }
        tIdx++;
    }

    // If we didn't match the full query, it's not a match
    if (qIdx < q.length) return -Infinity;

    // Penalize long strings (dilution)
    // We want the shortest string that matches the query to win
    const coverage = q.length / t.length;
    score *= coverage;

    return score;
}
