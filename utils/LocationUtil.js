/**
 * Created by Jay on 2015/10/26.
 */

var FS = require('fs');
var PATH = require('path');
var _ = require("underscore");

var Redis = require("../model/Redis");

var LOCATIONS;

exports.init = function(callBack) {
    var redisKey = Redis.join("@common->locations");
    Redis.do("hgetall", [ redisKey ], function(res, err) {
        LOCATIONS = {};
        LOCATIONS.province = JSON.parse(res.province);
        LOCATIONS.provinceCode = JSON.parse(res.provinceCode);
        LOCATIONS.city = JSON.parse(res.city);
        LOCATIONS.cityCode = JSON.parse(res.cityCode);
        LOCATIONS.county = JSON.parse(res.county);
        LOCATIONS.countyCode = JSON.parse(res.countyCode);

        if (callBack) callBack();
    });
}

exports.getProvinceName = function(code) {
    return LOCATIONS.province[code] ? LOCATIONS.province[code] : "";
}

exports.getProvinceCode = function(name) {
    return LOCATIONS.provinceCode[name] ? LOCATIONS.provinceCode[name] : "";
}

exports.getCityName = function(code) {
    return LOCATIONS.city[code] ? LOCATIONS.city[code] : "";
}

exports.getCityCodes = function(name) {
    return LOCATIONS.cityCode[name] ? LOCATIONS.cityCode[name] : [];
}

exports.getCityCode = function(pcode, name) {
    var codes = LOCATIONS.cityCode[name] ? LOCATIONS.cityCode[name] : [];
    if (codes.length == 0) return "";
    if (codes.length == 1) return codes[0] ? codes[0] : "";

    var temp = pcode.substr(0, 2);
    var code = _.find(codes, function(code){ return code.substr(0, 2) == temp; });
    return code ? code : "";
}

exports.getCountyName = function(code) {
    return LOCATIONS.county[code] ? LOCATIONS.county[code] : "";
}

exports.getCountyCodes = function(name) {
    return LOCATIONS.countyCode[name] ? LOCATIONS.countyCode[name] : [];
}

exports.getCountyCode = function(ccode, name) {
    var codes = LOCATIONS.countyCode[name] ? LOCATIONS.countyCode[name] : [];
    if (codes.length == 0) return "";
    if (codes.length == 1) return codes[0] ? codes[0] : "";

    var temp = ccode.substr(0, 4);
    var code = _.find(codes, function(code){ return code.substr(0, 4) == temp; });
    return code ? code : "";
}