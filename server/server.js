var http = require( "http" );
var url = require( "url" );
var path = require( "path" );
var fs = require( "fs" );
var qs = require( "querystring" );
var uuid = require( "node-uuid" );
var {OAuth2Client} = require( "google-auth-library" );
var aws = require("aws-sdk");

aws.config.update( {
  region: "us-west-1",
  endpoint: "https://dynamodb.us-west-1.amazonaws.com"
} );
var db = new aws.DynamoDB.DocumentClient();

var PORT = 8000;
var LOGGING_LEVEL = 3;

// Handle commandline arguments
for( var i = 0; i < process.argv.length; i++ ){
	
	switch( process.argv[ i ] ){
		case '-p':
			PORT = process.argv[ i + 1 ];
			break;
		case '-l':
			LOGGING_LEVEL = process.argv[ i + 1 ];
			break;
	}
	
}

var ALLOWED_PATHS = [
	/^\/api\/ping$/,
	/^\/api\/login$/,
	/^\/api\/putuser$/,
	/^\/api\/getuser$/,
	/^\/api\/putdeck$/,
	/^\/api\/getdeck$/,
	/^\/api\/deletedeck$/,
	/^\/[\w\d]{5,}$/,
	/^\/[\w\d]{5,}\/[\w\d]+$/,
	/^[\/]?$/
];


