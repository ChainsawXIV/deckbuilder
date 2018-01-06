
// Master class for the deck builder tool itself
function Deck( container, callback ){
	
	var context = this;
	
	this.container = container;
	this.cardData = null;
	this.catalog = null;
	this.decklist = null;
	this.storage = null;
	this.dialog = null;
	this.callback = callback || function(){};
	this.nameElement = container.querySelector( ".deckName input" );
	this.formatElement = container.querySelector( ".deckFormat select" );
	this.issuesElement = container.querySelector( ".deckIssues" );
	this.masterTable = container.querySelector( ".masterTable" );
	this.cards = {};
	this.format = "";
	this.name = "";
	this.folder = "";
	this.minCards = -1;
	this.maxCards = -1;
	this.commander = null;
	this.identity = ["W","U","B","R","G"];
	this.formats = {
		default:{ minCards:60 },
		Commander:{ minCards:100, maxCards:100, commander:true }
	}
	
	
	/* INITIALIZATION AND LOADING */
	
	// Fetch the master card data and set up the card lists
	var request = new XMLHttpRequest();
	request.onreadystatechange = function initializeDeck(){
		if( request.readyState == 4 ){
		
			context.cardData = JSON.parse( request.responseText );
		
			// Create the main card catalog list
			context.catalog = new CardList( 
				context.container.querySelector( ".searchFrame" ),
				context.container.querySelector( ".searchFrame" ),
				context
			);
			context.catalog.setCards( context.cardData );
			
			// Create an empty list for the deck
			context.decklist = new CardList(
				context.container.querySelector( ".deckFrame" ),
				context.container.querySelector( ".searchFrame" ),
				context
			);
			context.decklist.forceScroll = false;
			
			// Set up the general purpose dialog box
			context.dialog = new DialogBox( context.container.querySelector( ".interstitial" ) );

			// Populate the list of formats for the deck
			var options = context.catalog.filterTypes.formats.options;
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
			
			// Connect to storage and load autosaved data
			context.storage = new Storage( function initializeStorage(){
					
				// Attempt to load the last WIP deck from storage
				context.storage.loadDeck( "AUTOSAVE", function loadAutosave( bundle ){
					
					// Load the autosave data if it exists
					if( bundle )
						context.load( bundle );
						
					// Invoke the callback when the deck is ready
					context.callback();
					
				} );
					
			} );
			
		}
	};
	request.open( "GET", "https://chainsawxiv.github.io/deckbuilder/data.json", true );
	request.send();	
	

	/* DECK ACTION METHODS */
	
	// Add a new card to the deck
	this.addCard = function addCard( cardKey, quantity ){
		
		var cardName = nameFromKey( cardKey );
		// Increase quantity if card is already in the deck
		if ( context.cards[ cardName ] )
			context.cards[ cardName ].count += quantity;
		// Add the card to the deck if it's not already in it
		else{
			if ( context.cardData[ cardName ] ){
				context.cards[ cardName ] = context.cardData[ cardName ];
				context.cards[ cardName ].count = quantity;
			}
		}
		
		// Propagate changes to the deck list
		context.decklist.setCards( context.cards );
		
		// Update counts and state on all card lists
		context.validateCard( cardName );
		
		// Save the changes to the deck
		context.autoSave();
		
	}
	
	// Remove a card from the deck
	this.removeCard = function removeCard( cardKey, quantity ){
	
		var cardName = nameFromKey( cardKey );
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
				if ( context.commander ){
					if ( context.commander.name == cardName )
						context.clearCommander();
				}

			}
			else
				// Reduce the count if there are enough left
				context.cards[ cardName ].count -= quantity;
		}
		
		// Update the state of the card as needed
		context.validateCard( cardName );
		
		// Save the changes to the deck
		context.autoSave();
	
	}

	// Set the deck format and validate rules
	this.setFormat = function setFormat( format ){
		
		// Use default rules for formats without their own data
		context.format = format;
		if ( !context.formats[ format ] ) format = "default";
		
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
		context.autoSave();
		
	}
	
	// Set the commander card for the deck
	this.setCommander = function setCommander( cardKey ){

		var cardName = nameFromKey( cardKey );
		
		// Remove commander status from any old commander rows
		if ( context.commander )
			context.cardData[ context.commander.name ].commander = false;
		
		// If toggling the existing commander, toggle it off
		if ( context.commander ){
			if ( cardName == context.commander.name ){

				// Unset the commander from the deck
				context.clearCommander();
				
				return;
				
			}
		}

		// Add commander status to any rows for the new commander
		context.cardData[ cardName ].commander = true;
		
		// Store the commander's data and color identity for the deck
		context.commander = context.cardData[ cardName ];
		if ( context.commander.identity )
			context.identity = context.commander.identity;
		else
			context.identity = [];
		
		// Make sure the commander is actually in the deck list
		if ( !context.commander.count ){
			context.addCard( cardKey, 1 );
		}
		
		// Update counts and legality for all cards in all lists
		context.validateDeck( true );
		
		// Check legality for the cards on the catalog page
		context.catalog.refreshPage();
		
		// Save the changes to the deck
		context.autoSave();
		
	}
	
	// Clear the commander selection from the deck entirely
	this.clearCommander = function clearCommander(){
	
		// Validate that there's a commander to remove
		if ( context.commander ){
		
			// Clear the commander and color identity from the deck
			context.commander = null;
			context.identity = ["W","U","B","R","G"];
			
			// Check legality for the cards on the catalog page
			context.catalog.refreshPage();
		
			// Fully re-validate the deck list
			context.validateDeck( true );
			
			// Save the changes
			context.autoSave();
			
		}
	
	}
	

	/* DECK DATA METHODS */
	
	// Create a text deck list in the standard format
	this.list = function list(){
	
		var out = '';
		for ( var cardName in context.cards ){
			out += context.cards[ cardName ].count + "x " + cardName;
			if ( context.commander ){
				// If there's a commander, mark it in the deck list
				if ( cardName == context.commander.name )
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
		};
		
		// Reduce the commander to only its name
		if ( context.commander )
			bundle.commander = context.commander.name;
		
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
	this.save = function save(){
	
		context.storage.save( context.bundle() );
	
	}
	
	// Save the deck to the draft slot in storage
	this.autoSave = function autoSave(){
	
		context.storage.save( context.bundle( "AUTOSAVE" ) );
	
	};
	
	// Load the deck from a provided data bundle
	this.load = function load( bundle ){

		// Recover the deck name from the bundle
		context.name = bundle.name;
		if ( bundle.tempName ) context.name = bundle.tempName;
		else context.name = "";
		context.nameElement.value = context.name;
		
		// Set the proper format in the format menu
		context.setFormat( bundle.format );
		context.formatElement.querySelector( 'option[value="' + bundle.format + '"]' ).selected = "selected";
		
		context.folder = bundle.folder;
		// FOLDER RELATED GUI POPULATION
		
		// Replace the existing card list with the bundle's
		context.cards = {};
		for ( var cardName in bundle.cards ){
			if( context.cardData[ cardName ] ){
				context.cards[ cardName ] = context.cardData[ cardName ];
				context.cards[ cardName ].count = bundle.cards[ cardName ].count;
			}
		}
			
		// Designate the commander if specified
		if ( bundle.commander )
			context.setCommander( keyFromName( bundle.commander ) );

		// Propagate the changes to the card lists
		context.decklist.setCards( context.cards );
		
		// Update the counts and states in the card lists
		context.validateDeck( true );
		
		// Save the changes to the deck
		context.autoSave();
			
	}
			

	/* RULES VALIDATION METHODS */
	
	// Checks and updates the legality of an individual card
	this.validateCard = function validateCard( cardName, checkDeck ){
		checkDeck = ( checkDeck === undefined ) ? true : checkDeck;
		
		var card = context.cardData[ cardName ];
		var legal = true;
		var issue = "";
		
		// Always allow any number of each basic land type
		if ( card.supertypes ){
			if ( card.supertypes.indexOf( "Basic" ) >= 0 )
				legal = true;
		}
		// For all other card types do lots of validation...
		else{
		
			// Validate the card's legality in the chosen format
			if ( context.format != "" ){
			
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
			
			// Validate special conditions of the Commander format
			if ( context.format == "Commander" && legal ){
			
				// Everything but basic lands are limited to one per deck
				if ( card.count > 1 ){
					legal = false;
					issue = "Too many copies of " + card.name + ".";
				}
				
				// Cards must match the color identity of the commander
				else if ( card.colorIdentity ){
					for ( var i = 0; i < card.colorIdentity.length; i++ ){
						if ( context.identity.indexOf( card.colorIdentity[ i ] ) < 0 ){
							legal = false;
							issue = card.name + " doesn't match commander's colors.";
						}
					}
				}
				
			}
			// Validate the usual card count maximum of four in other formats
			else if ( card.count > 4 ){
				legal = false;
				issue = "Too many copies of " + card.name + ".";
			}
		
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
		}

		// Validate that commander decks have a proper commander
		if ( context.format == "Commander" ){
			if ( !context.commander ){
				legal = 0;
				issues.push( "You must select a commander." );
			}
			else{
				if ( context.commander.supertypes ){
					if ( context.commander.supertypes.indexOf( "Legendary" ) < 0 ){
						legal = 0;
						issues.push( "Your commander must be legendary." );
					}
				}
				if ( context.commander.types ){
					if ( context.commander.types.indexOf( "Creature" ) < 0 ){
						legal = 0;
						issues.push( "Your command must be a creature." );
					}
				}
			}
		}
		
		// If a minimum card count is specified, check against it
		var count = Object.keys( context.cards ).length;
		if ( context.minCards > 0 && count < context.minCards ){
			legal = 0;
			issues.push( "Deck must contain at least " + context.minCards + " cards." );
		}
		
		// If a maximum card count is specified, check against it
		if ( context.maxCards > 0 && count > context.maxCards ){
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
		sort:{ type:"sort" }
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
		context.currentPage = Math.max( 0, Math.min( page, context.pageCount ) );
		
		// Redraw the list with the proper cards in view
		populateList( true );
		
	};

	// Update the visual state of a particular card on the list
	this.refreshCard = function refreshCard( cardName ){
	
		// Early out if the card's not on this list
		var card = context.cards[ cardName ];
		if ( !card )
			return;
		
		var entry = context.listElement.querySelector( 'tr[key="' + keyFromName( cardName ) + '"]' );
		if ( entry ){
			var count = entry.querySelector( ".cardCount" );
			var commander = entry.querySelector( ".commanderFlag" );
		
			// Populate the card count into the element
			if( !card.count ){
				count.setAttribute( "count", 0 );
				count.innerHTML = 0;
			}
			else{
				count.setAttribute( "count", card.count );
				count.innerHTML = card.count;
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
					if ( card[ key ] === undefined )
						include = false;
					// For text fields use a partial regex match, case insensitive
					else if ( type == "match" && !card[ key ].match( new RegExp( fp[ key ], "i" ) ) )
						include = false;
					// For numeric fields convert the value to a number first
					else if ( type == "number" && card[ key ] != parseInt( fp[ key ] ) )
						include = false;
					// For list fields look for the selected value in the card's array
					else if ( type == "list" && card[ key ].indexOf( fp[ key ] ) < 0 )
						include = false;
					// for color selections check each color for required or excluded
					else if ( type == "color" ){
						for ( var color in fp[ key ] ){
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
			// Sort first by the specified property
			if ( a[ property ] > b[ property ] ) return -1 * order;
			else if ( a[ property ] < b[ property ] ) return 1 * order;
			// Break ties by sorting by card name, always a-z
			else {
				if ( a[ "name" ] > b[ "name" ] ) return 1;
				else if ( a[ "name" ] < b[ "name" ] ) return -1;
				else return 0;							
			};
		} );
		
		// Send the list to be drawn
		populateList();
		
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
				if ( card.name == context.deck.commander.name )
					commander = 1;
			}
			var count = card.count || 0;
			var image = 'http://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=' + card.multiverseid + '&type=card';
			var link = 'http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=' + card.multiverseid;
			if ( !card.multiverseid ){
				image = 'images/cardback.jpg';
				link = 'http://gatherer.wizards.com/Pages/Default.aspx';
			}
			if ( !card.text )
				card.text = "";
			
			// Compose left hand section with the card image
			list += '<tr key="' + key + '" legal="1" commander="' + commander + '"><td>';
			list += '<a href="' + link + '"><img class="cardImage" src="' + image + '" /></a>';
			list += '</td><td>';
			
			// Compose the card entry with its various data fields
			list += '<a class="cardTitle" href="' + link + '" target="_blank">' + card.name + '</a>';
			if ( card.manaCost )
				list += '<span class="cardManaCost">' + card.manaCost + '</span>';
			list += '<span class="cardCMC">(' + card.cmc + ')</span>';
			if ( card.userRating )
				list += ' <span class="cardRating">\u2605' + formatRating( card.userRating ) + '</span>';
			list += '<br><span class="cardType">' + card.type + '</span>';
			if ( card.power !== undefined && card.toughness !== undefined )
				list += '<span class="cardStats">(<span class="cardPower">' + card.power + '</span>/<span class="cardToughness">' + card.toughness + '</span>)</span>';
			list += '<br><span class="cardText">' + card.text + '</span></td><td>';
			
			// Compose the UI section to the right of the card entry
			list += '<a class="add" title="Add to Deck" onclick="DECK.addCard( this.parentNode.parentNode.getAttribute(\'key\'), 1 );"><span>+</span></a>';
			list += '<div class="cardCount" count="0">' + count + '</div>';
			list += '<a class="remove" title="Remove from Deck" onclick="DECK.removeCard( this.parentNode.parentNode.getAttribute(\'key\'), 1 );"><span>-</span></a>';
			list += '<a title="Make Commander" class="commanderFlag" onclick="DECK.setCommander( this.parentNode.parentNode.getAttribute(\'key\') );"><span>&#9813;</span></a>';
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
		context.navElement.innerHTML = '<a onclick="this.parentNode.cardList.setPage(0)" title="First Page">&#x23EE;</a> ';
		context.navElement.innerHTML += '<a onclick="this.parentNode.cardList.setPage(' + ( context.currentPage - 1 ) + ')" title="Previous Page">&#x23F4</a> ';
		context.navElement.innerHTML += '<span class="topTab"> Page ' + ( context.currentPage + 1 ) + ' of ' + ( context.pageCount ) + '</span>';
		context.navElement.innerHTML += ' <a onclick="this.parentNode.cardList.setPage(' + ( context.currentPage + 1 ) + ')" title="Next Page">&#x23F5</a>';
		context.navElement.innerHTML += ' <a onclick="this.parentNode.cardList.setPage(' + ( context.pageCount - 1 ) + ')" title="Last Page">&#x23ED</a>';
		
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
				options.sort();
				
				// Include a blank entry at the top of the list
				options.unshift( "" );
				
				// Create a set of option elements and insert them
				for ( var i = 0; i < options.length; i++ )
					content += '<option value="' + options[ i ] + '">' + options[ i ] + '</option>';
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
		
		return text.replace( /\{([\w\d]+)\}/g, function( match, p1 ){
			// The image name for the tap symbol doesn't follow the normal pattern
			if ( p1 == "T" ) p1 = "tap";
			// Typically the image name is just the string in the marker code
			return '<img class="symbol" src="http://gatherer.wizards.com/Handlers/Image.ashx?size=small&name=' + p1 + '&type=symbol" />';
		} );
	
	}

	// Format a rating to always show exactly one decimal place
	function formatRating( value ){
	
		value = Math.round( value * 10 ) / 10;
		if ( value % 1 == 0 )
			value += ".0"
		return value + "";
	
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
function Storage( callback ){
	
	var context = this;
	
	this.database = null;
	this.decks = [];
	
	callback = callback || function(){};
	
	/* STORAGE ACCESS METHODS */

	// Connect the storage module to the database
	this.connect = function connect( callback ){
		callback = callback || function(){};
		var request = indexedDB.open( "mtgdecks", 1 );

		// Listen for and report errors
		request.onerror = function( event ){
			alert( "Failed to get database due to an error:" + event.target.errorCode );
		};
		// Initialize or upgrade the database schema
		request.onupgradeneeded = function( event ){
			context.database = event.target.result;
			if ( event.oldVersion < 1 ){
				var store = context.database.createObjectStore( "decks", { keyPath:"name" } );
				store.createIndex( "folder", "folder", { unique: false } );
			}
			else{
				// Future schema upgrade code goes here
			}
		};
		// Execute the callback when connection is ready
		request.onsuccess = function( event ){
			context.database = event.target.result;
			context.database.onerror = function( event ){
				alert( "Failed to save due to a database error: " + event.target.errorCode );
			};
			callback();
		};
		
	};

	// Write a deck to the database, overwriting existing entry if any
	this.save = function save( deck, callback ){
		callback = callback || function(){};
	
		// Produce a user facing error if database is disconnected
		if ( !context.database ){
			alert( "No database available to save to." );
			return;
		}
		
		// Prompt the user to name the deck before saving if needed
		if ( !deck.name ){
			alert( "Decks require a name in order to be saved." );
			return;
		}
		
		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "decks" ], "readwrite" );
		trans.onerror = function( event ){
			alert( "Failed to save due to a transaction error: " + event.target.errorCode );
		}
		
		// Save the deck data to the database
		var store = trans.objectStore( "decks" );
		var bundle = ( deck.bundle ) ? deck.bundle() : deck;
		var request = store.put( bundle );
		request.onerror = function( event ){
			alert( "Failed to save due to request error: " + event.target.errorCode );
		};
		request.onsuccess = function( event ){
		
			// Invoke the callback when save is done
			callback( request.result );
			
		}
	
	};

	// Delete a deck from the database
	this.remove = function remove( deckName, callback ){
		callback = callback || function(){};
	
		// Produce a user facing error if the database is gone
		if ( !context.database ){
			alert( "No database available to delete from." );
			return;
		}
	
		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "decks" ], "readwrite" );
		trans.onerror = function( event ){
			alert( "Failed to delete due to a transaction error: " + event.target.errorCode );
		}
		
		// Delete the specified entry from the database
		var store = trans.objectStore( "decks" );
		var request = store.delete( deckName );
		request.onerror = function( event ){
			alert( "Failed to delete due to request error: " + event.target.errorCode );
		};
		request.onsuccess = function( event ){
		
			// Invoke the callback once the entry is deleted
			callback( request.result );
			
		}
	
	};

	// Load deck data from the database and send it to the callback function
	this.loadDeck = function loadDeck( deckName, callback ){
			callback = callback || function(){};

		// Produce a user facing error if the database is gone
		if ( !context.database ){
			alert( "No database available to load from." );
			return;
		}

		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "decks" ], "readonly" );
		trans.onerror = function( event ){
			alert( "Failed to load due to a transaction error: " + event.target.errorCode );
		}
		
		// Request the specified deck's data from the database
		var store = trans.objectStore( "decks" );
		var request = store.get( deckName );
		request.onerror = function( event ){
			alert( "Failed to delete due to request error: " + event.target.errorCode );
		};
		request.onsuccess = function( event ){
		
			// Invoke the callback, passing the deck data to it
			callback( request.result );
			
		}
	
	};

	// Gather a list of stored decks and send it to the callback function
	this.loadList = function lostList( callback, refresh ){
		callback = callback || function(){};
	
		// Used the cached deck list unless specified otherwise
		if ( context.decks.length && !refresh )
			return context.decks;
	
		// Produce a user facing error if the database is gone
		if ( !context.database ){
			alert( "No database available to load from." );
			return;
		}

		// Initialize the transaction and report any errors
		var trans = context.database.transaction( [ "decks" ], "readonly" );
		trans.onerror = function( event ){
			alert( "Failed to load due to a transaction error: " + event.target.errorCode );
		}
		
		// Recurse over the database gathering deck names
		context.decks = [];
		var store = trans.objectStore( "decks" );
		store.openCursor().onsuccess = function( event ){
			var cursor = event.target.result;
			if ( cursor ){
				
				// Record each deck's key and organization folder
				context.decks.push( { name:cursor.key, folder:cursor.value.folder } );
				cursor.continue();
			}
			// When all decks have been evaluated, send the list to the callback
			else
				callback( context.decks );
		};
	
	};

	this.connect( callback );
	
	return this;

};

