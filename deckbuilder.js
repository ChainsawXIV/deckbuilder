
// Master class for the deck builder tool itself
function Deck( container, callback ){
	
	var context = this;
	
	this.container = container;
	this.cardData = null;
	this.catalog = null;
	this.decklist = null;
	this.storage = null;
	this.remote = new Remote( this );
	this.dialog = null;
	this.callback = callback || function(){};
	this.nameElement = container.querySelector( ".deckName input" );
	this.formatElement = container.querySelector( ".deckFormat select" );
	this.folderList = container.querySelector( ".deckFolder select" );
	this.newFolderButton = container.querySelector( ".deckFolder a" );
	this.privateDeckButton = container.querySelector( ".deckName a" );
	this.issuesElement = container.querySelector( ".deckIssues" );
	this.metricsElement = container.querySelector( ".deckMetrics" );
	this.masterTable = container.querySelector( ".masterTable" );
	this.loadedFrom = "AUTOSAVE";
	this.cards = {};
	this.format = "default";
	this.name = "";
	this.folder = "General";
	this.minCards = -1;
	this.maxCards = -1;
	this.count = 0;
	this.commander = [];
	this.offline = false;
	this.deckid = null;
	this.autosaveId = null;
	this.lastUsed = null;
	this.owner = null;
	this.version = null;
	this.autosaveVersion = null;
	this.secret = null;
	this.hoverCard = null;
	this.companionCard = null;
	this.meldCard = null;
	this.identity = ["W","U","B","R","G"];
	this.formats = {
		default:{ minCards:60, dupeLimit:4 },
		Commander:{ minCards:100, maxCards:100, commander:true, dupeLimit:1, walkerCommanders:false },
		Brawl:{ minCards:60, maxCards:60, commander:true, dupeLimit:1, walkerCommanders:true }
	}
	
	
	/* INITIALIZATION AND LOADING */
	
	// Show a loading bar dialog
	context.dialog = new DialogBox( context.container.querySelector( ".interstitial" ) );
	showLoad( "Downloading card library...", 0, 1 );
	
	// Fetch the master card data and set up the card lists
	var request = new XMLHttpRequest();
	request.onreadystatechange = function initializeDeck( e ){
		if( request.readyState == 4 ){
			
			// Set up the storage system regardless of outcome
			context.storage = new Storage( function(){
				
				// If the request failed load local data instead
				if ( request.status != 200 ){
					
					// Flag us as working in offline mode
					context.offline = true;
					
					// Load the card catalog from local storage if able
					context.storage.loadCatalog( function( catalog ){
						context.cardData = catalog.cardData;
						init();
					} );
					
				}
				// Otherwise load the card data from the file
				else{
					
					// Store the card data locally for off line use
					context.cardData = JSON.parse( request.responseText );
					context.storage.saveCatalog( {name:"master", cardData:context.cardData } );
					
					// Continue with initialization
					init()
					
				}
				
			}, context );
			
		}
	};
	request.onprogress = function downloadUpdate( e ){
		//showLoad( "Doaloading card library...", e.loaded, e.total );
		showLoad( "Doaloading card library...", e.loaded, 9386144 );
	}
	request.open( "GET", "https://deckmaven.com/data.json", true );
	request.send();	
	
	/* MAIN INIT FUNCTIONS */
	
	function init(){
		
		showLoad( "Configuring user interface..." );
		
		// Save the deck before leaving the page
		window.onbeforeunload = function(){
			if( context.remote.deferredSave )
				return "Your latest changes are still being saved.";
		};
	
		// Show enlarged card when hovering over Gatherer links
		context.hoverCard = document.querySelector( ".hoverCard" );
		context.companionCard = document.querySelector( ".companionCard" );
		context.meldCard = document.querySelector( ".meldCard" );
		window.addEventListener( "mousemove", function( e ){
			
			// Get the parent of an image in case it's a link
			var target = e.target;
			if ( target.tagName == "IMG" )
				target = target.parentNode;
			
			// Verify that the element is a valid link
			if ( target.tagName == "A" && target.href ){
				
				// Parse the multiverseid from the URL
				var id = target.href.match( /multiverseid=([\d]+)$/ );
				if ( id ){
					
					// Show the floating card
					context.hoverCard.src = "http://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=" + id[ 1 ] + "&type=card";
					context.hoverCard.style.display = "inline-block";
					
					// Position the card near the cursor
					var y = e.clientY + 10;
					if ( y > window.innerHeight - 310 )
						y = e.clientY - 310;
					context.hoverCard.style.top = y + "px";
					context.companionCard.style.top = y + "px";
					context.meldCard.style.top = y + "px";
					var x = e.clientX + 10;
					var xb = x + 225;
					var xc = x + 450;
					if ( x > window.innerWidth - 225 ){
						x = e.clientY - 233;
						xb = x + 225;
						xc = x + 450;
					}
					context.hoverCard.style.left = x + "px";
					context.companionCard.style.left = xb + "px";
					context.meldCard.style.left = xc + "px";
					
					// Get the full card data
					var key = target.getAttribute( "key" );
					if ( key ){
						
						var cardName = nameFromKey( key );
						var card = context.cardData[ cardName ];
						
						// Rotate split cards
						if ( card.layout == "split" ){
							context.hoverCard.style.transformOrigin = "top left";
							context.hoverCard.style.transform = "rotate(90deg)";
							context.hoverCard.style.left = ( x + 310 ) + "px";
							if ( window.innerHeight < e.clientY + 233 )
								context.hoverCard.style.top = ( e.clientY - 223 ) + "px";
							else
								context.hoverCard.style.top = ( e.clientY + 10 ) + "px"
						}
						else{
							context.hoverCard.style.transform = "";
						}
						
						// Show companion cards if any
						if ( card.names && ( card.layout == "meld" || card.layout == "double-faced" || card.layout == "flip" ) ){
							
							// Get the other card in the pair
							var cardb = context.cardData[ card.names[ 1 ] ];
							if ( cardb.name == card.name )
								cardb = context.cardData[ card.names[ 0 ] ];
							
							if ( cardb.multiverseid ){
								context.companionCard.src = "http://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=" + cardb.multiverseid + "&type=card";
								context.companionCard.style.display = "inline-block";
								
								// Move everything left if needed
								if ( x > window.innerWidth - 450 ){
									x = e.clientY - 458;
									xb = x + 225;
									xc = x + 450;
								}
								context.hoverCard.style.left = x + "px";
								context.companionCard.style.left = xb + "px";
								context.meldCard.style.left = xc + "px";
								
								// Rotate flip cards
								if ( cardb.layout == "flip" ){
									context.companionCard.style.transformOrigin = "50% 50%";
									context.companionCard.style.transform = "rotate(180deg)";
								}
								else{
									context.companionCard.style.transform = "";
								}
								
							}
							
							// Show melded card if there is one
							if ( card.names.length > 2 ){
								var cardc = context.cardData[ card.names[ 2 ] ];
								if ( cardc.multiverseid ){
										
									// Move everything left if needed
									if ( x > window.innerWidth - 450 ){
										x = e.clientY - 283;
										xb = x + 225;
										xc = x + 450;
									}
									context.hoverCard.style.left = x + "px";
									context.companionCard.style.left = xb + "px";
									context.meldCard.style.left = xc + "px";
									
									context.meldCard.src = "http://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=" + cardc.multiverseid + "&type=card";
									context.meldCard.style.display = "inline-block";
								}
							}
							else{
								// Hide the extra card
								context.meldCard.style.display = "none";
							}
							
						}
						else{
							// Hide the extra cards
							context.companionCard.style.display = "none";
							context.meldCard.style.display = "none";
							context.companionCard.style.transform = "";
						}
						
					}
					
					return;
					
				}
			}
			
			// Hide the hover card
			context.hoverCard.style.display = "none";
			context.companionCard.style.display = "none";
			context.meldCard.style.display = "none";
			context.hoverCard.style.transform = "";
			context.companionCard.style.transform = "";
			
		} );

		// Create an empty list for the deck
		context.decklist = new CardList(
			context.container.querySelector( ".deckFrame" ),
			context.container.querySelector( ".searchFrame" ),
			context
		);
		context.decklist.forceScroll = false;
		
		// Create the main card catalog list
		context.catalog = new CardList( 
			context.container.querySelector( ".searchFrame" ),
			context.container.querySelector( ".searchFrame" ),
			context
		);
		context.catalog.setCards( context.cardData );
		
		// Populate the list of formats for the deck
		var options = context.catalog.filterTypes.formats.options;
		options.sort( function( a, b ){
			ablock = a.match( /Block/ ) ? true : false;
			bblock = b.match( /Block/ ) ? true : false;
			if ( ablock && !bblock )
				return 1;
			else if ( !ablock && bblock )
				return -1;
			else if ( a > b )
				return 1;
			else
				return -1;
		} );
		for ( var i = 0; i < options.length; i++ )
			context.formatElement.innerHTML += '<option value="' + options[ i ] + '">' + options[ i ] + '</option>';
			
		// Set up event listener for changing deck format
		context.formatElement.addEventListener( "change", function changedFormat(){
			context.setFormat( context.formatElement.value );
		} );
						
		// Set up event listener for changing deck name
		context.nameElement.addEventListener( "change", function changedName(){
			context.name = context.nameElement.value;
			context.autoSave();
		} );
	
	
		// Populate the folder list before loading decks
		showLoad( "Loading list of saved decks..." );
		context.storage.loadList( function loadFolders( folders ){
			
			// Sort a list of the folder names
			var folderNames = [];
			for ( var folderName in folders )
				folderNames.push( folderName );
			if ( folderNames.indexOf( "General" ) < 0 )
				folderNames.push( "General" );
			folderNames.sort();
			
			// Populate the select element
			context.folderList.innerHTML = "";
			for ( var i = 0; i < folderNames.length; i++ ){
				context.folderList.innerHTML += '<option value="' + folderNames[ i ] + '">' + folderNames[ i ] + '</option>';
			}
			
			// Attach event listeners to the folder list
			context.folderList.addEventListener( "change", function(){
				context.folder = context.folderList.value;
				context.autoSave();
			} );
			
			// Attach event listeners to the add folder button
			context.newFolderButton.addEventListener( "click", function(){
				context.dialog.show( {
					allowClose:true,
					title:"New Folder",
					body:'Specify a name for the new folder:<br><input type="text" class="nameInput" />',
					cancel:{},
					confirm:{ text:"CREATE", callback:function(){
						var name = this.parentNode.parentNode.querySelector( ".nameInput" ).value
						context.folder = name;
						var opt = document.createElement( "option" );
						opt.value = name;
						opt.innerHTML = name;
						context.folderList.appendChild( opt );
						
						// Sort the options in the folder list
						var options = [];
						for ( var i = 0; i < context.folderList.options.length; i++ )
							options.push( context.folderList.options[ i ] );
						options.sort( function( a, b ){
							if ( a.text > b.text )
								context.folderList.insertBefore( b, a );
							else
								context.folderList.insertBefore( a, b );
						} );

						opt.selected = "selected";
					} },
					onLoad:function( dialog ){
						dialog.querySelector( ".nameInput" ).focus();
					}
				} );
			} );
			
			// Attach event listeners to the set private button
			context.privateDeckButton.addEventListener( "click", function(){
				var button = context.privateDeckButton;
				if ( button.getAttribute( "secret" ) == "secret" ){
					button.setAttribute( "secret", "" );
					button.title = "Make Deck Private";
					context.secret = false;
				}
				else{
					button.setAttribute( "secret", "secret" );
					button.title = "Make Deck Public";
					context.secret = true;
				}
				context.autoSave( true );
			} );
			
			// Attempt to load the last WIP deck from storage
			showLoad( "Loading most recent deck list... " );
			context.loadAutosave( function(){
				context.dialog.hide();
				context.callback();
			}	);
			
		}, true );
		
	};

	
	/* DECK ACTION METHODS */
	
	// Add a new card to the deck
	this.addCard = function addCard( cardKey, quantity ){
		
		var cardName = nameFromKey( cardKey );
		var card = context.cardData[ cardName ];
		
		if ( card.names ){
			// Add both component cards for cards with meld
			if ( card.layout == "meld" ){
				if ( card.name == card.names[ 2 ] ){
					context.addCard( keyFromName( card.names[ 0 ] ), quantity );
					context.addCard( keyFromName( card.names[ 1 ] ), quantity );
					return;
				}
			}
			// If this is the back face of card add the front face instead
			else if ( card.name !== card.names[ 0 ] ){
				cardName = card.names[ 0 ];
				card = context.cardData[ cardName ];
			}
		}
		
		// Increase quantity if card is already in the deck
		if ( context.cards[ cardName ] )
			context.cards[ cardName ].count += quantity;
		// Add the card to the deck if it's not already in it
		else{
			if ( card ){
				context.cards[ cardName ] = card;
				context.cards[ cardName ].count = quantity;
			}
		}
		
		// Propagate changes to the deck list
		context.decklist.setCards( context.cards );
		
		// Update counts and state on all card lists
		context.validateCard( cardName );
		
		// Update the deck metrics for the change
		context.updateMetrics();
		
		// Save the changes to the deck
		context.autoSave();
		
	}
	
	// Remove a card from the deck
	this.removeCard = function removeCard( cardKey, quantity ){
	
		var cardName = nameFromKey( cardKey );
		var card = context.cardData[ cardName ];
		
		if ( card.names ){
			// Remove both component cards for cards with meld
			if ( card.layout == "meld" ){
				if ( card.name == card.names[ 2 ] ){
					context.removeCard( keyFromName( card.names[ 0 ] ), quantity );
					context.removeCard( keyFromName( card.names[ 1 ] ), quantity );
					return;
				}
			}
			// If this is the back face of a card remove the front face instead
			else if ( card.name !== card.names[ 0 ] ){
				cardName = card.names[ 0 ];
				card = context.cardData[ cardName ];
			}
		}
		
		if ( context.cards[ cardName ] ){
			// If there would be no copies left in the deck
			if ( context.cards[ cardName ].count <= quantity ){
				
				// Set the count of the card to zero
				context.cards[ cardName ].count = 0;
				
				// Delete the card from the deck
				delete context.cards[ cardName ];
				
				// Refresh the deck display list
				context.decklist.setCards( context.cards );
				
				// Remove from commander slot if required
				if ( context.commander.indexOf( context.cardData[ cardName ] ) >= 0 )
					context.setCommander( cardKey );

			}
			else
				// Reduce the count if there are enough left
				context.cards[ cardName ].count -= quantity;
		}
		
		// Update the state of the card as needed
		context.validateCard( cardName );
		
		// Update the deck metrics for the change
		context.updateMetrics();
		
		// Save the changes to the deck
		context.autoSave();
	
	}

	// Set the deck format and validate rules
	this.setFormat = function setFormat( format, dontSave ){
		
		// Use default rules for formats without their own data
		context.format = format;
		if ( !context.formats[ format ] ) format = "default";
		
		// If the new format isn't commander, remove the commander
		if ( !context.formats[ format ].commander )
			context.clearCommander();
		
		// Set the min and max card counts from the format data
		context.minCards = context.formats[ format ].minCards || -1;
		context.maxCards = context.formats[ format ].maxCards || -1;
		
		// Flag the master table with an attribute for formatting
		context.masterTable.setAttribute( "format", format );
		
		// Refresh all card counts and legal statuses
		context.validateDeck( true );
		
		// Check legality for the cards on the catalog page
		context.catalog.refreshPage();
		
		// Save the changes to the deck
		if ( !dontSave )
			context.autoSave();
		
	}
	
	// Set the commander card for the deck
	this.setCommander = function setCommander( cardKey ){

		var cardName = nameFromKey( cardKey );
		
		// If toggling the existing commander, toggle it off
		if ( context.commander.indexOf( context.cardData[ cardName ] ) >= 0 ){
			
			// Unset the commander status of the card
			context.cardData[ cardName ].commander = false;
			
			// Remove the commander from the command list
			context.commander.splice( context.commander.indexOf( context.cardData[ cardName ] ), 1 );
			
			// Update the allowed colors for the deck
			context.setColorIdentity();
			
		}
		else{

			// Add commander status to the card's data
			context.cardData[ cardName ].commander = true;

			// Add the commander card to the deck data
			context.commander.push( context.cardData[ cardName ] );
			
			// Update the allowed colors for the deck
			context.setColorIdentity();
			
			// Make sure the commander is actually in the deck list
			if ( !context.cardData[ cardName ].count ){
				context.addCard( cardKey, 1 );
			}
		
		}
		
		// Update counts and legality for all cards in all lists
		context.validateDeck( true );
		
		// Check legality for the cards on the catalog page
		context.catalog.refreshPage();
		
		// Save the changes to the deck
		context.autoSave();
		
	}
	
	// Set the color identity of the deck based on its commander(s)
	this.setColorIdentity = function setColorIdentity(){
		
		// Clear the existing identity if any
		context.identity = [];
		
		// Clear identity and stop if there's no commander
		if ( context.commander.length == 0 ){
			context.identity = ["W","U","B","R","G"];
			return;
		}
		
		// Rebuild the deck's color identity
		for ( var commandIndex = 0; commandIndex < context.commander.length; commandIndex++ ){
			var identity = context.commander[ commandIndex ].colorIdentity;
			if ( identity ){
				for ( var colorIndex = 0; colorIndex < identity.length; colorIndex++ ){
					var color = identity[ colorIndex ];
					if ( context.identity.indexOf( color ) < 0 )
						context.identity.push( color );
				}
			}
		}		
		
	}
	
	// Clear the commander selection from the deck entirely
	this.clearCommander = function clearCommander(){
	
		// Validate that there's a commander to remove
		if ( context.commander.length ){
			
			// Clear the commander flag from each card
			for ( var i = 0; i < context.commander.length; i++ )
				context.commander[ i ].commander = false;
			
			// Clear the command list from the deck
			context.commander = [];
			
			// Recalculate deck color identity
			context.setColorIdentity();
			
			// Check legality for the cards on the catalog page
			context.catalog.refreshPage();
		
			// Fully re-validate the deck list
			context.validateDeck( true );
			
			// Save the changes
			context.autoSave();
			
		}
	
	}
	
	// Clear the deck list and start fresh
	this.resetDeck = function resetDeck(){
		
		this.load( {
			name:"",
			folder:"General",
			format:"default",
			cards:{}
		} );
		
	}


	/* DECK DATA METHODS */
	
	// Create a text deck list in the standard format
	this.list = function list(){
	
		var out = '';
		for ( var cardName in context.cards ){
			out += context.cards[ cardName ].count + "x " + cardName;
			// If there's a commander, mark it in the deck list
			if ( context.cards[ cardName ].commander ){
				out += " *CMDR*";
			}
			out += "\r\n";
		}
		
		return out;
	
	}

	// Create a data bundle from the deck for saving
	this.bundle = function bundle( saveAs ){
	
		// Initialize the bundle with the basics
		var bundle = { 
			cards:context.cards,	
			format:context.format,	
			name:context.name, 
			folder:context.folder,
			deckid:context.deckid,
			lastUsed:context.lastUsed,
			owner:context.owner,
			version:context.version,
			secret:context.secret
		};
		
		// Use the autosave info if this is an autosave
		if ( saveAs == "AUTOSAVE" ){
			bundle.deckid = context.autosaveId;
			bundle.version = context.autosaveVersion;
		}
		
		// Update the time stamp on the deck
		if ( Date.now() > bundle.version )
			bundle.version = Date.now();
		
		// Strip the autosave id for non-autosaves
		if ( saveAs != "AUTOSAVE" && context.deckid == context.autosaveId )
			bundle.deckid = null;
		
		// Reduce the commander to only its name
		if ( context.commander.length ){
			bundle.commander = [];
			for ( var i = 0; i < context.commander.length; i++ )
				bundle.commander.push( context.commander[ i ].name );
		}
		
		// Reduce the card list to only the key data
		var cl = {};
		for ( var cardName in bundle.cards )
			cl[ cardName ] = { name:cardName, count:bundle.cards[ cardName ].count };
		bundle.cards = cl;
		
		// Store the deck name when saving under another title
		if ( saveAs ){
			bundle.tempName = bundle.name;
			bundle.name = saveAs;
		}
		
		return bundle;
	
	};
	
	// Save the deck to a named slot in local
	this.save = function save( overwrite ){
	
		context.loadedFrom = context.name;
		context.storage.save( context.bundle(), null, overwrite );
	
	}
	
	// Save the deck to the draft slot in storage
	this.autoSave = function autoSave( immediate ){
	
		context.storage.save( context.bundle( "AUTOSAVE" ), null, true, false, immediate );
	
	};
	
	// Load the deck from a provided data bundle
	this.load = function load( bundle ){

		// Note which record the deck was loaded from
		context.loadedFrom = bundle.name;
	
		// Collect the autosave id if loading autosave
		if ( bundle.name == "AUTOSAVE" && bundle.deckid )
			context.autosaveId = bundle.deckid;
	
		// Recover the deck name from the bundle
		context.name = bundle.name;
		if ( bundle.tempName && context.name == "AUTOSAVE" ) context.name = bundle.tempName;
		else if ( context.name == "AUTOSAVE" ) context.name = "";
		context.nameElement.value = context.name;
		
		// Set basic deck properties from the bundle
		context.deckid = bundle.deckid;
		context.lastUsed = bundle.lastUsed;
		context.owner = bundle.owner;
		context.version = bundle.version;
		context.secret = bundle.secret;
		
		// Set the secret button status
		if ( bundle.secret ){
			context.privateDeckButton.setAttribute( "secret", "secret" );
			context.privateDeckButton.title = "Make Deck Public";
			context.secret = true;
		}
		else{
			context.privateDeckButton.setAttribute( "secret", "" );
			context.privateDeckButton.title = "Make Deck Private";
			context.secret = false;
		}
		
		// Set the proper format in the format menu
		context.setFormat( bundle.format, true );
		var selection = bundle.format == "default" ? "" : bundle.format;
		context.formatElement.querySelector( 'option[value="' + selection + '"]' ).selected = "selected";
		
		// Set the proper folder in the folder menu
		if ( bundle.folder == "" ) bundle.folder = "General";
		context.folder = bundle.folder;
		context.folderList.querySelector( 'option[value="' + bundle.folder + '"]' ).selected = "selected";
		
		// Replace the existing card list with the bundle's
		context.cards = {};
		var missingCards = [];
		for ( var cardName in bundle.cards ){
			if( context.cardData[ cardName ] ){
				context.cards[ cardName ] = context.cardData[ cardName ];
				context.cards[ cardName ].count = bundle.cards[ cardName ].count;
			}
			else
				missingCards.push( cardName );
		}
			
		// Designate the commander if specified and exists
		context.clearCommander();
		if ( bundle.commander ){
			if ( !Array.isArray( bundle.commander ) ){
				context.setCommander( keyFromName( bundle.commander ) );
			}
			else{
				for ( var i = 0; i < bundle.commander.length; i++ )
					context.setCommander( keyFromName( bundle.commander[ i ] ) );
			}
		}

		// Propagate the changes to the card lists
		context.decklist.setCards( context.cards );
		
		// Update the counts and states in the card lists
		context.validateDeck( true );
		context.catalog.refreshPage();
		
		// Update the deck stats
		context.updateMetrics();
		
		// Save the changes to the deck
		context.autoSave();
		
		// Return a list of any cards that weren't found
		return missingCards;
			
	}

	// Load the autosave data to the deck list
	this.loadAutosave = function loadAutosave( callback ){
		
		context.storage.loadDeck( "AUTOSAVE", function loadAutosave( bundle ){
			
			// If no deck was found stop here
			if( !bundle ){
				callback();
				return;
			}
			
			// Load the autosave data if it exists
			if( bundle )
				context.load( bundle );
			
			// Stash the autosave information for later
			context.autosaveId = bundle.deckid;
			context.autosaveVersion = bundle.version;
			
			// Check for a deckid associated with the loaded deck
			context.storage.loadDeck( context.name, function loadBaseDeck( baseDeck ){
				
				// Associate the data of the deck this is based on
				if( baseDeck ){
					context.deckid = baseDeck.deckid;
					context.loadedFrom = baseDeck.name;
					context.version = baseDeck.version;
					context.lastUsed = baseDeck.lastUsed;
					context.owner = baseDeck.owner;
				}
				
				// Invoke the callback when the deck is ready
				callback();
				
			}	);
			
		} );
		
	}	

	/* RULES VALIDATION METHODS */
	
	// Checks and updates the legality of an individual card
	this.validateCard = function validateCard( cardName, checkDeck ){
		checkDeck = ( checkDeck === undefined ) ? true : checkDeck;
		
		var card = context.cardData[ cardName ];
		var legal = true;
		var issue = "";
		
		var format = context.formats[ context.format ] ? context.format : "default";
		var validCount = ( card.deckLimit === undefined ) ? context.formats[ format ].dupeLimit : card.deckLimit;
		
		// Always allow any number of each basic land type
		if ( card.supertypes ){
			if ( card.supertypes.indexOf( "Basic" ) >= 0 )
				validCount = Number.MAX_SAFE_INTEGER;
		}

		// Validate the card's legality in the chosen format
		if ( context.format != "" && context.format != "default" ){
		
			// Cards with no format information are always banned
			if ( !card.formats ){
				legal = false;
				issue = card.name + " is banned.";
			}
			
			// Cards not listing the chosen format are banned
			else if ( card.formats.indexOf( context.format ) < 0 ){
				legal = false;
				issue = card.name + " is banned.";
			}
			
			// Cards on the restricted list for a format are limited to one copy
			else if ( card.restricted ){
				if ( card.restricted.indexOf( context.format ) >= 0 ){
					if ( card.count > 1 ){
						legal = false;
						issue = card.name + " is restricted.";
					}
				}
			}
			
		}
		
		// Validate color identity in the Commander format
		if ( context.formats[ format ].commander && legal ){
			
			// Cards must match the color identity of the commander
			if ( card.colorIdentity ){
				for ( var i = 0; i < card.colorIdentity.length; i++ ){
					if ( context.identity.indexOf( card.colorIdentity[ i ] ) < 0 ){
						legal = false;
						issue = card.name + " doesn't match commander's colors.";
					}
				}
			}
			
		}
		// Validate the card count maximum per deck
		if ( card.count > validCount && validCount >= 0 ){
			legal = false;
			issue = "Too many copies of " + card.name + ".";
		}

		// Flag the card with its legality and issue
		card.legal = legal;
		card.issue = issue;
		
		// Tell the lists to update card visual status
		if ( context.catalog )
			context.catalog.refreshCard( cardName );
		if ( context.decklist )
			context.decklist.refreshCard( cardName );
		
		// Recheck legality of the deck as a whole with these changes
		if ( checkDeck )
			context.validateDeck( false );
		
		// Return the card's legality
		return legal;
		
	}
	
	// Check the legality of all cards and the deck overall
	this.validateDeck = function validateDeck( validateCards ){

		var issues = [];
		var legal = 1;
		context.count = 0;
	
		// Check the legality of each of the cards in the deck
		for ( var cardName in context.cards ){
			// Don't waste time rechecking cards unless asked
			if ( validateCards )
				context.validateCard( cardName, false );
			// Gather information from each card in the deck
			var card = context.cards[ cardName ];
			if ( !card.legal ){
				legal = false;
				issues.push( card.issue );
			}
			// Tally the card count while we're here
			context.count += card.count;
		}

		// Validate that commander decks have a proper commander
		var format = context.formats[ context.format ] ? context.format : "default";
		if ( context.formats[ format ].commander ){
			if ( !context.commander.length ){
				legal = 0;
				issues.push( "You must select a commander." );
			}
			else{
				
				// Validate each of the commanders in the command list
				for ( var i = 0; i < context.commander.length; i++ ){
					
					// Skip these for commanders with a special override
					if ( !context.commander[ i ].legalCommander ){
						
						// Validate the each commander is a legend
						if ( context.commander[ i ].supertypes ){
							if ( context.commander[ i ].supertypes.indexOf( "Legendary" ) < 0 ){
								legal = 0;
								issues.push( "Only legends can be commanders." );
							}
						}
						else{
							legal = 0;
							issues.push( "Only legends can be commanders." );
						}
						
						// If allowed commanders must be creatures or walkers
						if ( context.formats[ format ].walkerCommanders ){
							if ( context.commander[ i ].types ){
								if ( context.commander[ i ].types.indexOf( "Creature" ) < 0 && context.commander[ i ].types.indexOf( "Planeswalker" ) ){
									legal = 0;
									issues.push( "Only creatures or planeswalkers can be commanders." );
								}
							}
							else{
								legal = 0;
								issues.push( "Only creatures or planeswalkers can be commanders." );
							}
						}
						// Validate that each commander is a creature
						else{
							if ( context.commander[ i ].types ){
								if ( context.commander[ i ].types.indexOf( "Creature" ) < 0 ){
									legal = 0;
									issues.push( "Only creatures can be commanders." );
								}
							}
							else{
								legal = 0;
								issues.push( "Only creatures can be commanders." );
							}
						}
						
					}	
					
				}
				
				// Limit to at most two commanders
				if ( context.commander.length > 2 ){
					legal = 0;
					issues.push( "You may have at most two commanders." );
				}
				// Only allow multiple commanders if they're partners
				else if ( context.commander.length > 1 ){
					for ( var i = 0; i < context.commander.length; i++ ){
						
						// Don't allow partnering with non-Partner commanders
						if ( !context.commander[ i ].partner ){
							legal = 0;
							issues.push( "Multiple commanders without Partner.");
							break;
						}
						// Partner With can't partner except with thier partner
						else if( context.commander[ i ].partnerWith ){
							var partnerWith = context.commander[ i ].partnerWith;
							var partnerFound = false;
							for ( var n = 0; n < context.commander.length; n++ ){
								var candidate = context.commander[ n ];
								if ( partnerWith == candidate.name )
									partnerFound = true;
							}
							if( !partnerFound ){
								legal = 0;
								issues.push( "Incompatible Partner commanders.");
								break;
							}
						}
						
					}
				}
				
			}
		}
		
		// If a minimum card count is specified, check against it
		if ( context.minCards > 0 && context.count < context.minCards ){
			legal = 0;
			issues.push( "Deck must contain at least " + context.minCards + " cards." );
		}
		
		// If a maximum card count is specified, check against it
		if ( context.maxCards > 0 && context.count > context.maxCards ){
			legal = 0;
			issues.push( "Deck may contain at most " + context.maxCards + " cards." );
		}
		
		// Update the issues list with the list of issues found
		if ( legal ){
			context.issuesElement.innerHTML = "<li>Deck is legal for the chosen format.</li>";
		}
		else{
			context.issuesElement.innerHTML = "";
			for ( var i = 0; i < issues.length; i++ )
				context.issuesElement.innerHTML += "<li>" + issues[ i ] + "</li>";
		}
		
		// Tag the master table with a class for formatting purposes
		if ( legal )
			context.masterTable.className = context.masterTable.className.replace( /[\s]+illegal/g, "" );
		else
			context.masterTable.className += " illegal";
		
		return legal;
	
	}
	
	
	/* DECK METRICS METHODS */
	
	this.updateMetrics = function updateMetrics(){
		
		var content = '';
		
		// Display the number of cards in the deck
		content += "Card Count: " + context.count + "<br>";
		
		// Display the estimated cost of the deck
		var price = 0;
		for ( var cardName in context.cards ){
			if ( context.cards[ cardName ].price )
				price += ( context.cards[ cardName ].price * context.cards[ cardName ].count );
		}
		var pre = Math.floor( price ) + "";
		var post = Math.round( ( price % 1 ) * 100 ) + "";
		while ( post.length < 2 )
			post += "0";
		var num = pre + "." + post;
		
		content += "Deck Cost: $" + num + "<br>";

		// Count the number of cards with each color and casting cost
		var mix = {W:0,U:0,B:0,R:0,G:0,C:0};
		var costs = {};
		var types = {};
		var spells = 0;
		for( var cardName in context.cards ){
			var card = context.cards[ cardName ];
			
			// Count each card type
			for ( var i = 0; i < card.types.length; i++ ){
				if ( types[ card.types[ i ] ] )
					types[ card.types[ i ] ] += card.count;
				else
					types[ card.types[ i ] ] = card.count;
			}
			
			// Don't count non-spells towards costing
			if (
				card.types.indexOf( "Land" ) >= 0 ||
				card.types.indexOf( "Conspiracy" ) >= 0 ||
				card.types.indexOf( "Phenomenon" ) >= 0 ||
				card.types.indexOf( "Plane" ) >= 0 ||
				card.types.indexOf( "Scheme" ) >= 0 ||
				card.types.indexOf( "Vanguard" ) >= 0
			)
				continue;
			
			// Count the number of non-land cards
			spells += card.count;
			
			// Count each color if the card has any
			if ( card.colorIdentity ){
				for ( var i = 0; i < card.colorIdentity.length; i++ )
					mix[ card.colorIdentity[ i ] ] += card.count;
			}
			// If it has none then count it colorless
			else
				mix.C += card.count;
			
			// Count each casting cost
			if ( !costs[ card.cmc ] )
				costs[ card.cmc ] = card.count;
			else
				costs[ card.cmc ] += card.count;
			
		}
		
		// Display the color identity mix 
		content += "<u>Color Mix</u><ul>";
		var words = {W:"White",U:"Blue",B:"Black",R:"Red",G:"Green",C:"Colorless"};
		for ( var color in mix ){
			if ( mix[ color ] > 0 ){
				var url = "http://gatherer.wizards.com/Handlers/Image.ashx?size=small&name=" + color + "&type=symbol";
				content += '<li class="' + color + '"><img src="' + url + '"> ' + mix[ color ] + " Cards (" + ( Math.round( mix[ color ] / spells * 100 ) ) + "% of Spells)</li>";
			}
		}
		content += "</ul>"
		
		// Display the casting cost mix
		content += "<u>Mana Curve</u><ul>";
		for ( var cost in costs ){
			var url = "http://gatherer.wizards.com/Handlers/Image.ashx?size=small&name=" + cost + "&type=symbol";
			content += '<li><img src="' + url + '"> ' + costs[ cost ] + " Cards (" + ( Math.round( costs[ cost ] / spells * 100 ) ) + "% of Spells)</li>";
		}
		content += "</ul>";
		
		// Display the card type mix
		content += "<u>Card Types</u><ul>";
		for ( var type in types ){
			content += "<li>" + type + ": " + types[ type ] + " Cards (" + ( Math.round( types[ type ] / context.count * 100 ) ) + "% of Deck)</li>";
		}
		content += "</ul>";
		
		// Put the content into its container
		context.metricsElement.innerHTML = content;
		
	}
	
	
	/* UI HELPERS */
	function showLoad( message, loaded, total ){
		
		// Calculate progress
		var progress = total > 0 ? loaded / total : 1;
		var pct = Math.round( progress * 100 ) + "%";
		
		// Construct dialog box contents
		var content = message + '<span style="float:right;">' + pct + '</span><br>';
		content += '<div class="loadBar"><div class="progress"style="width:' + pct + ';"></div></div>';
		
		context.dialog.show( { title:"Loading", body:content , allowClose:false } );
		
	}
	
	
	/* NAME CONVERSION HELPERS */
	
	// Converts a key value to a name value
	function nameFromKey( key ){
		return key.replace( /\|\|/g, "\"" );
	}
	
	// Converts a name value to a key value
	function keyFromName( name ){
		return name.replace( /"/g, "||" );
	}
	
	return this;
	
}

// Component class for scrolling, filtering card lists
function CardList( container, template, deck ){

	var context = this;
	
	this.deck = deck;
	this.template = template.innerHTML;
	this.container = container;
	this.pageLength = 100;
	this.filterParameters = {};
	this.filterTimer = null;
	this.sortProperty = 'name';
	this.sortDescending = false;
	this.cards = {};
	this.sortedCards = null;
	this.cardCount = 0;
	this.currentPage = 0;
	this.pageCount = 0;
	this.forceScroll = true;
	this.filterTypes = {
		name:{ type:"match" },
		cmc:{ type:"number" },
		supertypes:{ type:"list", populate:true },
		types:{ type:"list", populate:true },
		subtypes:{ type:"list", populate:true },
		text:{ type:"match" },
		colors:{ type:"color" },
		colorIdentity:{ type:"color" },
		formats:{ type:"list", populate:true },
		sort:{ type:"sort" },
		view:{ type:"view" }
	};
	
	/* UI INITIALIZATION */
	
	// Populate the container from the template
	this.container.innerHTML = this.template;
	
	// Get the key elements of the interface
	this.listElement = container.querySelector( ".listTable" );
	this.navElement = container.querySelector( ".navSection" );
	this.filtersElement = container.querySelector( ".filterSection" );
	
	// Links back to the card list from component sections
	this.listElement.cardList = this;
	this.navElement.cardList = this;
	this.filtersElement.cardList = this;
	
	// Add event listeners to the filter fields
	var filterFields = this.filtersElement.querySelectorAll( ".filterField" );
	for ( var i = 0; i < filterFields.length; i++ )
		setupField( filterFields[ i ] );
		

	/* LIST CONTROL METHODS */

	// Sets the cards on the list from a collection of cards
	this.setCards = function setCards( cards ){
	
		// Overwrite the list's internal card data
		context.cards = cards;
		
		// Reset the list to viewing page one
		context.currentPage = 0;
		
		// Recalculate the options in the filter menus
		setSelectOptions();
		
		// Filter the card list to be displayed
		filterList();
		
	};
	
	// Sets which page of cards the list is currently viewing
	this.setPage = function setPage( page ){
	
		// Constrain the view to pages which actually exist
		var lastPage = context.currentPage;
		context.currentPage = Math.max( 0, Math.min( page, context.pageCount - 1 ) );
		
		// Redraw the list with the proper cards in view
		populateList( lastPage != context.currentPage );
		
	};

	// Update the visual state of a particular card on the list
	this.refreshCard = function refreshCard( cardName, dontRecurse ){
	
		// Early out if the card's not on this list
		var card = context.cards[ cardName ];
		if ( !card )
			return;
		
		// Refresh alternate names of the same card too
		if ( card.names && !dontRecurse ){
			for ( var i = 0; i < card.names.length; i++ )
				context.refreshCard( card.names[ i ], true );
		}
		
		var entry = context.listElement.querySelector( 'tr[key="' + keyFromName( cardName ) + '"]' );
		if ( entry ){
			var count = entry.querySelector( ".cardCount" );
			var commander = entry.querySelector( ".commanderFlag" );
		
			// Get the count from the primary card for multi-cards
			var primaryCount = context.deck.cards[ card.name ] ? context.deck.cards[ card.name ].count : 0;
			if ( !primaryCount && card.names )
				primaryCount = context.deck.cards[ card.names[ 0 ] ] ? context.deck.cards[ card.names[ 0 ] ].count : 0;
			
			// Set count for the result of a meld to the lower of its parts
			if ( card.layout == "meld" && card.name == card.names[ 2 ] ){
				var aCount = context.deck.cards[ card.names[ 0 ] ] ? context.deck.cards[ card.names[ 0 ] ].count : 0;
				var bCount = context.deck.cards[ card.names[ 1 ] ] ? context.deck.cards[ card.names[ 1 ] ].count : 0;
				primaryCount = Math.min( aCount, bCount );
			}
			
			// Populate the card count into the element
			if( !primaryCount ){
				entry.setAttribute( "count", 0 );
				count.setAttribute( "count", 0 );
				count.innerHTML = 0;
			}
			else{
				entry.setAttribute( "count", primaryCount );
				count.setAttribute( "count", primaryCount );
				count.innerHTML = primaryCount;
			}
			
			// Flag the element to style for legality
			if ( card.legal )
				entry.setAttribute( "legal", 1 );
			else
				entry.setAttribute( "legal", 0 );
				
			// Flag the element for commander selection
			if ( card.commander )
				entry.setAttribute( "commander", 1 );
			else
				entry.setAttribute( "commander", 0 );
			
		}
	
	}
	
	// Show or hide the filter section at the top of the list
	this.toggleFilters = function toggleFilters( show ){
		
		var container = context.filtersElement.parentNode;
		if ( show )
			container.className = container.className.replace( / hideFilters/g, '' );
		else
			container.className += ' hideFilters';
		
	}

	// Validates and updates tagging for each card on the page
	this.refreshPage = function refreshPage(){
		
		var minIndex = context.pageLength * context.currentPage;
		var maxIndex = Math.min( minIndex + context.pageLength - 1, context.cardCount - 1 );
		for ( var i = minIndex; i <= maxIndex; i++ ){
			context.deck.validateCard( context.sortedCards[ i ].name, false );
			context.refreshCard( context.sortedCards[ i ].name );
		}
		context.deck.validateDeck( false );
		
	}

	
	/* CARD LIST HELPERS */
	
	// Filter the cards in the list to those that will be shown
	function filterList(){
		var fp = context.filterParameters;
		context.sortedCards = [];
		
		// Evaluate each card in the internal card list
		for ( var name in context.cards ){
			var card = context.cards[ name ];
			
			// Check each filter condition that has been specified
			var include = true;
			for ( var key in fp ){
				if ( context.filterTypes[ key ] ){
					var type = context.filterTypes[ key ].type;
					
					// Assume no match if the property is missing from the card
					if ( card[ key ] === undefined && type != "color" )
						include = false;
					// For text fields use a partial regex match, case insensitive
					else if ( type == "match" ){
						try{
							var pattern = new RegExp( fp[ key ], "im" );
							if ( !card[ key ].match( pattern ) )
								include = false;
						}
						catch( error ){
							// Ignore regex errors in user input
						}
					}
					// For numeric fields convert the value to a number first
					else if ( type == "number" && card[ key ] != parseInt( fp[ key ] ) )
						include = false;
					// For list fields look for the selected value in the card's array
					else if ( type == "list" && card[ key ].indexOf( fp[ key ] ) < 0 )
						include = false;
					// for color selections check each color for required or excluded
					else if ( type == "color" ){
						for ( var color in fp[ key ] ){
							// Auto-fail if a color is required and the card has no colors
							if ( fp[ key ][ color ] == "required" && card[ key ] === undefined ){
								include = false;
								break;
							}
							// Auto-pass if a color is excluded and the card has no colors
							if ( fp[ key ][ color ] == "excluded" && card[ key ] === undefined ){
								break;
							}
							if ( fp[ key ][ color ] == "required" && card[ key ].indexOf( color ) < 0 ){
								include = false;
								break;
							};
							if ( fp[ key ][ color ] == "excluded" && card[ key ].indexOf( color ) >= 0 ){
								include = false;
								break;
							};
						}
					}
					// Stop checking as soon as a card is found to be invalid
					if ( !include ) break;
				}
			}
			// Continue to the next card if this one is invalid
			if ( !include ) continue;
			
			// Add the card to the sorted card list
			context.sortedCards.push( context.cards[ name ] );
			
		}
		
		// Update the card count and subsequent page count
		context.cardCount = context.sortedCards.length;
		context.pageCount = Math.ceil( context.cardCount / context.pageLength );
	
		// Sort the reduced card list prior to rendering
		sortList();
		
	}

	// Sort the cards in the reduced list by some property
	function sortList( property, descending ){
	
		// Sort the reduced card array by property and order
		var property = property || context.sortProperty;
		var descending = descending || context.sortDescending;
		context.sortedCards.sort( function sordCards( a, b ){
			var order = ( descending ) ? 1 : -1;
			var propa = a[ property ];
			var propb = b[ property ];
			
			// Treat no user rating as a rating of zero
			if ( property == "userRating" ){
				propa = propa || 0;
				propb = propb || 0;
			}
			
			// Treat no price as maximum price
			if ( property == "price" ){
				propa = propa || Number.MAX_VALUE;
				propb = propb || Number.MAX_VALUE;
			}
			
			// Order rarity appropriately
			if ( property == "rarity" ){
				if ( propa == "L" )
					propa = 0;
				else if ( propa == "C" )
					propa = 1;
				else if ( propa == "U" )
					propa = 2;
				else if ( propa == "R" )
					propa = 3;
				else if ( propa == "M" )
					propa = 4;
				else
					propa = 5;
				
				if ( propb == "L" )
					propb = 0;
				else if ( propb == "C" )
					propb = 1;
				else if ( propb == "U" )
					propb = 2;
				else if ( propb == "R" )
					propb = 3;
				else if ( propb == "M" )
					propb = 4;
				else
					propa = 5;
			}
			
			// Sort first by the specified property
			if ( propa > propb ) return -1 * order;
			else if ( propa < propb ) return 1 * order;
			// Break ties by sorting by card name, always a-z
			else {
				if ( a[ "name" ] > b[ "name" ] ) return 1;
				else if ( a[ "name" ] < b[ "name" ] ) return -1;
				else return 0;							
			};
		} );
		
		// Send the list to be drawn
		context.setPage( 0 );
		
	};
	
	// Populate the visual list with filtered, sorted entries
	function populateList( forceScroll ){
	
		var minIndex = context.pageLength * context.currentPage;
		var maxIndex = Math.min( minIndex + context.pageLength - 1, context.cardCount - 1 );
		var list = '';
		
		// Compose an entry for every card on the current page
		for ( var i = minIndex; i <= maxIndex; i++ ){
			var card = context.sortedCards[ i ];
		
			// Preflight various card values to use in the HTML
			var key = keyFromName( card.name );
			var commander = 0;
			if ( context.deck.commander ){
				if ( context.deck.commander.indexOf( card ) >= 0 )
					commander = 1;
			}
			var count = context.deck.cards[ card.name ] ? context.deck.cards[ card.name ].count : 0;
			if ( !count && card.names )
				count = context.deck.cards[ card.names[ 0 ] ] ? context.deck.cards[ card.names[ 0 ] ].count : 0;
			
			var image = 'http://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=' + card.multiverseid + '&type=card';
			var link = 'http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=' + card.multiverseid;
			if ( !card.multiverseid ){
				image = 'images/cardback.jpg';
				link = 'http://gatherer.wizards.com/Pages/Default.aspx';
			}
			if ( !card.text )
				card.text = "";
			var rarityTitle = "";
			if ( card.rarity ){
				if ( card.rarity == "L" ) rarityTitle = "Basic Land";
				else if ( card.rarity == "C" ) rarityTitle = "Common";
				else if ( card.rarity == "U" ) rarityTitle = "Uncommon";
				else if ( card.rarity == "R" ) rarityTitle = "Rare";
				else if ( card.rarity == "M" ) rarityTitle = "Mythic Rare";
			}
			
			// Compose left hand section with the card image
			list += '<tr key="' + key + '" legal="1" commander="' + commander + '" count="' + count + '"><td>';
			list += '<a href="' + link + '" target="_blank" key="' + key + '"><img class="cardImage" src="' + image + '" onerror="this.src = \'images/cardback.jpg\'" /></a>';
			list += '</td><td>';
			
			// Compose the card entry with its various data fields
			list += '<a class="cardTitle" href="' + link + '" target="_blank" key="' + key + '">' + card.name + '</a>';
			if ( card.manaCost )
				list += '<span class="cardManaCost">' + card.manaCost + '</span>';
			list += '<span class="cardCMC">(' + card.cmc + ')</span>';
			if ( card.rarity )
				list += ' <span class="cardRarity" rarity="' + card.rarity + '" title="' + rarityTitle + '"></span>';
			if ( card.userRating && card.votes )
				list += ' <span class="cardRating">\u2605' + formatRating( card.userRating ) + '</span>';
			if ( card.price ){
				var priceData = formatPrice( card.price );
				list += ' <span class="cardPrice" title="' + priceData.alt + '">' + priceData.value + '</span>';
			}
			list += '<br><span class="cardType">' + card.type + '</span>';
			if ( card.power !== undefined && card.toughness !== undefined )
				list += '<span class="cardStats">(<span class="cardPower">' + card.power + '</span>/<span class="cardToughness">' + card.toughness + '</span>)</span>';
			list += '<br><span class="cardText">' + formatHelperText( replaceBreaks( card.text ) ) + '</span></td><td>';
			
			// Compose the UI section to the right of the card entry
			list += '<a class="add" title="Add to Deck" onclick="DECK.addCard( this.parentNode.parentNode.getAttribute(\'key\'), 1 );"><span>+</span></a>';
			list += '<div class="cardCount" count="0">' + count + '</div>';
			list += '<a class="remove" title="Remove from Deck" onclick="DECK.removeCard( this.parentNode.parentNode.getAttribute(\'key\'), 1 );"><span>-</span></a>';
			list += '<a title="Make Commander" class="commanderFlag" onclick="DECK.setCommander( this.parentNode.parentNode.getAttribute(\'key\') );"><span><img src="images/commander.svg" /></span></a>';
			list += '</td></tr>';
			
		}
		
		// Replace in special symbols and add the entry to the list
		context.listElement.innerHTML = replaceSymbols( list );
		
		// Update validation for the card entries
		context.refreshPage();
		
		// Update the page navigation at the bottom
		updateNavigation();
		
		// Scroll back to the top of the list if specified by parameter
		if ( ( forceScroll || context.forceScroll ) && context.listElement.parentNode.scrollTop != 0 )
			context.listElement.parentNode.scrollTop = 0;
			
	}


	/* UI HELPER FUNCTIONS */
	
	// Populate the page navigation bar at the bottom of the list
	function updateNavigation(){
	
		// Just recreate the contents of the bar to keep things simple
		context.navElement.innerHTML = '<a onclick="this.parentNode.cardList.setPage(0)" title="First Page"><img src="images/first.svg"></a> ';
		context.navElement.innerHTML += '<a onclick="this.parentNode.cardList.setPage(' + ( context.currentPage - 1 ) + ')" title="Previous Page"><img src="images/previous.svg"></a> ';
		context.navElement.innerHTML += '<span class="topTab"> Page ' + ( context.currentPage + 1 ) + ' of ' + ( context.pageCount ) + '</span>';
		context.navElement.innerHTML += ' <a onclick="this.parentNode.cardList.setPage(' + ( context.currentPage + 1 ) + ')" title="Next Page"><img src="images/next.svg"></a>';
		context.navElement.innerHTML += ' <a onclick="this.parentNode.cardList.setPage(' + ( context.pageCount - 1 ) + ')" title="Last Page"><img src="images/last.svg"></a>';
		
	}
	
	// Populate the select elements in the filter section
	function setSelectOptions(){
	
		// Initialize the options array for each type of selection
		for ( var field in context.filterTypes )
			if ( context.filterTypes[ field ].populate ) context.filterTypes[ field ].options = [];

		// Scrape the cards in the list for the data to populate with
		for ( var cardName in context.cards ){
			var card = context.cards[ cardName ];

			// Check each possible filter field for each card in the list
			for ( var field in context.filterTypes ){
				var type = context.filterTypes[ field ];
				if ( type.populate && card[ field ] ){

					// Harvest each listed value for each card with the data type
					for ( var entry = 0; entry < card[ field ].length; entry++ ){

						// But record each possible field value only once
						if ( type.options.indexOf( card[ field ][ entry ] ) < 0 )
						 type.options.push( card[ field ][ entry ] );
					}
				}
			}
		}

		// Add the option entries to each of the selects
		for ( var field in context.filterTypes ){
			if ( context.filterTypes[ field ].options && context.filterTypes[ field ].element ){
				var options = context.filterTypes[ field ].options;
				var content = "";
				
				// Sort them alphabetically for ease of use
				if ( field == "formats" ){
					options.sort( function( a, b ){
						ablock = a.match( /Block/ ) ? true : false;
						bblock = b.match( /Block/ ) ? true : false;
						if ( ablock && !bblock )
							return 1;
						else if ( !ablock && bblock )
							return -1;
						else if ( a > b )
							return 1;
						else
							return -1;
					} );				}
				else
					options.sort();
				
				// Include a blank entry at the top of the list
				options.unshift( "" );
				
				// Create a set of option elements and insert them
				var value = context.filterTypes[ field ].element.value;
				for ( var i = 0; i < options.length; i++ ){
					var selected = options[ i ] == value ? " selected" : "";
					content += '<option value="' + options[ i ] + '"' + selected + '>' + options[ i ] + '</option>';	
				}
				context.filterTypes[ field ].element.innerHTML = content;
			}
		}
		
	}

	// Add event listeners to the inputs in the filter section
	function setupField( element ){
		
		// Ignore any fields without corresponding filter data
		var field = element.getAttribute( "filterType" );
		if ( context.filterTypes[ field ] ){
			var type = context.filterTypes[ field ].type;
			
			// Listen for keystrokes on text input fields
			if ( type == "match" || type == "number" ){
				element.addEventListener( "keyup", function(){
					context.filterParameters[ field ] = this.value;
					if ( this.value == "" ) delete context.filterParameters[ field ];
					scheduleFilterUpdate( 200 );
				} );
			}
			// Listen for any change to a select element
			else if ( type == "list" ){
				element.addEventListener( "change", function(){
					context.filterParameters[ field ] = this.value;
					if ( this.value == "" ) delete context.filterParameters[ field ];
					scheduleFilterUpdate( 500 );
				} );
			}
			// Compound color selections into one big filter
			else if ( type == "color" ){
				element.addEventListener( "change", function(){
					var color = this.getAttribute( "manaColor" );
					
					// Initialize the filter parameters if they're unset
					context.filterParameters[ field ] = context.filterParameters[ field ] || {};
					
					// Set the chosen condition for the color specified
					context.filterParameters[ field ][ color ] = this.value;
					
					// Remove the selection entirely if the color is optional
					if ( this.value == "allowed" ) delete context.filterParameters[ field ][ color ];
					
					// Clean up the filter parameter if all colors are optional
					if ( Object.keys( context.filterParameters[ field ] ).length === 0 ) delete context.filterParameters[ field ];
					
					scheduleFilterUpdate( 500 );
				} );
			}
			// Handle the sort order list specially
			else if ( type == "sort" ){
				element.addEventListener( "change", function(){

					// Update what field we're sorting on
					context.sortProperty = this.value;
					
					// Sort ascending for most possible fields
					context.sortDescending = false;
					
					// Sort descending when sorting by rating
					if ( this.value == "userRating" )
						context.sortDescending = true;
						
					scheduleFilterUpdate( 500 );
				} );
			}
			// Handle the view mode list specially
			else if ( type == "view" ){
				element.addEventListener( "change", function(){
					
					// Set the appropriate property on the list container
					context.container.setAttribute( "viewMode", this.value );
					
				} );
			}
			
			// Match elements back to their filter types
			if ( context.filterTypes[ field ].populate )
				context.filterTypes[ field ].element = element;
				
		}
		
	}
	
	// Schedule a delayed update of the list from the filters
	function scheduleFilterUpdate( delay ){

		// Clear any existing scheduled update
		window.clearTimeout( context.filterTimer );
		
		// Schedule another update for later
		context.filterTimer = window.setTimeout( function(){
			filterList();
		}, delay );
		
	}
	
	// Replace {*} markers in text with appropriate symbol images				
	function replaceSymbols( text ){
		
		return text.replace( /\{([\w\d\/]+)\}/g, function( match, p1 ){
			
			// The image name for the tap symbol doesn't follow the normal pattern
			if ( p1 == "T" ) p1 = "tap";
			
			// The image name for the snow symbol doesn't follow the normal pattern
			if ( p1 == "S" ) p1 = "snow";
			
			// The image name for the untap symbol doesn't follow the normal pattern
			if ( p1 == "Q" ) p1 = "untap";
			
			// Remove the slashes form hybrid mana symbols
			p1 = p1.replace( /\//g, "" );
			
			// Typically the image name is just the string in the marker code
			return '<img class="symbol" src="http://gatherer.wizards.com/Handlers/Image.ashx?size=small&name=' + p1 + '&type=symbol" />';
			
		} );
	
	}

	// Replace text line breaks in a string with HTML line breaks
	function replaceBreaks( text ){
		
		return text.replace( /(?:\r\n|\r|\n)/g, "<br>" );
		
	}
	
	// Format a rating to always show exactly one decimal place
	function formatRating( value ){
	
		value = Math.round( value * 10 ) / 10;
		if ( value % 1 == 0 )
			value += ".0"
		return value + "";
	
	}

	// Format price data into broad ranges with helper text
	function formatPrice( price ){
	
		var pre = Math.floor( price ) + "";
		var post = Math.round( ( price % 1 ) * 100 ) + "";
		while ( post.length < 2 )
			post += "0";
		var num = pre + "." + post;
	
		if ( price < 0.50 )
			return { alt:"Around $" + num, value:'<span class="faded">$$$$</span>$' };
		else if ( price < 2.50 )
			return { alt:"Around $" + num, value:'<span class="faded">$$$</span>$$' };
		else if ( price < 10.00 )
			return { alt:"Around $" + num, value:'<span class="faded">$$</span>$$$' };
		else if ( price < 40.00 )
			return { alt:"Around $" + num, value:'<span class="faded">$</span>$$$$' };
		else
			return { alt:"Around $" + num, value:'$$$$$' };
		
	}
	
	// Tag any text on a card in parenthesis for special formatting
	function formatHelperText( text ){
		
		text = text.replace( /\(/g, '<span class="helper">(' );
		return text.replace( /\)/g, ')</span>' );
		
	}
	
	/* NAME CONVERSION HELPERS */
	
	// Converts a key value to a name value
	function nameFromKey( key ){
		return key.replace( /\|\|/g, "\"" );
	}
	
	// Converts a name value to a key value
	function keyFromName( name ){
		return name.replace( /"/g, "||" );
	}
	
	return this;
	
}

// Component class for accessing local storage DB
function Storage( callback, deck ){
	
	var context = this;
	
	this.deck = deck;
	this.database = null;
	this.decks = {};
	this.folders = {};
	this.decklistDirty = true;
	this.remote = deck.remote;
	this.ready = false;
	
	callback = callback || function(){};
	
	/* STORAGE ACCESS METHODS */

	// Connect the storage module to the database
	this.connect = function connect( callback ){
		callback = callback || function(){};
		var request = indexedDB.open( "mtgdecks", 2 );

		// Listen for and report errors
		request.onerror = function( event ){
			alert( "Failed to get local database due to an error:" + event.target.errorCode );
		};
		// Initialize or upgrade the database schema
		request.onupgradeneeded = function( event ){
			context.database = event.target.result;
			if ( event.oldVersion < 1 ){
				
				// First time database configuration
				var deckStore = context.database.createObjectStore( "decks", { keyPath:"name" } );
				deckStore.createIndex( "folder", "folder", { unique: false } );
				var cardStore = context.database.createObjectStore( "cards", { keyPath:"name" } );
				
			}
			else if( event.oldVersion < 2 ){
				
				// Database configuration update for returning users
				var cardStore = context.database.createObjectStore( "cards", { keyPath:"name" } );
				
			}
		};
		// Execute the callback when connection is ready
		request.onsuccess = function( event ){
			context.database = event.target.result;
			context.database.onerror = function( event ){
				alert( "Failed to save locally due to a database error: " + event.target.errorCode );
			};
			// Preload the deck list for future use
			context.loadList();
			
			// Mark the storage module as ready
			context.ready = true;
			
			// Invoke the callback function
			callback();
		};
		
	};

	// Write a deck to the database, overwriting existing entry if any
	this.save = function save( deck, callback, overwrite, serverToLocal, immediate ){
		callback = callback || function(){};
	
		// Produce a user facing error if database is disconnected
		if ( !context.database ){
			alert( "No local database available to save to." );
			return;
		}
		
		// Don't check the details when resaving form server
		if ( !serverToLocal ){
			
			// Prompt the user to name the deck before saving if needed
			if ( !deck.name ){
				context.deck.dialog.show( {
					allowClose:true,
					title:"Save Deck",
					body:'You must name your deck before it can be saved.<br><input type="text" class="nameInput" />',
					cancel:{},
					confirm:{ text:"SAVE", callback:function(){
						var name = this.parentNode.parentNode.querySelector( ".nameInput" ).value
						context.deck.name = name;
						context.deck.nameElement.value = name;
						context.deck.dialog.hide();
						context.deck.autoSave();
						context.deck.save();
					} },
					onLoad:function( dialog ){
						dialog.querySelector( ".nameInput" ).focus();
					}
				} );
				return;
			}
			
			// Prompt the user for confirmation before stomping saves
			if ( !overwrite && context.deck.name != context.deck.loadedFrom && context.decks[ context.deck.name ] ){
				context.deck.dialog.show( {
					title:"Save Deck",
					body:"A deck with this name already exists and will be overwritten if you proceed with saving. Continue?",
					allowClose:false,
					confirm:{ callback:function(){ 
						context.deck.save( true );
						context.deck.loadedFrom = context.deck.name;
					} },
					cancel:{}
				} );
				return;
			}
			
			// Clear the deckid if saving a brand new deck
			if ( !context.decks[ context.deck.name ] ){
				context.deck.deckid = null;
			}
			
		}

		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "decks" ], "readwrite" );
		trans.onerror = function( event ){
			alert( "Failed to save locally due to a transaction error: " + event.target.errorCode );
		}
		
		// Save the deck data to the database
		var store = trans.objectStore( "decks" );
		var bundle = ( deck.bundle ) ? deck.bundle() : deck;
		var request = store.put( bundle );
		request.onerror = function( event ){
			alert( "Failed to save due to request error: " + event.target.errorCode );
		};
		request.onsuccess = function( event ){
		
			// Mark the deck list dirty if needed
			context.decklistDirty = true;
		
			// Invoke the callback when save is done
			callback( request.result );
			
			// Save the deck remotely if logged in
			if ( !serverToLocal ){
				var immediate = bundle.name == "AUTOSAVE" ? immediate : true;
				context.remote.saveDeck( bundle, function( remoteDeck ){
					
					remoteDeck = JSON.parse( remoteDeck );
					
					// Note the data of the autosave in case we don't have it
					if ( remoteDeck.name == "AUTOSAVE" ){
						context.deck.autosaveId = remoteDeck.deckid;
						context.deck.autosaveVersion = remoteDeck.version;
					}
					
					// Assign the returned deckid if the deck didn't have one
					if ( !context.deck.deckid || context.deck.deckid == context.deck.autosaveId ){
						context.deck.deckid = remoteDeck.deckid;
					}
					
					// Push updates to the live deck if this one is active
					if ( remoteDeck.deckid == context.deck.deckid ){
						context.deck.lastUsed = remoteDeck.lastUsed;
						context.deck.owner = remoteDeck.owner;
						context.deck.version = remoteDeck.version;
					}
					
					// Resave the deck locally with updates from the server
					context.save( remoteDeck, function(){}, true, true );
					
				}, immediate );
			}
			
		}
	
	};

	// Save the master card catalog for offline use
	this.saveCatalog = function saveCatalog( catalog, callback ){
		callback = callback || function(){};
	
		// Produce a user facing error if database is disconnected
		if ( !context.database ){
			alert( "No local database available to save catalog to." );
			return;
		}		
		
		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "cards" ], "readwrite" );
		trans.onerror = function( event ){
			alert( "Failed to save local catalog due to a transaction error: " + event.target.errorCode );
		}
		
		// Save the deck data to the database
		var store = trans.objectStore( "cards" );
		var request = store.put( catalog );
		request.onerror = function( event ){
			alert( "Failed to save local catalog due to request error: " + event.target.errorCode );
		};
		request.onsuccess = function( event ){
		
			// Invoke the callback when save is done
			callback( request.result );
			
		}
		
	};
	
	// Delete a deck from the database
	this.remove = function remove( deckName, callback, deckid, localOnly ){
		callback = callback || function(){};
	
		// Produce a user facing error if the database is gone
		if ( !context.database ){
			alert( "No local database available to delete from." );
			return;
		}
	
		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "decks" ], "readwrite" );
		trans.onerror = function( event ){
			alert( "Failed to delete from local due to a transaction error: " + event.target.errorCode );
		}
		
		// Delete the specified entry from the database
		var store = trans.objectStore( "decks" );
		var request = store.delete( deckName );
		request.onerror = function( event ){
			alert( "Failed to delete from local due to request error: " + event.target.errorCode );
		};
		request.onsuccess = function( event ){
		
			// Mark the deck list dirty
			context.decklistDirty = true;
		
			// Invoke the callback once the entry is deleted
			callback( request.result );
			
		}
		
		// Save to server if available
		if ( deckid != "undefined" && !localOnly )
			context.remote.deleteDeck( deckid, function(){} );
	
	};

	// Load deck data from the database and send it to the callback function
	this.loadDeck = function loadDeck( deckName, callback ){
			callback = callback || function(){};

		// Produce a user facing error if the database is gone
		if ( !context.database ){
			alert( "No local database available to load from." );
			return;
		}

		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "decks" ], "readonly" );
		trans.onerror = function( event ){
			alert( "Failed to load local data due to a transaction error: " + event.target.errorCode );
		}
		
		// Request the specified deck's data from the database
		var store = trans.objectStore( "decks" );
		var request = store.get( deckName );
		request.onerror = function( event ){
			alert( "Failed to load  from local due to request error: " + event.target.errorCode );
		};
		request.onsuccess = function( event ){
		
			// Invoke the callback, passing the deck data to it
			callback( request.result );
			
		}
	
	};

	// Load all the decks from the database as a big blob
	this.loadAllDecks = function loadAllDecks( callback ){
		callback = callback || function(){};
	
		// Produce a user facing error if the database is gone
		if ( !context.database ){
			alert( "No local database available to load from." );
			return;
		}

		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "decks" ], "readonly" );
		trans.onerror = function( event ){
			alert( "Failed to load local data due to a transaction error: " + event.target.errorCode );
		}
		
		// Recurse over the database gathering deck names
		var decks = {};
		var store = trans.objectStore( "decks" );
		store.openCursor().onsuccess = function( event ){
			var cursor = event.target.result;
			if ( cursor ){
				
				// Record the data for each deck
				var key = cursor.value.deckid || cursor.value.name;
				decks[ key ] = cursor.value;
				
				cursor.continue();
			}
			// When all decks have been evaluated, send the list to the callback
			else{
				callback( decks );
			}
		};
		
	};
	
	// Load the master card catalog from local data
	this.loadCatalog = function loadCatalog( callback ){
		var callback = callback || function(){};

		// Produce a user facing error if the database is gone
		if ( !context.database ){
			alert( "No local database available to load catalog from." );
			return;
		}

		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "cards" ], "readonly" );
		trans.onerror = function( event ){
			alert( "Failed to load local catalog due to a transaction error: " + event.target.errorCode );
		}
		
		// Request the specified deck's data from the database
		var store = trans.objectStore( "cards" );
		var request = store.get( "master" );
		request.onerror = function( event ){
			alert( "Failed to load local catalog due to request error: " + event.target.errorCode );
		};
		request.onsuccess = function( event ){
		
			// Invoke the callback, passing the deck data to it
			callback( request.result );
			
		}
	
	};
	
	// Gather a list of stored decks and send it to the callback function
	this.loadList = function loadList( callback, includeAutosave ){
		callback = callback || function(){};
	
		// Used the cached deck list unless specified otherwise
		if ( !context.decklistDirty )
			callback( context.folders );
	
		// Produce a user facing error if the database is gone
		if ( !context.database ){
			alert( "No local database available to load from." );
			return;
		}

		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "decks" ], "readonly" );
		trans.onerror = function( event ){
			alert( "Failed to load local data due to a transaction error: " + event.target.errorCode );
		}
		
		// Recurse over the database gathering deck names
		context.decks = {};
		context.folders = {};
		var store = trans.objectStore( "decks" );
		store.openCursor().onsuccess = function( event ){
			var cursor = event.target.result;
			if ( cursor ){
				
				if ( cursor.key != "AUTOSAVE" || includeAutosave ){
					
					// Record each deck's key and organization folder
					var folder = cursor.value.folder || "General";
					context.decks[ cursor.key ] = { name:cursor.key, folder:folder, deckid:cursor.value.deckid };
					
					// Build the folder structure for the decks
					if ( !context.folders[ folder ] ) context.folders[ folder ] = {};
					context.folders[ folder ][ cursor.key ] = context.decks[ cursor.key ];
					
				}
				
				cursor.continue();
			}
			// When all decks have been evaluated, send the list to the callback
			else{
				context.decklistDirty = false;
				callback( context.folders );
			}
		};
	
	};

	// Clears all the decks from the local database and memory
	this.clear = function clear(){
		
		// Get a complete list of decks to delete
		context.loadList( function( deckList ){
			
			// Delete each of the decks in turn
			for ( var deckName in context.decks )
				context.remove( deckName, function(){}, null, true );
			
		}, true );
		
	};
	
	this.connect( callback );
	
	return this;

};

