var mongoose=require('mongoose');
var lockSchema = new mongoose.Schema({
  row: Number,
  col: Number, 
  socket: String,
  table:{
    name: String
  }
});
var Lock = mongoose.model('Lock', lockSchema);

module.exports = {
  Lock: Lock
} 


