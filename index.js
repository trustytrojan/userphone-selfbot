import Discord from 'discord.js-selfbot-v13';
import assert from 'node:assert';
import process from 'node:process';

const YGGDRASIL_BOT_ID = '247283454440374274';

(await import('dotenv')).config();
const { TOKEN, CHANNEL_ID, MESSAGE } = process.env;

if (!TOKEN || !CHANNEL_ID || !MESSAGE) {
	throw Error('one of the required environment variables are undefined! check your .env file!');
}

const client = new Discord.Client({ presence: { status: 'invisible' } });
await client.login(TOKEN);
console.log(`Logged in as ${client.user?.tag}`);

// fetch channel
const channel = await client.channels.fetch(CHANNEL_ID);

if (!channel) throw `Channel ${CHANNEL_ID} not found or not accessible!`;
if (!(channel instanceof Discord.TextChannel)) throw `Channel ${CHANNEL_ID} is not a text channel!`;
if (!channel.permissionsFor(channel.guild.members.me, true).has('USE_APPLICATION_COMMANDS'))
	throw `You don't have slash command permissions in channel ${CHANNEL_ID} (${channel.name})!`;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const yggdrasilCommand = async (command) => {
	let msg = await channel.sendSlash(YGGDRASIL_BOT_ID, command);
	assert(msg instanceof Discord.Message);
	while (msg.content.startsWith('That command is on cooldown for **')) {
		const match = msg.content.match(/\b\d+\b/);
		if (!match) {
			throw Error('yggdrasil cooldown message changed!');
		}
		console.log(`cooldown check: matched ${match}`);
		await wait(parseInt(match[0]) * 1e3);
		msg = await channel.sendSlash(YGGDRASIL_BOT_ID, command);
		assert(msg instanceof Discord.Message);
	}
	return msg;
};

const doPhoneCommand = async (phoneCommandType) => {
	await yggdrasilCommand(`${phoneCommandType}phone`);
	await wait(1e3);
	await channel.send(MESSAGE);
	await wait(3e3);
	await yggdrasilCommand('hangup');
};

while (true) {
	await doPhoneCommand('user');
	await doPhoneCommand('speaker');
}
