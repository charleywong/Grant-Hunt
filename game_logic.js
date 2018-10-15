// Return a flag indicating action to take based on players hand and card played
// Return value of -1 indicates the game has ended
// Return value of 0 indicates proceed to next turn
// Return value of 1 indicates another player still in the round needs to be selected
// Return value of 5 indicates that any player still in the round needs to be selected
// Return value of 7 indicates that the play is invalid, Business must be played
// Return value of 8 indicates that the player has played UNSW and is knocked out

module.exports = {
  // Return a flag indicating action to take based on players hand and card played
  // Return value of -1 indicates the game has ended
  // Return value of 0 indicates proceed to next turn
  // Return value of 1 indicates another player still in the round needs to be selected
  // Return value of 5 indicates that any player still in the round needs to be selected
  // Return value of 7 indicates that the play is invalid, Business must be played
  // Return value of 8 indicates that the player has played UNSW and is knocked out
  played_card: function(game, id, card, otherCard) {
    return played_card(game, id, card, otherCard);
  },

  // Performs action based on card played, and on the player it is played on
  // Returns values if action has further results for front end
  // Return value of selected players hand if playing a Priest
  // Returns 8 or -8 to signify which player is knocked out by a Baron
  selected_player: function(game, id, player, card) {
    return selected_player(game, id, player, card);
  },

  // Check to see if a guess is correct. If so, knock that player out
  // Returns 0 if a guess was incorrect
  // Returns -8 if a guess was correct
  guessed_card: function(game, id, player, card) {
    return guessed_card(game, id, player, card);
  },

  // Proceeds to place game into an end state
  end_game: function(game) {
    return end_game(game);
  },

  //checks the state of the game to see if it has reached an end state or not
  check_end_game: function(game) {
    return check_end_game(game);
  }
}

function played_card(game, id, card, otherCard) {
  // Ensure the move was valid
  // The Countess can lead to invalid moves so needs to be checked
  if ((otherCard == 5 || otherCard == 6) && card == 7) {
    return {game: game, output: 0};
  } else if ((card == 5 || card == 6) && otherCard == 7) {
    return {game: game, output: 7};
  }
  //Update the cards visible for players
  game.display_deck[card]--;
  //Determine return value based on played card
  if (card == 1 | card == 2 | card == 3 | card == 6) {
    return {game: game, output: 1};//indicator that prompt to select ANOTHER player should be displayed
  } else if (card == 5) {
    return {game: game, output: 5};//prompt to display all players including yourself
  } else if (card == 8) {
    game.playerHands[id] = 0;
    return {game: game, output: 8}; //player is knocked out
  } else {
    if(card == 4){
      game.immune.push(id);
    }
    return {game: game, output: 0}; //no additional prompts
  }
};

// Performs action based on card played, and on the player it is played on
// Returns values if action has further results for front end
// Return value of selected players hand if playing a Priest
// Returns 8 or -8 to signify which player is knocked out by a Baron
function selected_player(game, id, player, card) {
  if (game.immune.includes(player)) {
    return {game:game, output: 0}; //played handmaid last, can't be targeted
  }

  if (card == 2) {
    return {game: game, output: game.playerHands[player]}; //id of card to display to current player
  } else if (card == 3) {
  //Determine which players hand has the larger value
  if (game.playerHands[id] < game.playerHands[player]) {
    return {game: game, output: 8}; //current player is knocked out
  } else if (game.playerHands[id] > game.playerHands[player]) {
    return {game: game, output: -8}; //other player is knocked out
  } else {
    //nothing happens due to a tie
    return {game: game, output: 1};
    }
  } else if (card == 5) {
    // Cause the selected player to discard a card and draw a new card
    var c = game.playerHands[player];
    if(c != 8){
      game.display_deck[c]--;
      game.playerHands[player] = game.deck.pop();
      return {game: game, output: game.playerHands[player]};
    } else {
      return {game: game, output: 8};
    }
  } else if (card == 6) {
    // Swap hands between current player and selected player
    var temp = game.playerHands[id];
    game.playerHands[id] = game.playerHands[player];
    game.playerHands[player] = temp;
    return {game: game, output: 6};
  }
}

// Check to see if a guess is correct. If so, knock that player out
// Returns 0 if a guess was incorrect
// Returns -8 if a guess was correct
function guessed_card (game, id, player, card) {
  if (card == game.playerHands[player]) {
      return{game: game, output: -8}; //other player is knocked out
    }
    return {game: game, output: 0};
}

// Proceeds to place game into an end state
function end_game(game) {
  console.log("GAME HAS ENDED.");
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
  return {game:game};
}

//checks the state of the game to see if it has reached an end state or not
function check_end_game(game) {
  if (game.deck.length == 0) {
      var result = end_game(game);
      game = result.game;
      return {game:game, output: false};//deck is empty
    }
    var playerCount = 0;
    for(var i = 0; i < game.playerHands.length; i++){
      if(game.playerHands[i] != 0){
        playerCount++;
      }
    }
    if(playerCount <= 1){
      var result = end_game(game);
      game = result.game;
      return {game: game, output: false};
    }

    return {game: game, output: true};
}