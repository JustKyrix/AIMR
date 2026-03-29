const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getOsuUser } = require("../osu/osuApi");

// Paths
const linksPath = path.join(__dirname, "..", "storage", "links.json");
const pendingPath = path.join(__dirname, "..", "storage", "pending-links.json");

// Helper: load JSON safely
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

// Helper: save JSON
function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("verify")
        .setDescription("(Admin) Verify a pending osu! link")
        .addStringOption(option =>
            option
                .setName("code")
                .setDescription("The 6-character link code")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("osu_username")
                .setDescription("The osu! username that sent the code")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const code = interaction.options.getString("code").toUpperCase();
        const osuUsername = interaction.options.getString("osu_username");

        // Load pending links
        const pending = loadJSON(pendingPath);
        const links = loadJSON(linksPath);

        // Clean up expired codes first
        const now = Date.now();
        for (const [discordId, data] of Object.entries(pending)) {
            if (data.expiresAt && data.expiresAt < now) {
                delete pending[discordId];
            }
        }
        saveJSON(pendingPath, pending);

        // Find the pending link with this code
        let foundDiscordId = null;
        let foundData = null;
        for (const [discordId, data] of Object.entries(pending)) {
            if (data.code === code) {
                foundDiscordId = discordId;
                foundData = data;
                break;
            }
        }

        if (!foundDiscordId) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ Code Not Found")
                .setDescription(`No pending link found with code \`${code}\``)
                .addFields({
                    name: "Possible reasons",
                    value: "• The code expired (10 minute limit)\n• The code was already used\n• The code was typed incorrectly"
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // Fetch osu! user data to get their ID
        let osuUser;
        try {
            osuUser = await getOsuUser(osuUsername);
        } catch (err) {
            console.error("osu! API error:", err);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ API Error")
                .setDescription("Failed to fetch osu! user data. Try again in a moment.")
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (!osuUser) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("❌ User Not Found")
                .setDescription(`Could not find osu! user: **${osuUsername}**`)
                .addFields({
                    name: "Make sure",
                    value: "• The username is spelled correctly\n• The user exists on osu!"
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // Check if this osu! account is already linked to someone else
        for (const [existingDiscordId, linkData] of Object.entries(links)) {
            if (linkData.osuId === osuUser.id && existingDiscordId !== foundDiscordId) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle("❌ Already Linked")
                    .setDescription(`The osu! account **${osuUser.username}** is already linked to a different Discord account.`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }
        }

        // Create the link!
        links[foundDiscordId] = {
            osuId: osuUser.id,
            osuUsername: osuUser.username,
            linkedAt: Date.now(),
            linkedBy: interaction.user.id // who verified it
        };
        saveJSON(linksPath, links);

        // Remove from pending
        delete pending[foundDiscordId];
        saveJSON(pendingPath, pending);

        // Try to DM the user about successful link
        try {
            const user = await interaction.client.users.fetch(foundDiscordId);
            const dmEmbed = new EmbedBuilder()
                .setColor(0x66FF66)
                .setTitle("✅ Account Linked Successfully!")
                .setDescription(`Your Discord account is now linked to osu! user **${osuUser.username}**!`)
                .setThumbnail(osuUser.avatar_url)
                .addFields(
                    { name: "osu! Username", value: osuUser.username, inline: true },
                    { name: "osu! ID", value: String(osuUser.id), inline: true },
                    { name: "Global Rank", value: osuUser.statistics?.global_rank ? `#${osuUser.statistics.global_rank.toLocaleString()}` : "N/A", inline: true }
                )
                .addFields({
                    name: "What's next?",
                    value: "You can now use all AIMR commands! Try `/warmup`, `/aim`, `/farm`, or `/rng` to get map recommendations."
                })
                .setFooter({ text: "AIMR • osu! Map Recommender" })
                .setTimestamp();

            await user.send({ embeds: [dmEmbed] });
        } catch (err) {
            console.log("Could not DM user about link:", err.message);
        }

        // Confirmation embed for admin
        const embed = new EmbedBuilder()
            .setColor(0x66FF66)
            .setTitle("✅ Link Verified!")
            .setThumbnail(osuUser.avatar_url)
            .addFields(
                { name: "Discord User", value: foundData.discordTag, inline: true },
                { name: "Discord ID", value: foundDiscordId, inline: true },
                { name: "\u200B", value: "\u200B", inline: true },
                { name: "osu! Username", value: osuUser.username, inline: true },
                { name: "osu! ID", value: String(osuUser.id), inline: true },
                { name: "Code Used", value: `\`${code}\``, inline: true }
            )
            .setFooter({ text: "Link saved successfully!" })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
