var Lock = require('../models/lockModel').Lock;
function socketDatalockReq(socket){
  return (function datalockReq(data, callback){
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
}
function socketDisconnect(socket){
  return(function disconnect(){
    Lock.findOneAndRemove({socket:socket.id}, function(err, numAffected, raw){});
  })
}
function socketDatalockLift(socket){
  return (function datalockLift(data){
    socket.broadcast.emit('datalock-lift', data);
    Lock.findOneAndRemove(data, function(err, numAffected, raw){});
  })
}
exports.socketHandler = function(socket){
  socket.on('datalock-req', socketDatalockReq(socket));
  socket.on('disconnect', socketDisconnect(socket));
  socket.on('datalock-lift', socketDatalockLift(socket));
}
