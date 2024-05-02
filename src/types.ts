// Copyright 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import TaskEvent from './models/TaskEvent';
import TaskCommand from './models/TaskCommand';

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
export type AllLanguage = typeof allLanguages[number];

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
 * The event types for the service handler.
 */
export type ServiceHandlerEventTypes =
{
	newTasks: [tasks: (TaskEvent | TaskCommand)[]];
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
export type IdData = {
	id: string;
	externalIds: Record<string, string>;
};

/**
 * The options for specifying an ID.
 * You can either use the ID or the external ID but at least one must be specified.
 */
export type IdOption = { id?: string; externalId?: string };

/**
 * The data for an incoming task.
 */
export type IncomingTaskData = {
	_id: string;
	taskType: TaskType;
	status: TaskStatus;
	data: TaskEventDataList | TaskCommandData;
	dateCreated: Date;
	dateLastRun: Date | undefined;
	retries: number | undefined;
};

/**
 * The available command types.
 */
export const commandTypes = ['test'] as const;

/**
 * The types of commands.
 */
export type CommandTypes = typeof eventTypes[number];

/**
 * The data for a task command.
 */
export type TaskCommandData = {
	commandType: CommandTypes;
};

/**
 * The base data for a task command.
 */
export type TaskCommandDataBase = {
	commandType: CommandTypes;
	commandData?: Record<string, any>;
};

/**
 * The data for a test command.
 */
export interface TestCommandData extends TaskCommandDataBase {
	eventType: 'test';
};

/**
 * The list of task command data.
 */
export type TaskCommandDataList = TaskCommandData;

/**
 * The data for order items.
 */
export type OrderItemsEventData = {
	orderItemId: string;
	customerId: string;
	menuItemData: IdData;
	menuData?: IdData;
	variantData?: IdData;
	selectablesData?: IdData[];
	quantity: number;
	additionalRequests?: string;
};

/**
 * The data for an order.
 */
export type OrderEventData = {
	tableData: IdData;
	orderItems: OrderItemsEventData[];
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
	'payment-requested',
	'payment-request-cancelled'
] as const;

/**
 * The types of events.
 */
export type EventTypes = typeof eventTypes[number];

/**
 * The base data for a task event.
 */
export type TaskEventDataBase = {
	eventType: EventTypes;
	eventData: Record<string, any>;
};

/**
 * The data for a test event.
 */
export interface TestEventData extends TaskEventDataBase {
	eventType: 'test';
	eventData: { test: 'test' };
};

/**
 * The data for a customer joined table event.
 */
export interface CustomerJoinedTableEventData extends TaskEventDataBase {
	eventType: 'customer-joined-table';
	eventData: {
		id: string;
		name: string;
		language: AllLanguage;
	};
};

/**
 * The data for order items added, confirmed, or cancelled events.
 */
export interface OrderItemsAddedEventData extends TaskEventDataBase {
	eventType: 'order-items-added' | 'order-items-confirmed' | 'order-items-cancelled';
	eventData: OrderEventData;
};

/**
 * The data for a payment requested event.
 */
export interface PaymentRequestedEventData extends TaskEventDataBase {
	eventType: 'payment-requested';
	eventData: {
		tableData: IdData;
		paymentType: typeof PaymentTypes;
	};
};

/**
 * The list of task event data.
 */
export type TaskEventDataList = TestEventData | CustomerJoinedTableEventData | OrderItemsAddedEventData | PaymentRequestedEventData;