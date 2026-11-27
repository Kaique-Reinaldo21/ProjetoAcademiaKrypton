import { diagnosticarInicializacao } from '../lib/diagnostico-inicializacao.js';
import { ErroProfissional } from '../services/perfis-profissionais.service.js';

export function responder(operacao, sucesso = 200) {
  return async (req, res) => {
    try {
      return res.status(sucesso).json(await operacao(req.usuario, req.body ?? {}, req.params, req.query));
    } catch (erro) {
      if (erro instanceof ErroProfissional) return res.status(erro.status).json({ erro: erro.message });
      if (erro.code === 'P2002' || erro.code === 'P2034') {
        return res.status(409).json({ erro: 'Registro ou horário indisponível. Confira os dados e tente novamente.' });
      }
      console.error('Operação profissional indisponível:', diagnosticarInicializacao(erro));
      return res.status(500).json({ erro: 'Não foi possível concluir a operação.' });
    }
  };
}
