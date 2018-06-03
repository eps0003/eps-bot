const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');

client.on('error', console.error);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username} on ${client.guilds.size} server(s)`);
});

client.on('message', (message) => {
	if (!message.channel.guild || message.guild.id !== config.guild) return;
    if (message.author.bot || message.content.indexOf(config.prefix) !== 0) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
	const command = args.shift().toLowerCase();
	
	if (command === 'ping') {
		message.channel.send('pong');
	}
});

client.login(config.token);