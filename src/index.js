import { server as WebSocketServer } from 'websocket'
import webpush from 'web-push'
import http from 'http'

const port = 8083
const clients = []

const server = http.createServer((request, response) => {
  console.log((`${new Date()} Received request for ${request.url}`))
  response.writeHead(404)
  response.end()
})

server.listen(port, () => {
  console.log(`${new Date()} Server is listening on port ${port}`)
})

const wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false,
})

const publicKey = 'BF9Z1MxVOTwhev-xOfGRQdDvXpU3k9VL5phJDyaedZEMN6nKot6ZXExtgl04uAXf--CKXOPOxHsSIKblbLyWF8M'
const privateKey = 'nPkZYBbReHxb2UXIEUdu69j17olf_Sv0KulUdXJojO0'

webpush.setVapidDetails(
  'mailto:no-reply@localhost',
  publicKey,
  privateKey
)

wsServer.on('request', request => {
  const connection = request.accept('echo-protocol', request.origin)

  connection.on('message', message => {
    if (message.type === 'utf8') {
      console.log(message)
      const client = clients.find(c => c.connection === connection)
      const data = JSON.parse(message.utf8Data)

      switch (data.command) {
        case 'subscribe':
          client.subscription = data.payload
          break
        case 'nickname':
          client.nickname = data.payload
          break
        case 'message':
          clients.forEach(c => {
            if (c.connection !== connection) {
              c.connection.sendUTF(JSON.stringify({
                nickname: client.nickname,
                message: data.payload,
              }))

              const payload = JSON.stringify({
                title: `${client.nickname} say`,
                body: data.payload,
              })

              if (c.subscription) {
                webpush.sendNotification(c.subscription, payload)
              }
            } else {
              c.connection.sendUTF(JSON.stringify({
                nickname: 'me',
                message: data.payload,
              }))
            }
          })
          break
        default:
          console.warn(`Unknown command ${data.command}`)
      }
    } else {
      console.log('Unknown type')
      console.log(message)
    }
  })

  connection.on('close', (_, description) => {
    const idx = clients.findIndex(c => c.connection === connection)
    const client = clients[idx]
    console.log(`${new Date()} Peer ${connection.remoteAddres} disconnected`)
    console.log(client.nickname, description)
    clients.splice(idx, 1)
  })

  clients.push({
    connection,
    subscription: null,
    nickname: null,
  })
})