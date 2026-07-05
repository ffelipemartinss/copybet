// Validação de payloads com zod.
// Regra de ouro: validação de segurança SEMPRE no servidor — o frontend só espelha.
const { z } = require('zod');

const emailSchema = z
  .string({ required_error: 'E-mail é obrigatório' })
  .trim()
  .toLowerCase()
  .email('E-mail inválido')
  .max(254, 'E-mail muito longo');

const senhaSchema = z
  .string({ required_error: 'Senha é obrigatória' })
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres'); // limite do bcrypt

const cadastroSchema = z.object({
  nome: z
    .string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: emailSchema,
  senha: senhaSchema,
  role: z.enum(['SEGUIDOR', 'ANALISTA']).optional().default('SEGUIDOR'),
  analista_id_afiliado: z.string().trim().min(1).max(64).optional().nullable(),
});

const loginSchema = z.object({
  email: emailSchema,
  senha: z.string({ required_error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória'),
});

// Valida req.body com o schema. Retorna { dados } em sucesso
// ou { erros } (array de mensagens legíveis) em falha.
function validar(schema, body) {
  const resultado = schema.safeParse(body);
  if (resultado.success) return { dados: resultado.data };
  const erros = resultado.error.issues.map((i) => i.message);
  return { erros };
}

module.exports = { cadastroSchema, loginSchema, validar };
