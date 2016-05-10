/**
 * Created by Jay on 2015/8/30.
 */

var server;
var SocketRequest = require("./../net/SocketRequest");

var Agent;

var DEBUG = global.VARS.debug;

exports.start = function(agent, options, callBack, httpServer) {
    Agent = agent;

    var SocketIO = require('socket.io');
    if (httpServer) {
        server = SocketIO(httpServer);
        console.log("EdgeServiceProxy is working on port: " + httpServer.address().port);
    } else {
        server = SocketIO();
        server.listen(options.port);
        console.log("EdgeServiceProxy is working on port: " + options.port);
    }

    server.on('connection', onClientConnected);

    if (callBack) process.nextTick(callBack);
}

function onClientConnected(socket) {

    var uid = socket.id;
    var conn = socket.request.connection;

    if (DEBUG) console.log("New client[" + uid + "] from " + conn.remoteAddress + ":" + conn.remotePort);

    socket.info = {
        id: socket.id,
        ip: conn.remoteAddress,
        port: conn.remotePort,
        connectTime: Date.now()
    };

    socket.callAPIResponse = function(reqID, data, code, msg) {
        this.emit("$callAPIResponse", { __rpid:reqID, data:data, code:code, msg:msg });
    }

    socket.on('$init', function (data) {
        this.info.name = data.name;
        this.emit("$init", { message:"Welcome <" + data.name + "> to connect Core Server. Now is " + new Date().toString() });

        if (DEBUG) console.log("[Edge] <" + this.info.name + "> from " + this.info.ip + ":" + this.info.port + " is connected...");
    });

    socket.on('$callAPI', function (data) {
        if (DEBUG) {
            console.log("[Edge] proxy server request to callAPI ---> ");
            console.log("[Edge] reqID: " + data.reqID);
            console.log("[Edge] method: " + data.method);
            console.log("[Edge] data: " + JSON.stringify(data.data));
        }

        Agent.process(new SocketRequest(this, data.reqID, data.method, data.data));
    });

    socket.on('disconnect', function () {
        console.log("[Edge] proxy<" + this.info.name + "> disconnected....");
    });
}

exports.send = function(proxyName, data) {
    var cid = proxys[proxyName];
    if (cid) {
        server.send(cid, data);
    } else {
        console.error("[Edge] <" + proxyName + "> is not connected.");
    }
}