var express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var assert = require('assert');
var play = io.of('/play');

var usercount = 0;



/**
Card list:
0: Empty Card!
1: Guard		Built Environment		(5 copies)
2: Priest		Arts					(2 copies)
3: Baron		Law						(2 copies)
4: Handmaiden	Medicine				(2 copies)
5: Prince		Science					(2 copies)
6: King			Engineering				(1 copy)
7: Countess		Business				(1 copy)
8: Princess		UNSW					(1 copy)
**/
var deck = [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8];
var display_deck = {1:5, 2:2, 3:2, 4:2, 5:2, 6:1, 7:1, 8:1};

/**
display_deck keeps track of unseen cards
when a player is knocked out of a round, playerhand[player_id] is set to 0
when the deck is empty, end_game function sets playerhand value for each player to 0 for the losers, and 1 for the winners
when there is only one player left, the playerhands values are changed to be 0 for the losers and 1 for the winner
**/

//keeps track of current running game
var game =  { players: [], 
              playerhands: [],
              currentPlayer: 0,
              deck: deck,
              display_deck: display_deck,
              last_played: []
            };

if(process.argv.length > 2) {
	run_tests();
	return;
}

app.use(express.static(__dirname + '/assets'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/pages/index.html');
});

app.get('/play', function(req, res){
  res.sendFile(__dirname + '/pages/play.html');
});

