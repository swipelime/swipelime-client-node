// Copyright 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { EventEmitter } from 'events';
import DDPClient, { ddpSubscription } from 'simpleddp-node';
import { Client } from './index';
import TaskEvent from './models/TaskEvent';
import TaskCommand from './models/TaskCommand';
import {
	ServiceHandlerEventTypes,
	IncomingTaskData,
	TaskType,
	eventTypes,
	commandTypes,
	IdOption
} from './types';

import {
	swipelimeError
} from './utils';

export * from './types';

export class ServiceHandler
{
	/**
	* The client instance used for communication.
	*/
	private readonly _client: Client;

	/**
	* The DDP client instance used for subscribing to tasks.
	*/
	private readonly _ddpClient: DDPClient;
	
	/**
	* The ID of the tenant.
	*/
	private readonly _tenantId: string;
	
	/**
	* The event emitter for handling service handler events.
	*/
	private readonly _eventEmitter: EventEmitter<ServiceHandlerEventTypes>;
	
	/**
	* The subscription for tasks.
	*/
	private _tasksSubscription: ddpSubscription;
	
	/**
	* The cache for storing tasks.
	*/
	private _taskCache = new Map<string, TaskEvent | TaskCommand>();

	/**
	* Gets the event emitter for handling service handler events.
	*/
	public get emitter(): EventEmitter<ServiceHandlerEventTypes> {
		return this._eventEmitter;
	}

	/**
	* Gets the ID of the tenant.
	*/
	public get tenantId(): string {
		return this._tenantId;
	}

	/**
	* Creates a new instance of the ServiceHandler class.
	* @param client - The client instance used for communication.
	* @param ddpClient - The DDP client instance used for subscribing to tasks.
	* @param tenantId - The ID of the tenant.
	* @throws {Error} If the tenant ID is not provided.
	*/
	constructor(client: Client, ddpClient: DDPClient, _tenantId: string)
	{
		if(!_tenantId)
		{
			throw swipelimeError('Tenant ID is required');
		}

		this._client = client;
		this._ddpClient = ddpClient;
		this._tenantId = _tenantId;
		this._eventEmitter = new EventEmitter();

		this.init();
	}

	public async isReady(): Promise<true>
	{
		await this._tasksSubscription.ready();

		return true;
	}

	private async init(): Promise<void>
	{
		try
		{
			this._tasksSubscription = this._ddpClient.subscribe(`api/v${this._client.apiVersion}/tasks`, this._tenantId);

			const reactiveTasksCollection = this._ddpClient.collection<IncomingTaskData>(`${this._tenantId}/tasks`).reactive();

			const reactiveTasksMap = reactiveTasksCollection.map<IncomingTaskData, TaskEvent | TaskCommand>((tasks) => this.taskMapFunction(tasks));

			reactiveTasksMap.onChange((newTasks: (TaskEvent | TaskCommand)[]) =>
			{
				if(!newTasks || newTasks.length === 0) return;

				// Filter out tasks that have been removed
				this._taskCache.forEach((task) =>
				{
					if(!newTasks.find(newTask => newTask.id === task.id))
					{
						this._taskCache.delete(task.id);
					}
				});

				// Get the tasks that are new
				const { tasksToEmit, commandsToRefuse, eventsToConfirm } = newTasks.reduce((acc, task) =>
				{
					if(!this._taskCache.has(task.id))
					{
						if(task instanceof TaskEvent && (!task.data.eventType || !eventTypes.includes(task.data.eventType as any)))
						{
							acc.eventsToConfirm.push(task);
							return acc;
						}

						if(task instanceof TaskCommand && (!task.data.commandType || !commandTypes.includes(task.data.commandType as any)))
						{
							acc.commandsToRefuse.push(task);
							return acc;
						}

						acc.tasksToEmit.push(task);
						this._taskCache.set(task.id, task);
					}

					return acc;
				}, { tasksToEmit: [] as (TaskEvent | TaskCommand)[], commandsToRefuse: [] as TaskCommand[], eventsToConfirm: [] as TaskEvent[] });

				if(commandsToRefuse.length)
				{
					this.refuseTaskCommands(commandsToRefuse);
				}

				if(eventsToConfirm.length)
				{
					this.confirmTaskEvents(eventsToConfirm);
				}

				if(tasksToEmit.length)
				{
					this._eventEmitter.emit('newTasks', tasksToEmit);	
				}
			});
		}
		catch(error)
		{
			console.error('ServiceHandler startSubscriptions error', error);
		}
	}

