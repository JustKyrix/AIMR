require("dotenv").config();
const { Client, GatewayIntentBits, Collection, ActivityType } = require("discord.js");
const fs = require("fs");
const path = require("path");
const net = require("net");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ]
});

// Check if IRC bot is online by checking if osu! IRC is reachable with our account
async function checkIRCStatus() {
    const pm2Path = "/root/aimr";
    try {
        const { execSync } = require("child_process");
        const result = execSync("pm2 jlist", { encoding: "utf8" });
        const processes = JSON.parse(result);
        const ircProcess = processes.find(p => p.name === "aimr-irc");
        return ircProcess && ircProcess.pm2_env.status === "online";
    } catch (err) {
        return false;
    }
}

// Update bot status based on IRC availability
async function updateStatus() {
    const ircOnline = await checkIRCStatus();
    
    if (ircOnline) {
        client.user.setPresence({
            activities: [{ name: "osu! | /link", type: ActivityType.Playing }],
            status: "online"
        });
    } else {
        client.user.setPresence({
            activities: [{ name: "⚠️ IRC Offline - Owner is playing", type: ActivityType.Custom }],
            status: "idle"
        });
    }
}

// Load commands into a collection
client.commands = new Collection();
const commandsPath = path.join(__dirname, "..", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
    } else {
        console.warn(`[WARNING] Command at ${filePath} is missing "data" or "execute".`);
    }
}

client.once("ready", () => {
    console.log(`\n✨ AIMR is online as ${client.user.tag}`);
    console.log(`📁 Loaded ${client.commands.size} commands\n`);
    
    // Initial status check
    updateStatus();
    
    // Check IRC status every 30 seconds
    setInterval(updateStatus, 30000);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.log(`Unknown command: /${interaction.commandName}`);
        return;
    }

    try {
        console.log(`[CMD] ${interaction.user.tag} used /${interaction.commandName}`);
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing /${interaction.commandName}:`, error);
        const errorMsg = { content: "There was an error executing this command!", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMsg);
        } else {
            await interaction.reply(errorMsg);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
