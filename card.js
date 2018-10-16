module.exports = {
  cardInfo: function(cardID) {
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
};