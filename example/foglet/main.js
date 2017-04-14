'use strict';

localStorage.debug = 'foglet-core:*';

const Foglet = require('foglet').Foglet;
const $ = window.$;
let o = [];

const max = 3;


for(let i = 0; i < max; ++i) {
	o[i] = new Foglet({
		protocol: 'foglet-example',
		webrtc:	{
			trickle: false,
			iceServers : []
		},
		enableOverlay:false,
		room: 'best-room-for-foglet',
		verbose: true,
		rpsType: 'spray-wrtc-merging'
	});
}

const logs = (string) => {
	console.log(string);
	$('#appendLogs').append('<p>' + string + '</p>');
};


const directConnection = (time2wait = 500) => {
	let f = o[0];
	for(let i = 1; i < max; ++i) {
		let p = o[i];
		f.connection(p).then(d =>{
			logs(`=> Foglet ${f.id} has been connected with a direct connection to Foglet ${p.id}`);
		});
	}
};


const signalingConnection = (time2wait = 500) => {
	for (let i = 0; i < max; ++i) {
		(function (ind) {
			setTimeout(function () {
				o[ind].connection().then(d =>{
					logs(`=> Foglet number ${ind} has been connected on the room : ${o[ind].options.room}`);
				});
			}, (time2wait * ind));
		})(i);
	}
};
