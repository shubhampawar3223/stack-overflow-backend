const express = require('express');
const app = express();
const cors = require('cors');
const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const dbUrl = process.env.DB_URL ||  'mongodb://127.0.0.1:27017';

app.use(express.json());
app.use(cors());


app.post('/signup',async(req,res)=>{
   try{
    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db('web-app');
    let find = await db.collection('users').findOne({email:req.body.email});
    if(!find){
       let salt = await bcrypt.genSalt(10);
       let hash = await bcrypt.hash(req.body.password, salt);
       req.body.password = hash;
       let max = 10000000;
      let min =0;   
      let id= Math.floor(Math.random() * (max - min) + min);
       req.body.profilePic='https://res.cloudinary.com/shubh8991/image/upload/v1618658694/blank_m0t3o4.jpg'
       req.body.tags=[];
       req.body.userId = id;
       let response = await db.collection('users').insertOne(req.body);
       res.status(200).json({message:"User Created Successfully."});
       let userProfile={
         email:req.body.email,
         userId:id,
         title:"",
         location:"",
         aboutMe:"",
         website:"",
         twitter:"",
         git:"",
         queCount:0,
         ansCount:0,
       }
       await db.collection('user-profiles').insertOne(userProfile);
       clientInfo.close();
    }
    else{
       res.status(400).json({message:"User already present."}) 
    }
    clientInfo.close();
   }
   catch(e){
    console.log(e);
   }
})

app.post('/login',async(req,res)=>{
   try{
     let clientInfo = await mongoClient.connect(dbUrl);
     let db = clientInfo.db('web-app');
     let check = await db.collection('users').findOne({email:req.body.email});
     if(check){
       let verify = await bcrypt.compare(req.body.password,check.password);
       if(verify){
           let token = await jwt.sign({user_id:check._id},process.env.JWT_KEY);
           if(check.tags.length !== 0)
           res.status(200).json({message:"Login Success", token:token, tags:true, userId:check.userId});
           else
           res.status(200).json({message:"Login Success", token:token, tags:false, userId:check.userId});
       }
       else{
           res.status(400).json({message:"Invalid Password"})
       }    
     }
     else{
           res.status(404).json({message:"User doesn't exit"});
     }
     clientInfo.close();
   }
   catch(e){
     console.log(e);    
   }
})

//api to get all users
app.get('/users',async(req,res)=>{
   try{
    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db('web-app');
    let data = await db.collection('users').find().project({email: 0,password: 0}).toArray();
    res.status(200).json({message:"success",data:data});
    clientInfo.close();
   } 
   catch(e){
       console.log(e);
   }
})

app.get('/users/:id',async(req,res)=>{
    try{
      let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db('web-app');
    let data1 = await db.collection('users').find({userId: +req.params.id}).project({email:0, password:0}).toArray();
    let data2 = await db.collection('user-profiles').find({userId: +req.params.id}).project({email:0,userId:0}).toArray();
    let data3 = await db.collection('questions').find({userId: +req.params.id}).project({title:1,queId:1}).toArray();
    res.status(200).json({message:"success", data1:data1, data2:data2,data3:data3 })
    clientInfo.close();
    }
    catch(e){
      console.log(e);
    }
})

//api to get user profile
app.get('/profile',authenticate ,async(req,res)=>{
     try{
      let clientInfo = await mongoClient.connect(dbUrl);
      let db = clientInfo.db('web-app');
      let response = await db.collection('user-profiles').findOne({email:req.body.email});
      res.status(200).json({message:"Success",data:response});
      clientInfo.close(); 
    } 
     catch(e){
       console.log(e);
     }
})


//api to edit user profile
app.put('/edit-profile/:id',authenticate, async(req,res)=>{
      try{
        let clientInfo = await mongoClient.connect(dbUrl);
        let db = clientInfo.db('web-app');
        let tags = req.body.tags;
        let profileUrl = req.body.profilePic;
        let resp =  await db.collection('users').findOneAndUpdate({userId:+req.params.id},{$set:{
          tags: req.body.tags, 
          name:req.body.name          
        }});
        let response = await db.collection('user-profiles').findOneAndUpdate({userId:+req.params.id},
          {$set:{ 
          location:req.body.location,
          title:req.body.title, 
          aboutMe:req.body.aboutMe,
          website:req.body.website,
          twitter:req.body.twitter,
          git:req.body.git
        }});      
        res.status(200).json({message:"update successful"});
        clientInfo.close();
      }
      catch(e){
        console.log(e);
      }
})

