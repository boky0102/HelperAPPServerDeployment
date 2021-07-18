// Packages

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { urlencoded } = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv').config();
const cookieParser = require('cookie-parser');
const axios = require('axios');

const multer = require('multer');

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "./public/jobPictures/");
    },

    filename: function(req,file,cb) {
        cb(null, new Date().toISOString().split(":").join("-") + file.originalname);
    } 
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png'){
        cb(null, true);
    } else{
        cb(null, false);
    }
}

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
});



const options = {

}

// Server modules
const auth =  require("./authenticate.js");
const distance = require("./distanceCalc");
const titleDiff = require("./searchLogic");

const port = process.env.PORT || 3000;



// Server and database initialization


const app = express();





app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use("/public/jobPictures",express.static(__dirname + "/public/jobPictures"));


mongoose.connect('mongodb+srv://'+ process.env.MONGODB_USER + ':' + process.env.MONGODB_PASSWORD +'@helperapp.xnuvx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority', {useNewUrlParser: true, useUnifiedTopology: true});


const userSchema = new mongoose.Schema({
    userName: String,
    firstAndLastName: String,
    password: String,
    dateCreated: String,
    streetAndNum: String,
    city: String,
    country: String,
    coordinates: {
        x: Number,
        y: Number
    },
    reviews: [
        {
            reviewer: String,
            note: String,
            rating: Number
        }
    ],
    whatsapp: Boolean,
    facebook: Boolean,
    viber: Boolean,
    facebookURL: String,
    avatar: String,
    phonePref: String,
    phonePost: String

})


const User = mongoose.model('User', userSchema);


const jobSchema = new mongoose.Schema({
    username: String,
    title: String,
    description: String,
    category: String,
    deadline: String,
    budget: Number,
    streetAndNum: String,
    city: String,
    country: String,
    imgSrc: String,
    coordinates: {
        x: Number,
        y: Number
    },
    distance: String,
    applications: [{
        username: String,
        dates: [String],
        applicationDate: [String],
        message: [String]
    }],
    scheduled: Boolean,
    worker: String,
    completed: Boolean


});



const Job = mongoose.model('Job', jobSchema);

const messageSchema = new mongoose.Schema({
    user1: String,
    user2: String,
    user1Avatar: String,
    user2Avatar: String,
    user1fullName: String,
    user2fullName: String,
    messCount: Number,
    messages: [{
        sender: String,
        message: String,
        date: String
    }]
});

const Message = mongoose.model('Message', messageSchema);


const Notification = mongoose.model('Notification', jobSchema);
const notificationSchema = new mongoose.Schema({
    user: String,
    notificationMessage: String
})




function sortByDiffIndex(jobA, jobB){
    if(jobA.titleDiffIndx >= jobB.titleDiffIndx){
        return 1;
    } else{
        return -1;
    }
}



function filterJobsByTitle(jobs,title){


    return new Promise((resolve, reject) => {
        const filteredJobs = [];

   

        jobs.forEach((job) => {
        

        const titleDiffIndx = titleDiff.getTitleDiffIndex(job.title, title);
        
        if(titleDiffIndx > 1){
            const jobWthIndx = {
                username: job.username,
                budget: job.budget,
                title: job.title,
                category: job.category,
                description: job.description,
                imgSrc: job.imgSrc,
                id: job.id,
                deadline: job.deadline,
                diffIndx: titleDiffIndx,
                coordinates: job.coordinates
            };
            
            filteredJobs.push(jobWthIndx);
        }

        const returnArray = filteredJobs.sort((a,b) => (a.diffIndx > b.diffIndx ? -1 : 1));

        resolve(returnArray);


    })


        
    })

}

function filterOutPending(job,user){
    let userApplied = false;
    job.applications.forEach((applicant) => {
        if(applicant.username === user){
            userApplied = true;
        }
    })
    
    return userApplied;
}


// ROUTING



app.get("/", (req,res) => {
    //obrisi ovo
    User.find((err, users) => {
        res.send(users);
    })
})




