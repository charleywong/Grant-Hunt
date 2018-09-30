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
when there is only one player left, the playerHands values are changed to be 0 for the losers and 1 for the winner
**/

//keeps track of current running game
var game =  { players: [], 
              playerHands: [],
              currentPlayer: 0,
              deck: deck,
              display_deck: display_deck,
              last_played: []
            };
            
var users = [];

if(process.argv.length > 2) {
	run_tests();
	return;
}

app.use(express.static(__dirname + '/assets'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/pages/index.html');
});

app.get('/index', function(req, res){
  res.sendFile(__dirname + '/pages/index.html');
});

app.get('/play', function(req, res){
  res.sendFile(__dirname + '/pages/play.html');
});

app.get('/rules', function(req, res){
  res.sendFile(__dirname + '/pages/rules.html');
});

play.on('connection', function(socket){
  console.log("incoming connection from " + socket.id);
  setTimeout(function() {
  	play.to(socket.id).emit('ping');
  }, 8000);
  
  socket.on('register', function (data) {
  	console.log("incoming registration from " + socket.id);
    if (data !== null) {
      //there was something in localstorage
      var index = getUserByUId(data);
      if (index != -1) {
      	console.log("user reconnected");
        users[index].disconnected = false;
        var sid = users[index].socketID;
        var gameIndex = getPlayerBySId(sid);
        if(gameIndex != -1){
          game.players[gameIndex] = socket.id;
          socket.join('players');
          play.to(socket.id).emit('player update', 4 - users.length);
        } else {
          socket.join('nonplayers');
          play.to(socket.id).emit('nonplayer update', users.length - 4);
        }
        users[index].socketID = socket.id;
         play.to(socket.id).emit('update', users.length);
      } else {
        addNewUser(data, socket);
      }
    } else {
      console.log("error, user joined with no ID");
    }
  });
  
  socket.on('disconnect', function(){
    var gind = getPlayerBySId(socket.id);
    console.log("Disconnect detected, starting timeout. User is player " + gind + ".");
    var index = getUserBySId(socket.id);
    if(index == -1) return;
  	users[index].disconnected = true;
    setTimeout(function () {
      if (users[index].disconnected){
        console.log("User timed out.");
  	    //on disconnect, decrement the user count, remove them from rooms and update
  	    removePlayerBySId(socket.id);
        play.emit('update', users.length);
      }
    }, 10000);
    
  });
  
  socket.on('play card', function(playedCard, otherCard){
    turnPhaseOne(playedCard, otherCard);
  });
  
  socket.on('target player', function(targetPlayer, playedCard, guessedCard){
    turnPhaseTwo(targetPlayer, playedCard, guessedCard)
  });
  
  socket.on('pong', function(){
    setTimeout(function() {
  	  play.to(socket.id).emit('ping');
    }, 8000);
  });
  
  
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
    game.playerHands[i] = card;
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

function turnPhaseOne(playedCard, otherCard){
  var id = game.currentPlayer;
  var playerList = [];
 
  //perform turn's action based on card
  //check next action based on card
  var result = played_card(id, playedCard, otherCard);
  //put other card into proper card slot
  if(result == 1){
      //all active players except themselves
    for(var i = 0; i < 4; i++){
      if(game.playerHands[i] != 0 && i != id){
        playerList.push(i);
      }
    }
  game.playerHands[id] = otherCard;
  } else if (result == 5) {
    //all active players, including themselves
    for(var i = 0; i < 4; i++){
      if(game.playerHands[i] != 0){
        playerList.push(i);
      }
    }
    game.playerHands[id] = otherCard;
  } else if (result == 6){
    playerList = [];
    game.playerHands[id] = otherCard;
  } else if(result == 7){
    //send a message to say that play is invalid
    play.to(game.players[id]).emit('invalid play');
    return;
  } else if (result == 8){
    //if they discard princess they lose
    game.playerHands[id] = 0;
    //move immediately on to the next turn without a second phase
    //or do we? maybe we should send the second phase message anyway to confirm or something idk
    nextTurn();
    return;
  }
  //send list of players to front end
  play.to(game.players[id]).emit('select player', playerList);
}
  
function turnPhaseTwo(targetPlayer, playedCard, guessedCard){
  var id = game.currentPlayer;
  //actually do the turn
  if(playedCard == 1) {
    if(guessedCard != null){
      guessed_card(id, targetPlayer, guessedCard);
    } else {
      console.log("Error: guard played with no guessed card");
    }
  } else {
    selected_player(id, targetPlayer, playedCard);
  }
  nextTurn();
}

function nextTurn(){
  //maybe we can add a check for game end function here?
  //Seems reasonable to do since game end is always checked right after a player's turn
   
  var id = game.currentPlayer;
  //move on to the next player without an empty hand
  id = (id + 1) % 4;
  while(game.playerHands[id] == 0){
    id = (id + 1) % 4;
  }
  
  //player draws a card
  var newCard = game.deck.pop();
  play.to(game.players[id]).emit('your turn', id, cardInfo(game.playerHands[id]), cardInfo(newCard));
  play.to('players').emit('game update', game.currentPlayer, game.display_deck, game.last_played);
  game.currentPlayer = id;
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
  return game.playerHands[id];
}

function played_card(id, card, otherCard) {
  if ((otherCard == 5 || otherCard == 6) && game.playerHands[id].includes(7)) {
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
    game.playerHands[id] = 0;
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
    return game.playerHands[player]; //id of card to display to current player
  } else if (card == 3) {
    if (game.playerHands[id] < game.playerHands[player]) {
      game.display_deck[game.playerHands[id]]--;
      game.playerHands[id] = 0;
      if (game.deck.length == 0) {
        end_game();
      }
      //need to notify front end that player is knocked out and that the game is over
      return 8; //current player is knocked out
    } else if (game.playerHands[id] > game.playerHands[player]) {
      game.display_deck[game.playerHands[player]]--;
      game.playerHands[player] = 0;



      if (game.deck.length == 0) {
        end_game();
      }
      //need to notify front end that player is knocked out and that the game is over
      return -8; //other player is knocked out
    } else {
      //nothing happens
    }
  } else if (card == 5) {
    game.display_deck[game.playerHands[player]]--;
    game.playerHands[player] = game.deck.pop();
  } else if (card == 6) {
    var temp = game.playerHands[id];
    game.playerHands[id] = game.playerHands[player];
    game.playerHands[player] = temp;
  }
}

function guessed_card (id, player, card) {
  if (game.deck.length == 0) {
    end_game();
  }
  //need to notify front end if player is knocked out and that the game is over somehow!!!  


  if (card == game.playerHands[player]) {
    game.display_deck[card]--;
    game.playerHands[player] = 0;
    return -8; //other player is knocked out
  }
  return 0;
}

function end_game() {
  var largest_id = [];
  var largest_card = 0;
  for (var i = 0; i < 4; i++) {
    if (game.playerHands[i] != 0) {
      if (game.playerHands[i] == largest_card) {
        largest_id.push(i);
      } else if (game.playerHands[i] > largest_card) {
        largest_card = game.playerHands[i];
        largest_id = [i];
      }
    }
  }
  for (var i = 0; i < 4; i++) {
    if (largest_id.includes(i)) {
      game.playerHands[i] = 1;
    } else {
      game.playerHands[i] = 0;
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

function getUserByUId(uid){
  for(var i = 0; i < users.length; i++){
    if(users[i].uniqueID == uid){
      return i;
    }
  }
  return -1;
}

function getUserBySId(sid){
  for(var i = 0; i < users.length; i++){
    if(users[i].socketID == sid){
      return i;
    }
  }
  return -1;
}

function getPlayerBySId(sid){
  for(var i = 0; i < game.players.length; i++){
    if(game.players[i] == sid){
      return i;
    }
  }
  return -1;
}

function removePlayerBySId(data){
  var gameIndex = getPlayerBySId(data);
  var userIndex = getUserBySId(data);
  if(gameIndex > -1){
    game.players.splice(gameIndex, 1);
  }
  if(userIndex > -1){
    users.splice(userIndex, 1);
  }
  
}

function addNewUser(UId, socket){
  var SId = socket.id;
  var entry = {uniqueID: UId, socketID: SId, disconnected: false};
  users.push(entry);
  console.log(users);
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
  	  play.to('players').emit('player update', 4 - users.length);
  	}
  } else {
    console.log("Player added to nonplayers group.");
  	socket.join('nonplayers');
  	play.to('nonplayers').emit('nonplayer update', users.length - 4);
  }
   
  //update the page to show how many users are connected
  play.emit('update', users.length);
}

//returns true if there are at least 2 players remaining, otherwise returns false and sets the winner using playerHands
function remaining_players() {
  var flag = false;
  var id = -1;
  for (var i = 0; i < 4; i++) {
    if (game.playerHands[i] != 0) {
      id = i;
      if (flag) return true;
      flag = true;
    }
  }
  
  for (var i = 0; i < 4; i++) {
    if (i == id) {
      game.playerHands[i] = 1;
    } else {
      game.playerHands[i] = 0;
    }
  }
  return false;
}

//checks the state of the game to see if it has reached an end state or not
function check_end_game() {
  if (game.deck.length == 0) {
    end_game();
    return 0;//deck is empty
  }

  return remaining_players();
}

function run_tests(){
  //run every function without checking results to check for errors

  console.log("Tests running...");
  game.players = [0, 1, 2, 3] 		//populate player list with data to avoid issues
  startGame();						//start game
  
  console.log(game);

  
  console.log("Tests concluded.");
}