// Component class for accessing remote storage
function Remote( deck ){
	
	var context = this;
	
	this.deck = deck;
	this.address = "https://storage.deckmaven.com/";
	this.user = {};
	this.loggedIn = false;
	this.googleToken = null;
	this.loginCallback = null;
	this.deferredAction = null;
	this.deferredSave = null;
	
	// Send credentials to the server and start a session
	this.logIn = function logIn( googleToken, callback ){
		
		googleToken = googleToken || context.googleToken;
		callback = callback || context.loginCallback;
		
		// Defer this if local storage isn't ready yet
		if ( !context.deck.storage ){
			context.googleToken = googleToken;
			context.loginCallback = callback;
			context.deferredAction = window.setTimeout( context.logIn, 100 );
			return;
		}
		if ( !context.deck.storage.ready ){
			context.googleToken = googleToken;
			context.loginCallback = callback;
			context.deferredAction = window.setTimeout( context.logIn, 100 );
			return;
		}
		
		post( "login", "googleToken=" + googleToken, function( user ){
			
			if ( !user ){
				return;
			}
			
			context.user = JSON.parse( user );
			context.loggedIn = true;
			
			// Download all the user's deck data
			context.getAllDecks( function( remoteDecks ){
				
				// Load up all decks from local storage
				context.deck.storage.loadAllDecks( function( localDecks ){
					
					// Compare each remote deck to its local counterpart
					for ( var remoteId in remoteDecks ){
						
						// Find any local deck with a matching name
						var deckid = remoteId;
						for ( var localId in localDecks ){
							if ( localDecks[ localId ].name == remoteDecks[ remoteId ].name )
								deckid = localId;
						}
						
						// If the deck exists in both figure out which to keep
						if ( localDecks[ deckid ] ){
							
							// Keep whichever version of the deck is stamped newer
							var keepLocal = false;
							if ( localDecks[ deckid ].version > remoteDecks[ remoteId ].version && Object.keys( localDecks[ deckid ].cards ).length > 0 )
								keepLocal = true;
							
							// Push the local version of the deck up to the server
							if ( keepLocal ){
								context.deck.storage.save( localDecks[ deckid ], function(){}, true, false );
							}
							// Ovewrite the local version with the remove version
							else{
								context.deck.storage.save( remoteDecks[ remoteId ], function(){}, true, true );
							}
							
							// Remove the local deck from the temp list
							delete localDecks[ deckid ];
							
						}
						// Otherwise add the remote deck to local storage
						else{
							context.deck.storage.save( remoteDecks[ remoteId ], function(){}, true, true );
						}
							
					}
					
					// Write all remaining local decks back to the server
					for ( var localId in localDecks )
						context.deck.storage.save( localDecks[ localId ], function(){}, true, false );
					
					// Reload the resolved AUTOSAVE into the editor
					context.deck.loadAutosave( function(){} );
					
				} );
				
			} );
						
			callback( context.user );
			
		} );
		
	};
	
	// Clean up after a user logs out of their account
	this.logOut = function logOut( callback ){
		
		// Can't log out if we're not logged in
		if ( !context.loggedIn )
			return;
		
		var auth2 = gapi.auth2.getAuthInstance();
		auth2.signOut().then( function(){
				
			context.loggedIn = false;
			context.user = null;
			context.deck.storage.clear();
			context.deck.resetDeck();
			
			callback();
		});		
		
	};

	// Update the user data on the server
	this.saveUser = function saveUser( callback ){
		
		// Can't save if we're not logged in
		if ( !context.loggedIn )
			return;
		
		post( "putuser", "user=" + JSON.stringify( context.user ), function( user ){
			if ( user ){
				context.user = JSON.parse( user );
				callback( user );
			}
		} );
		
	};

	// Request information about a user from the server
	this.getUser = function getUser( userid, callback ){
		
		post( "getuser", "user=" + JSON.stringify( context.user ) + "&target=" + userid, function( user ){
			if ( user )
				callback( user );
		} );
		
	};

	// Save a deck to the server
	this.saveDeck = function saveDeck( deck, callback, immediate ){
		
		// Can't save if we're not logged in
		if ( !context.loggedIn )
			return;
		
		// Clear any impending deferred save
		clearTimeout( context.deferredSave );
		context.deferredSave = null;
		
		// Schedule the save for later if not marked immediate
		if ( !immediate ){
			context.deferredSave = window.setTimeout( function(){
				context.deferredSave = null;
				post( "putdeck", "user=" + JSON.stringify( context.user ) + "&deck=" + JSON.stringify( deck ), function( deck ){
					if ( deck ){
						context.getUser( context.user.userid, function( user ){
							if ( user ){
								context.user = JSON.parse( user );
								callback( deck );
							}
						} );
					}
				} );
			}, 5000 );
			return;
		}
		
		// Save the deck to the remote database
		post( "putdeck", "user=" + JSON.stringify( context.user ) + "&deck=" + JSON.stringify( deck ), function( deck ){
			context.getUser( context.user.userid, function( user ){
				context.user = JSON.parse( user );
				callback( deck );
			} );
		} );
		
	};

	// Request a deck drom the server
	this.getDeck = function getDeck( deckid, callback ){
		
		post( "getdeck", "user=" + JSON.stringify( context.user ) + "&deckid=" + deckid, function( data ){
			if ( data )
				callback( data );
		}	);
		
	};

	// Get all the user's decks from the server
	this.getAllDecks = function getAllDecks( callback ){
		
		// This man has no deck
		if ( !context.user.decks )
			return {};
		
		// Download all the decks
		var decks = {};
		var pending = 0;
		for ( var deckid in context.user.decks ){
			pending++;
			context.getDeck( deckid, function( data ){
				
				// Acumulate the deck data
				if ( data ){
					data = JSON.parse( data );
					decks[ data.deckid ] = data;
				}
				
				// Do the callback when all decks are done
				// Race condition in case of break point here
				pending--;
				if ( pending == 0 )
					callback( decks );
				
			} );
		}
		
	};
	
	// Delete a deck from the server
	this.deleteDeck = function deleteDeck( deckid, callback ){
		
		// Can't delete if we're not logged in
		if ( !context.loggedIn )
			return;
		
		post( "deletedeck", "user=" + JSON.stringify( context.user ) + "&deckid=" + deckid, function( deck ){
			context.getUser( context.user.userid, function( user ){
				if ( user ){					
					context.user = JSON.parse( user );
					callback( deck );
				}
			} );
		} );
		
	};
	
	// General POST message sender
	function post( command, content, callback ){
	
		var xhr = new XMLHttpRequest();
		xhr.open( "POST", context.address + command, true );
		xhr.setRequestHeader( "Content-Type", "application/x-www-form-urlencoded" );
		xhr.onreadystatechange = function(){
			if ( this.readyState == XMLHttpRequest.DONE && this.status == 200 ){
				if ( typeof callback === "function" )
					callback( xhr.responseText );
				else
					console.error( "Bad callback function in XHR call" );
			}
			else if ( this.readyState == XMLHttpRequest.DONE ){
				callback( false );
			}
		}
		xhr.send( content );
	
	}
	
}

