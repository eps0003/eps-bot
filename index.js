const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./-config.json');
const func = require('./functions.js');
const moment = require('moment-timezone');
exports.client = client;

var messages = {
	mainServerList: null,
	ausServerList: null,
	dailyStats: null,
	kagLadder: null
};

var kagladder = {
	lastmatch: -1,
	panel: 'recent', // knight, archer, builder, recent
	region: 'AUS' // AUS, EU, US
}

var regex = {
	whitespace: /(?<=[^-_])[-_ ]+(?=[^-_])/g,
	numbers: /[-_ ]*\d+$/g
}

client.on('error', console.error);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username} on ${client.guilds.size} ${func.plural('server', client.guilds.size)}`);

	func.getChannel(config.mainServerList.channel).fetchMessage(config.mainServerList.message).then(message => {
		messages.mainServerList = message;
		console.log('Fetched main server list');
	}).catch(err => { if (err) console.log('Error fetching main server list') });
	func.getChannel(config.ausServerList.channel).fetchMessage(config.ausServerList.message).then(message => {
		messages.ausServerList = message;
		console.log('Fetched AUS server list');
	}).catch(err => { if (err) console.log('Error fetching AUS server list') });
	func.getChannel(config.dailyStats.channel).fetchMessage(config.dailyStats.message).then(message => {
		messages.dailyStats = message;
		console.log('Fetched daily stats');
	}).catch(err => { if (err) console.log('Error fetching daily stats') });
	func.getChannel(config.kagLadder.channel).fetchMessage(config.kagLadder.message).then(message => {
		messages.kagLadder = message;
		console.log('Fetched daily stats');
		func.addReactions(messages.kagLadder, ['⚔', '🏹', '⚒', '🇦🇺', '🇪🇺', '🇺🇸', '🕑']);
	}).catch(err => { if (err) console.log('Error fetching KAG Ladder') });

	loop();
});

client.on('message', async (message) => {
	if (!message.channel.guild || message.guild.id !== config.guild) return;

	if (message.author.id === config.member.gatherbot && /Game #\d+ has ended/g.test(message.content)) {
		if (dailyStats) dailyStats.gatherMatches++;
	}

	if (message.author.bot || message.content.indexOf(config.prefix)) return;

	const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
	const command = args.shift().toLowerCase();

	let isadmin = func.userHasRole(message.author, config.role.admin);

	if (command === 'help') {
		let commands = [
			['help', `DMs you the bot commands... exactly what you're looking at right now!`],
			['find (player)', `Finds which server the specified player is on`]
		].map(x => '`' + config.prefix + x[0] + '` : ' + x[1]).join('\n');
		let usage = [
			`Servers which are highlighted in red are Australian servers`,
			`The Servers with Australians list displays players who have the ${func.getRole(config.role.oceania).name} role if their Discord name is their KAG username`,
			`Daily stats update every day at 3am ${moment().tz('Australia/Melbourne').zoneName()}`,
			`The ${func.getRole(config.role.ingame).name} role is given to players who are on a KAG server (and their Discord name is their KAG username) or have their game presence showing. Offline/invisible players aren't displayed on the members list under the role`,
		].map(x => '⦁ ' + x).join('\n');
		let credit = [
			`${client.user.username} made by [epsilon](https://forum.thd.vg/members/epsilon.16800/)`,
			// `Gather made by [cameron1010](https://forum.thd.vg/members/cameron1010.6469/)`,
			`KAGLadder Rated 1v1 made by [Eluded](https://forum.thd.vg/members/eluded.8036/) and can be found [here](https://kagladder.com/)`
		].map(x => '⦁ ' + x).join('\n');
		return message.author.send(new Discord.RichEmbed()
			.setColor(3447003)
			.addField('Commands', commands + '\n​')
			.addField('Bot usage', usage + '\n​')
			.addField('Credit', credit)
		);
	}

	if (command === 'ping' && isadmin) {
		let msg = await message.channel.send('Ping?');
		return msg.edit(`Pong! Latency: ${msg.createdTimestamp - message.createdTimestamp} ms. API latency: ${Math.round(client.ping)} ms`);
	}

	if (command === 'find') {
		if (!args[0]) return message.channel.send('Please specify a player or Discord user');
		let msg = await message.channel.send('Finding user...');
		let user = func.getUser(args[0]);
		if (user) user = user.nickname || user.user.username;
		else user = args[0];
		func.httpGetAsync(`https://api.kag2d.com/v1/game/thd/kag/servers?filters=[{"field":"current","op":"eq","value":"true"},{"field":"connectable","op":"eq","value":true},{"field":"currentPlayers","op":"gt","value":"0"}]`, servers => {
			if (!servers) return; // API down?
			servers = servers.serverList;
			for (var i = 0; i < servers.length; i++) {
				let player = servers[i].playerList.find(x => x.toLowerCase() === user.toLowerCase());
				if (player) return message.channel.send(`**${player}** is on **${servers[i].name}** (${servers[i].currentPlayers}/${servers[i].maxPlayers})`);
			}
			func.httpGetAsync(`https://api.kag2d.com/v1/player/${user}`, player => {
				if (!player) return msg.edit(`**${user}** doesn't exist`);
				user = player.playerInfo.username;
				return msg.edit(`**${user}** isn't on a server`);
			});
		});
	}
});

