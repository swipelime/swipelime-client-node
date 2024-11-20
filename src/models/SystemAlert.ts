// Copyright 2024 swipelime (https://swipelime.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import extend from 'lodash/extend';
import { ServiceHandler } from '../ServiceHandler';
import {
	TaskEventDataList
} from '../types';

export default class SystemAlert
{
	protected readonly _serviceHandler: ServiceHandler;
	public readonly data: TaskEventDataList;
	public readonly dateCreated: Date;

	constructor(doc: any, serviceHandler: ServiceHandler, dateCreated?: Date)
	{
		extend(this, doc);

		this._serviceHandler = serviceHandler;
		this.dateCreated = dateCreated ?? new Date();
	}
}
