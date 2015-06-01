function isEmpty(obj)
{
  for (var i in obj)
    return false;
  return true;
}
var express = require('express'),
  http = require('http'),
  app = express(),
  server = http.createServer(app).listen(1337),
  io = require('socket.io').listen(server),
  bp = require('body-parser'),
  xlsx = require('xlsx'),
  mongoose = require('mongoose'),
  async = require('async'),
  multer = require('multer'),
  extend = require('extend'),
  q = require('q');
var done = false;
mongoose.connect('mongodb://localhost/table');
var Tupd = require('./models/cellModel').Tupd;
var Lupd = require('./models/layoutModel').Lupd;
var Fupd = require('./models/formatModel').Fupd;
var Lock = require('./models/lockModel').Lock;
function datenum(v, date1904) {
  if(date1904) v+=1462;
  var epoch = Date.parse(v);
  return (epoch - new Date(Date.UTC(1899, 11, 30)))/(24*60*60*1000);
}
function Workbook() {
if(!(this instanceof Workbook)) return new Workbook();
this.SheetNames = [];
this.Sheets = {};
} 
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));
app.use(bp.json());
// app.use(multer({
//   dest: './uploads/',
//   rename: function(fieldname, filename){
//     return filename;
//   },
//   onFileUploadComplete: function(file){
//     done = true;
//   }
// }));
io.sockets.on('connection', function(socket){
  console.log('connected', socket.id);
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
  onFileUploadComplete: function(file, req, res){
    var deferred = q.defer();
    req.fileUploadPromise = deferred.promise;
    var wb = xlsx.readFile('./'+file.path, {cellStyles:true, sheetStubs: true});
    
    var ws = wb.Sheets[wb.SheetNames[0]];
    var layout=[];
    var format=[];
    var table=[];
    ws['!cols'].forEach(function(col, index){
      var layoutObj = {type: 'col', position: index, size: col.wpx}
      layout.push(layoutObj);
    });
    //TODO rows are missing
    for (cell in ws){
      if (cell[0] === '!') continue;
                           var _col=xlsx.utils.decode_cell(cell).c;
      var _row=xlsx.utils.decode_cell(cell).r;
      var tableObj={col: _col, 
        row: _row,
        val: ws[cell].v,
      };
      table.push(tableObj);
      var formatObj=[];
      if(ws[cell].s)
      {
        if(ws[cell].s.font)
        {
          if(ws[cell].s.font.bold)
            formatObj.push({col: _col, row: _row, key: 'bold', value: true});
                           if(ws[cell].s.font.italic)
                             formatObj.push({col: _col, row: _row, key: 'italic', value: true});
        }
        if(!isEmpty(ws[cell].s.border))
        {
          var borderObj={col: _col, row: _row, key: 'borders', value:{}};
          if(!isEmpty(ws[cell].s.border.top))
            extend(borderObj.value, {top:{width: 1, color: '#000'}});
          if(!isEmpty(ws[cell].s.border.left))
            extend(borderObj.value, {left:{width: 1, color: '#000'}});
          if(!isEmpty(ws[cell].s.border.bottom))
            extend(borderObj.value, {bottom:{width: 1, color: '#000'}});
          if(!isEmpty(ws[cell].s.border.right))
            extend(borderObj.value, {right:{width: 1, color: '#000'}});
          formatObj.push(borderObj);
        }
        if(ws[cell].s.fill)
        {
          formatObj.push({col: _col, row: _row, key:'color', value: ws[cell].s.fill.fgColor});
        }
      }
      format.push.apply(format, formatObj);
    }
    async.parallel({
      layout: function(callback){
        var global_err=null;
        async.each(layout, function(l, cb){
          Lupd.findOneAndUpdate({type:l.type, position: l.position, table:{name: file.originalname}}, {type:l.type, position: l.position, size: l.size, table:{name: file.originalname}}, {upsert:true}, function(err, numAffected, raw){
            if(err)
              cb(err);
            cb(null);
          });
        }, callback);
      },
      format: function(callback){
        var global_err=null;
        async.each(format, function(f, cb){
          Fupd.findOneAndUpdate({row: f.row, col: f.col, key: f.key, table:{name:file.originalname}}, {row: f.row, col: f.col, key: f.key, value: f.value, table:{name: file.originalname}}, {upsert:true}, function(err, numAffected, raw){
            if(err)
              cb(err);
            cb(null);
          });
        }, callback);
      },
      table: function(callback){
        var global_err=null;
        async.each(table, function(c, cb){
          Tupd.findOneAndUpdate({row: c.row, col: c.col, table: { name: file.originalname }}, {row: c.row, col: c.col, val: c.val, table: { name: file.originalname }}, {upsert: true}, function(err, numAffected, raw){
            if(err)
              cb(err);
            cb(null);
          });
        }, callback);
      },
    },
    function (err,results){
      //res.redirect('/t/'+file.originalname);
      if(err)
        deferred.reject(err);
      else
        deferred.resolve(file.originalname);
    }
    );
  }
}), 
function(req, res){
  req.fileUploadPromise.then(function(successful){
    res.redirect('/t/'+successful);
  })
  .catch(function(errorResult){
    res.redirect('/');
  });
});
app.post('/save', function (req, res){
  if(req.body.changes.val)
    Tupd.findOneAndUpdate({row: req.body.changes.row, col: req.body.changes.col, table: { name: req.body.table }}, {row: req.body.changes.row, col: req.body.changes.col, val: req.body.changes.val, table: { name: req.body.table }}, {upsert: true}, function(err, numAffected, raw){
      });
  else
      Tupd.findOneAndRemove({row: req.body.changes.row, col: req.body.changes.col, table: { name: req.body.table }}, function(err, numAffected, raw){
      });
  io.emit('datachange'+req.body.table, {row: req.body.changes.row, col: req.body.changes.col, val:req.body.changes.val, change_type: 'data'});
  Lock.findOneAndRemove({row: req.body.changes.row, col: req.body.changes.col, table:{name: req.body.table}}, function(err, numAffected, raw){});
});
app.post('/savel', function(req, res){
  var t, p;
  if(!req.body.changes.row)
  {
    t='col';
    p=req.body.changes.col;
  }
  if(!req.body.changes.col)
  {
    t='row';
    p=req.body.changes.row;
  }
  Lupd.findOneAndUpdate({type:t, position: p, table:{name: req.body.table}}, {type:t, position: p, size: req.body.changes.size, table:{name: req.body.table}}, {upsert:true}, function(err, numAffected, raw){
    if(err) return;
    io.emit('datachange'+req.body.table, {type: t, position: p, size: req.body.changes.size, change_type: 'layout'});
  });
});
app.post('/savef', function(req, res){
  if(req.body.meta.value)
  {
    Fupd.findOneAndUpdate({row:req.body.meta.row, col:req.body.meta.col, key:req.body.meta.key, table:{name:req.body.table}}, {row:req.body.meta.row, col:req.body.meta.col, key:req.body.meta.key, value: req.body.meta.value, table:{name:req.body.table}}, {upsert:true}, function(err, numAffected, raw){
    });
  }
  else
  {
    Fupd.findOneAndRemove({row:req.body.meta.row, col:req.body.meta.col, key:req.body.meta.key, table:{name:req.body.table}}, function(err, numAffected, raw){
    });
  }
  io.emit('datachange'+req.body.table, {row: req.body.meta.row, col: req.body.meta.col, key: req.body.meta.key, value:req.body.meta.value, change_type: 'format'});
});
app.post('/load', function (req, res){
  var filter={table: {name: req.body.table }};
  var filter_select='-_id -table -__v';
  async.parallel({
    layout: function(callback){
      Lupd.find(filter).select(filter_select).exec(callback);
    },
    format: function(callback){
      Fupd.find(filter).select(filter_select).exec(callback);
    },
    table: function(callback){
      Tupd.find(filter).select(filter_select).exec(callback);
    },
    locks: function(callback){
      Lock.find(filter).select(filter_select).exec(callback);
    },
  },
  function(err, results){
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));									       
  });
