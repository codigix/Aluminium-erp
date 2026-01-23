const app = require('./src/app');

// Mock request and response
const req = {
  method: 'POST',
  url: '/api/auth/login',
  headers: {
    'content-type': 'application/json'
  },
  body: { email: 'test@example.com', password: 'password' },
  on: () => {},
  pipe: () => {}
};

const res = {
  statusCode: 200,
  setHeader: (name, value) => {
    console.log(`Header: ${name}=${value}`);
  },
  end: (chunk) => {
    console.log('Response End');
    if (chunk) {
      console.log('Data:', chunk.toString());
    }
    console.log('Status:', res.statusCode);
    process.exit(0);
  },
  status: function(s) {
    this.statusCode = s;
    return this;
  },
  json: function(j) {
    console.log('JSON:', JSON.stringify(j));
    this.end(JSON.stringify(j));
  }
};

console.log('Simulating POST /api/auth/login...');
app.handle(req, res);
