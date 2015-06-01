var async = require('async'),
  Tupd = require('../models/cellModel').Tupd,
  Fupd = require('../models/formatModel').Fupd,
  Lupd = require('../models/layoutModel').Lupd,
  Lock = require('../models/lockModel').Lock;
exports.saveCell = function (req,res){
  if(req.body.changes.val)
    Tupd.findOneAndUpdate({row: req.body.changes.row, col: req.body.changes.col, table: { name: req.body.table }}, {row: req.body.changes.row, col: req.body.changes.col, val: req.body.changes.val, table: { name: req.body.table }}, {upsert: true}, function(err, numAffected, raw){
    });
  else
    Tupd.findOneAndRemove({row: req.body.changes.row, col: req.body.changes.col, table: { name: req.body.table }}, function(err, numAffected, raw){
    });
  req.io.emit('datachange'+req.body.table, {row: req.body.changes.row, col: req.body.changes.col, val:req.body.changes.val, change_type: 'data'});
  Lock.findOneAndRemove({row: req.body.changes.row, col: req.body.changes.col, table:{name: req.body.table}}, function(err, numAffected, raw){});
};
exports.saveFormat = function(req, res){
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
  req.io.emit('datachange'+req.body.table, {row: req.body.meta.row, col: req.body.meta.col, key: req.body.meta.key, value:req.body.meta.value, change_type: 'format'});
};
exports.saveLayout = function(req, res){
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
    req.io.emit('datachange'+req.body.table, {type: t, position: p, size: req.body.changes.size, change_type: 'layout'});
  });
};
exports.saveAll = function (layout, format, table, tableName, doneCallback){
  async.parallel({
    layout: function(callback){
      async.each(layout, function(l, cb){
        Lupd.findOneAndUpdate({type:l.type, position: l.position, table:{name: tableName}}, {type:l.type, position: l.position, size: l.size, table:{name: tableName}}, {upsert:true}, function(err, numAffected, raw){
          if(err)
            cb(err);
          cb(null);
        });
      }, callback);
    },
    format: function(callback){
      async.each(format, function(f, cb){
        Fupd.findOneAndUpdate({row: f.row, col: f.col, key: f.key, table:{name:tableName}}, {row: f.row, col: f.col, key: f.key, value: f.value, table:{name: tableName}}, {upsert:true}, function(err, numAffected, raw){
          if(err)
            cb(err);
          cb(null);
        });
      }, callback);
    },
    table: function(callback){
      async.each(table, function(c, cb){
        Tupd.findOneAndUpdate({row: c.row, col: c.col, table: { name: tableName }}, {row: c.row, col: c.col, val: c.val, table: { name: tableName }}, {upsert: true}, function(err, numAffected, raw){
          if(err)
            cb(err);
          cb(null);
        });
      }, callback);
    },
  },
  doneCallback
  );
};
