require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.TATTLE_CHANNEL_ID;
const GRACE_MINUTES = 0;
const CHECK_SECONDS = 10;
const PING_USER = true;

const MESSAGES = [
    '{name} is playing World of Warcraft by themselves again.',
    '{name} is in Azeroth alone.', 
    'Reporting {name} for solo WoW.',
    '{name} is powerless over WoW, and their life has become unmanageable.'
];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

const soloSince = new Map();
const reported = new Set();

function isPlayingWow(member) {
    const activities = member.presence?.activities ?? [];
    return activities.some(
        (a) => a.type === ActivityType.Playing && a.name?.startsWith('World of Warcraft')
    );
}

function hasCompany(member, wowPlayers) {
    return (wowPlayers.some((p) => p.id !== member.id));
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function scan() {

    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) return;

    const now = Date.now();
    const players = channel.guild.members.cache.filter(
        (m) => !m.user.bot && isPlayingWow(m)
    );
    const playerList = [...players.values()];
    console.log('Wow players:', playerList.map((m) => m.displayName));

    for (const id of soloSince.keys()) if (!players.has(id)) soloSince.delete(id);
    for (const id of reported) if (!players.has(id)) reported.delete(id);

    for (const member of playerList) {
        if (hasCompany(member, playerList)) {
            soloSince.delete(member.id);
            continue;
        }
        if (!soloSince.has(member.id)) soloSince.set(member.id, now);

        const soloFor = now - soloSince.get(member.id);
        if (!reported.has(member.id) && soloFor >= GRACE_MINUTES * 60 * 1000) {
            const name = PING_USER ? `<@${member.id}>` : member.displayName;
            const text = pick(MESSAGES)
                .replace('{name}', name)
                .replace('{minutes}', GRACE_MINUTES);
            await channel.send(text);
            reported.add(member.id);
        }
    }
}

client.once('ready', async () => {
    console.log('Logged in as ${client.user.tag}');
    const channel = await client.channels.fetch(CHANNEL_ID);
    await channel.guild.members.fetch({ withPresences: true});
    setInterval(() => scan().catch(console.error), CHECK_SECONDS * 1000);
});

client.login(TOKEN);