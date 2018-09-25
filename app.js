var express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var play = io.of('/play');

var usercount = 0;


/**
Card list:
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

function startGame(){
  console.log("Starting game.");
  var i = 0;
  //shuffle the deck
  game.deck = newDeck();
  //every player draws one card
  while(i < game.players.length){
    var card = game.deck.pop();
    game.playerhands[i] = [card];
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
  
  socket.on('end turn', function(){
  	//remove that card from the players hand
    //var index = game.playerhands[game.currentPlayer].indexOf(card);
    //game.players.splice(index, 1);
    
    //move on to the next player
    game.currentPlayer = (game.currentPlayer + 1) % 4;
    
    //player draws a card
    var newCard = game.deck.pop();
    play.to(game.players[game.currentPlayer]).emit('your turn', game.currentPlayer, newCard);
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

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

function played_card(id, card) {
  if ((game.playerhands[id].includes(5) || game.playerhands[id].includes(6)) && game.playerhands[id].includes(7)) {
    if (card == 7) return 0;
    else return 7;//player must discard countess
  }

  if (game.playerhands[id][0] == card) {
    game.playerhands[id] = [game.playerhands[id][1]];
  } else if (game.playerhands[id][1] == card) {
    game.playerhands[id] = [game.playerhands[id][0]];
  } else {
    //error
  }

  var return_val;
  game.display_deck[card]--;
  game.last_played[id] = card;
  if (card == 1 | card == 2 | card == 3 | card == 6) {
    return 1;//indicator that prompt to select ANOTHER player should be displayed
  } else if (card == 5) {
    return 5;//prompt to display all players including yourself
  } else if (card == 8) {
    game.playerhands[id] = 0;
    return_val = 8; //player is knocked out
  } else {
    return_val = 0; //no additional prompts
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
    return game.playerhands[player][0]; //id of card to display to current player
  } else if (card == 3) {
    if (game.playerhands[id][0] < game.playerhands[player][0]) {
      game.display_deck[game.playerhands[id][0]]--;
      game.playerhands[id] = 0;
      if (game.deck.length == 0) {
        end_game();
      }
      //need to notify front end that player is knocked out and that the game is over
      return 8; //current player is knocked out
    } else if (game.playerhands[id][0] > game.playerhands[player][0]) {
      game.display_deck[game.playerhands[player][0]]--;
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
    game.display_deck[game.playerhands[player][0]]--;
    game.playerhands[player] = [game.deck.pop()];
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


  if (card == game.playerhands[player][0]) {
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
      if (game.playerhands[i][0] == largest_card) {
        largest_id.push(i);
      } else if (game.playerhands[i][0] > largest_card) {
        largest_card = game.playerhands[i][0];
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