// Component class for managing the popup dialog box
function DialogBox( container ){

	var context = this;
	
	this.container = container;
	this.closeButton = container.querySelector( ".closeButton" );
	this.cancelButton = container.querySelector( ".cancelButton" );
	this.confirmButton = container.querySelector( ".confirmButton" );
	this.cancelCallback = null;
	this.confirmCallback = null;
	this.title = container.querySelector( ".dialogTitle" );
	this.body = container.querySelector( ".dialogBody" );
	this.onClose = function(){};
	
	// Close the dialog whenever a button gets clicked
	this.closeButton.addEventListener( "click", function(){
		context.container.style.display = "none";
		context.onClose();
	} );
	this.cancelButton.addEventListener( "click", function(){
		context.container.style.display = "none";
		context.onClose();
	} );
	this.confirmButton.addEventListener( "click", function(){
		context.container.style.display = "none";
		context.onClose();
	} );
	
	// Listen for keyboard shortcuts to confirm and cancel
	document.addEventListener( "keyup", function( e ){
		
		// Ignore this if the dialog box isn't open
		if ( context.container.style.display == "none" )
			return;
		
		// Listen for escape for the cancel button
		if ( e.keyCode == 27 )
			context.cancelButton.click();
		
		// Listen for enter for the confirm button
		else if ( e.keyCode == 13 )
			context.confirmButton.click();
		
	} );
	
	/* BASIC CONTROL METHODS */
	
	// Show the dialog box with the specified options
	this.show = function show( options ){
	
		// Set the text of the dialog box
		if ( options.title ) this.title.innerHTML = options.title;
		if ( options.body ) this.body.innerHTML = options.body;
		
		// Hide or show the close button
		if ( options.allowClose !== undefined ){
			if ( !options.allowClose )
				context.container.setAttribute( "close", "0" );
			else
				context.container.setAttribute( "close", "1" );
		}
		
		// Configure the cancel button
		if ( options.cancel ){
			context.container.setAttribute( "cancel", "1" );
			if ( context.cancelCallback )
				context.cancelButton.removeEventListener( "click", context.cancelCallback );
			if ( options.cancel.callback ){
				context.cancelButton.addEventListener( "click", options.cancel.callback );
				context.cancelCallback = options.cancel.callback;
			}
			if ( options.cancel.text )
				context.cancelButton.querySelector( "span" ).innerHTML = options.cancel.text;
			else
				context.cancelButton.querySelector( "span" ).innerHTML = "CANCEL";
				
		}
		else
			context.container.setAttribute( "cancel", "0" );
	
		// Configure the confirm button
		if ( options.confirm ){
			context.container.setAttribute( "confirm", "1" );
			if ( context.confirmCallback )
				context.confirmButton.removeEventListener( "click", context.confirmCallback );
			if ( options.confirm.callback ){
				context.confirmButton.addEventListener( "click", options.confirm.callback );
				context.confirmCallback = options.confirm.callback;
			}
			if ( options.confirm.text )
				context.confirmButton.querySelector( "span" ).innerHTML = options.confirm.text;
			else
				context.confirmButton.querySelector( "span" ).innerHTML = "CONFIRM";
		}
		else
			context.container.setAttribute( "confirm", "0" );
		
		// Set the close dialog callback
		if ( options.onClose )
			context.onClose = options.onClose;
		else
			context.onClose = function(){};
		
		// Show the dialog box
		context.container.style.display = 'table';

		// Run any on-load function for the dialog box
		if ( options.onLoad )
			options.onLoad( context.container );
	
		
	};
	
	// Hide the dialog box
	this.hide = function hide(){
		
		context.container.style.display = 'none';
		
	}
	
	return this;

}

