/**
 * Created by Jay on 2015/9/16.
 */

var CODES = require("../ErrorCodes");
var Redis = require("../model/Redis");
var Utils = require("./Utils");
var SMSUtil = require("./SMSUtil");

var REDIS_KEY = "validation_code_";
var DEFAULT_CODE_LEN = 6;
var config;
var SIMULATION = true;

exports.init = function(setting) {
    config = setting;
}

exports.remove = function(phone, type, callBack) {
    Redis.del(REDIS_KEY + type + "_" + phone, function(redisRes, redisErr) {
        if (callBack) {
            callBack(redisRes, redisErr);
        } else {
            if (redisErr) console.error("remove validation code error ==> " + redisErr.toString());
        }
    });
}

exports.use = function(phone, type, code, callBack) {
    if (!code || code == "") {
        if (callBack) callBack(false, CODES.INVALID_VALIDATION_CODE, "code should not be undefined or empty");
        return;
    }
    //模拟
    if (SIMULATION && code == "123456") {
        if (callBack) callBack(true);
        return;
    }

    Redis.get(REDIS_KEY + type + "_" + phone, function(redisRes, redisErr) {
        if (redisErr) {
            if (callBack) callBack(false, CODES.REDIS_ERROR, redisErr);
        } else {
            if (redisRes && redisRes == code) {
                exports.remove(phone, type);
                if (callBack) callBack(true);
            } else {
                if (callBack) callBack(false, CODES.INVALID_VALIDATION_CODE, "no such validation code<" + type + " : " + phone + ">");
            }
        }
    });
}

exports.send = function(type, phone, callBack, len) {
    //模拟
    if (SIMULATION) {
        if (callBack) callBack({ type:type, phone:phone, code:"123456" });
        return;
    }

    var code = Utils.randomNumber(isNaN(len) || len == 0 ? DEFAULT_CODE_LEN : parseInt(len));

    Redis.set(REDIS_KEY + type + "_" + phone, code, function(redisRes, redisErr) {
        if (redisErr) {
            if (callBack) callBack(null, CODES.REDIS_ERROR, redisErr);
        } else {
            SMSUtil.sendMessage(phone, type, { "code":code }, function(flag, err) {
                if (flag) {
                    if (callBack) callBack({ type:type, phone:phone, code:code });
                } else {
                    if (err) console.error("send sms error ==> " + err.toString());
                    exports.remove(phone, type);
                    if (callBack) callBack(null, CODES.SMS_SERVICE_ERROR, err);
                }
            });
        }
    }, config.validationCodeExpireTime);
}