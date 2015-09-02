var HTTP = require('http');
var Async = require('async');
var ICONV = require('iconv-lite');
var BufferHelper = require('bufferhelper');

require("console-stamp")(console, "yyyy-mm-dd HH:MM:ss");

String.prototype.fillData = function(key, value) {
    return this.replace(new RegExp("\\{" + key + "\\}", "g"), value);
}

String.prototype.hasValue = function() {
    return this != "undefined" && this != "null" && this != "";
}

exports.runQueueTask = function(tasks, callBack) {
    return Async.waterfall(tasks, callBack);
}

exports.cloneObject = function(obj) {
    return JSON.parse(JSON.stringify(obj));
}

exports.md5 = function(str) {
    var buf = new Buffer(str);
    str = buf.toString("binary");

    var hash = require("crypto").createHash("md5");
    return hash.update(str).digest("hex");
}

exports.rsa = function(privateKey, plain) {
    var buf = new Buffer(plain);
    plain = buf.toString("binary");

    var sign = require("crypto").createSign('RSA-SHA1');
    sign.update(plain);

    return sign.sign(privateKey, 'base64');
}

exports.randomString = function(len) {
    var parts = [
        [ 48, 57 ], //0-9
        [ 65, 90 ], //A-Z
        [ 97, 122 ]  //a-z
    ];

    var pwd = "";
    for (var i = 0; i < len; i++)
    {
        var part = parts[Math.floor(Math.random() * parts.length)];
        //trace(part[0], part[1], Math.floor(Math.random() * (part[1] - part[0])));
        var code = part[0] + Math.floor(Math.random() * (part[1] - part[0]));
        var c = String.fromCharCode(code);
        pwd += c;
    }
    return pwd;
}

exports.randomNumber = function(len) {
    var parts = [
        [ 48, 57 ] //0-9
    ];

    var pwd = "";
    for (var i = 0; i < len; i++)
    {
        var part = parts[0];
        //trace(part[0], part[1], Math.floor(Math.random() * (part[1] - part[0])));
        var code = part[0] + Math.floor(Math.random() * (part[1] - part[0]));
        var c = String.fromCharCode(code);
        pwd += c;
    }
    return pwd;
}

exports.getCookieValue = function(cookies, key) {
    if (!isNaN(Number(cookies[key]))) return cookies[key];

    var val = decodeURIComponent(cookies[key]);
    val = val.trim();
    if (val.charAt(0) == "'" && val.charAt(val.length - 1) == "'") {
        return val.substr(1, val.length - 2);
    }
    return val;
}

exports.convertQueryFields = function(fields) {
    var fieldParams = {};
    fields = fields.split(",");
    for (var i = 0; i < fields.length; i++) {
        if (fields[i] && fields[i] != "") fieldParams[fields[i]] = 1;
    }
    return fieldParams;
}

exports.hashMapToArray = function(map, json, loopFunc) {
    var list = [];
    for (var key in map) {
        var obj = json ? JSON.parse(map[key]) : map[key];
        list.push(obj);
        if (loopFunc != null) {
            loopFunc(obj, key, map);
        }
    }
    return list;
}

exports.sortArrayByNumber = function(arr, field, order, func) {
    if (isNaN(order)) order = 1;
    arr.sort(function(value1, value2){
        if (func) func(value1, value2);
        if(value1[field] > value2[field]){
            return order * -1;
        } else if(value1[field] < value2[field]){
            return order * 1;
        } else{
            return 0;
        }
    } );
}

exports.convertArrayToHash = function(arr, key, dataHandler) {
    var map = {};
    arr.forEach(function(obj) {
        map[obj[key]] = dataHandler != null ? dataHandler(obj) : obj;
    });
    return map;
}

exports.convertDateString = function(date, spe) {
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();

    spe = spe ? spe : "";

    return y + spe + (m < 10 ? ("0" + m) : m) + spe + (d < 10 ? ("0" + d) : d);
}

