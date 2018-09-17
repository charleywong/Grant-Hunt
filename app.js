var express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var play = io.of('/play');

var usercount = 0;



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
  
  //update the page to show how many users are connected
  play.emit('update', usercount);
  
  socket.on('disconnect', function(){
  	//on disconnect, decrement the user count and update
  	usercount--;
    play.emit('update', usercount);
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});