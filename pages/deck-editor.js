const deckEditor = (data) => {

	return `
		<!DOCTYPE html>
		<html>
			<head>
		
				<title>Deck Builder</title>

				<meta name="keywords" content="mtg, magic the gathering, deck builder, deck, builder, magic, gathering, commander, mtgjson, card game, card, game, fast, easy, tool, app, application, free">
				<meta name="description" content="A powerful, fast, low-friction deck building tool for Magic the Gathering">
				<meta name="robots" content="index, follow">
				<meta name="revisit-after" content="7 days">
				<meta name="author" content="Dashiel Nemeth">
				<meta name="subject" content="Magic the Gathering deck building">
				<meta name="language" content="English">

				<meta property="og:title" content="Deckmaven" />
				<meta property="og:type" content="website" />
				<meta property="og:url" content="https://deckmaven.com" />
				<meta property="og:description" content="A powerful, fast, low-friction deck building tool for Magic the Gathering" />
				<meta property="og:site_name" content="Deckmaven" />

				<meta property="og:image" content="https://deckmaven.com/images/deckmaven01.jpg" />
				<meta property="og:image:alt" content="Deckmaven Deck Editor" />
				<meta property="og:image:width" content="792" />
				<meta property="og:image:height" content="518" />
		
				<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
				<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
				<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
				<link rel="manifest" href="/site.webmanifest">

				<link href="https://fonts.googleapis.com/css?family=Open+Sans:400,600,700" rel="stylesheet">
				<link href="deckbuilder.css" rel="stylesheet">

				<script src="filesaver.js"></script>
				<script src="deckbuilder.js"></script>
				
				<script>
					// Main page boot up sequence
					let DECK = null;
					function start(){
				
						// Set up the card lists, deck, and interfaces
						DECK = new Deck( document );
				
					}
				</script>
		
			</head>
			<body onload="start();">

				<img class="hoverCard" src="images/cardback.jpg" />
				<img class="companionCard" src="images/cardback.jpg" />
				<img class="meldCard" src="images/cardback.jpg" />

				<table class="masterTable"><tr>

					<td class="searchContainer"><div class="searchFrame">

						<div class="filterSection">
							<span class="filterGroup name"><span class="filterLabel">Name:</span><input type="text" class="filterField" filterType="name" /></span><span class="filterGroup view"><span class="filterLabel">View:</span><select class="filterField" filterType="view">
							<option value="normal">Normal</option><option value="compact">Compact</option>
							</select></span><span class="filterGroup sort"><span class="filterLabel">Sort:</span><select class="filterField" filterType="sort">
								<option value="name">Name</option><option value="price">Card Price</option><option value="rarity">Card Rarity</option><option value="type">Card Type</option><option value="cmc">Mana Cost</option><option value="userRating">User Rating</option>
							</select></span><br>
							<span class="filterGroup supertypes"><span class="filterLabel">Supertype:</span><select class="filterField" filterType="supertypes"></select></span><span class="filterGroup types"><span class="filterLabel">Type:</span><select class="filterField" filterType="types"></select></span><span class="filterGroup subtypes"><span class="filterLabel">Subtype:</span><select class="filterField" filterType="subtypes"></select></span><span class="filterGroup formats"><span class="filterLabel">Format:</span><select class="filterField" filterType="formats"></select></span><br>
							<span class="filterGroup text"><span class="filterLabel">Text:</span><input type="text" class="filterField" filterType="text" /></span><span class="filterGroup cmc"><span class="filterLabel">Mana Cost:</span><input type="text" class="filterField" filterType="cmc" /></span><br>
							<span class="filterGroup colors"><span class="filterLabel">Color:</span><span class="filterSublable"><img class="symbol" src="images/manaw.png" /></span><select class="filterField" filterType="colors" manaColor="W"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select><span class="filterSublable"><img class="symbol" src="images/manau.png" /></span><select class="filterField" filterType="colors" manaColor="U"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select><span class="filterSublable"><img class="symbol" src="images/manab.png" /></span><select class="filterField" filterType="colors" manaColor="B"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select><span class="filterSublable"><img class="symbol" src="images/manar.png" /></span><select class="filterField" filterType="colors" manaColor="R"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select><span class="filterSublable"><img class="symbol" src="images/manag.png" /></span><select class="filterField" filterType="colors" manaColor="G"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select></span><br>
							<span class="filterGroup colorIdentity"><span class="filterLabel">Identity:</span><span class="filterSublable"><img class="symbol" src="images/manaw.png" /></span><select class="filterField" filterType="colorIdentity" manaColor="W"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select><span class="filterSublable"><img class="symbol" src="images/manau.png" /></span><select class="filterField" filterType="colorIdentity" manaColor="U"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select><span class="filterSublable"><img class="symbol" src="images/manab.png" /></span><select class="filterField" filterType="colorIdentity" manaColor="B"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select><span class="filterSublable"><img class="symbol" src="images/manar.png" /></span><select class="filterField" filterType="colorIdentity" manaColor="R"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select><span class="filterSublable"><img class="symbol" src="images/manag.png" /></span><select class="filterField" filterType="colorIdentity" manaColor="G"><option value="allowed">Allow</option><option value="required">Require</option><option value="excluded">Exclude</option></select></span><br>
							<div class="bottomTab hide" onclick="parentNode.cardList.toggleFilters( false );">HIDE FILTER SETTINGS</div>
							<div class="bottomTab show" onclick="parentNode.cardList.toggleFilters( true );">SHOW FILTER SETTINGS</div>
						</div>

						<div class="listSection">
							<table class="listTable"></table>
						</div>
		
						<div class="navSection"></div>
						<div class="navBottom"></div>
		
					</div></td>
		
					<td class="deckContainer"><div class="deckFrame">
					</div></td>

					<td class="overviewContainer">

						<div class="deckProperties">
							<span class="filterGroup deckName"><span class="filterLabel">Deck Name:</span><input type="text" class="filterField" filterType="deckName" /><a title="Make Deck Private"><span><img src="images/hide.svg" /></span></a></span><br>
							<span class="filterGroup deckFolder"><span class="filterLabel">Folder:</span><select class="filterField" filterType="folders"><option value="General">General</option></select><a title="New Folder"><span>+</span></a></span><br>
							<span class="filterGroup deckFormat"><span class="filterLabel">Format:</span><select class="filterField" filterType="formats"></select></span><br>
							<div class="buttonHolder">
								<a class="imageButton" onclick="DECK.resetDeck();" title="New Deck"><img src="images/new.svg" /></a>
								<a class="imageButton" onclick="DECK.save();" title="Save Changes"><img src="images/save.svg" /></a>
								<a class="imageButton" onclick="showDeckList();" title="Saved Decks"><img src="images/open.svg" /></a>
								<a class="imageButton" onclick="exportList( DECK );" title="Download Deck List"><img src="images/down.svg" /></a>
								<a class="imageButton" onclick="document.getElementById( 'fileSelect' ).click();" title="Import Deck List"><img src="images/up.svg" />
									<input style="display:none;" id="fileSelect" onchange="importWarn( this );" type="file" />
								</a>
								${!data.hasUser ? `
									<a class="imageButton" href="/auth/discord" title="Sign In"><img src="images/discord-icon.png" /></a>
								` : `
									<a class="imageButton" href="/auth/logout" title="Sign Out"><img src="${data.avatar}" class="loggedIn" /></a>
								`}
							</div>
						</div>

						<div class="deckData">
							<div class="deckMetrics"></div>
							<ul class="deckIssues"><li>Deck is legal for the chosen format.</li></ul>
						</div>
						<div class="about" onclick="showCredits();">ABOUT</div>
						<div class="deckFooter"></div>

					</td>
				</tr></table>

				<table class="interstitial" close="1" cancel="1" confirm="1"><tr><td>
					<div class="dialogBox">
						<a class="closeButton"><span>&#215;</span></a>
						<div class="dialogTitle"></div>
						<div class="dialogBody"></div>
						<div class="dialogButtons">
							<a class="cancelButton"><span>CANCEL</span></a>
							<a class="confirmButton"><span>CONFIRM</span></a>
						</div>
					</div>
				</td></tr></table>
		
				<span style="display:none;">
					This Magic the Gathering deck building tool is built and maintained by Dashiel Nemeth, and open source on <a href="https://github.com/ChainsawXIV/deckbuilder" target="_blank">GitHub</a>. Submit bug reports and feature requests on the issues page, <a href="https://github.com/ChainsawXIV/deckbuilder/issues" target="_blank">here</a>.<br><br>Card data for this project is provided by:<ul><li><a href="https://mtgjson.com/" target="_blank">https://mtgjson.com/</a></li><li><a href="https://gatherer.wizards.com/Pages/Default.aspx" target="_blank">https://gatherer.wizards.com/</a></li></ul>Magic the Gathering and all associated information and materials are the property of <a href="https://magic.wizards.com" target="_blank">Wizards of the Coast</a>, and this tool is not associated with Wizards of the Coast in any way.<br><br><b>Update History</b><br><br><u>Version 0.3.0 (August 7th, 2018)</u><ul><li>Added support for login with Google and cloud storage of decks by logged in users.</li></ul><u>Version 0.2.3 (July 21st, 2018)</u><ul><li>Added support for the Brawl format (pending MTG JSON data up stream bug fixes).</li><li>Added support and deck validation for Partner and Partners With commanders.</li><li>Addressed serious layout issues with the deck lists in Internet Explorer and Firefox.</li></ul><u>Version 0.2.2 (July 17th, 2018)</u><ul><li>Fixed additional filtering, deck and card validation, and layout related bugs.</li><li>Significantly improved card rating data by averaging across all printings of a particular card.</li></ul><u>Version 0.2.1 (January 10th, 2018)</u><ul><li>Fixed a number of edge cases and bugs with user interactions and filtering.</li><li>Added card rarity to the data set and denoted it on the card list for building pauper.</li></ul><u>Version 0.2.0 (January 6th, 2018)</u><ul><li>Major code cleanup and bug fixing pass, resolving numerous issues and improving performance.</li><li>Added support for importing and exporting deck lists in the standard text format.</li><li>Added support for cards with unusual deck building rules such as Planeswalker commanders.</li></ul><u>Version 0.1.0 (January 2nd, 2018)</u><ul><li>First pass implementation of all core deck building and card lookup features, plus local saving.</li><li>First pass interface design and implementation for current and upcoming feature set.</li></ul>
				</span>

			</body>
		</html>
	`;
}

module.exports = deckEditor;