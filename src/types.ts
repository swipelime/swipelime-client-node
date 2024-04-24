// Copyright 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import TaskEvent from './models/TaskEvent';
import TaskCommand from './models/TaskCommand';

export type Environment = 'live-eu' | 'canary' | 'test' | 'dev';

export type AuthParams =
{
	username: string;
	password: string;
};

export type ClientOptions =
{
	environment?: Environment;
	reconnectInterval?: number;
};

export type DDPLoginParams =
{
	password: string;
	user: { username: string };
};

export type User =
{
	id: string;
	token: string;
	tokenExpires: Date,
	type: 'password' | 'resume';
};

export type ClientEventTypes =
{
	connected: [];
	disconnected: [];
	error: [e: Error];
	login: [user: User];
	logout: [];
};

export type ServiceHandlerEventTypes =
{
	newTasks: [tasks: (TaskEvent | TaskCommand)[]];
};

export type ServiceHandlerOptions =
{
	tenantId: string;
};

export type PingResponse = 'pong';

export type apiV1EventTestData = {
	test: 'test';
};

export enum TaskType
{
	'event' = 1,
	'command' = 2
};

export enum TaskStatus {
	'added' = 1,
	'processing' = 2,
	'processed' = 3,
	'failed' = 4,
	'refused' = 5
}

export type IncomingTaskData = {
	_id: string;
	taskType: TaskType;
	status: TaskStatus;
	data: TaskEventData | TaskCommandData;
	dateCreated: Date;
	dateLastRun: Date | undefined;
	retries: number | undefined;
}

export type CommandType = 'test';

export type TestCommandData = {
	test: 'test';
};

export type TaskCommandData = {
	commandType: CommandType;
};

export type EventType = 'test' | 'customer-joined-table' | 'order-placed';

export type TestEventData = {
	test: 'test';
};

export type TaskEventData = {
	eventType: EventType;
	eventData: TestEventData;
};