client.on('messageReactionAdd', (reaction, user) => {
	if (user.bot) return;
	if (reaction.message.id === messages.kagLadder.id) {
		reaction.remove(user);
		if (reaction.emoji.name === '⚔' && kagladder.panel !== 'knight') {
			kagladder.panel = 'knight';
			console.log('Changed KAGLadder panel to knight');
			fetchingTooltip();
			updateKagLadderMessage();
		}
		if (reaction.emoji.name === '🏹' && kagladder.panel !== 'archer') {
			kagladder.panel = 'archer';
			console.log('Changed KAGLadder panel to archer');
			fetchingTooltip();
			updateKagLadderMessage();
		}
		if (reaction.emoji.name === '⚒' && kagladder.panel !== 'builder') {
			kagladder.panel = 'builder';
			console.log('Changed KAGLadder panel to builder');
			fetchingTooltip();
			updateKagLadderMessage();
		}
		if (reaction.emoji.name === '🇦🇺' && (kagladder.region !== 'AUS' || kagladder.panel === 'recent')) {
			kagladder.region = 'AUS';
			console.log('Changed KAGLadder panel to AUS');
			if (kagladder.panel === 'recent') kagladder.panel = 'knight';
			fetchingTooltip();
			updateKagLadderMessage();
		}
		if (reaction.emoji.name === '🇪🇺' && (kagladder.region !== 'EU' || kagladder.panel === 'recent')) {
			kagladder.region = 'EU';
			console.log('Changed KAGLadder panel to EU');
			if (kagladder.panel === 'recent') kagladder.panel = 'knight';
			fetchingTooltip();
			updateKagLadderMessage();
		}
		if (reaction.emoji.name === '🇺🇸' && (kagladder.region !== 'US' || kagladder.panel === 'recent')) {
			kagladder.region = 'US';
			if (kagladder.panel === 'recent') kagladder.panel = 'knight';
			console.log('Changed KAGLadder panel to US');
			fetchingTooltip();
			updateKagLadderMessage();
		}
		if (reaction.emoji.name === '🕑' && kagladder.panel !== 'recent') {
			kagladder.panel = 'recent';
			console.log('Changed KAGLadder panel to recent');
			fetchingTooltip();
			updateKagLadderMessage();
		}
		function fetchingTooltip() {
			let fetching = 'Fetching data...';
			if (reaction.message.content.indexOf(fetching) !== reaction.message.content.length - fetching.length) {
				reaction.message.edit(reaction.message.content + fetching).catch(console.error);
			}
		}
	}
});

