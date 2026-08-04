import fs from 'fs';
import path from 'path';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

export class FileManager {
  public = 'public';
  datapath = '_data/';

  constructor(tickManager) {
    this.tickManager = tickManager;
    this.root = this.public;
  }

  /**
   * Serves a static file (html, css, jpg etc..) from the public folder
   * any values in params are used to replace matching {{key}} in the text
   * @param {*} request 
   * @param {*} result 
   * @param {*} params 
   */
  handle(request, result, params) {
    const url = request.url.split('?')[0];
    const filePath = path.join(this.root, url === '/' ? 'index.html' : url);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
      if (err) { result.writeHead(404); result.end(); return; }
      result.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      const content = ['.html', '.js'].includes(ext) ? this.#replaceParams(data.toString(), params) : data;
      result.end(content);
    });
  }

  #replaceParams(content, params) {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? '');
  }

  /**
   * Returns the json object from the data folder
   * @param {string} filename 
   * @returns {object}
   */
  loadJson(filename) {
   const filepath = `${this.datapath}${filename}.json`;
   if (!fs.existsSync(filepath)) return {};
    // console.log(`loadJson ${filepath}`);
    return JSON.parse(fs.readFileSync(filepath, `utf8`));
  }

  /**
   * Write a json file to disk in the data folder
   * @param {string} filename 
   * @param {object} json 
   */
  saveJson(filename, json) {
    const filepath = `${this.datapath}${filename}.json`;
    // console.log(`saveJson ${filepath}`);
    fs.writeFileSync(filepath, JSON.stringify(json, null, 2), `utf8`);
  }

}
