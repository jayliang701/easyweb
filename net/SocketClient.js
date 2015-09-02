var socket;

var uid;

function SocketClient(s) {

    instance = this;

    var SocketPacket = require("./SocketPacket");
    new SocketPacket(s);

    socket = s;
    socket.setEncoding('utf8');

    var ip = socket.remoteAddress;
    var port = socket.remotePort;

    uid = ip + ":" + port;
}

var CLASS = SocketClient.prototype;

CLASS.getUID = function() {
    return uid;
}

CLASS.getSocket = function() {
    return socket;
}

CLASS.getBufferSize = function() {
    return bufferSize;
}

CLASS.work = function() {
    socket.on('close', function(hadError) {
        if (onClose) {
            onClose(instance, hadError);
        }
    });
    socket.on('push', function(packetID, packetData) {
        console.log("get a packet from client...");
        if (onPush) {
            onPush(instance, packetID, packetData);
        }
    });
    socket.on('error', function(err) {
        if (onError) {
            onError(instance, err);
        }
    });
}

CLASS.send = function(data) {
    var code = arguments.length > 1 ? arguments[1] : 2;
    var msg = arguments[2] ? arguments[2] : "";
    socket.send([ code, msg, data ]);
};

CLASS.response = function(packetID, data) {
    if (!data) data = {};
    data.__rpid = packetID;
    this.send(data, 1, "");
}

var onClose = null;
var onData = null;
var onDrain = null;
var onError = null;
var onPush = null;

var instance;

CLASS.listen = function(event, func) {
    switch (event) {
        case "close":
            onClose = func;
            break;
        case "data":
            onData = func;
            break;
        case "drain":
            onDrain = func;
            break;
        case "error":
            onError = func;
            break;
        case "push":
            onPush = func;
            break;
    }
}

CLASS.dispose = function() {
    onClose = null;
    onData = null;
    onDrain = null;
    onError = null;
    onPush = null;

    instance = null;

    if (socket.__packet) {
        socket.__packet.dispose();
        socket.__packet = null;
    }

    if (socket) {
        socket.destroy();
        socket = null;
    }
}

module.exports = SocketClient;