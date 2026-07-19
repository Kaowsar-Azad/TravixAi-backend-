require("dotenv").config();
const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_URI;

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("travix-ai");
    
    // Update all existing users to be admins for testing purposes
    // Or you can specify an email: { email: "your@email.com" }
    const result = await db.collection("user").updateMany(
      {}, 
      { $set: { role: "admin" } }
    );
    
    console.log(`Updated ${result.modifiedCount} users to admin role.`);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
