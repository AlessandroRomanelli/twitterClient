'use strict'

//Including the required modules
const fs = require('fs');
const express = require('express');
const router = express.Router();
const Twit = require('twit');
const ms = require('ms');
const bodyParser = require('body-parser');
const favicon = require('serve-favicon');
//Check if there is a config.js file in the same folder of the app.js
if (!fs.existsSync(__dirname + '/config.js')) {
  //If there isn't, create a placeholder
  fs.writeFileSync(__dirname + '/config.js',
    `module.exports = {
      consumer_key:          "-",
      consumer_secret:       "-",
      access_token:          "-",
      access_token_secret:   "-"
    }`
  );
  //Warn the user that a config.js file was not found and advise next steps
  console.log("WARNING! \n\nA config.js file could not be found: a placeholder has been created \nin the 'src' folder, please fill the fields with your authentication data! \nIf you don't have any key or token, get one here: https://apps.twitter.com/")
  //Kill the process without errors, first run
  process.exit(0);
}
const config = require('./config.js');

var T = new Twit(config);
var app = express();

//Function that assign to each item of an array a .sinceCreation property
function getTimeDiff(array, isLong) {
  //If the array passed to the function doesn't have errors in it
  if (array.errors == undefined) {
    //Create a duplicate of the passed array to work on
    const res = array.concat([])
    //Get current time in MS
    let curTime = new Date();
    curTime = curTime.getTime();
    //For each object of the passed array
    res.forEach((elem, i) => {
      //Get the creation time in MS
      let postTime = new Date(res[i].created_at);
      postTime = postTime.getTime();
      //Get the span of time in between the two moments in MS
      let diffTime = curTime - postTime;
      //Pass it to the ms module which converts to the smallest integer unit
      diffTime = ms(diffTime, { long: isLong});
      //Store the time since creation in a property of the object
      res[i].sinceCreation = diffTime;
    }) //END forEach
    //Return the new array with modified objects
    return res
  } else {
    //Return the initial array, basically skipping the function
    return array
  }
}

//Set up the module that's gonna handle the rendering of the pages
app.set('view engine', 'pug');
//Declaring the directory where the pug templates are stored
app.set('views', __dirname + '/views');

//Setting up the static files: CSS, JS, Images
app.use(express.static(__dirname + '/public'));

//Setting the favicon of the website
app.use(favicon(__dirname + '/public/images/favicon.ico'));

//Implementing the bodyParser to retrieve data from POST methods
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

//Handling GET requests on root
app.get('/', (req, res) => {
  //GET request to the Twitter API for profile data
  T.get('account/verify_credentials', {skip_status: true})
  //When data is returned
  .then(({ data }) => {
    //If there are errors ==> Connection is OK but Auth is BAD
    if (data.errors != undefined) {
      //Define it error 401, for bad authentication
      data.errors[0].code = 401;
      //Render the error page with the errors object passed to the pug template
      res.render('error', {error: data.errors});
    //If returned data is empty string ==> Connection is NOT OK
    } else if (data === "") {
      //Return 503 error for connection problems
      res.render('error', {error: [{code: 503, message: "Can't connect to the Twitter API."}]})
      //Otherwise
    } else {
      //Run asynchronously these functions and return them into an array of objects
      return Promise.all([
        //Profile data object
        data,
        //GET request for latest tweets
        T.get('statuses/user_timeline', {user_id: data.id, count: 5}),
        //GET request for latests followings
        T.get('friends/list', {user_id: data.id, count: 5}),
        //GET request for latest messages received
        T.get('direct_messages', {count: 5})
      ])
    }
  })
  //When they are all completed
  .then(([ profile, tweets, friends, messages ]) => {
    //Render the body page passing the four objects as JSON
    res.render('body', {
      profileData: profile,
      //Call the getTimeDiff function to have a property to display the sinceCreation time, shortened
      tweetsData: getTimeDiff(tweets.data, false),
      friendsData: friends.data.users,
      //Call the getTimeDiff function to have a property to display the sinceCreation time
      messagesData: getTimeDiff(messages.data, true)
    })
  })
  //If there are any errors log the error message in the console
  .catch(err => console.log('\n\nOoops, something went wrong!\n', err.message))
});

//Handles POST requests when users submits a tweet
app.post('/', (req,res) => {
  //POST request to the Twitter API, submitting the text of the tweet
  T.post('statuses/update', { status: req.body.text_tweet }, (err, data, response) => {
    //If there are errors
    if (err != undefined) {
      //If error is a 401
      if (err.statusCode == 401) {
        //Pass the statusCode to the first object of the allErrors array ==> Non authorized
        err.allErrors[0].code = 401;
        //Set a user friendly message
        err.allErrors[0].message = "Your authentication does not have write permissions.";
      } else {
        //Otherwise pass the status code 403 ==> Bad Request
        err.allErrors[0].code = 403;
      }
      //Renders the error page passing the allErrors array
      return res.render('error', {error: err.allErrors});
      //Otherwise if there are no errors
    } else {
      //Redirect to the root (refreshes homepage to display the new tweet)
      res.redirect('/');
    }
  });
})

//Handling 404 occasions
app.use(function(req, res, next){
  //Set the status to 404
  res.status(404);
  //Render the error page for the 404 error
  res.render('error', {error: [{code: 404, message: "Page not found: invalid URL."}]})
});

//Set the port onto which the server should be listening
var listener = app.listen(process.env.PORT || 3000, () => {
  console.log('The server is now locally hosted, listening on port:', listener.address().port)
});
