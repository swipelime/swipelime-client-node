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
	TaskType
} from './types';

import {
	swipelimeError
} from './utils';

export * from './types';

export class ServiceHandler
{
	private readonly _client: Client;
	private readonly _ddpClient: DDPClient;
	private readonly _tenantId: string;
	private readonly _eventEmitter: EventEmitter<ServiceHandlerEventTypes>;
	private _tasksSubscription: ddpSubscription;
	private _taskCache = new Map<string, TaskEvent | TaskCommand>();

	public get emitter(): EventEmitter<ServiceHandlerEventTypes>
	{
		return this._eventEmitter;
	}

	public get tenantId(): string
	{
		return this._tenantId;
	}

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

	private init(): void
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
				const tasksToEmit = newTasks.reduce((acc, task) =>
				{
					if(!this._taskCache.has(task.id))
					{
						acc.push(task);
						this._taskCache.set(task.id, task);
					}

					return acc;
				}, [] as (TaskEvent | TaskCommand)[]);

				if(tasksToEmit.length === 0) return;

				this._eventEmitter.emit('newTasks', tasksToEmit);
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

	public async refuseTaskCommands(tasks: (TaskCommand | string)[]): Promise<boolean>
	{
		const taskIds = tasks.map((task) => this.getTaskIdFromTask(task));

		return this._ddpClient.call<[string, string[]], boolean>(`api/v${this._client.apiVersion}/refuseTaskCommand`, this._tenantId, taskIds);
	}

	public async refuseTaskCommand(task: TaskCommand | string): Promise<boolean>
	{
		return this.refuseTaskCommands([task]);
	}
}
