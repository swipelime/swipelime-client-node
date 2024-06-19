// Copyright 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { EventEmitter, once } from 'events';
import DDPClient, { SimpleDDPConnectOptions, MeteorError } from 'simpleddp-node';
import ws from 'ws';
import { ServiceHandler } from './ServiceHandler';
import {
	AuthParams,
	ClientOptions,
	ClientEventTypes,
	PingResponse,
	ServiceHandlerOptions
} from './types';
import TaskEvent from './models/TaskEvent';
import TaskCommand from './models/TaskCommand';

import {
	getServerUrlForEnvironment,
	swipelimeError
} from './utils';

export * from './types';

export { TaskEvent, TaskCommand };

export class Client
{
	private readonly _authParams: AuthParams;
	private readonly _ddpClient: DDPClient;
	private readonly _eventEmitter: EventEmitter<ClientEventTypes>;
	private _isInitialized = false;
	private _isLoggedIn = false;
	private _isConnected = false;
	private _serviceHandlers: ServiceHandler[] = [];
	public readonly apiVersion = 1;
	public readonly clientVersion = '0.2.6';

	public get isLoggedIn(): boolean
	{
		return this._isLoggedIn;
	}

	public get isConnected(): boolean
	{
		return this._isConnected;
	}

	public get emitter(): EventEmitter<ClientEventTypes>
	{
		return this._eventEmitter;
	}

	constructor(authParams: AuthParams, options?: ClientOptions)
	{
		if(!authParams.username)
		{
			throw swipelimeError('Username is required');
		}

		if(!authParams.password)
		{
			throw swipelimeError('Username is required');
		}

		this._eventEmitter = new EventEmitter<ClientEventTypes>();

		this._eventEmitter.setMaxListeners(100);

		this._authParams = authParams;

		const ddpOptions: SimpleDDPConnectOptions =
		{
			endpoint: getServerUrlForEnvironment(options?.environment),
			SocketConstructor: ws,
			reconnectInterval: options?.reconnectInterval ?? 5000
		};

		this._ddpClient = new DDPClient(ddpOptions);

		this.init();
	}

	private init(): void
	{
		if(this._isInitialized) return;

		this._isInitialized = true;

		this._ddpClient.on('connected', async () =>
		{
			this._isConnected = true;

			if(!(await this._ddpClient.call<[string], boolean>(`api/v${this.apiVersion}/isVersionValid`, this.clientVersion)))
			{
				this._eventEmitter.emit('error', swipelimeError('Client version is not supported'));
				this._ddpClient.disconnect();
				return;
			}

			this._eventEmitter.emit('connected');

			try
			{
				this._ddpClient.login({
					password: this._authParams.password,
					user: {
						username: this._authParams.username
					}
				});
			}
			catch(e)
			{
				const meteorError = e as MeteorError;

				this._eventEmitter.emit('error', swipelimeError(meteorError.message));
			}
		});

		this._ddpClient.on<'login'>('login', (user) =>
		{
			this._isLoggedIn = true;

			this._eventEmitter.emit('login', user);
		});

		this._ddpClient.on('logout', () =>
		{
			this._isLoggedIn = false;

			this._eventEmitter.emit('logout');
		});

		this._ddpClient.on('disconnected', () =>
		{
			this._isConnected = false;
			this._isLoggedIn = false;

			this._eventEmitter.emit('disconnected');
		});

		this._ddpClient.on('error', (e) =>
		{
			this._eventEmitter.emit('error', swipelimeError(e.msg));
		});
	}

	/**
	 * Pings the server which will return 'pong'
	 */
	public async ping(): Promise<PingResponse>
	{
		return this._ddpClient.call<[], PingResponse>(`api/v${this.apiVersion}/methods/ping`);
	}

	/**
	 * Returns the latency in milliseconds
	 */
	public async getLatency(): Promise<number>
	{
		const started = new Date().getTime();

		await this.ping();

		const ended = new Date().getTime();

		return ended - started;
	}

	/**
	 * Returns an array of available tenant IDs that the client can access
	 */
	public async getAvailableTenantIds(): Promise<string[]>
	{
		return this._ddpClient.call<[], string[]>(`api/v${this.apiVersion}/getAvailableTenants`);
	}

	/**
	 * Adds a service handler for the specified tenant ID
	 * Service handlers are used to interact with the API for a specific tenant
	 */
	public async addServiceHandler({ tenantId }: ServiceHandlerOptions): Promise<ServiceHandler>
	{
		if(!tenantId)
		{
			throw swipelimeError('Tenant ID is required');
		}

		if(!this._isLoggedIn) await once(this._eventEmitter, 'login');

		const serviceHandler = new ServiceHandler(this, this._ddpClient, tenantId);

		this._serviceHandlers.push(serviceHandler);

		return serviceHandler;
	}

	public getServiceHandlers(): ServiceHandler[]
	{
		return this._serviceHandlers;
	}
}
