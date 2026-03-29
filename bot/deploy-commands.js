require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Load all command files
const commands = [];
const commandsPath = path.join(__dirname, "..", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ("data" in command) {
        commands.push(command.data.toJSON());
        console.log(`📦 Registered: /${command.data.name}`);
    } else {
        console.warn(`⚠️ Command at ${filePath} is missing "data".`);
    }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`\n🔄 Registering ${commands.length} slash commands...\n`);

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log(`\n✅ Successfully registered ${commands.length} slash commands!`);
    } catch (error) {
        console.error("❌ Error while registering commands:", error);
    }
})();
