# language: pt
Funcionalidade: Checkout resiliente de pedidos
  Como a plataforma EntregasJá durante a Black Friday
  Quero processar pagamentos com tolerância a falhas
  Para proteger o servidor e dar respostas corretas ao cliente

  Contexto:
    Dado um pedido válido de R$ 100,00

  Cenário: Fluxo 1 - Pagamento aprovado (caminho feliz)
    Dado que o gateway responde "APROVADO"
    Quando o checkout é processado
    Então o pedido deve terminar com status "PROCESSADO"
    E o e-mail de confirmação deve ser enviado

  Cenário: Fluxo 2 - Pagamento recusado (falha de negócio)
    Dado que o gateway responde "RECUSADO"
    Quando o checkout é processado
    Então o pedido deve terminar com status "FALHOU"
    E o e-mail de confirmação não deve ser enviado

  Cenário: Fluxo 3 - Resiliência (recupera após uma retentativa)
    Dado que o gateway falha 1 vez por instabilidade e depois responde "APROVADO"
    Quando o checkout é processado
    Então o gateway deve ter sido chamado 2 vezes
    E o pedido deve terminar com status "PROCESSADO"
    E o e-mail de confirmação deve ser enviado

  Cenário: Timeout do gateway (não responde dentro do limite)
    Dado que o gateway sofre timeout em todas as tentativas
    Quando o checkout é processado
    Então o pedido deve terminar com status "ERRO_GATEWAY"
    E o e-mail de confirmação não deve ser enviado
    E nenhuma exceção deve ter derrubado o serviço

  Cenário: Fluxo 4 - Caos total (esgota as retentativas)
    Dado que o gateway está fora do ar permanentemente
    Quando o checkout é processado
    Então o gateway deve ter sido chamado 4 vezes
    E o pedido deve terminar com status "ERRO_GATEWAY"
    E o e-mail de confirmação não deve ser enviado
    E nenhuma exceção deve ter derrubado o serviço

  Cenário: Circuit breaker aberto curto-circuita a chamada externa
    Dado que o disjuntor já está aberto por excesso de falhas de rede
    Quando o checkout é processado
    Então o gateway não deve ser chamado
    E o pedido deve terminar com status "ERRO_GATEWAY"
