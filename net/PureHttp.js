/**
 * Created by Jay on 2016/8/25.
 */


var HTTP = require('http');
HTTP.globalAgent.maxSockets = Infinity;

//var ICONV = require('iconv-lite');
//var Crypto = require("crypto");
//var BufferHelper = require('bufferhelper');

var DEBUG = global.VARS && global.VARS.debug;

function Server() {

    var instance = this;

    this.__middleware = new DefaultMiddleware();

    this.__handlers = {
        "POST": {},
        "GET": {},
        "ALL": {}
    };

    this.__options = {};

    this.__worker = HTTP.createServer(function (req, res) {

        instance.__middleware.preprocess(req, res);

        var url = req.url;
        var index = url.indexOf("?");
        if (index > 0) url = url.substring(0, index);

        var data = [];
        req.on("data", function (chunk) {
            data.push(chunk);
        });
        req.on("end", function () {

            data = Buffer.concat(data).toString('utf8');

            var handler = instance.__handlers[req.method][url];
            handler = handler || function() {
                                     res.writeHead(404);
                                     res.end();
                                 };

            instance.__middleware.process(req, res, data, handler);
        });
    });

    this.start = function(options) {
        options = options || {};
        this.__options = options;
        var port = options.port || 8888;
        var ip = options.ip || "127.0.0.1";
        this.__worker.listen(port, ip);
        if (DEBUG) console.log("http server is running on port: " + port);
    }

    this.post = function(path, handler) {
        //if (DEBUG) console.log("*POST* in --> " + );
        var handlers = this.__handlers["POST"];
        handlers[path] = handler;
    }

    this.get = function(path, handler) {
        //if (DEBUG) console.log("*GET* in --> " + );
        var handlers = this.__handlers["GET"];
        handlers[path] = handler;
    }

    this.all = function(path, handler) {
        //if (DEBUG) console.log("*ALL* in --> " + );
        var handlers = this.__handlers["ALL"];
        handlers[path] = handler;
    }

    this.middleware = function(middleware) {
        this.__middleware = middleware;
    }
}

exports.createServer = function() {
    var server = new Server();
    return server;
}

function DefaultMiddleware() {
    this.preprocess = function(req, res) {

    }

    this.process = function(req, res, data, handler) {
        handler(req, res, data);
    }
}

function JsonAPIMiddleware() {

    this.preprocess = function(req, res) {
        var success = function (data, headers) {
            var responseHeader = { "Content-Type": "application/json" };
            if (headers) {
                for (var key in headers) {
                    responseHeader[key] = headers[key];
                }
            }
            if (arguments.length == 0) data = { flag:1 };
            var resBody = JSON.stringify({code: 1, data:data, msg:"OK"});
            responseHeader['Content-Length'] = Buffer.byteLength(resBody, "utf8");
            this.writeHead(200, responseHeader);
            this.end(resBody);
        };

        var fail = function () {
            var err = arguments[0];
            var code = 0;
            var msg = "error";
            if (arguments.length > 1) {
                code = Number(arguments[0]);
                msg = arguments[1] ? arguments[1].toString() : "unknown";
            } else {
                if (err.hasOwnProperty("code")) {
                    code = err.code;
                    msg = err.msg;
                } else {
                    msg = err.toString();
                }
            }
            var responseHeader = { "Content-Type": "application/json" };
            var resBody = JSON.stringify({code: code, msg:msg});
            responseHeader['Content-Length'] = Buffer.byteLength(resBody, "utf8");
            this.writeHead(200, responseHeader);
            this.end(resBody);
        };

        var exec = function(q, done) {
            var res = this;
            runAsQueue(q, function(err, result) {
                if (err) {
                    res.sayError(err);
                } else {
                    if (arguments.length == 0 || (arguments.length == 1 && (arguments[0] == null || arguments[1] == undefined))) {
                        res.sayOK();
                    } else {
                        res.sayOK(result);
                    }
                    if (done) done(result);
                }
            });
        }

        res.exec = exec.bind(res);
        res.sayError = fail.bind(res);
        res.sayOK = success.bind(res);
    }

    this.process = function(req, res, data, handler) {
        var params = null;
        try {
            params = JSON.parse(data);
        } catch (exp) {
            res.sayError(exp);
            return;
        }

        handler(req, res, params);
    }
}

exports.JsonAPIMiddleware = JsonAPIMiddleware;
