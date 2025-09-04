// This is a TCP server that reads data from clients and writes the same data back

import * as net from "net"

function newConnection(socket) {
    console.log("new connection", socket.remoteAddress, socket.remotePort)

    // end event in invoked when the peer has ended the transmission
    socket.on("end", () => {
        console.log("FIN received, connection closed automatically")
    })

    // data event is invoked whenever data arrives from the peer
    socket.on("data", (data) => {
        console.log("data", data)
        socket.write(data) // write back the same data

        // for testing, actively close the connection if the data contains "q"
        if (data.includes('q')) {
            console.log("Closing as data contains q")
            socket.end() // manually sending FIN to close the connection
        }
    })
} 

// Create a listening socket of type net.Server.net.Server (sockets are represented as JS objects)
let server = net.createServer()

// registering the callback function newConnection, which is invoked when there is a connection
server.on("connection", newConnection) 

server.on("error", (error) => {throw error})

server.listen({host: "127.0.0.1", port: 1234})

