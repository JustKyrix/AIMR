// map.js - Redirect to specific recommendation commands
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("map")
        .setDescription("Get a map recommendation (use /warmup, /aim, /farm, or /rng instead)"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0xFF66AA)
            .setTitle("🗺️ Map Recommendations")
            .setDescription("Use one of these specific commands:")
            .addFields(
                { name: "/warmup", value: "Easier maps below your comfort zone", inline: true },
                { name: "/aim", value: "Jump-heavy aim training maps", inline: true },
                { name: "/farm", value: "PP farm maps you could FC", inline: true },
                { name: "/rng", value: "Completely random maps", inline: true }
            )
            .setFooter({ text: "AIMR • Choose your vibe" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};