import { Client, TaskCommand, TaskEvent, Environment } from 'swipelime-client-node';
import 'dotenv/config';

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
 }); 

const username = process.env['SWIPELIME_USERNAME'];
const password = process.env['SWIPELIME_PASSWORD'];
const environment = process.env['SWIPELIME_ENVIRONMENT'] as Environment | undefined;
const tenantId = process.env['SWIPELIME_TENANT_ID'];

if (username === undefined || password === undefined) throw new Error('SWIPELIME_USERNAME or SWIPELIME_PASSWORD environment variable not defined');

// Register a client with the provided credentials and specify the environment like 'live-eu', 'canary' or 'test'
const client = new Client({ username, password }, { environment });

(async () =>
{
	try {
		// Fired when the client successfully connects to swipelime
		client.emitter.on('connected', async () =>
		{
			console.log('swipelime client connected');
		});

		// Fired when the client successfully logs in
		client.emitter.on('login', async (user) =>
		{
			console.log('logged in user ID', user.id);

			// You can get the available tenants for the logged in user
			const availableTenants = await client.getAvailableTenantIds();

			console.log('available tenants', availableTenants);
		});

		client.emitter.on('error', (e) =>
		{
			console.error('error', e.message);
		});

		if(!tenantId) throw new Error('SWIPELIME_TENANT_ID environment variable not defined');

		// Register a service handler for one of the available tenants
		const serviceHandler = await client.addServiceHandler({ tenantId });

		// Listen for new tasks and process them
		serviceHandler.emitter.on('newTasks', (tasks) =>
		{
			tasks.forEach(async (task) =>
			{
				if(task instanceof TaskEvent)
				{
					// Test event
					if(task.data.eventType === 'test')
					{
						console.log('test event', task.data.eventData);
						// Do any processing here if needed
					}
					else
					{
						console.log(JSON.stringify(task, null, 2));
					}

					// Need to confirm all events to prevent them from being sent again
					// Only confirm the event as done if it has been processed
					await task.confirm();
				}
				else if(task instanceof TaskCommand)
				{
					// Test command
					if(task.data.commandType === 'test')
					{
						console.log('test command has arrived');

						// Need to call the matching function for the command which is confirmTestCommand in this case
						// This will confirm the command
						await serviceHandler.confirmTestCommand(task);

						// You can also refuse the command by calling the refuse function
						// task.refuse();

						console.log('test command has been confirmed');
					}
					else
					{
						// It's a good idea to refuse any unknown or not implemented commands so it don't fill up the queue
						task.refuse();
					}
				}
				else console.error('unknown task type', task);
			});
		});
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
