// maps.js - Map recommendation engine
const { searchBeatmaps, getUserTopPlays, analyzePlaystyle } = require("./osuApi");

/**
 * Get warmup maps (slightly below recommended SR)
 */
async function getWarmupMaps(playstyle, count = 3) {
    // Warmup = 0.5 to 1.5 stars below recommended
    const targetSR = {
        min: Math.max(1, playstyle.recommendedSR - 1.5),
        max: playstyle.recommendedSR - 0.5
    };

    const results = await searchBeatmaps({
        minSR: targetSR.min,
        maxSR: targetSR.max,
        maxLength: 180,
        status: "ranked",
        sort: "plays_desc"
    });

    if (!results || !results.beatmapsets) return [];

    const maps = [];
    for (const set of results.beatmapsets) {
        for (const beatmap of set.beatmaps || []) {
            if (beatmap.mode === "osu" && 
                beatmap.difficulty_rating >= targetSR.min && 
                beatmap.difficulty_rating <= targetSR.max &&
                beatmap.total_length <= 180) {
                maps.push({ ...beatmap, beatmapset: set });
            }
        }
    }

    return shuffleArray(maps).slice(0, count);
}

/**
 * Get aim-focused maps (at or slightly above recommended)
 */
async function getAimMaps(playstyle, count = 3) {
    const targetSR = {
        min: playstyle.recommendedSR - 0.3,
        max: playstyle.recommendedSR + 0.5
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
                beatmap.difficulty_rating <= targetSR.max &&
                beatmap.ar >= 9 &&
                beatmap.cs <= 4.5) {
                maps.push({ ...beatmap, beatmapset: set });
            }
        }
    }

    return shuffleArray(maps).slice(0, count);
}

/**
 * Get farm maps (PP viable - at recommended level)
 */
async function getFarmMaps(playstyle, count = 3) {
    const targetSR = {
        min: playstyle.recommendedSR - 0.3,
        max: playstyle.recommendedSR + 0.3
    };

    const results = await searchBeatmaps({
        minSR: targetSR.min,
        maxSR: targetSR.max,
        minLength: 60,
        maxLength: 180,
        status: "ranked",
        sort: "favourites_desc"
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
                const estPP = estimatePP(beatmap.difficulty_rating, playstyle.avgAcc);
                maps.push({ ...beatmap, beatmapset: set, estimatedPP: estPP });
            }
        }
    }

    maps.sort((a, b) => b.estimatedPP - a.estimatedPP);
    return maps.slice(0, count * 2).sort(() => Math.random() - 0.5).slice(0, count);
}

/**
 * Get random maps (wide range)
 */
async function getRandomMaps(playstyle, count = 3) {
    const targetSR = {
        min: Math.max(1, playstyle.recommendedSR - 2),
        max: playstyle.recommendedSR + 1.5
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
                maps.push({ ...beatmap, beatmapset: set });
            }
        }
    }

    return shuffleArray(maps).slice(0, count);
}

/**
 * Get challenge maps (above recommended)
 */
async function getChallengeMaps(playstyle, count = 3) {
    const targetSR = {
        min: playstyle.recommendedSR + 0.3,
        max: playstyle.recommendedSR + 1.5
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
                maps.push({ ...beatmap, beatmapset: set });
            }
        }
    }

    return shuffleArray(maps).slice(0, count);
}