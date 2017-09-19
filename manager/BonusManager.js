/**
 * Created by Jay on 2015/9/4.
 */
var _ = require("underscore");
var Model = require('../model/Model');
var Utils = require("magicfish_web/utils/Utils");
var CODES = global.requireModule("ErrorCodes");

var CNAME = "__bonus_check";

var BONUS = {};

function getBonusDetail(key){
    var bobj = BONUS;
    var path = key.split('.');
    for (var i = 0; i < path.length; i++) {
        bobj = bobj[path[i]];
    }
    if (bobj == BONUS) return null;
    return bobj;
}

function init(ModelAgent) {
    BONUS = require("fs").readFileSync(global.getConfigPath("bonus.config"));
    BONUS = BONUS.toString("utf8");
    BONUS = JSON.parse(BONUS);

    if (ModelAgent) Model = ModelAgent;
}

/* modified by YDY */
/*
 新增参数说明：
 info为一object，用于存放所需的其它参数；
 当限制类型为daily_per_one_max时，info = {type: event/toy_test/..., id:id},其中id为event_id/toy_test_id/...
 当限制类型为custom时，info = {title: 活动名称拼音缩写}

 otherParams: 其他参数，可选，可为null, 可用于传入自定义奖励，例如：otherParams = { customBonus:{ point:20 } }
 */
function addBonus(mainKey, key, info, callBack, otherParams) {
    var bobj = BONUS;
    var path = key.split('.');
    for (var i = 0; i < path.length; i++) {
        bobj = bobj[path[i]];
    }
    if (!bobj) {
        callBack(null, new Error('undefined bonus key => ' + key));
        return;
    }

    var doUpdate = function(flag, err, upParams, customBonus) {
        if (err) {
            callBack(null, err);
            return;
        }
        if (!flag) {
            callBack(null, null);
            return;
        }

        var bonusResult = {};
        var params = upParams ? upParams : {};
        if (customBonus) {
            bonusResult = customBonus;
        } else {
            for (var bk in bobj) {
                if (bk.indexOf("$") != 0) {
                    if (!params["$inc"]) params["$inc"] = {};
                    params["$inc"][bk] = bobj[bk];
                    bonusResult[bk] = bobj[bk];
                }
            }
        }
        if (params) {
            Model.update(null, CNAME, { id:mainKey }, params, function(numUp, err) {
                if (numUp) {
                    if (callBack) callBack(bonusResult);
                } else {
                    if (callBack) callBack(null, err);
                }
            }, true);
        } else {
            callBack(bonusResult);
        }
    }

    var limit = bobj["$limit"];
    if (limit) {
        switch (limit.type) {
            case "daily":
                checkDailyLimit(mainKey, bobj, limit, doUpdate);
                break;
            case "daily_max":
                checkDailyMaxLimit(mainKey, bobj, limit, doUpdate);
                break;
            case "times":
                checkTimesLimit(mainKey, bobj, limit, doUpdate);
                break;
            /* update by YDY 2015/12/6 */
            case "daily_group_max":
                checkDailyGroupMaxLimit(mainKey, bobj, limit, info, doUpdate);
                break;

            //此类型都为一次性的；只有key不一样。用于发放节目奖励等。
            case "custom":
                if (!info || typeof info != "object") {
                    callBack(null, new Error("parameter info incorrect"));
                    return;
                }
                checkCustomLimit(mainKey, bobj, limit, info, otherParams, doUpdate);
                break;
        }
    } else {
        doUpdate(true);
    }
}

function checkDailyLimit(mainKey, config, limit, callBack) {
    var filter = { id:mainKey };//, type:type, id:id };
    var fields = {  };
    fields["dailyCheck." + limit.key] = 1;

    //得到当天的日期 ，如2015-12-01

    Model.findOne(null, CNAME, function(uobj, err) {
        if (err) {
            callBack(false, err);
        } else {
            var today = Utils.convertTimeToDate(Date.now(), false, "en");
            var maxLimit = limit.max > 0 ? limit.max : 1;
            if (uobj && uobj.dailyCheck &&
                uobj.dailyCheck[limit.key] &&
                uobj.dailyCheck[limit.key].date == today &&
                uobj.dailyCheck[limit.key].times >= maxLimit) {
                //超过了当天的次数限制
                callBack(false);
                return;
            }

            var upParams = { "$inc":{}, "$set":{} };
            upParams["$inc"]["dailyCheck." + limit.key + ".times"] = 1;
            upParams["$set"]["dailyCheck." + limit.key + ".date"] = today;
            callBack(true, null, upParams);
        }
    }, filter, fields);
}

