const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const func = require('./functions.js');
const moment = require('moment-timezone');
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
	ausServerList: null,
	dailyStats: null,
	kagLadder: null,
	gatherPastSeasons: null,
	gatherRecentMatch: null
};

var kagladder = {
	lastmatch: -1,
	panel: 'recent', // knight, archer, builder, recent
	region: 'AUS' // AUS, EU, US
}

var gather = {
	season: 6
}

var regex = {
	whitespace: /(?<=[^-_])[-_ ]+(?=[^-_])/g,
	numbers: /[-_ ]*\d+$/g
}

client.on('error', console.error);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username} on ${client.guilds.size} ${func.plural(client.guilds.size, 'server')}`);
	func.fetchMessages(result => {
		messages = result;
		console.log('Bot ready!');
		updateKagLadderMessage();
		func.addReactions(messages.kagLadder, ['⚔', '🏹', '⚒', '🇦🇺', '🇪🇺', '🇺🇸', '🕑']);
		// updateGatherPastSeasons();
		// func.addReactions(messages.gatherPastSeasons, ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣']);
	});
	loop();
});

client.on('message', async (message) => {
	if (!message.channel.guild || message.guild.id !== config.guild) return;

	if (message.author.id === config.member.gatherbot && /Game #\d+ has ended/g.test(message.content)) {
		if (dailyStats) dailyStats.gatherMatches++;
		// updateGatherRecentMatch();
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
			`${client.user.username} made by [epsilon](https://forum.thd.vg/members/16800/)`,
			// `Gather made by [cameron1010](https://forum.thd.vg/members/6469/)`,
			`KAGLadder Rated 1v1 made by [Eluded](https://forum.thd.vg/members/8036/) and can be found [here](https://kagladder.com/)`
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
		return msg.edit(`Pong! Latency: ${msg.createdTimestamp - message.createdTimestamp} ms. API latency: ${Math.round(client.ping)} ms`).catch(() => { });
	}

	if (0 && command === 'find') { // DISABLED
		if (!args[0]) return message.channel.send('Please specify a player or Discord user');
		let msg = await message.channel.send('Finding user...');
		let user = func.getUser(args[0]);
		if (user) user = user.nickname || user.user.username;
		else user = args[0];
		func.httpGetAsync(`https://api.kag2d.com/v1/game/thd/kag/servers?filters=[{"field":"current","op":"eq","value":"true"},{"field":"connectable","op":"eq","value":true},{"field":"currentPlayers","op":"gt","value":"0"}]`, servers => {
			if (!servers) return msg.edit('Unable to retrieve KAG servers. Please try again later').catch(() => { }); // API down?
			servers = servers.serverList;
			for (server of servers) {
				let player = server.playerList.find(x => x.toUpperCase() === user.toUpperCase());
				let url = server.password ? '' : `\n<https://furai.pl/joingame/kag/${server.IPv4Address}/${server.port}>`;
				if (player) return msg.edit(`**${player}** is on **${server.name}** (${server.currentPlayers}/${server.maxPlayers})${url}`).catch(() => { });
			}
			func.httpGetAsync(`https://api.kag2d.com/v1/player/${user}`, player => {
				if (!player) return msg.edit(`**${user}** doesn't exist`).catch(() => { });
				user = player.playerInfo.username;
				return msg.edit(`**${user}** isn't on a server`).catch(() => { });
			});
		});
	}
});

