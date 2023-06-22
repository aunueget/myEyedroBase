const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
const rp = require('request-promise');

// creating a clean jar
var myJar = rp.jar();

var sessionID =0;
var timestamp = (new Date()).getTime();
var startTime = timestamp;
var getData ='Cmd=GetData&AliasRId=1&SiteId=1&DateStartMsUtc='+startTime+'&DataTypeId=7&DateStepSizeId=1&DateNumSteps=1&AggregateOnly=1&SessionId='+sessionID;
var getData = 'Cmd=GetData&AliasRId=1&SiteId=1&DataTypeId=3&DateStartMsUtc='+timestamp+'SessionId='+sessionID;

var loginLink = 'https://my.eyedro.com/';

rp.get({url: loginLink, jar: myJar}, function(err, httpResponse, html) {
  // place POST request and rest of the code here
  	rp.post({
		url: 'https://my.eyedro.com/e2',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		method: 'POST',
		jar: myJar,
		form: {
			Cmd: 'Login',
			Username: 'mcknightaa@gmail.com',
			PwdMd5: '910aaa537cbb1f7550bf0ddab5e6e5cf'
		}
		}, function(err, res, body){
			
		if(err) {
		return console.error(err);
		};
		debugger;
		console.log('body:',body);
		var objectValue = JSON.parse(body);
		startTime = objectValue['DateMsUtc'];
		sessionID = objectValue['SessionId'];
		console.log('sessionID: ',sessionID);
		console.log('DateMsUtc: ',startTime);
		console.log('statusCode:',res && res.statusCode);

		timestamp = (new Date()).getTime();

		rp.post({
			url: 'https://my.eyedro.com/e2',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			method: 'POST',
			jar: myJar,
			form: {
				Cmd: 'GetData',
				AliasRId: 1,
				SiteId: 1,
				DataTypeId: 3,
				DateStartMsUtc: startTime,
				SessionId: sessionID
			}
			}, function(err, res, body) {
			if(err) {
			  return console.error(err);
			};
			console.log('body:',body);
			console.log('statusCode:',res && res.statusCode);
		});
	});

});
