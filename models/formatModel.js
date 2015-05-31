var mongoose=require('mongoose');
var formatSchema = new mongoose.Schema({
  row: Number,
  col: Number,
  key: String,
  value: {},
  table: {
    name: String
  }
});
var Fupd = mongoose.model('Fupd', formatSchema);

module.exports = {
  Fupd: Fupd
} 
