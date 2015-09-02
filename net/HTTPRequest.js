/**
 * Created by Jay on 2015/8/30.
 */

var TCPRequest = require("./TCPRequest");
var UTIL = require("util");

function HTTPRequest(req, res) {
    this.params = req.body.data;

    TCPRequest.apply(this, arguments);
    //req : express request
    this.client.ip = req.headers['x-forwarded-for'] ||
                     req.connection.remoteAddress ||
                     req.socket.remoteAddress ||
                     req.connection.socket.remoteAddress;

    var method = req.body.method.split(".");
    this.service = method[0];
    this.method = method[1];

    this.req = req;
    this.res = res;
}

UTIL.inherits(HTTPRequest, TCPRequest);

HTTPRequest.prototype.getType = function() {
    return "http";
}

HTTPRequest.prototype.sayOK = function(data) {
    this.res.json({code:1, data:data, msg:"OK"});
}

HTTPRequest.prototype.sayError = function(code, msg) {
    if (!msg) {
        msg = "unknown";
    } else if (typeof msg == 'object') {
        msg = msg.toString();
    }
    this.res.json({code:code, data:{}, msg:msg});
}

module.exports = HTTPRequest;