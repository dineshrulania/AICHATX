import socket from 'socket.io-client';


let socketInstance = null;
let activeProjectId = null;


export const initializeSocket = (projectId) => {

    if (socketInstance && activeProjectId === projectId) {
        return socketInstance;
    }

    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }

    socketInstance = socket(import.meta.env.VITE_API_URL, {
        auth: {
            token: localStorage.getItem('token')
        },
        query: {
            projectId
        }
    });

    activeProjectId = projectId;

    return socketInstance;

}

export const receiveMessage = (eventName, cb) => {
    if (!socketInstance) return () => {};
    socketInstance.on(eventName, cb);

    return () => {
        socketInstance?.off(eventName, cb);
    }
}

export const sendMessage = (eventName, data) => {
    socketInstance?.emit(eventName, data);
}

export const disconnectSocket = () => {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        activeProjectId = null;
    }
}