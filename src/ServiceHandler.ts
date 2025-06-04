// Copyright (c) 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { EventEmitter } from 'events';
import DDPClient, { ddpSubscription } from 'simpleddp-node';
import { debounce } from 'lodash';
import { Client } from './index';
import TaskEvent from './models/TaskEvent';
import TaskCommand from './models/TaskCommand';
import SystemAlert from './models/SystemAlert';
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
	CustomOrderItem,
	UpsertUniversalMenuItemsReturn,
	UpsertTablesReturn,
	SystemAlertType
} from './types';
import {
	swipelimeConsoleError,
	swipelimeError
} from './utils';

// eslint-disable-next-line import/prefer-default-export
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
	* The latest tasks that have been received.
	* This is used to store the tasks that have been received while processing the previous batch of tasks.
	* We are only interested in the latest batch os tasks because that's the most up to date data.
	*/
	private _latestTasks: (TaskEvent | TaskCommand)[] | null = null;

	/**
	* A flag to indicate if we are processing tasks.
	* This is used to prevent multiple tasks processing at the same time.
	*/
	private _isProcessingTasks = false;

	/**
	 * The timeout for tasks in milliseconds.
	 * If a task is not processed within this time it will be deferred.
	 * The check interval is used to check if there are any tasks that have timed out.
	*/
	private readonly _taskTimeout = 60000; // 1 minute timeout for tasks
	private readonly _checkInterval = 30000; // Check every 30 seconds

	/**
	* Gets the event emitter for handling service handler events.
	*/
	public get emitter(): EventEmitter<ServiceHandlerEventTypes>
	{
		return this._eventEmitter;
	}

	/**
	* Gets the ID of the tenant.
	*/
	public get tenantId(): string
	{
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
		this.startTaskCheckInterval();
	}

	public async isReady(): Promise<true>
	{
		await this._tasksSubscription.ready();

		return true;
	}

	// Check if there are any new tasks that need to be processed
	private processTasksFinishes(): void
	{
		if(this._latestTasks)
		{
			const latestTasks = this._latestTasks;
			this._latestTasks = null;
			return this.runTasksQueue(latestTasks); // Use debounce to start processing the next batch of tasks
		}
	}

	private async processTasks(newTasks: (TaskEvent | TaskCommand)[]): Promise<void>
	{
		if(!newTasks || newTasks.length === 0)
		{
			this._isProcessingTasks = false;

			this._taskCache.clear();

			return this.processTasksFinishes();
		}

		// Set the flag that we are processing tasks
		this._isProcessingTasks = true;

		const newTaskIds = new Set(newTasks.map((task) => task.id));

		// Filter out tasks that have been removed
		this._taskCache.forEach((task) =>
		{
			if(!newTaskIds.has(task.id))
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

		const afterProcessPromises = [];

		// These will be automatically refused
		if(commandsToRefuse.length)
		{
			afterProcessPromises.push(this.refuseTasks(commandsToRefuse));
		}

		// These will be automatically confirmed
		if(eventsToConfirm.length)
		{
			afterProcessPromises.push(this.confirmTaskEvents(eventsToConfirm));
		}

		if(afterProcessPromises.length)
		{
			await Promise.all(afterProcessPromises);
		}

		if(tasksToEmit.length)
		{
			this._eventEmitter.emit('newTasks', tasksToEmit);
		}

		// Processing is done so we can set the flag to false
		this._isProcessingTasks = false;

		// After finish we need to check if there are any new tasks that need to be processed
		return this.processTasksFinishes();
	}

	private runTasksQueue = debounce((newTasks: (TaskEvent | TaskCommand)[]): void =>
	{
		if(this._isProcessingTasks)
		{
			this._latestTasks = newTasks;
		}
		else
		{
			this.processTasks(newTasks);
		}
	}, 200);

	private async init(): Promise<void>
	{
		try
		{
			this._tasksSubscription = this._ddpClient.subscribe(`api/v${this._client.apiVersion}/tasks`, this._tenantId);

			const reactiveTasksCollection = this._ddpClient.collection<IncomingTaskData>(`${this._tenantId}/tasks`).reactive();

			const reactiveTasksMap = reactiveTasksCollection.map<IncomingTaskData, TaskEvent | TaskCommand>((tasks) => this.taskMapFunction(tasks));

			// We receive new tasks asynchronously so we need to process them in a queue
			reactiveTasksMap.onChange((newTasks: (TaskEvent | TaskCommand)[]) => this.runTasksQueue(newTasks));
		}
		catch(error)
		{
			if(error.errorType === 'Meteor.Error')
			{
				this._client.emitter.emit('error', swipelimeConsoleError(`ServiceHandler startSubscriptions error: ${error.message}${error.details ? ` ${error.details}` : ''}`));
			}
			else
			{
				this._client.emitter.emit('error', swipelimeConsoleError(`ServiceHandler startSubscriptions error: ${JSON.stringify(error)}`));
			}
		}
	}

	private taskMapFunction(taskData: IncomingTaskData): (TaskEvent | TaskCommand)
	{
		if(taskData.taskType === TaskType.event) return new TaskEvent(taskData, this, Date.now());
		if(taskData.taskType === TaskType.command) return new TaskCommand(taskData, this, Date.now());

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

	/**
	* Starts the interval to check for long-running tasks.
	* If a task is not processed within the timeout, it will be deferred.
	*/
	private startTaskCheckInterval(): void
	{
		setInterval(() =>
		{
			// We skip the check if the client is not connected
			if(!this._client.isConnected)
			{
				return;
			}

			const now = Date.now();
			const tasksToDefer: (TaskEvent | TaskCommand)[] = [];

			this._taskCache.forEach((task) =>
			{
				if(now - task.timestampReceived > this._taskTimeout)
				{
					tasksToDefer.push(task);
				}
			});

			if(tasksToDefer.length > 0)
			{
				tasksToDefer.forEach((task) => this._taskCache.delete(task.id));

				this.deferTasks(tasksToDefer);

				this._eventEmitter.emit('systemAlert', new SystemAlert({ systemAlertType: SystemAlertType['long-running-tasks'], tasks: tasksToDefer }, new Date()));
			}
		}, this._checkInterval);
	}

	public confirmTaskEvents(tasks: (TaskEvent | string)[]): Promise<void>
	{
		const taskIds = tasks.map((task) => this.getTaskIdFromTask(task));

		return this._client.callMethod<[string, string[]], void>(`api/v${this._client.apiVersion}/markTasksAsProcessed`, this._tenantId, taskIds);
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
	public confirmTestCommand(task: TaskCommand | string): Promise<void>
	{
		return this._client.callMethod<[string, string], void>(`api/v${this._client.apiVersion}/confirmTestCommand`, this._tenantId, this.getTaskIdFromTask(task));
	}

	/**
	* Refusing multiple tasks.
	* @param tasks - The tasks to refuse but they can also be the IDs of the tasks.
	*/
	public refuseTasks(tasks: (TaskEvent | TaskCommand | string)[]): Promise<void>
	{
		const taskIds = tasks.map((task) => this.getTaskIdFromTask(task));

		return this._client.callMethod<[string, string[]], void>(`api/v${this._client.apiVersion}/refuseTasks`, this._tenantId, taskIds);
	}

	/**
	* You can defer multiple tasks if you can't process them at the moment.
	* If tasks stay unprocessed for a long time, they will be deferred automatically.
	* @param tasks - The tasks to defer but they can also be the IDs of the tasks.
	* Deferred tasks will be re-sent to you later unless they were deferred too many times.
	*/
	public deferTasks(tasks: (TaskEvent | TaskCommand | string)[]): Promise<void>
	{
		const taskIds = tasks.map((task) => this.getTaskIdFromTask(task));

		return this._client.callMethod<[string, string[]], void>(`api/v${this._client.apiVersion}/deferTasks`, this._tenantId, taskIds);
	}

	/**
	* Test method to make a DDP error.
	*/
	public async makeError(): Promise<void>
	{
		return this._client.callMethod<[], void>(`api/v${this._client.apiVersion}/makeError`);
	}

	/**
	 * Pings the server.
	 * @returns A promise that resolves to 'pong'.
	 * This method can be used to check if the server is reachable.
	 * Valid login is required to use this method.
	 */
	public ping(): Promise<'pong' | undefined>
	{
		return this._client.callMethod<[], 'pong'>(`api/v${this._client.apiVersion}/ping`);
	}

	/**
	 * @deprecated Use the markOrderItemsPaymentStatus method instead.
	* It marks the payment request as done for a specific table.
	* When the payment is done for a table this method has to be called so our system can reflect to that.
	* @param tableIdData - The ID of the table.
	* @returns A promise that resolves to true if it's successful.
	* @throws {Error} If the table ID is not a valid ID or external ID.
	*/
	public markPaymentDone(tableIdData: DataIdType): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		return this._client.callMethod<[string, DataIdType, boolean], void>(`api/v${this._client.apiVersion}/markPaymentChanged`, this._tenantId, tableIdData, true);
	}

	/**
	 * @deprecated Use the markOrderItemsPaymentStatus method instead.
	* It marks the payment request as cancelled for a specific table.
	* When the payment is cancelled for a table this method has to be called so our system can reflect to that.
	* @param tableIdData - The ID of the table.
	* @returns A promise that resolves to true if it's successful.
	* @throws {Error} If the table ID is not a valid ID or external ID.
	*/
	public markPaymentCancelled(tableIdData: DataIdType): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		return this._client.callMethod<[string, DataIdType, boolean], void>(`api/v${this._client.apiVersion}/markPaymentChanged`, this._tenantId, tableIdData, false);
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

		return this._client.callMethod<[string, DataIdType], void>(`api/v${this._client.apiVersion}/finishTable`, this._tenantId, tableIdData);
	}

	/**
	 * Retrieves the ordered items for a specific table.
	 *
	 * @param tableIdData - The ID of the table.
	 * @returns A promise that resolves to the order event data.
	 */
	public getOrderItems(tableIdData: DataIdType): Promise<OrderItemsData[] | undefined>
	{
		this.checkOptionalIdValidity(tableIdData);

		return this._client.callMethod<[string, DataIdType], OrderItemsData[]>(`api/v${this._client.apiVersion}/getOrderItems`, this._tenantId, tableIdData);
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

		return this._client.callMethod<[string, string[]], void>(`api/v${this._client.apiVersion}/cancelOrderItems`, this._tenantId, orderItemIds);
	}

	/**
	 * Retrieves the universal menu elements from the server.
	 *
	 * @returns A promise that resolves to an array of UniversalMenuItem or UniversalMenuCategory objects.
	 */
	public getUniversalMenuElements(): Promise<(UniversalMenuItem | UniversalMenuCategory)[] | undefined>
	{
		return this._client.callMethod<[string], (UniversalMenuItem | UniversalMenuCategory)[]>(`api/v${this._client.apiVersion}/getUniversalMenuElements`, this._tenantId);
	}

	/**
	 * Retrieves the universal menu items.
	 * @returns A promise that resolves to an array of UniversalMenuItem objects.
	 */
	public getUniversalMenuItems(): Promise<UniversalMenuItem[] | undefined>
	{
		return this._client.callMethod<[string, 'item' | 'category' | undefined], UniversalMenuItem[]>(`api/v${this._client.apiVersion}/getUniversalMenuElements`, this._tenantId, 'item');
	}

	/**
	 * Retrieves the universal menu categories.
	 * @returns A promise that resolves to an array of UniversalMenuCategory objects.
	 */
	public getUniversalMenuCategories(): Promise<UniversalMenuCategory[] | undefined>
	{
		return this._client.callMethod<[string, 'item' | 'category' | undefined], UniversalMenuCategory[]>(`api/v${this._client.apiVersion}/getUniversalMenuElements`, this._tenantId, 'category');
	}

	/**
	 * Retrieves all tables.
	 * @returns A promise that resolves to an array of NativeTable objects.
	 */
	public getTables(): Promise<NativeTable[] | undefined>
	{
		return this._client.callMethod<[string], NativeTable[]>(`api/v${this._client.apiVersion}/getTables`, this._tenantId);
	}

	/**
	 * Retrieves a table based on the provided table ID.
	 * @param tableIdData - The ID of the table.
	 * @returns A promise that resolves to the retrieved NativeTable object.
	 */
	public async getTable(tableIdData: DataIdType): Promise<NativeTable | undefined>
	{
		this.checkOptionalIdValidity(tableIdData);

		return (await this._client.callMethod<[string, DataIdType[]], NativeTable[]>(`api/v${this._client.apiVersion}/getTables`, this._tenantId, [tableIdData]))?.[0];
	}

	/**
	 * Upserts universal menu items.
	 *
	 * @param universalMenuItemsData - An array of partial UniversalMenuItemData objects.
	 * @param commandId - You can pass in the command id if this was a command from swipelime.
	 * @returns A promise that resolves to an object containing the number of items updated and the number of new items.
	 */
	public upsertUniversalMenuItems(universalMenuItemsData: Partial<UniversalMenuItemData>[], commandId?: string): Promise<UpsertUniversalMenuItemsReturn | undefined>
	{
		if(!universalMenuItemsData?.length) throw swipelimeError('upsertUniversalMenuItems method need valid universalMenuItemsData');

		return this._client.callMethod<[string, Partial<UniversalMenuItemData>[], string | undefined], UpsertUniversalMenuItemsReturn>(`api/v${this._client.apiVersion}/upsertUniversalMenuItems`, this._tenantId, universalMenuItemsData, commandId);
	}

	/**
	 * Upserts tables.
	 *
	 * @param tableData - An array of partial NativeTable objects.
	 * @param commandId - You can pass in the command id if this was a command from swipelime.
	 * @returns A promise that resolves to an object containing the number of tables updated and the number of new items.
	 */
	public upsertTables(tableData: Partial<NativeTable>[], commandId?: string): Promise<UpsertTablesReturn | undefined>
	{
		if(!tableData?.length) throw swipelimeError('upsertUniversalMenuItems method need valid tableData');

		return this._client.callMethod<[string, Partial<UniversalMenuItemData>[], string | undefined], UpsertTablesReturn>(`api/v${this._client.apiVersion}/upsertTables`, this._tenantId, tableData, commandId);
	}

	/**
	 * Deletes menu elements (eg. items, categories) by their IDs.
	 * @param ids - An array of IdOption objects representing the IDs of the menu elements to delete.
	 * @returns A Promise that resolves to the number of menu elements deleted.
	 */
	public deleteMenuElements(ids: DataIdType[]): Promise<number | undefined>
	{
		if(!ids?.length) throw swipelimeError('deleteMenuElementsByIds method need valid ids');

		return this._client.callMethod<[string, DataIdType[]], number>(`api/v${this._client.apiVersion}/deleteMenuElementsByIds`, this._tenantId, ids);
	}

	/**
	 * Deletes tables by their IDs.
	 * @param ids - An array of IdOption objects representing the IDs of the tables to delete.
	 * @returns A Promise that resolves to the number of tables deleted.
	 */
	public deleteTables(ids: DataIdType[]): Promise<number | undefined>
	{
		if(!ids?.length) throw swipelimeError('deleteMenuElementsByIds method need valid ids');

		return this._client.callMethod<[string, DataIdType[]], number>(`api/v${this._client.apiVersion}/deleteTables`, this._tenantId, ids);
	}

	/**
	 * Adds a custom order item to the table. It only requires a label (which can be from any language) a quantity and a price.
	 * @param tableIdData - The ID of the table where the custom order item will be added.
	 * @param customOrderItem - The custom order item to be added.
	 */
	public addCustomOrderItems(tableIdData: DataIdType, customOrderItem: CustomOrderItem[]): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		if(!customOrderItem?.length) throw swipelimeError('addCustomOrderItems method need valid customOrderItem');

		return this._client.callMethod<[string, DataIdType, CustomOrderItem[]], void>(`api/v${this._client.apiVersion}/addCustomOrderItems`, this._tenantId, tableIdData, customOrderItem);
	}

	/**
	 * Changes the status of the order items.
	 * @param tableIdData - The ID of the table where the custom order item will be added.
	 * @param orderItemChanges - The order item changes eg. { orderItemId1: 'confirmed', orderItemId2: 'cancelled' }
	 */
	public changeOrderItemsStatus(tableIdData: DataIdType, orderItemChanges: Record<string, 'confirmed' | 'cancelled'>): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		if(!Object.keys(orderItemChanges)?.length) throw swipelimeError('changeOrderItemStatus method need valid orderItemChanges');

		return this._client.callMethod<[string, DataIdType, Record<string, 'confirmed' | 'cancelled'>], void>(`api/v${this._client.apiVersion}/changeOrderItemsStatus`, this._tenantId, tableIdData, orderItemChanges);
	}

	/**
	 * Confirms a confirm universal menu elements command.
	 * This command is fired when swipelime needs a confirmation that the elements are existing in your system.
	 *
	 * @param task - The task event, task command, or task ID.
	 * @param elementsConfirmation - The confirmation of the elements eg. { elementId1: true, elementId2: false }
	 */
	public confirmUniversalMenuElementsCommand(task: TaskCommand | string, elementsConfirmation: Record<string, boolean>): Promise<void>
	{
		if(!elementsConfirmation || !Object.keys(elementsConfirmation).length) throw swipelimeError('confirmUniversalMenuElementsCommand method need valid elementsConfirmation');

		return this._client.callMethod<[string, string, Record<string, boolean>], void>(`api/v${this._client.apiVersion}/confirmUniversalMenuElements`, this._tenantId, this.getTaskIdFromTask(task), elementsConfirmation);
	}

	/**
	 * Marks the order items as paid or cancelled.
	 * This is a feedback for us that the order items are paid and we can mark them as paid in our system.
	 * @param tableIdData - The ID of the table where the order items are.
	 * @param orderItemIds - An array of order item IDs to be marked as paid.
	 * @param paymentStatus - The payment status to be set for the order items (paid or cancelled).
	 * @returns A promise that resolves to the payment ID.
	 */
	public markOrderItemsPaymentStatus(tableIdData: DataIdType, orderItemIds: string[], paymentStatus: 'paid' | 'cancelled'): Promise<string | undefined>
	{
		this.checkOptionalIdValidity(tableIdData);

		if(!orderItemIds.length) throw swipelimeError('markOrderItemsAsPaid method need valid orderItemIds');

		if(paymentStatus !== 'paid' && paymentStatus !== 'cancelled') throw swipelimeError('markOrderItemsAsPaid method need valid paymentStatus');

		return this._client.callMethod<[string, DataIdType, string[], 'paid' | 'cancelled'], string>(`api/v${this._client.apiVersion}/markOrderItemsPaymentStatus`, this._tenantId, tableIdData, orderItemIds, paymentStatus);
	}

	/**
	 * Cancels the payment that was coming from the order-items-payment-confirmed
	 * This can be used if the payment request was not successful and you want to cancel it.
	 * This will mark the order items as unpaid and the customers can pay again.
	 * @param tableIdData - The ID of the table where the payment was made.
	 * @param paymentId - The ID of the payment to be cancelled.
	 * @returns A promise that resolves to void.
	 */
	public cancelPayment(tableIdData: DataIdType, paymentId: string): Promise<void>
	{
		this.checkOptionalIdValidity(tableIdData);

		if(!paymentId) throw swipelimeError('cancelPayment method need valid paymentId');

		return this._client.callMethod<[string, DataIdType, string], void>(`api/v${this._client.apiVersion}/cancelPayment`, this._tenantId, tableIdData, paymentId);
	}
}
