import React from 'react';
import { createRoot } from 'react-dom/client';
import { Client } from 'boardgame.io/react';
import { CrownAndFealty } from './game/game.js';
import { Board } from './ui/Board.jsx';
import { CONFIG } from './config.js';

// Local hotseat: one client, all seats, debug panel ON.
// Use the debug panel (right edge) to switch which seat you act as, inspect
// state, and manually fire events while you tune the game.
const App = Client({
  game: CrownAndFealty,
  board: Board,
  numPlayers: CONFIG.defaultPlayers,
  debug: true,
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
