var express    = require("express");
app=express();
var bodyParser=require("body-parser");
var session=require("express-session");
	app.use(session({
		secret:"@@@@@@@",
		resave:false,
		saveUninitialized:true
	}));

var router  = require("./_ROUTER")(app);
var request =require("request");
var cheerio =require("cheerio");

app.set("views",__dirname+'/public');
app.set('view engine','ejs');
app.engine('html',require('ejs').renderFile);

var HTTP_SERVER=app.listen(80,function(){
	console.log(new Date()+"\n로컬서버에 성공적으로 연결되었습니다.\n\n");
});
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));

var MongoClient=require("mongodb").MongoClient;
var db;
var col_flags; //col -> collection
var col_users; //col -> collection
var col_authEmail;
MongoClient.connect("mongodb://localhost:27017/FCS",function(err,m_db){
	if(err){
		throw err;
	}
	console.log(new Date()+"\n데이터베이스에 성공적으로 연결되었습니다.\n\n");
	db=m_db;
	col_flags=db.collection("flags");
	col_users=db.collection("users");
	col_authEmail=db.collection("auth_email");

	OnDB();
});

//이메일 전송 모듈
var nodemailer = require("nodemailer");
var smtpTransport = require("nodemailer-smtp-transport");
smtpTransport = nodemailer.createTransport(smtpTransport({  
    host:"smtp.gmail.com",
    secureConnection: false,
    port: 587,
    auth: {
        user: 'floatcommentservicemail@gmail.com',
        pass: 'tellyourworld'
    }
}));

function OnDB(){
	/******************************************************************************************/
	//페이지
	/******************************************************************************************/
	app.get("/watch/:flagIndex",function(req,res){
		var flagIndex=Number(req.params.flagIndex);
		col_flags.find({"index":flagIndex}).toArray(function(err,result){
			if(err){
				throw err;
			}
			if(result.length<=0){
				res.render("404.html");
				return;
			}
			res.render("watch.html",{
				flag     :result[0],
				user_info:req.session.user_info
			});
		});
	});
	app.get("/user/:index",function(req,res){
		var index=Number(req.params.index);
		col_users.find({index:index},{index:1,thumbnail:1,nickname:1}).toArray(function(err,result){
			if(result.length<=0){
				res.render("404.html");
				return;
			}
			var data=result[0];
			col_flags.find({writer:data.index},{comments:0}).toArray(function(err,result){
				res.render("user.html",{
					user_info:req.session.user_info,
					target:data,
					flags :result	
				});
			});
		});
	});
	/******************************************************************************************/
	//API 로직
	/******************************************************************************************/
	app.post("/api/sync/sendEmail",function(req,res){
		var email=req.body.email;
		var password=req.body.password;
		console.log(email,password);
		if(typeof email!="string" || typeof password!="string" || (password.length<8 || password.length>100) || !checkEmail(email)){
			res.end(JSON.stringify({
				result:"error"
			}));
			return;
		}
		var mailOptions = {  
		    from: 'floatcommentservicemail@gmail.com',
		    to:   email,
		    text: '<a>'
		};
		/*
		smtpTransport.sendMail(mailOptions, function(err, response){
		    if(err){
		    	throw err;
		    }
		    console.log("mail");
		    res.end(JSON.stringify({
		    	result:"success"
		    }));
		    smtpTransport.close();
		});
		*/
	});
	app.post("/api/user/login",function(req,res){ //로그인 처리
		var email   =req.body.email;
		var password=req.body.password;
		col_users.find({email:email,password:password}).toArray(function(err,result){
			if(err){
				throw err;
			}
			if(result.length<=0){
				res.end(JSON.stringify({
					result:"error"
				}));
			}else{
				var data=result[0];
				req.session.user_info={
					index      :data.index,
					email      :data.email,
					nick       :data.nickname,
					thumbnail  :data.thumbnail,
					signup_date:data.signup_date
				};
				res.end(JSON.stringify({
					result:"success",
					data  :req.session.user_info
				}));
			}
		});
	});
	app.post("/api/user/getInfo",function(req,res){
		col_users.find({index:Number(req.body.userIndex)},{index:1,thumbnail:1,nickname:1}).toArray(function(err,result){
			if(result.length<=0){
				res.end(JSON.stringify({
					result:"error"
				}));
				return;
			}
			var data=result[0];
			res.end(JSON.stringify({
				result:"success",
				data:data
			}));
		});
	});

	app.post("/api/list/flags/",function(req,res){
		var sort =req.body.sort;
		switch(sort){
			case "rank":
				var sortQuery={like:-1}
			case "new":
			default:
				var sortQuery={upload_date:-1}
		}
		//rank , new
		var skip =Number(req.body.skip) || 0;
		var limit=Number(req.body.limit);
		if(!limit || limit>100){
			limit=50;
			return;
		}
		col_flags.find({},{comments:0}).sort(sortQuery).skip(skip).limit(limit).toArray(function(err,result){
			if(err){
				throw err;
			}
			res.end(JSON.stringify({
				result:"success",
				data  :result
			}));
		});
	});
	app.get("/api/list/comments/:videoIndex",function(req,res){
		var videoIndex=Number(req.params.videoIndex);
		col_flags.find({idnex:videoIndex},{comments:1}).toArray(function(err,result){
			res.end(JSON.stringify(result[0].comments));
		});
	});
	
	app.post("/api/write/flag");
	app.post("/api/write/comment",function(req,res){
		if(!req.session.user_info){
			return;
		}
		//post
		//videoIndex
		//comment
		var videoIndex=Number(req.body.videoIndex);
		var comment   =req.body.comment;
		var floatTime =Number(req.body.floatTime);
		if(isNaN(floatTime) || floatTime<0 || floatTime==Infinity){
			return;
		}
		//300 글자
		if(typeof comment!="string" || comment.length<=0 || comment.length>300){
			return
		}
		col_flags.find({index:videoIndex}).toArray(function(err,result){
			if(result.length<=0){
				return;
			}
			var data=result[0];
			var now =new Date();
			col_flags.update({index:Number(videoIndex)},
				{$push:{
				comments:{
					$each:[
					{
					id:data.comments.length,
					text:comment,
					date:{
						time :now.getTime(),
						offset:now.getTimezoneOffset()
					},
					writer:req.session.user_info.index,
					floatTime:floatTime
					}],
					$sort:{floatTime:1}
				}
				}},
				function(err){
					if(err){
						throw err;
					}
					res.end(JSON.stringify({
						result:"success"
					}));
				}
			);
		});
	});
}

function checkEmail(text) {
	const re=/^[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/i;
	if(text.length<6 || !re.test(text)) {
		return false;
	}else{
		return true;
	}
}