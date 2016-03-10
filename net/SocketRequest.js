/**
 * Created by Jay on 2015/8/30.
 */

var TCPRequest = require("./TCPRequest");
var UTIL = require("util");

function SocketRequest(socketClient, reqID, method, data) {
    this.params = data;

    TCPRequest.apply(this, arguments);
    //req : express request
    this.client.info = socketClient.info;
    this.client.ip = socketClient.info.ip;

    method = method ? method.split(".") : [ null, null ];
    this.service = method[0];
    this.method = method[1];

    this.socketClient = socketClient;
    this.reqID = reqID;
}

UTIL.inherits(SocketRequest, TCPRequest);

SocketRequest.prototype.getType = function() {
    return "socket";
}

SocketRequest.prototype.sayOK = function(data) {
    if (arguments.length == 0) data = { flag:1 };
    //socket.callAPIResponse = function(msgID, data, code, msg)
    this.socketClient.callAPIResponse(this.reqID, {code:1, data:data, msg:"OK"});
}

SocketRequest.prototype.sayError = function(code, msg) {
    if (!msg) {
        msg = "unknown";
    } else if (typeof msg == 'object') {
        msg = msg.toString();
    }
    console.fail(code, msg);
    this.socketClient.callAPIResponse(this.reqID, {code:code, data:{}, msg:msg});
}

module.exports = SocketRequest;