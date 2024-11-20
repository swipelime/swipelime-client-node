// Copyright 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import TaskEvent from './models/TaskEvent';
import TaskCommand from './models/TaskCommand';
import SystemAlert from './models/SystemAlert';

/**
 * @fileoverview This file contains various types and variables used in the application.
 * @module types
 */

/**
 * The environment options for the client.
 */
export type Environment = 'live-eu' | 'canary' | 'test' | 'dev';

/**
 * An array of all supported languages.
 */
export const allLanguages = [
	'en',
	'ar',
	'bg',
	'cs',
	'da',
	'de',
	'el',
	'es',
	'et',
	'fi',
	'fr',
	'hu',
	'id',
	'it',
	'ja',
	'ko',
	'lt',
	'lv',
	'nb',
	'nl',
	'pl',
	'pt',
	'ro',
	'ru',
	'sk',
	'sl',
	'sv',
	'tr',
	'uk',
	'zh'
] as const;

/**
 * A union type of all supported languages.
 */
export type AllLanguages = typeof allLanguages[number];

export type LangType =
{
	[key in AllLanguages ]?: string;
};

/**
 * An array of all supported payment types.
 */
export const allPaymentTypes = [
	'cash',
	'card',
	'external' // External payment type is used when the payment is handled by an external payment gateway like Stripe
] as const;

/**
 * A union type of all supported payment types.
 */
export type AllPaymentTypes = typeof allPaymentTypes[number];

/**
 * The authentication parameters.
 */
export type AuthParams = {
	username: string;
	password: string;
};

/**
 * The options for the client.
 */
export type ClientOptions = {
	environment?: Environment;
	reconnectInterval?: number;
};

/**
 * The login parameters for DDP (Distributed Data Protocol) login.
 */
export type DDPLoginParams = {
	password: string;
	user: { username: string };
};

/**
 * The user object containing user information.
 */
export type User = {
	id: string;
	token: string;
	tokenExpires: Date;
	type: 'password' | 'resume';
};

/**
 * The event types for the client.
 */
export type ClientEventTypes = {
	connected: [];
	disconnected: [];
	error: [e: Error];
	login: [user: User];
	logout: [];
};

/**
 * The base data for a system alert.
 */
export type SystemAlertDataBase = {
	systemAlertType: SystemAlertTypes;
} & Record<string, any>;

/**
 * Long running tasks that need to be checked.
 * @systemAlertType The type of system alert.
 * @tasks The tasks that need to be checked.
 */
export interface LongRunningTasks extends SystemAlertDataBase {
	systemAlertType: 'long-running-tasks';
	tasks: (TaskEvent | TaskCommand)[];
}

export type SystemAlertDataList = LongRunningTasks;
/**
 * The event types for the service handler.
 */
export type ServiceHandlerEventTypes =
{
	newTasks: [tasks: (TaskEvent | TaskCommand)[]];
	systemAlert: SystemAlert[];
};

/**
 * The options for the service handler.
 */
export type ServiceHandlerOptions = {
	tenantId: string;
};

/**
 * The response for the ping request.
 */
export type PingResponse = 'pong';

/**
 * The test data for the API v1 event.
 */
export type apiV1EventTestData = {
	test: 'test';
};

/**
 * The types of system alerts.
 * @longRunningTasks - There are tasks that didn't finish in a reasonable time frame so they need to be checked.
 */
export enum SystemAlertType {
	'long-running-tasks' = 1
}

/**
 * The types of tasks.
 */
export enum TaskType {
	'event' = 1,
	'command' = 2
}

/**
 * The status of a task.
 */
export enum TaskStatus {
	'added' = 1,
	'processing' = 2,
	'processed' = 3,
	'failed' = 4,
	'refused' = 5
}

/**
 * The types of payment.
 */
export enum PaymentTypes {
	'card',
	'cash'
}

/**
 * The general ID data for an entity.
 */
export type ElementIdData = {
	id: string;
	externalId?: string;
};

/**
 * The ID data for a customer.
 * @id The unique ID of the customer.
 * @position The position of the customer. First customer that joined the table is 1, second is 2, etc.
 * If server placed the order the id will be "server" and position will be 0.
 */
