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
    return 5;
  } else if (card == 6) {
    var temp = game.playerHands[id];
    game.playerHands[id] = game.playerHands[player];
    game.playerHands[player] = temp;
    return 5;
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
    return false;//deck is empty
  }

  return remaining_players();
}