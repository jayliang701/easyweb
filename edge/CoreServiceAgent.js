/**
 * Created by Jay on 2015/8/30.
 */
var Utils = require("./../utils/Utils");
var CODES = require("./../ErrorCodes");

var io = require('socket.io-client');
var socket;

var config;

var connectCallBack;

var DEBUG = global.VARS.debug;

exports.connect = function(setting, callBack) {
    config = setting;
    connectCallBack = callBack;
    //conn = new SocketConnector(config.ip, config.port, config.options);
    socket = io.connect("http://" + config.ip + ":" + config.port, { reconnect: true });
    socket.processingRequestPool = {};
    socket.processingRequestNum = 0;
    socket.isWorking = false;

    socket.on('connect', function() {

        socket.emit("$init", { name:config.name });

        socket.callAPI = function(method, data, callBack) {
            var now = Date.now();
            var reqID = now + "::" + socket.processingRequestNum;

            socket.processingRequestPool[reqID] = { reqID:reqID, reqTime:now, method:method, data:data, callBack:callBack };
            socket.processingRequestNum ++;

            if (DEBUG) console.log("[Edge] callAPI ===> reqID:" + reqID + "    method: " + method + "   data: " + JSON.stringify(data));
            socket.emit("$callAPI", { reqID:reqID, method:method, data:data });
        };

        socket.on('$init', function(data) {
            if (DEBUG) console.log("[Edge] " + data.message);
            socket.isWorking = true;

            if (connectCallBack) {
                connectCallBack();
                connectCallBack = null;
            }
        });

        socket.on('$callAPIResponse', function(data) {
            if (!data.__rpid) {
                console.error("[Edge] found a unknown <__rpid> message from Core Server.");
                return;
            }
            var req = socket.processingRequestPool[data.__rpid];
            if (!req) return;

            delete socket.processingRequestPool[data.__rpid];
            socket.processingRequestNum --;

            if (DEBUG) console.log("[Edge] callAPI response ===> cost: " + (Date.now() - req.reqTime) + "ms    method: " + req.method + "   data: " + JSON.stringify(data));

            if (!req.callBack) return;
            req.callBack(data.data);
            req.callBack = undefined;
        });

    });
    socket.on('connect_error', function() {
        socket.isWorking = false;
        if (DEBUG) console.error("connection error.");
    });
    socket.on('connect_timeout', function() {
        socket.isWorking = false;
    });
    socket.on('disconnect', function() {
        socket.isWorking = false;
    });
}

exports.exec = function(method, data, auth) {
    var funRes = Utils.createAsyncThen();

    if (!socket) {
        funRes.execLazy(null, CODES.CORE_SERVICE_ERROR, "core service is unavailable");
        return funRes;
    }

    var params = [ method, data ];
    if (auth) {
        params.push(auth);
    }

    socket.callAPI(method, data, function(res) {
        if (res) {
            if (res.code == 1) {
                funRes.exec(res.data);
            } else {
                funRes.exec(null, res.code, res.msg);
            }
        } else {
            funRes.exec(null, CODES.CORE_SERVICE_ERROR, "unknown");
        }
    });

    return funRes;
}
