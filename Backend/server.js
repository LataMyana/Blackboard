const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);

// ✅ Attach socket.io to the HTTP server running on port 4001
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  
  socket.on("draw", (data) => socket.broadcast.emit("draw", data));
  socket.on("clearArea", (data) => socket.broadcast.emit("clearArea", data));
  socket.on("undo", (dataUrl) => socket.broadcast.emit("undo", dataUrl));
  socket.on("redo", (dataUrl) => socket.broadcast.emit("redo", dataUrl));
  socket.on("clear", (dataUrl) => socket.broadcast.emit("clear", dataUrl));
   

});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
