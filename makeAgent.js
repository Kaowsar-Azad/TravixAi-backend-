require("dotenv").config();
const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_URI;

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("travix-ai");
    
    // Update the user with email kaowsar@gmail.com to be a travel_agent
    const result = await db.collection("user").updateOne(
      { email: "kaowsar@gmail.com" }, 
      { $set: { role: "travel_agent" } }
    );
    
    console.log(`Matched ${result.matchedCount} user(s) and modified ${result.modifiedCount} user(s) to travel_agent role.`);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
