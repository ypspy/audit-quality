const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const PolicySchema = new Schema({
    policy: {
        type: Number,
        required: true
    },
    division: {
        type: Number,
        required: true
    },
    chapter: {
        type: Number,
        required: true
    },
    level1: {
        type: String,
        required: true
    },
    level2: {
        type: Number,
        required: true
    },
    level3: {
        type: Number,
        required: true
    },
    level4: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    history: {
        type: Number,
        required: true
    },
    object: {
        type: Number,
        required: true
    },
    content: {
        type: String,
        required: true
    },
})

module.exports = model("clients", ClientSchema)
