// Copyright 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import {
	Environment
} from './types';

export const swipelimeError = (msg: string | Record<string, any>): Error =>
{
	if(typeof msg === 'string') return new Error(`swipelime error: ${msg}`);

	return new Error(`swipelime error: ${JSON.stringify(msg)}`);
};

export const getServerUrlForEnvironment = (environment?: Environment) =>
{
	if(!environment) return 'wss://eu.swipelime.com/websocket';

	switch(environment)
	{
		case 'live-eu':
			return 'wss://eu.swipelime.com/websocket';
		case 'canary':
			return 'wss://canary.swipelime.com/websocket';
		case 'test':
			return 'wss://test.swipelime.com/websocket';
		case 'dev':
			return 'ws://localhost:3000/websocket';
		default:
			throw swipelimeError(`Unknown environment: ${environment}`);
	}
};
