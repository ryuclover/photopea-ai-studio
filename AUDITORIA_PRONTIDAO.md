# Auditoria de prontidão — 22/10/2026

## Veredito

**Ainda não considero o projeto 100% concluído como editor por IA que cumpre substituição, remoção e troca de cor.** A infraestrutura do fluxo gratuito está funcionando e ficou mais segura nesta auditoria. Os testes visuais ampliados, porém, mostraram duas falhas de fidelidade ao pedido. Uma nova geração paisagem e uma repetição de substituição ficaram bloqueadas pela cota da conta.

É possível fechar uma checklist finita de conclusão para esse projeto. A checklist precisa incluir o resultado solicitado, além da resposta da API, máscara e camada correta. Não é necessário prometer acerto em qualquer imagem imaginável; é necessário cumprir os cenários de aceite definidos e documentar os limites.

## O que foi executado

| Grupo | Resultado | Tipo de evidência |
| --- | --- | --- |
| Testes Node | 25 passaram | Testes automatizados, incluindo respostas e falhas simuladas |
| Processamento de imagem | 19 passaram | Canvas real no navegador |
| Integração básica Photopea | 7 passaram | Photopea real com fixture sintética |
| Ponte, troca de documento e tamanho | 9 passaram | Photopea real com dois documentos sintéticos |
| Lint e build | Passaram | Execução local |
| Interface de produção | Carregou; validou token com formato errado, captura fora do editor e cancelamento | Build estático servido localmente |
| Armazenamento indisponível | Interface carregou; salvar informou fallback para sessão; remover desativou a chave | Iframe real com sandbox de origem opaca e chave fictícia |
| Busca por credenciais incorporadas | Nenhuma correspondência encontrada em código, testes, scripts e README | Busca por padrões de tokens longos; não é auditoria completa de segredos |

A coleta final salvou os logs dos 19 testes de canvas, sete testes de integração e nove verificações de documentos. Em seguida, a automação do navegador travou durante uma repetição do teste de cancelamento no build estático e atingiu timeout. O cancelamento havia passado antes nesta rodada; essa última repetição após o ajuste da mensagem não foi concluída. Não há evidência suficiente para atribuir o travamento ao plugin em vez do navegador ou da automação.

São **60 verificações técnicas** nas quatro primeiras linhas. Não são 60 avaliações de qualidade visual, nem substituem as verificações de inferência abaixo.

## Inferências reais desta rodada

Todos os pedidos abaixo usaram apenas fixtures do projeto e o token fornecido pelo usuário, mantido somente na sessão.

| Cenário | Execução técnica | Avaliação visual |
| --- | --- | --- |
| Remover a maçã e deixar a mesa vazia | Passou; pixels externos idênticos; diferença prévia/editor até 1/255 | **Falhou:** a IA colocou um vaso de madeira no lugar da maçã |
| Tornar a maçã verde | Passou; pixels externos idênticos; diferença até 1/255 | **Falhou:** a maçã continuou predominantemente vermelha, com partes verdes |
| Documento 768×1024, seleção poligonal, maçã → laranja | Passou; tamanho correto; pixels externos idênticos; diferença até 1/255 | **Aprovado neste exemplo:** laranja reconhecível e integrada à mesa |
| Duas áreas separadas no fundo | Passou; pixels externos idênticos; diferença até 1/255 | Teste de geometria aprovado; efeito visual discreto, sem critério forte de fidelidade semântica |
| Geração por texto em 1024×768 | **Bloqueada por cota gratuita da conta** | Não avaliada nesta rodada; nenhuma imagem nova foi entregue |
| Repetir maçã → caneca com a ponte revisada | **Bloqueada pela mesma cota** | Não avaliada nesta rodada; o resultado da rodada anterior continua como evidência histórica |

No caso de duas regiões, a comparação com a fixture original encontrou 19.714 pixels diferentes na região esquerda e 20.295 na direita, de 22.400 pixels em cada uma. As duas regiões receberam edição; o teste não aprova automaticamente o conteúdo criado.

Não foram feitas migrações para serviços pagos nem tentativas de contornar a cota. A geração paisagem não foi marcada como aprovada com uma imagem anterior.

## Bugs encontrados e corrigidos nesta auditoria

### Identificação de documentos e importação

A inserção antiga podia usar o primeiro documento como fallback e escolher o último documento diferente do destino como imagem importada. Com várias abas abertas, isso podia atingir um documento incorreto.

A implementação agora registra os identificadores de todos os documentos antes do import e aceita somente uma nova imagem inequivocamente identificada. Se o destino desaparecer, se nenhum documento novo aparecer ou se houver duas novas abas, a operação falha sem duplicar ou fechar documentos desconhecidos.

