const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getUserRecentPlays } = require("../osu/osuApi");

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

// Grade emojis
const gradeEmojis = {
    "XH": "🏆",
    "X": "🥇", 
    "SH": "✨",
    "S": "⭐",
    "A": "🟢",
    "B": "🔵",
    "C": "🟡",
    "D": "🔴",
    "F": "💀"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("recent")
        .setDescription("View your recent plays")
        .addIntegerOption(option =>
            option
                .setName("count")
                .setDescription("Number of plays to show (1-10)")
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName("passes")
                .setDescription("Only show passed plays")
                .setRequired(false)
        ),

    async execute(interaction) {
        const discordId = interaction.user.id;
        const count = interaction.options.getInteger("count") || 5;
        const passesOnly = interaction.options.getBoolean("passes") || false;
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
            const recentPlays = await getUserRecentPlays(linkData.osuId, 50, !passesOnly);

            if (!recentPlays || recentPlays.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle("🎮 No Recent Plays")
                    .setDescription("No recent plays found. Go play some osu!")
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            // Filter to requested count
            const plays = recentPlays.slice(0, count);

            const embed = new EmbedBuilder()
                .setColor(0xFF66AA)
                .setTitle(`🎮 Recent Plays - ${linkData.osuUsername}`)
                .setDescription(passesOnly ? "*Showing passed plays only*" : "*Including failed plays*")
                .setFooter({ text: "AIMR • osu! Map Recommender" })
                .setTimestamp();

            for (let i = 0; i < plays.length; i++) {
                const play = plays[i];
                const beatmap = play.beatmap || {};
                const beatmapset = play.beatmapset || {};

                const grade = play.rank || "F";
                const gradeEmoji = gradeEmojis[grade] || "❓";
                const acc = ((play.accuracy || 0) * 100).toFixed(2);
                const pp = play.pp ? `${Math.round(play.pp)}pp` : "—";
                const combo = play.max_combo || 0;
                const maxCombo = beatmap.max_combo || "?";
                const mods = play.mods?.length > 0 ? `+${play.mods.join("")}` : "NM";

                const title = `${beatmapset.artist || "?"} - ${beatmapset.title || "?"} [${beatmap.version || "?"}]`;
                const sr = beatmap.difficulty_rating?.toFixed(2) || "?";

                // Time ago
                const playedAt = new Date(play.created_at);
                const ago = getTimeAgo(playedAt);

                embed.addFields({
                    name: `${gradeEmoji} ${title}`,
                    value: `⭐ **${sr}★** ${mods} • **${acc}%** • ${combo}/${maxCombo}x • ${pp}\n${ago} • [Map](https://osu.ppy.sh/b/${beatmap.id})`
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Recent command error:", error);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ Error")
                .setDescription("Couldn't fetch recent plays. Try again later!")
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
}