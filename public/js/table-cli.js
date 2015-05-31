function saveLayoutChange(r, c, s)
{
  $.ajax({
    url: '/savel',
    dataType: 'json',
    contentType: 'application/json',
    type: 'POST',
    data: JSON.stringify({changes: {row:r, col:c, size:s}, table:$('#name').val()})
  });
}
function saveFormatChange(_row, _col, _key, _value)
{
  if(_key === 'borders')
  {
    _value={top:{width: _value.top.width, color: _value.top.color}, left:{width: _value.left.width, color: _value.left.color}, bottom:{width: _value.bottom.width, color: _value.bottom.color}, right:{width: _value.right.width, color: _value.right.color}};
  }
  $.ajax({
    url: '/savef',
    dataType: 'json',
    contentType: 'application/json',
    type: 'POST',
    data: JSON.stringify({meta: {row:_row, col:_col, key:_key, value:_value}, table:$('#name').val()})
  });
}

function formattedRenderer(instance, td, row, col, prop, value, cellProperties)
{
  Handsontable.renderers.TextRenderer.apply(this, arguments);
  if(instance.getCellMeta(row, col).bold)
  {
    td.style.fontWeight='bold';
  }
  if(instance.getCellMeta(row, col).italic)
    td.style.fontStyle='italic';
}
Handsontable.renderers.registerRenderer('formattedRenderer', formattedRenderer);

