const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getOsuUser } = require("../osu/osuApi");

const linksPath = path.join(__dirname, "..", "storage", "links.json");

function loadJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, "{}");
            return {};
        }
        const data = fs.readFileSync(filePath, "utf8");
        return data.trim() ? JSON.parse(data) : {};
    } catch (err) {
        console.error(`Error loading ${filePath}:`, err);
        return {};
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("View your linked osu! profile")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("View another user's profile")
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser("user") || interaction.user;
        const discordId = targetUser.id;
        const links = loadJSON(linksPath);

        if (!links[discordId]) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("Not Linked")
                .setDescription(
                    targetUser.id === interaction.user.id
                        ? "You haven't linked your osu! account yet.\nUse `/link` to get started!"
                        : `**${targetUser.username}** hasn't linked their osu! account.`
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        const linkData = links[discordId];

        // Fetch fresh osu! data
        let osuUser;
        try {
            osuUser = await getOsuUser(linkData.osuUsername);
        } catch (err) {
            console.error("osu! API error:", err);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("API Error")
                .setDescription("Couldn't fetch osu! profile data. Try again later.")
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (!osuUser) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("User Not Found")
                .setDescription(`The linked osu! account **${linkData.osuUsername}** couldn't be found.`)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        const stats = osuUser.statistics || {};
        const rank = stats.global_rank;
        const countryRank = stats.country_rank;
        const pp = stats.pp;
        const accuracy = stats.hit_accuracy;
        const playcount = stats.play_count;
        const playtime = stats.play_time; // in seconds

        // Format playtime
        const hours = playtime ? Math.floor(playtime / 3600) : 0;

        const embed = new EmbedBuilder()
            .setColor(0xFF66AA)
            .setTitle(`🎮 ${osuUser.username}`)
            .setURL(`https://osu.ppy.sh/users/${osuUser.id}`)
            .setThumbnail(osuUser.avatar_url)
            .setDescription(`**${targetUser.username}**'s linked osu! profile`)
            .addFields(
                { name: "🌍 Global Rank", value: rank ? `#${rank.toLocaleString()}` : "N/A", inline: true },
                { name: `🏴 ${osuUser.country?.name || "Country"} Rank`, value: countryRank ? `#${countryRank.toLocaleString()}` : "N/A", inline: true },
                { name: "📊 PP", value: pp ? `${Math.round(pp).toLocaleString()}pp` : "N/A", inline: true },
                { name: "🎯 Accuracy", value: accuracy ? `${accuracy.toFixed(2)}%` : "N/A", inline: true },
                { name: "🎮 Play Count", value: playcount ? playcount.toLocaleString() : "N/A", inline: true },
                { name: "⏱️ Play Time", value: `${hours.toLocaleString()}h`, inline: true }
            )
            .setImage(osuUser.cover_url || null)
            .setFooter({ text: `osu! ID: ${osuUser.id} • AIMR` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};