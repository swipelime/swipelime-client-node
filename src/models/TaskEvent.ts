// Copyright 2024 swipelime (https://swipelime.com)
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

	constructor(doc: any, serviceHandler: ServiceHandler)
	{
		super(doc, serviceHandler);

		this.data = doc.data as TaskEventDataList;
	}

	/**
	* Confirms the task event.
	*/
	public async confirm(): Promise<boolean>
	{
		return this._serviceHandler.confirmTaskEvent(this);
	}
}
