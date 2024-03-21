const express = require("express")
const path = require("path")
const app = express()
const cors = require("cors")
const mongoose = require("mongoose")
const bodyParser = require("body-parser")
require("dotenv").config()

// configure database access
const uri = String(process.env.URI).replace("<password>", process.env.PASSWORD)
mongoose.connect(uri).then(function(_) {
  console.log("Database connected")
}).catch(function(error) {
  console.log("Error ocurred: ", error)
})

// body parsing for data handle
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
// enable requests from other domains
app.use(cors())
// serve the public folder for styles, images, etc
app.use(express.static("public"))
// staticaly serve the index page
app.get("/", (_, res) => {
  // string path
  res.sendFile(path.join(__dirname, "views", "index.html"))
})

const listener = app.listen(process.env.PORT || 3000, function() {
  console.log("The application is running under port: " + listener.address().port)
})

// the user Schema
const userSchema = new mongoose.Schema({
  username: String
})
// the exercise eschema
const exerciseSchema = new mongoose.Schema({
  description: String,
  duration: Number,
  date: Number,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
})
// the user model
const User = mongoose.model("User", userSchema, "users")
// the exercise model
const Exercise = mongoose.model("Exercise", exerciseSchema, "exercises")

// create new user with @param username
// response { username, _id }
app.post("/api/users", function(request, response, next) {
  const userData = request.body
  const doc = new User(userData)
  
  doc.save().then(function(data) {
    const { username, _id } = data
    console.log("New user added: ", data)
    response.json({ username, _id })
  
  }).catch(function(error) {
    console.log("Not saved: ", error)
  })
})

// get all users
// response { username, _id }[]
app.get("/api/users", function(request, response, next) {
  User.find({}, "-__v").then(function(data) {
    response.json(data)
  }).catch(function(error) {
    response.send({ message: "There was an error, try again later", error })
  })
})

// create new exercise
// @param body { description, duration, date }
// @param _id user id to reference exercise
// response user + exercise
app.post("/api/users/:_id/exercises", function(request, response, next) {
  const _id = request.params._id
  const { description, duration, date } = request.body
  let miliseconds = date ? new Date(date).valueOf() : new Date().valueOf()

  const doc = new Exercise({
    description,
    duration,
    date: miliseconds,
    userId: new mongoose.Types.ObjectId(_id)
  })

  doc.save().then(function(exercise) {
    console.log("New exercise added", exercise)

    User.findById(_id, "-__v").then(function(user) {
      const { username, _id } = user
      const { description, duration, date } = exercise

      response.json({
        username,
        description,
        duration,
        date: new Date(date).toDateString(),
        _id
      })
    })
  }).catch(function(error) {
    response.status(500).json({ message: "There was an error, try again later", error })
  })
})

/**
 * retrive the full list of exercises from a user
 * Query string parameters
 * @argument {string} from starting date to query
 * @argument {string} to end date to query
 * @argument {number} limit query result limit
 * 
 * response user +
 * {number} count: count of all exercises
 * {array} log: list of all exercises
 * user.log
 * {string} description
 * {number} duration
 * {date string} date
 */
app.get("/api/users/:_id/logs", function(request, response, next) {
  const _id = request.params._id
  let { from, to, limit } = request.query
  
  User.findById(_id, "-__v").then(function(user) {
    const { username, _id } = user
    const queryObject = { userId: _id }
    
    if (from !== undefined) {
      from = new Date(from)?.valueOf()
      const validDate = typeof from === "number"
      if (validDate) queryObject["date"] = { $gte: from }
    }

    if (to !== undefined) {
      to = new Date(to)?.valueOf()
      const validDate = typeof to === "number"
      if (validDate)
        queryObject["date"] = queryObject["date"] ? {
          ...queryObject["date"],
          $lte: to
        } : { $lte: to }
    }

    const exerciseQuery = Exercise.find(queryObject)

    if (limit !== undefined && Number(limit) !== NaN) {
      exerciseQuery.limit(Number(limit))
    }

    exerciseQuery.then(function(log) {

      response.json({
        username,
        _id,
        count: log.length,
        log: log.map(it => {
          const { date, description, duration, userId } = it
          return {
            description,
            duration,
            userId,
            date: date ? new Date(Number(date)).toDateString() : "Invalid Date"
          }
        })
      })

    })
  })
})