app.get("/users/:usrName", (req,res) => {
    const reqUser = req.params.usrName;

    User.findOne({userName: reqUser}, (err, user) => {
        if(err){
            res.send(err);
        } else{
            res.send(user);
        }
    })

})

app.post("/register", (req,res) =>{
    const reqUsername = req.body.username;
    const reqPassword = req.body.password;


    bcrypt.hash(reqPassword, 10 , (err, hash) => {
        User.findOne({userName: reqUsername}, (err, user) => {
            if(err){
                res.send(err);
                
            } else if(user){
                res.send("User exists");
                
            } else if(!user){
                const hashedPassword = hash;
                
                
                const newUser = new User({
                userName: reqUsername,
                password: hashedPassword,
                dateCreated: new Date()
                });

                const url = 'https://wft-geo-db.p.rapidapi.com/v1/geo/cities';

                var options = {
                method: 'GET',
                params: {limit: '1', namePrefix: req.body.city},
                headers: {
                    'x-rapidapi-key': process.env.RAPID_API,
                    'x-rapidapi-host': 'wft-geo-db.p.rapidapi.com'
                }
                };

                axios.get(url,options)
                .then((response) => {

                    const data = response.data.data;
            

                    if(data.length >= 1){
                        
                        const x = data[0].latitude;
                        const y = data[0].longitude;


                        newUser.coordinates.x = x;
                        newUser.coordinates.y = y;

                        
                        
                        newUser.streetAndNum = req.body.streetAndNum;
                        newUser.city = req.body.city;
                        newUser.country = req.body.country;
                        newUser.firstAndLastName = req.body.firstAndLastName
                        
                        newUser.save();

                        let token = jwt.sign(newUser.toJSON(), process.env.JWT_SECRET, {
                            algorithm: 'HS512',
                            expiresIn: "1 week"
                        })

                        res.json({token: token, username: newUser.userName, userCoordinateX: newUser.coordinates.x, userCoordinteY: newUser.coordinates.y});


                        
                        }
                        else{
                            
                            res.status(400).send();
                        }

                })
                .catch(console.log("Bad request"));
                
                
                
                
                
                }
                })
    })
    
}
);

app.post("/login", (req,res) => {
    const reqUsername = req.body.username;
    const reqPassword = req.body.password;



    User.findOne({userName: reqUsername}, (err, user) => {
        if(err){
            res.send(err);
        } else if (user){
            bcrypt.compare(reqPassword, user.password, (error, same) => {
                if(err){
                    console.log(err);
                    
                } else{
                    if(same){
                        let token = jwt.sign(user.toJSON(), process.env.JWT_SECRET, {
                            algorithm: 'HS512',
                            expiresIn: "1 week"
                            })

                        
                        
                        res.json({token: token, username: user.userName, userCoordinateX: user.coordinates.x, userCoordinteY: user.coordinates.y});
                        
                    }else{
                    res.status(401).send();
                }}
                
            })
        } else if(!user){
            res.status(401).send();
        }

    })

    
    }
)

app.get("/tajna", [auth.isAuth], (req,res) => {
    res.json(req.jwt.userName);
    
    
})






app.post("/newJob", upload.single("productImage") ,(req,res) => {



    const imgPathPretty = req.file.path.replace("\\", "/");

    

    const newJob = new Job({
        username: req.body.username,
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        deadline: req.body.deadline,
        budget: req.body.budget,
        streetAndNum: req.body.streetAndNum,
        city: req.body.city,
        country: req.body.country,
        imgSrc: imgPathPretty,
        scheduled: false,
        completed: false
    });

    const url = 'https://wft-geo-db.p.rapidapi.com/v1/geo/cities';

    var options = {
        method: 'GET',
        params: {limit: '1', namePrefix: req.body.city},
        headers: {
          'x-rapidapi-key': process.env.RAPID_API,
          'x-rapidapi-host': 'wft-geo-db.p.rapidapi.com'
        }
      };

    axios.get(url,options)
    .then((response) => {
        const data = response.data.data;
        

        if(data.length > 0){
            
            const x = data[0].latitude;
            const y = data[0].longitude;
            newJob.coordinates.x = x;
            newJob.coordinates.y = y;
            newJob.save();
            res.status(200).send();

        }else{
            
            res.status(400).send();
        }
        

    })
    .catch(err => console.log("ERROR",err));
    
    
})