//api to post a question
app.post('/post-que',authenticate, async(req,res)=>{
    try{
      let clientInfo = await mongoClient.connect(dbUrl);
      let db = clientInfo.db('web-app');
      await db.collection('questions').insertOne(req.body);
      res.status(200).json({message:"success"});
      await db.collection('user-profiles').findOneAndUpdate({userId:+req.body.userId},{$inc:{queCount:1}});
      clientInfo.close();
    }
    catch(e){
      console.log(e);
    }
})

app.get('/que/:id',async(req,res)=>{
      try{
        let clientInfo = await mongoClient.connect(dbUrl);
        let db = clientInfo.db('web-app');
        let resp1 = await db.collection('questions').findOne({queId: +req.params.id});
        let resp2 = await db.collection('response').find({queId: +req.params.id}).toArray();        
        res.status(200).json({message:"success", data1:resp1, data2:resp2});        
        clientInfo.close();     
      }
      catch(e){
         console.log(e) 
      }
})

//get all questions
app.get('/all-que',async(req,res)=>{
  try{
   let clientInfo = await mongoClient.connect(dbUrl);
   let db = clientInfo.db('web-app');
   let response = await db.collection('questions').find().toArray();
   var data2=[];
   var resp;
    async function getUserInfo(e){ 
      let resp = await db.collection('users').find({userId: e.userId}).project({name:1,profilePic:1,userId:1}).toArray();
      return resp[0];
    }

   async function traverse(){
   response.map(async(e,i)=>{ 
   resp = await getUserInfo(e);
   //await db.collection('users').findOne({email: e.email});       
   data2.push(resp);    
   if(i === response.length-1){
    res.status(200).json({message:"Success",data:response, data2:data2});
   }
  })  
}
  
  traverse();   
   clientInfo.close();
  } 
  catch(e){
    console.log(e);
  }
})


//post response for a question
app.post('/que-response',authenticate, async(req,res)=>{
   try{
    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db('web-app');                
    await db.collection('response').insertOne(req.body);
    await db.collection('questions').findOneAndUpdate({queId:+req.body.queId},{$inc:{answerCount:1}})
    res.status(200).json({message:"success"});
    await db.collection('user-profiles').findOneAndUpdate({userId:+req.body.userId},{$inc:{ansCount:1}});
    clientInfo.close();
   }
   catch(e){
     console.log(e);
   }
})

app.put('/update-que-votes/:id',authenticate,async(req,res)=>{
    try{
        let clientInfo = await mongoClient.connect(dbUrl);
        let db = clientInfo.db('web-app');
        db.collection('questions').findOneAndUpdate({queId:+req.params.id},{$set:{votes:+req.body.votes}});
        res.status(200).json({message:"Success"});   
        clientInfo.close();   
      }
    catch(e){
      console.log(e); 
    }
})

app.put('/update-resp-votes/:id',authenticate,async(req,res)=>{
  try{
      let clientInfo = await mongoClient.connect(dbUrl);
      let db = clientInfo.db('web-app');            
      db.collection('response').findOneAndUpdate({
        responseId:+req.params.id},{$set:{votes:+req.body.votes}});
      res.status(200).json({message:"Success"});   
      clientInfo.close();
  }
  catch(e){
    console.log(e); 
  }
})

//get responses of a question
app.get('/get-que-resp',authenticate,async(req,res)=>{
   try{
    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db('web-app');                
    let data = await db.collection('response').find({queId:req.body.id}).toArray();
    res.status(200).json({message:"success",data:data});
    clientInfo.close(); 
  } 
   catch(e){
    console.log(e);
   }
})


app.get("/tags",async(req,res)=>{
    try{
    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db('web-app');
    let data = await db.collection('tags').find().toArray();
    res.status(200).json({message:"success",data:data});
    clientInfo.close(); 
    }
    catch(e){
       console.log(e);
    }
})

app.get('/check',authenticate,(req,res)=>{
     res.send("Hiee");
})

function authenticate(req,res,next){
  if(req.headers.authorisation !== undefined){
       jwt.verify(
           req.headers.authorisation,
           process.env.JWT_KEY,
           (error, decode)=>{
              if(error){
                res.status(401).json({message:"NO token"});            
              }
              else{
                next();
              }
           }
       )
  }
  else{
      res.status(401).json({message:"NO token"})
  }
}

app.listen(port,()=>{console.log("Server is listening on "+port)});

