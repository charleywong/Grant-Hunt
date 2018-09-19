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


//keeps track of current running game
var game = { players: [], playerhands: [], currentPlayer: 0, deck: deck};

function startGame(){
  var i = 0;
  //shuffle the deck
  game.deck = newDeck();
  //every player draws one card
  while(i < game.players.length){
    var card = game.deck.pop;
    game.playerhands[i] = [card];
    play.to(game.players[i]).emit('start game', card);
  }
  //draw a card for player 0
  var newCard = game.deck.pop;
  play.to(game.players[0]).emit('your turn', game.currentPlayer, newCard);
  console.log("New game started. It is player 0's turn. SocketID: " + game.players[0]);
}

function shuffle(deck){
  var currIndex = array.length;
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
  if(game.players.length < 4){
  	game.players.push(socket.id);
  	socket.join('players');
  	if(game.players.length == 4){
  	  startGame();
  	} else {
  	  play.to('players').emit('player update', 4 - usercount);
  	}
  } else {
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
  
  socket.on('play card', function(card){
  	//remove that card from the players hand
    var index = game.playerhands[game.currentPlayer].indexOf(card);
    game.players.splice(index, 1);
    
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