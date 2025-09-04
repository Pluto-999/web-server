import * as net from "net"

type TCPConn = {
    socket: net.Socket
    // if we have a reader object, it stores the resolve/reject functions for the currently pending soRead Promise
    reader: null|{
        resolve: (value: Buffer) => void,
        reject: (reason: Error) => void,
    }
    // "error" event
    error: null|Error
    // EOF - "end" event
    ended: boolean
}

// attach the socket listeners and initialise our connection -- after this we enter the loop in serveClient
function soInit(socket: net.Socket): TCPConn {
    const conn: TCPConn = {
        socket: socket, reader: null, error: null, ended: false
    }
    
    // when the socket emits "data" while in the loop, the callbacks stored in TCPConn are used to complete the promise
    socket.on("data", (data: Buffer) => {
        console.assert(conn.reader)
        conn.socket.pause() // pause the data, as we want only one chunk of data at a time
        conn.reader!.resolve(data) // fulfill the promise set up in soRead
        conn.reader = null
    })

    socket.on("end", () => {
        conn.ended = true
        if (conn.reader) {
            conn.reader.resolve(Buffer.from("")) // EOF
            conn.reader = null
        }
    })

    socket.on("error", (error: Error) => {
        conn.error = error
        if (conn.reader) {
            conn.reader.reject(error)
            conn.reader = null
        }
    })

    return conn
}

// promise is resolved with the data event and end event (EOF - End Of File)
function soRead(conn: TCPConn): Promise<Buffer> {
    console.assert(!conn.reader)
    // promise will stay pending until the network event happens
    return new Promise((resolve, reject) => {
        if (conn.error) {
            reject(conn.error)
            return
        }
        if (conn.ended) {
            resolve(Buffer.from(""))
            return
        }
        conn.reader = {resolve: resolve, reject: reject}
        conn.socket.resume() // resume the data event, to allow the socket to emit a "data" event 
        // when the "data" event is emitted, the "data" listener from soInit will resolve it
    })
}


function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
    console.assert(data.length > 0)
    
    return new Promise((resolve, reject) => {
        if (conn.error) {
            reject(conn.error)
            return
        }
        conn.socket.write(data, (error?: Error | null) => {
            if (error) {
                reject(error)
            }
            else {
                resolve()
            }
        })
    })
}


// the actual echo server
async function serveClient(socket: net.Socket): Promise<void> {
    const conn: TCPConn = soInit(socket)
    while (true) {
        const data = await soRead(conn)
        if (data.length === 0) {
            console.log("end connection")
            break
        }

        console.log("data", data)
        await soWrite(conn, data) // echo back "abc"
    }
}


// handler for new connections using this promise-based API
async function newConn(socket: net.Socket): Promise<void> {
    console.log("new connection", socket.remoteAddress, socket.remotePort)
    try {
        await serveClient(socket)
    }
    catch (error) {
        console.error("error:", error)
    }
    finally {
        socket.destroy()
    }
}

const server = net.createServer({
    pauseOnConnect: true
})

server.on("connection", (socket) => {
    newConn(socket)
})

server.on("error", (error) => {
    console.error("server error: ", error)
})

const PORT = 8000
server.listen(PORT, () => {
    console.log(`echo server listening on port ${PORT}`)
})

// to run: npx ts-node echo-server-promises.ts
// then in second terminal: nc 127.0.0.1 8000