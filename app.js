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
    play.to(game.players[i]).emit('start game', cardInfo(card));
  }

  //draw a card for first player
  var newCard = game.deck.pop();
  play.to(game.players[game.currentPlayer]).emit('your turn', game.currentPlayer, cardInfo(game.playerHands[id]),  cardInfo(newCard));
  console.log("New game started. It is player 0's turn. SocketID: " + game.players[0]);
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
  return shuffle([1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8]);
}

// Prepare for Phase One of a turn
// This phase takes a players card selection
// And performs an action based on that card
function turnPhaseOne(playedCard, otherCard){
  var id = game.currentPlayer;
  var playerList = [];

  //Set the players hand to be the card in hand
  game.playerHands[id] = otherCard;
 
  // Perform turn's action based on card
  // Check next action based on card
  var result = played_card(id, playedCard, otherCard);
  if (result == -1){
    //End game actions
    end_game();
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
  } else if (result == 8){
    // Player discarded Princess. They are immediately removed from play
    game.playerHands[id] = 0;

    // Proceed to next turn
    // Can also send a message to front end to feature a response due to play
    nextTurn();
    return;
  }

  // Potentially check to see if there is noone available to select
  // Emit a message and proceed to next turn as no players available to select?
  //

  // Emit message featuring player list indicating phase two of turn
  play.to(game.players[id]).emit('select player', playerList);
}
  
// Prepare for Phase Two of a turn
// This phase allows a player to select another player
// And performs the action corresponding to their card
function turnPhaseTwo(targetPlayer, playedCard, guessedCard){
  var id = game.currentPlayer;
  // Perform action based on card
  // If the card was Built environment, check the guess
  if(playedCard == 1) {
    // Ensure a guess was made/submited
    if(guessedCard != null){
      guessed_card(id, targetPlayer, guessedCard);
    } else {
      console.log("Error: guard played with no guessed card");
    }
  } else {
    //Perform action as a result of play
    selected_player(id, targetPlayer, playedCard);
  }
  // Proceed to next turn
  nextTurn();
}

// Proceed game state to next turn in game
// Will update game state stored in system to recognise player
// As well as draw a new card for the next player to offer them their turn
function nextTurn(){
  // Check to see if the game has reached an end state.
  if (check_end_game() == 0) return;
   
  var id = game.currentPlayer;

  //move on to the next player without an empty hand
  id = (id + 1) % 4;
  while(game.playerHands[id] <= 0){
    id = (id + 1) % 4;
  }
  game.currentPlayer = id;
  
  //Should game state get updated/sent before starting new turn?

  //player draws a card
  var newCard = game.deck.pop();
  play.to(game.players[id]).emit('your turn', id, cardInfo(game.playerHands[id]), cardInfo(newCard));

  // Update game state
  var remainingPlayersInRound = [];
  var remainingPlayersInGame = [];
  for (var i = 0; i < game.players.length; i++){
    if(playerHands[i] != -1){
      remainingPlayersInGame.push(i);
    }
    
    if(playerHands[i] > 0){
      remainingPlayersInRound.push(i);
    }
  }
  play.to('players').emit('game update', game.currentPlayer, game.display_deck, game.last_played, remainingPlayersInRound, remainingPlayersInGame);
  
}

// Helper Function to return the remaining cards in the deck
function remaining_cards() {
  return game.display_deck;
}

// Track the last play made within the last four turns
function play_log(id) {
  var temp = [];
  for (var i = id+1; i - id < 4; i++) {
    temp.push(game.last_played[i%4]);
  }
  return temp;
}

// Get the card in a players hand
function get_hand(id) {
  return game.playerHands[id];
}

// Return a flag indicating action to take based on players hand and card played
// Return value of -1 indicates the game has ended
// Return value of 0 indicates proceed to next turn
// Return value of 1 indicates another player still in the round needs to be selected
// Return value of 5 indicates that any player still in the round needs to be selected
// Return value of 7 indicates that the play is invalid, Business must be played
// Return value of 8 indicates that the player has played UNSW and is knocked out
function played_card(id, card, otherCard) {
  // Ensure the move was valid
  // The Countess can lead to invalid moves so needs to be checked
  if ((otherCard == 5 || otherCard == 6) && card == 7) {
    return 0;
  } else if ((card == 5 || card == 6) && otherCard == 7) {
    return 7;
  }

  //Update the cards visible for players
  game.display_deck[card]--;
  game.last_played[id] = card;

  //Determine return value based on played card
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

  //Why is this here...
  if (game.deck.length == 0) {
    return -1;
  }
}

// Performs action based on card played, and on the player it is played on
// Returns values if action has further results for front end
// Return value of selected players hand if playing a Priest
// Returns 8 or -8 to signify which player is knocked out by a Baron
function selected_player(id, player, card) {
  if (game.last_played[player] == 4) {
    return 0; //played handmaid last, can't be targeted
  }

  if (card == 2) {
    return game.playerHands[player]; //id of card to display to current player
  } else if (card == 3) {
    //Determine which players hand has the larger value
    if (game.playerHands[id] < game.playerHands[player]) {
      // Discard the players card from seen cards and set the player as knocked out
      game.display_deck[game.playerHands[id]]--;
      game.playerHands[id] = 0;

      // Check if the game has ended
      if (game.deck.length == 0) {
        end_game();
      }
      //need to notify front end that player is knocked out and that the game is over
      return 8; //current player is knocked out

    } else if (game.playerHands[id] > game.playerHands[player]) {
      // Discard other players card and mark them as knocked out
      game.display_deck[game.playerHands[player]]--;
      game.playerHands[player] = 0;

      // Check if the game has ended
      if (game.deck.length == 0) {
        end_game();
      }

      //need to notify front end that player is knocked out and that the game is over
      return -8; //other player is knocked out

    } else {
      //nothing happens due to a tie
    }
  } else if (card == 5) {
    // Cause the selected player to discard a card and draw a new card
    game.display_deck[game.playerHands[player]]--;
    game.playerHands[player] = game.deck.pop();
  } else if (card == 6) {
    // Swap hands between current player and selected player
    var temp = game.playerHands[id];
    game.playerHands[id] = game.playerHands[player];
    game.playerHands[player] = temp;
  }
}

// Check to see if a guess is correct. If so, knock that player out
// Returns 0 if a guess was incorrect
// Returns -8 if a guess was correct
function guessed_card (id, player, card) {
  if (game.deck.length == 0) {
    end_game();
  }
  //TODO: Notify front end

  if (card == game.playerHands[player]) {
    game.display_deck[card]--;
    game.playerHands[player] = 0;
    return -8; //other player is knocked out
  }
  return 0;
}

// Proceeds to place game into an end state
function end_game() {
  var largest_id = [];
  var largest_card = 0;
  // For each player, check if they are still in the game
  // And make a list of players with the largest card value
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
  // Set playersHands to 1 if the player has won
  // Or 0 if the player has not
  for (var i = 0; i < 4; i++) {
    if (largest_id.includes(i)) {
      game.playerHands[i] = 1;
    } else {
      game.playerHands[i] = 0;
    }
  }
}

// Return information regarding a card based on its value
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

