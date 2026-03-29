const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getUserTopPlays, analyzePlaystyle } = require("../osu/osuApi");
const { getFarmMaps, formatMapInfo, estimatePP } = require("../osu/maps");

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
        .setName("farm")
        .setDescription("Get PP farm maps you could FC")
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
            const topPlays = await getUserTopPlays(linkData.osuId, 50);
            
            if (!topPlays || topPlays.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle("📊 Not Enough Data")
                    .setDescription("You don't have enough top plays yet.")
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            const playstyle = analyzePlaystyle(topPlays);
            const maps = await getFarmMaps(playstyle, count);

            if (maps.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle("🔍 No Maps Found")
                    .setDescription("Couldn't find suitable farm maps. Try again later!")
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setColor(0x66FF66)
                .setTitle("🌾 PP Farm Maps")
                .setDescription(`Maps close to your skill level for PP gains!\n\n*Your average: ${playstyle.avgSR}★ • ${playstyle.avgPP}pp avg*`)
                .setFooter({ text: `AIMR • ${linkData.osuUsername} • PP estimates are rough approximations` })
                .setTimestamp();

            for (let i = 0; i < maps.length; i++) {
                const info = formatMapInfo(maps[i]);
                const estPP = estimatePP(parseFloat(info.sr), playstyle.avgAcc);
                embed.addFields({
                    name: `${i + 1}. ${info.artist} - ${info.title} [${info.difficulty}]`,
                    value: `⭐ **${info.sr}★** • ⏱️ ${info.length} • ~**${estPP}pp** potential\n[🔗 Map Link](${info.url})`
                });
            }

            const firstInfo = formatMapInfo(maps[0]);
            if (firstInfo.coverUrl) embed.setThumbnail(firstInfo.coverUrl);

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
            console.error("Farm command error:", error);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ Error")
                .setDescription("Something went wrong. Try again later!")
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
