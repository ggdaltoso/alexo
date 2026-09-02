/**
 * Configuração e caminhos do backend.
 *
 * Este arquivo é requerido antes de tudo (ver server.js) porque carrega o .env:
 * módulos como o musicPlayer e o nfcReader leem process.env já na hora do
 * require, então quem chegar antes do dotenv pega os defaults e não o que está
 * no .env da raiz.
 *
 * Os caminhos moram aqui, e não em cada módulo, porque `data/` e `uploads/`
 * ficam na RAIZ do backend enquanto o código que os usa mora em lib/ e
 * routes/. Com `__dirname` espalhado, mover um arquivo de pasta silenciosamente
 * apontaria para `lib/data/` -- e no Pi isso não daria erro, só criaria uma
 * segunda galeria vazia ao lado da de verdade.
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
