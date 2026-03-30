// PP Calculator using rosu-pp-js (accurate osu! pp calculation)
const rosu = require('rosu-pp-js');
const https = require('https');

// Cache for downloaded beatmaps
const beatmapCache = new Map();

// Mod bit values for rosu-pp
const MOD_BITS = {
    NF: 1,
    EZ: 2,
    HD: 8,
    HR: 16,
    SD: 32,
    DT: 64,
    RX: 128,
    HT: 256,
    NC: 512,
    FL: 1024,
    SO: 4096,
    PF: 16384
};

function parseMods(modString) {
    if (!modString) return [];
    const str = modString.toUpperCase().replace(/\s/g, '');
    const mods = [];
    
    const modPatterns = ['DT', 'NC', 'HT', 'HR', 'HD', 'FL', 'EZ', 'NF', 'SD', 'PF', 'SO'];
    let remaining = str;
    
    for (const mod of modPatterns) {
        if (remaining.includes(mod)) {
            mods.push(mod);
            remaining = remaining.replace(mod, '');
        }
    }
    
    if (mods.includes('NC') && !mods.includes('DT')) {
        mods.push('DT');
    }
    
    return [...new Set(mods)];
}

function modsToInt(mods) {
    const modList = Array.isArray(mods) ? mods : parseMods(mods);
    let bits = 0;
    for (const mod of modList) {
        if (MOD_BITS[mod]) {
            bits |= MOD_BITS[mod];
        }
    }
    return bits;
}

function getModMultipliers(mods) {
    const modList = Array.isArray(mods) ? mods : parseMods(mods);
    
    let srMultiplier = 1;
    let ppMultiplier = 1;
    let speedMultiplier = 1;
    
    if (modList.includes('DT') || modList.includes('NC')) {
        srMultiplier = 1.40;
        speedMultiplier = 1.5;
    }
    if (modList.includes('HT')) {
        srMultiplier = 0.60;
        speedMultiplier = 0.75;
    }
    if (modList.includes('HR')) {
        srMultiplier *= 1.08;
    }
    if (modList.includes('EZ')) {
        srMultiplier *= 0.50;
    }
    
    return { srMultiplier, speedMultiplier, modList };
}

function applyModsToMap(beatmap, mods) {
    const { srMultiplier, speedMultiplier, modList } = getModMultipliers(mods);
    
    let ar = beatmap.ar || 9;
    let od = beatmap.accuracy || 8;
    let cs = beatmap.cs || 4;
    let bpm = beatmap.bpm || 180;
    let length = beatmap.total_length || 120;
    let sr = beatmap.difficulty_rating || 5;
    
    if (modList.includes('HR')) {
        ar = Math.min(10, ar * 1.4);
        od = Math.min(10, od * 1.4);
        cs = Math.min(10, cs * 1.3);
    }
    
    if (modList.includes('EZ')) {
        ar = ar * 0.5;
        od = od * 0.5;
        cs = cs * 0.5;
    }
    
    if (modList.includes('DT') || modList.includes('NC')) {
        bpm = Math.round(bpm * 1.5);
        length = Math.round(length / 1.5);
        const arMs = ar <= 5 ? (1800 - ar * 120) : (1200 - (ar - 5) * 150);
        const newArMs = arMs / 1.5;
        ar = newArMs > 1200 ? (1800 - newArMs) / 120 : 5 + (1200 - newArMs) / 150;
        ar = Math.min(11, Math.round(ar * 10) / 10);
    }
    
    if (modList.includes('HT')) {
        bpm = Math.round(bpm * 0.75);
        length = Math.round(length / 0.75);
    }
    
    sr = Math.round(sr * srMultiplier * 100) / 100;
    
    return {
        ...beatmap,
        ar: Math.round(ar * 10) / 10,
        od: Math.round((od || beatmap.accuracy || 8) * 10) / 10,
        cs: Math.round(cs * 10) / 10,
        bpm,
        total_length: length,
        difficulty_rating: sr,
        mods: modList
    };
}

// Download beatmap .osu file
function downloadBeatmap(beatmapId) {
    return new Promise((resolve, reject) => {
        if (beatmapCache.has(beatmapId)) {
            return resolve(beatmapCache.get(beatmapId));
        }
        
        const url = `https://osu.ppy.sh/osu/${beatmapId}`;
        
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                https.get(res.headers.location, (res2) => {
                    let data = '';
                    res2.on('data', chunk => data += chunk);
                    res2.on('end', () => {
                        beatmapCache.set(beatmapId, data);
                        if (beatmapCache.size > 100) {
                            const firstKey = beatmapCache.keys().next().value;
                            beatmapCache.delete(firstKey);
                        }
                        resolve(data);
                    });
                }).on('error', reject);
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (data.length < 100) {
                    return reject(new Error('Invalid beatmap data'));
                }
                beatmapCache.set(beatmapId, data);
                if (beatmapCache.size > 100) {
                    const firstKey = beatmapCache.keys().next().value;
                    beatmapCache.delete(firstKey);
                }
                resolve(data);
            });
        }).on('error', reject);
    });
}