$(document).ready(function(){
  var options = {
    rowHeaders:true,
    colHeaders: true,
    contextMenu: true,
    customBorders: true,
    startRows: 100,
    startCols: 100,
    manualColumnResize: true,
    manualRowResize: true,
    onChange: function (change, source) {
      if(source === 'loadData')
      {
	return;
      }
      $.ajax({
	url: '/save',
	dataType: 'json',
	contentType: 'application/json',
	type: 'POST',
	data: JSON.stringify({changes: change, table:$('#name').val()})
      });
      
    },
    afterSelectionEnd: function(r,c,r2,c2){
      console.log(r,c,r2,c2);
      socket.emit('datalock-req', {lock:{row1:r, col1:c, row2:r2, col2:c2}, id:socket.id, table:$('#name').val()});
//      $.ajax({
//	url: '/lock',
//	dataType: 'json',
//	contentType: 'application/json',
//	type: 'POST',
//	data: JSON.stringify({lock: {row1:r, col1:c, row2:r2, col2:c2}, table:$('#name').val()})
//      });
    },
    contextMenu:{
      callback: function(key, options) {
	if (key === 'bold'){
	  limits=this.getSelected();
	  for(var i=limits[0]; i<=limits[2]; ++i)
	    for(var j=limits[1]; j<=limits[3]; ++j)
	      this.setCellMeta(i, j, 'bold', true);
	    this.render();
	}
	if (key === 'italic'){
	  limits=this.getSelected();
	  for(var i=limits[0]; i<=limits[2]; ++i)
	    for(var j=limits[1]; j<=limits[3]; ++j)
	      this.setCellMeta(i, j, 'italic', true);
	    this.render();
	}
	if (key === 'normal'){
	  limits=this.getSelected();
	  for(var i=limits[0]; i<=limits[2]; ++i)
	    for(var j=limits[1]; j<=limits[3]; ++j)
	    {
	      this.removeCellMeta(i, j, 'bold');
	      this.removeCellMeta(i, j, 'italic');
	      saveFormatChange(i, j, 'bold', null);
	      saveFormatChange(i, j, 'italic', null);
	    }
	    this.render();
	}
      },
      items:{
	row_above: {},
	row_below: {},
	hsep1: {},
	col_left: {},
	col_right: {},
	hsep2: {},
	remove_row: {},
	remove_col: {},
	hsep3: {},
	undo: {},
	redo: {},
	make_read_only: {},
	alignment: {},
	borders: {},
	bold: {name: 'Grassetto'},
	italic: {name: 'Corsivo'},
	normal: {name: 'Normale'}
      }
    },
    cells: function(row, col, prop){
      var cellProperties = {};
      cellProperties.renderer = 'formattedRenderer';
      return cellProperties;
    },
    afterColumnResize: function(col, width){
      saveLayoutChange(null, col, width);
    },
    afterRowResize: function(row, height){
      saveLayoutChange(row, null, height);
    },
    afterSetCellMeta: function(_row, _col, _key, _value, src){
      if(src === 'loadData')
      {
	//this.render();
	return;
      }
      saveFormatChange(_row, _col, _key, _value);
      //this.render();
    },
  };
  if($('#load').val())
  {
    $.ajax({
      url: '/load',
      dataType: 'json',
      contentType: 'application/json',
      type: 'POST',
      data: JSON.stringify({table:$('#name').val()}),
      success: function(data, status, jqx){
	loadedData={};
	loadedData.table=data.table;
	var borderArray=[];
	var formatArray=[];
	data.format.forEach(function(meta){
	  if(meta['key'] === 'borders')
	  {
	    var b={row:meta.row, col:meta.col}
	    if(meta.value.top && !meta.value.top.hide)
	      b.top=meta.value.top;
	    if(meta.value.left && !meta.value.left.hide)
	      b.left=meta.value.left;
	    if(meta.value.bottom && !meta.value.bottom.hide)
	      b.bottom=meta.value.bottom;
	    if(meta.value.right && !meta.value.right.hide)
	      b.right=meta.value.right;
	    borderArray.push(b);
	  }
	  if(meta['key'] != 'borders')
	  {
	    formatArray.push(meta);
	  }
	});
	
	loadedData.borders=borderArray;
	loadedData.format=formatArray;
	loadedData.layout=data.layout;
	options.colWidths= function(col){
	var res=null;
	loadedData.layout.forEach(function(l){
	  if(l.type==='col' && l.position == col)
	    res=l.size;
	});
	return res;
      };
      options.rowHeights= function(row){
	var res=null;
	loadedData.layout.forEach(function(l){
	  if(l.type==='row' && l.position == row)
	    res=l.size;
	});
	  return res;
      }
      if(loadedData.borders)
	options.customBorders = loadedData.borders;
      else
	options.customBorders = true;
      $('#tab').handsontable(options);
      var hot = $('#tab').handsontable('getInstance');
      loadedData.table.forEach(function(cell){
	hot.setDataAtCell(cell['row'], cell['col'], cell['val'], 'loadData');
      });
      loadedData.format.forEach(function(meta){
	hot.setCellMeta(meta['row'], meta['col'], meta['key'], meta['value'], 'loadData');
      });
      hot.render();
// 	var hot=$('#tab').handsontable('getInstance');
// 	data.table.forEach(function(cell){
// 	  hot.setDataAtCell(cell['row'], cell['col'], cell['val'], 'loadData');
// 	});
// 	var borderArray=[];
// 	data.format.forEach(function(meta){
// 	  if(meta['key'] === 'borders')
// 	  {
// 	    console.log(meta.value);
// 	    var b={row:meta.row, col:meta.col}
// 	    if(meta.value.top && !meta.value.top.hide)
// 	      b.top=meta.value.top;
// 	    if(meta.value.left && !meta.value.left.hide)
// 	      b.left=meta.value.left;
// 	    if(meta.value.bottom && !meta.value.bottom.hide)
// 	      b.bottom=meta.value.bottom;
// 	    if(meta.value.right && !meta.value.right.hide)
// 	      b.right=meta.value.right;
// 	    borderArray.push(b);
// 	  }
// 	});
// 	console.log(borderArray);
// 	hot.updateSettings({
// 	  colWidths: function(col){
// 	    var res=null;
// 	    data.layout.forEach(function(l){
// 	      if(l.type==='col' && l.position == col)
// 		res=l.size;
// 	    });
// 	    return res;
// 	  },
// 	  rowHeights: function(row){
// 	    var res=null;
// 	      data.layout.forEach(function(l){
// 		if(l.type==='row' && l.position == row)
// 		  res=l.size;
// 	      });
// 	      return res;
// 	  },
// 	  customBorders: borderArray,
// 	});
// 	data.format.forEach(function(meta){
// 	  if(meta['key']!='borders')
// 	    hot.setCellMeta(meta['row'], meta['col'], meta['key'], meta['value']);
// 	});
      }
    });
  }
  else
  {
    $('#tab').handsontable(options);
  }
  var socket = io.connect();
  socket.on('datachange'+$('#name').val(), function(data){
    var hot=$('#tab').handsontable('getInstance');
    data.forEach(function(cell){
      hot.setDataAtCell(cell[0], cell[1], cell[3], 'loadData');
    });
  });
//   socket.on('datalock-resp', function(data){
//     console.log(data);
//   });
});