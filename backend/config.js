/**
 * Configuração e caminhos do backend.
 *
 * Requerido antes de tudo (ver server.js): é quem carrega o .env, e o
 * musicPlayer e o nfcReader leem process.env já no require.
 *
 * Os caminhos moram aqui porque `data/` e `uploads/` ficam na RAIZ do backend e
 * o código que os usa, não. Com `__dirname` espalhado, mover um arquivo de
 * pasta passaria a apontar para `lib/data/` sem dar erro nenhum.
 */
const path = require('path');

const RAIZ = __dirname;

require('dotenv').config({ path: path.join(RAIZ, '..', '.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  PORT: process.env.PORT || 3001,
  NODE_ENV,
  ehProducao: NODE_ENV === 'production',

  RAIZ,
  DATA_DIR: path.join(RAIZ, 'data'),
  UPLOADS_DIR: path.join(RAIZ, 'uploads'),
  GALERIA_DIR: path.join(RAIZ, 'uploads', 'gallery'),
  MUSICA_DIR: path.join(RAIZ, 'uploads', 'music'),
  PRINTS_DIR: path.join(RAIZ, 'uploads', 'prints'),
  SCRIPTS_DIR: path.join(RAIZ, 'scripts'),
  PUBLIC_ADMIN_DIR: path.join(RAIZ, 'public', 'admin'),
  FRONTEND_DIST: path.join(RAIZ, '..', 'frontend', 'dist'),
};
