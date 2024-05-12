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
	DataIdType,
	OrderItemsData,
	UniversalMenuItem,
	UniversalMenuItemData,
	UniversalMenuCategory,
	NativeTable,
	CustomOrderItem
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

	private checkOptionalIdValidity(idData: DataIdType): void
	{
		if(!idData.id && !idData.externalId) throw swipelimeError('id or externalId is required');
	}

	public confirmTaskEvents(tasks: (TaskEvent | string)[]): Promise<void>
	{
		const taskIds = tasks.map((task) => this.getTaskIdFromTask(task));

		return this._ddpClient.call<[string, string[]], void>(`api/v${this._client.apiVersion}/markTasksAsProcessed`, this._tenantId, taskIds);
	}

	public confirmTaskEvent(task: TaskEvent | string): Promise<void>
	{
		return this.confirmTaskEvents([task]);
	}

	/**
	 * Confirms a test command.
	 * The test command can be fired from the test suite in the integration settings in swipelime. When the test command received, this method has to be called to confirm it. It's for testing purposes only.
	 * 
	 * @param task - The task event, task command, or task ID.
	 */
	public confirmTestCommand(task: (TaskEvent | TaskCommand) | string): Promise<void>
	{
		return this._ddpClient.call<[string, string], void>(`api/v${this._client.apiVersion}/confirmTestCommand`, this._tenantId, this.getTaskIdFromTask(task));
	}

	/**
	* Refusing multiple tasks.
	* @param tasks - The tasks to refuse but it can also be the IDs of the tasks.
	*/
	public refuseTaskCommands(tasks: (TaskCommand | string)[]): Promise<void>
	{
		const taskIds = tasks.map((task) => this.getTaskIdFromTask(task));

		return this._ddpClient.call<[string, string[]], void>(`api/v${this._client.apiVersion}/refuseTaskCommand`, this._tenantId, taskIds);
	}

	/**
	* If you are not able to complete the command then you can refuse it.
	* @param task - The task to refuse but it can also be the ID of the task.
	*/
	public refuseTaskCommand(task: TaskCommand | string): Promise<void>
	{
		return this.refuseTaskCommands([task]);
	}

	/**
	* It marks the payment request as done for a specific table.
	* When the payment is done for a table this method has to be called so our system can reflect to that.
	* @param tableIdData - The ID of the table.
	* @returns A promise that resolves to true if it's successful.
	* @throws {Error} If the table ID is not a valid ID or external ID.
	*/
	public markPaymentDone(tableIdData: DataIdType): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		return this._ddpClient.call<[string, DataIdType, boolean], void>(`api/v${this._client.apiVersion}/markPaymentChanged`, this._tenantId, tableIdData, true);
	}

	/**
	* It marks the payment request as cancelled for a specific table.
	* When the payment is cancelled for a table this method has to be called so our system can reflect to that.
	* @param tableIdData - The ID of the table.
	* @returns A promise that resolves to true if it's successful.
	* @throws {Error} If the table ID is not a valid ID or external ID.
	*/
	public markPaymentCancelled(tableIdData: DataIdType): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		return this._ddpClient.call<[string, DataIdType, boolean], void>(`api/v${this._client.apiVersion}/markPaymentChanged`, this._tenantId, tableIdData, false);
	}

	/**
	* Finish all table sessions on the table. Users will not be able to order anymore.
	* When customers are leaving this method should be called to finish the table and lock their session so no more order can be made.
	* @param tableIdData - The ID of the table.
	* @returns A promise that resolves to true if it's successful.
	* @throws {Error} If the table ID is not a valid ID or external ID.
	*/
	public finishTable(tableIdData: DataIdType): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		return this._ddpClient.call<[string, DataIdType], void>(`api/v${this._client.apiVersion}/finishTable`, this._tenantId, tableIdData);
	}

	/**
	 * Retrieves the orders for a specific table.
	 * 
	 * @param tableIdData - The ID of the table.
	 * @returns A promise that resolves to the order event data.
	 */
	public getOrders(tableIdData: DataIdType): Promise<OrderItemsData[]>
	{
		this.checkOptionalIdValidity(tableIdData);

		return this._ddpClient.call<[string, DataIdType], OrderItemsData[]>(`api/v${this._client.apiVersion}/getOrders`, this._tenantId, tableIdData);
	}

	/**
	 * Cancels the specified order items for a given table.
	 * 
	 * @param tableIdData - The ID of the table.
	 * @param orderItemIds - An array of order item IDs to be cancelled.
	 * @returns A Promise that resolves to void.
	 */
	public cancelOrderItems(tableIdData: DataIdType, orderItemIds: string[]): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		if(!orderItemIds?.length) throw swipelimeError('cancelOrderItems method need valid orderItemIds');

		return this._ddpClient.call<[string, string[]], void>(`api/v${this._client.apiVersion}/cancelOrderItems`, this._tenantId, orderItemIds);
	}

	/**
	 * Retrieves the universal menu elements from the server.
	 * 
	 * @returns A promise that resolves to an array of UniversalMenuItem or UniversalMenuCategory objects.
	 */
	public getUniversalMenuElements(): Promise<(UniversalMenuItem | UniversalMenuCategory)[]>
	{
		return this._ddpClient.call<[string], (UniversalMenuItem | UniversalMenuCategory)[]>(`api/v${this._client.apiVersion}/getUniversalMenuElements`, this._tenantId);
	}

	/**
	 * Retrieves the universal menu items.
	 * @returns A promise that resolves to an array of UniversalMenuItem objects.
	 */
	public getUniversalMenuItems(): Promise<UniversalMenuItem[]>
	{
		return this._ddpClient.call<[string], UniversalMenuItem[]>(`api/v${this._client.apiVersion}/getUniversalMenuElements`, this._tenantId);
	}

	/**
	 * Retrieves the universal menu categories.
	 * @returns A promise that resolves to an array of UniversalMenuCategory objects.
	 */
	public getUniversalMenuCategories(): Promise<UniversalMenuCategory[]>
	{
		return this._ddpClient.call<[string], UniversalMenuCategory[]>(`api/v${this._client.apiVersion}/getUniversalMenuElements`, this._tenantId);
	}

	/**
	 * Retrieves all tables.
	 * @returns A promise that resolves to an array of NativeTable objects.
	 */
	public getTables(): Promise<NativeTable[]>
	{
		return this._ddpClient.call<[string], NativeTable[]>(`api/v${this._client.apiVersion}/getTables`, this._tenantId);
	}

	/**
	 * Retrieves a table based on the provided table ID.
	 * @param tableIdData - The ID of the table.
	 * @returns A promise that resolves to the retrieved NativeTable object.
	 */
	public async getTable(tableIdData: DataIdType): Promise<NativeTable | undefined>
	{
		this.checkOptionalIdValidity(tableIdData);

		return (await this._ddpClient.call<[string, DataIdType[]], NativeTable[]>(`api/v${this._client.apiVersion}/getTables`, this._tenantId, [tableIdData]))[0];
	}

	/**
	 * Deletes menu elements (eg. items, categories) by their IDs.
	 * @param ids - An array of IdOption objects representing the IDs of the menu elements to delete.
	 * @returns A Promise that resolves to the number of menu elements deleted.
	 */
	public deleteMenuElements(ids: DataIdType[]): Promise<number>
	{
		if(!ids?.length) throw swipelimeError('deleteMenuElementsByIds method need valid ids');

		 return this._ddpClient.call<[string, DataIdType[]], number>(`api/v${this._client.apiVersion}/deleteMenuElementsByIds`, this._tenantId, ids);
	}

	/**
	 * Upserts universal menu items.
	 * 
	 * @param universalMenuItemsData - An array of partial UniversalMenuItemData objects.
	 * @returns A promise that resolves to an object containing the number of items updated and the number of new items.
	 */
	public upsertUniversalMenuItems(universalMenuItemsData: Partial<UniversalMenuItemData>[]): Promise<{ updated: number, new: number }>
	{
		if(!universalMenuItemsData?.length) throw swipelimeError('upsertUniversalMenuItems method need valid universalMenuItems');

		return this._ddpClient.call<[string, Partial<UniversalMenuItemData>[]], { updated: number, new: number }>(`api/v${this._client.apiVersion}/upsertUniversalMenuItems`, this._tenantId, universalMenuItemsData);
	}

	public addCustomOrderItem(tableIdData: DataIdType, customOrderItem: CustomOrderItem): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		return this._ddpClient.call<[string, DataIdType, CustomOrderItem], void>(`api/v${this._client.apiVersion}/addCustomOrderItem`, this._tenantId, tableIdData, customOrderItem);
	}
}
