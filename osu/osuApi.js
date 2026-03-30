// osuApi.js
require("dotenv").config();

let cachedToken = null;
let tokenExpiry = 0;

async function getOsuToken() {
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
    if (!res.ok) throw new Error("Failed to get osu token");
    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
    return cachedToken;
}

async function osuRequest(endpoint, params = {}) {
    const token = await getOsuToken();
    const url = new URL(`https://osu.ppy.sh/api/v2${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
        }
    });
    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    });
    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`osu API request failed: ${res.status}`);
    }
    return res.json();
}

async function getOsuUser(identifier, mode = "osu") {
    return osuRequest(`/users/${encodeURIComponent(identifier)}/${mode}`);
}

async function getUserTopPlays(userId, limit = 100, offset = 0) {
    return osuRequest(`/users/${userId}/scores/best`, { mode: "osu", limit, offset });
}

async function getUserRecentPlays(userId, limit = 50, includeFails = true) {
    return osuRequest(`/users/${userId}/scores/recent`, {
        mode: "osu", limit, include_fails: includeFails ? 1 : 0
    });
}

async function getBeatmap(beatmapId) {
    return osuRequest(`/beatmaps/${beatmapId}`);
}

async function getBeatmapset(beatmapsetId) {
    return osuRequest(`/beatmapsets/${beatmapsetId}`);
}

async function searchBeatmaps(options = {}) {
    const params = {
        m: 0,
        s: options.status || "ranked",
        sort: options.sort || "plays_desc",
        q: options.query || "",
    };
    if (options.minSR !== undefined) params.q += ` stars>=${options.minSR}`;
    if (options.maxSR !== undefined) params.q += ` stars<=${options.maxSR}`;
    if (options.minLength !== undefined) params.q += ` length>=${options.minLength}`;
    if (options.maxLength !== undefined) params.q += ` length<=${options.maxLength}`;
    return osuRequest("/beatmapsets/search", params);
}

async function getBeatmapScores(beatmapId, options = {}) {
    return osuRequest(`/beatmaps/${beatmapId}/scores`, { mode: "osu", ...options });
}

// Analyze playstyle from TOP 100 plays for better accuracy
function analyzePlaystyle(topPlays) {
    if (!topPlays || topPlays.length === 0) {
        return {
            avgSR: 0, avgLength: 0, avgBPM: 0, avgAcc: 0, avgPP: 0,
            topPP: 0, recommendedSR: 0, comfortSR: { min: 0, max: 0 },
            strengths: [], preferredLength: "medium"
        };
    }

    // Sort by PP
    const sortedByPP = [...topPlays].sort((a, b) => (b.pp || 0) - (a.pp || 0));
    const topPP = sortedByPP[0]?.pp || 0;
    
    // Calculate stats from ALL plays (up to 100)
    let totalSR = 0, totalLength = 0, totalBPM = 0, totalAcc = 0, totalPP = 0;
    const srValues = [];
    
    for (const score of topPlays) {
        const beatmap = score.beatmap;
        const sr = beatmap?.difficulty_rating || 0;
        totalSR += sr;
        totalLength += beatmap?.total_length || 0;
        totalBPM += beatmap?.bpm || 0;
        totalAcc += score.accuracy || 0;
        totalPP += score.pp || 0;
        srValues.push(sr);
    }
    
    const count = topPlays.length;
    const avgSR = totalSR / count;
    const avgLength = totalLength / count;
    const avgBPM = totalBPM / count;
    const avgAcc = (totalAcc / count) * 100;
    const avgPP = totalPP / count;
    
    // Comfort SR = middle 60% of plays
    srValues.sort((a, b) => a - b);
    const lowIndex = Math.floor(count * 0.2);
    const highIndex = Math.floor(count * 0.8);
    const comfortSR = {
        min: srValues[lowIndex] || avgSR - 0.5,
        max: srValues[highIndex] || avgSR + 0.5
    };
    
    // Recommended SR = average of top 25% plays (where user performs best)
    const top25Count = Math.max(1, Math.floor(count * 0.25));
    const top25Plays = sortedByPP.slice(0, top25Count);
    let top25SR = 0;
    for (const score of top25Plays) {
        top25SR += score.beatmap?.difficulty_rating || 0;
    }
    const recommendedSR = top25SR / top25Count;
    
    // Detect strengths based on map characteristics
    const strengths = [];
    let jumpMaps = 0, streamMaps = 0, techMaps = 0;
    
    for (const score of topPlays) {
        const bm = score.beatmap;
        if (!bm) continue;
        const ar = bm.ar || 9;
        const cs = bm.cs || 4;
        const bpm = bm.bpm || 180;
        const len = bm.total_length || 120;
        
        if (ar >= 9.3 && cs <= 4.2) jumpMaps++;
        if (bpm >= 170 && len >= 90) streamMaps++;
        if (ar <= 9.2 && cs >= 4) techMaps++;
    }
    
    const total = jumpMaps + streamMaps + techMaps;
    if (total > 0) {
        if (jumpMaps / total > 0.35) strengths.push("aim");
        if (streamMaps / total > 0.3) strengths.push("streams");
        if (techMaps / total > 0.25) strengths.push("tech");
    }
    if (avgAcc > 98) strengths.push("accuracy");
    if (avgLength > 180) strengths.push("consistency");
    
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
