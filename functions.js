const Discord = require('discord.js');
const config = require('./config.json');
const index = require('./index.js');

module.exports = {
	/**
	 * Converts role ID, role name, role mention or role object into a role object
	 * @param {*} role 
	 */
	getRole(role) {
		if (typeof role === 'object') return role;
		let role2;
		if (/<@&[0-9]+>/.test(role)) { // Mention
			role2 = index.client.guilds.get(config.guild).roles.get(role.match(/\d/g).join(''));
		} else if (isNaN(role)) { // Name
            role2 = index.client.guilds.get(config.guild).roles.find('name', role);
		} else { // ID
			role2 = index.client.guilds.get(config.guild).roles.get(role);
		}
		return role2 || null;
	},
	
	/**
	 * Converts user ID, user tag, user mention or user object into a user object
	 * @param {*} user
	 */
	getUser(user) {
		if (typeof user === 'object') return user;
		let user2;
		if (/<@!?[0-9]+>/.test(user)) { // Mention
			user2 = index.client.guilds.get(config.guild).members.get(user.match(/\d/g).join(''));
		} else if (isNaN(user)) { // Tag
			let guildMembers = index.client.guilds.get(config.guild).members.array();
			for (m = 0; m < guildMembers.length; m++) {
				if (user === `${guildMembers[m].user.username}#${guildMembers[m].user.discriminator}`) {
					user2 = guildMembers[m];
					break;
				}
			}
		} else { // ID
			user2 = index.client.guilds.get(config.guild).members.get(user);
		}
		return user2 || null;
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
		let user2 = this.getUser(user);
		let role2 = this.getRole(role);
		if (!user2 || !role2) return false;
		return index.client.guilds.get(config.guild).members.get(user2.id).roles.has(role2.id);
	},

	/**
     * Aligns the specified text to the left, right or centre of the specified width
     * @param {string} text
     * @param {number} width
     * @param {number} align
     * @param {*} padChar
     */
    alignText(text, width, align, padChar = ' ') {
        text = text.toString();
        if (text.length === width) return text;
        if (text.length > width) return text.substring(0, width - 2) + '‥‥';
        if (align === 0) {
            let leftSpaces = Math.floor((width - text.length) / 2);
            let centredText = '';
            while (centredText.length < leftSpaces) {
                centredText += padChar.toString();
            }
            centredText += text;
            while (centredText.length < width) {
                centredText += padChar.toString();
            }
            return centredText;
        } else {
            while (text.length < width) {
                if (Math.sign(align) === 1) text = padChar.toString() + text;
                else text += padChar.toString();
            }
            return text;
        }
	}
}