// osu! IRC Bot - Handles in-game !commands
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const net = require("net");
const fs = require("fs");
const path = require("path");
const { getOsuUser, getUserTopPlays, analyzePlaystyle } = require("../osu/osuApi");
const { getWarmupMaps, getAimMaps, getFarmMaps, getRandomMaps, formatMapInfo } = require("../osu/maps");

// Config
const IRC_SERVER = "irc.ppy.sh";
const IRC_PORT = 6667;
const USERNAME = process.env.OSU_IRC_USERNAME;
const PASSWORD = process.env.OSU_IRC_PASSWORD;

// Storage path for links
const LINKS_PATH = path.join(__dirname, "..", "storage", "links.json");

// Load links
function loadLinks() {
    try {
        if (!fs.existsSync(LINKS_PATH)) return {};
        const data = fs.readFileSync(LINKS_PATH, "utf8");
        return data.trim() ? JSON.parse(data) : {};
    } catch (err) {
        return {};
    }
}

// Find osu user ID by osu username
function findOsuUserByUsername(username) {
    const links = loadLinks();
    for (const [discordId, data] of Object.entries(links)) {
        if (data.osuUsername && data.osuUsername.toLowerCase() === username.toLowerCase()) {
            return data;
        }
    }
    return null;
}

// IRC Client
class BanchoIRC {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.buffer = "";
    }

    connect() {
        console.log(`[IRC] Connecting to ${IRC_SERVER}:${IRC_PORT}...`);
        
        this.socket = net.createConnection(IRC_PORT, IRC_SERVER, () => {
            console.log("[IRC] Connected to Bancho!");
            this.send(`PASS ${PASSWORD}`);
            this.send(`NICK ${USERNAME}`);
            this.send(`USER ${USERNAME} 0 * :AIMR Bot`);
        });

        this.socket.setEncoding("utf8");

        this.socket.on("data", (data) => {
            this.buffer += data;
            const lines = this.buffer.split("\r\n");
            this.buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
                this.handleLine(line);
            }
        });

        this.socket.on("error", (err) => {
            console.error("[IRC] Socket error:", err.message);
        });

        this.socket.on("close", () => {
            console.log("[IRC] Connection closed. Reconnecting in 10 seconds...");
            this.connected = false;
            setTimeout(() => this.connect(), 10000);
        });
    }

    send(message) {
        if (this.socket && this.socket.writable) {
            this.socket.write(message + "\r\n");
        }
    }

    sendMessage(target, message) {
        this.send(`PRIVMSG ${target} :${message}`);
    }

    handleLine(line) {
        // Only log non-QUIT messages to reduce spam
        if (!line.includes(" QUIT :")) {
            console.log(`[IRC] < ${line}`);
        }

        // Respond to PING
        if (line.startsWith("PING")) {
            const pong = line.replace("PING", "PONG");
            this.send(pong);
            return;
        }

        // Check for successful connection
        if (line.includes("001")) {
            this.connected = true;
            console.log("[IRC] Successfully authenticated!");
        }

        // Handle private messages
        if (line.includes("PRIVMSG")) {
            console.log(`[IRC] PRIVMSG detected: ${line}`);
            
            const privmsgMatch = line.match(/^:(\S+)!\S+ PRIVMSG (\S+) :(.+)$/);
            if (privmsgMatch) {
                const sender = privmsgMatch[1];
                const target = privmsgMatch[2];
                const message = privmsgMatch[3].trim();

                console.log(`[IRC] Parsed: sender=${sender}, target=${target}, message=${message}`);
                console.log(`[IRC] Expected target: ${USERNAME}`);

                // Only respond to DMs (target is our username)
                if (target.toLowerCase() === USERNAME.toLowerCase()) {
                    console.log(`[IRC] Target matches! Handling command...`);
                    this.handleCommand(sender, message);
                } else {
                    console.log(`[IRC] Target mismatch: ${target} vs ${USERNAME}`);
                }
            } else {
                console.log(`[IRC] Regex did not match!`);
            }
        }
    }

    async handleCommand(sender, message) {
        const parts = message.split(" ");
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        console.log(`[IRC] Command from ${sender}: ${command}`);

        // Check if user is linked
        const linkedUser = findOsuUserByUsername(sender);
        
        if (!linkedUser && !["!help", "!link"].includes(command)) {
            this.sendMessage(sender, "You're not linked yet! Use /link in Discord first, then verify with me.");
            return;
        }

        try {
            switch (command) {
                case "!help":
                    this.sendMessage(sender, "AIMR Commands: !warmup, !aim, !farm, !rng, !help");
                    break;

                case "!warmup":
                case "!wu":
                    await this.handleRecommendation(sender, linkedUser, "warmup", args);
                    break;

                case "!aim":
                    await this.handleRecommendation(sender, linkedUser, "aim", args);
                    break;

                case "!farm":
                    await this.handleRecommendation(sender, linkedUser, "farm", args);
                    break;

                case "!rng":
                case "!random":
                    await this.handleRecommendation(sender, linkedUser, "rng", args);
                    break;

                default:
                    if (message.startsWith("!")) {
                        this.sendMessage(sender, "Unknown command. Try !help");
                    }
                    break;
            }
        } catch (error) {
            console.error(`[IRC] Error handling command:`, error);
            this.sendMessage(sender, "Something went wrong. Try again later!");
        }
    }

    async handleRecommendation(sender, linkedUser, type, args) {
        const count = parseInt(args[0]) || 1;
        const actualCount = Math.min(Math.max(count, 1), 3); // 1-3 maps

        this.sendMessage(sender, `Finding ${type} maps for you...`);

        try {
            // Get user's top plays for analysis
            const topPlays = await getUserTopPlays(linkedUser.osuId, 50);
            
            if (!topPlays || topPlays.length === 0) {
                this.sendMessage(sender, "No top plays found. Play some ranked maps first!");
                return;
            }

            const playstyle = analyzePlaystyle(topPlays);

            let maps = [];
            switch (type) {
                case "warmup":
                    maps = await getWarmupMaps(playstyle, actualCount);
                    break;
                case "aim":
                    maps = await getAimMaps(playstyle, actualCount);
                    break;
                case "farm":
                    maps = await getFarmMaps(playstyle, actualCount);
                    break;
                case "rng":
                    maps = await getRandomMaps(playstyle, actualCount);
                    break;
            }

            if (maps.length === 0) {
                this.sendMessage(sender, "Couldn't find suitable maps. Try again!");
                return;
            }

            // Send map recommendations
            for (const map of maps) {
                const info = formatMapInfo(map);
                // osu! chat clickable format: [url text]
                const mapLink = `[https://osu.ppy.sh/b/${info.beatmapId} ${info.artist} - ${info.title} [${info.difficulty}]]`;
                this.sendMessage(sender, `${mapLink} | ${info.sr}★ | ${info.length} | ${info.bpm}BPM`);
            }

        } catch (error) {
            console.error(`[IRC] Recommendation error:`, error);
            this.sendMessage(sender, "Failed to get recommendations. Try again!");
        }
    }
}

// Start the IRC bot
if (!USERNAME || !PASSWORD) {
    console.error("[IRC] Missing OSU_IRC_USERNAME or OSU_IRC_PASSWORD in .env!");
    process.exit(1);
}

const bot = new BanchoIRC();
bot.connect();

console.log("[IRC] AIMR osu! IRC Bot starting...");