export type CustomerData = {
	id: string;
	position: number;
};

/**
 * The options for specifying an ID.
 * You can either use the ID or the external ID but at least one must be specified.
 */
export type DataIdType = { id?: string; externalId?: string };

/**
 * The data for an incoming task.
 */
export type IncomingTaskData = {
	_id: string;
	taskType: TaskType;
	status: TaskStatus;
	data: TaskEventDataList | TaskCommandDataList;
	dateCreated: Date;
	dateLastRun: Date | undefined;
	retries: number | undefined;
};

/**
 * The available command types.
 */
export const commandTypes = ['test', 'confirm-universal-menu-elements'] as const;

/**
 * The types of commands.
 */
export type CommandTypes = typeof commandTypes[number];

/**
 * The base data for a task command.
 */
export type TaskCommandDataBase = {
	commandType: CommandTypes;
	commandData?: Record<string, any>;
	timestamp: string;
};

/**
 * The data for a test command.
 */
export interface TestCommandData extends TaskCommandDataBase {
	commandType: 'test';
}

/**
 * The data for confirm universal menu elements command.
 */
export interface ConfirmUniversalMenuElementsCommandData extends TaskCommandDataBase {
	commandType: 'confirm-universal-menu-elements';
	commandData: {
		elements: ElementIdData[];
		tableSessionId?: string;
	};
}

/**
 * The list of task command data.
 */
export type TaskCommandDataList = TestCommandData | ConfirmUniversalMenuElementsCommandData;

/**
 * The data for order items.
 */
export type OrderItemsData = {
	orderItemId: string;
	customerData: CustomerData;
	menuItemData: ElementIdData;
	menuData?: ElementIdData;
	variantData?: ElementIdData;
	selectablesData?: ElementIdData[];
	status: 'added' | 'pending' | 'confirmed' | 'cancelled' | 'unknown'
	quantity: number;
	additionalRequests?: string;
};

/**
 * The data for an order.
 */
export type OrderEventData = {
	tableData: ElementIdData;
	tableSessionData: ElementIdData;
	orderItems: OrderItemsData[];
};

/**
 * The available event types.
 */
export const eventTypes = [
	'test',
	'customer-joined-table',
	'order-items-added',
	'order-items-confirmed',
	'order-items-cancelled',
	'order-items-changed',
	'order-items-moved',
	'payment-requested',
	'payment-request-cancelled',
	'order-items-payment-requested',
	'order-items-payment-confirmed',
	'order-items-payment-cancelled',
	'universal-menu-elements-added',
	'universal-menu-elements-updated',
	'universal-menu-elements-removed',
	'tables-added',
	'tables-updated',
	'tables-removed'
] as const;

/**
 * The types of events.
 */
export type EventTypes = typeof eventTypes[number];

/**
 * The available system alert types.
 */
export const systemAlertTypes = [
	'long-running-tasks'
] as const;

/**
 * The types of system alerts.
 */
export type SystemAlertTypes = typeof systemAlertTypes[number];

/**
 * The base data for a task event.
 */
export type TaskEventDataBase = {
	eventType: EventTypes;
	eventData: Record<string, any>;
	timestamp: string;
};

/**
 * The data for a test event.
 */
export interface TestEventData extends TaskEventDataBase {
	eventType: 'test';
	eventData: { test: 'test' };
}

/**
 * The data for a customer joined table event.
 */
export interface CustomerJoinedTableEventData extends TaskEventDataBase {
	eventType: 'customer-joined-table';
	eventData: {
		id: string;
		name: string;
		language: AllLanguages;
	};
}

/**
 * The data for order items added, confirmed, cancelled or changed events.
 */
export interface OrderItemsChangedEventData extends TaskEventDataBase {
	eventType: 'order-items-added' | 'order-items-confirmed' | 'order-items-cancelled' | 'order-items-changed';
	eventData: OrderEventData;
}

/**
 * The data for order items moved event.
 */
export interface OrderItemsMovedEventData extends TaskEventDataBase {
	eventType: 'order-items-moved';
	eventData: {
		tableSessionData: ElementIdData;
		fromTableData: ElementIdData;
		toTableData: ElementIdData;
		orderItems: OrderItemsData[];
	};
}