app.get("/find/:title&:category&:distance&:username",(req,res) => {


    const jobsArray = [];

    if(req.params.title === "none"){

        if(req.params.category === "none" && req.params.distance === "none" && req.params.username === "none"){
            Job.find({}, (err, jobs) => {
                const filteredJobs = [];
                
                jobs.forEach((job) => {
                    if(job.scheduled !== true && job.completed !== true){
                        filteredJobs.push(job)
                    }
                })
                res.setHeader('Cache-Control', 'no-cache');
                res.send(filteredJobs)
            })

        }

        else if(req.params.category !== "none" && req.params.distance === "none" && req.params.username === "none"){
            Job.find({category: req.params.category}, (err, jobs) => {
                const filteredJobs = [];
                jobs.forEach((job) => {
                    if(job.scheduled !== true && job.completed !== true){
                        job.push(filteredJobs);
                    }
                })
                res.send(filteredJobs);
            })
        }

        else if(req.params.category !== "none" && req.params.distance !== "none" && req.params.username !== "none"){

            

            Job.find({category: req.params.category}, (err, jobs) => {
                
                if(jobs){
                    
                    User.findOne({userName: req.params.username}, (err, user) => {
                        if(user){

                            var filteredJobs = [];

                            if(user.userName !== req.params.username){

                                
                                jobs.forEach((job) => {
                                    if(job.scheduled !== true && job.completed !== true){

                                        if(filterOutPending(job,req.params.username) === false){
                                            if(distance.getDistance(job.coordinates.x,job.coordinates.y,user.coordinates.x,user.coordinates.y) <= req.params.distance){
                                                job.distance = distance.getDistance(job.coordinates.x,job.coordinates.y,user.coordinates.x,user.coordinates.y)
                                                filteredJobs.push(job);
                                            }
                                        }
                                        

                                    }
                                    
                                })
                                 res.send(filteredJobs);


                            }

                            
                        
                        }else{
                            
                        }
                        
                    })
                }

            })

        }

        else if(req.params.category === "none" && req.params.distance !== "none" && req.params.username !== "none"){

            Job.find({}, (err, jobs) => {
                if(err){
                    console.log(err);
                }

                else{
                    
                    if(jobs){
                    
                        User.findOne({userName: req.params.username}, (err, user) => {
                            if(user){
    
                                var filteredJobs = [];
    
                                if(user.userName === req.params.username){
                                    const dist = parseInt(req.params.distance);
                                    
                                    jobs.forEach((job) => {
                                        if(job.username !== req.params.username && job.scheduled !== true && job.completed !== true){

                                            if(filterOutPending(job, req.params.username) === false){
                                                if(distance.getDistance(job.coordinates.x,job.coordinates.y,user.coordinates.x,user.coordinates.y) <= dist){
                                                    job.distance = distance.getDistance(job.coordinates.x,job.coordinates.y,user.coordinates.x,user.coordinates.y);
                                                    filteredJobs.push(job);
                                                }

                                            }
                                            

                                        }
                                        
                                    })
    
    
                                }
                                
                                
                                //TU JE BUG //////////////////////////////////////////
                                
                                res.send(filteredJobs);
                                
    
    
                            }else{
                                
                            }
                            
                        })
                    }
                
                }
                
                
            })

        }

        else if(req.params.category === "none" && req.params.distance === "none" && req.params.username !== "none"){
            Job.find({}, (err,jobs) => {
                if(err){
                    console.log("Err");
                }
                else{
                    
                    
                    const filteredJobs = [];
                    jobs.forEach((job) => {
                        
                        if (job.username != req.params.username && job.scheduled !== true){
                            if(filterOutPending(job, req.params.username) === false){
                                filteredJobs.push(job);
                            }
                            
                        }
                    })
                    if(filteredJobs.length>0){
                        res.send(filteredJobs);
                    }
                    else{
                        res.status(404).send();
                    }
                }
            })
        }

        else if(req.params.category !== "none" && req.params.distance === "none" && req.params.username !== "none"){
            Job.find({category: req.params.category}, (err, jobs) => {
                if(err){
                    console.log(err);
                }
                else{
                    if(jobs){
                        User.findOne({userName: req.params.username}, (err, user) => {
                            if(err){
                                console.log(err)
                            }
                            else{
                                if(user){

                                    const filteredJobs = [];
                                    jobs.forEach((job) => {
                                        
                                        if (job.username !== req.params.username && job.scheduled !== true && job.completed !== true){
                                            if(filterOutPending(job, req.params.username) === false){
                                                filteredJobs.push(job);
                                            }
                                        
                                        }
                                    })
                
                                    res.send(filteredJobs);

                                }
                                else{
                                    res.status(404).send();
                                }
                            }
                        })
                    }
                    else{
                        res.status(404).send();
                    }
                }
            })
        }



    }
    else if(req.params.title !== "none"){
        if(req.params.category === "none" && req.params.distance === "none" && req.params.username === "none"){

            Job.find({}, (err, jobs) => {
                filterJobsByTitle(jobs, req.params.title).then((response) => {
                    res.send(response);
                });
                
            })
        }

        else if (req.params.category !== "none" && req.params.distance ==="none" && req.params.username === "none"){

            Job.find({category: req.params.category}, (err, jobs) => {
                filterJobsByTitle(jobs, req.params.title).then((response) => {
                    res.send(response);
                })
            })

        }
        else if (req.params.category !== "none" && req.params.distance !== "none" && req.params.username !== "none"){
            Job.find({category: req.params.category}, (err,jobs) => {
                if(jobs){
                    User.findOne({userName: req.params.username}, (err, user) => {

                        if(user){


                            if(user.username !== req.params.username){
                                let filteredJobs = [];
                                jobs.forEach((job) => {
                                
                                if(job.scheduled !== true && job.completed !== true){
                                    if(filterOutPending(job, req.params.username) === false){
                                        if(distance.getDistance(job.coordinates.x,job.coordinates.y,user.coordinates.x,user.coordinates.y) <= req.params.distance)
                                            {
                                            job.distance = distance.getDistance(job.coordinates.x,job.coordinates.y,user.coordinates.x,user.coordinates.y)
                                            filteredJobs.push(job);
                                            }

                                    }
                                    
                                
                                }
                                })
                                filterJobsByTitle(filteredJobs, req.params.title).then((response) => {
                                res.send(response);
                                })


                            }
                            else{
                                res.send("No data");
                            }
                            
                        }
                    })
                }
            })

        }
        else if (req.params.category === "none" && req.params.distance !== "none" && req.params.username !== "none"){

            //TU RADIM///////////////////////////////////////

            

            Job.find({}, (err,jobs) => {
                if(jobs){
                    User.findOne({userName: req.params.username}, (err, user) => {
                   
                        if(user){

                            

                                let filteredJobs = [];
                                jobs.forEach((job) => {
                                
                                if(job.scheduled !== true && job.completed !== true){
                                    if(filterOutPending(job, req.params.username) === false){

                                        if(distance.getDistance(job.coordinates.x,job.coordinates.y,user.coordinates.x,user.coordinates.y) <= req.params.distance){
                                            job.distance = distance.getDistance(job.coordinates.x,job.coordinates.y,user.coordinates.x,user.coordinates.y)
                                            filteredJobs.push(job);
                                        }

                                    }
                                    
                                }
                                
                                })
                                filterJobsByTitle(filteredJobs, req.params.title).then((response) => {
                                    
                                    res.send(response);
                                    
                                })


                            
                            
                            
                        }
                        else{
                            res.status(404).send();
                        }
                    })
                }
            })

        }

        else if(req.params.category === "none" && req.params.distance === "none" && req.params.username !== "none"){

            
            Job.find({}, (err,jobs) => {
                if(err){
                    console.log(err);
                }
                else{
                    const filteredJobs = [];
                    jobs.forEach((job) => {
                        if(job.username !== req.params.username && job.scheduled !== true && job.completed !== true){

                            if(filterOutPending(job, req.params.username) === false){
                                filteredJobs.push(job);
                            }
                            
                        }
                    });
                    if(filteredJobs.length > 0){
                        filterJobsByTitle(filteredJobs, req.params.title)
                        .then((response) => {
                            res.send(response);
                            
                        });
                        
                    }
                    else{
                        res.status(404).send();
                    }
                }

            })
        }

        else if(req.params.category !== "none" && req.params.distance === "none" && req.params.username !== "none"){
            Job.find({category: req.params.category}, (err, jobs) => {
                if(err){
                    console.log(err);
                }
                else{
                    if(jobs){
                        const filteredJobs = [];
                        jobs.forEach((job) => {
                            if(job.username !== req.params.username && job.scheduled !== true && job.completed !== true){
                                if(filterOutPending(job, req.params.username) === false){
                                    filteredJobs.push(job);
                                }
                                
                            }
                        
                        })

                        if(filteredJobs.length > 0){
                            filterJobsByTitle(filteredJobs, req.params.title)
                            .then((response) => {
                                res.send(response);
                            });
                        }
                    }
                    else{
                        res.status(404).send();
                    }
                }
            })
        }

    }

    
})
    