function checkDailyMaxLimit(mainKey, config, limit, callBack) {
    var filter = { id:mainKey };
    var fields = {  };
    fields["dailyMaxCheck." + limit.key] = 1;
    Model.findOne(null, CNAME, function(uobj, err) {
        if (err) {
            callBack(false, err);
        } else {
            var today = Utils.convertTimeToDate(Date.now(), false, "en");

            var maxLimits = limit.max || {};
            var finalBonus = {};
            var existValues = {};
            var upParams = { "$inc":{}, "$set":{} };

            if (uobj && uobj.dailyMaxCheck &&
                uobj.dailyMaxCheck[limit.key] &&
                uobj.dailyMaxCheck[limit.key].date == today) {
                //检查限制
                var obj = uobj.dailyMaxCheck[limit.key];
                existValues = obj.values || {};
            }

            for (var bk in config) {
                if (bk.indexOf("$") == 0) continue;
                var val = Number(config[bk]);
                finalBonus[bk] = val;
                upParams["$inc"]["dailyMaxCheck." + limit.key + ".values." + bk] = val;

                var maxVal = maxLimits[bk];
                if (isNaN(maxVal) || maxVal <= 0) continue;
                var existVal = existValues[bk];
                if (isNaN(existVal)) existVal = 0;

                var allowVal = maxVal - existVal;
                if (allowVal > 0) {
                    finalBonus[bk] = allowVal;
                    upParams["$inc"]["dailyMaxCheck." + limit.key + ".values." + bk] = allowVal;
                } else {
                    delete finalBonus[bk];
                    delete upParams["$inc"]["dailyMaxCheck." + limit.key + ".values." + bk];
                }
            }

            if (_.isEmpty(finalBonus)) {
                callBack(false);
            } else {
                upParams["$set"]["dailyMaxCheck." + limit.key + ".date"] = today;
                callBack(true, null, upParams, finalBonus);
            }
        }
    }, filter, fields)
}

function checkTimesLimit(mainKey, config, limit, callBack) {
    var filter = { id:mainKey };
    var fields = {  };
    fields["timesCheck." + limit.key] = 1;
    Model.findOne(null, CNAME, function(uobj, err) {
        if (err) {
            callBack(false, err, null);
        } else {
            var allow = false;
            var upParams;
            if (uobj) {
                uobj.timesCheck = uobj.timesCheck ? uobj.timesCheck : {};
                var ds = uobj.timesCheck[limit.key];
                if (!ds || isNaN(ds) || ds == 0 || ds + 1 <= limit.max) {
                    allow = true;
                }
            } else {
                allow = true;
            }
            if (allow) {
                upParams = {"$inc":{}};
                upParams["$inc"]["timesCheck." + limit.key] = 1;
            }
            callBack(allow, null, upParams);
        }
    }, filter, fields)
}

/* coded by Jay */
/**
 *
 *
 * @param mainKey    dailyGroupMaxCheck
 * @param config     为BONUS.config中的json数据BONUS[key]
 * @param limit     BONUS[mainKey]["$limit"]
 * @param info    { type:xxx, id:xxx }   type: 类型，值为一字符串，取值范围为event/toy/...（暂时只有这两种），用于表示积分类型与活动还是玩具公测相关;  id: 对应的event/toy test的id
 * @param callBack 回调
 */
function checkDailyGroupMaxLimit( mainKey, config, limit, info, callBack) {

    if (!info || typeof info != "object" || !info.type || !info.id) {
        callBack(false, new Error("parameter info incorrect"));
        return;
    }

    var checkType = info.type;
    var checkID = info.id;

    //得到当天的日期 ，如2015-12-01
    var today = Utils.convertTimeToDate(Date.now(), false, "en");

    var fieldKey = [ "dailyGroupMaxCheck", limit.key, checkType, checkID].join(".");

    var filter = { id:mainKey };
    var fields = { id:1 };
    fields[fieldKey] = 1;
    Model.findOne(null, CNAME, function (checkObj, err) {
        if (err) {
            callBack(false, err);
            return;
        }

        if (checkObj && checkObj.dailyGroupMaxCheck && checkObj.dailyGroupMaxCheck[limit.key] &&
            checkObj.dailyGroupMaxCheck[limit.key][checkType] &&
            checkObj.dailyGroupMaxCheck[limit.key][checkType][checkID]) {
                var obj = checkObj.dailyGroupMaxCheck[limit.key][checkType][checkID];
                if (obj && obj.date == today && obj.times >= limit.max) {
                    //超过了当天的次数限制，跳出
                    callBack(false);
                    return;
                }
        }

        var upParams = { "$inc":{}, "$set":{} };
        upParams["$inc"][fieldKey + ".times"] = 1;
        upParams["$set"][fieldKey + ".date"] = today;
        callBack(true, null, upParams);

    }, filter, fields);
}

/*
 检查自定义类中的每个具体项是否已经完成并增加过积分，以及整个大类的次数是否超过指定上限；如否则为用户增加积分
 参数：
 mainKey : 相关用户id
 config: 为BONUS.config中的json数据BONUS[key]
 info: {title: 活动名称拼音缩写}
 */
function checkCustomLimit(mainKey, config, limit, info, otherParams, callBack) {
    var customKey = limit.key + "_" + info.title;
    var filter = { id:mainKey };
    var keyStr = "customCheck."+customKey;
    filter[keyStr] = {"$exists":true};

    var fields = {  };
    //fields["customCheck." + limit.key] = 1;
    fields["customCheck." + customKey] = 1;
    Model.findOne(null, CNAME, function(uobj, err) {
        if (err) {
            callBack(false, err, null);
        } else {
            var allow = false;
            var upParams = {};
            if(!uobj) allow = true;
            if (allow) {
                upParams["customCheck." + customKey] = {remark:info["remark"]};
            }

            if(otherParams != null && otherParams != undefined){
                callBack(allow, null, upParams, otherParams.customBonus);
            }else {
                callBack(allow, null, upParams, null);
            }

        }
    }, filter, fields);
}

exports.init = init;
exports.addBonus = addBonus;
exports.getBonusDetail = getBonusDetail;