function loop() {
	let d = moment().tz('Australia/Melbourne');
	func.httpGetAsync('https://api.kag2d.com/v1/game/thd/kag/servers?filters=[{"field":"current","op":"eq","value":"true"},{"field":"connectable","op":"eq","value":true},{"field":"currentPlayers","op":"gt","value":"0"}]', servers => {
		if (!servers) return; /// API down?
		servers = servers.serverList.sort((a, b) => {
			if (a.currentPlayers === b.currentPlayers) {
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
			}
			return b.currentPlayers - a.currentPlayers;
		});
		servers.forEach(server => {
			server.playerList.sort((a, b) => {
				return a.toLowerCase().localeCompare(b.toLowerCase());
			});
		});
		updateMainServerList(servers);
		updateAusServerList(servers);
		updateIngameRole(servers);
		updateDailyStatsData(servers);
		if (d.hour() === 3 && !d.minute() && !d.second()) updateDailyStatsMessage(servers);
		let players = servers.reduce((t, x) => t + x.currentPlayers, 0);
		client.user.setPresence({ status: 'online', game: { name: `${players} in KAG | ${config.prefix}help` } });
		// client.user.setPresence({ status: 'online', game: { name: `with ${players} ${func.plural('player', players)} | ${config.prefix}help` } });
	});
	func.httpGetAsync('https://api.kagladder.com/match_counter', result => {
		if (!result) return;
		if (result.id === kagladder.lastmatch) return;
		kagladder.lastmatch = result.id;
		updateKagLadderMessage();
	});
	let delay = 10000 - new Date() % 10000;
	setTimeout(loop, delay);
}

function updateMainServerList(servers) {
	if (!messages.mainServerList) return;
	let players = servers.reduce((t, x) => t + x.currentPlayers, 0);
	let text = '```md\n' + `# Server list - ${servers.length} ${func.plural('server', servers.length)}, ${players} ${func.plural('player', players)}` + '``````diff\n';
	text += servers.map(server => {
		let prefix = (/(?=.*\bau(s|ssie|stralian?)?\b)|(?=.*\boce(ani(a|c))?\b)/gi.test(server.name)) ? '-' : '+';
		let full = (server.playerPercentage >= 1) ? ' [FULL]' : '';
		let specs = (server.spectatorPlayers > 0) ? ` (${server.spectatorPlayers} spec)` : '';
		return `${prefix} ${func.alignText(server.name, 50, -1)} ${func.alignText(server.currentPlayers, 3, 1)}/${server.maxPlayers}${full}${specs}\n​${server.playerList.join('  ')}`;
	}).join('\n\n') + '\n```';
	messages.mainServerList.channel.setName(`${servers.length}-${func.plural('server', servers.length)}_${players}-${func.plural('player', players)}`);
	messages.mainServerList.edit(text).catch(console.error);
}

function updateAusServerList(servers) {
	if (!messages.ausServerList) return;
	let members = client.guilds.get(config.guild).members.array().filter(x => func.userHasRole(x, config.role.oceania)).map(x => x.nickname || x.user.username);
	servers = servers.filter(x => x.playerList.some(x => members.includes(x)));
	let players = servers.map(server => server.playerList.filter((x => members.includes(x)))).reduce((t, x) => t + x.length, 0);
	let text = '```md\n' + `# Servers with Australians - ${servers.length} ${func.plural('server', servers.length)}, ${players} ${func.plural('player', players)}` + '``````diff\n';
	text += servers.map(server => {
		server.playerList = server.playerList.filter(x => members.includes(x));
		let prefix = (/(?=.*\bau(s|ssie|stralian?)?\b)|(?=.*\boce(ani(a|c))?\b)/gi.test(server.name)) ? '-' : '+';
		let full = (server.playerPercentage >= 1) ? ' [FULL]' : '';
		let specs = (server.spectatorPlayers > 0) ? ` (${server.spectatorPlayers} spec)` : '';
		let extra = server.currentPlayers - server.playerList.length;
		extra = extra ? `  (+${extra} more)` : '';
		return `${prefix} ${func.alignText(server.name, 50, -1)} ${func.alignText(server.currentPlayers, 3, 1)}/${server.maxPlayers}${full}${specs}\n​${server.playerList.join('  ')}${extra}`;
	}).join('\n\n') + '\n```';
	messages.ausServerList.edit(text).catch(console.error);
}

function updateIngameRole(servers) {
	let role = func.getRole(config.role.ingame);
	if (!role) return;
	let players = [].concat.apply([], servers.map(x => x.playerList));
	let members = client.guilds.get(config.guild).members.array();
	members.forEach(member => {
		if (players.includes(member.nickname || member.user.username) || (member.presence.game && member.presence.game.name === `King Arthur's Gold`)) {
			if (!func.userHasRole(member, role)) {
				member.addRole(role);
				console.log(`+ ${member.nickname || member.user.username} (${role.name})`);
			}
		} else {
			if (func.userHasRole(member, role)) {
				member.removeRole(role);
				console.log(`- ${member.nickname || member.user.username} (${role.name})`);
			}
		}
	});
}

