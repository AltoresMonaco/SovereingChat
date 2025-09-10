const mongoose = require('mongoose');
const { createModels } = require('@librechat/data-schemas');
const models = createModels(mongoose);
const eventModels = require('./eventModels');

module.exports = { ...models, ...eventModels };