// Export the deck list to a text file in the standard format
function exportList( deck ){
	
	// Clean up oddball characters in the deck name to make a file name
	if ( deck.name )
		name = deck.name.replace( /[\s\?\\\/_]+/g, " " );
		
	// Default to "list.txt" if the deck wasn't named at all
	else
		name = "list";
		
	// Use file saver to construct and send the file to the user
	var blob = new Blob( [ deck.list() ], { type: "text/plain;charset=utf-8" } );
	saveAs(blob, name + ".txt");

}			

// Warn the user about overwrite before importing
function importWarn( fileInput ){
	
	var input = fileInput;
	DECK.dialog.show( {
		title:"Import Deck List",
		body:"Importing a new deck list will replace all cards currently in your deck list. Would you like to proceed?",
		allowClose:false,
		confirm:{ callback:function(){ importList( input ); } },
		cancel:{ callback:function(){ input.value = "" } }
	} );
	
}

// Import a list of cards in the standard text file format
function importList( fileInput ){

	// Don't do anything if there's no file to do it with
	var file = fileInput.files[ 0 ];
	if ( file == null )
		return;
		
	// Parse the file provided by the user and import it
	var reader = new FileReader();
	reader.onload = function( e ){
	
		// Initialize a save bundle to populate data into
		var bundle = { name:"", format:"", folder:"", cards:{}, commander:[] };
		
		// Go through each row of the file and add it to the bundle
		var rows = e.target.result.split( "\n" );
		for ( var i = 0; i < rows.length; i++ ){
			if ( rows[ i ] != "" ){
			
				// Dig the card name out from between other information
				var cardName = rows[ i ].match( /(?:^[\d]+x[\s]+|^)([^\*$]+)/ )[ 1 ];
				cardName = cardName.replace( /[\r\n]+/g, '' );
				cardName = cardName.replace( /[\s]+$/, '' );
				bundle.cards[ cardName ] = { name:cardName, count:1 };
				
				// Get the quantity of the card if it's specified
				var quantity = rows[ i ].match( /^([\d]+)x/ );
				if ( quantity ) bundle.cards[ cardName ].count = parseInt( quantity[ 1 ] );

				// If a commander is specified, note it in the bundle
				var commander = ( rows[ i ].match( /\*cmdr\*/i ) ) ? true : false;
				if ( commander ){
					bundle.format = "Commander";
					bundle.commander.push( cardName );
				}
				
			}
		}
		
		// Load the bundle into the deck list
		var error = DECK.load( bundle );
		
		// If there were any unidentified cards, tell the user
		if ( error.length ){
			var list = "";
			for ( var i = 0; i < error.length; i++ )
				list += "<li>" + error[ i ] + " was not recognized.</li>";
			DECK.dialog.show( {
				title:"Import Deck List",
				body:"There were one or more issues during import:</br><ul>" + list + "</ul>",
				allowClose:true
			} );
		}
		
		// Reset the file input
		fileInput.value = "";
		
	};
	reader.readAsText( file );

}

