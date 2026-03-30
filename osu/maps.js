const { searchBeatmaps } = require("./osuApi");
const { applyModsToMap, getPPForAccuracies, formatModsDisplay, parseMods, getModMultipliers } = require("./ppCalc");

// Helper: Calculate search SR based on mods
// If user wants 6* with DT, we search for 4.3* NM maps (6 / 1.4 = 4.3)
function getSearchSR(targetSR, mods) {
    const { srMultiplier } = getModMultipliers(mods);
    return targetSR / srMultiplier;
}

async function getWarmupMaps(playstyle, count = 3, mods = []) {
    // Warmup = 1-2 stars below recommended
    const targetMin = playstyle.recommendedSR - 2;
    const targetMax = playstyle.recommendedSR - 1;
    
    const searchSR = {
        min: Math.max(1, getSearchSR(targetMin, mods)),
        max: getSearchSR(targetMax, mods)
    };
    
    const results = await searchBeatmaps({
        minSR: searchSR.min, maxSR: searchSR.max,
        maxLength: 180, status: "ranked", sort: "plays_desc"
    });
    if (!results?.beatmapsets) return [];
    
    const maps = [];
    for (const set of results.beatmapsets) {
        for (const bm of set.beatmaps || []) {
            if (bm.mode === "osu" && bm.difficulty_rating >= searchSR.min && bm.difficulty_rating <= searchSR.max) {
                maps.push(applyModsToMap({ ...bm, beatmapset: set }, mods));
            }
        }
    }
    return shuffleArray(maps).slice(0, count);
}

async function getAimMaps(playstyle, count = 3, mods = []) {
    // Aim = at recommended SR, filter for jump characteristics
    const targetMin = playstyle.recommendedSR - 0.5;
    const targetMax = playstyle.recommendedSR + 0.3;
    
    const searchSR = {
        min: getSearchSR(targetMin, mods),
        max: getSearchSR(targetMax, mods)
    };
    
    const results = await searchBeatmaps({
        minSR: searchSR.min, maxSR: searchSR.max,
        status: "ranked", sort: "plays_desc"
    });
    if (!results?.beatmapsets) return [];
    
    const maps = [];
    for (const set of results.beatmapsets) {
        for (const bm of set.beatmaps || []) {
            // Filter for aim/jump maps: high AR, normal CS
            if (bm.mode === "osu" && bm.ar >= 9 && bm.cs <= 4.5 && bm.cs >= 3.5) {
                maps.push(applyModsToMap({ ...bm, beatmapset: set }, mods));
            }
        }
    }
    return shuffleArray(maps).slice(0, count);
}

async function getJumpMaps(playstyle, count = 3, mods = []) {
    // Same as aim but more strict
    return getAimMaps(playstyle, count, mods);
}

async function getStreamMaps(playstyle, count = 3, mods = []) {
    // Stream = high BPM, longer maps
    const targetMin = playstyle.recommendedSR - 0.5;
    const targetMax = playstyle.recommendedSR + 0.3;
    
    const searchSR = {
        min: getSearchSR(targetMin, mods),
        max: getSearchSR(targetMax, mods)
    };
    
    const results = await searchBeatmaps({
        minSR: searchSR.min, maxSR: searchSR.max,
        minLength: 90, status: "ranked", sort: "plays_desc"
    });
    if (!results?.beatmapsets) return [];
    
    const maps = [];
    for (const set of results.beatmapsets) {
        for (const bm of set.beatmaps || []) {
            // Filter for stream maps: high BPM (170+), longer length
            if (bm.mode === "osu" && bm.bpm >= 170 && bm.total_length >= 90) {
                maps.push(applyModsToMap({ ...bm, beatmapset: set }, mods));
            }
        }
    }
    return shuffleArray(maps).slice(0, count);
}

async function getTechMaps(playstyle, count = 3, mods = []) {
    // Tech = lower AR, higher CS, complex patterns
    const targetMin = playstyle.recommendedSR - 0.5;
    const targetMax = playstyle.recommendedSR + 0.3;
    
    const searchSR = {
        min: getSearchSR(targetMin, mods),
        max: getSearchSR(targetMax, mods)
    };
    
    const results = await searchBeatmaps({
        minSR: searchSR.min, maxSR: searchSR.max,
        status: "ranked", sort: "plays_desc"
    });
    if (!results?.beatmapsets) return [];
    
    const maps = [];
    for (const set of results.beatmapsets) {
        for (const bm of set.beatmaps || []) {
            // Filter for tech maps: AR 8-9.3, CS 4+
            if (bm.mode === "osu" && bm.ar >= 8 && bm.ar <= 9.3 && bm.cs >= 4) {
                maps.push(applyModsToMap({ ...bm, beatmapset: set }, mods));
            }
        }
    }
    return shuffleArray(maps).slice(0, count);
}

