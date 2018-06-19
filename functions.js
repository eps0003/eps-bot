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

	plural(text, val) {
		return val === 1 ? text : text + 's';
	},

	capitalise(text) {
		return text[0].toUpperCase() + text.slice(1);
	},

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
    }
}