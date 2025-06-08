const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../db/database.sqlite'),
  logging: false
});

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to SQLite database');
    await sequelize.sync();
    console.log('Database synchronized');
  } catch (error) {
    console.error('Database connection error:', error);
  }
};

module.exports = { sequelize, initDatabase };