/**
 * The data for a payment event.
 * @tableData The data for the table.
 * @tableSessionData The data for the table session.
 * @paymentId The ID of the payment.
 * @orderItems The order items that were paid.
 * @paymentType The type of payment.
 * @orderItemsPrice The price of the order items including service fee if there is any.
 * @tipPrice The tip amount.
 * @totalPrice The total price including the tip.
 */
export type PaymentEventData = {
	tableData: ElementIdData;
	tableSessionData: ElementIdData;
	paymentId: string;
	orderItems: OrderItemsData[];
	paymentType: AllPaymentTypes;
	orderItemsPrice: number;
	tipPrice: number;
	totalPrice: number;
	needReceipt: boolean;
};

/**
 * @deprecated payment-requested and payment-request-cancelled events are deprecated, use order-items-payment-requested, order-items-payment-confirmed and order-items-payment-cancelled events instead.
 * The data for the payment requested event.
 */
export interface PaymentRequestedEventData extends TaskEventDataBase {
	eventType: 'payment-requested' | 'payment-request-cancelled';
	eventData: {
		tableData: ElementIdData;
		paymentType: typeof PaymentTypes;
	};
}

/**
 * The data for a payment requested, confirmed or cancelled event.
 */
export interface PaymentsEventData extends TaskEventDataBase {
	eventType: 'order-items-payment-requested' | 'order-items-payment-confirmed' | 'order-items-payment-cancelled';
	eventData: PaymentEventData;
}

export interface UniversalMenuElementsEventData extends TaskEventDataBase {
	eventType: 'universal-menu-elements-added' | 'universal-menu-elements-updated' | 'universal-menu-elements-removed';
	eventData: (UniversalMenuItem | UniversalMenuCategory)[];
}

export interface TablesEventData extends TaskEventDataBase {
	eventType: 'tables-added' | 'tables-updated' | 'tables-removed';
	eventData: NativeTable[];
}

/**
 * The list of task event data.
 */
export type TaskEventDataList =
	TestEventData |
	CustomerJoinedTableEventData |
	OrderItemsChangedEventData |
	PaymentRequestedEventData |
	PaymentsEventData |
	UniversalMenuElementsEventData |
	TablesEventData |
	OrderItemsMovedEventData;

export type UniversalMenuItemData = {
	id: string;
	externalId?: string;
	enabled: boolean;
	label: LangType;
	internalName?: string;
	price: number;
	description?: LangType;
	longDescription?: LangType;
	created: string;
	updated: string;
};

export type UniversalMenuItem = {
	type: 'item',
	data: UniversalMenuItemData
};

export type UniversalMenuCategoryData = {
	id: string;
	externalId?: string;
	enabled: boolean;
	label: LangType;
	created?: string;
	updated?: string;
};

/**
 * Represents a universal menu category.
 */
export type UniversalMenuCategory = {
	type: 'category',
	data: UniversalMenuCategoryData
};

/**
 * Represents a native table.
 */
export type NativeTable = {
	id: string,
	externalId?: string,
	accessCode: string,
	label: LangType,
	created: string,
	updated: string
};

/**
 * Custom order item that can be added to a table
 * @orderItemId Optional ID of the ordered item that can be used to identify the order and update / delete it later - if not provided it will be randomly generated
 * @label The mandatory label of the order item - one of the supported languages must be provided
 * @price The price of the order item
 * @quantity The quantity of the order item
 * @additionalRequests Optional additional requests for the order item
 */
export type CustomOrderItem = {
	orderItemId?: string,
	label: LangType,
	price: number,
	quantity: number,
	additionalRequests?: string
};

export type UpsertUniversalMenuItemsReturn = {
	updated: number,
	new: number,
	noChanges: number,
	failed?: number,
	failedItems?: {
		error: string,
		item: Partial<UniversalMenuItemData>
	}[]
};

export type UpsertTablesReturn = {
	updated: number,
	new: number,
	noChanges: number,
	failed?: number,
	failedTables?: {
		error: string,
		table: Partial<NativeTable>
	}[]
};
