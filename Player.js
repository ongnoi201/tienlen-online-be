class Player {
  constructor(id, socket, name = null) {
    this.id = id;
    this.socket = socket;
    this.hand = [];
    this.isReady = false;
    this.roomId = null;
    this.name = name;
  }

  send(event, data) {
    this.socket.emit(event, data);
  }
}

module.exports = Player;
