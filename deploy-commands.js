require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with pong."),
    new SlashCommandBuilder()
        .setName("play")
        .setDescription("Test command: says 'more osu!'")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log("Registering slash commands...");

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log("Slash commands registered successfully.");
    } catch (error) {
        console.error("Error while registering commands:", error);
    }
})();
