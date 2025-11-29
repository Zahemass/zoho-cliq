// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");

const uploadLinkRouter = require("./api/uploadLink");
const uploadFileRouter = require("./api/uploadFile");
const casesRouter = require("./api/cases");
const documentsRouter = require("./api/documents");
const chatRouter = require("./api/chat");
const sessionsRouter = require("./api/sessions");
const notifyCliqRouter = require("./api/notifyCliq");
const briefapi = require("./api/brief");
const authapi = require("./api/auth");  // 🔥 NEW

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());  // 🔥 NEW

app.use(cors({
  origin: true,
  credentials: true
}));

// 🔥 AUTH api (PUBLIC)
app.use("/api/auth", authapi);

// OTHER api
app.use("/api/cases", casesRouter);
app. use("/api", uploadLinkRouter);
app.use("/", uploadFileRouter);
app.use("/api/chat", chatRouter);
app.use("/api/sessions", sessionsRouter);
app. use("/api", notifyCliqRouter);
app. use("/api/brief", briefapi);
app.use("/brief", briefapi);

app.use(express.static(path.join(__dirname, "public")));

app.listen(process.env.PORT, () =>
  console.log("🚀 Server running on port " + process.env.PORT)
);