app.get("/job/:id", (req,res) => {

    const id = req.params.id;

    Job.findOne({_id: id}, (err, job) => {
        if(err){
            console.log(err);
        }
        else{
            User.findOne({userName: job.username}, (err, user) => {
                
                if(user){
                    const data = {
                        jobData: job,
                        userData: {
                            name: user.firstAndLastName,
                            username: user.userName,
                            reviews: user.reviews,
                            avatarSrc: user.avatar    
                        }
                    }
                    res.send(data);

                }

                else{
                    
                }
                
            })
        }
    })

})

app.post("/message", [auth.isAuth] , (req,res) => {
    const username = req.jwt.userName;
    const message = req.body.message;
    const reciever = req.body.reciever;
    

    Message.findOne().or([{user1: username, user2: reciever},{user2: username, user1: reciever}])
    .then((mess) => {
        if(!mess){

            User.findOne({userName: username}, (err, user1) => {
                if(err){
                    console.log(err);
                }
                else{
                    if(user1){
                        User.findOne({userName: reciever}, (err, user2) => {
                            if(err){
                                console.log(err);
                            }
                            else{
                                if(user2){
                                    const newMessage = new Message;
                                    newMessage.user1 = username;
                                    newMessage.user2 = reciever;
                                    newMessage.messCount = 1;
                                    newMessage.user1fullName = user1.firstAndLastName;
                                    newMessage.user2fullName = user2.firstAndLastName;
                                    newMessage.messages.push(
                                        {
                                            sender: username,
                                            message: message
                                        }
                                    );
                                    newMessage.save();
                                    res.status(200).send();
                                }
                            }
                        })
                    }
                }
            })

            
            
        }
        else if(mess){
            mess.messCount += 1;
            mess.messages.push(
                {
                    sender: username,
                    message: message
                }
            );
            mess.save();
            res.status(200).send();
        }
    })
    .catch((err) => {
        console.log(err);
    })

    
})

