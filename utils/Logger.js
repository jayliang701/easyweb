/**
 * Created by Jay on 2015/8/27.
 */

var _ = require("underscore");

var Model = require("../model/Model.js");
var Redis = require("../model/Redis.js");
var Utils = require("./Utils.js");

var Request = require("min-request");
var CODES = global.requireModule("ErrorCodes");

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

/* Created by Jay 2015/12/25 */
/* 作用是在服务启动时初始化Logger，设定一些参数，避免直接使用项目的Setting，减少耦合 */
var config;

exports.init = function(setting) {
    config = setting;
    if (!config) config = { };
    if (!config.project) config.project = "main";
    if (config.wrapperConsole == true) {
        //如果config里这个参数设定为true，则在console对象里增加一个新的方法指向log方法，这样在
        //具体使用的时候，可以直接用console对象来调用写日志，不需要额外引入Logger.js了。
        //目的是增加便利
        console.record = exports.log;
    }
}

/*
 Created by YDY 2015/12/12
 */

/*
 将要写入的日志信息发送给日志服务器
 必需参数：
 params.project : 项目及模块名，如taodi_app_server，缺省值为null
 params.group : 日志分组，如user/toytest/event/share/bonus/unit/...等，详见日志添加清单之附录 表2 已有的project及group变量表
 params.name : 要保存的操作名称，命名原则为模块句柄+所在模块名称，如toyTest.publish
 params.params : 其它数据，一般必需的有：by(操作者) / userType(操作者类型) / ip
 成功则返回：
 {flag:1}
 */
exports.log = function(project, group, name, params, callBack ){
    try {
        project = project || config.project;
        var data = {project:project, group:group, name:name, params:params};
        callLogger("log.writeLog", data, callBack);
    } catch (exp) {
        console.error("*Log* throw an error --> " + exp.toString());
    }
}

/*
 连接log服务器并发送要调用的函数及数据
 */
function callLogger(method, params, callBack) {
    try {
        for (var prop in params) {
            if (typeof params[prop] == 'object') {
                params[prop] = JSON.stringify(params[prop]);
            }
        }
    } catch (exp) {
        if(callBack) callBack(null, CODES.PROXY_REQUEST_ERROR, exp);
        return;
    }

    Request(config.url, { method: "POST", body: { method:method, data:params } },
        function(err, res, body) {
            if (err) console.error("*Log* " + err.toString());
            //如果没有指定回调方法，就干脆不用处理后续的逻辑了
            if (!callBack) return;

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

/*
 调用log查询api     //TODO: 此功能未完成
 必需参数：
 project : 项目及模块名，如taodi_app_server，缺省值为null
 group : 日志分组，如user/toytest/event/share/bonus/unit/...等，详见日志添加清单之附录 表2 已有的project及group变量表
 filters : 过滤条件
 fields
 可选参数：
 sortby : 如 {createTime:1}
 pagination ：分页信息
 */
exports.queryLog = function(project, group, filters, fields, sortby, pagination, callBack ){
    project = project || config.project;
    var data = {project:project, group:group, fields:fields, filters:filters, sortby:sortby, pagination:pagination};

    if(!_.isEmpty(sortby)) data["sortby"] = sortby;
    if( !_.isEmpty(pagination) ) data["pagination"] = pagination;

    callLogger("log.query", data, callBack);
}