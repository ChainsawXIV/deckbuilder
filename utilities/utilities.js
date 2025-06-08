const Deck = require("../models/deck");

async function getDeck(deckId, userId) {

	const deck = await Deck.findByPk(deckId);

	// deck doesn't exist, error
	if (!deck) {
		return {accessLevel:-1};
	}

	// always grant full access to the owner
	if (deck.ownerId === userId) {
		deck.accessLevel = 2;
		return deck;
	}

	// otherwise assume read only access
	deck.accessLevel = 1;
	return deck;

}

function setUserProperties(req, object) {

	if (req && req.user) {
		object.hasUser = true;
		object.username = req.user.username;
		object.discordId = req.user.discordId;
		object.avatar = req.user.avatar;
	}
	else {
		object.hasUser = false;
		object.username = '';
		object.discordId = '';
		object.avatar = '';
	}
	return object;

}

module.exports = {
	getThing: getDeck,
	setUserProperties: setUserProperties,
}