app.get("/inbox", [auth.isAuth], (req,res) => {
    const username = req.jwt.userName;
    Message.find().or([{user1: username}, {user2: username}])
    .then((messages) => {
        if(messages){
            res.send(messages);
        }
    })
    .catch((err) => {
        console.log(err);
    })
})

app.get("/conversation/:id", [auth.isAuth], (req,res) => {
    const username = req.jwt.username;
    Message.findOne({_id: req.params.id}, (err, conversation) => {
        if(err){
            console.log(err);
        }
        else if(conversation){
            res.send(conversation.messages)
        }
        else{
            res.status(404).send();
        }
    })
})

app.post("/conversation/message", [auth.isAuth], (req,res) => {
    const username = req.jwt.userName;
    const id = req.body.id;
    const sentMessage = req.body.message;


    Message.findOne({_id: id}, (err, conversation) => {
        if(err){
            console.log(err);
        }
        else if(conversation){
            conversation.messages.push({sender: username, message: sentMessage, date: Date.now()});
            conversation.save();
            res.status(200).send();
        }
        else{
            res.status(404).send();
        }

    })
})

app.post("/profileChange", [auth.isAuth], upload.single("image"), (req,res) => {
    const username = req.jwt.userName;
    User.findOne({userName: username}, (err, user) => {
        if(err){
            res.status(404).send()
        }
        else{
            if(user){
                if(req.body.name !== ""){
                    user.name = req.body.name;
                }
                if(req.body.streetAndNum !== ""){
                    user.streetAndNum = req.body.streetAndNum;
                }
                if(req.body.city !== ""){
                    user.city = req.body.city;
                }
                if(req.body.country !== ""){
                    user.country = req.body.country;
                }
                if(req.body.facebook !== user.facebook){
                    user.facebook = req.body.facebook;
                }
                if(req.body.whatsapp !== user.whatsapp){
                    user.whatsapp = req.body.whatsapp;
                }
                if(req.body.viber !== user.viber){
                    user.viber = req.body.viber;
                }
                if(req.body.facebookURL !== ""){
                    user.facebookURL = req.body.facebookURL;
                }
                if(req.body.phonePref !== ""){
                    user.phonePref = req.body.phonePref;
                }
                if(req.body.phonePost !== ""){
                    user.phonePost = req.body.phonePost;
                }
                if(req.file !== undefined){
                    const imgPathPretty = req.file.path.replace("\\", "/");
                    user.avatar = imgPathPretty;
                }
                
                user.save();
                res.status(200).send();
            }
            else{
                res.status(404).send();
            }
        }
    })
})

