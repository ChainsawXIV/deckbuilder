const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const passport = require('passport');
const { sequelize, initDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');
const deckRouts = require('./routes/decks');
const { initializePassport } = require('./config/passport');
const bodyParser = require('body-parser');
const {getDeck, setUserProperties} = require("./utilities/utilities");
const deckEditor = require("./pages/deck-editor");

// Environment Vars
require('dotenv').config();

// Start Express
const app = express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Database
initDatabase();

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SequelizeStore({
    db: sequelize,
    expiration: 1000 * 60 * 60 * 24 * 7 // 1 week
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
initializePassport();

// Routes
app.use('/auth', authRoutes);
app.use('/decks', deckRouts);

// Main Page
app.get('/', (req, res) => {

  let data = {};
  setUserProperties(req, data);
  res.send(deckEditor(data));

});

// Deck Page
app.get('/deck/:deckId?', async (req, res) => {

  // Validate the user's authentication
  let userId = null;
  if (req.isAuthenticated()){
    userId = req.user.discordId;
  }

  // Validate the deck id
  if (!req.params.deckId || isNaN(parseInt(req.params.deckId))) {
    console.log(`Deck page request with invalid deckId: '${req.params.deckId}'`);
    res.status(400);
    res.send("Invalid Deck ID")
    return;
  }

  // Get existing deck if any
  const deck = await getDeck(parseInt(req.params.deckId), userId);

  // Validate the deck exists
  if (deck.accessLevel === -1) {
    console.log(`Deck page request for missing deckId: '${req.params.deckId}'`);
    res.status(400);
    res.send("Deck Not Found");
    return;
  }

  // Validate rights to the deck
  if (deck.accessLevel <= 0) {

    console.log(`Deck page request from unauthorized user (${req.user.discordId}) for private deck deckId: '${req.params.deckId}'`);
    res.status(403);
    res.send("Access Denied");
    return;

  }

  console.log(`Sending deck page for id ${req.params.deckId} to user ${req.user.discordId}'`);
  let data = deck;
  data.locked = (deck.accessLevel <= 1);
  setUserProperties(req, data);
  res.send(deckEditor(data));

})

const PORT = 80;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

