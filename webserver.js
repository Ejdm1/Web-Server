const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const spawn = require("child_process").spawn;
const exec = require("child_process").exec;
const fs = require("fs");
const osu = require("node-os-utils");
const moment = require("moment");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const cpu = osu.cpu;
const mem = osu.mem;

var pcSwitched = false;
var value;
var counter = 0;
var pcIsOn;

app.use(express.static(__dirname + '/public'));

server.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});

function executePing() {
  exec("ping -c 1 192.168.1.105", function(err, stdout, stderr) {
      function myFunc() {
        if(err == null) {
          return true
        }
        else if(err != null) {
          return false
        }
      }
      if(pcIsOn) {
        if(counter > 2) {pcSwitched = false; counter = 0;}
      }
      else if(!pcIsOn) {
        if(counter > 15) {pcSwitched = false; counter = 0;}
      }
      if(!pcSwitched) {
        pcIsOn = myFunc();
      }
      if(pcIsOn && !pcSwitched) {
        value = 1;
      }
      else if(!pcIsOn && !pcSwitched) {
        value = 0;
      }
      else if(!pcIsOn && pcSwitched) {
        value = 3;
        counter++;
      }
      else if(pcIsOn && pcSwitched) {
        value = 2;
        counter++;
      }
    io.emit('outStatus', value);
    })
}

function getStats() {
    const getHumid = spawn('bash', ['/home/ejdm/get_humid.sh']);
    const getTemp = spawn('bash', ['/home/ejdm/get_temp.sh']);

    getTemp.stdout.on('data', (data) => {
        io.emit('roomTemp',`${data}`/1000);
    });
    getHumid.stdout.on('data', (data) => {
        io.emit('roomHumid',`${data}`/1000);
    });
    cpu.usage().then(cpuPercentage => {io.emit('cpuU', cpuPercentage)})
    mem.info().then(memPercentage => {io.emit('memU', (100-memPercentage.freeMemPercentage).toFixed(2))})
    var temp = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp");
    io.emit('temp', (temp/1000));
    io.emit('time', moment().format('ddd DD/MM HH:mm:ss'));
}

setInterval(executePing,3*1000);
  
setInterval(getStats,1*1000);

io.on('connection', (socket) => {
  console.log("Client connected");
  
  getStats()
  
  socket.on('light', (data) => {
    console.log("Power switched");
    pcSwitched = true;
    
    const pythonProcess = spawn('python',["/home/ejdm/gpio_out.py"]);
  });
  
  socket.on('reboot', (confirmation) => {
    if(confirmation) {
      console.log("Rebooting...");
      spawn('reboot',[]); 
    }
    else {
      console.log("Reboot stoped")
    }
  });
});
