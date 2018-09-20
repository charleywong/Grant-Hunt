var express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var play = io.of('/play');

var usercount = 0;


//keeps track of current running game
var game = { players: [], running: false, currentPlayer: 0 };

function startGame(){
	game.running  = true;
	play.to('players').emit('start game');
	play.to(game.players[0]).emit('your turn', game.currentPlayer);
	console.log("New game started. It is player 0's turn. SocketID: " + game.players[0]);
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
  
  socket.on('end turn', function(){
  	console.log("End turn request coming from socketID: " + socket.id);
    game.currentPlayer = (game.currentPlayer + 1) % 4;
    play.to(game.players[game.currentPlayer]).emit('your turn', game.currentPlayer);
    console.log("It is now player " + game.currentPlayer + "'s turn. socketID: " + game.players[game.currentPlayer]);
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});