var Http = require('http'),
    EventEmitter = require('events').EventEmitter,
    io = require('socket.io'),
    paperboy = require('paperboy'),
    Session = require('./session'),
    inherits = require('util').inherits,
    WEBROOT = require('path').join(__dirname, '../front-end'),
    sessions = {},
    config = {},
    connectionTimeout,
    webPort;

function serveStaticFiles(req, res) {
  var re = /^\/debug/;
  if (re.test(req.url)) {
    config.debugPort = getDebuggerPort(req.url, config.debugPort);
    req.url = req.url.replace(re, '/');
  }
  paperboy.deliver(WEBROOT, req, res);
}

function getDebuggerPort(url, defaultPort) {
  return parseInt((/\?port=(\d+)/.exec(url) || [null, defaultPort])[1], 10);
}

function getSession(debuggerPort) {
  var session = sessions[debuggerPort];
  if (!session) {
    session = Session.create(debuggerPort, config);
    sessions[debuggerPort] = session;
    session.on('ws_closed', function () {
      connectionTimeout = setTimeout(function () {
        session.close();
      }, 3000);
    });
    session.on('close', function () {
      sessions[debuggerPort] = null;
    });
    session.attach();
  }
  return session;
}

function handleWebSocketConnection(socket) {
  clearTimeout(connectionTimeout);
  getSession(config.debugPort).join(socket);
}

function handleServerListening() {
  console.log(
    'visit http://0.0.0.0:' +
    config.webPort +
    '/debug?port=' + config.debugPort + ' to start debugging');
}

function DebugServer() {}

inherits(DebugServer, EventEmitter);

DebugServer.prototype.start = function(options) {
  config = options;
  var httpServer = Http.createServer(serveStaticFiles);
  var ws = io.listen(httpServer);
  ws.configure(function() {
    ws.set('transports', ['websocket']);
    ws.set('log level', 1);
  });
  ws.sockets.on('connection', handleWebSocketConnection);
  this.wsServer = ws;
  httpServer.on('listening', handleServerListening);
  httpServer.listen(config.webPort);
}

DebugServer.prototype.close = function() {
  if (this.wsServer) {
    this.wsServer.close();
    this.emit('close');
  }
}

exports.DebugServer = DebugServer;
