/**
 * Created by jay on 5/17/16.
 */

var Session = require("../model/Session");
var Redis = require("../model/Redis");

var DEBUG = global.VARS.debug;

var server;

var handlers = {};

var prefix = "";

var CONFIG = { port:80 };

function formatRedisKey(userID) {
    return Redis.join(`realtime_connections_${prefix}_${userID}`);
}

exports.init = function(config, httpServer) {
    config = config || CONFIG;
    CONFIG = config;

    /* setup server */
    var port = config.port;
    prefix = config.prefix || "";
    if (String(port).hasValue()) {
        var SocketIO = require('socket.io');
        if (port == "*" && httpServer) {
            server = SocketIO(httpServer);
            port = httpServer.address().port;
        } else if (!isNaN(Number(port))) {
            server = SocketIO();
            server.listen(port);
        }
        CONFIG.port = port;

        console.log("[Realtime] service is working on port: " + port);
    }
    if (server) server.on('connection', server_onClientConnected);
}
/* handler --> function(data, output, conn) { ... } */
exports.registerHandler = function(event, handler) {
    handlers[event] = handler;
}

exports.broadcast = function(users, event, data, cmd) {
    users = users || [];
    users.forEach(function(uid) {
        exports.notify(uid, event, data, cmd);
    });
}

exports.notify = function(userID, event, data, cmd) {
    //console.log("try to notify client --> " + userid);
    var key = formatRedisKey(userID);
    Redis.do("ZREVRANGE", [ key, 0, 0 ], function(socketIDs, err) {
        if (socketIDs && socketIDs.length > 0) {
            var socket = server.sockets.connected[socketIDs[0]];
            data = cloneObject(data);
            data._time = Date.now();
            if (socket) {
                //console.log("pull client sync data --> ", { type:event, params:data });
                socket.emit("sync", { type:event, params:data, cmd:cmd });
            }
            return;
        }

        if (err) console.error("[Realtime] Redis.zrange error when notify message --> " + err.toString());
    });
}

exports.kick = function(userID) {
    //console.log("try to notify client --> " + userid);
    var key = formatRedisKey(userID);
    Redis.do("ZRANGE", [ key, 0, -1 ], function(socketIDs, err) {
        if (socketIDs && socketIDs.length > 0) {
            socketIDs.forEach(function(socketID) {
                var socket = server.sockets.connected[socketID];
                if (socket) {
                    //console.log("let client offline.");
                    socket.emit("$kick", {  });

                    setTimeout(function() {
                        //close connection after few seconds
                        try { socket.close(); } catch (exp) { }
                        try { socket.disconnect(); } catch (exp) { }
                    }, 3000);
                }
            });
            return;
        }

        if (err) console.error("[Realtime] Redis.zrange error when notify message --> " + err.toString());
    });
}

function server_onClientConnected(socket) {

    var conn = socket.request.connection;

    socket.info = {
        id: socket.id,
        ip: conn.remoteAddress,
        port: conn.remotePort,
        connectTime: Date.now()
    };

    socket.on('$init', function (data) {
        var sess = data ? data._sess : null;
        if (!sess || !sess.userid || !sess.token || !sess.tokentimestamp) {
            try { socket.close(); } catch (exp) { }
            try { socket.disconnect(); } catch (exp) { }
            return;
        }

        Session.check(sess.userid, sess.token, function(flag, sess, err) {
            if (!err && flag == 1) {
                socket.info.userid = sess.userid;
                socket.info.token = sess.token;
                socket.info.tokentimestamp = sess.tokentimestamp;

                var key = formatRedisKey(sess.userid);

                var tasks = [];
                tasks.push([ "ZREMRANGEBYSCORE", key, sess.tokentimestamp, sess.tokentimestamp, function(err) {
                    if (err) console.error("[Realtime] Redis.zremrangebyscore error when init socket connection --> " + err.toString());
                } ]);
                tasks.push([ "ZADD", key, sess.tokentimestamp, socket.id, function(err) {
                    if (err) console.error("[Realtime] Redis.zadd error when init socket connection --> " + err.toString());
                } ]);
                if (CONFIG.useRoute) {
                    tasks.push([ "SADD", Redis.join(`conn_${sess.userid}`), CONFIG.routeAddress, function(err) {
                        if (err) console.error("[Realtime] Redis.sadd error when init socket connection --> " + err.toString());
                    } ]);
                }
                Redis.multi(tasks, function(flag) {
                    if (flag) {
                        socket.emit("$init", { msg:"hello", _time:Date.now() });
                        if (DEBUG) console.log("[Realtime] *client@" + socket.info.userid + "@" + socket.id + "* from " + socket.info.ip + ":" + socket.info.port + " has authority to sync.");
                    }
                });
            } else {
                //no auth to sync, close this client connection
                try { socket.close(); } catch (exp) { }
                try { socket.disconnect(); } catch (exp) { }
            }
        });
    });

    socket.on('sync', function (data) {
        var sess = data ? data._sess : null;
        if (!sess || !sess.userid || !sess.token || !sess.tokentimestamp) {
            //no auth to sync, close this client connection
            socket.close();
            return;
        }

        if (this.info.userid) {
            var type = data.type;

            //if (DEBUG) console.log("[Realtime] *client@" + sess.userid + "* from " + socket.info.ip + ":" + socket.info.port + " request sync --> " + data.type);

            var handler = handlers[type];
            if (handler) {
                handler(data.params, function(err, result) {
                    if (err) console.error("[Realtime] proxy handles sync@" + type + " error --> " + err.toString());
                    else {
                        socket.emit("sync", { type:type, params:result, _time:Date.now() });
                    }
                }, sess, socket.info);
            }
        } else {
            //no auth to sync, close this client connection
            try { socket.close(); } catch (exp) { }
            try { socket.disconnect(); } catch (exp) { }
        }
    });

    socket.on('disconnect', function () {
        if (this.info) {
            if (this.info.userid) {
                var key = formatRedisKey(this.info.userid);
                Redis.do("ZREM", [ key, socket.id ]);
                if (CONFIG.useRoute) {
                    Redis.do("SREM", [ Redis.join(`conn_${this.info.userid}`), CONFIG.routeAddress ]);
                }
            }
            console.log("[Realtime] *client@" + this.info.userid + "@" + this.info.token + "* disconnected....");
            delete this.info["userid"];
            delete this.info["token"];
            delete this.info["tokentimestamp"];
        }
    });
}