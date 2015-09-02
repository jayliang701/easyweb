/**
 * Created by Jay on 2015/8/30.
 */

var TCPRequest = require("./TCPRequest");
var UTIL = require("util");

function SocketRequest(socketClient, packetID, packetData) {
    this.params = packetData[1];

    TCPRequest.apply(this, arguments);
    //req : express request
    this.client.ip = socketClient.getSocket().remoteAddress;

    var method = packetData[0];
    method = method ? method.split(".") : [ null, null ];
    this.service = method[0];
    this.method = method[1];

    this.socketClient = socketClient;
    this.packetID = packetID;
}

UTIL.inherits(SocketRequest, TCPRequest);

SocketRequest.prototype.getType = function() {
    return "socket";
}

SocketRequest.prototype.sayOK = function(data) {
    this.socketClient.response(this.packetID, {code:1, data:data, msg:"OK"});
}

SocketRequest.prototype.sayError = function(code, msg) {
    if (!msg) {
        msg = "unknown";
    } else if (typeof msg == 'object') {
        msg = msg.toString();
    }
    this.socketClient.response(this.packetID, {code:code, data:{}, msg:msg});
}

module.exports = SocketRequest;