// Copyright 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import extend from 'lodash/extend';
import { ServiceHandler } from '../ServiceHandler';
import {
	TaskType,
	TaskStatus
} from '../types';

export default abstract class Task
{
	protected readonly _serviceHandler: ServiceHandler;
	protected readonly _id: string;
	protected readonly taskType: TaskType;
	protected readonly data: Record<string, any>;
	public readonly status: TaskStatus;
	public readonly dateCreated: Date;
	public readonly dateLastRun: Date | undefined;
	public readonly retries: number | undefined;
	public readonly timestampReceived: number;

	public get id(): string
	{
		return this._id;
	}

	constructor(doc: any, serviceHandler: ServiceHandler, timestampReceived: number)
	{
		extend(this, doc);

		this._serviceHandler = serviceHandler;
		this.timestampReceived = timestampReceived;
	}
}