// Calculate OD from great hit window
function hitWindowToOD(greatHitWindow, clockRate = 1) {
    // greatHitWindow = 79.5 - (OD * 6) / clockRate
    // OD = (79.5 - greatHitWindow * clockRate) / 6
    return (79.5 - greatHitWindow * clockRate) / 6;
}

// Get PP for multiple accuracies (accurate calculation)
async function getPPForAccuracies(beatmapId, mods = []) {
    try {
        const osuFile = await downloadBeatmap(beatmapId);
        const beatmap = new rosu.Beatmap(osuFile);
        const modBits = modsToInt(mods);
        
        // Calculate difficulty first
        const diff = new rosu.Difficulty({ mods: modBits }).calculate(beatmap);
        const totalObjects = diff.nCircles + diff.nSliders + diff.nSpinners;
        
        // Calculate PP for each accuracy by simulating hit counts
        // 95% acc: 95% 300s, 5% 100s
        // 98% acc: 98% 300s, 2% 100s  
        // 100% acc: all 300s
        
        const n100_95 = Math.round(totalObjects * 0.05);
        const n100_98 = Math.round(totalObjects * 0.02);
        
        const perf95 = new rosu.Performance({ 
            mods: modBits,
            n300: totalObjects - n100_95,
            n100: n100_95,
            n50: 0,
            misses: 0
        }).calculate(diff);
        
        const perf98 = new rosu.Performance({ 
            mods: modBits,
            n300: totalObjects - n100_98,
            n100: n100_98,
            n50: 0,
            misses: 0
        }).calculate(diff);
        
        const perf100 = new rosu.Performance({ 
            mods: modBits,
            n300: totalObjects,
            n100: 0,
            n50: 0,
            misses: 0
        }).calculate(diff);
        
        return {
            '95%': Math.round(perf95.pp),
            '98%': Math.round(perf98.pp),
            '100%': Math.round(perf100.pp)
        };
    } catch (err) {
        console.error(`[PP] Error calculating PP for ${beatmapId}:`, err.message);
        return null;
    }
}

// Get full beatmap info including accurate SR with mods
async function getBeatmapWithMods(beatmapId, mods = []) {
    try {
        const osuFile = await downloadBeatmap(beatmapId);
        const beatmap = new rosu.Beatmap(osuFile);
        const modBits = modsToInt(mods);
        const modList = Array.isArray(mods) ? mods : parseMods(mods);
        
        // Calculate difficulty
        const diff = new rosu.Difficulty({ mods: modBits }).calculate(beatmap);
        const totalObjects = diff.nCircles + diff.nSliders + diff.nSpinners;
        
        // Calculate clock rate
        let clockRate = 1;
        if (modList.includes('DT') || modList.includes('NC')) clockRate = 1.5;
        if (modList.includes('HT')) clockRate = 0.75;
        
        // Calculate OD from hit window
        const od = hitWindowToOD(diff.greatHitWindow, 1); // greatHitWindow is already adjusted
        
        // Get BPM from beatmap file (parse it)
        let bpm = 180; // default
        const bpmMatch = osuFile.match(/BeatDivisor:\s*\d+[\s\S]*?\n(-?\d+),(\d+(?:\.\d+)?)/);
        const timingMatch = osuFile.match(/\[TimingPoints\]\s*\n(-?\d+),(\d+(?:\.\d+)?)/);
        if (timingMatch) {
            const beatLength = parseFloat(timingMatch[2]);
            if (beatLength > 0) {
                bpm = Math.round(60000 / beatLength * clockRate);
            }
        }
        
        // PP calculations
        const n100_95 = Math.round(totalObjects * 0.05);
        const n100_98 = Math.round(totalObjects * 0.02);
        
        const perf95 = new rosu.Performance({ 
            mods: modBits, n300: totalObjects - n100_95, n100: n100_95, n50: 0, misses: 0
        }).calculate(diff);
        
        const perf98 = new rosu.Performance({ 
            mods: modBits, n300: totalObjects - n100_98, n100: n100_98, n50: 0, misses: 0
        }).calculate(diff);
        
        const perf100 = new rosu.Performance({ 
            mods: modBits, n300: totalObjects, n100: 0, n50: 0, misses: 0
        }).calculate(diff);
        
        return {
            sr: Math.round(diff.stars * 100) / 100,
            ar: Math.round(diff.ar * 10) / 10,
            od: Math.round(od * 10) / 10,
            hp: Math.round(diff.hp * 10) / 10,
            bpm: bpm,
            maxCombo: diff.maxCombo,
            pp: {
                '95%': Math.round(perf95.pp),
                '98%': Math.round(perf98.pp),
                '100%': Math.round(perf100.pp)
            }
        };
    } catch (err) {
        console.error(`[PP] Error getting beatmap info for ${beatmapId}:`, err.message);
        return null;
    }
}

function formatModsDisplay(mods) {
    if (!mods || mods.length === 0) return 'NM';
    return '+' + mods.join('');
}

module.exports = {
    parseMods,
    modsToInt,
    getModMultipliers,
    applyModsToMap,
    downloadBeatmap,
    getPPForAccuracies,
    getBeatmapWithMods,
    formatModsDisplay
};
