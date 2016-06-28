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
var client_registerHandler = {};

exports.onServeReady = function(target, handler) {
    if (!client_registerHandler[target]) client_registerHandler[target] = [];
    client_registerHandler[target].push(handler);
}

exports.__register = function(target, client) {
    var Payload = function(name, client) {
        var ins = this;
        this.client = client;
        this.name = name;
        this.callAPI = function(method, params, callBack) {
            exports.__callAPI(ins.name, method, params, callBack);
        }
        this.fire = ins.client.fire;
        this.listen = ins.client.listen;
        this.unListen = ins.client.unListen;
    }
    if (DEBUG) console.log("[Ecosystem] register *" + target + "*");
    exports[target] = new Payload(target, client);

    if (client_registerHandler && client_registerHandler[target]) {
        client_registerHandler[target].forEach(function(handler) {
            if (handler) handler();
        });
        delete client_registerHandler[target];
    }
}

exports.callAPI = function() {
    if (arguments.length < 4) {
        exports.__callAPI.apply(this, [ "core", arguments[0], arguments[1], arguments[2] ]);
    } else {
        exports.__callAPI.apply(this, [ arguments[0], arguments[1], arguments[2], arguments[3] ]);
    }
}

exports.__callAPI = function(target, method, params, callBack) {
    //if (DEBUG) console.log("[Ecosystem] call *" + target + "* api --> " + method);
    var URL = Setting.ecosystem.servers[target].api;
    var postData = {};
    if (params) {
        for (var key in params) {
            var val = params[key];
            if (val && typeof val == "object") {
                val = JSON.stringify(val);
            }
            postData[key] = val;
        }
    }
    request(URL,
        {
            method: "POST",
            body: { method:method, data:postData }
        },
        function(err, res, body) {
            //if (DEBUG) console.log("[Ecosystem] *" + target + "* response --> ");
            if (err) {
                console.error(err);
                if (callBack) callBack(Error.create(CODES.CORE_SERVICE_ERROR, err.toString()));
            } else {
                //if (DEBUG) console.log(body);

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

global.__defineGetter__('Ecosystem', function() {
    return exports;
});

var Client = function(name) {
    var ins = this;
    this.name = name;

    this.connect = function(serverName, host) {
        ins.serverName = serverName;
        ins.serverHost = host;
        Client.clients[serverName] = ins;
        Ecosystem.__register(serverName, ins);
    }

    this.fire = function(event, data, callBack) {
        exports.fire(ins.serverName, event, data, callBack);
    }

    this.listen = function(event, handler) {
        exports.listen(ins.serverName, event, handler);
    }

    this.unListen = function(event, handler) {
        exports.unListen(ins.serverName, event, handler);
    }
}

Client.clients = {};

exports.init = function(config) {
    config = config || {};
    agent = config.agent;

    /* setup server */
    var EXPRESS  = require('express');
    var BODY_PARSER = require('body-parser');
    var METHOD_OVERRIDE = require('method-override');

    var App = EXPRESS();
    server = App;
    App.maxSockets = Infinity;
    App.use(BODY_PARSER.urlencoded({ extended: true }));
    App.use(BODY_PARSER.json());
    App.use(METHOD_OVERRIDE());
    /*
    App.post("/connect", function (req, res) {
        var client = req.body.client;

        console.log("*" + client + "* is connected.");

        if (!server.__connected) server.__connected = {};
        server.__connected[client] = { time:Date.now() };

    });
    */

    App.post("/message", function (req, res) {
        var client = req.body.client;
        var event = req.body.event;
        var data = req.body.data;

        //if (DEBUG) console.log("receive message from *" + client + "* ---> [" + event + "]");

        res.json({});

        var list = server_notifyHandlers[client + "@" + event];
        if (!list || list.length <= 0) return;
        list.forEach(function(handler) {
            if (handler) handler(data);
        });
    });

    App.listen(Setting.ecosystem.port);

    /* setup client */
    var servers = Setting.ecosystem.servers;
    if (servers) {
        for (var name in servers) {
            var client = new Client(Setting.ecosystem.name);
            var def = servers[name];
            client.connect(name, def.message);
        }
    }
}

exports.broadcast = function(event, data, callBack) {
    if (!server) return;

    //if (DEBUG) console.log("[Ecosystem] broadcast message --> " + event + " : " + (data ? JSON.stringify(data) : {}));
    if (event.indexOf("@") > 0) {
        event = event.split("@");
        var target = event[0];
        event = event[1];
        exports.fire(target, event, data, callBack);
    } else {
        var servers = Setting.ecosystem.servers;
        if (servers) {
            var p = [];
            var errs;
            for (var target in servers) {
                (function(s) {
                    p.push(function(cb) {
                        exports.fire(s, event, data, function(err) {
                            if (err) {
                                if (!errs) errs = {};
                                errs[s] = err;
                            }
                            cb();
                        });
                    });
                })(target);
            }
            runAsParallel(p, function() {
                if (callBack) callBack(errs);
            });
        }
    }
}

exports.fire = function(target, event, data, callBack) {
    //if (DEBUG) console.log("[Ecosystem] fire message to *" + target + "* --> " + event + " : " + (data ? JSON.stringify(data) : {}));

    var postData = {};
    if (data) {
        for (var key in data) {
            var val = data[key];
            if (val && typeof val == "object") {
                val = JSON.stringify(val);
            }
            postData[key] = val;
        }
    }

    //var startTime = Date.now();
    var url = Setting.ecosystem.servers[target]["message"] + "/message";
    request(url,
        {
            method: "POST",
            body: { event:event, data:postData, client:Setting.ecosystem.name }
        },
        function(err, res, body) {
            if (!callBack) return;
            //var costTime = Date.now() - startTime;
            //console.log('cost time: ' + costTime + 'ms');
            if (err) {
                callBack(err);
            } else {
                if (typeof body == "string") {
                    try {
                        body = JSON.parse(body);
                    } catch (exp) {
                        err = exp;
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

                callBack(err, body);
            }
        });
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