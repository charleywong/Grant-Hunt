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
    // Ensure the move was valid
    // The Countess can lead to invalid moves so needs to be checked
    if ((otherCard == 5 || otherCard == 6) && card == 7) {
      return {game: game, output: 0};
    } else if ((card == 5 || card == 6) && otherCard == 7) {
      return {game: game, output: 7};
    }

    //Update the cards visible for players
    game.display_deck[card]--;
    game.last_played[id] = card;

    //Determine return value based on played card
    if (card == 1 | card == 2 | card == 3 | card == 6) {
      return {game: game, output: 1};//indicator that prompt to select ANOTHER player should be displayed
    } else if (card == 5) {
      return {game: game, output: 5};//prompt to display all players including yourself
    } else if (card == 8) {
      game.playerHands[id] = 0;
      check_end_game(game);
      return {game: game, output: 8}; //player is knocked out
    } else {
      check_end_game(game);
      return {game: game, output: 0}; //no additional prompts
    }

    //Why is this here...
    /*if (game.deck.length == 0) {
      return -1;
    }*/
  },




  // Performs action based on card played, and on the player it is played on
  // Returns values if action has further results for front end
  // Return value of selected players hand if playing a Priest
  // Returns 8 or -8 to signify which player is knocked out by a Baron
  selected_player: function(game, id, player, card) {
    if (game.last_played[player] == 4) {
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
  },


  // Check to see if a guess is correct. If so, knock that player out
  // Returns 0 if a guess was incorrect
  // Returns -8 if a guess was correct
  guessed_card: function(game, id, player, card) {
    //TODO: Notify front end
    if (card == game.playerHands[player]) {
      return{game: game, output: -8}; //other player is knocked out
    }
    return {game: game, output: 0};
  },

  // Proceeds to place game into an end state
  end_game: function(game) {
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
  },

  //returns true if there are at least 2 players remaining, otherwise returns false and sets the winner using playerHands
  remaining_players: function(game) {
    var flag = false;
    var id = -1;
    for (var i = 0; i < 4; i++) {
      if (game.playerHands[i] != 0) {
        id = i;
        if (flag) return {game:game, output: true};
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
    return {game:game, output: false};
  },

  //checks the state of the game to see if it has reached an end state or not
  check_end_game: function(game) {
    if (game.deck.length == 0) {
      end_game(game);
      return {game:game, output: false};//deck is empty
    }

    return {game: game, output: remaining_players(game)};
  }
}

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
    if(card == 4){
      game.immune.push(id);
    }
    return 0; //no additional prompts
  }

  //Why is this here...
  /*if (game.deck.length == 0) {
    return -1;
  }*/
};

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
      return 1;
    }
  } else if (card == 5) {
    // Cause the selected player to discard a card and draw a new card
    var c = game.playerHands[player];
    game.display_deck[c]--;
    if(c != 8){
      game.playerHands[player] = game.deck.pop();
    } else {
      //if UNSW is discarded they are out
      game.playerHands[player] = 0;
    }
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

//returns true if there are at least 2 players remaining, otherwise returns false and sets the winner using playerHands
function remaining_players(game) {
  var flag = false;
    var id = -1;
    for (var i = 0; i < 4; i++) {
      if (game.playerHands[i] != 0) {
        id = i;
        if (flag) return {game:game, output: true};
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
    return {game:game, output: false};
}
//checks the state of the game to see if it has reached an end state or not
function check_end_game(game) {
  if (game.deck.length == 0) {
    end_game();
     return {game:game, output: false};//deck is empty
  }

  return {game: game, output: remaining_players(game)}
}