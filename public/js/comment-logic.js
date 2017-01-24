$(document).ready(function(){
	var input     =$("#comments-input");
	var alert_text=$(".alert-text");
	var err_player=0;


	$(".comments-send-btn").click(sendComment);
	input.keydown(function(e){
		if(e.which==13){
			sendComment();
		}
	});
	function sendComment(){
		if(input.attr("disabled")){
			alertText("로그인을 해주세요.")
		}
		if(!player){
			if(err_player>=1){
				alertText("플레이어가 로드되지 않는다면 페이지를 다시 열어보세요.");
			}
			alertText("아직 플레이어가 로드되지 않았습니다.");
			err_player++;
			return;
		}
		var floatTime=player.getCurrentTime();

		var text=input.val();
		if(!checkText(text)){
			return false;
		}
		input.val("");
		$.ajax({
			url:"/api/write/comment",
			type:"post",
			dataType:"json",
			data:{
				videoIndex:videoIndex,
				comment   :text,
				floatTime :floatTime
			},
			success:function(res){
				if(res.result!=="success"){
					alertText("올바르지 않은 값을 서버에 전달 하셨습니다.");
					return;
				}
				/*
				var nC     =nowComment;
				if(!comments[nC]){
					$(".comment-line-wrap").append(content);
					return;
				}
				var nCfloat=comments[nC].floatTime;
				var content='<article class="comment-line">'+text+'</article>';

				$(".comment-line[data-index="+nC+"]").after(content);
				*/
			}
		});
	}
	function alertText(val){
		alert_text.text(val);
		setTimeout(function(){
			alert_text.text("");
		},3000);		
	}
	function checkText(text){
		if(text.length<=0){
			return false;
		}
		return true;
	}

	var comment_info=$(".comment-info");
	var comment_info_thumbnail=$(".comment-info .thumbnail");
	var comment_info_content  =$(".comment-info .content");
	var comment_info_loading  =$(".comment-info .loading");
	var active_comment_info   =null;
	$(window).click(function(e){
		if(e.target.className=="comment-line"){
			alertCommentInfo.apply(e.target);
		}
		if(e.target.tagName=="BODY"){
			comment_info.hide();
			active_comment_info   =null;
		}
	});
	function alertCommentInfo(){
		var th=$(this);
		var data_id=th.attr("data-id");
		if(active_comment_info==data_id){
			comment_info.hide();
			active_comment_info   =null;
			return;
		}
		comment_info.show();
		comment_info_loading.show();

		var Cinedx=th.attr("data-index")
		var index=th.attr("writer");
		if(commentWriters[index]){
			comment_info_loading.hide();
			active_comment_info=data_id;
			setCommentInfo(Cinedx,commentWriters[index]);
			return;
		}
		$.ajax({
			type:"post",
			dataType:"json",
			url:"/api/user/getInfo",
			data:{
				userIndex:index
			},success:function(result){
				comment_info_loading.hide();
				active_comment_info=data_id;

				if(result.result=="error"){
					comment_info_content.html("<span style='color:red'>서버로부터 데이터를 가져오지 못하였습니다.</span>");
					return;
				}
				setCommentInfo(Cinedx,result.data);
				commentWriters[result.data.index]=result.data;
			}
		});
	};
	function setCommentInfo(index,user){
		var c=comments[index];
		comment_info_content.html("<span class='floatTime'>"+timeFormat(c.floatTime)+"</span>"+" <a target=blank href='/user/"+user.index+"'><b>"+user.nickname+"</b></a><br/>"+c.text);
		comment_info_thumbnail.html("<img src="+user.thumbnail+">");
	}
	function timeFormat(ftime){
		var min=String(Math.floor(ftime/60));
		var sec=String(Math.floor(ftime%60));
		var f  ="";
		if(sec.length==1){
			f="0";
		}
		return min+":"+f+sec;
	}
});

var canvas   =document.getElementById("comments-canvas");
var videoWrap=$(".video-wrap");
canvas.width =videoWrap.width();
canvas.height=videoWrap.height();

var context  =canvas.getContext('2d');
context.font ="20px 맑은 고딕";
context.fillStyle="#fff";
context.textBaseline="top";

