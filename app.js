var express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var assert = require('assert');
var play = io.of('/play');

var usercount = 0;

var logic = require('./game_logic');
var cardInfo = require('./card');

/**
Card list:
-1: Disconnected from game.

0: Empty Card!
1: Guard    Built Environment   (5 copies)
2: Priest   Arts          (2 copies)
3: Baron    Law           (2 copies)
4: Handmaiden Medicine        (2 copies)
5: Prince   Science         (2 copies)
6: King     Engineering       (1 copy)
7: Countess   Business        (1 copy)
8: Princess   UNSW          (1 copy)
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
var game =  { status: "unstarted",
              players: [],
              ready: [],
              playerHands: [],
              currentPlayer: -1,
              deck: deck,
              display_deck: display_deck,
              drawnCard: 0,
              history: [],
              immune: [],
              roundsWon: [],
              lastWinners: []
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

  socket.emit('registration request');
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
      if(index < users.length){
        if (users[index].disconnected){
          console.log("User timed out.");
          //on disconnect, decrement the user count, remove them from rooms and update
          removePlayerBySId(socket.id);
          play.emit('update', users.length);
        }
      }
    }, 5000);
    
  });
  
  socket.on('play card', function(playedCard, otherCard){
    console.log("play card message received");
    console.log("played card: " + playedCard)
    console.log("other card in hand: " + otherCard)
    // turnPhaseOne(playedCard, otherCard);
    if(game.status == "running" && game.currentPlayer == getPlayerBySId(socket.id)){
      turnPhaseOne(playedCard, otherCard);
    }
  });
  
  socket.on('target player', function(targetPlayer, playedCard, guessedCard){
    console.log("target player message received");
    if(game.status == "running" && game.currentPlayer == getPlayerBySId(socket.id)){
      turnPhaseTwo(targetPlayer, playedCard, guessedCard);
    }
  });
  
  socket.on('ready', function(){
    var i = getPlayerBySId(socket.id);
    game.ready[i] = true;
    readyCheck();
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});


function  readyCheck(){
  var readyCount = 0;
  var playercount = 0;
  if(game.status == "waiting"){
    for(var j = 0; j < game.players.length; j++){
      if(game.players[j] != -1){
        playercount++;
        if(game.ready[j]){
          readyCount++;
        }
      }
    }
    if(readyCount == playercount){
      startRound();
    } else {
      play.emit('ready count', playercount - readyCount);
    }
  }
}

// Function to begin Game
// Will prepare the Game state with a shuffled deck and cards dealt to players
// From here, will prepare the first players to start the game by dealing a fifth card
// And starting first players game
function startGame(){
  console.log("Starting game.");
  play.emit('new game');
  game.status = "waiting";
  game.history = [];
  for(var i = 0; i < game.players.length; i++){
    game.roundsWon[i] = 0;
    game.ready[i] = false;
  }
  // startRound();
}

function startRound(){
  game.history.push("<strong>Starting new round...<strong>");
  var firstPlayer = 0;
  var highestWins = 0;
  for(var i = 0; i < game.lastWinners.length; i++){
    var pnum = game.lastWinners[i];
    if(game.roundsWon[pnum] > highestWins){
      firstPlayer = game.lastWinners[i];
      highestWins = game.roundsWon[pnum];
    }
  }
  //Shuffle the deck
  game.deck = newDeck();
  //every player draws one card
  for(var i = 0; i < game.players.length; i++){
    //Deal card
    if(game.players[i] != -1){
      var card = game.deck.pop();
      game.playerHands[i] = card;
      game.immune[i] = false;
      play.to(game.players[i]).emit('start game', cardInfo.cardInfo(card));
    }
  }
  //draw a card for first player
  var newCard = game.deck.pop();
  game.drawnCard = newCard;
  game.currentPlayer = firstPlayer;
  game.status = "running";
  play.to(game.players[firstPlayer]).emit('your turn', firstPlayer, cardInfo.cardInfo(game.playerHands[firstPlayer]),  cardInfo.cardInfo(newCard));
  console.log("New game started. It is player " + firstPlayer + "'s turn");
  playersInGame();

}


// Take a deck of cards (an array of numbers)
// And shuffle them into a pseudo-random order
function shuffle(deck){
  //Start from end of array
  var currIndex = deck.length;
  //for each card, swap randomly with another card in deck
  while (0 !== currIndex){
    var r = Math.floor(Math.random() * currIndex);
    currIndex--;
    var temp = deck[r];
    deck[r] = deck[currIndex];
    deck[currIndex] = temp;
  }
  //return shuffled deck
  return deck;
}


// Prepare a deck for game
// Returns a shuffled Grant Hunt Deck
function newDeck(){
  //preset deck for testing
  return [8, 7, 6, 5, 5, 4, 4, 2, 2, 1, 3, 3,1, 5, 8, 8, 8,8];
  //return shuffle([1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8]);
}



//create tuple and add to log
function play_log_tuple (player, card, guessedCard, target, result) {
  var string = "Player " + player + " ";
  var guessedCard = parseInt(guessedCard);
  switch(card){
    case 1:
      string = string + "played Built Environment. They guessed Player " + target + " had " + cardInfo.cardInfo(guessedCard).name + ", ";
      if(result == -8){
        string = string + "and was correct! Player " + target + " is eliminated from the round."; 
      } else {
        string = string + "but was incorrect.";
      }
      break;
    case 2:
      string = string + "played Arts to view Player " + target + "'s hand.";
      break;
    case 3:
      string = string + "targeted Player " + target + " with a Law card, "
      if(result == 8){
        string = string + "and lost! Player " + player + " is eliminated from the round.";
      } else if(result == -8) {
        string = string + "and won! Player " + target + " is eliminated from the round."; 
      } else {
        string = string + "and nothing happened!"; 
      }
      break;
    case 4: 
      string = string + "played a Medicine card. They can not be targeted by cards until their next turn.";
      break;
    case 5:
      string = string + "targeted " + ((target == player)?"themselves":("Player " + target)) + " with a Science card. They discarded " + cardInfo.cardInfo(result).name;
      if(result == 8){
        string = string + " and were therefore eliminated from the round";
      }
      string = string + ".";
      break;
    case 6:
      string = string + "played Engineering to swap hands with Player " + target + ".";
      break;
    case 7:
      string = string + "discarded their Business card.";
      break;
    case 8:
      string = string + "discarded UNSW, and is eliminated from the round!";
      break;
    default:
      string = "Error handling play history: Unknown card played.";  
  }
  console.log("PLAY LOG: " + string);
  game.history.push(string);
}


function playersInGame(){
  var remainingPlayersInRound = [];
  var remainingPlayersInGame = [];
  for(var i = 0; i < game.players.length; i++){
    if(game.playerHands[i] != -1){
      remainingPlayersInGame.push(i);
    }
  
    if(game.playerHands[i] > 0){
      remainingPlayersInRound.push(i);
    }
  }
  for(var p in game.players){
    pId = p;
    play.to(game.players[p]).emit('remaining players', remainingPlayersInGame, remainingPlayersInRound, pId);
  }
  play.emit('game update', game.currentPlayer, game.display_deck, game.history, game.immune);
  play.to('nonplayers').emit('remaining players', remainingPlayersInGame, remainingPlayersInRound, null);
}

// Prepare for Phase One of a turn
// This phase takes a players card selection
// And performs an action based on that card
function turnPhaseOne(playedCard, otherCard){
  console.log("Initiating turn phase one for player " + game.currentPlayer + ".");
  var id = game.currentPlayer;
  var playerList = [];
  //Set the players hand to be the card in hand
  game.playerHands[id] = otherCard;
  // Perform turn's action based on card
  // Check next action based on card
  var output = logic.played_card(game, id, playedCard, otherCard);
  game = output.game;
  var result = output.output;
  if (result == -1){
    //End game actions
    //logic.end_game(game);
    return playerList;
  } else if (result == 0){
     // Proceed with game. No second phase needed
     play_log_tuple (id, playedCard, -1, -1, -1);
     nextTurn();
     return playerList;
  } else if(result == 1){
    // Select a player to target from those still in the round
    // Except for self
    for(var i = 0; i < 4; i++){
      if(game.playerHands[i] != 0 && i != id){
        playerList.push(i);
      }
    }
  } else if (result == 5) {
    // Select a player to target from those still in the round
    // Including self
    for(var i = 0; i < 4; i++){
      if(game.playerHands[i] != 0){
        playerList.push(i);
      }
    }
  } else if(result == 7){
    //Send a message to say that play is invalid
    play.to(game.players[id]).emit('invalid play', 'business');
    return playerList;
  } else if(result == 8){
    play_log_tuple (id, 8, -1, -1, -1);
    if(eliminate_player(id) == false) {
      return playerList;
    } else {
      nextTurn();
    }
    return playerList;
  }
  //check to see if all targetable players are immune
  var allImmune = true;

  for(var j = 0; j < playerList.length; j++){
    if(!game.immune[playerList[j]]){
      allImmune = false;
    }
  }
  
  if(allImmune){
    //emit message saying all are immune and then skip to next turn
    play.to(game.players[id]).emit('all immune');
    console.log("All immune");
    nextTurn();
  } else {
    // Emit message featuring player list indicating phase two of turn
    play.to(game.players[id]).emit('select player', playedCard, playerList, game.immune);
  }
  
  return playerList;
}
  
// Prepare for Phase Two of a turn
// This phase allows a player to select another player
// And performs the action corresponding to their card
function turnPhaseTwo(targetPlayer, playedCard, guessedCard){
  console.log("Initiating turn phase two for player " + game.currentPlayer + ".");
  var id = game.currentPlayer;
  //two values used to store the message we emit
  //used for testing purposes ONLY
  var emitMessage1 = [];
  var emitMessage2 = [];
  // Perform action based on card
  // If the card was Built environment, check the guess
  if(playedCard == 1) {
    // Ensure a guess was made/submited
    if(guessedCard != null){
      var result = logic.guessed_card(game, id, targetPlayer, guessedCard);
      game = result.game;
      var guessedCard = parseInt(guessedCard);
      if(result.output == -8){
        play.to(game.players[id]).emit('built result', id, targetPlayer, cardInfo.cardInfo(guessedCard), true);
        emitMessage1 = ['built result', id, targetPlayer, guessedCard, true];
        play.to(game.players[targetPlayer]).emit('built result', id, targetPlayer, cardInfo.cardInfo(guessedCard), true);
        emitMessage2 = ['built result', id, targetPlayer, guessedCard, true];
        
        if(eliminate_player(targetPlayer) == false) {
          return {message1: emitMessage1, message2: emitMessage2};
        } 
      } else {
        play.to(game.players[id]).emit('built result', id, targetPlayer, cardInfo.cardInfo(guessedCard), false);
        emitMessage1 = ['built result', id, targetPlayer, guessedCard, false];
        play.to(game.players[targetPlayer]).emit('built result', id ,targetPlayer, cardInfo.cardInfo(guessedCard), false);
        emitMessage2 = ['built result', id ,targetPlayer, guessedCard, false];
      }
      play_log_tuple (id, playedCard, guessedCard, targetPlayer, result.output);
    } else {
      console.log("Error: guard played with no guessed card");
      emitMessage1 = ['invalid play'];
      return {message1: emitMessage1, message2: emitMessage2};
    }
  } else {
    //Perform action as a result of play
    var output = logic.selected_player(game, id, targetPlayer, playedCard);
    var result = output.output;
    game = output.game;
    if(result == 0){
      //if targeting a player with medicine immunity
      play.to(game.players[id]).emit('invalid play', 'immunity');
      emitMessage1 = ['invalid play'];
      return {message1: emitMessage1, message2: emitMessage2};
    } else if(playedCard == 2){
      //if looking at a players hand with arts
      play.to(game.players[id]).emit('arts result', targetPlayer, cardInfo.cardInfo(result));
      emitMessage1 = ['arts result', cardInfo.cardInfo(result)]
    } else if(playedCard == 3) {
      var hands = {};
      // hands[role] = [playerId, hand compared]
      hands['player'] = [id, cardInfo.cardInfo(game.playerHands[id])];
      hands['target'] = [targetPlayer, cardInfo.cardInfo(game.playerHands[targetPlayer])];
      if(result == 8){
        //if player knocks themselves out with Law card
        //tell player and also tell opponent, also show which cards were compared
        play.to(game.players[id]).emit('law loss', hands);
        emitMessage1 = ['law loss', hands];
        play.to(game.players[targetPlayer]).emit('law win', hands);
        emitMessage2 = ['law win', hands];
        if(eliminate_player(id) == false) {
          play_log_tuple (id, playedCard, guessedCard, targetPlayer, result);
          return {message1: emitMessage1, message2: emitMessage2};
        }
      } else if(result == -8){
        //if player knocks opponent out, it's the other way around
        play.to(game.players[id]).emit('law win', hands);
        emitMessage1 = ['law win', hands];
        play.to(game.players[targetPlayer]).emit('law loss', hands);
        emitMessage2 = ['law loss', hands];
        if(eliminate_player(targetPlayer) == false) {
          play_log_tuple (id, playedCard, guessedCard, targetPlayer, result);
          return {message1: emitMessage1, message2: emitMessage2};
        } 
      } else {
        //otherwise it's a tie
        play.to(game.players[id]).emit('law tie',  hands, targetPlayer);
        emitMessage1 = ['law tie',  hands, targetPlayer];
        play.to(game.players[targetPlayer]).emit('law tie',  hands, targetPlayer);
        emitMessage2 = ['law tie',  hands, targetPlayer];

      }
    } else if (playedCard == 5){
      //if player uses Science to make someone discard
      //we tell that player what their new card is
      
      //result of 8 means they discarded UNSW
      if(result == 8){
        if(eliminate_player(targetPlayer) == false) {
          play_log_tuple (id, playedCard, guessedCard, targetPlayer, result);
          return {message1: emitMessage1, message2: emitMessage2};
        } 
      } else {
        play.to(game.players[targetPlayer]).emit('science draw',id, cardInfo.cardInfo(game.playerHands[targetPlayer]));
        emitMessage1 = ['science draw', cardInfo.cardInfo(game.playerHands[targetPlayer])];
      }

    } else if (playedCard == 6){
      //if players swap hand with Engineering
      //we tell both players what their new hands are
      play.to(game.players[id]).emit('eng swap', cardInfo.cardInfo(game.playerHands[id]), id, targetPlayer);
      emitMessage1 = ['eng swap', game.playerHands[id]];
      play.to(game.players[targetPlayer]).emit('eng swap', cardInfo.cardInfo(game.playerHands[targetPlayer]), id, targetPlayer);
      emitMessage2 = ['eng swap', game.playerHands[targetPlayer]];

    }
    play_log_tuple (id, playedCard, guessedCard, targetPlayer, result);
  }
  // Proceed to next turn
  nextTurn();
  return {message1: emitMessage1, message2: emitMessage2};
}

// Proceed game state to next turn in game
// Will update game state stored in system to recognise player
// As well as draw a new card for the next player to offer them their turn
function nextTurn(){
  console.log("Next turn!");
  // Check to see if the game has reached an end state.
  var output = logic.check_end_game(game);
  game = output.game;
  if (output.output == false){
    report_end_round();
    return;
  }
  var id = game.currentPlayer;
  //move on to the next player without an empty hand
  id = (id + 1) % 4;
  while(game.playerHands[id] <= 0){
    id = (id + 1) % 4;
  }
  game.currentPlayer = id;
  game.immune[id] = false;
  //update players on who is remaining
  playersInGame();
  //player draws a card
  var newCard = game.deck.pop();
  game.drawnCard = newCard;
  play.to(game.players[id]).emit('your turn', id, cardInfo.cardInfo(game.playerHands[id]), cardInfo.cardInfo(newCard));
  console.log("Player " + id + " draws " + cardInfo.cardInfo(newCard).name + "."); 
}


//eliminates a player from the round, and notifies the front end
function eliminate_player(playerid){
  console.log("Player " + playerid + " has been eliminated.");
  var c = game.playerHands[playerid];
  game.display_deck[c]--;
  game.playerHands[playerid] = 0;
  playersInGame();
  play.to(game.players[playerid]).emit('eliminated', game.players);
  var result = logic.check_end_game(game);
  game = result.game;
  if(result.output == false) report_end_round();
  return result.output;
}

function report_end_round(){
  var winners = [];
  var gameOver = false;
  var gWinners = [];
  for(var i = 0; i < game.playerHands.length; i++){
    if(game.playerHands[i] > 0){
      winners.push(i);
      game.roundsWon[i]++;
      if(game.roundsWon[i] >= 3){
        gWinners.push(i);
        gameOver = true;
      }
    }
    game.ready[i] = false;
  }

  winner_str = "<strong>The round has finished!";
  if(winners.length > 1){
    winner_str += " The winners are:";
    for(var j=0; j<winners.length; j++){
      winner_str += " Player ";
      winner_str += winners[j];
      if(winners[j] != winners[winners.length-1]){
        winner_str +=  ", ";
      }
    }
  } else {
    winner_str += " The winner is Player " + winners;
  }
  winner_str += "</strong>";
  game.history.push(winner_str);
  console.log("PLAY LOG: The round has finished. The winners are: " + winners);
 
  game.lastWinners = winners;
  if(gameOver){
    finish_game(gWinners);
  } else {
    game.status = "waiting";
  }
  
  
  play.to('players').emit('round finished', winners);
}

function finish_game(winners){
  winner_str = "<strong>The game has ended!";
  if(winners.length > 1){
    winner_str += " The winners are:";
    for(var j=0; j<winners.length; j++){
      winner_str += " Player ";
      winner_str += winners[j];
      if(winners[j] != winners[winners.length-1]){
        winner_str +=  ", ";
      }
    }
  } else {
    winner_str += " The winner is Player " + winners;
  }
  winner_str += "</strong>";
  game.history.push(winner_str);
  play.emit('game update', game.currentPlayer, game.display_deck, game.history, game.immune);
  play.to('players').emit('game finished', winners);
  reset();
  
}


function remaining_cards() {
  return game.display_deck;
}


// Get the card in a players hand
function get_hand(id) {
  return game.playerHands[id];
}

//gets immunity status of all players
function get_immune_players() {
  return game.immune;
}

// Get a users in game ID based on their unique ID
function getUserByUId(uid){
  for(var i = 0; i < users.length; i++){
    if(users[i].uniqueID == uid){
      return i;
    }
  }
  return -1;
}

// Get a users in game ID based on their socket ID
function getUserBySId(sid){
  for(var i = 0; i < users.length; i++){
    if(users[i].socketID == sid){
      return i;
    }
  }
  return -1;
}

//Get a players in game ID based on their socket ID
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
    usercount--;
    //hand of -1 indicates the player has left
    if(game.status == 'running'){
      var card = game.playerHands[gameIndex];
      game.players[userIndex] = -1;
      game.playerHands[userIndex] = -1;
      if(usercount == 1){
        for(var i = 0; i < game.players.length; i++){
          if(game.players[i] != -1){
            console.log('all other players disconnected, player ' + i + ' wins by default');
            finish_game([i]);
            reset();
          }
        }
      } else {
         game.display_deck[card]--;
         var message = "Player " + gameIndex + " has quit. They discard their " + cardInfo.cardInfo(card).name + " card.";
        if(gameIndex == game.currentPlayer){
          game.display_deck[game.drawnCard]--;
          message = message + " They also discard the " + cardInfo.cardInfo(game.drawnCard).name + " card that they drew this turn.";
          nextTurn();
        }
        game.history.push(message);
        play.emit('game update', game.currentPlayer, game.display_deck, game.history, game.immune);
      }
    } else if(game.status == 'waiting'){
      game.players[userIndex] = -1;
      game.playerHands[userIndex] = -1;
      if(usercount == 1){
        for(var i = 0; i < game.players.length; i++){
          if(game.players[i] != -1){
            console.log('all other players disconnected, player ' + i + ' wins by default');
            finish_game([i]);
            reset();
          }
        }
      }
      readyCheck();
    } else {
      game.players.splice(userIndex, 1);
      game.playerHands.splice(gameIndex, 1);
      game.status = "unstarted";
    }
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
    usercount++;
    console.log("Player added to players group.");
    game.players.push(socket.id);
    socket.join('players');
    if(game.players.length == 4){
      startGame();
    }
    play.to('players').emit('player update', 4 - users.length);
  } else {
    socket.join('nonplayers');
    play.to(SId).emit('game full');
    socket.join('nonplayers');
  }
  
  //update the page to show how many users are connected
  play.emit('update', users.length);
}

function reset(){
  game = { status: "unstarted",
           players: [],
           ready: [],
           playerHands: [],
           currentPlayer: -1,
           deck: deck,
           display_deck: display_deck,
           history: [],
           immune: [],
           roundsWon: [],
           lastWinners: []
         };
  users = [];
  usercount = 0;
}


//Set dummy values for the game
function setDummy(){  
  game.players = [0,1,2,3]; 
  game.playerHands = [1,1,1,1];
  game.currentPlayer = 0;
  game.deck = [2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8];
  game.display_deck = display_deck;
  game.history = [];
}




//Test Suite
function run_tests(){
  //run every function without checking results to check for errors

  {
  console.log("Tests running...");
  
  console.log("");
  
  console.log("Testing newDeck function");
  var deck = newDeck();
  console.log("Deck Created");
  console.log("Checking correct deck size");
  assert(deck.length == 16);
  console.log("Deck size correct");
  console.log("Checking correct cards present in deck");
  assert(deck.sort().toString() == "1,1,1,1,1,2,2,3,3,4,4,5,5,6,7,8");
  console.log("All cards present in deck are correct");
  console.log("newDeck function successful");

  console.log("");

  console.log("Testing shuffle function");
  console.log("Checking that shuffle function is valid (test subject to fail in less the 1% of cases)");
  var testShuffle = [];
  //Generate a deck of values 0-99
  for (var i = 0; i < 100; i++){
    testShuffle.push(i);
  }
  var baseString = testShuffle.sort().toString();
  console.log("Shuffling deck of values 0-99 a thousand times, checking for repeated "); 
  //Shuffle 1000 times, ensuring no repeats
  seen = [];
  for (var i = 0; i < 10000; i++){
    var shuffleResult = shuffle(testShuffle);
    //Check length is same
    assert(shuffleResult.length == 100);
    //Check that all elements are same
    assert(shuffleResult.sort().toString() == baseString);
    //Check this permutation isnt already existing
    assert(!seen.includes(shuffleResult.toString())); 
    //Add permutation to seen
    seen.push(shuffleResult);
  }
  console.log("Shuffle function successful");

  console.log("");

  console.log("Testing startGame function");
  //populate player list with data to avoid issues
  game.players = [0, 1, 2, 3]        
  
  startGame();                      
  startRound();
  //Check game state, ensuring valid

  //Ensure game players are unchanged
  assert(game.players.length == 4);
  for (var i = 0; i < game.players.length; i++){
    assert(game.players[i] == i);
  }

  //Ensure players have been dealt cards
  for (var i = 0; i < game.players.length; i++){
    assert(game.playerHands[i] > 0 && game.playerHands[i] < 9);  
  }

  //Ensure current player is the first
  assert(game.currentPlayer == game.players[0]);

  //Ensure a deck is left with 11 cards
  assert(game.deck.length == 11);

  //Ensure the display deck is unchanged
  for (var i = 1; i <= 8; i++){
    assert(game.display_deck[i] == display_deck[i]);  
  }

  //Ensure the last played card is set
  /*assert(game.last_played.length == 4);
  for (var i = 0; i < game.players.length; i++){
    assert(game.last_played[0] == 0);
  }*/
  console.log("startGame function successful");

  console.log("");
  /*
  console.log("Testing playedCard function");
  
  setDummy();
  // Perform an action based on card
  // played_card(id, card, otherCard);
  //
  // 1: Guard       Built Environment   return 1 to pick a player
  // 2: Priest      Arts                return 1 to pick a player
  // 3: Baron       Law                 return 1 to pick a player
  // 4: Handmaiden  Medicine            return 0 to proceed with game
  // 5: Prince      Science             return 5 to pick a player including self
  // 6: King        Engineering         return 1 to pick a player
  // 7: Countess    Business            return 0 or 7 to proceed
  // 8: Princess    UNSW                return 8 to show you are knocked out
  // If final card,                     return -1 to end game

  //Check playing Built Environment is correct 
  assert(played_card(0, 1, 1) == 1);

  //Check playing Arts is correct 
  assert(played_card(0, 2, 1) == 1);

  //Check playing Law is correct 
  assert(played_card(0, 3, 1) == 1);

  //Check playing Medicene is correct 
  assert(played_card(0, 4, 1) == 0);

  //Check playing Science is correct 
  assert(played_card(0, 5, 1) == 5);

  //Check playing Engineering is correct
  assert(played_card(0, 6, 1) == 1);

  //Check playing Countess
  //If you play 7 on a valid choice
  game.playerHands[0] = 7;
  assert(played_card(0, 7, 5) == 0);

  game.playerHands[0] = 7;
  assert(played_card(0, 7, 4) == 0);

  //If you play 7 on invalid play
  game.playerHands[0] = 7;
  assert(played_card(0, 5, 7) == 7);

  game.playerHands[0] = 7;
  assert(played_card(0, 6, 7) == 7);

  //Check playing Princess
  game.playerHands[0] = 8;
  assert(played_card(0, 8, 1) == 8);
  assert(game.playerHands[0] == 0);

  //Check if last card is played, game ends
  setDummy();
  game.deck = [];
//  assert(played_card(0, 1, 1) == -1);


  console.log("playedCard function successful");*/
  }
  
  
  console.log("Testing through game simulation...");
  console.log("Starting new game...");

  //Start game
  game.history = [];
  startGame();
  console.log("Rigging deck and hands..");
  game.deck = [7, 8, 1, 5, 3, 4, 1, 2, 3, 6, 2];
  game.playerHands[0] = 1;
  game.playerHands[1] = 1;
  game.playerHands[2] = 5;
  game.playerHands[3] = 4;
  
  var r;
  //turnPhaseOne(playedCard, otherCard) 					        (RETURNS PLAYER LIST)
  //turnPhaseTwo(targetPlayer, playedCard, guessedCard)		(RETURNS EMIT MESSAGES)
  
  console.log("Turn 1, Phase 1: Player 0 selects built environment card.");
  assert(listCmp(game.deck, [7, 8, 1, 5, 3, 4, 1, 2, 3, 6, 2]));
  assert(game.currentPlayer == 0);
  r = turnPhaseOne(1, 1);
  assert(listCmp(r,[1, 2, 3]));
  

  console.log("Turn 1, Phase 2: Player 0 targets player 1 and guesses UNSW (incorrectly).");
  r = turnPhaseTwo(1, 1, 8);
  assert(listCmp(r.message1, ['built result', 0, 1, 8, false]));
  assert(listCmp(r.message2, ['built result', 0, 1, 8, false]));
  assert(game.playerHands[0] == 1);
  assert(game.playerHands[1] != 0);
  
  
  console.log("Turn 2, Phase 1: Player 1 selects Arts card.");
  assert(listCmp(game.deck, [7, 8, 1, 5, 3, 4, 1, 2, 3, 6]));
  assert(game.currentPlayer = 1);
  r = turnPhaseOne(2, 1);
  assert(listCmp(r, [0, 2, 3]));
  
  console.log("Turn 2, Phase 2: Player 1 targets player 2. They see player 2 is holding Science.");
  r = turnPhaseTwo(2, 2, 0);
  assert(r.message1.length == 2);
  assert(r.message1[0] == 'arts result');
  assert(r.message1[1].name == cardInfo.cardInfo(game.playerHands[2]).name);
  assert(r.message1[1].strength == cardInfo.cardInfo(game.playerHands[2]).strength);
  assert(r.message1[1].description == cardInfo.cardInfo(game.playerHands[2]).description);
  assert(r.message1[1].strength == 5);
  assert(game.playerHands[1] == 1);
  assert(game.playerHands[2] == 5);
  
  console.log("Turn 3, Phase 1: Player 2 selects Science card.");
  assert(listCmp(game.deck, [7, 8, 1, 5, 3, 4, 1, 2, 3]));
  assert(game.currentPlayer == 2);
  r = turnPhaseOne(5, 6);
  assert(r.length == 4);
  assert(listCmp(r, [0, 1, 2, 3]));
  
  console.log("Turn 3, Phase 2: Player 2 targets Player 3. Player 3 discards Medicine and draws Law.");
  r = turnPhaseTwo(3, 5, 0);
  assert(r.message1.length == 2);
  assert(r.message1[0] == 'science draw');
  assert(r.message1[1].strength == 3);
  assert(game.playerHands[3] == 3);
  
  console.log("Turn 4, Phase 1: Player 3 selects Law card.");
  assert(listCmp(game.deck, [7, 8, 1, 5, 3, 4, 1]));
  assert(game.currentPlayer == 3);
  r = turnPhaseOne(3, 2);
  assert(r.length == 3);
  assert(listCmp(r, [0, 1, 2]));
  
  console.log("Turn 4, Phase 2: Player 3 targets Player 2. They lose and are eliminated.");
  assert(game.playerHands[2] == 6);
  assert(game.playerHands[3] == 2);
  r = turnPhaseTwo(2, 3, 0);
  assert(r.message1[0] == 'law loss');
  assert(r.message1[1]['player'][0] == 3);
  assert(r.message1[1]['player'][1].strength == 2);
  assert(r.message1[1]['target'][0] == 2);
  assert(r.message1[1]['target'][1].strength == 6);
  assert(r.message2[0] == 'law win');
  assert(r.message2[1]['player'][0] == 3);
  assert(r.message2[1]['player'][1].strength == 2);
  assert(r.message2[1]['target'][0] == 2);
  assert(r.message2[1]['target'][1].strength == 6);
  assert(game.playerHands[3] == 0);
  assert(game.playerHands[2] == 6);
  
  console.log("Turn 5, Phase 1: Player 0 selects Built Environment card");
  assert(listCmp(game.deck, [7, 8, 1, 5, 3, 4]));
  assert(game.currentPlayer == 0);
  r = turnPhaseOne(1, 1);
  assert(r.length == 2);
  assert(listCmp(r, [1, 2]));
  
  console.log("Turn 5, Phase 2: Player 0 targets Player 2 and guesses Engineering (correctly). Player 2 is eliminated.");
  assert(game.playerHands[2] == 6);
  r = turnPhaseTwo(2, 1, 6);
  assert(listCmp(r.message1, ['built result', 0, 2, 6, true]));
  assert(listCmp(r.message2, ['built result', 0, 2, 6, true]));
  assert(game.playerHands[2] == 0);
  console.log(game.playerHands[0]);
  assert(game.playerHands[0] == 1);
  
  
  console.log("Turn 6, Phase 1: Player 1 selects Medicine card. Phase 2 does not occur")
  assert(listCmp(game.deck, [7, 8, 1, 5, 3]));
  r = turnPhaseOne(4, 1);
  assert(listCmp(r, []));
  assert(game.immune[1]);
  
  console.log("Turn 7, Phase 1: Player 0 selects Built Environment card. All other players are immune so the card is discarded without effect.");
  assert(listCmp(game.deck, [7, 8, 1, 5]));
  assert(game.playerHands[0] == 1);
  r = turnPhaseOne(1, 3);
  assert(game.playerHands[0] == 3);

  console.log("Turn 8, Phase 1: Player 1 selects Science card.");
  assert(game.currentPlayer == 1);
  assert(listCmp(game.immune, [false, false, false, false]));
  console.log(game.deck);
  assert(listCmp(game.deck, [7, 8, 1]));
  r = turnPhaseOne(5, 1);
  assert(listCmp(r, [0, 1]));
  
  console.log("Turn 8, Phase 2: Player 1 targets themselves. They discard their Built environment and draw another Built Environment.");
  assert(game.playerHands[1] == 1);
  r = turnPhaseTwo(1, 5, 0);
  assert(r.message1[0] == 'science draw');
  assert(r.message1[1].strength == 1);
  assert(game.playerHands[1] == 1);
  
  console.log("Turn 9, Phase 2: Player 0 plays UNSW. They are immediately eliminated from the round, and the round ends, with Player 1 winning the round.");
  assert(listCmp(game.deck, [7]));
  r = turnPhaseOne(8, 1);
  assert(game.playerHands[0] == 0);
  assert(listCmp(r, []));  

  console.log("Rigging Deck, testing special situations");
  console.log("Player plays a Law card and targets player with Princess");
  startGame();
  game.deck = [7, 1, 3, 4, 1, 6, 3, 2, 2, 1, 1];
  game.playerHands[0] = 5;
  game.playerHands[1] = 8;
  game.playerHands[2] = 5;
  game.playerHands[3] = 4;

  console.log("");
  console.log("Turn 1, Phase 1: Player 0 plays Science card.");
  assert(listCmp(game.deck, [7, 1, 3, 4, 1, 6, 3, 2, 2, 1, 1]));
  assert(game.currentPlayer == 0);
  r = turnPhaseOne(5, 1);
  assert(r.length == 4);
  assert(listCmp(r, [0, 1, 2, 3]));
  
  console.log("Turn 1, Phase 2: Player 0 targets Player 1. Player 1 discards UNSW and is eliminated.");
  r = turnPhaseTwo(1, 5, 0);  
  assert(game.playerHands[0] == 1);
  assert(game.playerHands[1] == 0);
  assert(game.currentPlayer == 2);
  assert(listCmp(game.deck, [7, 1, 3, 4, 1, 6, 3, 2, 2, 1]));

  console.log("Turn 2, Phase 1: Player 2 plays Science card.");
  r = turnPhaseOne(5, 1);
  assert(r.length == 3);
  assert(listCmp(r, [0, 2, 3]));
  
  console.log("Turn 1, Phase 2: Player 2 targets Player 3. Player 3 discards Medicine and draws Built Environment.");
  r = turnPhaseTwo(3, 5, 0);
  assert(r.message1.length == 2);
  assert(r.message1[0] == 'science draw');
  assert(r.message1[1].strength == 1);

  assert(game.playerHands[2] == 1);
  assert(game.playerHands[3] == 1);
  assert(listCmp(game.immune, [false, false, false, false]));
  assert(game.currentPlayer == 3);
  assert(listCmp(game.deck, [7, 1, 3, 4, 1, 6, 3, 2]));

  console.log("Turn 3, Phase 1: Player 3 plays Law card.");
  r = turnPhaseOne(3, 1);
  assert(r.length == 2);
  assert(listCmp(r, [0, 2]));
  
  console.log("Turn 3, Phase 2: Player 3 targets Player 0.");
  r = turnPhaseTwo(0, 3, 0);

  assert(r.message1[0] == 'law tie');
  assert(r.message1[1]['player'][0] == 3);
  assert(r.message1[1]['player'][1].strength == 1);
  assert(r.message1[1]['target'][0] == 0);
  assert(r.message1[1]['target'][1].strength == 1);
  assert(r.message2[0] == 'law tie');
  assert(r.message2[1]['player'][0] == 3);
  assert(r.message2[1]['player'][1].strength == 1);
  assert(r.message2[1]['target'][0] == 0);
  assert(r.message2[1]['target'][1].strength == 1);
  assert(game.playerHands[0] == 1);
  assert(game.playerHands[3] == 1);
  assert(game.currentPlayer == 0);

  assert(listCmp(game.deck, [7, 1, 3, 4, 1, 6, 3]));

  console.log("Turn 4, Phase 1: Player 0 rigged to play Engineering and receive UNSW.");
  game.playerHands[0] = 6;
  game.playerHands[3] = 8;
  r = turnPhaseOne(6, 2, 0);
  assert(r.length == 2);
  assert(listCmp(r, [2, 3]));

  console.log("Turn 4, Phase 2: Player 0 trades with player 3.");
  r = turnPhaseTwo(3, 6, 2);
  assert(r.message1[0] == 'eng swap');
  assert(r.message1[1] == 8);
  assert(r.message2[0] == 'eng swap');
  assert(r.message2[1] == 2);

  assert(game.playerHands[0] == 8);
  assert(game.playerHands[3] == 2);
  assert(game.currentPlayer == 2);
  assert(listCmp(game.deck, [7, 1, 3, 4, 1, 6]));

  console.log("Tests concluded.");
  
}

//helper list comparison function
//return true if the two lists are exactly equal
function listCmp(list1, list2){
  if(list1.length != list2.length){
    return false;
  } else {
    for(var i = 0; i < list1.length; i++){
      if(list1[i] != list2[i]){
        return false;
      }
    }
  }
  return true;
}
