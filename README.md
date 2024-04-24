# swipelime-client-node

[![License: MIT](https://img.shields.io/badge/license-MIT-blueviolet.svg)](https://github.com/swipelime/swipelime-client-node/blob/main/LICENSE)

Official Node.js Client Library for swipelime.

See the [API documentation][api-docs] for more information and example usage.

## Getting the API credentials

To use the package, you'll need to have API credentials. To get an API account,
[please contact us][contact-us].

## Installation

`npm i swipelime-client-node`

### Requirements

The package officially supports Node.js version 20 an above.

## Usage

Import the package and construct a `Client`. The first argument is an object of your API credentials.
With the second argument you can specify the environment you will connect to.
You'll need to add a `ServiceHandler` to the client to handle the tenant.

Be careful not to expose your credentials, for example when sharing source code.

An example using `async`/`await` and ES Modules:

```javascript
import { Client } from 'swipelime-client-node';

const username = 'insert-your-username-here';
const password = 'insert-your-password-here';
const client = new Client({ username, password }, { environment: 'test' });

(async () => {
    const serviceHandler = await client.addServiceHandler({ tenantId: 'insert-tenant-id-here' });
})();
```

This example is for demonstration purposes only. In production code, the
API credentials should NOT be hard-coded, but instead fetched from a
configuration file or environment variable.

You will need to add listeners to get the events or commands to process
The `newTasks` event will be called when you receive new tasks from the swipelime API.
The `tasks` is an array containing `TaskEvent` and/or `TaskCommand` objects.

```javascript
serviceHandler.emitter.on('newTasks', (tasks) =>
{
	tasks.forEach(async (task) =>
	{
		// Process the task here
	});
})
```

You will receive `TaskEvent` task when the swipelime API is reporting that
something has happened in the system.
You can check the data for useful information and react to it in your system.
After you done processing it you will need to confirm it with the confirm function.

```javascript
if(task instanceof TaskEvent)
{
	// Test event
	if(task.data.eventType === 'test')
	{
		console.log('test event has arrived');
	}

	await task.confirm();

	console.log('test event has been confirmed');
}
```

You will receive `TaskCommand` task when the swipelime API is requesting data from your system.
You will need to gather the data and call the matching function for the command type.
For example if you receive the `test` command you will need to call `serviceHandler.confirmTestCommand`.
You do not need to confirm the `TaskCommand` because calling the function will automatically does it for you.

```javascript
else if(task instanceof TaskCommand)
{
	// Test command
	if(task.data.commandType === 'test')
	{
		console.log('test command has arrived');

		await serviceHandler.confirmTestCommand(task);

		console.log('test command has been confirmed');
	}
}
```

You have the option to just refuse to give us the information when you receive the command.
This is possible by calling the `task.refuse` function.
It is also a good idea to refuse any unknown or not implemented commands so it don't fill up the queue.

```javascript
else
{
	task.refuse();
}
```

## Example project

You can find an [example typescript project here](https://github.com/swipelime/swipelime-client-node/blob/main/examples/typescript/), which demonstrates the usage of swipelime client.

[api-docs]: https://docs.swipelime.com/api
[issues]: https://github.com/swipelime/swipelime-client-node/issues
[contact-us]: https://swipelime.com
