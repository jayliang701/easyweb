var Redis = require("../model/Redis.js");
var Utils = require("./Utils.js");

var Captchapng = require('captchapng');

var EXPIRE_TIME = 120; //sec

exports.setup = function(App) {
    App.get("/captcha", function(req, res) {
        var type = req.query["type"];
        var len = parseInt(req.query["len"]);
        var w = parseInt(req.query["w"]);
        var h = parseInt(req.query["h"]);
        if (!String(type).hasValue() || isNaN(len) || isNaN(w) || isNaN(h)) {
            res.writeHead(500);
            res.end();
            return;
        }

        var client = Utils.generateIdentifyID(req);

        refresh(client, type, w, h, len, function(code, binary, err) {
            if (code) {
                var responseHeader = {
                    "Content-Type": "image/png",
                    "Cache-Control":"no-cache",
                    "Content-Length":binary.length
                };
                res.writeHead(200, responseHeader);
                res.end(binary);
            } else {
                console.error("get captcha error ==> " + err.toString());
                res.writeHead(500);
                res.end();
            }
        });
    });
}

function refresh(client, type, w, h, codeLength, callBack) {
    var code = randomCode(codeLength ? codeLength : 4);

    var photo = new Captchapng(w, h, parseInt(code));
    photo.color(0,0,0,0);
    photo.color(80,80,80,255);
    var img = photo.getBase64();
    var imgBase64 = new Buffer(img, "base64");

    Redis.set("captcha_" + client + "_" + type, code,
        function (redisRes, redisErr) {
            if (redisRes) {
                if (callBack) callBack(code, imgBase64);
            } else {
                if (callBack) callBack(null, null, redisErr);
            }
        }, EXPIRE_TIME);
}

function check(client, type, code, callBack) {
    Redis.get("captcha_" + client + "_" + type, function(redisRes, err) {
        if (err) {
            if (callBack) callBack(false, err);
        } else {
            callBack(String(redisRes).hasValue() && String(redisRes) == String(code));
        }
    });
}

function randomCode(len) {
    var parts = [
        [ 49, 57 ] //1-9
        //[ 65, 90 ] //A-Z
    ];

    var val = "";
    for (var i = 0; i < len; i++)
    {
        var part = parts[Math.floor(Math.random() * parts.length)];
        //trace(part[0], part[1], Math.floor(Math.random() * (part[1] - part[0])));
        var code = part[0] + Math.floor(Math.random() * (part[1] - part[0]));
        var c = String.fromCharCode(code);
        //if (c == "O") c = Math.ceil(Math.random * 9);
        val += c;
    }
    return val;
}

exports.refresh = refresh;
exports.check = check;