// Component class for managing the popup dialog box
function DialogBox( container ){

	var context = this;
	
	this.container = container;
	this.closeButton = container.querySelector( ".closeButton" );
	this.cancelButton = container.querySelector( ".cancelButton" );
	this.confirmButton = container.querySelector( ".confirmButton" );
	this.title = container.querySelector( ".dialogTitle" );
	this.body = container.querySelector( ".dialogBody" );
	
	// Close the dialog whenever a button gets clicked
	this.closeButton.addEventListener( "click", function(){
		context.container.style.display = "none";
	} );
	this.cancelButton.addEventListener( "click", function(){
		context.container.style.display = "none";
	} );
	this.confirmButton.addEventListener( "click", function(){
		context.container.style.display = "none";
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
			context.cancelButton.addEventListener( "click", options.cancel.callback );
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
			context.confirmButton.addEventListener( "click", options.confirm.callback );
			if ( options.confirm.text )
				context.confirmButton.querySelector( "span" ).innerHTML = options.confirm.text;
			else
				context.confirmButton.querySelector( "span" ).innerHTML = "CONFIRM";
		}
		else
			context.container.setAttribute( "confirm", "0" );
	
		// Show the dialog box
		context.container.style.display = 'table';
		
	};
	
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
		var bundle = { name:"", format:"", folder:"", cards:{}, commander:null };
		
		// Go through each row of the file and add it to the bundle
		var rows = e.target.result.split( "\n" );
		for ( var i = 0; i < rows.length; i++ ){
			if ( rows[ i ] != "" ){
			
				// Dig the card name out from between other information
				var cardName = rows[ i ].match( /(?:^[\d]+x[\s]+|^)([^\*$]+)/ )[ 1 ];
				cardName = cardName.replace( /[\r\n]+/g, '' );
				bundle.cards[ cardName ] = { name:cardName, count:1 };
				
				// Get the quantity of the card if it's specified
				var quantity = rows[ i ].match( /^([\d]+)x/ );
				if ( quantity ) bundle.cards[ cardName ].count = parseInt( quantity[ 1 ] );

				// If a commander is specified, note it in the bundle
				var commander = ( rows[ i ].match( /\*cmdr\*/i ) ) ? true : false;
				if ( commander ){
					bundle.format = "Commander";
					bundle.commander = cardName;
				}
				
			}
		}
		
		// Load the bundle into the deck list
		DECK.load( bundle );
		
	};
	reader.readAsText( file );

}
