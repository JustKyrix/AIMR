require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // enough for slash commands
    ]
});

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
    client.user.setActivity("osu! | /link", { type: 0 });
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.log(`Unknown command: /${interaction.commandName}`);
        
        // Handle legacy commands for backwards compatibility
        if (interaction.commandName === "ping") {
            return interaction.reply("pong 🏓");
        }
        if (interaction.commandName === "play") {
            return interaction.reply("more osu!");
        }
        if (interaction.commandName === "mizu") {
            return interaction.reply("her spelling is terrible...");
        }
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