	private taskMapFunction(taskData: IncomingTaskData): (TaskEvent | TaskCommand)
	{
		if(taskData.taskType === TaskType.event) return new TaskEvent(taskData, this);
		if(taskData.taskType === TaskType.command) return new TaskCommand(taskData, this);

		throw swipelimeError('Unknown task type');
	}

	private getTaskIdFromTask(task: (TaskEvent | TaskCommand) | string): string
	{
		if(!task) throw swipelimeError('Task is missing');

		return typeof task === 'string' ? task : task.id;
	}

	private checkOptionalIdValidity(idData: IdOption): void
	{
		if(!idData.id && !idData.externalId) throw swipelimeError('id or externalId is required');
	}

	public async confirmTaskEvents(tasks: (TaskEvent | string)[]): Promise<boolean>
	{
		const taskIds = tasks.map((task) => this.getTaskIdFromTask(task));

		return this._ddpClient.call<[string, string[]], boolean>(`api/v${this._client.apiVersion}/markTasksAsProcessed`, this._tenantId, taskIds);
	}

	public async confirmTaskEvent(task: TaskEvent | string): Promise<boolean>
	{
		return this.confirmTaskEvents([task]);
	}

	public async confirmTestCommand(task: (TaskEvent | TaskCommand) | string): Promise<boolean>
	{
		return this._ddpClient.call<[string, string], boolean>(`api/v${this._client.apiVersion}/confirmTestCommand`, this._tenantId, this.getTaskIdFromTask(task));
	}

	/**
	* Refusing multiple tasks.
	* @param tasks - The tasks to refuse but it can also be the IDs of the tasks.
	*/
	public async refuseTaskCommands(tasks: (TaskCommand | string)[]): Promise<boolean>
	{
		const taskIds = tasks.map((task) => this.getTaskIdFromTask(task));

		return this._ddpClient.call<[string, string[]], boolean>(`api/v${this._client.apiVersion}/refuseTaskCommand`, this._tenantId, taskIds);
	}

	/**
	* If you are not able to complete the command then you can refuse it.
	* @param task - The task to refuse but it can also be the ID of the task.
	*/
	public async refuseTaskCommand(task: TaskCommand | string): Promise<boolean>
	{
		return this.refuseTaskCommands([task]);
	}

	/**
	* It marks the payment request as done for a specific table.
	* @param tableIdData - The ID of the table.
	* @returns A promise that resolves to true if it's successful.
	* @throws {Error} If the table ID is not a valid ID or external ID.
	*/
	public async markPaymentDone(tableIdData: IdOption): Promise<boolean>
	{
		this.checkOptionalIdValidity(tableIdData)

		return this._ddpClient.call<[string, IdOption, boolean], true>(`api/v${this._client.apiVersion}/markPaymentChanged`, this._tenantId, tableIdData, true);
	}

	/**
	* It marks the payment request as cancelled for a specific table.
	* @param tableIdData - The ID of the table.
	* @returns A promise that resolves to true if it's successful.
	* @throws {Error} If the table ID is not a valid ID or external ID.
	*/
	public async markPaymentCancelled(tableIdData: IdOption): Promise<boolean>
	{
		this.checkOptionalIdValidity(tableIdData)

		return this._ddpClient.call<[string, IdOption, boolean], true>(`api/v${this._client.apiVersion}/markPaymentChanged`, this._tenantId, tableIdData, false);
	}

	/**
	* Finish all table sessions on the table. Users will not be able to order anymore.
	* @param tableIdData - The ID of the table.
	* @returns A promise that resolves to true if it's successful.
	* @throws {Error} If the table ID is not a valid ID or external ID.
	*/
	public async finishTable(tableIdData: IdOption): Promise<boolean>
	{
		this.checkOptionalIdValidity(tableIdData)

		return this._ddpClient.call<[string, IdOption], true>(`api/v${this._client.apiVersion}/finishTable`, this._tenantId, tableIdData);
	}
}