app.get("/user", [auth.isAuth], (req,res) => {
    const username = req.jwt.userName;
    User.findOne({userName: username}, (err, user) => {
        if(err){
            res.status(404).send()
        }
        else{
            if(user){
                const responseData = user;
                responseData.password = "";
                res.send(JSON.stringify(responseData));
            }
        }
    })
})

app.get("/userData/:username", [auth.isAuth], (req,res) => {
    const username = req.params.username;
    User.findOne({userName: username}, (err, user) => {
        if(err){
            console.log(err)
        }
        else{
            if(user){
                const responseData = user;
                responseData.password = "";
                res.send(JSON.stringify(responseData));
            }
            else{
                res.status(404).send();
            }
        }
        
    })
})


app.get("/avatar/:username", (req,res) => {
    const username = req.params.username;
    User.findOne({userName: username}, (err, user) => {
        if(err){
            res.status(404).send();
        }
        else{
            if(user){
                if(user.avatar !== ""){
                    res.send("http://localhost:3001/"+user.avatar)
                }
                else{
                    res.status(404).send();
                }
            }
            else{
                res.status(404).send();
            }
        }
    })
})

app.post("/job/apply", [auth.isAuth], (req,res) => {
    const username = req.jwt.userName;
    const jobId = req.body.id;
    const message = req.body.message;
    const dates = req.body.dates;

    Job.findOne({_id: jobId}, (err, job) => {
        if(err){
            console.log(err);
        }
        else{
            if(job){
                let flag = false;
                job.applications.forEach((application) => {
                    if(application.username === username){
                        flag = true;
                    }
                })

                if(flag){
                    res.status(402).send();
                }
                else{

                    const newApplication = {
                        username: username,
                        dates: dates,
                        applicationDate: new Date(),
                        message: message
                    };
                    job.applications.push(newApplication);
                    job.save();
                    res.status(200).send();

                }

               
            }
            else{
                res.status(404).send()
            }
        }
    })

    

})

app.get("/myjobs", [auth.isAuth], (req,res) => {
    const username = req.jwt.userName;
    Job.find({username: username}, (err, jobs) => {
        if(err){
            console.log(err);
        }
        else{
            if(jobs){
                const filteredJobs = [];
                jobs.forEach((job) => {
                    if(job.scheduled !== true){
                        filteredJobs.push(job);
                    }
                })
                res.send(filteredJobs);
            }
            else{
                res.status(404).send();
            }
        }
    })
})

