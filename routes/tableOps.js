var async = require('async'),
  cellModel = require('../models/cellModel'),
  Tupd = cellModel.Tupd,
  formatModel = require('../models/formatModel'),
  Fupd = formatModel.Fupd,
  layoutModel = require('../models/layoutModel'),
  Lupd = layoutModel.Lupd,
  lockModel = require('../models/lockModel'),
  Lock = lockModel.Lock;
  
function loadCallback(req, res)
{
  this.req=req;
  this.res=res;
  var self=this;
  return (function loadCb(err, results){
    self.res.writeHead(200, { 'Content-Type': 'application/json' });
    self.res.end(JSON.stringify(results));
  });
}

function loadData(req, res, cb)
{
  var filter;
  if(req.body.table)
    filter={table: {name: req.body.table }};
  else
    filter={table: {name: req.params.name}};
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
    cb(req, res)(err, results);
  });
}

exports.load = function(req, res){
  loadData(req, res, loadCallback);
}

exports.loadData = loadData;

exports.clone = function(req, res){
  if(req.params.nameold && req.params.namenew)
  {
    async.parallel({
      table: function(callback){
        Tupd.find({table: {name: req.params.nameold}}, function(err, t){
          if(err)
            callback(err);
          async.each(t, function(item, cb){
            var cloneItemT=new Tupd(item);
            cloneItemT._id = cellModel.getNewId();
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
            cloneItemF._id = formatModel.getNewId();
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
            cloneItemL._id = layoutModel.getNewId();
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
      res.redirect('/t/'+req.params.namenew);
    }  
    );
  }
};
exports.t = function(req, res){
  if(req.params.name)
  {
    pars={table : req.params.name};
    Tupd.count({ table: { name: req.params.name }}, function(err, count){
      if(count>0)
        pars['load']=1;
      res.render('table-slick', pars);
    });
  }
};
exports.list = function(req, res){
  Tupd.find().distinct('table.name', function(err, cells){
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cells));                                                                            
  });
};
