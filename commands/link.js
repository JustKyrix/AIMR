const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

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

// Generate random 6-char alphanumeric code
function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0,O,1,I)
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("link")
        .setDescription("Link your osu! account to Discord")
        .addStringOption(option =>
            option
                .setName("username")
                .setDescription("Your osu! username (for display only)")
                .setRequired(false)
        ),

    async execute(interaction) {
        const discordId = interaction.user.id;
        const discordTag = interaction.user.tag;
        const osuUsernameHint = interaction.options.getString("username") || null;

        // Load current links
        const links = loadJSON(linksPath);

        // Check if already linked
        if (links[discordId]) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle("Already Linked!")
                .setDescription(`Your Discord is already linked to osu! user **${links[discordId].osuUsername}** (ID: ${links[discordId].osuId})`)
                .addFields(
                    { name: "Want to unlink?", value: "Use `/unlink` to remove the connection." }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Generate unique code
        const pending = loadJSON(pendingPath);
        let code;
        do {
            code = generateCode();
        } while (Object.values(pending).some(p => p.code === code));

        // Store pending link (expires in 10 minutes)
        pending[discordId] = {
            code: code,
            discordTag: discordTag,
            osuUsernameHint: osuUsernameHint,
            createdAt: Date.now(),
            expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
        };
        saveJSON(pendingPath, pending);

        // Create response embed
        const embed = new EmbedBuilder()
            .setColor(0xFF66AA)
            .setTitle("🔗 Link Your osu! Account")
            .setDescription("Follow these steps to link your osu! account:")
            .addFields(
                { 
                    name: "Step 1", 
                    value: "Open osu! and send a **private message** to **Kyrix** (or the AIMR bot account)" 
                },
                { 
                    name: "Step 2", 
                    value: `Send this message:\n\`\`\`!link ${code}\`\`\`` 
                },
                { 
                    name: "Step 3", 
                    value: "Wait for confirmation! The link will be verified automatically." 
                },
                {
                    name: "⏰ Code Expires",
                    value: "This code is valid for **10 minutes**.",
                    inline: true
                },
                {
                    name: "🔐 Your Code",
                    value: `\`${code}\``,
                    inline: true
                }
            )
            .setFooter({ text: "AIMR • osu! Map Recommender" })
            .setTimestamp();

        // Add username hint if provided
        if (osuUsernameHint) {
            embed.addFields({
                name: "📝 Username Hint",
                value: `You mentioned: **${osuUsernameHint}**\nWe'll verify this matches the account that sends the code.`
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
