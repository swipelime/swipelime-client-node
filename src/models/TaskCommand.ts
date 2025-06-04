// Copyright (c) 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import Task from './Task';
import { ServiceHandler } from '../ServiceHandler';
import {
	TaskType,
	TaskCommandDataList
} from '../types';

export default class TaskCommand extends Task
{
	public readonly data: TaskCommandDataList;
	public readonly taskType: TaskType = TaskType.command;

	constructor(doc: any, serviceHandler: ServiceHandler, timestampReceived: number)
	{
		super(doc, serviceHandler, timestampReceived);

		this.data = doc.data as TaskCommandDataList;
	}

	/**
	 * Refuses the task event.
	*/
	public async refuse(): Promise<void>
	{
		return this._serviceHandler.refuseTasks([this]);
	}
}