//   Tupd.find({table: { name: req.body.table }}).select('-_id -table -__v').exec(function(err, cells){
//     res.writeHead(200, { 'Content-Type': 'application/json' });
//     res.end(JSON.stringify(cells));									       
//   });
});
app.get('/t/:name', function (req, res){
  if(req.params.name)
  {
    pars={table : req.params.name};
    Tupd.count({ table: { name: req.params.name }}, function(err, count){
      if(count>0)
	pars['load']=1;
      res.render('table-slick', pars);
    });
  }
});
app.get('/list', function(req, res){
  Tupd.find().distinct('table.name', function(err, cells){
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cells));									       
  });
});
app.get('/d/:name', function(req, res){
  if(req.params.name)
  {
    Tupd.count({table: { name: req.params.name }}, function(err, count){
      if(count>0)
      {
	var wb = new Workbook();
	var ws_name = 'Foglio1';
	wb.SheetNames.push(ws_name);
	var ws ={};
	var range = {s: {c:10000000, r:10000000}, e: {c:0, r:0 }};
	var filter={table: {name: req.params.name }};
	var filter_select='-_id -table -__v';
	async.parallel({
	  layout: function(callback){
	    Lupd.find(filter).select(filter_select).exec(callback);
	  },
	  format: function(callback){
	    Fupd.find(filter).select(filter_select).exec(callback);
	  },
	  table: function(callback){
	    Tupd.find(filter).select(filter_select).exec(callback);
	  }
	},
	function (err,result){
	  var wb = new Workbook();
	  var ws_name = 'Foglio1';
	  wb.SheetNames.push(ws_name);
	  var ws ={};
	  var range = {s: {c:10000000, r:10000000}, e: {c:0, r:0 }};
	  result.table.forEach(function(cell){
	    if(range.s.r > cell.row) range.s.r = cell.row;
	    if(range.s.c > cell.col) range.s.c = cell.col;
	    if(range.e.r < cell.row) range.e.r = cell.row;
	    if(range.e.c < cell.col) range.e.c = cell.col;
	    var cell_x={v: (cell.val?cell.val:'')};
	    var cell_ref = xlsx.utils.encode_cell({c:cell.col, r:cell.row});
	    if(typeof cell_x.v === 'number') 
	      cell_x.t='n';
	    else if(typeof cell_x.v === 'boolean') 
	      cell_x.t = 'b';
	    else if (cell_x.v instanceof Date){
	      cell_x.t = 'n';
	      cell_x.z = xlsx.SSF_table[14];
	      cell_x.v=datenum(cell.v);
	    }
	    else
	      cell_x.t = 's';
	    ws[cell_ref] = cell_x;
	  });
	  result.format.forEach(function(cell){
	    var cell_ref = xlsx.utils.encode_cell({c:cell.col, r:cell.row});
            if(!ws[cell_ref].s)
              ws[cell_ref].s={};
	    if(cell.key === 'bold')
	      if(ws[cell_ref].s.font)
		ws[cell_ref].s.font.bold = true;
	      else
		ws[cell_ref].s.font={bold: true};
	    if(cell.key === 'italic')
	      if(ws[cell_ref].s.font)
		ws[cell_ref].s.font.italic = true;
	      else
		ws[cell_ref].s.font={italic: true};
	    if(cell.key === 'borders')
	    {
	      ws[cell_ref].s.border={};
	      if (cell.value && cell.value.top && cell.value.top.width)
		ws[cell_ref].s.border.top={style: 'thin'};
	      if(cell.value && cell.value.left && cell.value.left.width)
		ws[cell_ref].s.border.left={style: 'thin'};
	      if(cell.value && cell.value.bottom && cell.value.bottom.width)
		ws[cell_ref].s.border.bottom={style: 'thin'};
	      if(cell.value && cell.value.right && cell.value.right.width)
		ws[cell_ref].s.border.right={style: 'thin'};
	    }
	    if(cell.key === 'color')
            {
              ws[cell_ref].s.fill={};
              //ws[cell_ref].s.fill.fgColor=cell.value;
              ws[cell_ref].s.fill.fgColor=cell.value;
              //ws[cell_ref].s.fill.patternType='solid';
              //ws[cell_ref].s.fill.fgColor={indexed: 64};
              
            }
	  });
	  ws['!cols']=[];
	  result.layout.forEach(function(l){
	    if(l.type === 'col')
	    {
	      ws['!cols'][l.position]={width: l.size*0.142846201, customWidth: 1, wpx: l.size, wch: l.size*0.135882352, MDW: 7};
	    }
	    if(l.type === 'row')
	    {
	      //TODO rows missing
	    }
	  });
	  if(range.s.c < 10000000) ws['!ref'] = xlsx.utils.encode_range(range);
	  wb.Sheets[ws_name] = ws;
	  xlsx.writeFile(wb, req.params.name+'.xlsx');
	  res.download(req.params.name+'.xlsx');
	}
	);
      }
    });
  }
});
app.get('/clone/:nameold/to/:namenew', function(req, res){
  if(req.params.nameold && req.params.namenew)
  {
    async.parallel({
      table: function(callback){
        Tupd.find({table: {name: req.params.nameold}}, function(err, t){
          if(err)
            callback(err);
          async.each(t, function(item, cb){
            var cloneItemT=new Tupd(item);
            cloneItemT._id = mongoose.Types.ObjectId();
            cloneItemT.table.name = req.params.namenew;
            cloneItemT.save(function(err, data){
              if(err)
                cb(err);
              cb(null);
            });
          }, callback);
        });
      },
      format: function(callback){
        Fupd.find({table: {name: req.params.nameold}}, function(err, f){
          if(err)
            callback(err);
          async.each(f, function(item, cb){
            var cloneItemF=new Fupd(item);
            cloneItemF._id = mongoose.Types.ObjectId();
            cloneItemF.table.name = req.params.namenew;
            cloneItemF.save(function(err, data){
              if(err)
                cb(err);
              cb(null);
            });
          }, callback);
        });
      },
      layout: function(callback){
        Lupd.find({table: {name: req.params.nameold}}, function(err, l){
          if(err)
            callback(err);
          async.each(l, function(item, cb){
            var cloneItemL=new Lupd(item);
            cloneItemL._id = mongoose.Types.ObjectId();
            cloneItemL.table.name = req.params.namenew;
            cloneItemL.save(function(err, data){
              if(err)
                cb(err);
              cb(null);
            });
          }, callback);
        });
      },
    },
    function(err, result){
      if(err)
        return;
      console.log(err, result);
      res.redirect('/t/'+req.params.namenew);
    }  
    );
  }
});
app.get('/test/:name', function(req,res){
  if(req.params.name)
  {
    pars={table : req.params.name};
    Tupd.count({ table: { name: req.params.name }}, function(err, count){
      if(count>0)
	pars['load']=1;
      res.render('table-slick', pars);
    });
  }
});
//server.listen(1337);