var NET = require("net");
var FS = require("fs");
var PATH = require("path");

var SocketClient = require("./SocketClient");

var server;
var onClientConnectHandler;
var onPushHandler;

var clients = {};

function getClient(id) {
    return clients[id];
}

function onConnected(socket) {

    var ip = socket.remoteAddress;
    var port = socket.remotePort;

    var uid = ip + ":" + port;
    var c;
    if (clients.hasOwnProperty(uid) && clients[uid] != undefined && clients[uid] != null) {
        c = clients[uid];
    } else {
        c = new SocketClient(socket);
        clients[uid] = c;
        console.log("A client connected ==> " + c.getUID());
        c.listen("close", onClientClosed);
        c.listen("error", onClientError);
        c.listen("push", onClientPush);
        c.work();

        if (onClientConnectHandler) onClientConnectHandler(c);
    }
}

function onClientClosed(client, hadError) {
    console.log("Client closed ==> hadError: " + hadError);
    delete clients[client.getUID()];
    client.dispose();
}

function onClientError(client, err) {
    console.log("Client error ==> " + err.toString());
    delete clients[client.getUID()];
    client.dispose();
}

function onClientPush(client, packetID, packetData) {
    if (onPushHandler) onPushHandler(client, packetID, packetData);
}

function onError(err) {
    console.error("SocketServer error ==> " + err.toString());
}

exports.start = function(ip, port, callBack) {

    server = NET.createServer();
    server.on("error", onError);
    server.on("connection", onConnected);
    server.listen(port, ip);

    console.log("SocketServer is running on ==> " + ip + ":" + port);
    if (callBack) callBack();
};

exports.onClientConnect = function(handler) {
    onClientConnectHandler = handler;
};

exports.onPush = function(handler) {
    onPushHandler = handler;
};

exports.send = function(clientID, data) {
    var c = clients[clientID];
    if (!c) {
        console.error("not such client to send ==> client id: " + clientID);
        return;
    }
    c.send(data);
}