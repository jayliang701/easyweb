/**
 * Created by Jay on 2015/8/30.
 */

var HTTPRequest = require("./HTTPRequest");

var EXPRESS  = require('express');
var BODY_PARSER = require('body-parser');
var METHOD_OVERRIDE = require('method-override');
var COOKIE = require("cookie-parser");

var App = EXPRESS();
App.use(BODY_PARSER.urlencoded({ extended: true }));
App.use(BODY_PARSER.json());
App.use(METHOD_OVERRIDE());
App.use(COOKIE());

var Agent;

App.post("/api", function (req, res) {
    var hr = new HTTPRequest(req, res);
    Agent.process(hr);
});

exports.start = function(agent, options, callBack) {
    Agent = agent;
    App.listen(options.port);
    console.log("HTTPServer is running on port: " + options.port);
    if (callBack) setTimeout(callBack, 500);
}