// Instantiate the deck server to do the work
log( "Starting deck server...", 0 );
DeckServer( function( DS ){

	// Create an HTTP server to handle requests
	log( "Starting HTTP server...", 0 );
	var pageHost = http.createServer( function( request, response ){
		
		// Respond to options requests
		if ( request.method === "OPTIONS" ){
			log( "Serving request for OPTIONS", 3 );
			response.writeHead( 200, { 
				"Access-Control-Allow-Origin":"*",
				"Access-Control-Allow-Methods":"POST, OPTIONS",
				"Access-Control-Allow-Credentials":false,
				"Access-Control-Max-Age":"86400",
				"Access-Control-Allow-Headers":"X-Requested-With, X-HTTP-Method-OVerride, Content-Type, Accept"
			} );
			response.end();
			return;
		}
		
		// Validate the path or serve a 403
		var uri = url.parse( request.url ).pathname;
		if ( !validatePath( uri ) ){
			response.writeHead( 403, {
				"Access-Control-Allow-Origin":"*",
				"Access-Control-Allow-Methods":"POST, OPTIONS",
				"Access-Control-Allow-Credentials":false,
				"Access-Control-Max-Age":"86400",
				"Access-Control-Allow-Headers":"X-Requested-With, X-HTTP-Method-OVerride, Content-Type, Accept",
				"Content-Type": "text/plain"
			} );
			response.write( "403 Forbidden\n" );
			response.end();
			log( "Responding 403 to request for  " + request.url, 2 );
			return;
		}
		
		// Get the command and handle it
		var command = "";
		var page = "";
		var pathUser = "";
		var pathDeck = "";
		if ( uri.match( /^\/api\// ) )
			command = uri.match( /^\/api\/([\w\d-]+)[\/]?$/ )[1].toLowerCase();
		if ( uri.match( /^\/[\w\d]{1,4}$/ ) )
			page = uri.match( /^\/([\w\d]{1,4})$/ )[1].toLowerCase();
		if ( uri.match( /^\/[\w\d]{5,}/ ) )
			pathUser = uri.match( /^\/([\w\d]{5,})/ )[1].toLowerCase();
		if ( uri.match( /^\/[\w\d]{5,}\/[\w\d]+$/ ) )
			pathDeck = uri.match( /^\/[\w\d]{5,}\/([\w\d]+)$/ )[1].toLowerCase();
		
		// Respond to load balancer pings
		if ( command == "ping" ){
			response.writeHead( 200, { 
				"Content-Type":"text/json",
				"Access-Control-Allow-Origin":"*",
				"Access-Control-Allow-Methods":"POST, OPTIONS",
				"Access-Control-Allow-Credentials":false,
				"Access-Control-Max-Age":"86400",
				"Access-Control-Allow-Headers":"X-Requested-With, X-HTTP-Method-OVerride, Content-Type, Accept"
			} );
			response.write( "pong" );
			response.end();
			return;
		}
		
		// Serve non-api page requests
		var data = { path:"https://deckmaven.com" };
		if ( !page && !command && !pathUser && !pathDeck ){
			// TODO: default home page
			// TODO: Get the static data for the home page
			loadPage( 'pages/home.html', data, function( content ){
				sendPage( content );
			} );
		}
		else if ( page ){
			// TODO: other special pages (embed,search,edit,etc.)
			// TODO: add these special keys to ALLOWED_PATHS
		}
		else if ( !page && !command && pathUser && !pathDeck ){
			// TODO: user profile page
			// TODO: Get the static data for the user
			loadPage( 'pages/user.html', data, function( content ){
				sendPage( content );
			} );
		}
		else if ( !page && !command && pathUser && pathDeck ){
			// TODO: deck page
			// TODO: Get the static data for the deck
			loadPage( 'pages/client.html', data, function( content ){
				sendPage( content );
			} );
		}
		
		// Serve a similar response to requests without a POST
		if ( request.method !== "POST" ){
			log( "METHOD: " + request.method, 2 );
			response.writeHead( 403, {
				"Access-Control-Allow-Origin":"*",
				"Access-Control-Allow-Methods":"POST, OPTIONS",
				"Access-Control-Allow-Credentials":false,
				"Access-Control-Max-Age":"86400",
				"Access-Control-Allow-Headers":"X-Requested-With, X-HTTP-Method-OVerride, Content-Type, Accept",
				"Content-Type": "text/plain"
			} );
			response.write( "403 Forbidden\n" );
			response.end();
			log( "Responding 403 to request without POST", 2 );
			return;
		}
		
		// Accumulate the arguments in the POST
		var requestBody = "";
		request.on( "data", function( data ){
			requestBody += data;
			// Block excessively large posts
			if( requestBody.length > 1e7 ){
				response.writeHead( 413, {
					"Access-Control-Allow-Origin":"*",
					"Access-Control-Allow-Methods":"POST, OPTIONS",
					"Access-Control-Allow-Credentials":false,
					"Access-Control-Max-Age":"86400",
					"Access-Control-Allow-Headers":"X-Requested-With, X-HTTP-Method-OVerride, Content-Type, Accept",
					"Content-Type": "text/plain"
				} );
				response.write( "413 Request Too large\n" );
				response.end();
				log( "Responding 413 to oversized request", 2 );
			}
		} );
		
		// Page template processing
		function loadPage( page, data, callback ){
			// Serve up the specific file as binary data
			fs.readFile( page, "utf8", function( err, content ) {
			
				// Serve an error message on any kind of error
				if( err ) sendError();
				
				// Apply the data to the template
				// Note this doesn't handle key values that are a 
				//	substring of other key values, so don't do that
				for( var key in data )
					content.replace( "::" + key, data[ key ] );
				
				// Serve the page with injected data
				callback( content );
				
			} );
		}
		
		// Canned responses
		function sendPage( content ){
			if( !content ){
				sendError();
				return;
			}
			response.writeHead( 200, { 
				"Content-Type":"text/html",
				"Access-Control-Allow-Origin":"*",
				"Access-Control-Allow-Methods":"POST, OPTIONS",
				"Access-Control-Allow-Credentials":false,
				"Access-Control-Max-Age":"86400",
				"Access-Control-Allow-Headers":"X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept"
			} );
			response.write( content, "binary" );
			response.end();			
		}
		function sendJSON( data ){
			if( !data ){
				sendError();
				return;
			}
			response.writeHead( 200, { 
				"Content-Type":"text/json",
				"Access-Control-Allow-Origin":"*",
				"Access-Control-Allow-Methods":"POST, OPTIONS",
				"Access-Control-Allow-Credentials":false,
				"Access-Control-Max-Age":"86400",
				"Access-Control-Allow-Headers":"X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept"
			} );
			response.write( JSON.stringify( data ) );
			response.end();
		}
		function sendError(){
			response.writeHead( 400, {
				"Access-Control-Allow-Origin":"*",
				"Access-Control-Allow-Methods":"POST, OPTIONS",
				"Access-Control-Allow-Credentials":false,
				"Access-Control-Max-Age":"86400",
				"Access-Control-Allow-Headers":"X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept",
				"Content-Type": "text/plain"
			} );
			response.write( "400 Bad Request\n" );
			response.end();
		}
		
		// When the request is fully recieved, handle it
		request.on( "end", function(){
			var data = qs.parse( requestBody );
			
			// Validate parsed JSON data if present
			var user = {};
			if ( data.user ){
				try{
					user = JSON.parse( data.user );
				}
				catch( error ){
					sendError();
					return;
				}
			}
			var deck = {};
			if ( data.deck ){
				try{
					deck = JSON.parse( data.deck );
				}
				catch( error ){
					sendError();
					return;
				}
			}
			
			// Handle the various commands
			switch( command ){
				case "login":
					DS.logIn( data.googleToken, function( userData ){
						sendJSON( userData )
					} );
					break;
				
				case "putuser":
					DS.putUser( user, function( userData ){
						sendJSON( userData );
					} );
					break;
				
				case "getuser":
					DS.getUser( user, data.target, function( userData ){
						sendJSON( userData );
					} );
					break;
				
				case "putdeck":
					DS.putDeck( user, deck, function( deckData ){
						sendJSON( deckData );
					} );
					break;
				
				case "getdeck":
					DS.getDeck( user, data.deckid, function( deckData ){
						sendJSON( deckData );
					} );
					break;
				
				case "deletedeck":
					DS.deleteDeck( user, data.deckid, function( deckData ){
						sendJSON( deckData );
					} );
					break;
				
				default:
					response.writeHead( 404, {
						"Access-Control-Allow-Origin":"*",
						"Access-Control-Allow-Methods":"POST, OPTIONS",
						"Access-Control-Allow-Credentials":false,
						"Access-Control-Max-Age":"86400",
						"Access-Control-Allow-Headers":"X-Requested-With, X-HTTP-Method-OVerride, Content-Type, Accept",
						"Content-Type": "text/plain"
					} );
					response.write( "404 Not Found\n" );
					response.end();
					log( "Responding 404 to unknown command " + command, 0 );
					break;
			}
		} );
		
	} ).listen( PORT );

	log( "Data server listening on port " + PORT, 0 );	
	
} );


/* DECK SERVER */

function DeckServer( callback ){
	
	var context = this;
	
	this.users = {};
	this.userids = {};
	this.decks = {};
	this.cleanupAfter = 1000 * 60 * 60 * 24;	// Keep decks and users in memory this long (24h)
	this.cleanupInterval = 1000 * 60 * 15;		// Purge older decks and users this often (15m)
	this.cleanupTimer = null;
	
	// Set up Google authentication services
	this.authClient = new OAuth2Client( "131516550233-2efdikia10mp3erns90el5jlrskc9d21.apps.googleusercontent.com" );
	
	// In-memory list management
	function ds_helper_cleanup(){
		
		// Cleanup stale users
		for( var userid in context.userids ){
			if ( Date.now() > context.userids[ userid ].lastUsed + context.cleanupAfter ){
				delete context.users[ context.userids[ userid ].email ];
				delete context.userids[ userid ];
			}
		}
		
		// Cleanup stale decks
		for ( var deckid in context.decks ){
			if ( Date.now() > context.decks[ deckid ].lastUsed + context.cleanupAfter ){
				delete context.decks[ deckid ];
			}
		}
		
	}
	this.cleanupTimer = setInterval( ds_helper_cleanup, context.cleanupInterval );
	
	
	// User management methods
	this.logIn = function ds_logIn( googleToken, callback ){
		
		// Protect against missing parameters
		if ( googleToken === undefined || googleToken === null ){
			log( "Login request missing googleToken", 1 );
			callback( false );
			return;
		}
		if ( typeof callback !== "function" ){
			log( "Login request missing callback function", -2 );
			callback( false );
			return;
		}
		
		context.authClient.verifyIdToken(
			{ idToken:googleToken, audience:"131516550233-2efdikia10mp3erns90el5jlrskc9d21.apps.googleusercontent.com" },
			function( event, login ){

				var payload = login.getPayload();

				// Get the saved user and reconcile current session
				ds_helper_loadUser( "email", payload.email, function( userData ){
					
					// Add a one time session code to the user
					userData.session = uuid.v4();
					
					// Load existing user data if there is any
					if ( userData ){
						context.users[ payload.email ] = userData;
						context.userids[ userData.userid ] = userData;
					}
					// Create new user data if there isn't any
					else{
						userData = {
							userid: uuid.v4(),
							email: payload.email,
							realName: payload.name,
							sub: payload.sub
						};
						context.users[ payload.email ] = userData;
						context.userids[ userData.userid ] = userData;
					}
					
					// Save the user's data in case anything changed
					ds_helper_saveUser( userData, function(){
						
						log( 'Logging in user ' + userData.userid, 2, context );
						callback( userData );
						
					} );
					
				} );

			}
		);
		
	}
	
	this.putUser = function ds_putUser( user, callback ){
		
		// Protect against bad parameters
		if ( user === undefined || user === null ){
			log( "Put User request missing user data", 1 );
			callback( false );
			return;
		}
		if ( typeof callback !== "function" ){
			log( "Put User request missing callback function", -2 );
			callback( false );
			return;
		}
		if ( typeof user !== "object" ){
			log( "Put User request had malformed user data", 1 );
			callback( false );
			return;
		}
		if ( typeof user.name === "string" ){
			if ( user.name.length < 5 && user.name != "" ){
				log ( "User attempted to set an invalid user name.", 1 );
				callback( false );
				return;
			}
		}
		user = ds_helper_conditionUser( user );
		
		// Verify the user's identity
		ds_helper_loadUser( "userid", user.userid, function( userData ){
			
			if ( userData ){
				if ( userData.session == user.session ){
					
					// Save the data
					ds_helper_saveUser( user, callback );
					return;
					
				}
				else{
					log( "Attempt to put user " + user.userid + " with invalid session", -1 );
					callback( false );
				}
			}
			else{
				log( "Attempt to put user " + user.userid + " who doesn't exist", 1 );
				callback( false );
			}
			
		} );
		
	}
	
	this.getUser = function ds_getUser( user, userid, callback ){

		// Protect against bad parameters
		if ( user === undefined || user === null ){
			log( "Get User request missing user data", 1 );
			callback( false );
			return;
		}
		if ( userid === undefined || userid === null ){
			log( "Get User request missing target userid", 1 );
			callback( false );
			return;
		}
		if ( typeof callback !== "function" ){
			log( "Get User request missing callback function", -2 );
			callback( false );
			return;
		}
		if ( typeof user !== "object" ){
			log( "Get User request with malformed user data", 1 );
			callback( false );
			return;
		}
		if ( typeof userid !== "string" ){
			log( "Get User request with malformed target userid", 1 );
			callback( false );
			return;
		}
		user = ds_helper_conditionUser( user );
	
		// Load up the data for the requested user
		ds_helper_loadUser( "userid", userid, function( targetData ){
			
			if ( targetData ){
				var data = {};

				// Provide full information to the user themself
				if ( user.userid == userid ){

					// Verify the requestor's identity
					ds_helper_loadUser( "userid", user.userid, function( userData ){
						if ( userData ){
							
							// Send the full data if validated
							if ( userData.session == user.session ){
								log( 'Sending full user data to user ' + userid, 3, context );
								callback( targetData );
							}
							// Log a possible hack attempt if not
							else{
								log( 'Invalid session token from ' + user.userid + ' requesting user ' + userid, -1, context );
								callback( false );
							}
						}
						else{
							log( 'No user data found for user ' + user.userid + ' requesting own data', 2, context );
							callback( false );
						}
					} );
					
				}
				// Provide id and public deck lists to other users
				else{
					data.userid = targetData.userid;
					data.username = targetData.username;
					data.decks = {};
					for ( var deck in targetData.decks ){
						if ( !targetData.decks[ deck ].secret && !targetData.decks[ deck ].name != "AUTOSAVE" )
							data.decks[ deck ] = targetData.decks[ deck ];
					}
					log( 'Sending public user data for user ' + userid + ' to user ' + user.userid, 3, context );
					callback( data );
				}
				
			}
			else{
				log( 'No user data found for user ' + user.userid + ' requesting user ' + userid, 2, context );
				callback( false );
			}
		} );					
		
	}
	
	
	// Deck management methods	
	this.putDeck = function ds_putDeck( user, deck, callback ){

		// Protect against bad parameters
		if ( user === undefined || user === null ){
			log( "Put Deck request missing user data", 1 );
			callback( false );
			return;
		}
		if ( deck === undefined || deck === null ){
			log( "Put Deck request missing deck data", 1 );
			callback( false );
			return;
		}
		if ( typeof callback !== "function" ){
			log( "Put Deck request missing callback function", -2 );
			callback( false );
			return;
		}
		if ( typeof user !== "object" ){
			log( "Put Deck request with malformed user data", 1 );
			callback( false );
			return;
		}
		if ( typeof deck !== "object" ){
			log( "Put Deck request with malformed deck data", 1 );
			callback( false );
			return;
		}
		user = ds_helper_conditionUser( user );
		deck = ds_helper_conditionDeck( deck );
		
		// Do initial setup the first time a deck is saved
		if ( !deck.deckid ){
			deck = ds_helper_newDeck( user, deck );
			log( "Initialized new deck " + deck.deckid + " for user " + user.userid, 3 );
		}
		
		var deckData = deck;
		
		// Verify the user's identity
		ds_helper_loadUser( "userid", user.userid, function( userData ){
			
			if ( userData ){
				if ( userData.session == user.session ){
		
					// Load any existing deck to check against
					ds_helper_loadDeck( deck.deckid, function( baseDeck ){
						
						var deck = deckData;
						
						// Perform extra validation if there's an existing deck
						if ( baseDeck ){
							
							// Don't allow users to save decks for other users
							if ( baseDeck.owner != userData.userid ){
								if ( !baseDeck.secret ){
									log( "Copied deck " + baseDeck.deckid + " by user " + baseDeck.owner + " for user " + userData.userid, 3, context );
									var deck = ds_helper_newDeck( userData, baseDeck );
								}
								else{
									log( "Blocked attempt to copy secret deck " + baseDeck.deckid + " by user " + baseDeck.owner + " for user " + userData.userid, -1, context );
									callback( false );
									return;
								}
							}
							
							/* Let the client solve for save versioning
							// Don't save an older version over a newer version
							if ( baseDeck.version > deck.version ){
								log( "Blocked overwrite of deck " + baseDeck.deckid + " with older version", 2, context );
								callback( false );
								return;
							}
							*/
							
						}
						
						// Update the user's list of decks
						userData.decks[ deck.deckid ] = { deck:deck.deckid, folder:deck.folder, secret:deck.secret, name:deck.name };
						ds_helper_saveUser( userData, function(){
							
							// Save the deck data
							deck.owner = userData.userid;
							log( "Put deck " + deck.deckid + " for user " + deck.owner, 3, context );
							ds_helper_saveDeck( deck, callback );
							
						} );
						
					} );
					
				}
				else{
					log( "Attempt to put deck " + deck.deckid + " by user " + user.userid + " with invalid session", -1 );
					callback( false );
				}
			}
			else{
				log( "Attempt to put deck " + deck.deckid + " by user " + user.userid + " who doesn't exist", -1 );
				callback( false );
			}
			
		} );
		
	}
	
	this.getDeck = function ds_getDeck( user, deckid, callback ){

		// Protect against bad parameters
		if ( user === undefined || user === null ){
			log( "Get Deck request missing user data", 1 );
			callback( false );
			return;
		}
		if ( deckid === undefined || deckid === null ){
			log( "Get Deck request missing deckid", 1 );
			callback( false );
			return;
		}
		if ( typeof callback !== "function" ){
			log( "Get Deck request missing callback function", -2 );
			callback( false );
			return;
		}
		if ( typeof user !== "object" ){
			log( "Get Deck request with malformed user data", 1 );
			callback( false );
			return;
		}
		if ( typeof deckid !== "string" ){
			log( "Get Deck request with malformed deckid", 1 );
			callback( false );
			return;
		}
		user = ds_helper_conditionUser( user );
	
		// Get the deck data
		ds_helper_loadDeck( deckid, function( deck ){
			
			// Sometimes there's no such deck
			if ( !deck ){
				log( "Tried to get deck " + deck.deckid + " for user " + user.userid + " but didn't find it", 2, context );
				callback( false );
			}
			// Only the owner can get secret decks
			else if ( deck.owner != user.userid && deck.secret ){
				log( "Blocked attempt by user " + user.userid + " to load secret deck " + deck.deckid + " by user " + deck.owner, -1, context );
				callback( false );
			}
			// Perform extra verification for secret decks
			else if ( deck.secret ){
				
				// Verify the user's identity
				ds_helper_loadUser( "userid", user.userid, function( userData ){
					
					if ( userData ){
						// Send the deck if everything checks out
						if ( userData.session == user.session ){
							log( "Got secret deck " + deck.deckid + " by user " + deck.owner + " for user " + user.userid, 3, context );
							callback( deck );
						}
						// Log a possible hack attempt if not
						else{
							log( "Attempt to get secret deck " + deck.deckid + " by user " + user.userid + " with invalid session", -1 );
							callback( false );
						}
					}
					else{
						log( "Attempt to get secret deck " + deck.deckid + " by user " + user.userid + " who doesn't exist", -1 );
						callback( false );
					}
					
				} );
				
			}
			// Just send the deck if it's not secret
			else{
				log( "Got deck " + deck.deckid + " by user " + deck.owner + " for user " + user.userid, 3, context );
				callback( deck );
			}
			
		} );
		
	}
	
	this.deleteDeck = function ds_deleteDeck( user, deckid, callback ){

		// Protect against bad parameters
		if ( user === undefined || user === null ){
			log( "Delete Deck request missing user data", 1 );
			callback( false );
			return;
		}
		if ( deckid === undefined || deckid === null ){
			log( "Delete Deck request missing deckid", 1 );
			callback( false );
			return;
		}
		if ( typeof callback !== "function" ){
			log( "Delete Deck request missing callback function", -2 );
			callback( false );
			return;
		}
		if ( typeof user !== "object" ){
			log( "Delete Deck request with malformed user data", 1 );
			callback( false );
			return;
		}
		if ( typeof deckid !== "string" ){
			log( "Delete Deck request with malformed deckid", 1 );
			callback( false );
			return;
		}
		user = ds_helper_conditionUser( user );
	
		// Verify the user's identity
		ds_helper_loadUser( "userid", user.userid, function( userData ){
			
			if ( userData ){
				if ( userData.session == user.session ){

					// Get the deck data
					ds_helper_loadDeck( deckid, function( deck ){
						
						// Don't bother if the deck doesn't exist
						if ( !deck ){
							log( "Tried to delete deck " + deck.deckid + " for user " + user.userid + " but didn't find it", 2, context );
							callback( false );
						}
						// Don't allow deleting other people's decks
						else if ( deck.owner != user.userid ){
							log( "Blocked attempt by user " + user.userid + " to delete deck " + deck.deckid + " by user " + deck.owner, -1, context );
							callback( false );
						}
						// Delete the deck
						else{
							log( "Deleting deck " + deck.deckid + " by user " + deck.owner, 3, context );
							ds_helper_deleteDeck( deck, function( deck ){
								
								// Remove the deck from the user's deck list
								delete user.decks[ deckid ];
								log( 'Deleted deck ' + deckid + ' from ' + deck.owner + "'s deck lists", 3, context );
								ds_helper_saveUser( user, function(){
									
									// Remove the deck from server memory
									delete context.decks[ deckid ];
									callback( { user:user.userid, deck:deckid } );
									
								} );
								
							} );
						}
						
					} );
				
				}
				// Log a possible hack attempt if not
				else{
					log( "Attempt to delete deck " + deckid + " by user " + user.userid + " with invalid session", -1 );
					callback( false );
				}
			}
			else{
				log( "Attempt to delete deck " + deckid + " by user " + user.userid + " who doesn't exist", -1 );
				callback( false );
			}
			
		} );
		
	}
	
	
	// User management helper functions
	function ds_helper_saveUser( user, callback ){
		
		// Make sure the user data is fully formed
		user = ds_helper_conditionUser( user );
		
		// Store the user in server memory
		user.lastUsed = Date.now();
		context.userids[ user.userid ] = user;
		context.users[ user.email ] = user;
		
		// Save the user to the database
		var params = { 
			TableName:'mdb_users', 
			Item:{ 
				'userid':user.userid,
				'email':user.email, 
				'realName':user.realName, 
				'sub':user.sub,
				'decks':JSON.stringify( user.decks ),
				'prefs':JSON.stringify( user.prefs ),
				'session':user.session
			} 
		};
		db.put( params, function( err, data ){
			if ( err ){
				log( 'Unable to save user with userid ' + user.userid + '. Error JSON:' + JSON.stringify( err, null, 2 ), -2, context );
				callback( false );
			}
			else{
				log( 'Saved user with userid ' + user.userid, 3, context );
				callback( user );
			}
		} );
		
	}
	
	function ds_helper_loadUser( key, value, callback ){
		
		// Assemble the query parameters
		var params = { TableName:'mdb_users' };
		
		// Load from the server's memory if available
		if ( key == "email" ){
			if ( context.users[ value ] ){
				context.users[ value ].lastUsed = Date.now();
				callback( context.users[ value ] );
				return;
			}
			// Otherwise load it from the database
			else{
				params.Key = { email:value };
				db.get( params, function( err, data ){
					if ( err ){
						log( 'Unable to load user with email ' + value + '. Error JSON:' + JSON.stringify( err, null, 2 ), -2, context );
						callback( false );
					}
					else{
						handleEntry( data );
					}
				} );
			}
		}
		else if ( key == "userid" ){
			if ( context.userids[ value ] ){
				context.userids[ value ].lastUsed = Date.now();
				callback( context.userids[ value ] );
				return;
			}
			else{
				params.IndexName = "userid-index";
				params.ExpressionAttributeNames = { "#k_userid":"userid" };
				params.ExpressionAttributeValues = { ":v_userid":value };
				params.KeyConditionExpression = "#k_userid = :v_userid";
				db.query( params, function( err, data ){
					if ( err ){
						log( 'Unable to load user with userid ' + value + '. Error JSON:' + JSON.stringify( err, null, 2 ), -2, context );
						callback( false );
					}
					else{
						if ( data.Items.length )
							data.Item = data.Items[ 0 ];
						handleEntry( data );
					}
				} );
			}
		}
		else{
			callback( false );
			return;
		}
		
		// Handle database returns
		function handleEntry( data ){
			if ( data.Item ){
				
				// Initialize and/or parse nested objects as needed
				data.Item.decks = data.Item.decks || '{}';
				data.Item.decks = JSON.parse( data.Item.decks );
				data.Item.prefs = data.Item.prefs || '{}';
				data.Item.prefs = JSON.parse( data.Item.prefs );
				
				// Ensure the completeness of the user data
				data.Item = ds_helper_conditionUser( data.Item );
				
				// Store the user data in memory for ease of use
				data.Item.lastUsed = Date.now();
				context.users[ data.Item.email ] = data.Item;
				context.userids[ data.Item.userid ] = data.Item;
				

				log( 'Loaded user with ' + key + ' ' + value, 3, context );
				callback( data.Item );
			}
			else{
				log( 'No user found with ' + key + ' ' + value, 3, context );
				callback( false );
			}
		}
		
	}
	
	function ds_helper_conditionUser( user ){
		
		var buffer = {};
		
		// Condition the user data to make sure it's complete
		buffer.email = user.email || null;
		buffer.realName = user.realName || null;
		buffer.sub = user.sub || null;
		buffer.userid = user.userid || null;
		buffer.session = user.session || null;
		buffer.name = user.name || null;
		
		// Copy supported pref properties
		buffer.prefs = {};
		if( user.prefs ){
			//buffer.prefs.PROP = user.prefs.PROP;
		}
		
		// Copy supported deck properties
		buffer.decks = {};
		if( user.decks ){
			for ( var deckid in user.decks ){
				buffer.decks[ deckid ] = { 
					deck:deckid,
					folder:user.decks[ deckid ].folder,
					secret:user.decks[ deckid ].secret,
					name:user.decks[ deckid ].name
				};
			}
		}
		
		return buffer;
		
	}

	
	// Deck management helper functions
	function ds_helper_saveDeck( deck, callback ){
		
		// Make sure the deck data if fully formed
		deck = ds_helper_conditionDeck( deck );
		
		// Update the deck's time stamp
		deck.version = Date.now();
		
		// Store the deck data in server memory
		context.decks[ deck.deckid ] = deck;
		context.decks[ deck.deckid ].lastUsed = Date.now();
		
		// Persist the deck data to the database
		var params = { TableName:'mdb_decks', Item:deck };
		db.put( params, function( err, data ){
			if ( err ){
				log( "Unable to save deck " + deck.deckid + " by user " + deck.owner + ". Error JSON:" + JSON.stringify( err, null, 2 ), -2, context );
				callback( false );
			}
			else{
				log( "Saved deck " + deck.deckid + " by user " + deck.owner, 3, context );
				callback( deck );
			}
		} );

	}

	function ds_helper_loadDeck( deckid, callback ){
		
		// Load from the server's memory if available
		if ( context.decks[ deckid ] ){
			context.decks[ deckid ].lastUsed = Date.now();
			callback( context.decks[ deckid ] );
		}
		// Load from the database if needed
		else{
			
			var params = { TableName: 'mdb_decks', Key:{ 'deckid': deckid } };
			db.get( params, function( err, data ){
				if ( err ){
					log( "Could not load deck " + deckid + " from DB. Error JSON: " + JSON.stringify( err, null, 2 ), -2, context );
					callback( false );
				}
				else{
					if ( data.Item ){
						var deck = ds_helper_conditionDeck( data.Item );
						deck.lastUsed = Date.now();
						context.decks[ deck.deckid ] = deck;
						log( "Deck " + deck.deckid + " by user " + deck.owner + " loaded from DB", 1, context );
						callback( deck );
					}
					else{
						log( "No data found in DB for deck " + deckid, 1, context );
						callback( false );
					}
				}
			} );
			
		}
		
	}
	
	function ds_helper_conditionDeck( deck ){
		
		var buffer = {};
		
		// Condition the deck data to make sure it's complete
		buffer.deckid = deck.deckid || null;
		buffer.folder = deck.folder || null;
		buffer.format = deck.format || null;
		buffer.lastUsed = deck.lastUsed || null;
		buffer.name = deck.name || null;
		buffer.owner = deck.owner || null;
		buffer.secret = deck.secret || false;
		buffer.tempName = deck.tempName || null;
		buffer.version = deck.version || null;

		// Copy the name(s) of the commander(s)
		buffer.commander = [];
		if( deck.commander ){
			if ( typeof deck.commander === "string" ){
				buffer.commander.push( deck.commander );
			}
			else if ( Array.isArray( deck.commander ) ){
				for ( var i = 0; i < deck.commander.length; i++ ){
					if ( typeof deck.commander[ i ] === "string" )
						buffer.commander.push( deck.commander[ i ] );
				}
			}
		}
		
		// Copy the valid properties of the deck's cards
		buffer.cards = {};
		if( deck.cards ){
			for ( var cardName in deck.cards ){
				buffer.cards[ cardName ] = { 
					name:deck.cards[ cardName ].name,
					count:deck.cards[ cardName ].count
				};
			}
		}
		
		return buffer;
		
	}

	function ds_helper_newDeck( user, sourceDeck ){
		
		// Create a new blank deck or copy from provided data
		var deck = ds_helper_conditionDeck( {} );
		if ( sourceDeck )
			deck = Object.assign( {}, sourceDeck );
		
		// Assign the deck an id and an owner
		deck.owner = user.userid;
		deck.deckid = uuid.v4();
		deck.lastUsed = Date.now();
		deck.version = Date.now();
		
		return deck;
		
	}
	
	function ds_helper_deleteDeck( deck, callback ){
		
		var id = deck.deckid;
		var owner = deck.owner;
		
		var params = { TableName:'mdb_decks', Key:{ 'deckid': deck.deckid } };
		db.delete( params, function( err, data ){
			if ( err ){
				log( 'Unable to delete deck ' + id + ' by ' + owner + '. Error JSON:' + JSON.stringify( err, null, 2 ), -2, context );
				callback( false );
			}
			else{
				log( 'Deleted deck ' + id + ' by ' + owner + ' from decks database', 3, context );
				callback( { deckid:id, userid:owner } );
			}
		});
		
	}

	callback( this );
	return this;
	
}

/* UTILITIES */

function log( message, level, context ){
	
	if ( level > LOGGING_LEVEL )
		return;
	
	var message = ( new Date() ) + ' ' + message;
	
	if ( level == -2 )
		console.error( message );
	else if ( level == -1 )
		console.warn( message );
	else
		console.log( message );
	
}

function validatePath( path ){

	// Check the path against the allowed patterns
	for ( var i = 0; i < ALLOWED_PATHS.length; i++ ){
		if ( path.match( ALLOWED_PATHS[i] ) )
			return true;
	}
	log( "Blocked request for " + path, 1 );
	return false;

}

