/**
 * Created by Jay on 2015/8/30.
 */
var SocketPacket = require("./SocketPacket");
var Events = require("events");

var NET = require("net");

var SocketConnector = function(ip, port, options) {
    this.__socket = new NET.Socket();
    this.__ip = ip;
    this.__port = port;
    this.__options = options;
    new SocketPacket(this.__socket);
    this.__isConnected = false;
    this.__timer = 0;

    var instance = this;

    this.__socket.on("connect", function() {
        instance.__onConnect.apply(instance, arguments);
    });
    this.__socket.on("push", function() {
        instance.__onPush.apply(instance, arguments);
    });
    this.__socket.on("error", function() {
        instance.__onError.apply(instance, arguments);
    });
    this.__socket.on("close", function() {
        instance.__onDisconnect.apply(instance, arguments);
    });

    Events.EventEmitter.call(this);
}

SocketConnector.prototype.__proto__ = Events.EventEmitter.prototype;

SocketConnector.prototype.isConnected = function() {
    return this.__isConnected;
}

SocketConnector.prototype.connect = function(callBack) {
    this.__connect(callBack);
}

SocketConnector.prototype.__onConnect = function() {
    console.log("socket connected ----> ");
    this.__isConnected = true;
    this.emit("connect");
    if (this.__connectCallBack) {
        this.__connectCallBack();
        this.__connectCallBack = null;
    }
}

SocketConnector.prototype.__onPush = function(data, err) {
    console.log("server push data...");
    if (err) console.error(err.toString());
    this.emit("push", data, err);
}

SocketConnector.prototype.__onError = function(err) {
    console.log("socket error ----> " + err.toString());
    this.emit("error", err);
}

SocketConnector.prototype.__onDisconnect = function() {
    console.log("socket disconnected ----> ");
    this.__isConnected = false;
    this.emit("disconnect");
    this.__retry();
}

SocketConnector.prototype.close = function() {
    if (!this.__socket) return;

    if (this.__socket.__packet) {
        this.__socket.__packet.dispose();
    }
    this.__socket.end();
}

SocketConnector.prototype.send = function(data, callBack) {
    this.__socket.send(data, callBack);
}

SocketConnector.prototype.__retry = function() {
    console.log("retry to connect core service...");
    var instance = this;
    clearTimeout(instance.__timer);
    instance.__timer = setTimeout(function() {
        instance.__connect.apply(instance, []);
    }, instance.__options.retry > 0 ? instance.__options.retry : 10000);
}

SocketConnector.prototype.__connect = function(callBack) {
    var ip = this.__ip;
    var port = this.__port;
    var instance = this;
    instance.__connectCallBack = callBack;
    instance.__socket.connect(port, ip);
}

module.exports = SocketConnector;