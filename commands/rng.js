const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getUserTopPlays, analyzePlaystyle } = require("../osu/osuApi");
const { getRandomMaps, formatMapInfo } = require("../osu/maps");

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

// Fun random messages
const rngMessages = [
    "The osu! gods have spoken:",
    "Your fate is sealed:",
    "The algorithm demands:",
    "RNGesus blesses you with:",
    "Spin the wheel, get the deal:",
    "Today's chaos menu:",
    "Random map generator go brrr:",
    "What could possibly go wrong?",
    "The dice have been cast:",
    "May the circles be ever in your favor:"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rng")
        .setDescription("Get completely random maps (chaos mode)")
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
            const maps = await getRandomMaps(playstyle, count);

            if (maps.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle("🔍 No Maps Found")
                    .setDescription("The RNG gods failed you. Try again!")
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            const randomMessage = rngMessages[Math.floor(Math.random() * rngMessages.length)];

            const embed = new EmbedBuilder()
                .setColor(0xAA66FF)
                .setTitle("🎲 RNG Maps")
                .setDescription(`${randomMessage}\n\n*Wide SR range: ${(playstyle.avgSR - 2).toFixed(1)}★ - ${(playstyle.avgSR + 1.5).toFixed(1)}★*`)
                .setFooter({ text: `AIMR • ${linkData.osuUsername} • No refunds` })
                .setTimestamp();

            for (let i = 0; i < maps.length; i++) {
                const info = formatMapInfo(maps[i]);
                const srDiff = (parseFloat(info.sr) - playstyle.avgSR).toFixed(1);
                const diffLabel = srDiff > 0 ? `+${srDiff}` : srDiff;
                
                embed.addFields({
                    name: `${i + 1}. ${info.artist} - ${info.title} [${info.difficulty}]`,
                    value: `⭐ **${info.sr}★** (${diffLabel} from avg) • ⏱️ ${info.length} • ♫ ${info.bpm} BPM\n[🔗 Map Link](${info.url})`
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

            // Add "Reroll" info
            embed.addFields({
                name: "🔄 Don't like these?",
                value: "Run `/rng` again for new random picks!"
            });

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error("RNG command error:", error);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ Error")
                .setDescription("The RNG broke. Try again!")
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
