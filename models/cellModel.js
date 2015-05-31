var mongoose=require('mongoose');
var cellSchema = new mongoose.Schema({
  row: Number,
  col: Number,
  val: {},
  table: {
    name: String
  }
});
var Tupd = mongoose.model('Tupd', cellSchema);
 
module.exports = {
  Tupd: Tupd
}