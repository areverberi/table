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
  socketHandler = require('./routes/socketOps').socketHandler,
  xlsxOps = require('./routes/xlsxOps');

mongoose.connect('mongodb://localhost/table');
 
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(function(req, res, next){
  req.io = io;
  next();
});
app.use(express.static(__dirname + '/public'));
app.use(bp.json());

io.sockets.on('connection', socketHandler);
app.post('/upload', multer({
  dest: './uploads/',
  rename: function(fieldname, filename){
    return filename.replace(/\s+/g,'');
  },
  onFileUploadComplete: xlsxOps.up
}), 
function(req, res){
  res.setTimeout(0);
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