// pp.js - PP info and farm recommendations
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getOsuUser, getUserTopPlays, analyzePlaystyle } = require("../osu/osuApi");

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
        .setName("pp")
        .setDescription("View your PP stats and what you need for gains"),

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
            
            // Fetch user and top plays
            const [user, topPlays] = await Promise.all([
                getOsuUser(linkData.osuId),
                getUserTopPlays(linkData.osuId, 100)
            ]);

            if (!user || !topPlays || topPlays.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle("📊 Not Enough Data")
                    .setDescription("Couldn't fetch your PP data.")
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            const stats = user.statistics || {};
            const totalPP = stats.pp || 0;

            // Calculate weighted PP from top plays
            let weightedSum = 0;
            let weightSum = 0;
            const topPPs = [];

            for (let i = 0; i < topPlays.length; i++) {
                const weight = Math.pow(0.95, i);
                const pp = topPlays[i].pp || 0;
                weightedSum += pp * weight;
                weightSum += weight;
                if (i < 10) topPPs.push(Math.round(pp));
            }

            // What PP play would be worth it?
            const top1PP = topPlays[0]?.pp || 0;
            const top5PP = topPlays[4]?.pp || 0;
            const top10PP = topPlays[9]?.pp || 0;
            const top25PP = topPlays[24]?.pp || 0;

            // Estimate PP needed for meaningful gain
            const bonusPP = totalPP - weightedSum; // Rough bonus PP estimate

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle(`📈 PP Analysis - ${linkData.osuUsername}`)
                .setThumbnail(user.avatar_url)
                .addFields(
                    { name: "🏆 Total PP", value: `**${Math.round(totalPP)}pp**`, inline: true },
                    { name: "🌍 Global Rank", value: `#${stats.global_rank?.toLocaleString() || "?"}`, inline: true },
                    { name: "🏠 Country Rank", value: `#${stats.country_rank?.toLocaleString() || "?"}`, inline: true },
                    { 
                        name: "📊 Top Play Distribution", 
                        value: `#1: **${Math.round(top1PP)}pp**\n#5: **${Math.round(top5PP)}pp**\n#10: **${Math.round(top10PP)}pp**\n#25: **${Math.round(top25PP)}pp**`,
                        inline: true
                    },
                    {
                        name: "🎯 PP Thresholds",
                        value: [
                            `To enter Top 5: **>${Math.round(top5PP)}pp**`,
                            `To enter Top 10: **>${Math.round(top10PP)}pp**`,
                            `To enter Top 25: **>${Math.round(top25PP)}pp**`
                        ].join("\n"),
                        inline: true
                    },
                    {
                        name: "💡 Tips",
                        value: [
                            `• A **${Math.round(top1PP * 1.1)}pp** play would boost your rank significantly`,
                            `• Plays below **${Math.round(top25PP)}pp** won't affect your total much`,
                            `• Use \`/farm\` to find maps near your skill level`
                        ].join("\n")
                    }
                )
                .setFooter({ text: "AIMR • PP calculations are estimates" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("PP command error:", error);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ Error")
                .setDescription("Couldn't fetch PP data. Try again later!")
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
};