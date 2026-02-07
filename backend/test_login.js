async function test() {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@company.com', password: 'Admin@123' })
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Data:', JSON.stringify(data, null, 2));
}
test();
