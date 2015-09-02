/**
 * Created by Jay on 2015/8/30.
 */

var UTIL = require("util");

function TCPRequest() {
    TCPRequest.prototype.instance = this;

    this.client = {};
    this.params = this.params ? this.params : {};
    this.service = null;
    this.method = null;
}

TCPRequest.prototype.getClientIP = function() {
    return this.client ? this.client.ip : "unknown";
}

TCPRequest.prototype.getType = function() {
    return "tcp/ip";
}

TCPRequest.prototype.sayOK = function(data) {

}

TCPRequest.prototype.sayError = function(code, msg) {

}

module.exports = TCPRequest;