client.on('messageReactionAdd', (reaction, user) => {
	if (user.bot) return;
	if (messages.kagLadder && reaction.message.id === messages.kagLadder.id) {
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
	}
	if (0 && messages.gatherPastSeasons && reaction.message.id === messages.gatherPastSeasons.id) { // DISABLED
		reaction.remove(user);
		if (reaction.emoji.name === '1⃣' && gather.season !== '1') {
			gather.season = 1;
			console.log('Changed Gather past seasons panel to season 1');
			fetchingTooltip();
			updateGatherPastSeasons();
		}
		if (reaction.emoji.name === '2⃣' && gather.season !== '2') {
			gather.season = 2;
			console.log('Changed Gather past seasons panel to season 2');
			fetchingTooltip();
			updateGatherPastSeasons();
		}
		if (reaction.emoji.name === '3⃣' && gather.season !== '3') {
			gather.season = 3;
			console.log('Changed Gather past seasons panel to season 3');
			fetchingTooltip();
			updateGatherPastSeasons();
		}
		if (reaction.emoji.name === '4⃣' && gather.season !== '4') {
			gather.season = 4;
			console.log('Changed Gather past seasons panel to season 4');
			fetchingTooltip();
			updateGatherPastSeasons();
		}
		if (reaction.emoji.name === '5⃣' && gather.season !== '5') {
			gather.season = 5;
			console.log('Changed Gather past seasons panel to season 5');
			fetchingTooltip();
			updateGatherPastSeasons();
		}
		if (reaction.emoji.name === '6⃣' && gather.season !== '6') {
			gather.season = 6;
			console.log('Changed Gather past seasons panel to season 6');
			fetchingTooltip();
			updateGatherPastSeasons();
		}
	}

	function fetchingTooltip() {
		let fetching = 'Fetching data...';
		if (reaction.message.content.indexOf(fetching) !== reaction.message.content.length - fetching.length) {
			reaction.message.edit(reaction.message.content + fetching).catch(console.error);
		}
	}
});

