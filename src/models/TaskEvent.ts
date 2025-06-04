// Copyright (c) 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import Task from './Task';
import { ServiceHandler } from '../ServiceHandler';
import {
	TaskType,
	TaskEventDataList
} from '../types';

export default class TaskEvent extends Task
{
	public readonly data: TaskEventDataList;
	public readonly taskType: TaskType = TaskType.event;

	constructor(doc: any, serviceHandler: ServiceHandler, timestampReceived: number)
	{
		super(doc, serviceHandler, timestampReceived);

		this.data = doc.data as TaskEventDataList;
	}

	/**
	* Confirms the task event.
	*/
	public async confirm(): Promise<void>
	{
		return this._serviceHandler.confirmTaskEvent(this);
	}

	/**
	 * Refuses the task event.
	*/
	public async refuse(): Promise<void>
	{
		return this._serviceHandler.refuseTasks([this]);
	}
}
