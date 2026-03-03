const mongoose = require("mongoose");
const Policy = require("../models/policySchema.js");
const policies = require("./policy-data.js");

mongoose.connect("mongodb://localhost:27017/policy");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

const DB = async () => {
  await P.deleteMany({});
  for (let i = 0; i < 50; i++) {
    const policy = new Policy({
      
      
      
      
      
      
        location: `${cities[random1000].city}, ${cities[random1000].state}`,
      title: `${sample(descriptors)} ${sample(places)}`,
      image: "https://source.unsplash.com/collection/483251",
      description:
        "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
      price: price,
    });
    await policy.save();
  }
};

DB().then(() => {
  mongoose.connection.close();
});