exports.convertDateStringToTime = function(dateStr) {
    var parts = dateStr.split(" ");
    var dateArr = parts[0];
    var year;
    var month;
    var day;
    if (dateArr.indexOf("-") > 0) {
        dateArr = dateStr.split("-");
        year = dateArr[0];
        month = dateArr[1];
        day = dateArr[2];
    } else if (dateArr.indexOf("/") > 0) {
        dateArr = dateStr.split("/");
        year = dateArr[0];
        month = dateArr[1];
        day = dateArr[2];
    } else if (dateArr.indexOf(".") > 0) {
        dateArr = dateStr.split(".");
        year = dateArr[0];
        month = dateArr[1];
        day = dateArr[2];
    } else if (dateArr.indexOf("年") > 0) {
        year = dateStr.substring(0, dateStr.indexOf("年"));
        month = dateStr.substring(dateStr.indexOf("年") + 1, dateStr.indexOf("月"));
        day = dateStr.substring(dateStr.indexOf("月") + 1, dateStr.indexOf("日"));
    }

    var dt = new Date();
    dt.setYear(parseInt(year));
    dt.setMonth(parseInt(month) - 1);
    dt.setDate(parseInt(day));
    dt.setHours(0);
    dt.setMinutes(0);
    dt.setSeconds(0);
    dt.setMilliseconds(0);

    if (parts.length > 1) {
        try {
            var timeStr = parts[1];
            if (timeStr.indexOf(":") > 0) {
                var timeArr = timeStr.split(":");
                dt.setHours(parseInt(timeArr[0]));
                dt.setMinutes(parseInt(timeArr[1]));
                dt.setSeconds(timeArr.length > 2 ? parseInt(timeArr[2]) : 0);
            } else if (timeStr.indexOf("时") > 0) {
                var hh = timeStr.substring(0, timeStr.indexOf("时"));
                dt.setHours(parseInt(hh));
                if(timeStr.indexOf("分") > 0) {
                    var mm = timeStr.substring(timeStr.indexOf("时") + 1, timeStr.indexOf("分"));
                    dt.setMinutes(parseInt(mm));
                }
                if(timeStr.indexOf("秒") > 0) {
                    var ss = timeStr.substring(timeStr.indexOf("分") + 1, timeStr.indexOf("秒"));
                    dt.setSeconds(parseInt(ss));
                }
            }
        } catch (err) {
            return dt.getTime();
        }
    }
    return dt.getTime();
}

exports.convertDateTimeString = function(date, needSec, dateSpe, dateTimeSpe, timeSpe) {
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();

    var hh = date.getHours();
    var mm = date.getMinutes();
    var ss = date.getSeconds();

    dateSpe = dateSpe ? dateSpe : "";

    dateTimeSpe = dateTimeSpe ? dateTimeSpe : "";

    timeSpe = timeSpe ? timeSpe : "";

    return y + dateSpe + (m < 10 ? ("0" + m) : m) + dateSpe + (d < 10 ? ("0" + d) : d) + dateTimeSpe + (hh < 10 ? ("0" + hh) : hh) + timeSpe + (mm < 10 ? ("0" + mm) : mm) + (needSec ? (timeSpe + (ss < 10 ? ("0" + ss) : ss)) : "");
}

exports.convertSecToTimeStr = function(val, lang, allShow) {
    var str = '';
    var min = Math.floor(val / 60);
    var sec = val - min * 60;
    if (sec > 0) {
        str = (sec >= 10 ? sec : ('0' + sec)) + (lang == 'en' ? '' : '秒');
    } else {
        str = '';
    }
    var hour = Math.floor(min / 60);
    min = min - hour * 60;
    if (min > 0 || allShow) str = (min >= 10 ? min : ('0' + min)) + (lang == 'en' ? ':' : '分') + str;
    if (hour > 0 || allShow) str = (hour >= 10 ? hour : ('0' + hour)) + (lang == 'en' ? ':' : '小时') + str;
    return str;
}

