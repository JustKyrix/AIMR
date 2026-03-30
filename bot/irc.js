// osu! IRC Bot - Handles in-game !commands
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const net = require("net");
const fs = require("fs");
const path = require("path");
const { getOsuUser, getUserTopPlays, analyzePlaystyle } = require("../osu/osuApi");
const { getWarmupMaps, getAimMaps, getJumpMaps, getStreamMaps, getTechMaps, getSpeedMaps, getFarmMaps, getRandomMaps, getChallengeMaps, formatMapInfo, parseMods } = require("../osu/maps");

const IRC_SERVER = "irc.ppy.sh";
const IRC_PORT = 6667;
const USERNAME = process.env.OSU_IRC_USERNAME;
const PASSWORD = process.env.OSU_IRC_PASSWORD;
const DISCORD_LINK = "https://discord.gg/n96VDBb4Vj";

const LINKS_PATH = path.join(__dirname, "..", "storage", "links.json");
const PENDING_PATH = path.join(__dirname, "..", "storage", "pending-links.json");

function loadJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) return {};
        const data = fs.readFileSync(filePath, "utf8");
        return data.trim() ? JSON.parse(data) : {};
    } catch (err) { return {}; }
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function findOsuUserByUsername(username) {
    const links = loadJSON(LINKS_PATH);
    for (const [discordId, data] of Object.entries(links)) {
        if (data.osuUsername && data.osuUsername.toLowerCase() === username.toLowerCase()) {
            return data;
        }
    }
    return null;
}

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
            const lines = this.buffer.split(/\r?\n/);
            this.buffer = lines.pop();
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
        if (!line.includes(" QUIT :")) {
            console.log(`[IRC] < ${line}`);
        }

        if (line.startsWith("PING")) {
            this.send(line.replace("PING", "PONG"));
            return;
        }

        if (line.includes(" 001 ")) {
            this.connected = true;
            console.log("[IRC] Successfully authenticated!");
            return;
        }

        const privmsgMatch = line.match(/^:(\S+)!\S+ PRIVMSG (\S+) :(.+)$/);
        if (privmsgMatch) {
            const [, sender, target, message] = privmsgMatch;
            if (target.toLowerCase() === USERNAME.toLowerCase()) {
                this.handleCommand(sender, message.trim());
            }
        }
    }

    async handleCommand(sender, message) {
        const parts = message.split(" ");
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        console.log(`[IRC] Command from ${sender}: ${command} ${args.join(" ")}`);

        // Valid commands list
        const validCommands = ["!help", "!link", "!warmup", "!wu", "!aim", "!jump", "!stream", "!tech", "!speed", "!farm", "!rng", "!challenge"];

        // Check if it starts with ! but is not a valid command
        if (command.startsWith("!") && !validCommands.includes(command)) {
            this.sendMessage(sender, `Unknown command. Use !help for all commands or join Discord: ${DISCORD_LINK}`);
            return;
        }

        // Handle !link separately (doesn't require being linked)
        if (command === "!link") {
            await this.handleLink(sender, args);
            return;
        }

        // Check if user is linked for other commands
        const linkedUser = findOsuUserByUsername(sender);
        if (!linkedUser && command !== "!help") {
            this.sendMessage(sender, "You're not linked! Use /link in our Discord first, then send !link CODE here.");
            this.sendMessage(sender, `Discord: ${DISCORD_LINK}`);
            return;
        }

        try {
            switch (command) {
                case "!help":
                    this.sendMessage(sender, "Commands: !warmup !aim !jump !stream !tech !speed !farm !rng !challenge");
                    this.sendMessage(sender, "Add mods: !farm dt, !aim hdhr, !stream dthr");
                    this.sendMessage(sender, `Link account: Use /link in Discord, then !link CODE here`);
                    break;
                case "!warmup":
                case "!wu":
                    await this.handleRecommendation(sender, linkedUser, "warmup", args);
                    break;
                case "!aim":
                    await this.handleRecommendation(sender, linkedUser, "aim", args);
                    break;
                case "!jump":
                    await this.handleRecommendation(sender, linkedUser, "jump", args);
                    break;
                case "!stream":
                    await this.handleRecommendation(sender, linkedUser, "stream", args);
                    break;
                case "!tech":
                    await this.handleRecommendation(sender, linkedUser, "tech", args);
                    break;
                case "!speed":
                    await this.handleRecommendation(sender, linkedUser, "speed", args);
                    break;
                case "!farm":
                    await this.handleRecommendation(sender, linkedUser, "farm", args);
                    break;
                case "!rng":
                    await this.handleRecommendation(sender, linkedUser, "rng", args);
                    break;
                case "!challenge":
                    await this.handleRecommendation(sender, linkedUser, "challenge", args);
                    break;
            }
        } catch (error) {
            console.error(`[IRC] Error:`, error);
            this.sendMessage(sender, "Something went wrong. Try again later!");
        }
    }

    async handleLink(sender, args) {
        const code = args[0]?.toUpperCase();
        
        if (!code) {
            this.sendMessage(sender, "Usage: !link CODE - Get your code from /link in Discord");
            this.sendMessage(sender, `Discord: ${DISCORD_LINK}`);
            return;
        }

        // Check if already linked
        const existingLink = findOsuUserByUsername(sender);
        if (existingLink) {
            this.sendMessage(sender, "You're already linked! Use the bot commands like !warmup, !farm, etc.");
            return;
        }

        // Load pending links
        const pending = loadJSON(PENDING_PATH);
        
        // Find the pending link with this code
        let foundDiscordId = null;
        let foundPending = null;
        
        for (const [discordId, data] of Object.entries(pending)) {
            if (data.code === code) {
                foundDiscordId = discordId;
                foundPending = data;
                break;
            }
        }

        if (!foundPending) {
            this.sendMessage(sender, "Invalid or expired code! Get a new one with /link in Discord.");
            return;
        }

        // Check if expired (10 minutes)
        if (Date.now() > foundPending.expiresAt) {
            delete pending[foundDiscordId];
            saveJSON(PENDING_PATH, pending);
            this.sendMessage(sender, "Code expired! Get a new one with /link in Discord.");
            return;
        }

        // Get osu! user info
        try {
            const osuUser = await getOsuUser(sender);
            if (!osuUser) {
                this.sendMessage(sender, "Couldn't find your osu! account. Make sure your username is correct!");
                return;
            }

            // Save the link
            const links = loadJSON(LINKS_PATH);
            links[foundDiscordId] = {
                visitorId: null,
                visitorConfidence: null,
                osuId: osuUser.id,
                osuUsername: osuUser.username,
                linkedAt: new Date().toISOString(),
                verifiedVia: "irc"
            };
            saveJSON(LINKS_PATH, links);

            // Remove from pending
            delete pending[foundDiscordId];
            saveJSON(PENDING_PATH, pending);

            console.log(`[IRC] Linked ${sender} (osu! ID: ${osuUser.id}) to Discord ID: ${foundDiscordId}`);
            
            this.sendMessage(sender, `Successfully linked! Welcome ${osuUser.username}!`);
            this.sendMessage(sender, "You can now use: !warmup !aim !jump !stream !tech !speed !farm !rng !challenge");
            this.sendMessage(sender, "Add mods like: !farm dt, !aim hdhr");

        } catch (error) {
            console.error("[IRC] Link error:", error);
            this.sendMessage(sender, "Error verifying your account. Try again!");
        }
    }

    async handleRecommendation(sender, linkedUser, type, args) {
        let mods = [];
        let count = 1;

        for (const arg of args) {
            const num = parseInt(arg);
            if (!isNaN(num)) {
                count = Math.min(Math.max(num, 1), 3);
            } else if (arg) {
                mods = parseMods(arg);
            }
        }

        const modStr = mods.length > 0 ? " +" + mods.join("") : "";
        this.sendMessage(sender, `Finding ${type}${modStr} maps...`);

        try {
            const topPlays = await getUserTopPlays(linkedUser.osuId, 100);
            if (!topPlays || topPlays.length === 0) {
                this.sendMessage(sender, "No top plays found. Play some ranked maps first!");
                return;
            }

            const playstyle = analyzePlaystyle(topPlays);
            let maps = [];

            switch (type) {
                case "warmup": maps = await getWarmupMaps(playstyle, count, mods); break;
                case "aim": maps = await getAimMaps(playstyle, count, mods); break;
                case "jump": maps = await getJumpMaps(playstyle, count, mods); break;
                case "stream": maps = await getStreamMaps(playstyle, count, mods); break;
                case "tech": maps = await getTechMaps(playstyle, count, mods); break;
                case "speed": maps = await getSpeedMaps(playstyle, count, mods); break;
                case "farm": maps = await getFarmMaps(playstyle, count, mods); break;
                case "rng": maps = await getRandomMaps(playstyle, count, mods); break;
                case "challenge": maps = await getChallengeMaps(playstyle, count, mods); break;
            }

            if (maps.length === 0) {
                this.sendMessage(sender, "Couldn't find suitable maps. Try different mods!");
                return;
            }

            for (const map of maps) {
                const info = await formatMapInfo(map, mods);
                const link = `[https://osu.ppy.sh/b/${info.beatmapId} ${info.artist} - ${info.title} [${info.difficulty}]]`;
                const stats = `${info.mods} ${info.sr}* AR${info.ar} ${info.bpm}BPM ${info.length}`;
                const pp = `95%:${info.pp['95%']}pp 98%:${info.pp['98%']}pp 100%:${info.pp['100%']}pp`;
                this.sendMessage(sender, `${link} | ${stats} | ${pp}`);
            }
        } catch (error) {
            console.error("[IRC] Recommendation error:", error);
            this.sendMessage(sender, "Failed to get recommendations. Try again!");
        }
    }
}

if (!USERNAME || !PASSWORD) {
    console.error("[IRC] Missing OSU_IRC_USERNAME or OSU_IRC_PASSWORD in .env!");
    process.exit(1);
}

const bot = new BanchoIRC();
bot.connect();
console.log("[IRC] AIMR osu! IRC Bot starting...");
