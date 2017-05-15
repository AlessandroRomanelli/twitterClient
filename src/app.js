'use strict'
const fs = require('fs');
const express = require('express');
const router = express.Router();
const Twit = require('twit');
const ms = require('ms');
const bodyParser = require('body-parser');
const favicon = require('serve-favicon');
if (!fs.existsSync(__dirname + '/config.js')) {
  fs.writeFileSync(__dirname + '/config.js',
    `module.exports = {
      consumer_key:          "-",
      consumer_secret:       "-",
      access_token:          "-",
      access_token_secret:   "-"
    }`
  );
}
const config = require('./config.js');

var T = new Twit(config);
var app = express();

//Function that assign to each item of an array a .sinceCreation property
function getTimeDiff(array, isLong) {
  if (array.errors == undefined) {
    const res = array.concat([])
    //Get current time in MS
    let curTime = new Date();
    curTime = curTime.getTime();
    //For each item of the passed array
    res.forEach((elem, i) => {
      //Get the creation time in MS
      let postTime = new Date(res[i].created_at);
      postTime = postTime.getTime();
      //Get the span of time in between the two moments in MS
      let diffTime = curTime - postTime;
      diffTime = ms(diffTime, { long: isLong});
      res[i].sinceCreation = diffTime;
    })

    return res
  } else {
    return array
  }
}

app.set('view engine', 'pug');
app.set('views', __dirname + '/views');

app.use(express.static(__dirname + '/public'));

app.use(favicon(__dirname + '/public/images/favicon.ico'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/', (req, res) => {
  T.get('account/verify_credentials', {skip_status: true})
  .then(({ data }) => {
    if (data.errors != undefined) {
      data.errors[0].code = 401;
      res.render('error', {error: data.errors});
    } else if (data === "") {
      res.render('error', {error: [{code: 503, message: "Can't connect to the Twitter API."}]})
    } else {
      return Promise.all([
        data,
        T.get('statuses/user_timeline', {user_id: data.id, count: 5}),
        T.get('friends/list', {user_id: data.id, count: 5}),
        T.get('direct_messages', {count: 5})
      ])
    }
  })
  .then(([ profile, tweets, friends, messages ]) => {
    res.render('body', {
      profileData: profile,
      tweetsData: getTimeDiff(tweets.data, false),
      friendsData: friends.data.users,
      messagesData: getTimeDiff(messages.data, true)
    })
  })
  .catch(err => console.log('\n\nOoops, something went wrong!\n', err.message))
});

app.post('/', (req,res) => {
  T.post('statuses/update', { status: req.body.text_tweet }, (err, data, response) => {
    if (err != undefined) {
      if (err.statusCode == 401) {
        err.allErrors[0].code = 401;
        err.allErrors[0].message = err.allErrors[0].error;
      } else {
        err.allErrors[0].code = 403;
      }
      return res.render('error', {error: err.allErrors});
    } else {
      res.redirect('back');
    }
  });
})

app.use(function(req, res, next){
  res.status(404);
  res.render('error', {error: [{code: 404, message: "Page not found: invalid URL."}]})
});

app.listen(process.env.PORT || 3000);
