/**
 * Analyze user's playstyle from top plays
 * @param {Array} topPlays - Array of score objects
 * @returns {object} Analysis results
 */
function analyzePlaystyle(topPlays) {
    if (!topPlays || topPlays.length === 0) {
        return {
            avgSR: 0,
            avgLength: 0,
            avgBPM: 0,
            avgAcc: 0,
            avgPP: 0,
            topPP: 0,
            recommendedSR: 0,
            comfortSR: { min: 0, max: 0 },
            strengths: [],
            preferredLength: "medium"
        };
    }

    // Sort by PP to get best plays first
    const sortedByPP = [...topPlays].sort((a, b) => (b.pp || 0) - (a.pp || 0));
    
    // Use top 10 plays for "recommended" calculation (what player actually performs best on)
    const top10 = sortedByPP.slice(0, 10);
    let top10SR = 0;
    let top10PP = 0;
    for (const score of top10) {
        top10SR += score.beatmap?.difficulty_rating || 0;
        top10PP += score.pp || 0;
    }
    const recommendedSR = top10SR / top10.length;
    const topPP = sortedByPP[0]?.pp || 0;

    // Calculate averages from all plays
    let totalSR = 0, totalLength = 0, totalBPM = 0, totalAcc = 0, totalPP = 0;
    let jumpCount = 0, streamCount = 0, techCount = 0;
    const srValues = [];

    for (const score of topPlays) {
        const beatmap = score.beatmap;
        const sr = beatmap?.difficulty_rating || 0;
        const length = beatmap?.total_length || 0;
        const bpm = beatmap?.bpm || 0;

        totalSR += sr;
        totalLength += length;
        totalBPM += bpm;
        totalAcc += score.accuracy || 0;
        totalPP += score.pp || 0;
        srValues.push(sr);

        // Simple pattern detection based on map attributes
        const cs = beatmap?.cs || 4;
        const ar = beatmap?.ar || 9;
        
        if (ar >= 9.5 && cs <= 4.2) jumpCount++;
        if (bpm >= 170 && length >= 120) streamCount++;
        if (ar <= 9 && cs >= 4.5) techCount++;
    }

    const count = topPlays.length;
    const avgSR = totalSR / count;
    const avgLength = totalLength / count;
    const avgBPM = totalBPM / count;
    const avgAcc = (totalAcc / count) * 100;
    const avgPP = totalPP / count;

    // Calculate comfort SR range (middle 60% of plays)
    srValues.sort((a, b) => a - b);
    const lowIndex = Math.floor(count * 0.2);
    const highIndex = Math.floor(count * 0.8);
    const comfortSR = {
        min: srValues[lowIndex] || avgSR - 0.5,
        max: srValues[highIndex] || avgSR + 0.5
    };

    // Determine strengths
    const strengths = [];
    const total = jumpCount + streamCount + techCount;
    if (total > 0) {
        if (jumpCount / total > 0.4) strengths.push("aim");
        if (streamCount / total > 0.3) strengths.push("streams");
        if (techCount / total > 0.3) strengths.push("tech");
    }
    if (avgAcc > 98) strengths.push("accuracy");
    if (avgLength > 180) strengths.push("consistency");

    // Preferred length category
    let preferredLength = "medium";
    if (avgLength < 90) preferredLength = "short";
    else if (avgLength > 240) preferredLength = "long";

    return {
        avgSR: Math.round(avgSR * 100) / 100,
        avgLength: Math.round(avgLength),
        avgBPM: Math.round(avgBPM),
        avgAcc: Math.round(avgAcc * 100) / 100,
        avgPP: Math.round(avgPP),
        topPP: Math.round(topPP),
        recommendedSR: Math.round(recommendedSR * 100) / 100,
        comfortSR,
        strengths,
        preferredLength
    };
}