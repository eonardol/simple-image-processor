var url = require("url");
var express = require('express');
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
  if (!srcUrl || (!width && !height) || (width && isNaN(width)) || (height && isNaN(height))) {
    res.status(400).send("input parameters not valid!");
    return;
  }
  // normalize undefined ==> null
  if (!width) width=null;
  if (!height) height=null;

  console.log("resize: width='"+width+"', height='"+height+"', srcUrl=" + srcUrl);

  var cacheDst = getCacheDestination(srcUrl, width, height);

  fs.stat(cacheDst.getOriginalFullPath(), function(err, stats){
    if (err || !stats.size) {
      console.log("original file not downloaded");
      download(srcUrl, cacheDst, function() {
         resizeAndServeFile(res, cacheDst, width, height);
      }, function (err) {
        console.error("original file download error " + err);
        res.status(422).send("unable to donwload file at " + srcUrl);
      });
    }
    else {
      console.log("original file already downloaded");
      fs.stat(cacheDst.getResizedFullPath(), function(errResized, statsResized){
        if (errResized || !statsResized.size) {
          console.log("original file not resized with these parameters");
          resizeAndServeFile(res, cacheDst, width, height);
        }
        else {
          console.log("original file already resized with these parameters");
          serveFile(res, cacheDst);
        }
      });
    }

  });

});

var server = app.listen(3000, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('app listening at http://%s:%s', host, port);
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
    if (!res.headers['content-length'] || res.headers['content-length']==0) {
      callbackError();
      return;
    }

    mkdirp(cacheDst.directory, function(err) {
      if (err) {
        callbackError("mkdir fails " + err);
      } else {
        request(uri).pipe(fs.createWriteStream(cacheDst.getOriginalFullPath())).on('close', callbackSuccess);
      }
    });
  });
};

var serveFile = function(res, cacheDst){
  res.sendFile(cacheDst.getResizedFullPath(), function(err) {
    if (err) {
      console.log("serveFile error: " + err);
      res.status(err.status).end();
    } else {
      console.log('serveFile successfully completed');
    }
  });
}

var resizeAndServeFile = function(res, cacheDst, width, height){
  console.log("resizing with " + width + "x" + height);
  sharp(cacheDst.getOriginalFullPath())
  .resize(width*1, height*1)
  .toFile(cacheDst.getResizedFullPath(), function(err) {
    console.log("file successfully resized!")
    if (!err) serveFile(res, cacheDst);
    else res.status(500).send("unable to resize image");
  });
}