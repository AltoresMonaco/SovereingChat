const request = require('supertest');
const express = require('express');
jest.mock('~/cache/getLogStores');

const eventRoute = require('../../event');

describe('Event routes (smoke)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/event', eventRoute);

  beforeAll(() => {
    process.env.EVENT_ACTIVATION_TTL_DAYS = '14';
    process.env.EVENT_STAMP_TTL_HOURS = '72';
    process.env.EVENT_QR_DYNAMIC_TTL_SECONDS = '120';
  });

  it('POST /event/lead validates required fields', async () => {
    const res = await request(app).post('/api/event/lead').send({});
    expect(res.status).toBe(400);
  });

  it('GET /event/activation/:token returns error for invalid token', async () => {
    const res = await request(app).get('/api/event/activation/bad-token');
    expect([400, 404]).toContain(res.status);
  });
});


