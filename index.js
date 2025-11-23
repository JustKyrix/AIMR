require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // enough for slash commands
    ]
});

client.once("ready", () => {
    console.log(`AIMR is online as ${client.user.tag}`);
    client.user.setActivity("osu!", { type: 0 });
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    console.log(`Received command: /${interaction.commandName}`);

    if (interaction.commandName === "ping") {
        await interaction.reply("pong 🏓");
    }
    if (interaction.commandName === "play") {
        await interaction.reply("more osu!");
    }
});

client.login(process.env.DISCORD_TOKEN);
