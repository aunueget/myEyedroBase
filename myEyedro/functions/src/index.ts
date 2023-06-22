import * as functions from 'firebase-functions';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
// Google Assistant deps
import { dialogflow, SimpleResponse, BasicCard, Button, Image } from 'actions-on-google';
const app = dialogflow({ debug: true });
const rp = require('request-promise');

// Insert Dialogflow stuff here...

// Export the Cloud Functions
export const fulfillment = functions.https.onRequest(app);


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
	let wattMax = 0;
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
		else if(powerData[wattHourPair][POWER_W] > 675){
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
				wattMax=0;
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
		if (wattMax<powerData[wattHourPair][POWER_W]){
			wattMax = powerData[wattHourPair][POWER_W];
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
	return {todaysKWh: kiloWattHours, todaysKWhProjection: kWHProjection,wattMax: wattMax};
}				

app.intent('Get_Summary', async (conv) => {

    // Get the data
    const data = await getData();
	const speechOut = `Your currently producing ${data.currentWatts} watts and peaked at ${data.wattMax}. Todays total production is at ${data.todaysTotal} kilowatt hours and is expected to reach ${data.todaysProjection}`;
	console.log('data: ', data);
    // Text or Speech Response
    conv.close(new SimpleResponse({ 
        text: `Currenttly Producing: ${data.currentWatts}W\nPeaked at: ${data.wattMax}W\nTodays Total:  ${data.todaysTotal}KWh\nTodays Projection: ${data.todaysProjection}KWh`,
        speech: speechOut }));

    // Card Response
    conv.close(new BasicCard({
        title: `View Your Power Status`,
        image: new Image({ 
            url: 'https://my.eyedro.com/img/Logo-300x64.png',
            alt: 'Eyedro Logo' 
        }),
        buttons: new Button({
            title: 'View Production',
            url: 'https://my.eyedro.com/mobile/',
        }),
    }));
});


async function getData(){
	const milliSecsNHour=3.6e+6;
	const milliSecsNDay=8.64e+7;
	const goBackDays = 3;
	let todaysTotals;
	let sessionID =0;
	let startTime = 0;
	let currentWatts =-100;
	const timezoneOffset = -5;
	const startOfDay = new Date();
	//get timestamp for the start of day 3 days ago
	const startDayTime = startOfDay.getTime() - ((24+timezoneOffset+startOfDay.getUTCHours())*milliSecsNHour)-(goBackDays*milliSecsNDay);
	console.log('date back days: ', startDayTime);

	const powerData = await rp.post({
		url: 'https://my.eyedro.com/e2',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		method: 'POST',
		form: {
			Cmd: 'Login',
			Username: 'mcknightaa@gmail.com',
			PwdMd5: '910aaa537cbb1f7550bf0ddab5e6e5cf'
		}
		}, async function(err, res, body){
			
		if(err) {
			console.error(err);
			return -1;
		};
		console.log('body:',body);
		const objectValue = JSON.parse(body);
		startTime = objectValue['DateMsUtc'];
		sessionID = objectValue['SessionId'];
		console.log('sessionID: ',sessionID);
		console.log('DateMsUtc: ',startTime);
		console.log('statusCode:',res && res.statusCode);
		return res.statusCode;
	});
	
	const dataResponse = await rp.post({
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
			console.error(err2);
			return -1;
		};
		const objectValues = JSON.parse(body2);
		currentWatts = (objectValues['Data'])[2][0][1];
		console.log('body:',body2);
		console.log('statusCode:',res2 && res2.statusCode);
		console.log('currentWatts: ',currentWatts);
		return res2.statusCode;
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
		  console.error(err3);
		  return -1
		};
		todaysTotals = calculateValues(body3,startDayTime,goBackDays);
		return res3.statusCode;
	});
	
	console.log ('powerData: ' ,powerData);
	console.log('dataResponse: ',dataResponse);
	console.log('TodaysTodals: ',getTodaysTotals[0]);
	console.log('currentWatts: ',currentWatts);
	return {
		currentWatts: currentWatts,
		todaysTotal: todaysTotals.todaysKWh,
		todaysProjection: todaysTotals.todaysKWhProjection,
		wattMax: todaysTotals.wattMax
	}
}