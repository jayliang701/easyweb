/**
 * Created by Jay on 7/29/15.
 */

var SWIG
var Utils = require("./Utils.js");

var WEEK_DAY_CN = [ '周日', '周一', '周二', '周三', '周四', '周五', '周六' ];

var CDN_URL = "";

var FILTER_MAP = {};

exports.init = function(cdnUrl) {
    SWIG = require("swig");
    CDN_URL = cdnUrl;
    if (CDN_URL.charCodeAt(CDN_URL.length - 1) == "/") CDN_URL = CDN_URL.substr(0, CDN_URL.length - 1);

    exports.addFilter('cdn', cdn);
    exports.addFilter('number_toFixed', number_toFixed);
    exports.addFilter('datetime_isDiffDate', datetime_isDiffDate);
    exports.addFilter('datetime_format', datetime_format);
}

exports.addFilter = function(key, func) {
    if (FILTER_MAP[key]) return;
    SWIG.setFilter(key, func);
    FILTER_MAP[key] = func;
}

function cdn(url, placeholder) {
    if (String(url).hasValue()) {
        return CDN_URL + "/" + url;
    } else {
        return placeholder;
    }
}

function number_toFixed(val, fixed) {
    return Number(val).toFixed(fixed);
}

function datetime_isDiffDate(time1, time2) {
    var dt1 = new Date();
    dt1.setTime(time1);

    var dt2 = new Date();
    dt2.setTime(time2);
    return dt1.getDate() != dt2.getDate();
}

function datetime_format(time, format) {
    return DateTimeFormatter["format_" + format](time);
}

var DateTimeFormatter = {
    format_YMD: function(time) {
        var dt = new Date();
        dt.setTime(time);
        return Utils.convertTimeToDate(dt.getTime(), false, 'en');
    },
    format_YMD_W: function(time) {
        var dt = new Date();
        dt.setTime(time);
        return Utils.convertTimeToDate(dt.getTime(), false, 'en') + ' ' + WEEK_DAY_CN[dt.getDay()];
    },
    format_HM: function(time) {
        return Utils.getTimeHourAndMin(time, true);
    },
    format_YMD_HM: function(time) {
        var dt = Utils.convertTimeToDate(time, true, 'en');
        dt = dt.substr(0, dt.length - 3);
        return dt;
    }
}




