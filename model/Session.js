/**
 * Created by Jay on 2015/8/27.
 */
var Memory = require("./MemoryCache");
var Redis = require("./Redis");
var Utils = require("../utils/Utils");

var config;

var payload = {};

exports.init = function(params) {
    config = params;
    config.prefix = config.prefix || "";
    if (config.onePointEnter) {
        payload.formatKey = function(id, token) {
            return config.prefix + "user_sess_" + id;
        }
        payload.checkSess = function(id, token, sess) {
            return sess.userid == id && sess.token == token;
        }
    } else {
        payload.formatKey = function(id, token) {
            return config.prefix + "user_sess_" + id + "_" + token;
        }
        payload.checkSess = function(id, token, sess) {
            return true;
        }
    }
}

exports.save = function(user, callBack) {

    var tokentimestamp = Date.now();

    var sess = {};
    sess.userid = user.id;
    sess.token = user.token || Utils.randomString(16);
    sess.tokentimestamp = tokentimestamp;
    sess.type = user.type;
    sess.extra = user.extra;

    var key = payload.formatKey(sess.userid, sess.token);

    Redis.setHashMulti(key, sess, function(redisRes, redisErr) {
        if (redisRes) {
            Memory.save(key, sess, config.cacheExpireTime, null);
            if (callBack) callBack(sess);
        } else {
            if (callBack) callBack(null, redisErr);
        }
    }, config.tokenExpireTime);
}

exports.remove = function(user, callBack) {
    var id = user.id ? user.id : user.userid;
    var key = payload.formatKey(id, user.token);
    Memory.remove(key);
    Redis.del(key, function(redisRes, redisErr) {
        if (redisRes) {
            if (callBack) callBack(true);
        } else {
            if (callBack) callBack(false, redisErr);
        }
    });
}

exports.refresh = function(user) {
    var id = user.id ? user.id : user.userid;
    var key = payload.formatKey(id, user.token);
    Memory.setExpireTime(key, config.tokenExpireTime);
    Redis.setExpireTime(key, config.tokenExpireTime);
}

exports.check = function(id, token, callBack) {

    var key = payload.formatKey(id, token);
    var cache = Memory.read(key);
    if (cache) {
        if (payload.checkSess(id, token, cache)) {
            callBack(1, cache);
        } else {
            callBack(0);
        }
        return;
    }

    Redis.getHashAll(key, function(sess, err) {
        if (err) {
            callBack(-1, null, err);
        } else {
            if (sess) {
                if (payload.checkSess(id, token, sess)) {
                    callBack(1, sess);
                } else {
                    callBack(0);
                }
            } else {
                callBack(0);
            }
        }
    });
}