app.get("/myScheduledJobs", [auth.isAuth], (req,res) => {
    const username = req.jwt.userName;
    Job.find({username: username}, (err, jobs) => {
        if(err){
            console.log(err);
        }
        else{
            if(jobs){
                const filteredJobs = [];
                jobs.forEach((job) => {
                    if(job.scheduled === true && (job.completed === false || job.completed === undefined)){
                        filteredJobs.push(job);
                    }
                })
                res.send(filteredJobs);
            }
            else{
                res.status(404).send();
            }
        }
    })
})

app.post("/jobs/accepted", [auth.isAuth], (req,res) => {
    const worker = req.body.user;
    const jobId = req.body.jobId;

    Job.findOne({_id: jobId}, (err, job) => {
        if(err){
            console.log(err);
        }
        else {
            if(job){
                job.scheduled = true;
                job.worker = worker;
                job.save();
                res.status(200).send();
            }
            else{
                res.status(404).send();
            }
        }
    })
})

app.post("/jobfinished", [auth.isAuth], (req,res) => {
    const reviewAbout = req.body.worker;

    const reviewData = {
        reviewer: req.jwt.userName,
        note: req.body.reviewMessage,
        rating: req.body.rating
    }


    User.findOne({userName: reviewAbout}, (err, user) => {
        if(err){
            console.log(err);
        }
        else{
            if(user){

                User.findOne({userName: reviewData.reviewer}, (err, reviewer) => {

                    if(err){
                        console.log(err);
                    }
                    else{
                        if(reviewer){
                            reviewData.reviewer = reviewer.firstAndLastName;
                            user.reviews.push(reviewData);
                            user.save();
                
                            Job.findById(req.body.jobId, (err, job) => {
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    if(job){
                                        job.completed = true;
                                        job.save();
                                        res.status(200).send();
                                    }
                                    else{
                                        res.status(404).send();
                                    }
                                }
                            })

                            res.status(200).send();
                        }
                    }



                })

                
            }
            else{
                res.status(404).send();
            }
        }
    })
})


app.get("/profileInfo/:id", [auth.isAuth], (req,res) => {

    const id = req.params.id;
    

    User.findOne({userName: id}).then((user) => {
        
        if(user){

            Job.find({username: id}, (err, jobs) => {
                if(err){
                    console.log(err);
                }
                else{

                    returnObject = {
                        name: user.firstAndLastName,
                        city: user.city,
                        country: user.country,
                        reviews: user.reviews,
                        jobsCompleted: user.reviews.length,
                        avatarSrc: user.avatar,
                        jobs: jobs
                    }
            
                    res.send(returnObject); 


                }
                    
                
            })

            

        }
        else{
            res.status(404).send();
        }
        

    }).catch(err => console.log(err))

    
})



app.get("/appliedScheduled", [auth.isAuth], (req,res) => {
    
    const worker = req.jwt.userName;
    Job.find({worker: worker}, (err, jobs) => {
        if(err){
            console.log(err)
        }
        else{
            if(jobs){
                const filteredJobs = [];
                jobs.forEach((job) => {
                    if(job.worker === worker && job.completed !== true){
                        filteredJobs.push(job);
                    }
                })
                /* console.log(filteredJobs); */
                res.send(filteredJobs)
            }
        }
    })
    
})

app.get("/myapplied", [auth.isAuth], (req,res) => {


    const username = req.jwt.userName;

    Job.find({}, (err, jobs) => {
        if(err){
            console.log(err);
        }
        else{
            if(jobs){
                const filteredJobs = [];
                jobs.forEach((job) => {
                    job.applications.forEach((applicant) => {
                        if(applicant.username === username && job.completed !== true && job.scheduled !== true){
                            filteredJobs.push(job);
                        }
                    })
                })
                res.send(filteredJobs);
            }
            else{
                res.status(404).send();
            }
        }
    })


})









app.listen(port, () => {
    console.log("Server running on port 3001");
    
})