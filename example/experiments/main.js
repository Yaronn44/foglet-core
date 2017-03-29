'use strict';

const Foglet = require('foglet').Foglet;
const uuid = require('foglet').uuid;

let foglet = new Foglet({
	webrtc:	{
		trickle: true,
		iceServers : []
	},
	rpsType: 'fcn-wrtc',
	p: 100,
	m: 10,
	deltatime: 5 * 60 * 1000, // 20s min + (i+1)*2secondes
	timeout: 30 * 1000,
	enableOverlay: true,
	room:'foglet-core-experiment-curiosiphi',
	signalingAdress: 'https://signaling.herokuapp.com/',
	verbose:true,
	ssh: {
		address: 'http://localhost:4000'
	},
});