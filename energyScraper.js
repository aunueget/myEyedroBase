const rp = require('request-promise');

const milliSecsNHour=3.6e+6;
const milliSecsNDay=8.64e+7;
let sessionID =0;
let startTime = 0;
let getData ='Cmd=GetData&AliasRId=1&SiteId=1&DateStartMsUtc='+startTime+'&DataTypeId=7&DateStepSizeId=1&DateNumSteps=1&AggregateOnly=1&SessionId='+sessionID;
let getData2 = 'Cmd=GetData&AliasRId=1&SiteId=1&DataTypeId=3&DateStartMsUtc=+timestamp+SessionId='+sessionID;
let powerValues = {};
const goBackDays = 3;
const timezoneOffset = -5;
let startOfDay = new Date();
//get timestamp for the start of day 3 days ago
let startDayTime = startOfDay.getTime() - ((24+timezoneOffset+startOfDay.getUTCHours())*milliSecsNHour)-(goBackDays*milliSecsNDay);
console.log('date back days: ', startDayTime);

function calculateValues(jsonResponse,nextDayTime,numDaysBack){
	const TIME_MS = 0;
	const POWER_W = 1;
	const milliSecsNHour=3.6e+6;
	const milliSecsNDay=8.64e+7;
	let first = true;
	let cuttOffReached = false;
	let firstRealData = false;
	let prevTimeStamp=0;
	let bestWatthourTotal = 0.001;
	let bestWattHourPartial = 0.001;
	let currentWattHour =0.001;
	const objectValues = JSON.parse(jsonResponse);
	const powerData = objectValues['Data'][0];
	const maxWatts = objectValues.DataStats[0].MaxY;
	//create a time of day to cut off data using the last time in the data ex. if last time is 3:23 pm projection will used pass days cut off at 3:23pm
	let cutOffMilli = powerData[powerData.length-1][TIME_MS];
	cutOffMilli = cutOffMilli-(milliSecsNDay*numDaysBack);
	let nextDayMilli = milliSecsNDay + nextDayTime;
	
	console.log('Max watts: ',maxWatts);
	console.log('Number of entries: ', powerData.length);
	console.log('cutOffTime: ',cutOffMilli);
	console.log('Next day: ',nextDayMilli);
	
	let currentCount = 0;
	for( var wattHourPair in powerData){
		if(first){
			console.log('Watts: ', powerData[wattHourPair][POWER_W]);
			first = false;
		}
		else if(powerData[wattHourPair][POWER_W] > 600){
			if(powerData[wattHourPair][TIME_MS]>cutOffMilli && !cuttOffReached){
				cuttOffReached = true;
				cutOffMilli += milliSecsNDay;
				console.log('cutOffTime: '+cutOffMilli+' data time: '+powerData[wattHourPair][TIME_MS]);
				if(currentWattHour>bestWattHourPartial){
					bestWattHourPartial = currentWattHour;
				}
				console.log('bestPartial: '+bestWattHourPartial+' currentCount: ' + currentCount);
			}
			else if(powerData[wattHourPair][TIME_MS]>nextDayMilli){
				nextDayMilli+=milliSecsNDay;
				cuttOffReached=false;
				console.log('nextDay: '+nextDayMilli+' data time: '+powerData[wattHourPair][TIME_MS]);
				if(currentWattHour>bestWatthourTotal){
					bestWatthourTotal=currentWattHour;
					console.log('best: '+bestWatthourTotal+' currentCount: ' + currentCount);
				}
				currentCount=0;
				currentWattHour=0.001;
				firstRealData = false;
			}
			//calculate watthours from last pair to this pair
			if (firstRealData){
				currentWattHour += ((powerData[wattHourPair][TIME_MS]-prevTimeStamp)*powerData[wattHourPair][POWER_W])/milliSecsNHour;	
			}
			currentCount++;
			firstRealData=true;
		}
		else{
			firstRealData = false;
		}
		prevTimeStamp=powerData[wattHourPair][TIME_MS];
	}
	console.log('current: '+currentWattHour+' currentCount: ' + currentCount);
	let kWHProjection = ((bestWatthourTotal/bestWattHourPartial)*currentWattHour)/1000;
	let kiloWattHours = currentWattHour/1000;
	kiloWattHours = Math.round(kiloWattHours*100)/100;
	kWHProjection = Math.round(kWHProjection*100)/100;
	if(kiloWattHours < .01){
		kiloWattHours = 0;
	}
	if(kWHProjection < .01){
		kWHProjection = 0;
	}
	console.log('Todays Kilo Watt hours: ',kiloWattHours);
	console.log('Todays projection in KWh: ',kWHProjection);
	return {todaysKWh: kiloWattHours, todaysKWhProjection:kWHProjection};
}				

async function getItDone(){
	const getLogin = await rp.post({
		url: 'https://my.eyedro.com/e2',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		method: 'POST',
		form: {
			Cmd: 'Login',
			Username: 'mcknightaa@gmail.com',
			PwdMd5: '910aaa537cbb1f7550bf0ddab5e6e5cf'
		}
		}, function(err, res, body){
			
		if(err) {
		return console.error(err);
		};
		let objectValues = JSON.parse(body);
		startTime = objectValues['DateMsUtc'];
		sessionID = objectValues['SessionId'];
		console.log('sessionID: ',sessionID);
		console.log('DateMsUtc: ',startTime);
		console.log('statusCode:',res && res.statusCode);

	});

	const getDataStuff = await rp.post({
		url: 'https://my.eyedro.com/e2',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		method: 'POST',
		form: {
			Cmd: 'GetData',
			AliasRId: 1,
			SiteId: 1,
			DataTypeId: 3,
			DateStartMsUtc: startTime,
			SessionId: sessionID
		}
		}, function(err2, res2, body2) {
		if(err2) {
		  return console.error(err2);
		};
		let currentWatts =0;
		let objectValues = JSON.parse(body2);
		currentWatts = (objectValues['Data'])[2][0][1];
		console.log('statusCode:',res2 && res2.statusCode);
		console.log('currentWatts: ',currentWatts);
	});

	const getTodaysTotals = await rp.post({
		url: 'https://my.eyedro.com/e2',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		method: 'POST',
		form: {
			Cmd: 'GetData',
			AliasRId: 1,
			SiteId: 1,
			AggregateOnly: 1,
			DataTypeId: 3,
			DateStartMsUtc: startDayTime,
			MaxCnt: 2,
			DataStats: 1,
			SessionId: sessionID
		}
		}, function(err3, res3, body3) {
		if(err3) {
		  return console.error(err3);
		};
		console.log(body3);
		console.log('statusCode:',res3 && res3.statusCode);
		powerValues = calculateValues(body3,startDayTime,goBackDays);
	});
}
getItDone();
console.log("Do me last");