O teste real também mostrou que propriedades JavaScript arbitrárias em wrappers de documentos não persistem no Photopea. A solução usa o campo `Document.source`, documentado como leitura/escrita para identificação, com prefixo próprio e preservação do valor anterior no identificador. O nome e os pixels do documento não são alterados por essa identificação. Um host com `customIO` próprio deve considerar esse uso do campo ao integrar o plugin. Referência: [Scripts do Photopea](https://www.photopea.com/learn/scripts).

Os testes Node cobrem fontes inicialmente iguais, importação fora da última posição, aba ativa diferente, fechamento do destino, criação simultânea de outra aba e import que não cria documento. O editor real confirmou identidade estável, bloqueio de troca de documento, inserção no destino correto e preservação da outra aba.

### Captura com tamanho antigo

Redimensionar o documento depois da captura tornava a máscara e o patch antigos incompatíveis. Agora há verificação antes da inferência e antes da inserção, inclusive se o tamanho mudar durante o import. A interface exige nova captura.

### Credenciais e armazenamento bloqueado

Leituras de `localStorage` podiam derrubar a interface em iframes com armazenamento indisponível. Agora a interface funciona em modo de sessão; falhas de persistência são informadas sem afirmar que a chave foi gravada.

Limpar uma chave temporária também podia reativar uma chave antiga persistida. Uma configuração vazia agora desativa explicitamente a credencial na sessão. A remoção com armazenamento bloqueado não exibe confirmação falsa de remoção persistente.

### Cancelamento e mensagens

O cancelamento voltou a liberar os controles na interface de produção. Há testes para cancelamento antes da conexão, durante conexão e com trabalho já submetido, além de encerramento de stream sem imagem. A chamada de cancelamento remoto é testada com simulação; nesta rodada o teste pela interface verificou cancelamento local, sem provar interrupção de processamento remoto.

O botão de configurar token agora aparece em erros pertinentes de cota/autenticação, em vez de aparecer após qualquer erro ou cancelamento.

## Critérios finitos para chamar de pronto

### Escopo principal do plugin

- [x] Capturar documento e seleção reais, informando ausência de seleção.
- [x] Processar o recorte e recolocá-lo no tamanho e nas coordenadas corretas.
- [x] Preservar exatamente os pixels externos nas fixtures e inferências avaliadas.
- [x] Inserir em nova camada sem apagar a original.
- [x] Bloquear documento diferente e captura incompatível após redimensionamento.
- [x] Não adivinhar o destino ou fechar documentos desconhecidos numa importação ambígua.
- [x] Manter consistência entre prévia e camada, admitindo arredondamento observado de 1/255 no Photopea.
- [x] Ajustar acabamento localmente, sem outra inferência (validado na rodada anterior).
- [x] Tratar cancelamento, timeout, fim de stream sem resultado e cota.
- [x] Funcionar sem persistir chave e com armazenamento bloqueado.
- [x] Compilar e carregar o build estático local.

### Aceite visual e entrega

- [ ] Remover objeto sem inventar outro nos casos de referência.
- [ ] Aplicar a cor solicitada ao objeto nos casos de referência.
- [ ] Repetir geração paisagem e substituição com a versão atual quando houver cota.
- [ ] Concluir a última repetição de cancelamento no build estático após recuperar a automação do navegador.
- [ ] Repetir pelo menos três imagens de referência por operação anunciada, incluindo fundo texturizado e seleção irregular, e registrar falhas junto dos acertos.
- [ ] Validar instalação e uso na hospedagem HTTPS final, caso distribuição pública faça parte da entrega.

As integrações opcionais NVIDIA/OpenAI/Stability/Replicate/custom não foram homologadas com novas inferências nesta auditoria. A conclusão se refere ao fluxo principal gratuito SDXL + Photopea. Variação continua desativada; não deve ser anunciada como pronta.

## O que falta resolver

1. **Separar operações com critérios diferentes.** Remover exige reconstruir o fundo sem sintetizar um novo objeto; trocar cor exige preservar forma e textura. O caminho atual envia ambos como uma geração genérica por prompt. Os exemplos mostram que isso ainda não é confiável.
2. **Definir o alcance anunciado.** Se a primeira versão for substituição generativa com aprovação manual, documentar esse escopo. Se incluir remoção e troca de cor confiáveis, criar caminhos próprios e seus testes de aceite antes de marcar a entrega como concluída.
3. **Repetir os testes pendentes após renovação de cota.** Não é necessária nova permissão para as mesmas fixtures e serviço, mas é necessário que o serviço permita inferência. Isso não autoriza contratação ou uso pago.
4. **Validar o endereço final.** A execução em localhost e no preview estático não comprova instalação numa hospedagem ainda não definida.

## Evidências e reprodução

- `tests/readiness.html`: cenários de inferência e nove verificações técnicas no Photopea real.
- `tests/storage-sandbox.html`: interface com acesso ao armazenamento bloqueado pelo sandbox.
- `tests/bridge-insertion.test.mjs`: regressões de identidade, concorrência e redimensionamento.
- `test-results/audit-remove.png`, `audit-recolor.png`, `audit-portrait.png`, `audit-islands.png`: saídas reais, incluindo falhas.
- `test-results/audit-remove.txt`, `audit-recolor.txt`, `audit-portrait.txt`, `audit-islands.txt`: prompts, tempos e comparações de pixels.
- `test-results/audit-text.txt`: erro real de cota, sem imagem nova.
- `test-results/audit-storage-sandbox.png`: fallback explícito para sessão.
- `test-results/audit-technical.txt`, `audit-bridge.txt`, `audit-canvas.txt`: resultados finais preservados antes do timeout de automação.
- `test-results/audit-gallery.html`: comparação visual dos quatro resultados novos, incluindo os reprovados.

**Conclusão:** bom estado técnico para substituição assistida com revisão, mas ainda não aceito como conclusão integral de edição fiel por IA. Os bloqueadores restantes estão identificados e podem ser tratados com um escopo de aceite finito, sem confundir API funcionando com pedido atendido.
