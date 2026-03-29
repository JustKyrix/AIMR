const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show all AIMR commands"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0xFF66AA)
            .setTitle("🎯 AIMR - osu! Map Recommender")
            .setDescription("Personalized beatmap recommendations based on your playstyle!")
            .addFields(
                {
                    name: "🗺️ Map Recommendations",
                    value: [
                        "`/warmup` - Easier maps to warm up with",
                        "`/aim` - Jump-heavy aim training maps",
                        "`/farm` - PP farm maps you could FC",
                        "`/rng` - Completely random maps (chaos mode)"
                    ].join("\n")
                },
                {
                    name: "📊 Stats & Info",
                    value: [
                        "`/stats` - View your playstyle analysis",
                        "`/profile` - View your osu! profile",
                        "`/top [count]` - View your top plays",
                        "`/recent [count]` - View your recent plays"
                    ].join("\n")
                },
                {
                    name: "🔗 Account Linking",
                    value: [
                        "`/link` - Link your osu! account",
                        "`/unlink` - Unlink your osu! account"
                    ].join("\n")
                },
                {
                    name: "ℹ️ How It Works",
                    value: "AIMR analyzes your top 50-100 plays to understand your comfort zone, preferred map length, BPM range, and playstyle. Recommendations are personalized based on this data."
                },
                {
                    name: "🔧 Options",
                    value: "Most commands accept a `count` option (1-5) to specify how many maps you want."
                }
            )
            .setFooter({ text: "AIMR • Made with ❤️ for the osu! community" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