function loop() {
	let d = moment().tz('Australia/Melbourne');
	func.httpGetAsync('https://api.kag2d.com/v1/game/thd/kag/servers?filters=[{"field":"current","op":"eq","value":"true"},{"field":"connectable","op":"eq","value":true},{"field":"currentPlayers","op":"gt","value":"0"}]', servers => {
		if (!servers) return; /// API down?
		servers = servers.serverList.sort((a, b) => {
			if (a.currentPlayers === b.currentPlayers) {
				return a.name.toUpperCase().localeCompare(b.name.toUpperCase());
			}
			return b.currentPlayers - a.currentPlayers;
		});
		servers.forEach(server => {
			server.playerList.sort((a, b) => {
				return a.toUpperCase().localeCompare(b.toUpperCase());
			});
		});
		updateMainServerList(servers);
		updateAusServerList(servers);
		updateInGameRole(servers);
		updateDailyStatsData(servers);
		if (d.hour() === 3 && !d.minute() && !d.second()) updateDailyStatsMessage(servers);
		let players = servers.reduce((t, x) => t + x.currentPlayers, 0);
		client.user.setPresence({ status: 'online', game: { name: `${players} in KAG | ${config.prefix}help` } });
		// client.user.setPresence({ status: 'online', game: { name: `with ${players} ${func.plural(players, 'player')} | ${config.prefix}help` } });
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
	let text = '```md\n' + `# Server list - ${servers.length} ${func.plural(servers.length, 'server')}, ${players} ${func.plural(players, 'player')}` + '``````diff\n';
	text += servers.map(server => {
		let prefix = (/(?=.*\bau(s|ssie|stralian?)?\b)|(?=.*\boce(ani(a|c))?\b)/gi.test(server.name)) ? '-' : '+';
		let full = (server.playerPercentage >= 1) ? ' [FULL]' : '';
		let specs = (server.spectatorPlayers > 0) ? ` (${server.spectatorPlayers} spec)` : '';
		return `${prefix} ${func.alignText(server.name, 50, -1)} ${func.alignText(server.currentPlayers, 3, 1)}/${server.maxPlayers}${full}${specs}\n​${server.playerList.join('  ')}`;
	}).join('\n\n') + '\n```';
	messages.mainServerList.channel.setName(`${servers.length}-${func.plural(servers.length, 'server')}_${players}-${func.plural(players, 'player')}`);
	messages.mainServerList.edit(text).catch(console.error);
}

function updateAusServerList(servers) {
	if (!messages.ausServerList) return;
	let members = client.guilds.get(config.guild).members.array().filter(x => func.userHasRole(x, config.role.oceania)).map(x => x.nickname || x.user.username);
	servers = servers.filter(x => x.playerList.some(x => members.includes(x)));
	let players = servers.map(server => server.playerList.filter((x => members.includes(x)))).reduce((t, x) => t + x.length, 0);
	let text = '```md\n' + `# Servers with Australians - ${servers.length} ${func.plural(servers.length, 'server')}, ${players} ${func.plural(players, 'player')}` + '``````diff\n';
	text += servers.map(server => {
		server.playerList = server.playerList.filter(x => members.includes(x));
		let prefix = (/(?=.*\bau(s|ssie|stralian?)?\b)|(?=.*\boce(ani(a|c))?\b)/gi.test(server.name)) ? '-' : '+';
		let full = (server.playerPercentage >= 1) ? ' [FULL]' : '';
		let specs = (server.spectatorPlayers > 0) ? ` (${server.spectatorPlayers} spec)` : '';
		let extra = server.currentPlayers - server.playerList.length;
		extra = (extra > 0) ? `  (+${extra} more)` : '';
		return `${prefix} ${func.alignText(server.name, 50, -1)} ${func.alignText(server.currentPlayers, 3, 1)}/${server.maxPlayers}${full}${specs}\n​${server.playerList.join('  ')}${extra}`;
	}).join('\n\n') + '\n```';
	messages.ausServerList.edit(text).catch(console.error);
}

function updateInGameRole(servers) {
	let role = func.getRole(config.role.ingame);
	if (!role) return;
	let players = [].concat.apply([], servers.map(x => x.playerList));
	let members = client.guilds.get(config.guild).members.array();
	members.forEach(member => {
		if (players.includes(member.nickname || member.user.username) || (member.presence.game && member.presence.game.name === `King Arthur's Gold`)) {
			if (!func.userHasRole(member, role)) {
				member.addRole(role);
				// console.log(`+ ${member.nickname || member.user.username} (${role.name})`);
			}
		} else {
			if (func.userHasRole(member, role)) {
				member.removeRole(role);
				// console.log(`- ${member.nickname || member.user.username} (${role.name})`);
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
	console.log(`Updated daily stats for ${d}`);
	resetDailyStatsData();
}

function updateKagLadderMessage() {
	if (!messages.kagLadder) return;
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

function updateGatherPastSeasons() {
	if (!messages.gatherPastSeasons) return;
	let size = 30;
	pool.query(`SELECT * FROM season${gather.season} WHERE gamesplayed > 0`, (err, leaderboard) => {
		if (err) throw err;
		let totalgames = leaderboard.find(x => x.kagname === '+numgames+').gamesplayed;
		leaderboard = leaderboard.filter(x => x.kagname !== '+numgames+');
		if (gather.season === 1) { // Season 1
			leaderboard.forEach(player => {
				player.winrate = player.wins / (player.gamesplayed - player.substitutions) * 100;
			});
			leaderboard = leaderboard.filter(x => x.gamesplayed >= 10).sort((a, b) => {
				if (a.winrate === b.winrate) {
					if (a.gamesplayed === b.gamesplayed) {
						return a.kagname.toUpperCase().localeCompare(b.kagname.toUpperCase());
					}
					return b.gamesplayed - a.gamesplayed;
				}
				return b.winrate - a.winrate;
			}).slice(0, size).map((player, i) => {
				return `${func.alignText(++i, 2, 1)}|${func.alignText(player.kagname, 20, 0)}| ${func.alignText(player.gamesplayed, 3, 1)} | ${func.alignText(player.wins, 3, 1)}  | ${func.alignText(player.losses, 3, 1)}  |${func.alignText(player.winrate.toFixed(2), 6, 1)}%`;
			});
			leaderboard.unshift('++|      Username      |Games| Wins |Losses|Winrate');
			leaderboard.push('', '- This may have missing or incorrect data since the gather database was introduced mid way through the season');
		} else if (gather.season >= 2 && gather.season <= 5) { // Seasons 2-5
			leaderboard.forEach(player => {
				player.winrate = (player.wins + player.substitutionwins) / (player.gamesplayed + player.substitutionwins + player.desertionlosses) * 100;
				player.score = 2000 + (10 * (player.wins - player.losses));
			});
			leaderboard = leaderboard.filter(x => x.gamesplayed >= 10).sort((a, b) => {
				if (a.score === b.score) {
					if (a.winrate === b.winrate) {
						if (a.gamesplayed === b.gamesplayed) {
							return a.kagname.toUpperCase().localeCompare(b.kagname.toUpperCase());
						}
						return b.gamesplayed - a.gamesplayed;
					}
					return b.winrate - a.winrate;
				}
				return b.score - a.score;
			}).slice(0, size).map((player, i) => {
				return `${func.alignText(++i, 2, 1)}|${func.alignText(player.kagname, 20, 0)}| ${func.alignText(player.gamesplayed, 3, 1)} | ${func.alignText(player.wins, 3, 1)}  | ${func.alignText(player.losses, 3, 1)}  |${func.alignText(player.winrate.toFixed(2), 6, 1)}%| ${func.alignText(player.score, 4, 1)}`;
			});
			leaderboard.unshift('++|      Username      |Games| Wins |Losses|Winrate|Score');
		} else { // Season 6 onwards
			leaderboard.forEach(player => {
				player.winrate = (player.wins + player.substitutionwins) / (player.gamesplayed + player.substitutionwins + player.desertionlosses) * 100;
				player.score = func.wilsonScoreInterval(Math.max(0, player.wins - player.desertions / 2), player.gamesplayed) * 10000;
			});
			leaderboard = leaderboard.filter(x => x.gamesplayed > totalgames * 0.1).sort((a, b) => {
				if (a.score === b.score) {
					if (a.winrate === b.winrate) {
						if (a.gamesplayed === b.gamesplayed) {
							return a.kagname.toUpperCase().localeCompare(b.kagname.toUpperCase());
						}
						return b.gamesplayed - a.gamesplayed;
					}
					return b.winrate - a.winrate;
				}
				return b.score - a.score;
			}).slice(0, size).map((player, i) => {
				return `${func.alignText(++i, 2, 1)}|${func.alignText(player.kagname, 20, 0)}| ${func.alignText(player.gamesplayed, 3, 1)} | ${func.alignText(player.wins, 3, 1)}  | ${func.alignText(player.losses, 3, 1)}  |${func.alignText(player.winrate.toFixed(2), 6, 1)}%| ${func.alignText(Math.floor(player.score), 4, 1)}`;
			});
			leaderboard.unshift('++|      Username      |Games| Wins |Losses|Winrate|Score');
		}
		let text = '```md\n' + `# Gather season ${gather.season} leaderboard - ${totalgames} ${func.plural(totalgames, 'match', 'es')}` + '``````diff\n' + leaderboard.join('\n') + '\n```';
		messages.gatherPastSeasons.edit(text).catch(console.error);
	});
}

function updateGatherRecentMatch() {
	if (!messages.gatherRecentMatch) return;
	pool.query('SELECT kagName, team FROM playerGames ORDER BY gameid DESC, won DESC, kagname ASC LIMIT 10; SELECT * FROM games ORDER BY gameid DESC LIMIT 1', (err, result) => {
		if (err) throw err;
		let blueteam = result[0].filter(x => !x.team).map(x => x.kagName).join('  ');
		let redteam = result[0].filter(x => x.team).map(x => x.kagName).join('  ');
		let winner = result[0][0].team;
		let gameid = result[1][0].gameId;
		let duration = func.secondsToDuration(result[1][0].gameLengthSeconds || 0) || 'None';
		let d = moment().tz('Australia/Melbourne');
		let date = d.format('dddd, Do MMMM');
		let time = d.format('h:mma z');

		let text = '```md\n' + `# Gather match #${gameid} summary` + '``````diff\n';
		text += `${winner ? '+' : '-'} Blue team${winner ? ' (winner)' : ''}\n${blueteam}\n\n`;
		text += `${winner ? '-' : '+'} Red team${winner ? '' : ' (winner)'}\n${redteam}\n\n`;
		text += `Date: ${date}\nTime: ${time}\nDuration: ${duration}`;
		text += '```';
		messages.gatherRecentMatch.edit(text);
	});
}

client.login(config.token || process.env.TOKEN);