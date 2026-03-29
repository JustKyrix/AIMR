// maps.js - Map recommendation engine
const { searchBeatmaps, getUserTopPlays, analyzePlaystyle } = require("./osuApi");

/**
 * Get warmup maps (easier, shorter maps below comfort zone)
 * @param {object} playstyle - Result from analyzePlaystyle
 * @param {number} count - Number of maps to return
 */
async function getWarmupMaps(playstyle, count = 3) {
    const targetSR = {
        min: Math.max(1, playstyle.avgSR - 1.5),
        max: playstyle.avgSR - 0.5
    };

    const results = await searchBeatmaps({
        minSR: targetSR.min,
        maxSR: targetSR.max,
        maxLength: 150, // Under 2:30
        status: "ranked",
        sort: "plays_desc"
    });

    if (!results || !results.beatmapsets) return [];

    // Flatten and filter beatmaps
    const maps = [];
    for (const set of results.beatmapsets) {
        for (const beatmap of set.beatmaps || []) {
            if (beatmap.mode === "osu" && 
                beatmap.difficulty_rating >= targetSR.min && 
                beatmap.difficulty_rating <= targetSR.max &&
                beatmap.total_length <= 150) {
                maps.push({
                    ...beatmap,
                    beatmapset: set
                });
            }
        }
    }

    // Shuffle and return
    return shuffleArray(maps).slice(0, count);
}

/**
 * Get aim-focused maps (jump heavy, high AR)
 * @param {object} playstyle
 * @param {number} count
 */
async function getAimMaps(playstyle, count = 3) {
    const targetSR = {
        min: playstyle.comfortSR.min,
        max: playstyle.comfortSR.max + 0.3
    };

    // Search for popular jump maps
    const results = await searchBeatmaps({
        minSR: targetSR.min,
        maxSR: targetSR.max,
        status: "ranked",
        sort: "plays_desc",
        query: "" // Could add keywords like "jump" but API doesn't support well
    });

    if (!results || !results.beatmapsets) return [];

    const maps = [];
    for (const set of results.beatmapsets) {
        for (const beatmap of set.beatmaps || []) {
            // Filter for aim-heavy characteristics
            if (beatmap.mode === "osu" && 
                beatmap.difficulty_rating >= targetSR.min && 
                beatmap.difficulty_rating <= targetSR.max &&
                beatmap.ar >= 9 && // High AR
                beatmap.cs <= 4.5) { // Not too small circles
                maps.push({
                    ...beatmap,
                    beatmapset: set
                });
            }
        }
    }

    return shuffleArray(maps).slice(0, count);
}

/**
 * Get farm maps (PP viable, close to user's level)
 * @param {object} playstyle
 * @param {number} count
 */
async function getFarmMaps(playstyle, count = 3) {
    // Slightly below comfort zone for FC potential
    const targetSR = {
        min: playstyle.avgSR - 0.3,
        max: playstyle.avgSR + 0.2
    };

    const results = await searchBeatmaps({
        minSR: targetSR.min,
        maxSR: targetSR.max,
        minLength: 60,
        maxLength: 180, // Not too long for consistency
        status: "ranked",
        sort: "favourites_desc" // Popular = likely more farm-able
    });

    if (!results || !results.beatmapsets) return [];

    const maps = [];
    for (const set of results.beatmapsets) {
        for (const beatmap of set.beatmaps || []) {
            if (beatmap.mode === "osu" && 
                beatmap.difficulty_rating >= targetSR.min && 
                beatmap.difficulty_rating <= targetSR.max &&
                beatmap.total_length >= 60 &&
                beatmap.total_length <= 180) {
                maps.push({
                    ...beatmap,
                    beatmapset: set,
                    // Rough PP estimation based on SR (very simplified)
                    estimatedPP: estimatePP(beatmap.difficulty_rating, playstyle.avgAcc)
                });
            }
        }
    }

    // Sort by estimated PP potential
    maps.sort((a, b) => b.estimatedPP - a.estimatedPP);

    return maps.slice(0, count * 2).sort(() => Math.random() - 0.5).slice(0, count);
}

/**
 * Get random maps (complete chaos mode)
 * @param {object} playstyle
 * @param {number} count
 */
async function getRandomMaps(playstyle, count = 3) {
    // Wide SR range for chaos
    const targetSR = {
        min: Math.max(1, playstyle.avgSR - 2),
        max: playstyle.avgSR + 1.5
    };

    const results = await searchBeatmaps({
        minSR: targetSR.min,
        maxSR: targetSR.max,
        status: "ranked",
        sort: "plays_desc"
    });

    if (!results || !results.beatmapsets) return [];

    const maps = [];
    for (const set of results.beatmapsets) {
        for (const beatmap of set.beatmaps || []) {
            if (beatmap.mode === "osu" && 
                beatmap.difficulty_rating >= targetSR.min && 
                beatmap.difficulty_rating <= targetSR.max) {
                maps.push({
                    ...beatmap,
                    beatmapset: set
                });
            }
        }
    }

    return shuffleArray(maps).slice(0, count);
}

/**
 * Get challenge maps (above comfort zone)
 * @param {object} playstyle
 * @param {number} count
 */
async function getChallengeMaps(playstyle, count = 3) {
    const targetSR = {
        min: playstyle.comfortSR.max,
        max: playstyle.avgSR + 1.5
    };

    const results = await searchBeatmaps({
        minSR: targetSR.min,
        maxSR: targetSR.max,
        status: "ranked",
        sort: "plays_desc"
    });

    if (!results || !results.beatmapsets) return [];

    const maps = [];
    for (const set of results.beatmapsets) {
        for (const beatmap of set.beatmaps || []) {
            if (beatmap.mode === "osu" && 
                beatmap.difficulty_rating >= targetSR.min && 
                beatmap.difficulty_rating <= targetSR.max) {
                maps.push({
                    ...beatmap,
                    beatmapset: set
                });
            }
        }
    }

    return shuffleArray(maps).slice(0, count);
}

/**
 * Very rough PP estimation (simplified formula)
 */
function estimatePP(starRating, accuracy = 98) {
    // This is a VERY rough approximation
    // Real PP calculation is much more complex
    const basePP = Math.pow(starRating, 2.5) * 5;
    const accMultiplier = Math.pow(accuracy / 100, 4);
    return Math.round(basePP * accMultiplier);
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Format map for display
 */
function formatMapInfo(beatmap) {
    const set = beatmap.beatmapset || {};
    const length = beatmap.total_length || 0;
    const mins = Math.floor(length / 60);
    const secs = length % 60;

    return {
        title: set.title || "Unknown",
        artist: set.artist || "Unknown",
        difficulty: beatmap.version || "Unknown",
        sr: beatmap.difficulty_rating?.toFixed(2) || "?",
        bpm: beatmap.bpm || "?",
        length: `${mins}:${secs.toString().padStart(2, "0")}`,
        ar: beatmap.ar?.toFixed(1) || "?",
        cs: beatmap.cs?.toFixed(1) || "?",
        beatmapId: beatmap.id,
        beatmapsetId: set.id,
        url: `https://osu.ppy.sh/b/${beatmap.id}`,
        coverUrl: set.covers?.cover || set.covers?.card || null,
        creator: set.creator || "Unknown"
    };
}

module.exports = {
    getWarmupMaps,
    getAimMaps,
    getFarmMaps,
    getRandomMaps,
    getChallengeMaps,
    formatMapInfo,
    estimatePP
};