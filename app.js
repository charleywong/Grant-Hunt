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
var game =  { players: [], 
              playerHands: [],
              currentPlayer: 0,
              deck: deck,
              display_deck: display_deck,
              last_played: [],
              immune: []
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
      if(index < users.length){
        if (users[index].disconnected){
          console.log("User timed out.");
          //on disconnect, decrement the user count, remove them from rooms and update
          removePlayerBySId(socket.id);
          play.emit('update', users.length);
        }
      }
    }, 75000);
    
  });
  
  socket.on('play card', function(playedCard, otherCard){
    console.log("play card message received");
    turnPhaseOne(playedCard, otherCard);
  });
  
  socket.on('target player', function(targetPlayer, playedCard, guessedCard){
    console.log("target player message received");
    turnPhaseTwo(targetPlayer, playedCard, guessedCard)
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

// Function to begin Game
// Will prepare the Game state with a shuffled deck and cards dealt to players
// From here, will prepare the first players to start the game by dealing a fifth card
// And starting first players game
function startGame(){
  console.log("Starting game.");
  //Shuffle the deck
  game.deck = newDeck();
  //every player draws one card
  for(var i = 0; i < game.players.length; i++){
    //Deal card
    var card = game.deck.pop();
    game.playerHands[i] = card;
    game.last_played.push(0);
    play.to(game.players[i]).emit('start game', cardInfo.cardInfo(card));
  }

  //draw a card for first player
  var newCard = game.deck.pop();
  var id = game.currentPlayer;
  play.to(game.players[id]).emit('your turn', game.currentPlayer, cardInfo.cardInfo(game.playerHands[id]),  cardInfo.cardInfo(newCard));
  console.log("New game started. It is player " + id + "'s turn");
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
  return [8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 1, 1];
  //return shuffle([1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8]);
}


function playersInGame() {

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
 
  play.to('players').emit('game update', game.currentPlayer, game.display_deck, game.last_played);
  
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
    return;
  } else if (result == 0){
     // Proceed with game. No second phase needed
     nextTurn();
     return;
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
    play.to(game.players[id]).emit('invalid play');
    return;
  } else if(result == 8){
    turnPhaseTwo(id, 8, 0);
  }

  // Potentially check to see if there is noone available to select
  // Emit a message and proceed to next turn as no players available to select?
  //

  // Emit message featuring player list indicating phase two of turn
  play.to(game.players[id]).emit('select player', playedCard, playerList);
}
  
// Prepare for Phase Two of a turn
// This phase allows a player to select another player
// And performs the action corresponding to their card
function turnPhaseTwo(targetPlayer, playedCard, guessedCard){
  console.log("Initiating turn phase one for player " + game.currentPlayer + ".");
  var id = game.currentPlayer;
  // Perform action based on card
  // If the card was Built environment, check the guess
  if(playedCard == 1) {
    // Ensure a guess was made/submited
    if(guessedCard != null){
      game = logic.guessed_card(game, id, targetPlayer, guessedCard).game;
    } else {
      console.log("Error: guard played with no guessed card");
    }
  } else {
    //Perform action as a result of play
    var output = logic.selected_player(game, id, targetPlayer, playedCard);
    var result = output.output;
    game = output.game;
    if(result == 0){
      //if targeting a player with medicine immunity
      socket.to(game.players[id]).emit('invalid play');
    } else if(playedCard == 2){
      //if looking at a players hand with arts
      socket.to(game.players[id]).emit('arts result', cardInfo.cardInfo(result));
    } else if(playedCard == 3) {
      if(result == 8){
        //if player knocks themselves out with Law card
        //tell player and also tell opponent, also show which cards were compared
        socket.to(game.players[id]).emit('law loss', game.playerHands[id], game.playerHands[targetPlayer]);
        socket.to(game.players[targetPlayer]).emit('law win', game.playerHands[id], game.playerHands[targetPlayer]);
      } else if(result == -8){
        //if player knocks opponent out, it's the other way around
        socket.to(game.players[id]).emit('law win', game.playerHands[id], game.playerHands[targetPlayer]);
        socket.to(game.players[targetPlayer]).emit('law loss', game.playerHands[id], game.playerHands[targetPlayer]);
      } else {
        //otherwise it's a tie
        socket.to(game.players[id]).emit('law tie', game.playerHands[id], game.playerHands[targetPlayer]);
        socket.to(game.players[targetPlayer]).emit('law tie', game.playerHands[id], game.playerHands[targetPlayer]);
      }
    } else if (playerCard == 5){
      //if player uses Science to make someone discard
      //we tell that player what their new card is
      //(if the new card is a 0 they got eliminated!)
      socket.to(game.players[targetPlayer]).emit('science draw', game.playerHands[targetPlayer]);
    } else if (playerCard == 6){
      //if players swap hand with Engineering
      //we tell both players what their new hands are
      socket.to(game.players[id]).emit('eng swap', game.playerHands[id]);
      socket.to(game.players[targetPlayer]).emit('eng swap', game.playerHands[targetPlayer]);
    }
  }
  // Proceed to next turn
  nextTurn();
}

// Proceed game state to next turn in game
// Will update game state stored in system to recognise player
// As well as draw a new card for the next player to offer them their turn
function nextTurn(){
  console.log("Next turn!");
  // Check to see if the game has reached an end state.
  console.log(game);
  var output = logic.check_end_game(game);
  console.log("1");
  game = output.game;
  if (output.output == false) return;
   
  var id = game.currentPlayer;

  //move on to the next player without an empty hand
  id = (id + 1) % 4;
  while(game.playerHands[id] <= 0){
    id = (id + 1) % 4;
  }
  game.currentPlayer = id;
  
  //upate immunity - if we push onto the right and can only do so on a player's turn, then they should always be on the left on their turn
  if(game.immune.length > 0){
    if(game.immune[0] == id){
      game.splice(0, 1);
    }
  }
  
  
  //update players on who is remaining
  playersInGame();
  
  //player draws a card

  var newCard = game.deck.pop();
  play.to(game.players[id]).emit('your turn', id, cardInfo.cardInfo(game.playerHands[id]), cardInfo.cardInfo(newCard));
  
  
}


function remaining_cards() {
  return game.display_deck;
}

// Track the last play made within the last four turns
function play_log(id) {
  return game.last_played;
}

// Get the card in a players hand
function get_hand(id) {
  return game.playerHands[id];
}

// Return information regarding a card based on its value

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
    //hand of -1 indicates the player has left
    game.players[gameIndex] = -1;
    game.playerHands[gameIndex] = -1;
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
      
    }
    play.to('players').emit('player update', 4 - users.length);
  } else {
    console.log("Player added to nonplayers group.");
    socket.join('nonplayers');
    play.to('nonplayers').emit('nonplayer update', users.length - 4);
  }
   
  //update the page to show how many users are connected
  play.emit('update', users.length);
}
/*
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
*/
//create tuple and add to log
function play_log_tuple (player, card, target, result) {
  game.last_played.push([player, card, target, result]);
}

//Set dummy values for the game
function setDummy(){  
  game.players = [0,1,2,3]; 
  game.playerHands = [1,1,1,1];
  game.currentPlayer = 0;
  game.deck = [2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8];
  game.display_deck = display_deck;
  game.last_played = [0];
}

//Test Suite
function run_tests(){
  //run every function without checking results to check for errors

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
  assert(game.last_played.length == 4);
  for (var i = 0; i < game.players.length; i++){
    assert(game.last_played[0] == 0);
  }
  console.log("startGame function successful");

  console.log("");

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


  console.log("playedCard function successful");

  console.log("");

  console.log("Tests concluded.");
}

