/**
 * Created by Jay on 2015/8/24.
 */

var REDIS = require("redis");
var UTIL = require('util');

var EventEmitter = require("events").EventEmitter;
var Dispatcher = new EventEmitter();

var prefix;

var client;

function setExpire(key, val) {
    if (!val || val == - 1) {
        //no expired
    } else {
        client.expire(prefix + key, val);
    }
}

var EXPIRED_MAP = {};

var CACHE_PREFIX = "CACHE_";

exports.addEventListener = function(type, handler) {
    Dispatcher.on(type, handler);
}

exports.removeEventListener = function(type, handler) {
    Dispatcher.removeListener(type, handler);
}

exports.removeAllEventListener = function() {
    Dispatcher.removeAllListeners.apply(Dispatcher, arguments);
}

exports.setExpireTime = function(key, val) {
    if (UTIL.isArray(key)) {
        key = key.join("->");
    }
    setExpire(key, val);
}

exports.registerExpiredTime = function(key, expired) {
    if (UTIL.isArray(key)) {
        key = key.join("->");
    }
    EXPIRED_MAP[key] = Number(expired);
}

exports.save = function(key, val, expired, callBack) {
    var tempKey = key;
    var originalKey = key;
    if (UTIL.isArray(key)) {
        tempKey = key[0];
        if (!expired) expired = EXPIRED_MAP[tempKey];
        key = key.join("->");
    } else {
        if (!expired) expired = EXPIRED_MAP[key];
    }
    var originalVal = val;
    if (typeof val == "object") {
        val = JSON.stringify(val);
    }
    exports.set(CACHE_PREFIX + key, val, function(redisRes, redisErr) {
        if (redisRes) {
            console.log('2 -> cache [' + key + '] saved. expired ==> ' + expired);
            Dispatcher.emit("save", tempKey, originalKey, originalVal);
        } else {
            Dispatcher.emit("error", tempKey, originalKey, redisErr);
        }
        if (callBack) callBack(redisRes, redisErr);
    }, expired);
}

exports.read = function(key, callBack) {
    if (UTIL.isArray(key)) {
        key = key.join("->");
    }
    exports.get(CACHE_PREFIX + key, function(res, err) {
        if (err) {
            if (callBack) callBack(null, err);
        } else {
            if (res && typeof res == "string") {
                try {
                    res = JSON.parse(res);
                } catch (exp) {
                    //res is not a json string
                }
            }
            console.log('read cache [' + key + '] from 2.');
            if (callBack) callBack(res);
        }
    });
}

exports.remove = function(key, callBack) {
    if (UTIL.isArray(key)) {
        key = key.join("->");
    }
    console.log('clear cache [' + key + '] from 1.');
    exports.del(CACHE_PREFIX + key, callBack);
}

exports.set = function(key, val, callBack, expired) {
    client.set(prefix + key, val, function (err, res) {
        setExpire(key, expired);
        if (err) console.error("Redis.set(" + key + ") ==> " + err);
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.setHash = function(key, field, val, callBack, expired) {
    client.hset(prefix + key, field, val, function (err, reply) {
        setExpire(key, expired);
        if (err) console.error("Redis.setHash(" + key + ", " + field + ") ==> " + err);
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.setHashMulti = function(key, fieldAndVals, callBack, expired) {
    client.hmset(prefix + key, fieldAndVals, function (err, reply) {
        setExpire(key, expired);
        if (err) {
            var temp = (typeof fieldAndVals == "string") ? fieldAndVals : JSON.stringify(fieldAndVals);
            console.error("Redis.setHashMulti(" + key + ", " + (temp ? temp.substr(0, 16) : "null") + "..." + ") ==> " + err);
        }
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.pushIntoList = function(key, value, callBack) {
    var args = [prefix + key];
    args = args.concat(value);
    args.push(function(err, replay) {
        if (err) console.error("Redis.pushIntoList(" + key + ") ==> " + err);
        if (callBack) {
            callBack(replay, err);
        }
    })
    client.lpush.apply(client, args);   
}

exports.getFromList = function(key, fromIndex, toIndex, callBack) {
    client.lrange(prefix + key, fromIndex, toIndex, function(err, replay) {
        if (err) console.error("Redis.getFromList(" + key + ") ==> " + err);
        if (callBack) {
            callBack(replay, err);
        }
    });
}

exports.getWholeList = function(key, callBack) {
    exports.getFromList(key, 0, -1, callBack);
}

exports.setToList = function(key, index, value, callBack) {
    client.lset(prefix + key, index, value, function(err, replay) {
        if (err) console.error("Redis.setToList(" + key + ") ==> " + err);
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.get = function(key, callBack) {
    client.get(prefix + key, function(err, reply) {
        // reply is null when the key is missing
        if (err) console.error("Redis.get(" + key + ") ==> " + err);
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHash = function(key, field, callBack) {
    client.hget(prefix + key, field, function (err, reply) {
        if (err) {
            console.error("Redis.getHash(" + key + ", " + field + ") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHashMulti = function(key, field, callBack) {
    client.hmget(prefix + key, field, function (err, reply) {
        if (err) {
            console.error("Redis.getHashMulti(" + key + ", " + field + ") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHashAll = function(key, callBack) {
    client.hgetall(prefix + key, function (err, reply) {
        if (err) {
            console.error("Redis.getHashAll(" + key + ") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHashKeys = function(key, callBack) {
    client.hkeys(prefix + key, function (err, reply) {
        if (err) {
            console.error("Redis.getHashKeys(" + key + ") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHashToObj = function(key, callBack) {
    exports.getHashKeys(key, function (keys) {
        var count = keys.length;
        var index = 0;

        var obj = { keyNum:count, valNum:0, map:{} };

        if (count == 0) {
            if (callBack) {
                callBack(obj);
            }
            return;
        }

        for (var i = 0; i < count; i++) {
            (function(idx) {
                exports.getHash(key, keys[idx], function (vals) {
                    index ++;
                    obj.valNum += vals.length;
                    obj.map[keys[idx]] = vals;

                    if (index == count) {
                        if (callBack) {
                            callBack(obj);
                        }
                    }
                });
            })(i);
        }
    });
}

exports.delHashField = function(key, fields, callBack) {
    client.hdel.apply(client, [prefix + key ].concat(fields).concat(function(err) {
        if (callBack) {
            callBack(err ? false : true, err);
        }
    }));
}

exports.del = function(key, callBack) {
    client.del(prefix + key, function(err) {
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.multi = function(tasks, callBack) {
    client.multi(tasks).exec(function (err, replies) {
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.do = function (cmd, args, callBack) {
    var done = function(err, reply) {
        if (err) {
            console.error("Redis.do(" + cmd +") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    }
    var func = client[cmd];
    func.apply(client, args.concat([ done ]));
}

exports.join = function(key) {
    return prefix + key;
}

exports.start = function(host, port, pass, prefixName, callBack) {

    prefix = prefixName;

    client = REDIS.createClient(port, host, { auth_pass: pass });

    client.on("connect", function() {
        if (callBack) callBack();
    });
}