const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const func = require('./functions.js');
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
const mysql = require('mysql');
exports.client = client;

const pool = mysql.createPool({
	host: config.sql.host || process.env.HOST,
	user: config.sql.user || process.env.USER,
	password: config.sql.password || process.env.PASSWORD,
	database: config.sql.database || process.env.DATABASE,
	multipleStatements: true
});

var messages = {
    mainServerList: null,
    ausServerList: null
};

client.on('error', console.error);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username} on ${client.guilds.size} server(s)`);

	func.getChannel(config.mainServerList.channel).fetchMessage(config.mainServerList.message).then((message) => {
		messages.mainServerList = message;
		console.log('Fetched main server list');
	}).catch((err) => {
		if (err) console.log('Error fetching main server list');
	});
	func.getChannel(config.ausServerList.channel).fetchMessage(config.ausServerList.message).then((message) => {
		messages.ausServerList = message;
		console.log('Fetched Aussie server list');
	}).catch((err) => {
		if (err) console.log('Error fetching Aussie server list');
	});
	loop();
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

function httpGetAsync(url, callback) {
	let xmlHttp = new XMLHttpRequest();
	xmlHttp.onreadystatechange = function () {
		if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
			callback(JSON.parse(xmlHttp.responseText));
		}
	}
	xmlHttp.open("GET", url, true);
	xmlHttp.send(null);
}

function loop() {
	httpGetAsync('https://api.kag2d.com/v1/game/thd/kag/servers?filters=[{"field":"current","op":"eq","value":"true"},{"field":"connectable","op":"eq","value":true},{"field":"currentPlayers","op":"gt","value":"0"}]', (servers) => {
		servers = servers.serverList.sort((a, b) => {
			if (a.currentPlayers === b.currentPlayers) {
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
			}
			return b.currentPlayers - a.currentPlayers;
		});
		for (let i = 0; i < servers.length; i++) {
			servers[i].playerList.sort((a, b) => {
				return a.toLowerCase().localeCompare(b.toLowerCase());
			});
		}
		updateMainServerList(servers);
		updateAusServerList(servers);
	});
	let delay = 10000 - new Date() % 10000;
	setTimeout(loop, delay);
}

function updateMainServerList(servers) {
	if (!messages.mainServerList) return;
	let text = '```md\n' + `# Server list - ${servers.length} servers, ${servers.reduce((t, x) => {return t + x.currentPlayers}, 0)} players` + '``````diff';
	if (!servers.length) text += '\n​';
	for (let i = 0; i < servers.length; i++) {
		let prefix = (/(?=.*\bau(s|ssie|stralian?)?\b)|(?=.*\boce(ani(a|c))?\b)/gi.test(servers[i].name)) ? '-' : '+';
		let full = (servers[i].playerPercentage >= 1) ? ' [FULL]' : '';
		let specs = (servers[i].spectatorPlayers > 0) ? ` (${servers[i].spectatorPlayers} spec)` : '';
		text += `\n${prefix} ${func.alignText(servers[i].name, 50, -1)} ${func.alignText(servers[i].currentPlayers, 3, 1)}/${servers[i].maxPlayers}${full}${specs}\n​${servers[i].playerList.join('  ')}\n`;
	}
	text += '```';
	messages.mainServerList.edit(text).catch((err) => {
		return console.log(`ERROR: Main server list message too long (${text.length} characters)`);
	});
}

function updateAusServerList(servers) {
	if (!messages.ausServerList) return;
	// let text = '```md\n' + `# Servers with Australians - ${servers.length} servers, ${servers.reduce((t, x) => {return t + x.currentPlayers}, 0)} players` + '``````diff';
}

client.login(config.token || process.env.TOKEN);