var cl_wrap=$(".comment-line-wrap");
var scroll_active=true;
var scroll_timer;

var co_mark=$(".comment-mark");
var co_mark_v=370/comments.length;
cl_wrap.on("mousewheel DOMMouseScroll",function(e){
	cl_wrap.stop(true);
	scroll_active=false;
	if(scroll_timer){
		clearTimeout(scroll_timer);
	}
	scroll_timer=setTimeout(function(){
		scroll_active=true;
	},5000);
});
function floatComment(comment){
	context.font ="20px 맑은 고딕";
	context.fillStyle="#fff";
	context.textBaseline="top";

	context.fillText(comment.text,comment.posX,comment.posY);

	if(comment.width+comment.posX<0){
		return false;
	}
	return true;
}
function getTextSize(text){
	return {
		width:context.measureText(text).width,
		//height:getTextHeight(context.font).height
	}
}

var animationFrame;

var step_oldTime  = (new Date()).getTime();
var step_oldRtime = (new Date()).getTime();
function readyStep(){
	step_oldTime  = (new Date()).getTime();
	step_oldRtime = (new Date()).getTime();
	computeIndexs();
}
function computeIndexs(){
	//startComment
	//nowComment
	var nowCurrent=player.getCurrentTime();
	var sp=0,ep=comments.length;
	while(sp<=ep){
		var cp=Math.floor((sp+ep)/2);
		if(nowCurrent<comments[cp].floatTime){
			ep=cp-1;
		}else{
			sp=cp+1;
		}
	}
	nowComment  =sp;
	startComment=sp;
	cl_wrap.stop(true);
	cl_wrap.animate({scrollTop:(nowComment)*30},500);
	co_mark.css("top",co_mark_v*nowComment);
}
function step(){
	var now=(new Date()).getTime();
	if(now-step_oldTime>500){
		step_oldTime=now;
		var nowCurrent=player.getCurrentTime();
		for(var i=nowComment; i<comments.length; i++){
			if(comments[i].floatTime>nowCurrent){
				break;
			}
			//right->left
			comments[i].posX=canvas.width;
			comments[i].posY=0;
			for(var j=startComment; j<i; j++){
				var tempComment=comments[j];
				if(tempComment.width+tempComment.posX>canvas.width || comments[i].posY==tempComment.posY){
					comments[i].posY+=initialHeight;
				}
				if(comments[i].posY>canvas.height){
					comments[i].posY=0;
				}
			}

			var s=getTextSize(comments[i].text);
			comments[i].width=s.width;
			comments[i].height=initialHeight;
			//comments[nowComment].font;

			//velocity=distance(=width+canvas.width)/time
			comments[i].velX=-(comments[i].width+canvas.width)/3500;
			if(scroll_active===true){
				cl_wrap.animate({scrollTop:(nowComment)*30},200);
			}
			co_mark.css("top",co_mark_v*nowComment);
			nowComment++;
		}
	}

	var now=(new Date()).getTime();
	var duration=now-step_oldRtime;
	step_oldRtime=now;

	context.clearRect(0,0,canvas.width,canvas.height);
	var t=false;
	var te=0;
	for(var i=startComment; i<nowComment; i++){
		comments[i].posX+=comments[i].velX*duration;
		var o=floatComment(comments[i]);
		if(!o && !t){
			startComment++;
		}
		if(o){
			t=true;
		}
	}		

	animationFrame=window.requestAnimationFrame(step);
};

var getTextHeight = function(font) {

  var text = $('<span>Hg</span>').css({ fontFamily: font });
  var block = $('<div style="display: inline-block; width: 1px; height: 0px;"></div>');

  var div = $('<div></div>');
  div.append(text, block);

  var body = $('body');
  body.append(div);

  try {

    var result = {};

    block.css({ verticalAlign: 'baseline' });
    result.ascent = block.offset().top - text.offset().top;

    block.css({ verticalAlign: 'bottom' });
    result.height = block.offset().top - text.offset().top;

    result.descent = result.height - result.ascent;

  } finally {
    div.remove();
  }

  return result;
};
var initialHeight=getTextHeight(context.font).height;