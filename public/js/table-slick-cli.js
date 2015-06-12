(function($){
  $.modelCommunication = function(options){
    var mC = {
      options: $.extend({
        'layoutURL': '/savel',
        'formatURL': '/savef',
        'dataURL': '/save',
      }, options),
      saveLayoutChange: function(r,c,s){
        $.ajax({
          url: mC.options.layoutURL,
          dataType: 'json',
          contentType: 'application/json',
          type: 'POST',
          data: JSON.stringify({changes: {row:r, col:c, size:s}, table:$('#name').val()})
        });
      },
      saveFormatChange: function(_row, _col, _key, _value){
        $.ajax({
          url: mC.options.formatURL,
          dataType: 'json',
          contentType: 'application/json',
          type: 'POST',
          data: JSON.stringify({meta: {row:_row, col:_col, key:_key, value:_value}, table:$('#name').val()})
        });
      },
      saveDataChange: function(change){
        $.ajax({
          url: mC.options.dataURL,
          dataType: 'json',
          contentType: 'application/json',
          type: 'POST',
          data: JSON.stringify({changes: change, table:$('#name').val()})
        });
      },
 //TODO needs loading code too. eventually socket code as well
    };
    return {
      saveLayoutChange: mC.saveLayoutChange,
      saveFormatChange: mC.saveFormatChange,
      saveDataChange: mC.saveDataChange,
    };
  };
})(jQuery);
(function($){
  $.cellStyleSetter = function(options){
    var cSS ={
      lookForClass: function(cl){
        for(var i=0; i<document.styleSheets.length; ++i)
        {
          var sheet=document.styleSheets[i];
          if(sheet.ownerNode.href)
          {
            continue;
          }
          for(var j=0; j<sheet.cssRules.length; ++j)
          {
            if(sheet.cssRules[j].selectorText === cl)
              return true;
          }
        }
        return false;
      },
      createColorClassIfNotExists: function(color){
        if(!cSS.lookForClass('.cell-bg'+color))
          $("<style type='text/css'> .cell-bg"+color+"{ background-color: #"+color+" }</style>").appendTo("head");
      },
      composeNewBorderCssClass: function(cellNode, newClass){
        var borderClasses=['cell-top-border', 'cell-left-border', 'cell-bottom-border', 'cell-right-border'];
        cSS.composeCssClass(borderClasses)(cellNode, newClass);
      },
      composeCssClass: function(classArray){
        var _classArray = classArray;
        return function(cellNode, newClass){
          var classes =[];
          var appliedClasses=newClass.split(' ');
          _classArray.forEach(function(availClass){
            if($(cellNode).hasClass(availClass))
              classes.push(availClass);
          });
          return classes.join(' ');
        };
        
      },
      applyCssClass: function(grid, node, key, row, col, cssClass, cssClassHook){
        $(node).toggleClass(cssClass);
        var newClass=cssClassHook(node, cssClass); 
        var style={};
        style[row]={};
        style['col'+col]=cssClass;
        grid.setCellCssStyles(key+row+'-'+col, style);
      },
    };
    return {
      lookForClass: cSS.lookForClass,
      composeNewBorderCssClass: cSS.composeNewBorderCssClass,
      composeCssClass: cSS.composeCssClass,
      applyCssClass: cSS.applyCssClass,
      createColorClassIfNotExists: cSS.createColorClassIfNotExists,
    };
    //TODO will contain all code dealing with querying/applying/removing css styles to cells (formatting + layout)
  };
})(jQuery);
$(document).ready(function(){
  var modCom = $.modelCommunication();
  var cSS = $.cellStyleSetter();
  var grid;
  var columns =[];
  columns.push({id:'id', name:'Riga', field:'id', width:40});
  for(var i=0; i<100; ++i)
    columns.push({id:'col'+i, name:i, field:'col'+i, width:70, editor:Slick.Editors.Text });
  var dataView = new Slick.Data.DataView();
  var selectedRange;
  async.parallel({
    options: function(callback){
      var options ={
	enableCellNavigation: true,
	enableColumnReorder: false,
	explicitInitialization: true,
	editable: true,
	rowHeight: 22,
	autoEdit: false,
      };
      grid = new Slick.Grid('#tab', dataView, columns, options);
      grid.setSelectionModel(new Slick.CellRangeSelector());
      grid.getSelectionModel().onCellRangeSelected.subscribe(function(e, args){
        console.log("called");
        console.log(args.range);
        selectedRange=args.range;
      });
      dataView.onRowCountChanged.subscribe(function(e, args){
        grid.updateRowCount();
        grid.render();
      });
      dataView.onRowsChanged.subscribe(function(e,args){
        grid.invalidateRows(args.rows);
        grid.render();
      });
      var overlayPlugin = new Ext.Plugins.Overlays({decoratorWidth:5});
      overlayPlugin.onFillUpDown.subscribe(function(e,args){
        var column = grid.getColumns()[args.range.fromCell];
        if(!column.editor) return;
        var value = dataView.getItem(args.range.fromRow)[column.field];
        dataView.beginUpdate();
        for(var i = args.range.fromRow +1; i<= args.range.toRow; ++i)
        {
          dataView.getItem(i)[column.field] = value;
          grid.invalidateRow(i);
        }
        dataView.endUpdate();
        grid.render();
      });
      grid.registerPlugin(overlayPlugin);
      grid.init();
      grid.onCellChange.subscribe(function(e, args){
        var _row=args.row
        var _col=args.cell-1;
        var _val=args.item['col'+_col];
        modCom.saveDataChange({row:_row, col:_col, val:_val});
      });
      grid.onColumnsResized.subscribe(function(e, args){
        modCom.saveLayoutChange(null, args.cols[0]-1, args.nWidths[0]);
      });
      grid.onScroll.subscribe(function(e, args){
        if($(grid.getCanvasNode()).width()<=grid.getViewport().rightPx)
        {
          var cols=grid.getColumns();
          cols.push({id:'col'+cols.length, name:cols.length, field:'col'+cols.length, width:70, editor:Slick.Editors.Text });
          grid.setColumns(cols);
        }
        if(grid.getViewport().bottom == grid.getDataLength()+1)
        {
          var newrow={};
          newrow.id=grid.getDataLength();
          for(var i=0; i<grid.getColumns().length; ++i)
            newrow['col'+i]='';
          dataView.addItem(newrow);
          dataView.refresh();
        }
      });
      $('#tab').on('blur', 'input.editor-text', function() {
        Slick.GlobalEditorLock.commitCurrentEdit();
        grid.resetActiveCell();
      });
      $("#showPaletteOnly").spectrum({
        color: "rgb(244, 204, 204)",    
                                     showPaletteOnly: true,
                                     showPalette: true,
                                     hideAfterPaletteSelect: true,
                                     change: function(color) {
                                       var c=$('#showPaletteOnly').spectrum('get').toHex();
                                       cSS.createColorClassIfNotExists(c);
                                       style={};
                                       var _row = grid.getActiveCell().row;
                                       var _col = grid.getActiveCell().cell-1;
                                       style[grid.getActiveCell().row]={};
                                       style[grid.getActiveCell().row]['col'+_col]='cell-bg'+c;
                                       grid.setCellCssStyles('color'+_row+'-'+_col, style);
                                       modCom.saveFormatChange(_row, _col, 'color', {rgb:'FF'+c});
                                     },
                                     palette: [
                                     ["rgb(0, 0, 0)", "rgb(67, 67, 67)", "rgb(102, 102, 102)",
                                     "rgb(204, 204, 204)", "rgb(217, 217, 217)","rgb(255, 255, 255)"],
                                     ["rgb(152, 0, 0)", "rgb(255, 0, 0)", "rgb(255, 153, 0)", "rgb(255, 255, 0)", "rgb(0, 255, 0)",
                                     "rgb(0, 255, 255)", "rgb(74, 134, 232)", "rgb(0, 0, 255)", "rgb(153, 0, 255)", "rgb(255, 0, 255)"], 
                                     ["rgb(230, 184, 175)", "rgb(244, 204, 204)", "rgb(252, 229, 205)", "rgb(255, 242, 204)", "rgb(217, 234, 211)", 
                                     "rgb(208, 224, 227)", "rgb(201, 218, 248)", "rgb(207, 226, 243)", "rgb(217, 210, 233)", "rgb(234, 209, 220)", 
                                     "rgb(221, 126, 107)", "rgb(234, 153, 153)", "rgb(249, 203, 156)", "rgb(255, 229, 153)", "rgb(182, 215, 168)", 
                                     "rgb(162, 196, 201)", "rgb(164, 194, 244)", "rgb(159, 197, 232)", "rgb(180, 167, 214)", "rgb(213, 166, 189)", 
                                     "rgb(204, 65, 37)", "rgb(224, 102, 102)", "rgb(246, 178, 107)", "rgb(255, 217, 102)", "rgb(147, 196, 125)", 
                                     "rgb(118, 165, 175)", "rgb(109, 158, 235)", "rgb(111, 168, 220)", "rgb(142, 124, 195)", "rgb(194, 123, 160)",
                                     "rgb(166, 28, 0)", "rgb(204, 0, 0)", "rgb(230, 145, 56)", "rgb(241, 194, 50)", "rgb(106, 168, 79)",
                                     "rgb(69, 129, 142)", "rgb(60, 120, 216)", "rgb(61, 133, 198)", "rgb(103, 78, 167)", "rgb(166, 77, 121)",
                                     "rgb(91, 15, 0)", "rgb(102, 0, 0)", "rgb(120, 63, 4)", "rgb(127, 96, 0)", "rgb(39, 78, 19)", 
                                     "rgb(12, 52, 61)", "rgb(28, 69, 135)", "rgb(7, 55, 99)", "rgb(32, 18, 77)", "rgb(76, 17, 48)"]
                                     ]
      });
      $.contextMenu({
        selector: '.slick-cell',
        zIndex: 9999,
        items:{
          "bold": {
            name:"Grassetto", 
            callback: function(key, options){
              var boldClass=['cell-bold'];
              var _row = grid.getRowFromNode($(options.$trigger[0]).parent()[0]);
              var _col = grid.getCellFromNode(options.$trigger[0])-1;
              var _key = 'bold';
              if(selectedRange && selectedRange.contains(_row, _col+1)){
                for(var i=selectedRange.fromRow; i<=selectedRange.toRow; ++i)
                  for(var j=selectedRange.fromCell; j<=selectedRange.toCell; ++j){
                    cSS.applyCssClass(grid, grid.getCellNode(i,j), _key, i, j-1, 'cell-bold', cSS.composeCssClass(boldClass));
                    var _value = ($(grid.getCellNode(i,j)).hasClass('cell-bold')? true: null);
                    modCom.saveFormatChange(i, j-1, _key, _value);
                  }
                  selectedRange = null;
              }
              else
              {
                cSS.applyCssClass(grid, options.$trigger[0], _key, _row, _col, 'cell-bold', cSS.composeCssClass(boldClass));
                var _value = ($(options.$trigger[0]).hasClass('cell-bold')? true : null);
                modCom.saveFormatChange(_row, _col, _key, _value);
              }
            },
          },
          "italic": {
            name:"Corsivo",
            callback: function(key, options){
              var italicClass=['cell-italic'];
              var _row = grid.getRowFromNode($(options.$trigger[0]).parent()[0]);
              var _col = grid.getCellFromNode(options.$trigger[0])-1;
              var _key = 'italic';
              if(selectedRange && selectedRange.contains(_row, _col+1)){
                for(var i=selectedRange.fromRow; i<=selectedRange.toRow; ++i)
                  for(var j=selectedRange.fromCell; j<=selectedRange.toCell; ++j){
                    cSS.applyCssClass(grid, grid.getCellNode(i,j), _key, i, j-1, 'cell-italic', cSS.composeCssClass(italicClass));
                    var _value = ($(grid.getCellNode(i,j)).hasClass('cell-italic')? true: null);
                    modCom.saveFormatChange(i, j-1, _key, _value);
                  }
                  selectedRange = null;
              }
              else
              {
                cSS.applyCssClass(grid, options.$trigger[0], _key, _row, _col, 'cell-italic', cSS.composeCssClass(italicClass));
                var _value = ($(options.$trigger[0]).hasClass('cell-italic')? true : null);
                modCom.saveFormatChange(_row, _col, _key, _value);
              }
            },
          },
          "borders": {
            name:"Bordi",
            items:{
              "top":{
                name:"Sopra",
                callback: function(key, options){
                  var borderClasses=['cell-top-border', 'cell-left-border', 'cell-bottom-border', 'cell-right-border'];
                  var _row = grid.getRowFromNode($(options.$trigger[0]).parent()[0]);
                  var _col = grid.getCellFromNode(options.$trigger[0])-1;
                  var _key = 'borders'
                  if(selectedRange && selectedRange.contains(_row, _col+1)){
                    for(var j=selectedRange.fromCell; j<=selectedRange.toCell; ++j){
                      cSS.applyCssClass(grid, grid.getCellNode(selectedRange.fromRow,j), _key, selectedRange.fromRow, j-1, 'cell-top-border', cSS.composeCssClass(borderClasses));
//                       $(grid.getCellNode(selectedRange.fromRow,j)).toggleClass('cell-top-border');
//                       var classString=cSS.composeNewBorderCssClass(grid.getCellNode(selectedRange.fromRow,j), 'cell-top-border');
//                       var style={};
//                       style[selectedRange.fromRow]={};
//                       style[selectedRange.fromRow]['col'+(j-1)]=classString;
//                       grid.setCellCssStyles('border'+selectedRange.fromRow+'-'+(j-1), style);
                      var _value = ($(grid.getCellNode(selectedRange.fromRow,j)).hasClass('cell-top-border')? {top: {width: 1, color:'#000'}} : {top:null});
                      modCom.saveFormatChange(selectedRange.fromRow, j-1, _key, _value);
                    }
                    selectedRange = null;
                  }
                  else
                  {
                    cSS.applyCssClass(grid, options.$trigger[0], _key, _row, _col, 'cell-top-border', cSS.composeCssClass(borderClasses));
//                     $(options.$trigger[0]).toggleClass('cell-top-border');
//                     var classString=cSS.composeNewBorderCssClass(options.$trigger[0], 'cell-top-border');
//                     var style={};
//                     style[_row]={};
//                     style[_row]['col'+_col]=classString;
//                     grid.setCellCssStyles('border'+_row+'-'+_col, style);
                    var _value = ($(options.$trigger[0]).hasClass('cell-top-border')? {top: {width: 1, color:'#000'}} : {top:null});
                    modCom.saveFormatChange(_row, _col, _key, _value);
                  }
                },
              },
              "left":{
                name:"Sinistra",
                callback: function(key, options){
                  var borderClasses=['cell-top-border', 'cell-left-border', 'cell-bottom-border', 'cell-right-border'];
                  var _row = grid.getRowFromNode($(options.$trigger[0]).parent()[0]);
                  var _col = grid.getCellFromNode(options.$trigger[0])-1;
                  var _key = 'borders'
                  if(selectedRange && selectedRange.contains(_row, _col+1)){
                    for(var j=selectedRange.fromRow; j<=selectedRange.toRow; ++j){
                      cSS.applyCssClass(grid, grid.getCellNode(j,selectedRange.fromCell), _key, j, selectedRange.fromCell-1, 'cell-left-border', cSS.composeCssClass(borderClasses));
//                       $(grid.getCellNode(j,selectedRange.fromCell)).toggleClass('cell-left-border');
//                       var classString=cSS.composeNewBorderCssClass(grid.getCellNode(j,selectedRange.fromCell), 'cell-left-border');
//                       var style={};
//                       style[j]={};
//                       style[j]['col'+(selectedRange.fromCell-1)]=classString;
//                       grid.setCellCssStyles('border'+j+'-'+(selectedRange.fromCell-1), style);
                      var _value = ($(grid.getCellNode(j,selectedRange.fromCell)).hasClass('cell-left-border')? {left: {width: 1, color:'#000'}} : {left:null});
                      modCom.saveFormatChange(j, selectedRange.fromCell-1, _key, _value);
                    }
                    selectedRange = null;
                  }
                  else
                  {
                    cSS.applyCssClass(grid, options.$trigger[0], _key, _row, _col, 'cell-left-border', cSS.composeCssClass(borderClasses));
//                     $(options.$trigger[0]).toggleClass('cell-left-border');
//                     var classString=cSS.composeNewBorderCssClass(options.$trigger[0], 'cell-left-border');
//                     var style={};
//                     style[_row]={};
//                     style[_row]['col'+_col]=classString;
//                     grid.setCellCssStyles('border'+_row+'-'+_col, style);
                    var _value = ($(options.$trigger[0]).hasClass('cell-left-border')? {left: {width: 1, color:'#000'}} : {left:null});
                    modCom.saveFormatChange(_row, _col, _key, _value);
                  }
                },
              },
              "bottom":{
                name: "Sotto",
                callback: function(key, options){
                  var borderClasses=['cell-top-border', 'cell-left-border', 'cell-bottom-border', 'cell-right-border'];
                  var _row = grid.getRowFromNode($(options.$trigger[0]).parent()[0]);
                  var _col = grid.getCellFromNode(options.$trigger[0])-1;
                  var _key = 'borders'
                  if(selectedRange && selectedRange.contains(_row, _col+1)){
                    for(var j=selectedRange.fromCell; j<=selectedRange.toCell; ++j){
                      cSS.applyCssClass(grid, grid.getCellNode(selectedRange.toRow, j), _key, selectedRange.toRow, j-1, 'cell-bottom-border', cSS.composeCssClass(borderClasses));
                      var _value = ($(grid.getCellNode(selectedRange.toRow,j)).hasClass('cell-bottom-border')? {bottom: {width: 1, color:'#000'}} : {bottom:null});
                      modCom.saveFormatChange(selectedRange.toRow, j-1, _key, _value);
                    }
                    selectedRange = null;
                  }
                  else
                  {
                    cSS.applyCssClass(grid, options.$trigger[0], _key, _row, _col, 'cell-bottom-border', cSS.composeCssClass(borderClasses));
                    var _value = ($(options.$trigger[0]).hasClass('cell-bottom-border')? {bottom: {width: 1, color:'#000'}} : {bottom:null});
                    modCom.saveFormatChange(_row, _col, _key, _value);
                  }
                },
              },
              "right":{
                name: "Destra",
                callback: function(key, options){
                  var borderClasses=['cell-top-border', 'cell-left-border', 'cell-bottom-border', 'cell-right-border'];
                  var _row = grid.getRowFromNode($(options.$trigger[0]).parent()[0]);
                  var _col = grid.getCellFromNode(options.$trigger[0])-1;
                  var _key = 'borders'
                  if(selectedRange && selectedRange.contains(_row, _col+1)){
                    for(var j=selectedRange.fromRow; j<=selectedRange.toRow; ++j){
                      cSS.applyCssClass(grid, grid.getCellNode(j, selectedRange.toCell), _key, j, selectedRange.toCell, 'cell-right-border', cSS.composeCssClass(borderClasses));
                      var _value = ($(grid.getCellNode(j, selectedRange.toCell)).hasClass('cell-right-border')? {right: {width: 1, color:'#000'}} : {right:null});
                      modCom.saveFormatChange(j, selectedRange.toCell-1, _key, _value);
                    }
                    selectedRange = null;
                  }
                  else
                  {
                    cSS.applyCssClass(grid, options.$trigger[0], _key, _row, _col, 'cell-right-border', cSS.composeCssClass(borderClasses));
                    var _value = ($(options.$trigger[0]).hasClass('cell-right-border')? {right: {width: 1, color:'#000'}} : {right:null});
                    modCom.saveFormatChange(_row, _col, _key, _value);
                  }
                },
              },
              "all":{
                name:"Tutti",
                callback: function(key, options){
                  var borderClasses=['cell-top-border', 'cell-left-border', 'cell-bottom-border', 'cell-right-border'];
                  var _row = grid.getRowFromNode($(options.$trigger[0]).parent()[0]);
                  var _col = grid.getCellFromNode(options.$trigger[0])-1;
                  var _key = 'borders'
                  if(selectedRange && selectedRange.contains(_row, _col+1))
                  {
                    for(var i=selectedRange.fromRow; i<=selectedRange.toRow; ++i)
                      for(var j= selectedRange.fromCell; j<=selectedRange.toCell; ++j)
                      {
                        cSS.applyCssClass(grid, grid.getCellNode(i, j), _key, i, j-1, 'cell-top-border cell-left-border cell-bottom-border cell-right-border', cSS.composeCssClass(borderClasses));
                        var _value={};
                        if($(grid.getCellNode(i,j)).hasClass('cell-top-border')) 
                          $.extend(_value, {top: {width: 1, color:'#000'}}); 
                        else
                          $.extend(_value, {top:null});
                        if($(grid.getCellNode(i,j)).hasClass('cell-left-border')) 
                          $.extend(_value, {left: {width: 1, color:'#000'}}); 
                        else
                          $.extend(_value, {left:null});
                        if($(grid.getCellNode(i,j)).hasClass('cell-bottom-border')) 
                          $.extend(_value, {bottom: {width: 1, color:'#000'}}); 
                        else
                          $.extend(_value, {bottom:null});
                        if($(grid.getCellNode(i,j)).hasClass('cell-right-border')) 
                          $.extend(_value, {right: {width: 1, color:'#000'}}); 
                        else
                          $.extend(_value, {right:null});
                        modCom.saveFormatChange(i, j-1, _key, _value);
                      }
                      selectedRange = null;
                  }
                  else
                  {
                    cSS.applyCssClass(grid, options.$trigger[0], _key, _row, _col, 'cell-top-border cell-left-border cell-bottom-border cell-right-border', cSS.composeCssClass(borderClasses));
                    var _value = {};
                    if($(options.$trigger[0]).hasClass('cell-top-border')) 
                      $.extend(_value, {top: {width: 1, color:'#000'}}); 
                    else
                      $.extend(_value, {top:null});
                    if($(options.$trigger[0]).hasClass('cell-left-border')) 
                      $.extend(_value, {left: {width: 1, color:'#000'}}); 
                    else
                      $.extend(_value, {left:null});
                    if($(options.$trigger[0]).hasClass('cell-bottom-border')) 
                      $.extend(_value, {bottom: {width: 1, color:'#000'}}); 
                    else
                      $.extend(_value, {bottom:null});
                    if($(options.$trigger[0]).hasClass('cell-right-border')) 
                      $.extend(_value, {right: {width: 1, color:'#000'}}); 
                    else
                      $.extend(_value, {right:null});
                    modCom.saveFormatChange(_row, _col, _key, _value);
                  }
                },
              },
            },
          }
        }
      });
      callback(null, true);
    },
    data: function(callback){
      if($('#load').val() != 'undefined')
      {
	$.ajax({
	  url: '/load',
	  dataType: 'json',
	  contentType: 'application/json',
	  type: 'POST',
	  data: JSON.stringify({table:$('#name').val()}),
	  success: function(data, status, jqx){
	    loadedData={};
	    var borderArray=[];
	    var formatArray=[];
            var colorArray=[];
	    data.format.forEach(function(meta){
	      if(meta.key === 'borders' && meta.value)
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
	      if(meta.key === 'color')
                colorArray.push(meta);
	      if(meta.key != 'borders' && meta.key != 'color')
	      {
		formatArray.push(meta);
	      }
	    });
            var rowid=0;
            loadedData.table=[];
            while(rowid<100 || data.table.length>0){
              var inRow = data.table.filter(function(item){
                return item.row == rowid;
              });
              if(inRow.length == 0)
              {
                loadedData.table[rowid]={};
                loadedData.table[rowid].id=rowid;
                for(var i=1; i<grid.getColumns().length; ++i)
                {
                  loadedData.table[rowid]['col'+(i-1)]='';
                }
              }
              else
              {
                var r={};
                r.id=rowid;
                inRow.forEach(function(cell){
                  if(!(cell.col<grid.getColumns().length-1))
                  {
                    var delta=cell.col-grid.getColumns().length+1
                    while(delta>=0)
                    {
                      var cols=grid.getColumns();
                      cols.push({id:'col'+cols.length, name:cols.length, field:'col'+cols.length, width:70, editor:Slick.Editors.Text });
                      grid.setColumns(cols);
                      --delta;
                    }
                  }
                    r['col'+cell.col]=cell.val;
                });
                loadedData.table[rowid]=r;
              }
              data.table=data.table.filter(function(item){
                return item.row != rowid;
              });
              ++rowid;
            }
            loadedData.borders=borderArray;
            loadedData.format=formatArray;
            loadedData.color=colorArray;
            loadedData.layout=data.layout;
            loadedData.locks=data.locks;
            callback(null, loadedData);
      },
    });
      }
      else
      {
        var genData={};
	var data=[]
	for(var i=0; i<100; ++i)
	{
	  data[i]={};
	  data[i].id=i;
	  for(var j=1; j<100; ++j)
	  {
	    data[i]['col'+(j-1)]="";
	  }
	}
	genData.table=data;
	callback(null, genData);
      }
    }
  },
  function(err, results){
    dataView.beginUpdate();
    dataView.setItems(results.data.table);
    dataView.endUpdate();
    if(results.data.format)
    {
      results.data.format.forEach(function(f){
        var style={};
        style[f.row]={};
        style[f.row]['col'+f.col]='cell-'+f.key;
        grid.addCellCssStyles(f.key+f.row+'-'+f.col, style);
      });
    }
    if(results.data.borders)
    {
      var hashes=[];
      results.data.borders.forEach(function(b){
        var style={};
        style[b.row]={};
        var classes=[];
        var hash='borders'+b.row+'-'+b.col;
        if(b.top){
          classes.push('cell-top-border');
        }
        if(b.left){
          classes.push('cell-left-border');
        }
        if(b.bottom){
          classes.push('cell-bottom-border');
        }
        if(b.right)
        {
          classes.push('cell-right-border');
        }
        style[b.row]['col'+b.col]=classes.join(' ');;
        grid.addCellCssStyles(hash, style);
      });
    }
    if(results.data.layout)
    {
      console.log(results.data.layout);
      results.data.layout.forEach(function(l){
        if(l.type === 'col')
        {
          grid.getColumns()[l.position+1].width=l.size;
          grid.updateWidths();
        }
      });
    }
    if(results.data.color)
    {
      console.log(results.data.color);
      results.data.color.forEach(function(c){
        if(c.value && c.value.rgb){
          cSS.createColorClassIfNotExists(c.value.rgb.substr(2));
//           if(!cSS.lookForClass('.cell-bg'+c.value.rgb.substr(2)))
//             $("<style type='text/css'> .cell-bg"+c.value.rgb.substr(2)+"{ background-color: #"+c.value.rgb.substr(2)+" }</style>").appendTo("head");
          style={};
          style[c.row]={};
          style[c.row]['col'+c.col]='cell-bg'+c.value.rgb.substr(2);
          grid.addCellCssStyles(c.key+c.row+'-'+c.col, style);
        };
      });
    }
    if(results.data.locks)
    {
      results.data.locks.forEach(function(lock){
        style={};
        style[lock.row]={};
        style[lock.row]['col'+lock.col]='cell-editing';
        grid.addCellCssStyles('lock'+lock.row+'-'+lock.col, style);
      });
    }
  });
  $('#tab').height($(window).height());
  var socket = io.connect('http://table.stschioppa.hom', {'sync disconnect on unload' : true});  
  socket.on('connect', function(){
    console.log('connected');
    grid.onBeforeEditCell.subscribe(function(e, args){
      var deferred=Q.defer();
      socket.emit('datalock-req', {row: args.row, col: args.cell-1, table:{name:$('#name').val()}}, function(data){
        var _row=args.row;
        var _col=args.cell;
        if(data.accepted)
        {
          grid.onActiveCellChanged.subscribe(function(e, args){
            socket.emit('datalock-lift', {row: _row, col: _col-1, table:{name:$('#name').val()}}, function(data){});
            grid.onActiveCellChanged.unsubscribe();
          });
        }
        deferred.resolve(data.accepted);
      });
      return deferred.promise;
    });
  });
  socket.on('error', function(err){
    console.log(err);
  });
  socket.on('datachange'+$('#name').val(), function(data){
    if(data.change_type === 'data')
    {
      grid.invalidateRow(data.row);
      var row=dataView.getItem(data.row);
      row['col'+data.col]=data.val;
      dataView.updateItem(data.row, row);
      grid.removeCellCssStyles('lock'+data.row+'-'+(data.col));
      grid.render();
    }
    if(data.change_type === 'format')
    {
      if(data.key === 'bold')
      {
        if(data.value)
        {
          style={};
          style[data.row]={};
          style[data.row]['col'+data.col]='cell-bold';
          grid.setCellCssStyles('bold'+data.row+'-'+data.col, style);
        }
      }
      if(data.key === 'italic')
      {
        if(data.value)
        {
          style={};
          style[data.row]={};
          style[data.row]['col'+data.col]='cell-italic';
          grid.setCellCssStyles('italic'+data.row+'-'+data.col, style);
        }
      }
      if(data.key === 'color')
      {
        if(data.value)
        {
//           if(!cSS.lookForClass('.cell-bg'+data.value.rgb.substr(2)))
//             $("<style type='text/css'> .cell-bg"+data.value.rgb.substr(2)+"{ background-color: #"+data.value.rgb.substr(2)+" }</style>").appendTo("head");
          cSS.createColorClassIfNotExists(data.value.rgb.substr(2));
          style={};
          style[data.row]={};
          style[data.row]['col'+data.col]='cell-bg'+data.value.rgb.substr(2);
          grid.setCellCssStyles('color'+data.row+'-'+data.col, style);
        }
        
      }
      if(data.key === 'borders')
      {
        if(data.value)
        {
          var classes=[];
          if(data.value.top)
            classes.push('cell-top-border');
          if(data.value.left)
            classes.push('cell-left-border');
          if(data.value.bottom)
            classes.push('cell-bottom-border');
          if(data.value.right)
            classes.push('cell-right-border');
          style={};
          style[data.row]={};
          style[data.row]['col'+data.col]=classes.join(' ');
          grid.setCellCssStyles('border'+data.row+'-'+data.col, style);
        }
      }
    }
    if(data.change_type === 'layout')
    {
      if(data.type === 'col')
      {
        grid.getColumns()[data.position+1].width=data.size;
        grid.updateWidths();
      }
    }
  });
  socket.on('datalock', function(data){
    if(data.table.name === $('#name').val())
    {
      var style={};
      style[data.row]={};
      style[data.row]['col'+data.col]='cell-editing';
      grid.setCellCssStyles('lock'+data.row+'-'+data.col, style);
    }
  });
  socket.on('datalock-lift', function(data){
    if(data.table.name === $('#name').val())
      grid.removeCellCssStyles('lock'+data.row+'-'+(data.col));
  });
});