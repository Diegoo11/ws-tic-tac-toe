import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import 'dotenv/config';
import './db/db.js';
import './db/models/User.js';
import './db/models/Table.js';
import Game from './db/models/Game.js';
import isWinner from './utils/isWinner.js';

const { PORT } = process.env;
const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

io.on('connection', async (socket) => {
  socket.on('conectGame', async (ctx) => {
    const { gameId } = ctx;
    let game;
    console.log(gameId);
    try {
      game = await Game.findById(gameId).populate('player1 player2 table');
    } catch (err) {
      return console.error(err.message);
    }
    console.log(game);
    if (!game) return console.error('Corrupt game');

    const player1 = {
      name: game.player1.username,
      id: game.player1._id,
      image: game.player1.imgSrc,
    };

    const player2 = {
      name: game?.player2?.username,
      id: game?.player2?._id,
      image: game?.player2?.imgSrc,
    };
    socket.join(gameId);
    console.log('joinPlayer', game);
    io.to(gameId).emit('joinPlayer', { player1, player2, table: game.table });
    console.log(socket.id, 'Se conecto a la sala');
  });

  socket.on('playerPlayed', async (context) => {
    const { gameId, play, userId } = context;

    if (!userId) return;
    let game;
    try {
      game = await Game.findById(gameId).populate('table');
    } catch (err) {
      return console.error(err.message);
    }

    if (!game) return console.error({ error: 'Corrupt game' });

    if (game.player1 != userId
      && game.player2 != userId) return console.error({ error: 'Invalid action' });

    const ico = game.player1 == userId ? 1 : 2;
    const { table } = game;

    if (ico !== table.status) return console.error({ error: 'Invalid action' });

    if (table[`p_${play}`] !== 0) return console.error({ error: 'Invalid action' });
    table[`p_${play}`] = ico;
    table.status = ico === 1 ? 2 : 1;

    const winner = isWinner(table);
    if (winner) {
      table.winner = winner;
    }

    try {
      await table.save();
    } catch (err) {
      return console.error(err.message);
    }

    io.to(gameId).emit('played', { table });
  });

  socket.on('reset', async (context) => {
    const { gameId, userId } = context;

    if (!userId) return;

    let game;
    try {
      game = await Game.findById(gameId).populate('table');
    } catch (err) {
      return;
    }

    if (
      game.player1 != userId
      && game.player2 != userId
    ) return;

    const { table } = game;

    table.p_0 = 0;
    table.p_1 = 0;
    table.p_2 = 0;
    table.p_3 = 0;
    table.p_4 = 0;
    table.p_5 = 0;
    table.p_6 = 0;
    table.p_7 = 0;
    table.p_8 = 0;
    table.status = 1;
    table.winner = 0;

    try {
      await table.save();
      return io.to(gameId).emit('played', { table });
    } catch (err) {
      console.log(err.message);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Example app listening  http://localhost:${PORT}`);
});
