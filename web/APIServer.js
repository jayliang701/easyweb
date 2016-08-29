/**
 * Created by jay on 8/27/16.
 */
var FS = require("fs");
var PATH = require("path");

var Model = require("../model/Model");
var Session = require("../model/Session");
var Utils = require("../utils/Utils");
var CODES = require("./../ErrorCodes");

var server = require("../net/PureHttp").createServer();
var JsonAPIMiddleware = require("../net/PureHttp").JsonAPIMiddleware;

var DEBUG = global.VARS && global.VARS.debug;

function CustomMiddleware() {
    var jam = new JsonAPIMiddleware();
    this.preprocess = function(req, res) {

        res.setHeader("Access-Control-Allow-Headers", "IdentifyID, X-Requested-With, X-HTTP-Method-Override, Content-Type, Content-Length, Connection, Origin, Accept, Authorization, userid, token, tokentimestamp");

        req._res = res;
        res._req = req;
        req._clientIP = Utils.parseIP(req);

        var identify_id = req.headers["IdentifyID"];
        if (!identify_id) {
            identify_id = Utils.md5(req.headers["user-agent"] + req._clientIP + Date.now());
            res.setHeader("IdentifyID", identify_id);

            //console.log("new identify_id --> " + identify_id);
        }
        req._identifyID = identify_id;

        jam.preprocess(req, res);
    }

    this.process = function(req, res, data, handler) {
        jam.process(req, res, data, handler);
    }
}

server.middleware(new CustomMiddleware());

if (DEBUG) {
    //show api debug page

    var DEBUG_SERVICE_LIST = [];

    server.get("/apidoc", function(req, res, params) {
        var callback = require("url").parse(req.url, true).query.callback;
        res.end(callback + "(" + JSON.stringify(DEBUG_SERVICE_LIST) + ")");
    });

    server.get("/debug", function(req, res, params) {
        var html = FS.readFileSync(PATH.join(global.APP_ROOT, "client/views/debug.html"), {encoding:"utf8"});
        html = html.replace(/\{\{RES_CDN_DOMAIN\}\}/mg, APP_SETTING.cdn.res);
        html = html.replace(/\{\{SITE_DOMAIN\}\}/mg, APP_SETTING.site);
        html = html.replace(/\{\{API_GATEWAY\}\}/mg, APP_SETTING.site + "api");
        html = html.replace(/\{\{TIME\}\}/mg, Date.now());
        html = html.replace(/\{\{services\}\}/mg, JSON.stringify(DEBUG_SERVICE_LIST));
        res.end(html);
    });
}

var SERVICE_MAP = {};
var APP_SETTING;

