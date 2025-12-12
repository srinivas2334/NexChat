const express = require('express');
const cookieparser = require('cookie-parser');
const cors = require('cors');
const dotevn = require('dotenv');
const connectDB = require('./config/dbconnect');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoute');
const chatRoutes = require('./routes/chatRoute');
const statusRoutes = require('./routes/statusRoute.js');
const http = require('http');
const initializeSocket = require('./services/socketService');
const { stat } = require('fs');

dotevn.config();


const PORT = process.env.PORT;
const app = express();



//Enable CORS
const corsOptions = {
    origin:process.env.FRONTEND_URL,
    credentials:true,
    // optionSuccessStatus:200,
};

app.use(cors(corsOptions));
 



//Middlewares
app.use(express.json()); // parse body data
app.use(cookieparser()); // parse token on every request
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));

//Database connection
connectDB();


//create server
const server = http.createServer(app);

//initialize socket
const io = initializeSocket(server);

//apply socket middleware before routes
app.use((req,res,next) =>{
    req.io = io;
    req.socketUserMap = io.socketUserMap;
    next();
});


 

//Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/status', statusRoutes);

server.listen(PORT,() =>{
    console.log(`Server running on this port ${PORT}`)
})