var dailyStats = null;
function resetDailyStatsData() {
	dailyStats = {
		peakPlayers: 0,
		leastPlayers: Infinity,
		peakServers: 0,
		leastServers: Infinity,
		players: {},
		servers: {},
		playerCount: [],
		serverCount: [],
		peakPlayersAUS: 0,
		peakPlayersEU: 0,
		peakPlayersUS: 0,
		peakTimeAUS: 'None',
		peakTimeEU: 'None',
		peakTimeUS: 'None',
		gatherMatches: 0
	}
}

function updateDailyStatsData(servers) {
	if (!dailyStats) return;
	// Peak players, least players
	let players = servers.reduce((t, x) => t + x.currentPlayers, 0);
	if (players > dailyStats.peakPlayers) dailyStats.peakPlayers = players;
	if (players < dailyStats.leastPlayers) dailyStats.leastPlayers = players;
	dailyStats.playerCount.push(players);
	// Peak servers, least servers
	if (servers.length > dailyStats.peakServers) dailyStats.peakServers = servers.length;
	if (servers.length < dailyStats.leastServers) dailyStats.leastServers = servers.length;
	dailyStats.serverCount.push(servers.length);
	// Players, servers
	servers.forEach(server => {
		server.playerList.forEach(player => {
			dailyStats.players[player] = (dailyStats.players[player] || 0) + 1;
		});
		let ip = `${server.IPv4Address}:${server.port}`;
		dailyStats.servers[ip] = (dailyStats.servers[ip] || 0) + server.currentPlayers;
	});
	// Region players, region peak times
	let playersAUS = servers.filter(x => /(?=^KAG Official \w+ AUS?\b)|(?=^Official Modded Server AUS?\b)/g.test(x.name)).reduce((t, x) => t + x.currentPlayers, 0);
	let playersEU = servers.filter(x => /(?=^KAG Official \w+ EU\b)|(?=^Official Modded Server EU\b)/g.test(x.name)).reduce((t, x) => t + x.currentPlayers, 0);
	let playersUS = servers.filter(x => /(?=^KAG Official \w+ USA?\b)|(?=^Official Modded Server USA?\b)/g.test(x.name)).reduce((t, x) => t + x.currentPlayers, 0);
	if (playersAUS > dailyStats.peakPlayersAUS) {
		dailyStats.peakPlayersAUS = playersAUS;
		dailyStats.peakTimeAUS = moment().tz('Australia/Melbourne').format('h:mma z');;
	}
	if (playersEU > dailyStats.peakPlayersEU) {
		dailyStats.peakPlayersEU = playersEU;
		dailyStats.peakTimeEU = moment().tz('Europe/Paris').format('h:mma z');;
	}
	if (playersUS > dailyStats.peakPlayersUS) {
		dailyStats.peakPlayersUS = playersUS;
		dailyStats.peakTimeUS = moment().tz('America/New_York').format('h:mma z');
	}
}

