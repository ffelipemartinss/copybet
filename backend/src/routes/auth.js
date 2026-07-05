const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { cadastroSchema, loginSchema, validar } = require('../lib/validacao');

const router = express.Router();

// POST /api/auth/cadastro
router.post('/cadastro', async (req, res) => {
  try {
    const { dados, erros } = validar(cadastroSchema, req.body);
    if (erros) return res.status(400).json({ erro: erros[0], erros });

    const { nome, email, senha, role, analista_id_afiliado } = dados;

    const emailExiste = await prisma.user.findUnique({ where: { email } });
    if (emailExiste) {
      return res.status(400).json({ erro: 'Email ja cadastrado' });
    }

    if (analista_id_afiliado) {
      const analistaIndicador = await prisma.analista.findUnique({ where: { id: analista_id_afiliado } });
      if (!analistaIndicador) {
        return res.status(400).json({ erro: 'Codigo de indicacao invalido' });
      }
    }

    const senha_hash = await bcrypt.hash(senha, 10);
    const roleValido = role === 'ANALISTA' ? 'ANALISTA' : 'SEGUIDOR';
    const indicado_por = analista_id_afiliado ? 'ANALISTA' : 'COPYBET';

    const user = await prisma.user.create({
      data: {
        nome,
        email,
        senha_hash,
        role: roleValido,
        indicado_por,
        analista_id_afiliado: analista_id_afiliado || null,
      },
    });

    // Criar perfil de analista ou seguidor automaticamente
    if (roleValido === 'ANALISTA') {
      await prisma.analista.create({ data: { user_id: user.id } });
    } else {
      await prisma.seguidor.create({
        data: {
          user_id: user.id,
          analista_id: analista_id_afiliado || null,
        },
      });
      await prisma.plano.create({ data: { user_id: user.id } });
    }

    const token = gerarToken(user);
    return res.status(201).json({ token, usuario: formatarUsuario(user) });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ erro: 'Email ja cadastrado' });
    }
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { dados, erros } = validar(loginSchema, req.body);
    if (erros) return res.status(400).json({ erro: erros[0], erros });

    const { email, senha } = dados;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ erro: 'Credenciais invalidas' });
    }

    const senhaCorreta = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Credenciais invalidas' });
    }

    const token = gerarToken(user);
    return res.json({ token, usuario: formatarUsuario(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/auth/me
const { autenticar } = require('../middleware/auth');
router.get('/me', autenticar, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.usuario.id },
      include: { analista: true, seguidor: true, plano: true },
    });
    if (!user) return res.status(404).json({ erro: 'Usuario nao encontrado' });
    return res.json({ usuario: formatarUsuario(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

function gerarToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function formatarUsuario(user) {
  const { senha_hash, ...resto } = user;
  return resto;
}

module.exports = router;
