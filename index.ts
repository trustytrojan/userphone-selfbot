import Discord from 'discord.js-selfbot-v13';
import assert from 'node:assert';
import process from 'node:process';

const YGGDRASIL_BOT_ID = '247283454440374274';

(await import('dotenv')).config();
const { CHANNEL_ID, MESSAGE } = process.env;

if (!CHANNEL_ID || !MESSAGE) {
	throw Error('one of the required environment variables are undefined! check your .env file!');
}

const client = new Discord.Client({ presence: { status: 'invisible' } });
await client.login();
console.log(`Logged in as ${client.user?.tag}`);

// fetch channel
const channel = await client.channels.fetch(CHANNEL_ID);

if (!channel) throw `Channel ${CHANNEL_ID} not found or not accessible!`;
if (!(channel instanceof Discord.TextChannel)) throw `Channel ${CHANNEL_ID} is not a text channel!`;
if (!channel.permissionsFor(channel.guild.members.me!, true).has('USE_APPLICATION_COMMANDS'))
	throw `You don't have slash command permissions in channel ${CHANNEL_ID} (${channel.name})!`;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const refetchMessage = async (msg: Discord.Message) => {
	return (await channel.messages.fetch({ around: msg.id, limit: 1 })).first()!;
};

/*
discovered this in an annoying way, but the message received after sending an interaction
ALWAYS has an empty content string, EXCEPT if the response is ephemeral...
so we need to refetch the message to get the content 😭
*/

const yggdrasilCommand = async (command: string) => {
	let msg = await channel.sendSlash(YGGDRASIL_BOT_ID, command);
	assert(msg instanceof Discord.Message);
	if (msg.content.length === 0) msg = await refetchMessage(msg);
	while (msg.content.startsWith('That command is on cooldown for **')) {
		const match = msg.content.match(/\b\d+\b/);
		if (!match) throw Error('yggdrasil cooldown message changed!');
		console.log(`cooldown check: matched ${match}`);
		await wait(parseInt(match[0]) * 1e3);
		msg = await channel.sendSlash(YGGDRASIL_BOT_ID, command);
		assert(msg instanceof Discord.Message);
		if (msg.content.length === 0) msg = await refetchMessage(msg);
	}
	return msg;
};

const doPhoneCommand = async (phoneType: string) => {
	const msg = await yggdrasilCommand(`${phoneType}phone`);
	if (msg.content.includes('Calling on userphone...')) {
		// wait for userphone connection
		await channel.awaitMessages({
			filter: m =>
				m.author.id === YGGDRASIL_BOT_ID && m.content.includes(`A ${phoneType}phone connection has been made!`),
			max: 1
		});
	}
	await wait(1e3); // 1 second
	await channel.send(MESSAGE);
	const coll = await channel.awaitMessages({
		filter: m =>
			m.author.id === YGGDRASIL_BOT_ID &&
			(m.content.includes('The other side hung up the userphone.') ||
				m.content.includes('The userphone connection has been lost.')),
		time: 3e3 // 3 seconds, or until hangup/disconnect
	});
	if (coll.size > 0)
		// userphone ended, return
		return;
	await yggdrasilCommand('hangup');
};

while (true) {
	await doPhoneCommand('user');
	await doPhoneCommand('speaker');
}
