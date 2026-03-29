const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "..", "storage");

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

/**
 * Load JSON file safely
 * @param {string} filename - Just the filename (e.g., "links.json")
 * @returns {object}
 */
function loadStorage(filename) {
    const filePath = path.join(STORAGE_DIR, filename);
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, "{}");
            return {};
        }
        const data = fs.readFileSync(filePath, "utf8");
        return data.trim() ? JSON.parse(data) : {};
    } catch (err) {
        console.error(`Error loading ${filename}:`, err);
        return {};
    }
}

/**
 * Save data to JSON file
 * @param {string} filename - Just the filename (e.g., "links.json")
 * @param {object} data - Data to save
 */
function saveStorage(filename, data) {
    const filePath = path.join(STORAGE_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Get linked osu! user for a Discord ID
 * @param {string} discordId
 * @returns {object|null}
 */
function getLinkedUser(discordId) {
    const links = loadStorage("links.json");
    return links[discordId] || null;
}

/**
 * Bot owner/admin Discord ID (you)
 */
const OWNER_ID = process.env.OWNER_ID || "YOUR_DISCORD_ID_HERE";

module.exports = {
    loadStorage,
    saveStorage,
    getLinkedUser,
    OWNER_ID,
    STORAGE_DIR
};