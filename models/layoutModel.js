var mongoose=require('mongoose');
var layoutSchema = new mongoose.Schema({
  type: String,
  position: Number,
  size: Number,
  table:{
    name: String
  }
});
var Lupd = mongoose.model('Lupd', layoutSchema);

module.exports = {
  Lupd: Lupd
} 

