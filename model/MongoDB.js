/**
 * Created by Jay on 2015/8/24.
 */

var dbOption = {
    w:-1,// 设置w=-1是mongodb 1.2后的强制要求，见官方api文档
    logger:{
        doDebug:true,
        debug:function(msg,obj){
            console.log('[debug]',msg);
        },
        log:function(msg,obj){
            console.log('[log]',msg);
        },
        error:function(msg,obj){
            console.log('[error]',msg);
        }
    }
};

var mongodb = require("mongodb");

var dbMap = {};

var defaultDB;

function open(host, port, name, option, callBack, asDefault) {
    var newDB = new mongodb.Db(name, new mongodb.Server(host, port, option), dbOption);
    dbMap[name] = newDB;
    newDB.open(function(err, db){
        if (err) {
            console.error(err);
            delete dbMap[name];
            if (callBack) {
                callBack(false, err);
            }
        } else {
            if (asDefault) {
                defaultDB = newDB;
            }
            //console.log(defaultDB);
            console.log("Database connection[" + name + "] init completed. ");
            if (callBack) {
                callBack(true);
            }
        }
    });
    return newDB;
}

function getDBByName(dbName) {
    return dbName ? dbMap[dbName] : defaultDB;
}

function insert(dbName, target, data, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    db.collection(target).save(data, {upsert:true}, function(err, res){
        if (err) {
            console.log(err);
        }
        if (callBack) {
            callBack(res ? res : {}, err);
        }
    });
}

function insertList(dbName, target, list, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    db.collection(target).insert(list, function(err, res){
        if (err) {
            console.error(err);
        }
        if (callBack) {
            callBack(res ? res : [], err);
        }
    });
}

function find(dbName, target, callBack, filter, fields, sort, pagination) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);
    var args = [];
    args.push(filter ? filter : {});
    var opt = {};
    if (fields) opt.fields = fields;
    if (sort) opt.sort = sort;
    if (pagination)  {
        opt.limit = pagination.num;
        opt.skip = pagination.index * opt.limit;
    }
    args.push(opt);
    args.push(function(err1, cursor) {
        if (err1) {
            console.error(target + ".find failed ==> " + err1);
            if (callBack) {
                callBack(null, err1);
            }
            return;
        }
        cursor.toArray(function(err2, items) {
            if (err2) console.error(target + ".find.toArray failed ==> " + err2);
            //console.log(target + ".find complete ==> items.length: " + (items ? items.length : 0));
            if (callBack) {
                callBack(items, err2);
            }
        });
    });
    targetCol.find.apply(targetCol, args);
}

function findOne(dbName, target, callBack, filter, fields) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);
    var args = [];
    args.push(filter ? filter : {});
    var opt = {};
    if (fields) opt.fields = fields;
    args.push(opt);
    args.push(function(err, obj) {
        if (err) console.error(target + ".findOne failed ==> " + err);
        if (callBack) {
            callBack(obj, err);
        }
    });
    targetCol.findOne.apply(targetCol, args);
}

function findPage(dbName, target, startIndex, pageNum, callBack, filter, fields, sort) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);

    filter = filter ? filter : {};

    var cursor = targetCol.find(filter, {fields:fields});
    cursor.count(function(err, totalNum) {
        if (err) {
            if (callBack) {
                callBack(null, -1, err);
            }
        } else {
            if (sort) {
                cursor = cursor.sort(sort);
            }
            cursor.skip(parseInt(startIndex) * parseInt(pageNum)).limit(parseInt(pageNum)).toArray(function(err, items) {
                if (err) console.error(target + ".find.sort.skip.limit.toArray failed ==> " + err);
                if (callBack) {
                    callBack(items, totalNum, err);
                }
            });
        }
    });
}

function count(dbName, target, callBack, filter) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);
    targetCol.count(filter ? filter : {},
        function(err, count) {
            if (err) console.error(target + ".count failed ==> " + err);
            if (callBack) {
                callBack(err ? 0 : count, err);
            }
        });
}

function update(dbName, target, filter, params, callBack, upsert) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }
    var targetCol = db.collection(target);

    var changes = {};
    if (params.hasOwnProperty("$set")) {
        changes["$set"] = params["$set"];
    }
    if (params.hasOwnProperty("$push")) {
        changes["$push"] = params["$push"];
    }
    if (params.hasOwnProperty("$inc")) {
        changes["$inc"] = params["$inc"];
    }

    if (!params.hasOwnProperty("$set") &&
        !params.hasOwnProperty("$push") &&
        !params.hasOwnProperty("$inc")) {
        changes = { "$set" : params } ;
    }
    //console.log(JSON.stringify(changes));
    targetCol.update(filter,
        changes,
        {upsert:upsert ? true : false, multi:true, w:1},
        function(err, result) {
            if (err) console.error(target + ".update failed ==> " + err);
            var numUp = 0;
            try {
                if (typeof result == "object") {
                    numUp = result && result.result && result.result.n ? parseInt(result.result.n) : 0;
                } else {
                    numUp = parseInt(result);
                }
            } catch (exp) {
                numUp = 0;
            }
            if (callBack) {
                callBack(numUp, err);
            }
        });
}

function ensureIndex(dbName, target, key, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);

    var indexes;
    if (typeof key == 'object') {
        indexes = {};
        key.forEach(function(ikey) {
            indexes[ikey] = 1;
        });
    } else {
        indexes = {};
        indexes[key] = 1;
    }
    targetCol.ensureIndex(indexes, function() {
        if (callBack) callBack();
    });
}

function remove(dbName, target, filters, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);
    targetCol.remove.apply(targetCol, filters.concat([{w:1},
        function(err, result) {
            var removedNum = 0;
            if (err) {
                console.error(target + ".remove failed ==> " + err);
            } else {
                if (typeof result == "object") {
                    removedNum = result && result.result && result.result.n ? parseInt(result.result.n) : 0;
                } else {
                    removedNum = parseInt(result);
                }
                //console.log(target + ".remove " + removedNum + " docs from " + target + ".");
            }

            if (callBack) {
                callBack(removedNum, err);
            }
        }]));
}

function listAllCollections(dbName, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    db.collections(function() {
        if (callBack) callBack(arguments[1]);
    });
}

function close(dbName, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack({}, createNotOpenErr(dbName));
        }
        return;
    }

    db.close(function(err) {
        setTimeout(function() {
            if (err) {
                console.error(err);
                if (callBack) {
                    callBack(false, err);
                }
            } else {

                delete dbMap[dbName];

                console.error("DBModel connection[" + dbName + "] has been closed.");
                if (callBack) {
                    callBack(true);
                }
            }
        }, 500);
    });
}

function isOpen(dbName) {
    return dbMap[dbName] ? true : false;
}

function createNotOpenErr(dbName) {
    return new Error("DBModel connection[" + dbName + "] is not opened.");
}


exports.open = open;
exports.close = close;
exports.isOpen = isOpen;
exports.insert = insert;
exports.insertList = insertList;
exports.find = find;
exports.findOne = findOne;
exports.findPage = findPage;
exports.ensureIndex = ensureIndex;
exports.listAllCollections = listAllCollections;
exports.count = count;
exports.update = update;
exports.remove = remove;

