/**
 * Created by YDY on 2016/1/21.
 * 用于测试框架连接各业务及core服务器
 */

var _ = require("underscore");

var Model = require("../model/Model.js");
var Redis = require("../model/Redis.js");
var Utils = require("./Utils.js");

var Request = require("min-request");
var CODES = require("./../ErrorCodes");

var SAVE_DURATION = 5000;
var isRunning = false;
var isSaving = false;
var queue = {};
var queueLength = 0;

var CNAME = "_Test";

/*
 连接指定的服务器并发送要调用的函数及数据
 */
exports.callAPI = function(config, method, params, token, callBack) {
    try {
        for (var prop in params) {
            if (typeof params[prop] == 'object') {
                params[prop] = JSON.stringify(params[prop]);
            }
        }
    } catch (exp) {
        callBack(null, CODES.PROXY_REQUEST_ERROR, exp);
        return;
    }

    var url = config.ip + ":" + config.port + "/api";

    var body_data = { method:method, data:params };
    if (token!=""){
        body_data["auth"] = token;
    }

    if(method =="user.changeNickName") {
        console.log(method);
    }

    var timer = setTimeout(function() {

        console.log("@->>>>>==============> timeout! 5000. method: " + method);

        clearTimeout(timer);
        timer = -1;
        callBack(null, CODES.PROXY_REQUEST_ERROR, "timeout");
    }, 5000);


    Request(url, { method: "POST", body: body_data }, function(err, res, body) {

        if (timer == -1) {
            clearTimeout(timer);

            console.log("Request timeout!!!            #######")

            return;
        }

        clearTimeout(timer);

        if (err) {
            callBack(null, CODES.PROXY_REQUEST_ERROR, err);
        } else {
            if (typeof body == "string") {
                try {
                    body = JSON.parse(body);
                } catch (exp) {
                    callBack(null, CODES.PROXY_REQUEST_ERROR, exp);
                    return;
                }
            }
            if (body && body.code == CODES.OK) {
                callBack(body.data);
            } else {
                callBack(null, body.code, body.msg);
            }
        }
    });
}