var express = require('express');
var request = require('request');
var http = require('http');
var path = require('path');
var fs = require('fs-extra');

const PORT = 7781;

var app = express();
app.set('port', PORT);
//app.use(bodyParser.json({limit: '50mb', extended: true}))

app.get('/', (req, res) => {
    res.send('Hello World!')
})

var server = http.Server(app);
server.listen(PORT, function() {
    console.log('Starting server on port ' + PORT);
});