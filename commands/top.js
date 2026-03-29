const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getUserTopPlays } = require("../osu/osuApi");

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
        .setName("top")
        .setDescription("View your top plays")
        .addIntegerOption(option =>
            option
                .setName("count")
                .setDescription("Number of plays to show (1-10)")
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("View another user's top plays")
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser("user") || interaction.user;
        const discordId = targetUser.id;
        const count = interaction.options.getInteger("count") || 5;
        const links = loadJSON(linksPath);

        if (!links[discordId]) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("🔗 Not Linked")
                .setDescription(
                    targetUser.id === interaction.user.id
                        ? "You need to link your osu! account first!\nUse `/link` to get started."
                        : `**${targetUser.username}** hasn't linked their osu! account.`
                )
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const linkData = links[discordId];
            const topPlays = await getUserTopPlays(linkData.osuId, count);

            if (!topPlays || topPlays.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle("🎮 No Top Plays")
                    .setDescription("No top plays found. Play some ranked maps!")
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            // Calculate total PP from top plays (weighted)
            let weightedPP = 0;
            topPlays.forEach((play, i) => {
                if (play.pp) {
                    weightedPP += play.pp * Math.pow(0.95, i);
                }
            });

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle(`🏆 Top Plays - ${linkData.osuUsername}`)
                .setDescription(`Showing top ${topPlays.length} plays`)
                .setFooter({ text: "AIMR • osu! Map Recommender" })
                .setTimestamp();

            for (let i = 0; i < topPlays.length; i++) {
                const play = topPlays[i];
                const beatmap = play.beatmap || {};
                const beatmapset = play.beatmapset || {};

                const grade = play.rank || "?";
                const gradeEmoji = gradeEmojis[grade] || "❓";
                const acc = ((play.accuracy || 0) * 100).toFixed(2);
                const pp = play.pp ? Math.round(play.pp) : "—";
                const combo = play.max_combo || 0;
                const maxCombo = beatmap.max_combo || "?";
                const mods = play.mods?.length > 0 ? `+${play.mods.join("")}` : "NM";

                const title = `${beatmapset.artist || "?"} - ${beatmapset.title || "?"} [${beatmap.version || "?"}]`;
                const sr = beatmap.difficulty_rating?.toFixed(2) || "?";

                // Weight indicator
                const weight = Math.pow(0.95, i) * 100;

                embed.addFields({
                    name: `#${i + 1} ${gradeEmoji} ${title}`,
                    value: `⭐ **${sr}★** ${mods} • **${acc}%** • ${combo}/${maxCombo}x\n**${pp}pp** (${weight.toFixed(0)}% weight) • [Map](https://osu.ppy.sh/b/${beatmap.id})`
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Top command error:", error);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ Error")
                .setDescription("Couldn't fetch top plays. Try again later!")
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
};