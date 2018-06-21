const config = require('./config.json');
const index = require('./index.js');
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

module.exports = {
	/**
	 * Converts role ID, role name, role mention or role object into a role object
	 * @param {*} role
	 */
	getRole(role) {
		if (typeof role === 'object') return role;
		if (/<@&\d+>/.test(role) || !isNaN(role)) { // Mention or ID
			role = index.client.guilds.get(config.guild).roles.get(role.match(/\d+/)[0]);
		} else { // Name
			role = index.client.guilds.get(config.guild).roles.find(x => x.name.toLowerCase() === role.toLowerCase());
		}
		return role || null;
	},

	/**
	 * Converts user ID, user tag, user mention or user object into a user object
	 * @param {*} user
	 */
	getUser(user) {
		if (typeof user === 'object') return user;
		if (/<@!?\d+>/.test(user) || !isNaN(user)) { // Mention or ID
			user = index.client.guilds.get(config.guild).members.get(user.match(/\d+/)[0]);
		} else if (/.+#\d{4}$/.test(user)) { // Tag
			user = index.client.guilds.get(config.guild).members.array().find(x => user === `${x.user.username}#${x.user.discriminator}`);
		} else { // Name
			let guildMembers = index.client.guilds.get(config.guild).members;
			user = guildMembers.find(x => (x.nickname || x.user.username).toLowerCase() === user.toLowerCase())
				|| guildMembers.find(x => x.user.username.toLowerCase() === user.toLowerCase())
				|| guildMembers.find(x => (x.nickname || x.user.username).toLowerCase().includes(user.toLowerCase()))
				|| guildMembers.find(x => x.user.username.toLowerCase().includes(user.toLowerCase()));
		}
		return user || null;
	},

	/**
     * Gets the channel object
     * @param {*} channel
     */
	getChannel(channel) {
		if (typeof channel === 'object') return channel;
		return index.client.guilds.get(config.guild).channels.get(channel) || null;
	},

	/**
	 * Checks if the specified user has the specified role
	 * @param {*} user
	 * @param {*} role
	 */
	userHasRole(user, role) {
		user = this.getUser(user);
		role = this.getRole(role);
		if (!user || !role) return false;
		return index.client.guilds.get(config.guild).members.get(user.id).roles.has(role.id);
	},

	/**
     * Aligns the specified text to the left, right or centre of the specified width
     * @param {string} text
     * @param {number} width
     * @param {number} align
     * @param {string} padChar
     */
	alignText(text, width, align, padChar = ' ') {
		text = text.toString();
		if (text.length > width) return text.substr(0, width - 1) + '…';
		width -= text.length;
		if (align < 0) return text + padChar.repeat(width);
		if (align > 0) return padChar.repeat(width) + text;
		width /= 2;
		return padChar.repeat(Math.floor(width)) + text + padChar.repeat(Math.ceil(width));
	},

	/**
	 * Pluralises the specified string with the optional suffix depending on the given value
	 * @param {number} val
	 * @param {string} text
	 * @param {string} suffix
	 */
	plural(val, text, suffix = 's') {
		return val === 1 ? text : text + suffix;
	},

	/**
	 * Capitalises the first letter of the specified text
	 * @param {string} text
	 */
	capitalise(text) {
		return text[0].toUpperCase() + text.slice(1);
	},

	/**
	 *
	 * @param {string} url
	 * @param {function} callback
	 */
	httpGetAsync(url, callback) {
		let xmlHttp = new XMLHttpRequest();
		xmlHttp.onreadystatechange = () => {
			if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
				return callback(JSON.parse(xmlHttp.responseText));
			}
			if (xmlHttp.readyState == 4 && xmlHttp.status == 404) {
				return callback(null);
			}
		}
		xmlHttp.open('GET', url, true);
		xmlHttp.send(null);
	},

	/**
     * Adds reactions in order to the specified message object
     * @param {JSON} message
     * @param {array} emoji
     * @param {function} callback
     */
    addReactions(message, emoji, callback) {
        if (!message) return;
        let arg = 0;
        (function react() {
            message.react(emoji[arg++]).then(() => {
                if (arg < emoji.length) react();
                else if (callback) callback(message);
            }).catch(() => {
                if (arg < emoji.length) react();
                else if (callback) callback(message);
            });
        })();
	},

	/**
     * Fetches messages and then calls the callback with the fetched messages
     * @param {JSON} messages
     * @param {function} callback
     */
    fetchMessages(callback) {
		let arg = 0;
		let messages = Object.keys(config).filter(key => Object.keys(config[key]).includes('message')).map(key => config[key]);
		let result = {};
		fetch();
		function fetch() {
			let channel = index.client.guilds.get(config.guild).channels.get(messages[arg].channel);
			if (!channel) return fetchError();
			channel.fetchMessage(messages[arg].message).then(message => {
				let key = Object.keys(config).find(key => config[key].message === messages[arg].message);
				result[key] = message;
				// console.log(`Fetched ${key}`);
				if (++arg < messages.length) fetch();
                else callback(result);
			}).catch(() => {
				fetchError();
			});
		};
		function fetchError() {
			let key = Object.keys(config).find(key => config[key].message === messages[arg].message);
			result[key] = null;
			console.log(`Error fetching ${key}`);
			if (++arg < messages.length) fetch();
			else callback(result);
		}
	},

    /**
     * Calculates the Wilson score interval used for Gather player rankings
     * @param {number} pos number of wins
     * @param {number} n total number of games
     */
    wilsonScoreInterval(pos, n) {
        if (!n) return 0;
        let z = 1.96;
        let phat = 1 * pos / n;
        return (phat + z * z / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) / (1 + z * z / n);
	},

	/**
	 * Converts seconds to Hh Mm Ss format
	 * @param {number} seconds
	 */
	secondsToDuration(seconds) {
		let h = Math.floor(seconds / 3600);
		let m = Math.floor(seconds % 3600 / 60);
		let s = Math.floor(seconds % 3600 % 60);

		let hDisplay = (h > 0) ? h + 'h ' : '';
		let mDisplay = (m > 0) ? m + 'm ' : '';
		let sDisplay = (s > 0) ? s + 's' : '';

		return hDisplay + mDisplay + sDisplay;
	}
}