play.on('connection', function(socket){
  //keep track of how many users are connected
  usercount++;
  
  //if there's less than 4 players, they're added to the player room
  //otherwise they're added to the non player room
  console.log("A user has joined.");
  if(game.players.length < 4){
    console.log("Player added to players group.");
  	game.players.push(socket.id);
  	socket.join('players');
  	if(game.players.length == 4){
  	  startGame();
  	  
  	} else {
  	  play.to('players').emit('player update', 4 - usercount);
  	}
  } else {
    console.log("Player added to nonplayers group.");
  	socket.join('nonplayers');
  	play.to('nonplayers').emit('nonplayer update', usercount - 4);
  }
  
  //update the page to show how many users are connected
  play.emit('update', usercount);
  
  socket.on('disconnect', function(){
  	//on disconnect, decrement the user count, remove them from rooms and update
  	usercount--;
  	var index = game.players.indexOf(socket.id);
    if (index > -1) {
      game.players.splice(index, 1);
    }
    play.emit('update', usercount);
  });
  
  socket.on('play card', handleTurn(playedCard, otherCard));
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

function startGame(){
  console.log("Starting game.");
  var i = 0;
  //shuffle the deck
  game.deck = newDeck();
  //every player draws one card
  while(i < game.players.length){
    var card = game.deck.pop();
    game.playerhands[i] = card;
    game.last_played.push(0);
    play.to(game.players[i]).emit('start game', card);
    i++;
  }
  //draw a card for player 0
  var newCard = game.deck.pop();
  play.to(game.players[0]).emit('your turn', game.currentPlayer, newCard);
  console.log("New game started. It is player 0's turn. SocketID: " + game.players[0]);
}

function shuffle(deck){
  var currIndex = deck.length;
  var temp;
  var r;
  while (0 !== currIndex){
    r = Math.floor(Math.random() * currIndex);
    currIndex--;	  
	
	temp = deck[r];
	deck[r] = deck[currIndex];
	deck[currIndex] = temp;
  }
  return deck;
}

function newDeck(){
	return shuffle([1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8]);
}

function handleTurn(playedCard, otherCard){
    var id = game.currentPlayer;
  	//perform turn's action based on card
  	//check next action based on card
  	var result = played_card(id, playedCard, otherCard);
  	//put other card into proper card slot
  	if(result != 7 && result != 8){
  	  game.playerHands[id] = otherCard;
  	}
  	//get player choice/whatever from front end
  	
  	
  	//actually do the turn
  	
  	//move on to the next player
  	id = (id + 1) % 4;
    game.currentPlayer = id;
    
    //player draws a card
    var newCard = game.deck.pop();
    play.to(game.players[game.currentPlayer]).emit('your turn', id, cardInfo(game.playedhands[id]), cardInfo(newCard));
  }

function remaining_cards() {
  return game.display_deck;
}

function play_log(id) {
  var temp = [];
  for (var i = id+1; i - id < 4; i++) {
    temp.push(game.last_played[i%4]);
  }
  return temp;
}

function get_hand(id) {
  return game.playerhands[id];
}

function start_turn(id) {
  game.playerhands[id].push(game.deck.pop());
}

function played_card(id, card, otherCard) {
  if ((otherCard == 5 || otherCard == 6) && game.playerhands[id].includes(7)) {
    if (card == 7) return 0;
    else return 7;//player must discard countess
  }

  game.display_deck[card]--;
  game.last_played[id] = card;
  if (card == 1 | card == 2 | card == 3 | card == 6) {
    return 1;//indicator that prompt to select ANOTHER player should be displayed
  } else if (card == 5) {
    return 5;//prompt to display all players including yourself
  } else if (card == 8) {
    game.playerhands[id] = 0;
    return 8; //player is knocked out
  } else {
    return 0; //no additional prompts
  }

  if (game.deck.length == 0) {
    return -1;
  }
}

function selected_player(id, player, card) {
  if (game.last_played[player] == 4) {
    return 0; //played handmaid last, can't be targeted
  }

  if (card == 1) {
    return 1; //dispay card list to pick from
  } else if (card == 2) {
    return game.playerhands[player]; //id of card to display to current player
  } else if (card == 3) {
    if (game.playerhands[id] < game.playerhands[player]) {
      game.display_deck[game.playerhands[id]]--;
      game.playerhands[id] = 0;
      if (game.deck.length == 0) {
        end_game();
      }
      //need to notify front end that player is knocked out and that the game is over
      return 8; //current player is knocked out
    } else if (game.playerhands[id] > game.playerhands[player]) {
      game.display_deck[game.playerhands[player]]--;
      game.playerhands[player] = 0;



      if (game.deck.length == 0) {
        end_game();
      }
      //need to notify front end that player is knocked out and that the game is over
      return -8; //other player is knocked out
    } else {
      //nothing happens
    }
  } else if (card == 5) {
    game.display_deck[game.playerhands[player]]--;
    game.playerhands[player] = game.deck.pop();
  } else if (card == 6) {
    var temp = game.playerhands[id];
    game.playerhands[id] = game.playerhands[player];
    game.playerhands[player] = temp;
  }
}

function guessed_card (id, player, card) {
  if (game.deck.length == 0) {
    end_game();
  }
  //need to notify front end if player is knocked out and that the game is over somehow!!!  


  if (card == game.playerhands[player]) {
    game.display_deck[card]--;
    game.playerhands[player] = 0;
    return -8; //other player is knocked out
  }
  return 0;
}

function end_game() {
  var largest_id = [];
  var largest_card = 0;
  for (var i = 0; i < 4; i++) {
    if (game.playerhands[i] != 0) {
      if (game.playerhands[i] == largest_card) {
        largest_id.push(i);
      } else if (game.playerhands[i] > largest_card) {
        largest_card = game.playerhands[i];
        largest_id = [i];
      }
    }
  }
  for (var i = 0; i < 4; i++) {
    if (largest_id.includes(i)) {
      game.playerhands[i] = 1;
    } else {
      game.playerhands[i] = 0;
    }
  }
}

function cardInfo(cardID){
  var card = {name: "", strength: cardID, description: ""};
  switch(cardID){
    case 0:
      card.name = "Empty";
      card.description = "You don't have a card!"
      break;
	case 1:
	  card.name = "Built Environment";
	  card.description = "Choose a player and guess a card. If that player is holding that card, they discard it.";
	  break;
    case 2:
      card.name = "Arts";
      card.description = "Choose a player and view their hand.";
      break;
    case 3:
      card.name = "Law";
      card.description = "Choose a player and compare hands. The player with the lower strength hand discards their hand.";
      break;
    case 4:
      card.name = "Medicine";
      card.description = "You may not be affected by other cards until your next turn.";
      break;
    case 5:
      card.name = "Science";
      card.description = "Choose a player. They discard their hand and draw a new one.";
      break;
    case 6:
      card.name = "Engineering";
      card.description = "Choose a player. Trade hands with them.";
      break;
    case 7:
      card.name = "Business";
      card.description = "If you hold this card and either the Science or Engineering card, this card must be played immediately.";
      break;
    case 8:
      card.name = "UNSW";
      card.description = "If you discard this card for any reason, you are eliminated from the round.";
      break;
    default:
      card.name = "Unknown Card";
      card.description = "This card doesn't exist. You must have done something wrong.";
  }
  return card;
}

//returns true if there are at least 2 players remaining, otherwise returns false and sets the winner using playerhands
function remaining_players() {
  var flag = false;
  var id = -1;
  for (var i = 0; i < 4; i++) {
    if (game.playerhands[i] != 0) {
      id = i;
      if (flag) return true;
      flag = true;
    }
  }
  
  for (var i = 0; i < 4; i++) {
    if (i == id) {
      game.playerhands[i] = 1;
    } else {
      game.playerhands[i] = 0;
    }
  }
  return false;
}


function run_tests(){
  console.log("Tests running...");
  game.players = [0, 1, 2, 3] 		//populate player list with data to avoid issues
  startGame();						//start game
  
  console.log(game);

  
  console.log("Tests concluded.");
}