// Show the app information and credits dialog
function showCredits(){
	
	var credits = 'This Magic the Gathering deck building tool is built and maintained by Omnibus Games LLC, and hosted on <a href="https://github.com/ChainsawXIV/deckbuilder" target="_blank">GitHub</a>. Submit bug reports and feature requests on the issues page, <a href="https://github.com/ChainsawXIV/deckbuilder/issues" target="_blank">here</a>.<br><br>Card data for this project is provided by:<ul><li><a href="https://mtgjson.com/" target="_blank">https://mtgjson.com/</a></li><li><a href="http://gatherer.wizards.com/Pages/Default.aspx" target="_blank">http://gatherer.wizards.com/</a></li></ul>Magic the Gathering and all associated information and materials are the property of <a href="https://magic.wizards.com" target="_blank">Wizards of the Coast</a>, and this tool is not associated with Wizards of the Coast in any way.<br><br><b>Update History</b><br><br>';
	credits += '<u>Version 0.3.0 (August 7th, 2018)</u><ul><li>Added support for login with Google and cloud storage of decks by logged in users.</li></ul>';
	credits += '<u>Version 0.2.3 (July 21st, 2018)</u><ul><li>Added support for the Brawl format (pending MTG JSON data up stream bug fixes).</li><li>Added support and deck validation for Partner and Partners With commanders.</li><li>Addressed serious layout issues with the deck lists in Internet Explorer and Firefox.</li></ul>';
	credits += '<u>Version 0.2.2 (July 17th, 2018)</u><ul><li>Fixed additional filtering, deck and card validation, and layout related bugs.</li><li>Significantly improved card rating data by averaging across all printings of a particular card.</li></ul>';
	credits += '<u>Version 0.2.1 (January 10th, 2018)</u><ul><li>Fixed a number of edge cases and bugs with user interactions and filtering.</li><li>Added card rarity to the data set and denoted it on the card list for building pauper.</li></ul>';
	credits += '<u>Version 0.2.0 (January 6th, 2018)</u><ul><li>Major code cleanup and bug fixing pass, resolving numerous issues and improving performance.</li><li>Added support for importing and exporting deck lists in the standard text format.</li><li>Added support for cards with unusual deck building rules such as Planeswalker commanders.</li></ul>';
	credits += '<u>Version 0.1.0 (January 2nd, 2018)</u><ul><li>First pass implementation of all core deck building and card lookup features, plus local saving.</li><li>First pass interface design and implementation for current and upcoming feature set.</li></ul>';
	
	DECK.dialog.show( {
		allowClose:true,
		title:"Deck Builder Information",
		body:credits
	} );
	
}