async function getSpeedMaps(playstyle, count = 3, mods = []) {
    // Speed = very high BPM
    const targetMin = playstyle.recommendedSR - 0.5;
    const targetMax = playstyle.recommendedSR + 0.3;
    
    const searchSR = {
        min: getSearchSR(targetMin, mods),
        max: getSearchSR(targetMax, mods)
    };
    
    const results = await searchBeatmaps({
        minSR: searchSR.min, maxSR: searchSR.max,
        status: "ranked", sort: "plays_desc"
    });
    if (!results?.beatmapsets) return [];
    
    const maps = [];
    for (const set of results.beatmapsets) {
        for (const bm of set.beatmaps || []) {
            // Filter for speed maps: BPM 200+
            if (bm.mode === "osu" && bm.bpm >= 200) {
                maps.push(applyModsToMap({ ...bm, beatmapset: set }, mods));
            }
        }
    }
    return shuffleArray(maps).slice(0, count);
}

async function getFarmMaps(playstyle, count = 3, mods = []) {
    // Farm = at recommended SR, high pp potential
    const targetMin = playstyle.recommendedSR - 0.3;
    const targetMax = playstyle.recommendedSR + 0.2;
    
    const searchSR = {
        min: getSearchSR(targetMin, mods),
        max: getSearchSR(targetMax, mods)
    };
    
    const results = await searchBeatmaps({
        minSR: searchSR.min, maxSR: searchSR.max,
        minLength: 60, maxLength: 180,
        status: "ranked", sort: "favourites_desc"
    });
    if (!results?.beatmapsets) return [];
    
    const maps = [];
    for (const set of results.beatmapsets) {
        for (const bm of set.beatmaps || []) {
            if (bm.mode === "osu") {
                const m = applyModsToMap({ ...bm, beatmapset: set }, mods);
                m.estimatedPP = getPPForAccuracies(m.difficulty_rating, mods)['98%'];
                maps.push(m);
            }
        }
    }
    maps.sort((a, b) => b.estimatedPP - a.estimatedPP);
    return maps.slice(0, count * 2).sort(() => Math.random() - 0.5).slice(0, count);
}

async function getRandomMaps(playstyle, count = 3, mods = []) {
    const targetMin = playstyle.recommendedSR - 1.5;
    const targetMax = playstyle.recommendedSR + 1;
    
    const searchSR = {
        min: Math.max(1, getSearchSR(targetMin, mods)),
        max: getSearchSR(targetMax, mods)
    };
    
    const results = await searchBeatmaps({
        minSR: searchSR.min, maxSR: searchSR.max,
        status: "ranked", sort: "plays_desc"
    });
    if (!results?.beatmapsets) return [];
    
    const maps = [];
    for (const set of results.beatmapsets) {
        for (const bm of set.beatmaps || []) {
            if (bm.mode === "osu") {
                maps.push(applyModsToMap({ ...bm, beatmapset: set }, mods));
            }
        }
    }
    return shuffleArray(maps).slice(0, count);
}

async function getChallengeMaps(playstyle, count = 3, mods = []) {
    // Challenge = above recommended
    const targetMin = playstyle.recommendedSR + 0.3;
    const targetMax = playstyle.recommendedSR + 1;
    
    const searchSR = {
        min: getSearchSR(targetMin, mods),
        max: getSearchSR(targetMax, mods)
    };
    
    const results = await searchBeatmaps({
        minSR: searchSR.min, maxSR: searchSR.max,
        status: "ranked", sort: "plays_desc"
    });
    if (!results?.beatmapsets) return [];
    
    const maps = [];
    for (const set of results.beatmapsets) {
        for (const bm of set.beatmaps || []) {
            if (bm.mode === "osu") {
                maps.push(applyModsToMap({ ...bm, beatmapset: set }, mods));
            }
        }
    }
    return shuffleArray(maps).slice(0, count);
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function formatMapInfo(beatmap, mods = []) {
    const set = beatmap.beatmapset || {};
    const len = beatmap.total_length || 0;
    const mins = Math.floor(len / 60);
    const secs = len % 60;
    const pp = getPPForAccuracies(beatmap.difficulty_rating, mods);
    
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
        mods: formatModsDisplay(mods),
        pp
    };
}

module.exports = {
    getWarmupMaps,
    getAimMaps,
    getJumpMaps,
    getStreamMaps,
    getTechMaps,
    getSpeedMaps,
    getFarmMaps,
    getRandomMaps,
    getChallengeMaps,
    formatMapInfo,
    parseMods
};