exports.convertTimeToDate = function(time, toTime, lang) {
    var date = new Date();
    date.setTime(time);
    var m = date.getMonth() + 1;
    var d = date.getDate();
    var str = lang == "en" ? date.getFullYear() + "-" + (m >= 10 ? m : ('0' + m)) + "-" + (d >= 10 ? d : ('0' + d)) : date.getFullYear() + "年" + (m >= 10 ? m : ('0' + m)) + "月" + (d >= 10 ? d : ('0' + d)) + "日";
    if (toTime) {
        str += " " + (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + ":" + (date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds());
    }
    return str;
}

exports.getTimeHourAndMin = function(time, noSec) {
    var date = new Date();
    date.setTime(time);
    var str = (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes());
    if (!noSec) {
        str += ":" + (date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds());
    }
    return str;
}

exports.changeDay = function(date, passDay) {
    var todayStart = new Date();
    todayStart.setTime(date.getTime());
    todayStart = todayStart.getTime();
    todayStart += passDay * 24 * 60 * 60 * 1000;
    var day = new Date();
    day.setTime(todayStart);
    return day;
}

exports.propertyJsonParse = function(obj, clone) {
    var temp = {};
    if (!clone) {
        temp = obj;
    }
    for (var key in obj) {
        var val = obj[key];
        if (typeof val == 'string' && (String(val).indexOf('{}') == 0 || String(val).indexOf('{"') == 0 || String(val).indexOf('[]') == 0 || String(val).indexOf('[{') == 0 || String(val).indexOf('[[') == 0)) {
            try {
                temp[key] = JSON.parse(obj[key]);
            } catch (err) {
                console.error("Utils.propertyJsonParse throw an error ==> " + err.toString());
            }
        } else if (clone) {
            temp[key] = obj[key];
        }
    }
    return temp;
}

exports.propertyJsonStringify = function(obj, clone) {
    var temp = {};
    if (!clone) {
        temp = obj;
    }
    for (var key in obj) {
        var val = obj[key];
        if (typeof val == 'object') {
            try {
                temp[key] = JSON.stringify(obj[key]);
            } catch (err) {
                console.error("Utils.propertyJsonStringify throw an error ==> " + err.toString());
            }
        } else if (clone) {
            temp[key] = obj[key];
        }
    }
    return temp;
}

//验证邮箱地址
exports.checkEmailFormat = function(str){
    if (!str || str == "" || str == "undefined") return false;
    var re = /^(\w-*\.*)+@(\w-?)+(\.\w{2,})+$/;
    return re.test(str);
}

//验证电话号码，手机或座机
exports.checkPhoneFormat = function(str){
    if (!str || str == "" || str == "undefined") return false;
    var re = /^1\d{10}$/;
    if (!re.test(str)) {
        re = /^0\d{2,3}-?\d{7,8}$/;
        return re.test(str);
    } else {
        return true;
    }
}

//验证大陆手机号码
exports.cnCellPhoneCheck = function(str){
    if (!str || str == "" || str == "undefined") return false;
    var re = /^1\d{10}$/;
    return re.test(str);
}

exports.getFromUrl = function(url, callBack, option){
    if (option && option.debug) console.log("ready to request [" + url + "]...");
    if (option && option.debug) option._startTime = Date.now();
    var req = HTTP.get(url,function(res){
        var buffer = new BufferHelper();
        res.on("data", function(data){
            if (req._isTimeout == true) {
                if (option && option.debug) console.log("ops! time out....<data>");
                return;
            }
            if (option && option.debug) console.log("request response data ==> " + data.length + " bytes");
            buffer.concat(data);
        }).on("end",function(){

            clearTimeout(req._timeoutTimer);

            if (req._isTimeout == true) {
                if (option && option.debug) console.log("ops! time out....<end>");
                return;
            }

            var buf = buffer.toBuffer();
            if (option && option.debug) {
                option._costTime = Date.now() - option._startTime;
                console.log("request end ==> " + buf.length + " bytes     " + option._costTime + "ms");
            }

            //var buf = new Buffer(html,'binary');
            var str = ICONV.decode(buf, (option && option.encoding) ? option.encoding : "utf8");
            callBack(str);
        }).on("close",function(){
            callBack(null, new Error("request connection has been closed."));
        });
    });
    req.on('error',function(err){
        callBack(null, err);
    });
    if (option && option.timeout && option.timeout > 0) {
        req._timeoutTimer = setTimeout(function() {
            req._isTimeout = true;
            clearTimeout(req._timeoutTimer);
            if (option.debug) console.log("request timeout (" + option.timeout + "s).");
            callBack(null, new Error("request timeout."));
        }, option.timeout * 1000);
    }
    return req;
}

exports.html_encode = function(str) {
    var s = "";
    if (str.length == 0) return "";
    s = str.replace(/&/img, "&gt;");
    s = s.replace(/</img, "&lt;");
    s = s.replace(/>/img, "&gt;");
    s = s.replace(/ /img, "&nbsp;");
    s = s.replace(/\'im/g, "&#39;");
    s = s.replace(/\"/img, "&quot;");
    s = s.replace(/\n/img, "<br>");
    s = s.replace(/“/img, "&ldquo;");
    s = s.replace(/”/img, "&rdquo;");
    return s;
}

exports.html_decode = function(str) {
    var s = "";
    if (str.length == 0) return "";
    s = str.replace(/&gt;/img, "&");
    s = s.replace(/&lt;/img, "<");
    s = s.replace(/&gt;/img, ">");
    s = s.replace(/&nbsp;/img, " ");
    s = s.replace(/&#39;/img, "\'");
    s = s.replace(/&quot;/img, "\"");
    s = s.replace(/<br>/img, "\n");
    s = s.replace(/&ldquo;/img, "“");
    s = s.replace(/&rdquo;/img, "”");
    return s;
}

exports.parseIP = function (req) {
    try {
        var ip = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
        return ip;
    } catch (err) {
        return "unknown"
    }
}

exports.generateIdentifyID = function (req) {
    var identifyID = req.headers["user-agent"];
    identifyID += exports.parseIP(req);
    identifyID = exports.md5(identifyID);
    return identifyID;
}

var TIME_RECORD = {};

exports.startRecordTime = function(id) {
    TIME_RECORD[id] = Date.now();
}

exports.getCostTime = function(id) {
    var time = Date.now() - TIME_RECORD[id];
    delete TIME_RECORD[id];
    return time;
}

exports.createAsyncThen = function() {

    var funcRes = {
        execLazy:function() {
            var ins = this;
            var args = arguments;
            setTimeout(function() {
                ins.exec.apply(ins, args);
            }, 10);
        },
        exec:function() {
            if (this.cb) {
                this.cb.apply(this, arguments);
            }
        },
        then:function(cb) {
            this.cb = cb;
        }
    };
    return funcRes;
}