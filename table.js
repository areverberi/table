var express = require('express'),
  http = require('http'),
  app = express(),
  server = http.createServer(app).listen(1337),
  io = require('socket.io').listen(server),
  bp = require('body-parser'),
  mongoose = require('mongoose'),
  multer = require('multer'),
  save = require('./routes/save'),
  tableOps = require('./routes/tableOps'),
  xlsxOps = require('./routes/xlsxOps');

mongoose.connect('mongodb://localhost/table');
var Tupd = require('./models/cellModel').Tupd;
var Lupd = require('./models/layoutModel').Lupd;
var Fupd = require('./models/formatModel').Fupd;
var Lock = require('./models/lockModel').Lock;
 
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(function(req, res, next){
  req.io = io;
  next();
});
app.use(express.static(__dirname + '/public'));
app.use(bp.json());

io.sockets.on('connection', function(socket){
  socket.on('datalock-req', function(data, callback){
    Lock.count(data, function(err,count){
      if(err)
        return;
      if(count>0)
        callback({accepted: false});
      else
      {
        var newLock= new Lock({row:data.row, col:data.col, socket: socket.id, table:{name:data.table.name}});
        newLock.save(function(err, newLock){
          if(err)
          {
            callback({accepted: false});
          }
          else
          {
            socket.broadcast.emit('datalock', data);
            callback({accepted: true});
          }
        });
      }
    });
  });
  socket.on('disconnect', function(){
    Lock.findOneAndRemove({socket:socket.id}, function(err, numAffected, raw){});
  });
  socket.on('datalock-lift', function(data){
    socket.broadcast.emit('datalock-lift', data);
    Lock.findOneAndRemove(data, function(err, numAffected, raw){});
  });
});
app.post('/upload', multer({
  dest: './uploads/',
  rename: function(fieldname, filename){
    return filename;
  },
  onFileUploadComplete: xlsxOps.up
}), 
function(req, res){
  req.fileUploadPromise.then(function(successful){
    res.redirect('/t/'+successful);
  })
  .catch(function(errorResult){
    res.redirect('/');
  });
});

app.post('/save', save.saveCell);

app.post('/savel', save.saveLayout);

app.post('/savef', save.saveFormat);

app.post('/load', tableOps.load);

app.get('/t/:name', tableOps.t);

app.get('/list', tableOps.list);

app.get('/d/:name', xlsxOps.down);

app.get('/clone/:nameold/to/:namenew', tableOps.clone);