/**
 * Created by Jay on 2015/9/10.
 */

var UTIL = require("util");
var Utils = require("./../utils/Utils");
var CODES = require("./../ErrorCodes");

var options;

exports.config = function(opt) {
    options = opt;
}

exports.handle = function(req, res, next) {
    req._res = res;
    res._req = req;
    req._clientIP = Utils.parseIP(req);

    var identify_id = req.cookies.identify_id;
    if (!identify_id) {
        identify_id = Utils.md5(req.headers["user-agent"] + req._clientIP + Date.now());
        res.cookie("identify_id", identify_id);
    }
    req._identifyID = identify_id;

    res.sayError = function() {
        var code, msg;
        if (arguments.length == 1 && arguments[0]) {
            if (UTIL.isArray(arguments[0])) {
                code = arguments[0][0];
                msg = arguments[0][1];
            } else if (arguments[0].code && arguments[0].msg) {
                code = arguments[0].code;
                msg = arguments[0].msg;
            } else {
                code = CODES.SERVER_ERROR;
                msg = arguments[0].toString();
            }
        } else {
            code = arguments[0] == undefined ? CODES.SERVER_ERROR : arguments[0];
            msg = arguments[1];
        }
        if (!msg) {
            msg = "unknown";
        } else if (typeof msg == 'object') {
            msg = msg.toString();
        }
        console.error(this._req.body.method + " > ", "code: " + code, "msg: " + msg);
        this.json({code:code, data:{}, msg:msg});
    };
    res.sayOK = function(data, headers) {
        var responseHeader = { "Content-Type": "application/json" };
        if (headers) {
            for (var key in headers) {
                responseHeader[key] = headers[key];
            }
        }
        if (arguments.length == 0) data = { flag:1 };
        var resBody = JSON.stringify({code: CODES.OK, data:data, msg:"OK"});
        responseHeader['Content-Length'] = Buffer.byteLength(resBody, "utf8");
        this.writeHead(200, responseHeader);
        this.end(resBody);
    };
    res.sendBinary = function(data, mime, headers) {
        var responseHeader = {
            "Content-Type": mime,
            "Cache-Control":"no-cache",
            "Content-Length":data.length
        };
        if (headers) {
            for (var key in headers) {
                responseHeader[key] = headers[key];
            }
        }
        this.writeHead(200, responseHeader);
        this.end(binary);
    };


    res.goPage = function(url, code) {
        if (url.charAt(0) == "/") url = url.substring(1);
        if (url.indexOf("http") != 0) {
            url = options.site + url;
        }
        code = code ? code : 303;
        this.redirect(code, url);
    }

    next();
};