var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var redis = require('redis');

var port = process.env.PORT || 8080;

var client = '';
var creds = '';

app.use(express.static('public'));
app.use(bodyParser.urlencoded({
	extended: true
}));

//Start server
http.listen(port, function() {
	console.log('Server listening on port ' + port);
});

var chatters = [];

var chat_messages = [];

app.get('/', function(req, res) {
	res.sendFile('views/index.html', {
		root: __dirname
	});
});

//Read database credentials
fs.readFile('creds.json', 'utf-8', function(err, data) {
	if (err) throw err;

	creds = JSON.parse(data);
	client = redis.createClient('redis://:' + creds.password + '@' + creds.host + ':' + creds.port);

	client.once('ready', function() {

		//Flush Redis DB
		//client.flushdb();

		//Initialize the chatters
		client.get('chat_users', function(err, reply) {
			if (reply) {
				chatters = JSON.parse(reply);
			}
		});

		//Initialize Messages
		client.get('chat_app_messages', function(err, reply) {
			if (reply) {
				chat_messages = JSON.parse(reply);
			}
		});
	});

	//Join the chat
	app.post('/join', function(req, res) {
		var username = req.body.username;

		if (chatters.indexOf(username) === -1) {
			chatters.push(username);
			client.set('chat_users', JSON.stringify(chatters));
			res.send({
				'chatters': chatters,
				'status': 'OK'
			});
		} else {
			res.send({
				'status': 'FAILED'
			});
		}
	});

	//Leave the chat
	app.post('/leave', function(req, res) {
		var username = req.body.username;
		chatters.splice(chatters.indexOf(username), 1);
		client.set('chat_users', JSON.stringify(chatters));
		res.send({
			'status' : 'OK'
		});
	});

	//Send and Store message
	app.post('/send_message', function(req, res) {
		var username = req.body.username;
		var message = req.body.message;
		chat_messages.push({
			'sender': username,
			'message': message
		});
		client.set('chat_app_messages', JSON.stringify(chat_messages));
		res.send({
			'status': 'OK'
		});
	});

	//Get messages
	app.get('/get_messages', function(req, res) {
		res.send(chat_messages);
	});

	//Get chatters
	app.get('/get_chatters', function(req, res) {
		res.send(chatters);
	});

	//Setup socket connection
	io.on('connection', function(socket) {

		//Emit 'send' event to update Message list
		socket.on('message', function(data) {
			io.emit('send', data);
		});

		//Emit 'count_chatters' for updating Chatter Count
		socket.on('update_chatter_count', function(data) {
			io.emit('count_chatters', data);
		});
	});

});