// Warn the user about overwrite before importing
function loadWarn( deckName ){
	
	DECK.dialog.show( {
		title:"Load Deck",
		body:"Loading a deck will replace all cards currently in your deck list. Would you like to proceed?",
		allowClose:false,
		confirm:{ callback:function(){
			DECK.storage.loadDeck( deckName, DECK.load );
			DECK.dialog.hide();
		} },
		cancel:{}
	} );
	
}

// Open up a deck browser so the user can load a deck
function showDeckList(){
	
	// Get the folder list from storage
	DECK.storage.loadList( function( folders ){
		
		// Sort the folder list alphabetically
		var sortedFolders = [];
		for ( var folderName in folders )
			sortedFolders.push( folderName );
		sortedFolders.sort();
		
		// Build the HTML string for the folder list
		var code = '<span class="folderList">';
		if ( sortedFolders.length ){
			for ( var f = 0; f <  sortedFolders.length; f++ ){
				var decks = folders[ sortedFolders[ f ] ];
				code += sortedFolders[ f ] + '<img class="folderIcon" src="images/open.svg"><ul>';
				
				// Sort the deck lists in each folder
				var sortedDecks = [];
				for ( var deckName in decks )
					sortedDecks.push( deckName );
				sortedDecks.sort();
				
				// Add the deck links to the list
				for ( var d = 0; d < sortedDecks.length; d++ ){
					var name = sortedDecks[ d ].replace( /"/g, '\\\"' );
					name = name.replace( /'/g, "\\\'" );
					code += '<li><a onclick="loadWarn( \'' + name + '\' )" title="Load Deck">' + sortedDecks[ d ] + "</a>"
					code += '<a class="deleteDeck" onclick="DECK.storage.remove( \'' + name + '\', showDeckList, \'' + decks[ sortedDecks[ d ] ].deckid + '\' );" title="Delete Deck"><span>&#215;</span></a></li>';
				}
				code += "</ul>";
			}
		}
		else{
			code += "No saved decks available.";
		}
		code += "</span>";
		
		// Show a dialog box with the folder tree in it
		DECK.dialog.show( {
			title:"Open Deck",
			body:code,
			allowClose:true
		} );		
		
	} );
	
}

// Convert the signing button to a signout button
function onSignIn( googleUser ){

	var profile = googleUser.getBasicProfile();
	var id_token = googleUser.getAuthResponse().id_token;
		
	DECK.remote.logIn( id_token, function( user ){
		
		// Update the login button the interface
		var userIcon = document.getElementById( "user" );
			userIcon.querySelector( "img" ).src = profile.getImageUrl();
			userIcon.style.display = "inline-block";
		var loginIcon = document.getElementById( "login" );
			loginIcon.style.display = "none";
		
	} );
	
}

// Convert the signout button to a signin button
function onSignOut( confirmed ){
	
	if ( confirmed ){
		DECK.autoSave( true );
		DECK.remote.logOut( function(){
			
			
			var userIcon = document.getElementById( "user" );
				userIcon.style.display = "none";
			var loginIcon = document.getElementById( "login" );
				loginIcon.style.display = "inline-block";
				
		} );
	}
	else{
		DECK.dialog.show( {
			title:"Sign Out",
			body:"Signing out will clear all local deck data from this device. Your deck data will be restored next time you log in. Continue?",
			allowClose:false,
			confirm:{ callback:function(){
				onSignOut( true );
				DECK.dialog.hide();
			} },
			cancel:{}
		} );	
	}
	
}



