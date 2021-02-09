const fs = require( "fs" );
const request = require( "request" );

var source = "https://www.mtgjson.com/api/v5/";
var files = { 
	cards:"AtomicCards.json",
	sets:"AllPrintings.json",
	prices:"AllPrices.json"
};
var loaded = {};

// Load the latest card data from MTGJSON directly
console.log( "\r\nLoading files..." );
for ( var key in files )
	load( key );

// Load a remote file
function load( key ){
	
	request.get( source + files[ key ], function ( error, response, body ){
		if ( !error && response.statusCode == 200 ){
			
			loaded[ key ] = JSON.parse( body );
			console.log( " - " + files[ key ] + " loaded remotely" );
			
			if ( Object.keys( loaded ).length == Object.keys( files ).length )
				build();
			
		}
		else
			console.log( error );
	} );
	
}

function build(){
	
	var cards = loaded.cards.data;
	var sets = loaded.sets.data;
	var prices = loaded.prices.data;

	// Load supplemental deck building data for certain cards
	// This is manually created for special commanders and such
	var rules = fs.readFileSync( "DeckRules.json", "utf8" );
	rules = JSON.parse( rules );
	console.log( " - Deck rules loaded locally" );

	// Load previously scraped ratings data to save re-scraping
	var ratings = fs.readFileSync( "ratings-by-name.json", "utf8" );
	ratings = JSON.parse( ratings );
	console.log( " - Card ratings loaded locally" );

	console.log( "\r\nBuilding local data..." );

	var count = Object.keys(cards).length;
	var progress = 0;

	// Iterate through the card list capturing needed data
	var data = {};
	for ( var cardName in cards ){
		
		// Update the console readout
		if ( progress != 0 ){
			process.stdout.clearLine();
			process.stdout.cursorTo( 0 );
		}
		progress++;
		process.stdout.write( " (" + Math.floor( progress / count * 100 ) + "%) " + progress + " / " + count );
		if ( progress == count )
			process.stdout.write( "\r\n" );
		
		// Process each side or part for multi-part cards
		for ( var v = 0; v < cards[ cardName ].length; v++ ){
			
			// Create an easy reference to the base data
			var base = cards[ cardName ][ v ];
			
			// Determine the name we'll store this under
			var key = base.name;
			if ( base.faceName ) key = base.faceName;
		
			// Initialize the card data
			var card = {};
			
			// Converted mana cost [.cmc]
			card.cmc = base.convertedManaCost || 0;
			
			// Color identity [.colorIdentity]
			card.colorIdentity = base.colorIdentity;
			
			// Colors [.colors]
			card.colors = base.colors;
			if ( base.colors ){
				for ( var c = 0; c < card.colors.length; c++ ){
					if ( card.colors[ c ] == "White" ) card.colors[ c ] = "W";
					else if ( card.colors[ c ] == "Black" ) card.colors[ c ] = "B";
					else if ( card.colors[ c ] == "Red" ) card.colors[ c ] = "R";
					else if ( card.colors[ c ] == "Blue" ) card.colors[ c ] = "U";
					else if ( card.colors[ c ] == "Green" ) card.colors[ c ] = "G";
				}
			}
			
			// Deck building limit [.deckLimit]
			// Check .hasAlternativeDeckLimit, but need to know what the limit is
			if ( rules[ cardName ] ){
				if ( rules[ cardName ].deckLimit )
					card.deckLimit = rules[ cardName ].deckLimit;
			}
			
			// Format legality [.formats]
			if ( base.legalities ){
				for ( var format in base.legalities ){
					if ( base.legalities[ format ] == "Legal" || base.legalities[ format ] == "Restricted" ){
						card.formats = card.formats || [];
						card.formats.push( capitalize( format ) );
					}
					if ( base.legalities[ format ] == "Restricted" ){
						card.restricted = card.restricted || [];
						card.restricted.push( capitalize( format ) );
					}
				}
			}
			
			// Card layout type [.layout]
			card.layout = base.layout;

			// Commander legality override [.legalCommander]
			if ( rules[ cardName ] ){
				if ( rules[ cardName ].legalCommander )
					card.legalCommander = rules[ cardName ].legalCommander;
			}
			
			// Mana cost [.manaCost]
			card.manaCost = base.manaCost;
			
			// Multiverse IDs [.multiversid, .mvids]
			card.mvids = [];
			for ( var s = 0; s < base.printings.length; s++ ){
				var set = base.printings[ s ];
				
				// Skip missing sets
				if ( !sets[ set ] )
					continue;
				
				// Find the card in the set
				var setCards = sets[ set ].cards;
				for ( var c = 0; c < setCards.length; c++ ){
					if ( setCards[ c ].name == base.name ){
						var setCard = setCards[ c ];
					
						// If there's a multiverseid record it
						if ( setCard.identifiers.multiverseId ){
							card.mvids.push( setCard.identifiers.multiverseId );
							card.multiverseid = setCard.identifiers.multiverseId;
						}
						
						// Done with this set for this card
						break;
					
					}
				}
				
			}	
			
			// Card name [.name]
			card.name = key;
			
			// Card alternate names [.names]
			for ( var s = 0; s < base.printings.length; s++ ){
				var set = base.printings[ s ];
				
				// Skip missing sets
				if ( !sets[ set ] )
					continue;
				
				// Find the card in the set
				var setCards = sets[ set ].cards;
				for ( var c = 0; c < setCards.length; c++ ){
					if ( setCards[ c ].name == base.name ){
						var setCard = setCards[ c ];
						
						// See if the card has multiple faces
						if ( setCard.otherFaceIds ){
							card.names = [];
							card.names.push( key );
							
							// Get the names of the other faces
							for ( var n = 0; n < setCard.otherFaceIds.length; n++ ){
								for ( var f = 0; f < setCards.length; f++ ){
									if ( setCards[ f ].uuid == setCard.otherFaceIds[ n ] ){
										card.names.push( setCards[ f ].faceName );
										break;
									}
								}
							}
						}
						// Can stop once the card is found
						break;
					}
				}
			}

			// Creature power [.power]
			card.power = base.power;
			
			// Card purchase price [.price]
			for ( var s = 0; s < base.printings.length; s++ ){
				var set = base.printings[ s ];
				
				// Skip missing sets
				if ( !sets[ set ] )
					continue;
				
				// Find the card in the set
				var setCards = sets[ set ].cards;
				for ( var c = 0; c < setCards.length; c++ ){
					var setCard = setCards[ c ];
					if ( setCard.name == cardName ){
						
						// Get the price data from the price JSON
						setCard.prices = prices[ setCard.uuid ];
						
						// Determine if there's price data there
						if ( setCard.prices ){
							
							// Make sure there are paper prices
							if ( setCard.prices.paper ){

								// Only use prices from TCGPlayer
								if ( setCard.prices.paper.tcgplayer ){
									
									// Make sure there are retail prices available
									if ( setCard.prices.paper.tcgplayer.retail ){
										
										// Use non-foil if possible, foil otherwise
										var priceList = setCard.prices.paper.tcgplayer.retail.normal;
										if ( !priceList ) priceList = setCard.prices.paper.tcgplayer.foil;
										
										// Skip ahead if there is no buy price available
										if ( !priceList )
											break;
										
										// Look for the most recent price
										var lastDate = 0;
										var setPrice = undefined;
										for ( date in priceList ){
											var thisDate = Date.parse( date );
											if ( thisDate > lastDate ){
												lastDate = thisDate;
												setPrice = priceList[ date ];
											}
										}
										
										// If there's no other price use this one
										if ( setPrice !== undefined && card.price === undefined )
											card.price = setPrice;
										
										// Record if this price is the lowest
										else if ( setPrice !== undefined && setPrice < card.price )
											card.price = setPrice;
										
									}
								}
							}
						}
						
						// Done with this set for this card
						break;
					
					}
				}
				
			}
			
			// Partner commander data [.partner, .partnerWith]
			if ( base.supertypes ){
				if ( base.supertypes.indexOf( "Legendary" ) >= 0 ){
					if ( base.text ){
						
						// Check for partner rules in card text
						if ( base.text.match( /Partner/ ) ){
							card.partner = true;
							
							// Check for partner name in case of partner with
							var partnerWith = base.text.match( /Partner with ([\w\s,]+)[\(\n]/ );
							if ( partnerWith ){
								card.partnerWith = partnerWith[ 1 ].replace( /[\s]+$/, "" );
								
								// Clean up bogus name array with partner's name
								delete card[ "names" ];
							}
							
						}
						
					}
				}
			}	
			
			// Lowest printed rarity [.rarity]
			for ( var s = 0; s < base.printings.length; s++ ){
				var set = base.printings[ s ];
				
				// Skip missing sets
				if ( !sets[ set ] )
					continue;
				
				// Find the card in the set
				var minRarity = 100;
				for ( var c = 0; c < setCards.length; c++ ){
					if ( setCards[ c ].name == cardName ){
						var setCard = setCards[ c ];
						
						// Get the printing's rarity in numeric form
						var setRarity = 101;
						if ( setCard.rarity == "basic land" ) setRarity = 1;
						else if ( setCard.rarity == "common" ) setRarity = 2;
						else if ( setCard.rarity == "uncommon" ) setRarity = 3;
						else if ( setCard.rarity == "rare" ) setRarity = 4;
						else if ( setCard.rarity == "mythic" ) setRarity = 5;
						
						// Record the card's lowest rarity and corresponding set
						if ( !card.rarity || setRarity < minRarity ){
							
							// Update the minimum rarity number
							minRarity = setRarity;
							
							// Save rarity in short form
							if ( setRarity == 1 ) card.rarity = "L";
							else if ( setRarity == 2 ) card.rarity = "C";
							else if ( setRarity == 3 ) card.rarity = "U";
							else if ( setRarity == 4 ) card.rarity = "R";
							else if ( setRarity == 5 ) card.rarity = "M";
							
						}
						
						// Done with this set for this card
						break;
					
					}
				}
				
			}		
			
			// Card subtypes [.subtypes]
			card.subtypes = base.subtypes;
			
			// Card supertypes [.supertypes]
			card.supertypes = base.supertypes;
			
			// Rules text [.text]
			card.text = base.text;
			
			// Creature toughness [.toughness]
			card.toughness = base.toughness;
			
			// Card type [.type]
			card.type = base.type;
			
			// Card types [.types]
			card.types = base.types;
			
			// Add ratings data from storage
			if ( ratings[ key ] ){
				card.userRating = ratings[ key ].rating;
				card.votes = ratings[ key ].votes;
			}
			
			// Add the card to the finished data
			data[ key ] = card;
			
		}
		
	}

	finishStitch( data );
	
}


// Performs final cleanup and saves out the data files
function finishStitch( data ){
	
	/*
	console.log( "\r\n Time Elapsed: " + formatTime( Date.now() - startTime ) );
	*/
	
	// Delete parameters we're finished with from data
	console.log( "\r\nFinalizing data..." );
	for ( var name in data ){
		delete data[ name ][ "mvids" ];
	}
	
	// Save the compact version of the file
	fs.writeFile( "data.json", JSON.stringify( data ), function( err ){
		if( err ) return console.log( err );
		console.log("Minified data.json saved.");
	} ); 
	
	// Save the human readable version of the file
	fs.writeFile( "data-expanded.json", JSON.stringify( data, null, "\t" ), function( err ){
		if( err ) return console.log( err );
		console.log("Readable data-expanded.json saved.");
	} );

/*	
	// Save the ratings by mvid dictionary
	fs.writeFile( "ratings-by-mvid.json", JSON.stringify( idRatings, null, "\t" ), function( err ){
		if( err ) return console.log( err );
		console.log("Printing ratings ratings-by-mvid.json saved.");
	} );

	// Save the ratings by cardname dictionary
	fs.writeFile( "ratings-by-name.json", JSON.stringify( nameRatings, null, "\t" ), function( err ){
		if( err ) return console.log( err );
		console.log("Card ratings ratings-by-name.json saved.");
	} );
*/

}


// Capitalizes the first letter of each word in a string
function capitalize( string ){
	return string.replace( /\b\w+/g, function( text ){
		return text.charAt( 0 ).toUpperCase() + text.substr( 1 ).toLowerCase();
	} );
}

// Formats time in milliseconds into HH:MM:SS format
function formatTime( msTime ){
	
	var sTime = msTime / 1000;
	var hours = Math.floor( sTime / ( 60 * 60 ) );
	var minutes = Math.floor( ( sTime % ( 60 * 60 ) ) / 60 );
	var seconds = Math.floor( sTime % 60 );
	return hours + ":" + padDigits( minutes, 2 ) + ":" + padDigits( seconds, 2 );
	
}

// Zero-pads a numeric string to the specific number of digits
function padDigits( number, digits ){

	number = number + "";
	while( number.length < digits )
		number = "0" + number;
	return number;
	
}


/*
console.log( "\r\nScraping ratings data..." );

const maxRequests = 64;

var queuedCards = count;
var queuedMvids = 0;
var pending = 0;

var keys = Object.keys( data );
var currentCard = 0;
var currentMvid = 0;

var startTime = Date.now();

var idRatings = {};
var nameRatings = {};

// Scrape ratings for each printing of each card
function fetchNext(){
	if ( queuedCards > 0 || queuedMvids > 0 || pending > 0 ){
		if ( pending < maxRequests && currentCard <= count ){
		
			var mvids = data[ keys[ currentCard ] ] ? data[ keys[ currentCard ] ].mvids : [];
			if ( currentMvid < mvids.length ){
				
				// Fetch ratings data for this printing
				fetchRating( keys[ currentCard ], mvids[ currentMvid ] );
				currentMvid++;
				queuedMvids = mvids.length - currentMvid;
			}
			else{
				
				// Go to the next card in the list
				currentCard++;
				queuedCards--;			
				currentMvid = 0;
				queuedMvids = mvids.length - currentMvid;
				fetchNext();
			}
		
		}
	}
	else{
		finishStitch();
	}
}
fetchNext();

// Gets a printing's rating and vote count from Gatherer
function fetchRating( name, mvid ){
	
	pending++;
	
	var name = name;
	var mvid = mvid;
	
	request.get( "https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=" + mvid, function ( error, response, body ){
		if ( !error && response.statusCode == 200 ){
			
			var rating = body.match( /class="textRatingValue">([\d.]+)</ );
			rating = parseFloat( rating[ 1 ] );

			var votes = body.match( /class="totalVotesValue">([\d.]+)</ );
			votes = parseFloat( votes[ 1 ] );
			
			integrateRating( { mvid:mvid, name:name, rating:rating, votes:votes } );
			
		}
		else
			console.log( error );
	} );

	fetchNext();
		
}

// Compounds scraped user rating data across printings
function integrateRating( payload ){
	
	if ( payload.votes ){
		
		var oldRating = data[ payload.name ].userRating || 0;
		var oldVotes = data[ payload.name ].votes || 0;
		var oldScore = oldRating * data[ payload.name ].votes || 0;
		var totalScore = oldScore + ( payload.rating * payload.votes );
		var totalVotes = payload.votes + oldVotes;

		data[ payload.name ].userRating = totalVotes > 0 ? totalScore / totalVotes : 0;
		data[ payload.name ].votes = totalVotes;
		
		idRatings[ payload.mvid ] = { rating:payload.rating, votes:payload.votes };
		nameRatings[ payload.name ] = { rating:data[ payload.name ].userRating, votes:data[ payload.name ].votes };

	}
	
	pending--;
	
	// Update the console readout
	if ( !( currentCard == 0 && currentMvid == 0 ) ){
		process.stdout.clearLine();
		process.stdout.cursorTo( 0 );
	}
	//var score = data[ payload.name ].userRating ? Math.round( data[ payload.name ].userRating * 10 ) / 10 + "/5.0" : "-/-";
	var timeLeft = currentCard ? formatTime( ( Date.now() - startTime ) / currentCard * queuedCards ) : "--:--:--";
	var nameString = payload.name.length < 20 ? payload.name : payload.name.substr( 0, 20 ) + "...";
	process.stdout.write( " (" + Math.floor( currentCard / count * 100 ) + "%) " + timeLeft + " QC:" + queuedCards + " QM:" + queuedMvids + " PR:" + pending + "  Scraped: " + nameString );
	if ( queuedCards == 0 && queuedMvids == 0 && pending == 0 ){
		finishStitch();
		return;
	}
	
	fetchNext();
	
}
*/


