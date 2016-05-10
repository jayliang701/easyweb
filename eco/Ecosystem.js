/**
 * Created by Jay on 2016/5/10.
 */

var Utils = require("./../utils/Utils");
var CODES = require("./../ErrorCodes");
var request = require("min-request");

var agent;

var Setting = global.SETTING;
var DEBUG = global.VARS.debug;

var server;
var server_notifyHandlers = {};

var _globalInstance = {
    __register : function(target, client) {
        var Payload = function(name, client) {
            var ins = this;
            this.client = client;
            this.name = name;
            this.callAPI = function(method, params, callBack) {
                Ecosystem.__callAPI(ins.name, method, params, callBack);
            }
            this.fire = ins.client.fire;
            this.listen = ins.client.listen;
            this.unListen = ins.client.unListen;
        }
        if (DEBUG) console.log("[Ecosystem] register *" + target + "*");
        Ecosystem[target] = new Payload(target, client);
    },
    __callAPI : function(target, method, params, callBack) {
        if (DEBUG) console.log("[Ecosystem] call *" + target + "* api --> " + method);
        var URL = Setting.ecosystem.servers[target].api;
        request(URL,
            {
                method: "POST",
                body: { method:method, data:params }
            },
            function(err, res, body) {
                if (DEBUG) console.log("[Ecosystem] *" + target + "* response --> ");
                if (err) {
                    console.error(err);
                    if (callBack) callBack(Error.create(CODES.CORE_SERVICE_ERROR, err.toString()));
                } else {
                    if (DEBUG) console.log(body);

                    if (typeof body == "string") {
                        try {
                            body = JSON.parse(body);
                        } catch (exp) {
                            err = Error.create(CODES.CORE_SERVICE_ERROR, exp.toString());
                            body = null;
                        }
                    }

                    if (!err && body.code > 1) {
                        //error response
                        err = Error.create(body.code, body.msg);
                        body = null;
                    } else {
                        body = body ? body.data : null;
                    }

                    if (callBack) callBack(err, body);
                }
            });
    }
}

global.__defineGetter__('Ecosystem', function() {
    return _globalInstance;
});

var Client = function(name) {
    var ins = this;
    this.socketID = null;
    this.socket = null;
    this.isWorking = false;
    this.name = name;
    this.notifyHandlers = {};

    this.connect = function(serverName, host) {
        ins.serverName = serverName;
        var socket = require('socket.io-client').connect("http://" + host, { reconnect: true });

        socket.on('connect', function() {
            ins.socketID = socket.id;
            socket.emit("$init", { name:ins.name });
        });

        socket.on('disconnect', function() {
            ins.isWorking = false;
        });

        socket.on('$init', function(data) {
            console.log("[Ecosystem] -> " + data.message);
            ins.isWorking = true;
        });

        socket.on('notify', function(data) {
            console.log("[Ecosystem] -> (notify) " + data.event + " : " + (data.data ? JSON.stringify(data.data) : {}));

            var list = ins.notifyHandlers[data.event];
            if (!list) return;
            list.forEach(function(handler) {
                if (handler) handler(data.data);
            });
        });

        Client.clients[serverName] = ins;

        Ecosystem.__register(serverName, ins);

        ins.socket = socket;
    }

    this.fire = function(event, data) {
        if (ins.socket) ins.socket.emit("notify", { event:event, data:data } );
    }

    this.listen = function(event, handler) {
        var list = ins.notifyHandlers[event];
        if (!list) {
            list = [];
            ins.notifyHandlers[event] = list;
        }
        if (list.indexOf(handler) >= 0) return;
        list.push(handler);
    }

    this.unListen = function(event, handler) {
        var list = ins.notifyHandlers[event];
        if (!list)  return;

        var index = list.indexOf(handler);
        if (index >= 0) list.splice(index, 1);
    }
}

Client.clients = {};

exports.init = function(config) {
    config = config || {};
    agent = config.agent;

    /* setup server */
    var host = Setting.ecosystem.host;
    var SocketIO = require('socket.io');
    if (host == "*" && config.httpServer) {
        server = SocketIO(config.httpServer);
        console.log("[Ecosystem] server is working on port: " + config.httpServer.address().port);
    } else if (!isNaN(Number(host))) {
        server = SocketIO();
        server.listen(host);
        console.log("[Ecosystem] server is working on port: " + host);
    }

    if (server) server.on('connection', server_onClientConnected);

    /* setup client */
    var servers = Setting.ecosystem.servers;
    for (var name in servers) {
        var client = new Client(Setting.ecosystem.name);
        var def = servers[name];
        client.connect(name, def.socket);
    }
}

function server_onClientConnected(socket) {

    var uid = socket.id;
    var conn = socket.request.connection;

    //if (DEBUG) console.log("[Ecosystem] New client[" + uid + "] is connected from " + conn.remoteAddress + ":" + conn.remotePort);

    socket.info = {
        id: socket.id,
        ip: conn.remoteAddress,
        port: conn.remotePort,
        connectTime: Date.now()
    };

    socket.callAPIResponse = function(reqID, data, code, msg) {
        socket.emit("$callAPIResponse", { __rpid:reqID, data:data, code:code, msg:msg });
    }

    socket.on('$init', function (data) {
        this.info.name = data.name;
        this.emit("$init", { message:"Welcome to connect *" + Setting.ecosystem.name + "*. Now is " + new Date().toString() });

        if (DEBUG) console.log("[Ecosystem] *" + this.info.name + "* from " + this.info.ip + ":" + this.info.port + " is connected...");
    });

    socket.on('notify', function (data) {
        console.log("[Ecosystem] -> (*notify) " + data.event + " : " + (data.data ? JSON.stringify(data.data) : {}));

        var list = server_notifyHandlers[this.info.name + "@" + data.event];
        if (!list) return;
        list.forEach(function(handler) {
            if (handler) handler(data.data);
        });
    });

    socket.on('disconnect', function () {
        console.log("[Ecosystem] client<" + this.info.name + "> disconnected....");
    });
}

exports.broadcast = function(event, data) {
    if (!server || !server.sockets || !server.sockets.connected) return;

    if (DEBUG) console.log("[Ecosystem] broadcast message --> " + event + " : " + (data ? JSON.stringify(data) : {}));
    var sockets = server.sockets.connected;
    if (event.indexOf("@") > 0) {
        event = event.split("@");
        var target = event[0];
        event = event[1];
        if (sockets[target]) sockets[target].emit("notify", { event:event, data:data });
    } else {
        for (var id in sockets) {
            sockets[id].emit("notify", { event:event, data:data });
        }
    }
}

exports.listen = function(target, event, handler) {
    var key = target + "@" + event;
    var list = server_notifyHandlers[key];
    if (!list) {
        list = [];
        server_notifyHandlers[key] = list;
    }
    if (list.indexOf(handler) >= 0) return;
    list.push(handler);
}

exports.unListen = function(target, event, handler) {
    var key = target + "@" + event;
    var list = server_notifyHandlers[key];
    if (!list)  return;

    var index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
}