const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

const pendingPath = path.join(__dirname, "..", "storage", "pending-links.json");

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
        .setName("pending")
        .setDescription("(Admin) View all pending link requests")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const pending = loadJSON(pendingPath);
        const now = Date.now();

        // Clean up expired codes
        let expiredCount = 0;
        for (const [discordId, data] of Object.entries(pending)) {
            if (data.expiresAt && data.expiresAt < now) {
                delete pending[discordId];
                expiredCount++;
            }
        }
        if (expiredCount > 0) {
            saveJSON(pendingPath, pending);
        }

        const entries = Object.entries(pending);

        if (entries.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x888888)
                .setTitle("📋 Pending Links")
                .setDescription("No pending link requests.")
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Build list
        const fields = entries.slice(0, 10).map(([discordId, data]) => {
            const timeLeft = Math.max(0, Math.floor((data.expiresAt - now) / 60000));
            const usernameHint = data.osuUsernameHint ? `\nHint: **${data.osuUsernameHint}**` : "";
            
            return {
                name: `Code: \`${data.code}\``,
                value: `Discord: ${data.discordTag}\nID: \`${discordId}\`\nExpires in: **${timeLeft} min**${usernameHint}`,
                inline: true
            };
        });

        const embed = new EmbedBuilder()
            .setColor(0xFF66AA)
            .setTitle("📋 Pending Links")
            .setDescription(`There are **${entries.length}** pending link request(s).\n\nWhen someone sends you \`!link CODE\` in osu!, use:\n\`/verify code:XXXXXX osu_username:theirname\``)
            .addFields(fields)
            .setFooter({ text: entries.length > 10 ? `Showing 10 of ${entries.length}` : `${entries.length} pending` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
