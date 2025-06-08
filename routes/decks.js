const express = require('express');
const Deck = require("../models/deck");
const bodyParser = require("body-parser");
const {getDeck} = require("../utilities/utilities");
const router = express.Router();

router.use(bodyParser.urlencoded({ extended: true }));

router.get('/save/:deckId?', async (req, res) => {

  // Validate auth
  if (!req.isAuthenticated()){
    console.log(`Save deck request without login for id: '${req.params.deckId}'`);
    res.send({error:true,errorType:511,errorDescription:"User not logged in"});
    return;
  }

  // Validate the deck id
  if (req.params.deckId && isNaN(parseInt(req.params.deckId))) {
    console.log(`Save deck request with invalid id: '${req.params.deckId}'`);
    res.send({error:true,errorType:400,invalidFields:["deckId"],errorDescription:"Invalid deck id"});
    return;
  }

  // Validate the form inputs
  let invalidFields = [];
  let newDeck = {};

  // For new decks only
  if (!req.params.deckId){

    // -- ownerId
    if (req.user.discordId) {
      newDeck.ownerId = req.user.discordId;
    } else {
      invalidFields.push("ownerId");
    }

    // -- ownerName
    if (req.user.username) {
      newDeck.ownerName = req.user.username;
    } else {
      invalidFields.push("ownerName");
    }

  }

  // -- public
  if (req.query.public) {
    newDeck.public = ( req.query.public === "true" );
  } else {
    invalidFields.push("public");
  }

  // -- meta
  if (req.query.meta) {
    try {
      const data = JSON.parse(req.query.meta);
      // todo: validate the actual structure of the meta

      newDeck.meta = req.query.meta;
    }
    catch (error) {
      invalidFields.push("meta");
    }
  } else {
    invalidFields.push("meta");
  }

  // -- content
  if (req.query.content) {
    try {
      const data = JSON.parse(req.query.content);
      // todo: validate the actual structure of the content

      newDeck.content = req.query.content;
    }
    catch (error) {
      invalidFields.push("content");
    }
  } else {
    invalidFields.push("content");
  }

  // Complain about invalid fields
  if (invalidFields.length > 0) {
    console.log(`Save deck request with invalid form data for id: '${req.params.deckId}'`);
    res.send({error:true,errorType:400,invalidFields:invalidFields,errorDescription:"Invalid form data"});
    return;
  }

  // Handle updating existing decks
  if (req.params.deckId){

    // Get existing deck if any
    const existinDeck = await getDeck(req.params.deckId, req.user.discordId);

    // Validate the deck exists
    if (existinDeck.accessLevel === -1){
      console.log(`Save deck request for missing id: '${req.params.deckId}'`);
      res.send({error:true,errorType:400,errorDescription:"Deck not found"});
      return;
    }

    // Validate rights to the deck
    if (existinDeck.accessLevel <= 1) {
      console.log(`Save deck request from non-owner (${req.user.discordId}) for id: '${req.params.deckId}'`);
      res.send({error:true,errorType:403,errorDescription:"User does not own deck"});
      return;
    }

    // Update the deck record
    existinDeck.set(newDeck);
    let deck = await Deck.update(
        newDeck,
        {
          where: {
            deckId: req.params.deckId,
          },
        }
    );

    deck.error = false;
    console.log(`Updated deck with deckId: '${req.params.deckId}'`);
    res.redirect(`/deck/${req.params.deckId}`);

  }

  // Create a new deck entry
  else {

    // Build and save the deck record
    let deck = await Deck.create(newDeck);

    deck.error = false;
    console.log(`Created new deck with deckId: '${deck.deckId}'`);
    res.redirect('/deck/' + deck.deckId + '?fromnew=true');

  }

});

router.get('/load/:deckId', async (req, res) => {

  // Validate the user's authentication
  let userId = null;
  if (req.isAuthenticated()){
    userId = req.user.discordId;
  }

  // Validate the deck id
  if (req.params.deckId && isNaN(parseInt(req.params.deckId))) {
    console.log(`Load deck request with invalid id: '${req.params.deckId}'`);
    res.send({error:true,errorType:400,invalidFields:["deckId"],errorDescription:"Invalid deck id"});
    return;
  }

  // Get existing deck if any
  const deck = await getDeck(req.params.deckId, userId);

  // Validate the deck exists
  if (deck.accessLevel === -1) {
    console.log(`Load deck request for missing id: '${req.params.deckId}'`);
    res.send({error: true, errorType: 400, errorDescription: "Deck not found"});
    return;
  }

  // Validate the deck is accessible
  if (deck.accessLevel === 0) {
    console.log(`Load deck request for private deck id: '${req.params.deckId}'`);
    res.send({error: true, errorType: 403, errorDescription: "Access denied"});
    return;
  }

  deck.error = false;
  console.log(`Loaded deck with deckId: '${req.params.deckId}'`);
  res.send(deck);

});

router.get('/delete/:deckId', async (req, res) => {

  // Validate the user's authentication
  if (!req.isAuthenticated()){
    console.log(`Remove deck request from user without login for deckId: '${req.params.deckId}'`);
    res.send({error:true,errorType:511,errorDescription:"User not logged in"});
    return;
  }

  // Validate the deck id
  if (req.params.deckId && isNaN(parseInt(req.params.deckId))) {
    console.log(`Remove deck request with invalid deckId: '${req.params.deckId}'`);
    res.send({error:true,errorType:400,invalidFields:["deckId"],errorDescription:"Invalid deck id"});
    return;
  }

  // Get existing deck if any
  const deck = await getDeck(req.params.deckId, req.user.discordId);

  // Validate the deck exists
  if (deck.accessLevel === -1) {
    console.log(`Remove deck request for missing deckId: '${req.params.deckId}'`);
    res.send({error: true, errorType: 400, errorDescription: "Deck not found"});
    return;
  }

  // Validate rights to the deck
  if (deck.accessLevel <= 1) {
    console.log(`Remove deck request from non-owner (${req.user.discordId}) for private deck deckId: '${req.params.deckId}'`);
    res.send({error: true, errorType: 403, errorDescription: "User does not own deck"});
    return;
  }

  await Deck.destroy({
    where: {
      deckId: req.params.deckId,
    },
  });

  console.log(`Deleted deck with deckId: '${req.params.deckId}'`);
  res.redirect('/');

});

router.get('/list', async (req, res) => {

  // Validate the user's authentication
  let userId = null;
  if (req.isAuthenticated()){
    userId = req.user.discordId;
  }

  const rows = await Deck.findAll();

  res.send(rows[0]);

});

module.exports = router;