/**
 * Created by Jay on 2015/9/16.
 */

var CODES = require("../ErrorCodes");
var Redis = require("../model/Redis");
var Utils = require("./Utils");

var REDIS_KEY = "invite_code_";
var DEFAULT_CODE_LEN = 6;

function removeCode(group, code) {
    Redis.del(REDIS_KEY + group + "_" + code);
}

exports.remove = removeCode;

exports.generate = function(group, useTimes, params, callBack, expiredTime, len) {
    var code = Utils.randomString(isNaN(len) || len == 0 ? DEFAULT_CODE_LEN : parseInt(len));
    var optParams = params;
    if (optParams) {
        try {
            optParams = JSON.stringify(params);
        } catch (err) {
            callBack(null, CODES.REDIS_ERROR, "invitation params should be an legal Object ==> " + err.toString());
            return;
        }
    }
    var opt = { useTimes:useTimes };
    if (String(optParams).hasValue()) opt.params = optParams;
    Redis.setHashMulti(REDIS_KEY + group + "_" + code, opt, function(redisRes, err) {
        if (redisRes) {
            callBack(code);
        } else {
            callBack(null, CODES.REDIS_ERROR, err);
        }
    }, expiredTime);
}

exports.use = function(group, code, callBack, returnParams) {
    var q = [];
    var obj;
    if (returnParams) {
        q.push(function(cb) {
            exports.get(group, code, function(res, code, msg) {
                if (code) {
                    cb([ code, msg ]);
                } else {
                    obj = res.params ? res.params : {};
                    cb();
                }
            });
        });
    }
    q.push(function(cb) {
        Redis.do("HINCRBY", [ Redis.join(REDIS_KEY + group + "_" + code), "useTimes", -1 ], function(useTimes, err) {
            if (err) {
                cb([ CODES.REDIS_ERROR, err ]);
            } else {
                if (useTimes >= 0) {
                    cb();
                } else {
                    cb([ CODES.INVITE_CODE_UNAVAILABLE, "INVITE_CODE_UNAVAILABLE" ]);
                }
            }
        });
    });
    Utils.runQueueTask(q, function(err) {
        if (err) {
            callBack(returnParams ? null : false, err[0], err[1]);
        } else {
            callBack(returnParams ? obj : true);
        }
});
}

exports.get = function(group, code, callBack) {
    Redis.getHashAll(REDIS_KEY + group + "_" + code, function(redisRes, err) {
        if (err) {
            callBack(false, CODES.REDIS_ERROR, err);
        } else {
            if (!redisRes || redisRes.useTimes <= 0) {
                removeCode(group, code);
                callBack(null, CODES.INVITE_CODE_UNAVAILABLE, "INVITE_CODE_UNAVAILABLE");
            } else {
                redisRes.params = redisRes.params ? redisRes.params : {};
                if (redisRes.params && typeof redisRes.params == "string") {
                    try {
                        redisRes.params = JSON.parse(redisRes.params);
                    } catch (exp) {
                        redisRes.params = {};
                        console.error(exp);
                    }
                }
                callBack(redisRes);
            }
        }
    });
}