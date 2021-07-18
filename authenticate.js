
const jwt = require("jsonwebtoken");
const dotenv = require('dotenv').config();

exports.isAuth = (req,res,next) => {
    try{
    
    let authorization = req.headers.authorization.split(" ");
    const [type, token] = authorization;

    if(type !== "Bearer"){
        res.status(401).send();
        return false;
    } else{
        req.jwt = jwt.verify(token, process.env.JWT_SECRET);
        next();
    }
    } catch(error){
        res.status(401).send();
    } 
}