function updateDailyStatsMessage(servers) {
	if (!messages.dailyStats) return;
	let d = moment().tz('Australia/Melbourne').subtract(1, 'day').format('dddd, Do MMMM');
	let text = '```md\n' + `# Daily stats - ${d}` + '``````diff'
	if (dailyStats) {
		let width = 31;
		text += `\n${func.alignText('Peak players ', width, -1, '·')} ${dailyStats.peakPlayers}`;
		text += `\n${func.alignText('Least players ', width, -1, '·')} ${dailyStats.leastPlayers}`;
		text += `\n${func.alignText('Peak servers ', width, -1, '·')} ${dailyStats.peakServers}`;
		text += `\n${func.alignText('Least servers ', width, -1, '·')} ${dailyStats.leastServers}`;
		text += `\n${func.alignText('Average players ', width, -1, '·')} ${Math.round(dailyStats.playerCount.reduce((t, x) => t + x) / dailyStats.playerCount.length)}`;
		text += `\n${func.alignText('Average servers ', width, -1, '·')} ${Math.round(dailyStats.serverCount.reduce((t, x) => t + x) / dailyStats.serverCount.length)}`;
		text += `\n${func.alignText('Unique players ', width, -1, '·')} ${Object.keys(dailyStats.players).length}`;
		text += `\n${func.alignText('Unique servers ', width, -1, '·')} ${Object.keys(dailyStats.servers).length}`;
		text += `\n${func.alignText('Peak players on AUS officials ', width, -1, '·')} ${dailyStats.peakPlayersAUS}`;
		text += `\n${func.alignText('Peak players on EU officials ', width, -1, '·')} ${dailyStats.peakPlayersEU}`;
		text += `\n${func.alignText('Peak players on US officials ', width, -1, '·')} ${dailyStats.peakPlayersUS}`;
		text += `\n${func.alignText('Most active player ', width, -1, '·')} ${Object.keys(dailyStats.players).sort((a, b) => dailyStats.players[b] - dailyStats.players[a])[0]}`;
		text += `\n${func.alignText('Most active server ', width, -1, '·')} ${servers.filter(x => `${x.IPv4Address}:${x.port}` === Object.keys(dailyStats.servers).sort((a, b) => dailyStats.servers[b] - dailyStats.servers[a])[0])[0].name}`;
		text += `\n${func.alignText('AUS officials peak time ', width, -1, '·')} ${dailyStats.peakTimeAUS}`;
		text += `\n${func.alignText('EU officials peak time ', width, -1, '·')} ${dailyStats.peakTimeEU}`;
		text += `\n${func.alignText('US officials peak time ', width, -1, '·')} ${dailyStats.peakTimeUS}`;
		if (func.getUser(config.member.gatherbot)) text += `\n${func.alignText('Gather matches ', width, -1, '·')} ${dailyStats.gatherMatches}`;
	} else {
		text += `\n- Stats for yesterday are unavailable`
	}
	text += '```';
	messages.dailyStats.edit(text).catch(console.error);
	console.log(`Updated daily stats for ${d}`)
	resetDailyStatsData();
}

function updateKagLadderMessage() {
	if (kagladder.panel === 'recent') {
		func.httpGetAsync('https://api.kagladder.com/recent_match_history/19', matches => {
			if (!matches) return;
			let text = '```md\n' + `# KAGLadder Rated 1v1 - Recent matches` + '``````diff\n++|     Date/Time    |Region| Class |                     Results                     |Change\n';
			text += matches.map(match => {
				// Date & time
				let timezone = 'Australia/Melbourne';
				// if (match.region === 'EU') timezone = 'Europe/Paris';
				// if (match.region === 'US') timezone = 'America/New_York';
				let datetime = moment(match.match_time * 1000).tz(timezone).format('DD/MM HH:mma z');
				// Winner
                let p1win = ' ';
                let p2win = ' ';
                (match.player1_score > match.player2_score) ? p1win = '<' : p2win = '>';
				return `${func.alignText(match.id % 100, 2, 1)}|${func.alignText(datetime, 18, -1)}|  ${match.region.substr(0, 2)}  |${func.alignText(func.capitalise(match.kag_class), 7, -1)}|${func.alignText(match.player1, 20, 1)} ${p1win}${func.alignText(match.player1_score, 2, 1)}:${func.alignText(match.player2_score, 2, -1)}${p2win} ${func.alignText(match.player2, 20, -1)}| ${func.alignText(Math.abs(match.player1_rating_change), 3, 1)}`;
			}).join('\n') + '\n```'; //Class:       Region:       Recent:|Knight  Archer Builder   AUS       EU         US     Recent
			return messages.kagLadder.edit(text).catch(console.error);
		});
	} else {
		func.httpGetAsync(`https://api.kagladder.com/leaderboard/${kagladder.region}/${kagladder.panel}`, leaderboard => {
			if (!leaderboard) return;
			let text = '```md\n' + `# KAGLadder Rated 1v1 - ${kagladder.region} ${kagladder.panel} leaderboard` + '``````diff\n++|      KAG name      | Wins |Losses|Rating\n';
			text += leaderboard.slice(0, 40).map((player, i) => {
				return `${func.alignText(++i, 2, 1)}|${func.alignText(player.username, 20, 0)}| ${func.alignText(player.wins, 4, 1)} | ${func.alignText(player.losses, 4, 1)} | ${func.alignText(player.rating, 4, 1)}`;
			}).join('\n') + '\n```';
			return messages.kagLadder.edit(text).catch(console.error);
		});
	}
}

client.login(config.token || process.env.TOKEN);