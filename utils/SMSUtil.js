/**
 * Created by Jay on 6/6/15.
 */

var TemplateLib = require("./TemplateLib.js");
var Utils = require("./Utils.js");
var Redis = require("../model/Redis.js");
var Request = require("min-request");

var config;
var DEBUG = false;

exports.init = function(setting, debug) {
    config = setting;
    DEBUG = debug;
}

function logAfterSend(phone, redisObj) {
    var times = 1;
    var now = Date.now();
    var date = Utils.convertTimeToDate(now, false, 'en');
    if (redisObj && redisObj.date == date) {
        date = redisObj.date;
    }
    if (redisObj) {
        times += redisObj.sendTimes;
    }
    Redis.set("sms_log_" + phone, JSON.stringify({ date:date, lastSendTime:now, sendTimes:times }), function(redisRes, err) {
        if (err) {
            console.error("log sending sms error in redis error ==> " + err.toString());
        }
    }, 24 * 60 * 60);
}

function checkIsAllowToSend(phone, callBack) {
    Redis.get("sms_log_" + phone, function(redisRes, err) {
        if (err) {
            callBack(-1, err);
        } else {
            if (redisRes) {
                try {
                    var obj = JSON.parse(redisRes);
                    if (Number(obj.lastSendTime) > 0) {
                        var now = Date.now();
                        if (now - Number(obj.lastSendTime) < config.limit.duration) {
                            //too fast
                            callBack(-1, new Error("SMS_SEND_TOO_FAST"));
                            return;
                        }
                    }
                    var sendTimes = parseInt(obj.sendTimes);
                    if (sendTimes < 0) sendTimes = 0;
                    if (sendTimes > config.limit.maxPerDay) {
                        //over max times in a day
                        callBack(-1, new Error("SMS_SEND_OVER_MAX_TIMES"));
                        return;
                    }
                    callBack(obj);
                } catch (exp) {
                    callBack(-1, exp);
                    return;
                }
            } else {
                callBack(null);
            }
        }
    });
}

function sendMessage(phone, templateKey, args, callBack, user) {

    checkIsAllowToSend(phone, function(redisLog, errCode, errMsg) {
        if (redisLog == -1) {
            callBack(false, errCode, errMsg);
        } else {

            var tpl = TemplateLib.useTemplate("sms", templateKey, args, user);
            var msg = tpl.content;

            //http://utf8.sms.webchinese.cn/?Uid=本站用户名&Key=接口安全秘钥(或KeyMD5=md5(接口安全秘钥,32位大写))&smsMob=手机号码&smsText=短信内容
            var url = config.api;
            url += "&keyMD5=" + Utils.md5(config.secret).toUpperCase();
            url += "&smsMob=" + phone;
            url += "&smsText=" + msg;

            if (DEBUG) console.log("SMS ready to send ==> " + url);

            Request(url, { method: "POST", body: {} },
                function(err, res, body) {
                    if (DEBUG) console.log("sent a message to phone: " + phone + "    response: " + body);
                    if (err) {
                        callBack(false, err);
                    } else {
                        if (Number(body) > 0) {
                            logAfterSend(phone, redisLog);
                            callBack(true);
                        } else {
                            callBack(false, new Error("agent error ==> " + body));
                        }
                    }
                });
        }
    });
}

exports.sendMessage = sendMessage;