export class ErroGatewayCheckout extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.name = 'ErroGatewayCheckout';
    this.codigo = codigo;
  }
}

export function classificarErroCriacao(erro) {
  const mensagem = typeof erro?.message === 'string' ? erro.message : '';
  if (/both payer and collector must be real or test users/i.test(mensagem)) {
    return new ErroGatewayCheckout('ambiente_pagador_incompativel', 'O pagamento está indisponível por uma configuração da academia. Entre em contato com o suporte.');
  }
  if ([401, 403].includes(erro?.status)) {
    return new ErroGatewayCheckout('credencial_recusada', 'O pagamento está indisponível por uma configuração da academia. Entre em contato com o suporte.');
  }
  if (erro?.status === 400) {
    return new ErroGatewayCheckout('requisicao_recusada', 'O provedor recusou o início do pagamento. Entre em contato com o suporte antes de tentar novamente.');
  }
  return new ErroGatewayCheckout('gateway_indisponivel', 'Não foi possível conectar ao provedor de pagamento. Entre em contato com o suporte antes de tentar novamente.');
}
