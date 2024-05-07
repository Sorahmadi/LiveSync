require("dotenv").config();
const moment = require("moment");
const express = require("express");
const app = express();
const http = require("http");
const socketIO = require("socket.io");
const port = process.env.PORT || 5000;
const clientHandler = require("./clientModule");

let server = http.createServer(app);
let io = socketIO(server);

app.use((req, res, next) => {
  req.secure
    ? 
      next()
    : 
      res.redirect("https://" + req.headers.host + req.url);
});

io.on("connection", (socket) => {
  console.log("new connection established");
  
  socket.emit("displayrooms", clientHandler.getRooms());

  // user joined
  socket.on("join", (client) => {
    if (clientHandler.userExists(client.chatName)) {
      socket.emit("nameexists", {
        text: `name already taken, try a different name.`,
      });
    } else {
      clientHandler.addUser(client.chatName, client.roomName);
      clientHandler.addRoom(client.roomName);

      socket.name = client.chatName;
      socket.room = client.roomName;

      socket.emit("displayonline", clientHandler.getOnlineList(socket.room));

      
      socket.join(client.roomName);
      
      socket.emit("welcome", {
        time: moment.utc().subtract(4, "hours").format("h:mm:ss a"),
        room: socket.room,
        from: "Admin",
        colour: "#475a9e",
        text: `Welcome ${socket.name}`,
      });
      
      socket.to(socket.room).emit("someonejoined", {
        time: moment.utc().subtract(4, "hours").format("h:mm:ss a"),
        room: socket.room,
        from: "Admin",
        colour: "#475a9e",
        text: `${socket.name} has joined this room`,
      });
    }
  }); // join
  
  socket.on("disconnect", async () => {
    if (socket.name !== undefined) {
      clientHandler.removeUser(socket.name, socket.room);
      socket
        .to(socket.room)
        .emit("displayonline", clientHandler.getOnlineList(socket.room));
        
      socket.to(socket.room).emit("someoneleft", {
        time: moment.utc().subtract(4, "hours").format("h:mm:ss a"),
        room: socket.room,
        from: "Admin",
        colour: "#475a9e",
        text: `${socket.name} has left this room`,
      });
    }
  }); // disconnect
  
  socket.on("typing", async (clientData) => {
    
    socket.to(socket.room).emit("someoneistyping", {
      text: `${clientData.from} is typing...`,
    });
  }); // typing

  socket.on("message", async (clientData) => {
    
    socket.emit("newmessage", {
      time: moment.utc().subtract(4, "hours").format("h:mm:ss a"),
      room: socket.room,
      from: socket.name,
      colour: clientHandler.getUserColour(socket.name),
      text: clientData.text,
    });
    
    socket.to(socket.room).emit("newmessage", {
      time: moment.utc().subtract(4, "hours").format("h:mm:ss a"),
      room: socket.room,
      from: socket.name,
      colour: clientHandler.getUserColour(socket.name),
      text: clientData.text,
    });
  }); // message

  socket.on("refreshuserlist", async () => {
    socket.emit("displayonline", clientHandler.getOnlineList(socket.room));
  });
}); // connection


app.use((req, res, next) => {
  const error = new Error("No such route found");
  error.status = 404;
  next(error);
});


app.use((error, req, res, next) => {
  res.status(error.status || 500).send({
    error: {
      status: error.status || 500,
      message: error.message || "Internal Server Error",
    },
  });
});
server.listen(port, () => console.log(`starting on port ${port}`));
