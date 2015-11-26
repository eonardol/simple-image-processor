var url = require("url");
var express = require('express');
var path = require('path');
var fs = require('fs');
var request = require('request');
var mkdirp = require('mkdirp');



var app = express();

app.use(express.static('cache'));

app.get('/resize', function(req, res) {
  var srcUrl = req.query.srcUrl;
  var width = req.query.width;
  if (!srcUrl || !width || isNaN(width)) {
    res.sendStatus(400);
    return;
  }
  console.log("resize con width='"+width+"' per srcUrl=" + srcUrl);

  var cacheDst = getCacheDestination(srcUrl);
  var fullPath = cacheDst.directory + "/" + cacheDst.filename;


  path.exists(fullPath, function(exists) {
    if (exists) {
      res.sendFile(fullPath, function(err) {
        if (err) {
          console.log(err);
          res.status(err.status).end();
        } else {
          console.log('File restituito con successo');
        }
      });

    }
    else {
      download(srcUrl, fullPath, function() {
        res.sendFile(fullPath, function(err) {
          if (err) {
            console.log(err);
            res.status(err.status).end();
          } else {
            console.log('File restituito con successo');
          }
        });
      }, function () {
        console.log("Download fallito");
        res.sendStatus(404);
      });
    }
  });
});

var server = app.listen(3000, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});


var getCacheDestination = function(srcUrl) {
  var urlParsed = url.parse(srcUrl);
  var hostArr = urlParsed.hostname.split(".");
  if (urlParsed.port)
    hostArr.push(urlParsed.port);

  var pathnameArr = urlParsed.pathname.substr(1).split("/");
  var filename = pathnameArr.pop();

  var queryArr = new Array();
  if (urlParsed.query) {
    var tempQueryArr = urlParsed.query.split("&");
    for (var i = 0 in tempQueryArr) {
      queryArr = queryArr.concat(tempQueryArr[i].split("="));
    }
  }

  return {
    "directory": __dirname + "/cache/" + hostArr.concat(pathnameArr).concat(queryArr).join("/"),
    "filename": filename,
  }
}

var download = function(uri, filename, callbackSuccess, callbackError) {
  request.head(uri, function(err, res, body) {
    if (!res) {
      callbackError();
      return;
    }
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);
    if (!res.headers['content-length']) callbackError();

    mkdirp(cacheDst.directory, function(err) {
      if (err) {
        // KO
        callbackError();
      } else {
        // OK
        request(uri).pipe(fs.createWriteStream(filename)).on('close', callbackSuccess);
      }
    });
  });
};
