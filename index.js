const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

// index.js
const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64",
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.token_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clusterpro.d9ffs3x.mongodb.net/?appName=ClusterPro`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("server is running");
});

async function run() {
  try {
    // await client.connect();

    const db = client.db("freelancy_db");
    const jobsCollection = db.collection("jobs");
    const acceptedTasksCollection = db.collection("accepted_tasks");

    app.get("/Jobs", async (req, res) => {
      // console.log(req.query);
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }

      const cursor = jobsCollection.find(query).sort({ _id: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/Jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    app.post("/Jobs", verifyFirebaseToken, async (req, res) => {
      // console.log('headers in the post', req.headers)
      const newJobs = { ...req.body, postedAt: new Date() };
      const result = await jobsCollection.insertOne(newJobs);
      res.send(result);
    });

    app.patch("/Jobs/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
      if (!job || job.email !== req.token_email) {
        return res.status(403).send({ message: "forbidden" });
      }
      const updatedJobs = req.body;
      const query = { _id: new ObjectId(id) };
      const update = { $set: updatedJobs };
      const result = await jobsCollection.updateOne(query, update);
      res.send(result);
    });

    app.delete("/Jobs/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;

      const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
      if (!job) {
        return res.status(404).send({ message: "Job not found" });
      }

      const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get("/accepted-tasks", verifyFirebaseToken, async (req, res) => {
      const { email, jobId } = req.query;
      if (email && email !== req.token_email) {
        return res.status(403).send({ message: "forbidden Access" });
      }
      const query = {};
      if (email) query.acceptedByEmail = email;
      if (jobId) query.jobId = jobId;
      const result = await acceptedTasksCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/accepted-tasks", verifyFirebaseToken, async (req, res) => {
      const task = {
        ...req.body,
        acceptedByEmail: req.token_email,
        acceptedAt: new Date(),
      };
      const result = await acceptedTasksCollection.insertOne(task);
      res.send(result);
    });

    app.delete("/accepted-tasks/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const task = await acceptedTasksCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!task || task.acceptedByEmail !== req.token_email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const result = await acceptedTasksCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
