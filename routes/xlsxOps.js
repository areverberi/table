var async = require('async');
var extend = require('extend');
var xlsx = require('xlsx');
var q = require('q');
var Tupd = require('../models/cellModel').Tupd;
var Fupd = require('../models/formatModel').Fupd;
var Lupd = require('../models/layoutModel').Lupd;
var Lock = require('../models/lockModel').Lock;

function isEmpty(obj)
{
  for (var i in obj)
    return false;
  return true;
}

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

exports.down = function (req, res){
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
};
exports.up = function (file, req, res){
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
};
