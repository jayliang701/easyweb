/**
 * Created by Jay on 2015/8/27.
 */

var Model = require("../model/Model.js");
var Redis = require("../model/Redis.js");
var Utils = require("./Utils.js");

var SAVE_DURATION = 5000;
var isRunning = false;
var isSaving = false;
var queue = {};
var queueLength = 0;

var CNAME = "_Log";

function createData(name, params, by, time) {
    var obj = {};

    for (var key in params) {
        obj[key] = params[key];
    }

    obj.name = name;
    obj.time = time;
    obj.by = by;
    return obj;
}

function push(group, name, params, req, user) {

    if (!queue[group]) {
        queue[group] = [];
    }

    var by;
    if (user) {
        by = user.id;
    } else {
        by = "guest";
    }

    if (req) {
        if (req.ip == "127.0.0.1" || req.ip == "localhost") {
            var c = req.body["$client"];
            if (c) {
                try {
                    c = JSON.parse(c);
                    params.ip = c.ip;
                    params.hostname = c.hostname;
                } catch (err) {
                }
            }
        } else {
            params.ip = Utils.parseIP(req);
            params.hostname = req.hostname;
        }
    }

    queueLength ++;
    queue[group].push({ name:name, time:Date.now(), by: by, params: params });
    if (!isRunning) {
        isRunning = true;
        setInterval(checkStack, SAVE_DURATION);
    }
}

function save() {
    isSaving = true;
    console.log("*Log* ready to save...");

    var list = [];
    var total = 0;

    for (var group in queue) {
        list.push({group:group, data:[].concat(queue[group])});
        total += queue[group].length;
        queue[group].length = 0;
    }
    queueLength = 0;

    var tasks = [];

    list.forEach(function(log) {
        tasks.push(function(cb) {
            try {
                var temp = [];
                log.data.forEach(function(ele) {
                    temp.push(createData(ele.name, ele.params, ele.by, ele.time));
                });
                Model.insertList(null, log.group + "_" + CNAME, temp, function(res, err) {
                    if (err) console.error("*Log* " + err);
                    cb();
                }, true);
            } catch (exp) {
                console.error("*Log* " + exp);
                cb();
            }
        });
    });

    Utils.runQueueTask(tasks, function() {
        console.log("*Log* save to db completed. count => " + total);
        isSaving = false;
    });
}

function checkStack() {
    if (queueLength > 0 && !isSaving) {
        save();
    }
}

exports.query = function(group, filters, fields, sortby, pagination, callBack) {
    if (pagination) {
        Model.findPage(null, group + CNAME, pagination.index, pagination.num, function(logs, total, err) {
            if (err) {
                callBack(null, err);
            } else {
                var resData = { list:logs };
                if (num >= 0) resData.total = num;
                if (pagination) resData.pagination = pagination;
                callBack(resData);
            }
        }, filters, fields, sortby);
    } else {
        Model.find(null, group + CNAME, function(logs, err) {
            callBack(logs, err);
        }, filters, fields, sortby, pagination);
    }

}

exports.count = function (group, filters, callBack) {
    Model.count(null, group + CNAME, filters, callBack);
}

exports.push = push;

exports.pushGlobal = function(name, params, req, user) {
    push('global', name, params, req, user);
};

exports.realTimeLog = function(field, val, isFloat) {
    var cmd = isFloat ? "HINCRBYFLOAT" : "HINCRBY";
    Redis.do(cmd, [ Redis.join("real_time_data"), field, Number(val) ]);
}

exports.countingLog = function(field, val, isFloat) {
    var cmd = isFloat ? "HINCRBYFLOAT" : "HINCRBY";
    Redis.do(cmd, [ Redis.join("counting"), field, Number(val) ]);
}