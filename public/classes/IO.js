// for handling data to and from server
export class IO {
  token = '';
  types = {command: '/public/server.php', player: '/?player'};

  setToken(token) {
    this.token = token;
  }

  async fetchJson(type, json) {
    json.token = this.token;

    const response = await fetch(this.types[type], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json),
    });

    return await response.json();
  }
}
