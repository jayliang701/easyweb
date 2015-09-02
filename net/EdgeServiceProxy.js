/**
 * Created by Jay on 2015/8/30.
 */

var server = require("./SocketServer");
var SocketRequest = require("./SocketRequest");

var Agent;

var proxys = {};
var clientMap = {};

exports.start = function(agent, options, callBack) {
    Agent = agent;
    server.start(options.ip, options.port, callBack);
    server.onPush(onPush);
}

exports.send = function(proxyName, data) {
    var cid = proxys[proxyName];
    if (cid) {
        server.send(cid, data);
    } else {
        console.error("[Edge] <" + proxyName + "> is not connected.");
    }
}

function onPush(client, packetID, packetData) {
    var cid = client.getUID();
    var method = packetData[0];
    var data = packetData[1];

    if (!method || !data) {
        console.error("[Edge] handle push data error ==> " + arguments);
        return;
    }

    if (method == "$init") {
        var proxyName = data.name;
        proxys[proxyName] = cid;
        clientMap[cid] = proxyName;
        client.response(packetID, { code:1, msg:"", data:{ flag:1, message:"Hello, " + proxyName } });

        console.log("[Edge] <" + proxyName + "> from " + client.getSocket().remoteAddress + ":" + client.getSocket().remotePort + " is connected...");
    } else {
        var sq = new SocketRequest(client, packetID, packetData);
        Agent.process(sq);
    }
}