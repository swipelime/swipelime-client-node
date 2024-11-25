// Copyright 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import {
	Environment
} from './types';

export const swipelimeConsoleError = (msg: string | Record<string, any>): string =>
{
	const errorMessage = typeof msg === 'string' ? `Swipelime client error: ${msg}` : `Swipelime client error: ${JSON.stringify(msg)}`;

	console.error(errorMessage);

	return errorMessage;
};

export const swipelimeError = (msg: string | Record<string, any>): Error =>
{
	const errorMessage = swipelimeConsoleError(msg);

	return new Error(errorMessage);
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
