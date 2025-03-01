const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map();

wss.on('connection', (ws) => {
    console.log('New connection established');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log('Received message:', data);

        if (data.type === 'join') {
            const { meeting_id, role } = data;
            console.log(`Client joining meeting ${meeting_id} as ${role}`);

            // Store the client information
            clients.set(ws, { meeting_id, role });

            // Notify other clients in the same meeting
            clients.forEach((client, clientWs) => {
                if (client.meeting_id === meeting_id && clientWs !== ws) {
                    clientWs.send(JSON.stringify({ type: 'peer_joined', peerRole: role }));
                }
            });
        } else if (data.type === 'video') {
            // Relay video stream data to the other participant
            const { meeting_id } = data;
            clients.forEach((client, clientWs) => {
                if (client.meeting_id === meeting_id && clientWs !== ws) {
                    clientWs.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('Connection closed');
        clients.delete(ws);
    });
});