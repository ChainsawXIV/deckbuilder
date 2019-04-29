const fs = require( "fs" );
const request = require( "request" );

console.log( "Loading local data..." );

// Load the compiled card data file
var data = fs.readFileSync( "data.json", "utf8" );
data = JSON.parse( data );

console.log( "Inventorying objects..." );

// Record all the property names and types
var inventory = {};
for ( var cardName in data ){
	var card = data[ cardName ];
	for ( var key in card ){
		inventory[ key ] = typeof inventory[ key ];
	}
}

fs.writeFile( "inventory.txt", JSON.stringify( inventory ), function( err ){
	if( err ){
		return console.log( err );
	}
	console.log( "Inventory saved." );
}); 
