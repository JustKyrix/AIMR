const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getOsuUser, getUserTopPlays, analyzePlaystyle } = require("../osu/osuApi");
const { getWarmupMaps, formatMapInfo } = require("../osu/maps");

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
        .setName("warmup")
        .setDescription("Get easier maps to warm up with")
        .addIntegerOption(option =>
            option
                .setName("count")
                .setDescription("Number of maps (1-5)")
                .setMinValue(1)
                .setMaxValue(5)
                .setRequired(false)
        ),

    async execute(interaction) {
        const discordId = interaction.user.id;
        const count = interaction.options.getInteger("count") || 3;
        const links = loadJSON(linksPath);

        // Check if linked
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

            // Fetch user's top plays to analyze playstyle
            const topPlays = await getUserTopPlays(linkData.osuId, 50);
            
            if (!topPlays || topPlays.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle("📊 Not Enough Data")
                    .setDescription("You don't have enough top plays yet for personalized recommendations.")
                    .addFields({ name: "Tip", value: "Play more ranked maps to build your profile!" })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            // Analyze playstyle
            const playstyle = analyzePlaystyle(topPlays);

            // Get warmup maps
            const maps = await getWarmupMaps(playstyle, count);

            if (maps.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle("🔍 No Maps Found")
                    .setDescription("Couldn't find suitable warmup maps. Try again later!")
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            // Build embed
            const embed = new EmbedBuilder()
                .setColor(0x66CCFF)
                .setTitle("🔥 Warmup Maps")
                .setDescription(`Based on your **${playstyle.avgSR}★** average, here are some easier maps to warm up:\n\n*Target: ${(playstyle.avgSR - 1.5).toFixed(1)}★ - ${(playstyle.avgSR - 0.5).toFixed(1)}★*`)
                .setFooter({ text: `AIMR • ${linkData.osuUsername}` })
                .setTimestamp();

            // Add map fields
            for (let i = 0; i < maps.length; i++) {
                const info = formatMapInfo(maps[i]);
                embed.addFields({
                    name: `${i + 1}. ${info.artist} - ${info.title} [${info.difficulty}]`,
                    value: `⭐ **${info.sr}★** • ⏱️ ${info.length} • ♫ ${info.bpm} BPM\n[🔗 Map Link](${info.url}) • by ${info.creator}`
                });
            }

            // Set thumbnail to first map's cover
            const firstInfo = formatMapInfo(maps[0]);
            if (firstInfo.coverUrl) {
                embed.setThumbnail(firstInfo.coverUrl);
            }

            // Create buttons for direct links
            const row = new ActionRowBuilder();
            for (let i = 0; i < Math.min(maps.length, 5); i++) {
                const info = formatMapInfo(maps[i]);
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel(`Map ${i + 1}`)
                        .setStyle(ButtonStyle.Link)
                        .setURL(info.url)
                );
            }

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error("Warmup command error:", error);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ Error")
                .setDescription("Something went wrong fetching maps. Try again later!")
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