server.post("/api", function(req, res, params) {
    var method = params.method;
    if (!method || method == '' || method.indexOf("$") >= 0) {
        res.sayError(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
        return;
    }

    method = method.split(".");
    var service = SERVICE_MAP[method[0]];
    if (!service || !service.hasOwnProperty(method[1])) {
        res.sayError(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
        return;
    }

    var params = params.data;
    if (!params) params = {};
    if (typeof params == "string") {
        try {
            params = JSON.parse(params);
        } catch (err) {
            res.sayError(CODES.REQUEST_PARAMS_INVALID, "JSON.parse(params) error ==> " + err.toString());
            return;
        }
    }

    var auth = params.auth;
    if (auth) {
        if (typeof auth == "string") {
            try {
                auth = JSON.parse(auth);
            } catch (err) {
                res.sayError(CODES.REQUEST_PARAMS_INVALID, "JSON.parse(auth) error ==> " + err.toString());
                return;
            }
        }
    } else {
        auth = null;
    }

    method = method[1];

    if (service.config.security && service.config.security[method]) {
        var security = service.config.security[method];

        var val, prop, checkType, result;
        if (security.checkParams) {
            for (prop in security.checkParams) {
                if (!params.hasOwnProperty(prop)) {
                    res.sayError(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] is required.");
                    return;
                }
                val = params[prop];
                checkType = security.checkParams[prop];
                result = server.checkRequestParam[checkType](val);
                if (result.err) {
                    res.sayError(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] ==> " + result.err.toString());
                    return;
                }
                params[prop] = result.value;
            }
        }

        if (security.optionalParams) {
            for (prop in security.optionalParams) {
                if (!params.hasOwnProperty(prop) || params[prop] == "")  continue;
                val = params[prop];
                checkType = security.optionalParams[prop];
                result = server.checkRequestParam[checkType](val, true);
                if (result.err) {
                    res.sayError(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] ==> " + result.err.toString());
                    return;
                }
                params[prop] = result.value;
            }
        }
        server.handleUserSession(req, res, function(flag, user) {
            if (user && user.isLogined) {
                res.setHeader("userid", user.id);
                res.setHeader("token", user.token);
                res.setHeader("tokentimestamp", user.tokentimestamp);
            }
            if (flag == false) {
                if (security.needLogin != true) {
                    service[method](req, res, params, user);
                } else {
                    res.sayError(CODES.NO_PERMISSION, "NO_PERMISSION");
                }
            } else {
                if (security.allowUserType && security.allowUserType != 1 && security.allowUserType.indexOf(user.type) < 0) {
                    res.sayError(CODES.NO_PERMISSION, "NO_PERMISSION");
                } else {
                    service[method](req, res, params, user);
                }
            }
        }, function(err) {
            res.sayError(CODES.SERVER_ERROR, err);
        }, auth, security);
    } else {
        service[method](req, res, params);
    }
});

server.checkRequestParam = {};

server.checkRequestParam["string"] = function(val, allowEmpty) {
    if (allowEmpty && (!val || val == "")) return { value:val };
    if (!val || val == "") {
        return { value:null, err:new Error("empty string") };
    }
    return { value:val };
}

server.checkRequestParam["json"] = function(val) {
    if (typeof val == "object") return { value:val };
    try {
        val = (val == "{}") ? {} : JSON.parse(val);
    } catch (err) {
        console.error('JSON.parse error ----> ' + val);
        return { value:null, err:err };
    }
    return { value:val };
}

server.checkRequestParam["object"] = function(val) {
    return server.checkRequestParam["json"](val);
}

server.checkRequestParam["array"] = function(val) {
    if (val instanceof Array) {
        return { value:val };
    } else {
        if (typeof val != "object" && typeof val != "string") return { value:null, err:new Error("invalid Array") };

        try {
            val = (val == "[]") ? [] : JSON.parse(val);
        } catch (err) {
            console.error('JSON.parse error ----> ' + val);
            return { value:null, err:err };
        }
        return { value:val };
    }
}

server.checkRequestParam["email"] = function(val) {
    if (!Utils.checkEmailFormat(val)) {
        return { value:null, err:new Error("invalid email") };
    }
    return { value:val };
}

server.checkRequestParam["cellphone"] = function(val) {
    if (!Utils.cnCellPhoneCheck(val)) {
        return { value:null, err:new Error("invalid cellphone") };
    }
    return { value:val };
}

server.checkRequestParam["boolean"] = function(val) {
    if (String(val) != "true" && String(val) != "false" && String(val) != "1" && String(val) != "0") {
        return { value:null, err:new Error("invalid boolean") };
    }
    var flag = (String(val) == "true" || String(val) == "1") ? true : false;
    return { value:flag };
}

server.checkRequestParam["number"] = function(val) {
    if (isNaN(Number(val))) {
        return { value:null, err:new Error("NaN number") };
    }
    return { value:Number(val) };
}

server.checkRequestParam["int"] = function(val) {
    if (isNaN(Number(val))) {
        return { value:null, err:new Error("NaN int") };
    }
    return { value:parseInt(val) };
}

server.checkRequestParam["geo"] = function(val) {
    if (typeof val == "string") {
        val = val.replace(/\s/g, '')
        if (val.indexOf(",") > 0) {
            val = val.split(",");
        } else {
            try {
                val = JSON.parse(val);
            } catch (err) {
                return { value:null, err:new Error("invalid geo") };
            }
        }
    }
    val = [ Number(val[0]), Number(val[1]) ];
    if (isNaN(Number(val[0])) || isNaN(Number(val[1]))) {
        return { value:null, err:new Error("invalid geo") };
    }
    return { value:val };
}

server.handleUserSession = function(req, res, next, error, auth) {

    var user = { isLogined:false };

    var userid = auth ? auth.userid : null;

    if (userid) {
        var token = auth ? auth.token : null;
        var tokentimestamp = Number(auth ? auth.tokentimestamp : 0);
        if (!token || !tokentimestamp || tokentimestamp <= 0) {
            //no cookies...
            next(0, user);
        } else {
            Session.check(userid, token, function(flag, sess, err) {
                if (err) {
                    error(err);
                } else {
                    if (flag == 1) {
                        //get user info from cache
                        Model.cacheRead(["user_info", userid], function(uc) {
                            if (uc) {
                                user = uc;
                            }
                            user.isLogined = true;
                            user.id = userid;
                            user.userid = userid;
                            user.token = token;
                            user.tokentimestamp = tokentimestamp;
                            user.type = parseInt(sess.type);
                            next(1, user);
                        });
                    } else {
                        next(0, user);
                    }
                }
            });
        }
    } else {
        next(0, user);
    }
}

exports.start = function(setting, callBack) {
    APP_SETTING = setting;

    Session.init(setting.session);

    if (setting.session.noAuth) {
        server.handleUserSession = function(req, res, next, error, auth) {
            var user = { isLogined:false };
            next(0, user);
        }
    }

    var doRegisterService = function(path, file) {
        path = path.replace(global.APP_ROOT, "").replace("\\server\\", "").replace("/server/", "").replace("\\", "/");
        var service = global.requireModule(path + "/" + file);
        if (service.config && service.config.name && service.config.enabled == true) {
            SERVICE_MAP[service.config.name] = service;

            if (DEBUG_SERVICE_LIST) {
                var methods = [];
                for (var key in service) {
                    var val = service[key];
                    if (typeof val != "function" || key.indexOf("$") == 0) continue;
                    if (val.valueOf().toString().indexOf("(req, res,") > 0) {
                        var security = service.config.security && service.config.security[key] ? service.config.security[key] : {};
                        methods.push({ name: service.config.name + "." + key, security:security, index:methods.length });
                    }
                }
                DEBUG_SERVICE_LIST.push({ index:DEBUG_SERVICE_LIST.length, group:file.replace("Service.js", ""), methods:methods });
            }
        }
    }

    var checkFolder = function(path, handler) {
        var files = [];
        try {
            files = FS.readdirSync(path);
        } catch (exp) {
            return;
        }
        files.forEach(function(rf) {
            if (rf.substr(rf.length - 3, 3) == ".js") {
                handler(path, rf);
            } else {
                checkFolder(PATH.join(path, rf), handler);
            }
        });
    }

    //init services
    var serviceFolder = PATH.join(global.APP_ROOT, "server/service");
    if (FS.existsSync(serviceFolder)) {
        checkFolder(PATH.join(global.APP_ROOT, "server/service"), doRegisterService);
    }

    var port = setting.port;

    server.start({ port:port, ip:setting.host });
    console.log("Starting APIServer at port: " + port);

    process.nextTick(function() {
        if (callBack) callBack(server);
    });

    return server;
};