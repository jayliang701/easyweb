/**
 * Created by Jay on 2015/8/30.
 */
var BufferHelper = require('bufferhelper');

var PACKET_HEAD = "@HEAD@";
var PACKET_END = "@END@";

var DEBUG = false;

var SocketPacket = function(socket) {
    this.instance = this;
    this.bufferHelper = new BufferHelper();
    this.bufferSize = 0;
    this.packetHeadIndex = -1;
    this.packetEndIndex = -1;

    this.lastSendTime = 0;
    this.sendPacketIndex = 0;

    this.requestPool = {};

    this.dispose = function() {
        this.requestPool = {};
        if (this.bufferHelper) {
            this.bufferHelper.empty();
        }
    }

    this.socket = socket;
    socket.__packet = this;
    socket.__read = read;
    socket.__readEnd = readEnd;
    socket.on("data", socket.__read);
    socket.send = send;

}

function readEnd() {
    var packet = this.__packet;
    var buff = packet.bufferHelper.toBuffer();
    packet.bufferHelper.empty();
    packet.bufferSize = 0;
    return buff;
}

function read(src) {
    var packet = this.__packet;
    var chunk = new Buffer(src);
    var cst = src.toString("utf8");
    var hi = cst.indexOf(PACKET_HEAD);
    var ei = cst.indexOf(PACKET_END);
    packet.bufferHelper.concat(chunk);

    if (hi >= 0) {
        packet.packetHeadIndex = packet.bufferSize + hi;
        if (DEBUG) console.log("found packet head...");
    }

    if (ei >= 0) {
        packet.packetEndIndex = packet.bufferSize + ei;
        if (DEBUG) console.log("found packet end...");
    }

    packet.bufferSize += chunk.length;
    if (packet.packetHeadIndex >= 0 && packet.packetEndIndex > 0 && packet.packetEndIndex > packet.packetHeadIndex) {

        //get packet
        var allBuffer = this.__readEnd();
        var packetSize = packet.packetEndIndex - packet.packetHeadIndex - PACKET_HEAD.length;
        if (DEBUG) console.log("packetSize = " + packetSize);
        //drop illegal data before head flag
        allBuffer = allBuffer.slice(packet.packetHeadIndex + PACKET_HEAD.length);
        if (DEBUG) console.log("allBuffer.length = " + allBuffer.length);
        //get packet
        var packetBuffer = new Buffer(allBuffer.toString('utf8', 0, packetSize));
        if (DEBUG) console.log("packetBuffer = " + packetBuffer.toString('utf8'));

        allBuffer = allBuffer.slice(packetSize + PACKET_END.length);
        if (DEBUG) console.log("reset packet ==> " + allBuffer.toString('utf8'));

        packet.packetHeadIndex = -1;
        packet.packetEndIndex = -1;

        if (allBuffer.length == 0) {
            var resData = packetBuffer.toString("utf8");
            var packetID = null;
            var packetData = null;
            var resErr;
            try {
                resData = JSON.parse(decodeURIComponent(resData));
                packetID = resData[0];
                packetData = resData[1];
            } catch (exp) {
                //not a json format
                resData = null;
                packetID = null;
                packetData = null;
                resErr = exp;
            }

            if (packetID) {
                var code = packetData[0];
                if (code == 1 && packetData[2] && packetData[2]["__rpid"]) {
                    var clientSendPacketID = packetData[2]["__rpid"];
                    var req = packet.requestPool[clientSendPacketID];
                    if (req) {
                        if (req.callBack) {
                            req.callBack(packetData, resErr);
                        }
                        delete packet.requestPool[packetID];
                    }
                } else {
                    this.emit("push", packetID, packetData);
                }
            } else {
                this.emit("error", resErr);
            }
        } else {
            this.__read(allBuffer);
        }
    } else {
        console.log("pending packet reading...");
    }
}

function send(data, callBack) {
    var packet = this.__packet;
    var now = Date.now();
    var sendTime = packet.lastSendTime;
    if (sendTime == now) {
        packet.sendPacketIndex ++;
    } else {
        sendTime = now;
        packet.sendPacketIndex = 0;
    }
    var packetID = sendTime + ":" + packet.sendPacketIndex;
    packet.lastSendTime = sendTime;

    packet.requestPool[packetID] = { id:packetID, sendTime:sendTime, callBack:callBack };

    var packet = [ packetID, data ];
    this.write(PACKET_HEAD + encodeURIComponent(JSON.stringify(packet)) + PACKET_END);
}

module.exports = SocketPacket;