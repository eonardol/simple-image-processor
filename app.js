var Promise = require('promise');
var url = require("url");
var express = require('express');
var path = require('path');
var fs = require('fs');
var request = require('request');
var mkdirp = require('mkdirp');
var sharp = require('sharp');



var app = express();

app.use(express.static('cache'));

app.get('/resize', function(req, res) {
  var srcUrl = req.query.srcUrl;
  var width = req.query.width;
  var height = req.query.height;
  if (!srcUrl || (!width && !height)) {
    res.sendStatus(400);
    return;
  }
  if (!width) width=null;
  if (!height) height=null;

  console.log("resize con width='"+width+"', height='"+height+"' per srcUrl=" + srcUrl);

  var cacheDst = getCacheDestination(srcUrl, width, height);


  path.exists(cacheDst.getOriginalFullPath(), function(exists) {
    if (exists) {
      // file già presente in cache, verifico se è presente anche quello elaborato
      console.log("file originale già presente");
      path.exists(cacheDst.getResizedFullPath(), function(resizedExists) {
        if (resizedExists) {
          console.log("file elaborato già presente");
          serveFile(res, cacheDst);
        }
        else {
          // calcolare e servire l'elaborato
          console.log("file elaborato NON presente");
          calculateAndServeFile(res, cacheDst, width, height);
        }
      });

    }
    else {
      // procedo con il download
      console.log("file originale NON presente");
      download(srcUrl, cacheDst, function() {
         // calcolare e servire l'elaborato
         calculateAndServeFile(res, cacheDst, width, height);
      }, function () {
        console.log("download file originale fallito");
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


var getCacheDestination = function(srcUrl, width, height) {
  var urlParsed = url.parse(srcUrl);
  var hostArr = urlParsed.hostname.split(".");
  if (urlParsed.port)
    hostArr.push(urlParsed.port);

  var pathnameArr = urlParsed.pathname.substr(1).split("/");
  var originalFilename = pathnameArr.pop();
  var resizedFilename = originalFilename + "_" + width + "x" + height;
  if (originalFilename.lastIndexOf(".")!=-1){
    resizedFilename = originalFilename.substr(0, originalFilename.lastIndexOf(".")) + "_" + width + "x" + height + originalFilename.substr(originalFilename.lastIndexOf("."));
  }

  var queryArr = new Array();
  if (urlParsed.query) {
    var tempQueryArr = urlParsed.query.split("&");
    for (var i = 0 in tempQueryArr) {
      queryArr = queryArr.concat(tempQueryArr[i].split("="));
    }
  }

  return {
    "directory": __dirname + "/cache/" + hostArr.concat(pathnameArr).concat(queryArr).join("/"),
    "originalFilename": originalFilename,
    "resizedFilename": resizedFilename,
    "getOriginalFullPath": function(){return this.directory + "/" + this.originalFilename},
    "getResizedFullPath": function(){return this.directory + "/" + this.resizedFilename}
  }
}

var download = function(uri, cacheDst, callbackSuccess, callbackError) {
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
        request(uri).pipe(fs.createWriteStream(cacheDst.getOriginalFullPath())).on('close', callbackSuccess);
      }
    });
  });
};

var serveFile = function(res, cacheDst){
  console.log("resituisco file elaborato a client");
  res.sendFile(cacheDst.getResizedFullPath(), function(err) {
    if (err) {
      console.log(err);
      res.status(err.status).end();
    } else {
      console.log('File restituito con successo');
    }
  });
}

var calculateAndServeFile = function(res, cacheDst, width, height){
  console.log("ridimensiono immagine a " + width + "x" + height);
  sharp(cacheDst.getOriginalFullPath())
  .resize(width*1, height*1)
  .toFile(cacheDst.getResizedFullPath(), function(err) {
    console.log("ridimensionamento avvenuto")
    if (!err) serveFile(res, cacheDst);
    else res.sendStatus(505);
  });
}