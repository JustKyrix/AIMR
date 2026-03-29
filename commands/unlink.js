const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

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

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unlink")
        .setDescription("Unlink your osu! account from Discord"),

    async execute(interaction) {
        const discordId = interaction.user.id;
        const links = loadJSON(linksPath);

        if (!links[discordId]) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("Not Linked")
                .setDescription("Your Discord account is not linked to any osu! account.")
                .addFields({
                    name: "Want to link?",
                    value: "Use `/link` to connect your osu! account."
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const oldLink = links[discordId];
        delete links[discordId];
        saveJSON(linksPath, links);

        const embed = new EmbedBuilder()
            .setColor(0xFFAA00)
            .setTitle("🔓 Account Unlinked")
            .setDescription(`Your Discord is no longer linked to **${oldLink.osuUsername}**.`)
            .addFields({
                name: "Want to link again?",
                value: "Use `/link` to connect a different osu! account."
            })
            .setFooter({ text: "AIMR • osu! Map Recommender" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
