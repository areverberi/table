$(document).ready(function(){
  $('#newt').click(function(e){
    e.preventDefault();
    $.prompt({state0: {
      title: 'Nuovo foglio di calcolo',
      html:'<label>Nome: <input type=text name="name"></label>',
      buttons:{"Conferma":true, "Annulla":false},
      submit:function(e, v, m, f){
	window.location.href='/t/'+f.name;
      }
    }});
  });
  $('#listt').click(function(e){
    e.preventDefault();
    if($('#listt-container').hasClass('full'))
    {
      $('#listt-container').empty();
      $('#listt-container').removeClass('full');
    }
    else
    {
      $.ajax({
	url: '/list',
	dataType: 'json',
	contentType: 'application/json',
	type: 'GET',
	success: function(data, status, jqx){
	  $('#listt-container').append('<br><br>');
	  data.forEach(function(t){
	    if(t)
            {
	      $('#listt-container').append('<a href=/t/'+t+' >'+t+'</a>&nbsp;&nbsp;&nbsp;&nbsp<a href=/clone/'+t+'/to/ class=clone >Duplica</a><br>');
            }
	  });
          $('#listt-container').on('click', '.clone', function(e){
            e.preventDefault();
            var event=e;
            $.prompt({state0:{
              title: 'Nome della copia',
              html:'<label>Nome: <input type=text name="name"></label>',
              buttons:{"Conferma":true, "Annulla":false},
              submit:function(e,v,m,f){
                window.location.href=event.target.href+f.name;
              },
            }});
          });
	  $('#listt-container').addClass('full');
	}
      });
    }
  });
  $('#upload').click(function(e){
    e.preventDefault();
    $('body').append('<form id="uploadForm" enctype="multipart/form-data" action="/upload" method="post"><input type="file" name="up-file"/><input type=submit value="Carica" name="submit"></form>');
  });
}); 
