/**
 * Created by Jay on 2015/8/27.
 */
var Memory = require("./MemoryCache");
var Redis = require("./Redis");
var Utils = require("../utils/Utils");

var config;

exports.init = function(params) {
    config = params;
}

function formatKey(id, token) {
    return "user_sess_" + id + "_" + token;
}

exports.save = function(user, callBack) {

    var token = Utils.randomString(16);
    var tokentimestamp = Date.now();

    var sess = {};
    sess.userid = user.id;
    sess.token = token;
    sess.tokentimestamp = tokentimestamp;
    sess.type = user.type;

    var key = formatKey(user.id, token);

    Redis.setHashMulti(key, sess, function(redisRes, redisErr) {
        if (redisRes) {
            Memory.save(key, sess, config.cacheExpireTime, null);
            callBack(sess);
        } else {
            callBack(null, redisErr);
        }
    }, config.tokenExpireTime);
}

exports.remove = function(user, callBack) {
    var id = user.id ? user.id : user.userid;
    Redis.del(formatKey(id, user.token), function(redisRes, redisErr) {
        if (redisRes) {
            if (callBack) callBack(true);
        } else {
            if (callBack) callBack(false, redisErr);
        }
    });
}

exports.refresh = function(user) {
    var id = user.id ? user.id : user.userid;
    Redis.setExpireTime(formatKey(id, user.token), config.tokenExpireTime);
}

exports.check = function(id, token, callBack) {

    var key = formatKey(id, token);
    var cache = Memory.read(key);
    if (cache) {
        callBack(1, cache);
        return;
    }

    Redis.getHashAll(key, function(sess, err) {
        if (err) {
            callBack(-1, null, err);
        } else {
            if (sess) {
                callBack(1, sess);
            } else {
                callBack(0);
            }
        }
    });
}
