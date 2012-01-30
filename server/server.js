global.include = require('include').include;
include('./utilsServer.js');

var http = require('http')
, url = require('url')
, fs = require('fs')
, app;

app = http.createServer(function(req, res){
  // your normal app code
  var path = url.parse(req.url).pathname;
  switch (path){
  case '/':
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<h1>Hello! Try the <a href="/client.html">Socket.io Test</a></h1>');
    res.end();
  break;
  case '/client.html':
    fs.readFile(__dirname + path, function(err, data){
      if (err) return send404(res);
      res.writeHead(200, {'Content-Type': path == 'json.js' ? 'text/javascript' : 'text/html'})
      res.write(data, 'utf8');
      res.end();
    });
  break;

  default: send404(res);
  }
}),

send404 = function(res){
  res.writeHead(404);
  res.write('404');
  res.end();
};

app.listen(8080);

var io = require('socket.io').listen(app);
// using var Protocol
//var Protocol = new Protocol();
var sab = new SaboteurServer(io);

//sab.setupGame();
io.sockets.on('connection', function(socket){
    console.log("Connection " + socket.id + " accepted.");
    var event = Protocol.createEvent('setup', 'client', 'custom', {
      playerID : socket.id
    });
    socket.emit('setup', event.data);
    
    this.disconnect = function(data) {
      console.log("Connection " + socket.id + " terminated.");
    };
    
    // CUSTOM HANDLERS
    this.handlers = U.extend({}, Protocol.events.server.custom);
    
    // TODO: hacks for testing    
    this.handlers.startGame.callback = function(data) {
      sab.setupGame();
      console.log('Starting game!');
      sab.broadcastStartGame();
    };
    
    // TODO: hacks for testing
    this.handlers.setup.callback = function(data) {
      console.log('Got a setup event');
      console.log('*** IN SETUP',data);
      // TODO: might use a class, mb?
      var playerID = data.playerID
      sab.playerList[playerID] = {};
      sab.playerList[playerID].name = data.name;
      sab.playerList[playerID].socket = socket;
    };
    
    this.handlers.chat.callback = function(data) {
      console.log('Chat message from: ' + socket.id);
      console.log(data);
      io.sockets.json.emit('chat', data);
    };
    
    this.handlers.discard.callback = function(data) {
      console.log('Got a discard event...');
      sab.handleDiscard(data)
    };
    
    this.handlers.targetPublicPerson.callback = function(data) {
      console.log('Got a targetPublicPerson event...' + data);
      sab.handleTargetPublicPerson(data);
    };
    
    this.handlers.targetPrivatePerson.callback = function(data) {
      console.log('Got a targetPrivatePerson event...' + data);
      sab.handleTargetPrivatePerson(data);
    };
    
    this.handlers.targetMap.callback = function(data) {
      console.log('Got a targetMap event...' + data);
      sab.handleTargetMap(data);
    };
    
    this.handlers.heal.callback = function(data) {
      console.log('Got a heal event...' + data);
      sab.handleHeal(data);
    };
    
    //TODO: hack...
    var fun = function(handler) {
      return function(data) {
        console.log('WTF!!!', handler, data);
        if (handler.name != data._name) {
          throw new Error('Invalid datatype ' + data._name + ' for event ' + handler.name);
        } else {
          console.log('handling event:',handler.name);
          console.log(data);
          return handler.callback.call(this, data);
        };
      };
    };
      
    for (var h in this.handlers) {
      var handler = this.handlers[h]
      socket.on(handler.name, fun(handler));
    }
});
