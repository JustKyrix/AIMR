// osuApi.js
require("dotenv").config();

// Token caching
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get osu! API token (cached)
 */
async function getOsuToken() {
    // Return cached token if still valid (with 60s buffer)
    if (cachedToken && Date.now() < tokenExpiry - 60000) {
        return cachedToken;
    }

    const res = await fetch("https://osu.ppy.sh/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: Number(process.env.OSU_CLIENT_ID),
            client_secret: process.env.OSU_CLIENT_SECRET,
            grant_type: "client_credentials",
            scope: "public"
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error("osu token error:", res.status, txt);
        throw new Error("Failed to get osu token");
    }

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
    return cachedToken;
}

/**
 * Generic API request helper
 */
async function osuRequest(endpoint, params = {}) {
    const token = await getOsuToken();
    
    const url = new URL(`https://osu.ppy.sh/api/v2${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
        }
    });

    const res = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!res.ok) {
        if (res.status === 404) return null;
        const txt = await res.text();
        console.error(`osu API error [${endpoint}]:`, res.status, txt);
        throw new Error(`osu API request failed: ${res.status}`);
    }

    return res.json();
}

/**
 * Get user by username or ID
 */
async function getOsuUser(identifier, mode = "osu") {
    return osuRequest(`/users/${encodeURIComponent(identifier)}/${mode}`);
}

/**
 * Get user's top plays (best performance)
 * @param {number} userId 
 * @param {number} limit - max 100
 * @param {number} offset
 */
async function getUserTopPlays(userId, limit = 100, offset = 0) {
    return osuRequest(`/users/${userId}/scores/best`, {
        mode: "osu",
        limit,
        offset
    });
}

/**
 * Get user's recent plays
 * @param {number} userId 
 * @param {number} limit - max 100
 * @param {boolean} includeFails
 */
async function getUserRecentPlays(userId, limit = 50, includeFails = true) {
    return osuRequest(`/users/${userId}/scores/recent`, {
        mode: "osu",
        limit,
        include_fails: includeFails ? 1 : 0
    });
}

/**
 * Get beatmap details
 * @param {number} beatmapId 
 */
async function getBeatmap(beatmapId) {
    return osuRequest(`/beatmaps/${beatmapId}`);
}

/**
 * Get beatmapset details
 * @param {number} beatmapsetId 
 */
async function getBeatmapset(beatmapsetId) {
    return osuRequest(`/beatmapsets/${beatmapsetId}`);
}

/**
 * Search beatmaps
 * @param {object} options
 */
async function searchBeatmaps(options = {}) {
    const params = {
        m: 0, // osu! standard
        s: options.status || "ranked", // ranked, qualified, loved, pending, graveyard
        sort: options.sort || "plays_desc",
        q: options.query || "",
    };

    // Star rating filter
    if (options.minSR !== undefined) {
        params.q += ` stars>=${options.minSR}`;
    }
    if (options.maxSR !== undefined) {
        params.q += ` stars<=${options.maxSR}`;
    }

    // Length filter (in seconds)
    if (options.minLength !== undefined) {
        params.q += ` length>=${options.minLength}`;
    }
    if (options.maxLength !== undefined) {
        params.q += ` length<=${options.maxLength}`;
    }

    return osuRequest("/beatmapsets/search", params);
}

/**
 * Get beatmap scores
 * @param {number} beatmapId 
 * @param {object} options
 */
async function getBeatmapScores(beatmapId, options = {}) {
    return osuRequest(`/beatmaps/${beatmapId}/scores`, {
        mode: "osu",
        ...options
    });
}

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
            comfortSR: { min: 0, max: 0 },
            strengths: [],
            preferredLength: "medium"
        };
    }

    // Calculate averages
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
        // (This is a rough heuristic - real detection would need map data)
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
        comfortSR,
        strengths,
        preferredLength
    };
}

module.exports = {
    getOsuToken,
    getOsuUser,
    getUserTopPlays,
    getUserRecentPlays,
    getBeatmap,
    getBeatmapset,
    searchBeatmaps,
    getBeatmapScores,
    analyzePlaystyle
};
