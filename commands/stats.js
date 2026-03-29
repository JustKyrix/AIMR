const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getUserTopPlays, analyzePlaystyle } = require("../osu/osuApi");

const linksPath = path.join(__dirname, "..", "storage", "links.json");

function loadJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) return {};
        const data = fs.readFileSync(filePath, "utf8");
        return data.trim() ? JSON.parse(data) : {};
    } catch (err) {
        return {};
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("View your playstyle analysis"),

    async execute(interaction) {
        const discordId = interaction.user.id;
        const links = loadJSON(linksPath);

        if (!links[discordId]) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("🔗 Not Linked")
                .setDescription("You need to link your osu! account first!")
                .addFields({ name: "How to link", value: "Use `/link` to connect your osu! account." })
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const linkData = links[discordId];
            const topPlays = await getUserTopPlays(linkData.osuId, 100);

            if (!topPlays || topPlays.length < 10) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle("📊 Not Enough Data")
                    .setDescription("You need at least 10 top plays for analysis.")
                    .addFields({ name: "Tip", value: "Play more ranked maps to build your profile!" })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            const stats = analyzePlaystyle(topPlays);

            // Format playtime
            const avgMins = Math.floor(stats.avgLength / 60);
            const avgSecs = stats.avgLength % 60;

            // Strength badges
            const strengthBadges = {
                "aim": "🎯 Aim",
                "streams": "🌊 Streams",
                "tech": "🔧 Tech",
                "accuracy": "🎯 Accuracy",
                "consistency": "💪 Consistency"
            };

            const strengthList = stats.strengths.length > 0
                ? stats.strengths.map(s => strengthBadges[s] || s).join(" • ")
                : "Still developing!";

            // Length preference
            const lengthLabels = {
                "short": "⚡ Short (< 1:30)",
                "medium": "⏱️ Medium (1:30 - 4:00)",
                "long": "🏃 Long (> 4:00)"
            };

            const embed = new EmbedBuilder()
                .setColor(0xFF66AA)
                .setTitle(`📊 Playstyle Analysis - ${linkData.osuUsername}`)
                .setDescription(`Based on your top ${topPlays.length} plays`)
                .addFields(
                    { name: "⭐ Average Star Rating", value: `**${stats.avgSR}★**`, inline: true },
                    { name: "🎯 Average Accuracy", value: `**${stats.avgAcc}%**`, inline: true },
                    { name: "📈 Average PP", value: `**${stats.avgPP}pp**`, inline: true },
                    { name: "♫ Average BPM", value: `**${stats.avgBPM}**`, inline: true },
                    { name: "⏱️ Average Length", value: `**${avgMins}:${avgSecs.toString().padStart(2, "0")}**`, inline: true },
                    { name: "📏 Preferred Length", value: lengthLabels[stats.preferredLength], inline: true },
                    { name: "🎮 Comfort Zone", value: `**${stats.comfortSR.min.toFixed(2)}★** - **${stats.comfortSR.max.toFixed(2)}★**`, inline: false },
                    { name: "💪 Strengths", value: strengthList, inline: false }
                )
                .addFields({
                    name: "📌 Recommendations",
                    value: `• **Warmup:** ${(stats.avgSR - 1).toFixed(1)}★ - ${(stats.avgSR - 0.5).toFixed(1)}★\n• **Farm:** ${(stats.avgSR - 0.3).toFixed(1)}★ - ${(stats.avgSR + 0.2).toFixed(1)}★\n• **Push:** ${(stats.avgSR + 0.3).toFixed(1)}★ - ${(stats.avgSR + 1).toFixed(1)}★`
                })
                .setFooter({ text: "AIMR • Use /warmup, /aim, /farm, /rng for recommendations" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Stats command error:", error);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ Error")
                .setDescription("Couldn't analyze playstyle. Try again later!")
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
